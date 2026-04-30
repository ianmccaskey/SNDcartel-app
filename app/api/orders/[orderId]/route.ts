import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderItems, payments, shipments, groupBuys } from '@/db/schema'
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

    // Fetch order (must belong to the current user unless admin)
    const [order] = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        groupBuyId: orders.groupBuyId,
        storeOrder: orders.storeOrder,
        orderStatus: orders.orderStatus,
        paymentStatus: orders.paymentStatus,
        subtotalUsd: orders.subtotalUsd,
        shippingFeeUsd: orders.shippingFeeUsd,
        adminFeeUsd: orders.adminFeeUsd,
        totalUsd: orders.totalUsd,
        customerWalletAddress: orders.customerWalletAddress,
        adminNotes: orders.adminNotes,
        userNotes: orders.userNotes,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        groupBuyName: groupBuys.name,
      })
      .from(orders)
      .leftJoin(groupBuys, eq(orders.groupBuyId, groupBuys.id))
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Only allow the owning user or admins to see the order
    const isAdmin = session.user.role === 'admin'
    if (order.userId !== userId && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch items, payments, shipments in parallel
    const [items, orderPayments, orderShipments] = await Promise.all([
      db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId)),
      db
        .select({
          id: payments.id,
          txHash: payments.txHash,
          blockchainNetwork: payments.blockchainNetwork,
          fromWalletAddress: payments.fromWalletAddress,
          amountSubmittedUsd: payments.amountSubmittedUsd,
          amountExpectedUsd: payments.amountExpectedUsd,
          tokenSymbol: payments.tokenSymbol,
          explorerUrl: payments.explorerUrl,
          status: payments.status,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(eq(payments.orderId, orderId)),
      db
        .select({
          id: shipments.id,
          carrier: shipments.carrier,
          trackingNumber: shipments.trackingNumber,
          trackingUrl: shipments.trackingUrl,
          shippedAt: shipments.shippedAt,
          estimatedDelivery: shipments.estimatedDelivery,
          deliveredAt: shipments.deliveredAt,
          isPartial: shipments.isPartial,
        })
        .from(shipments)
        .where(eq(shipments.orderId, orderId)),
    ])

    const result = {
      id: order.id,
      groupBuyId: order.groupBuyId,
      groupBuyTitle: order.storeOrder ? 'Store Purchase' : (order.groupBuyName ?? 'Group Buy'),
      storeOrder: order.storeOrder,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      subtotalUsd: parseFloat(order.subtotalUsd),
      shippingFeeUsd: parseFloat(order.shippingFeeUsd),
      adminFeeUsd: parseFloat(order.adminFeeUsd),
      totalUsd: parseFloat(order.totalUsd),
      customerWalletAddress: order.customerWalletAddress,
      userNotes: order.userNotes,
      ...(isAdmin ? { adminNotes: order.adminNotes } : {}),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        storeProductId: item.storeProductId,
        quantity: item.quantity,
        unitPriceUsd: parseFloat(item.unitPriceUsd),
        lineTotalUsd: item.lineTotalUsd ? parseFloat(item.lineTotalUsd) : null,
        productNameSnapshot: item.productNameSnapshot,
        fulfillmentStatus: item.fulfillmentStatus,
      })),
      payments: orderPayments.map((p) => ({
        id: p.id,
        txHash: p.txHash,
        blockchainNetwork: p.blockchainNetwork,
        fromWalletAddress: p.fromWalletAddress,
        amountSubmittedUsd: p.amountSubmittedUsd ? parseFloat(p.amountSubmittedUsd) : null,
        amountExpectedUsd: parseFloat(p.amountExpectedUsd),
        tokenSymbol: p.tokenSymbol,
        explorerUrl: p.explorerUrl,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
      shipments: orderShipments.map((s) => ({
        id: s.id,
        carrier: s.carrier,
        trackingNumber: s.trackingNumber,
        trackingUrl: s.trackingUrl,
        shippedAt: s.shippedAt?.toISOString() ?? null,
        estimatedDelivery: s.estimatedDelivery?.toISOString() ?? null,
        deliveredAt: s.deliveredAt?.toISOString() ?? null,
        isPartial: s.isPartial,
      })),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/orders/[orderId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
