import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { payments, orders } from '@/db/schema'
import { canManageGroupBuy, requireAdminOrOperator } from '@/lib/permissions'
import { logAdminAction } from '@/lib/audit'
import { transitionOrderStatus } from '@/lib/order-status'
import { notifyPaymentRejected } from '@/lib/order-emails'
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
    const session = await requireAdminOrOperator()
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
      .select({
        id: payments.id,
        orderId: payments.orderId,
        status: payments.status,
        orderGroupBuyId: orders.groupBuyId,
      })
      .from(payments)
      .leftJoin(orders, eq(payments.orderId, orders.id))
      .where(eq(payments.id, id))
      .limit(1)

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Store orders (groupBuyId === null) are admin-only.
    if (payment.orderGroupBuyId === null) {
      if (session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (!(await canManageGroupBuy(session, payment.orderGroupBuyId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    // Flip the order itself to payment_rejected so the customer can see it
    // and re-engage with the checkout flow. (Phase 4 the order silently
    // reverted to pending_payment, which left the rejection invisible to
    // the customer.) Logs to orderStatusHistory atomically.
    await transitionOrderStatus({
      orderId: payment.orderId,
      toStatus: 'payment_rejected',
      changedBy: session.user.id,
      reason,
      extraUpdates: { paymentStatus: 'rejected' },
    })

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'payment_rejected',
      targetType: 'payment',
      targetId: id,
      payload: { orderId: payment.orderId, reason, adminNotes },
      request,
    })

    // Customer notification — fire-and-forget so a Resend/ZeptoMail outage
    // can't unwind the rejection that already landed in the DB.
    void notifyPaymentRejected(payment.orderId, reason)

    return NextResponse.json({ ok: true, paymentId: id, orderId: payment.orderId })
  } catch (error) {
    console.error('PATCH /api/admin/payments/[id]/reject error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
