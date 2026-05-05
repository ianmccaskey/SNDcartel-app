import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { payments, orders } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const approveSchema = z.object({
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
    const body = await request.json().catch(() => ({}))
    const parsed = approveSchema.safeParse(body)

    const adminNotes = parsed.success ? parsed.data.adminNotes : undefined

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

    // Update payment to approved
    await db
      .update(payments)
      .set({
        status: 'approved',
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        adminNotes: adminNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))

    // Update order to payment_verified
    await db
      .update(orders)
      .set({
        orderStatus: 'payment_verified',
        paymentStatus: 'verified',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, payment.orderId))

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'payment_approved',
      targetType: 'payment',
      targetId: id,
      payload: { orderId: payment.orderId, adminNotes },
      request,
    })

    return NextResponse.json({ ok: true, paymentId: id, orderId: payment.orderId })
  } catch (error) {
    console.error('PATCH /api/admin/payments/[id]/approve error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
