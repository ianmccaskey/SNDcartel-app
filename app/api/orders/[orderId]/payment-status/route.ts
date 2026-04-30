import { NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { orders, payments, alchemyWebhookEvents } from '@/db/schema'
import { auth } from '@/lib/auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await params
    const userId = session.user.id

    const [order] = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        orderStatus: orders.orderStatus,
        paymentStatus: orders.paymentStatus,
        totalUsd: orders.totalUsd,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const isAdmin = session.user.role === 'admin'
    if (order.userId !== userId && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get most recent payment record
    const [latestPayment] = await db
      .select({
        id: payments.id,
        txHash: payments.txHash,
        status: payments.status,
        explorerUrl: payments.explorerUrl,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt))
      .limit(1)

    // Get most recent Alchemy match event for this order
    const [latestAlchemyEvent] = await db
      .select({
        id: alchemyWebhookEvents.id,
        transactionHash: alchemyWebhookEvents.transactionHash,
        matchConfidence: alchemyWebhookEvents.matchConfidence,
        processed: alchemyWebhookEvents.processed,
        createdAt: alchemyWebhookEvents.createdAt,
      })
      .from(alchemyWebhookEvents)
      .where(eq(alchemyWebhookEvents.matchedOrderId, orderId))
      .orderBy(desc(alchemyWebhookEvents.createdAt))
      .limit(1)

    return NextResponse.json({
      orderId: order.id,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalUsd: parseFloat(order.totalUsd),
      latestPayment: latestPayment
        ? {
            id: latestPayment.id,
            txHash: latestPayment.txHash,
            status: latestPayment.status,
            explorerUrl: latestPayment.explorerUrl,
            createdAt: latestPayment.createdAt.toISOString(),
          }
        : null,
      alchemyDetected: latestAlchemyEvent
        ? {
            transactionHash: latestAlchemyEvent.transactionHash,
            confidence: latestAlchemyEvent.matchConfidence,
            processed: latestAlchemyEvent.processed,
            detectedAt: latestAlchemyEvent.createdAt.toISOString(),
          }
        : null,
    })
  } catch (error) {
    console.error('GET /api/orders/[orderId]/payment-status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
