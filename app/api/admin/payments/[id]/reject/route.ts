import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { payments, orders } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
  adminNotes: z.string().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { reason, adminNotes } = parsed.data

    const [payment] = await db
      .select({ id: payments.id, orderId: payments.orderId, status: payments.status })
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1)

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.status !== 'pending') {
      return NextResponse.json(
        { error: `Payment is already ${payment.status}` },
        { status: 409 },
      )
    }

    // Update payment to rejected
    await db
      .update(payments)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        adminNotes: adminNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))

    // Revert order back to pending_payment
    await db
      .update(orders)
      .set({
        orderStatus: 'pending_payment',
        paymentStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, payment.orderId))

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'payment_rejected',
      targetType: 'payment',
      targetId: id,
      payload: { orderId: payment.orderId, reason, adminNotes },
      request,
    })

    return NextResponse.json({ ok: true, paymentId: id, orderId: payment.orderId })
  } catch (error) {
    console.error('PATCH /api/admin/payments/[id]/reject error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
