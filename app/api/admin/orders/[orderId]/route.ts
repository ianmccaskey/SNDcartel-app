import { NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderItems, groupBuys, users, payments } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const patchSchema = z.object({
  orderStatus: z
    .enum([
      'pending_payment',
      'payment_submitted',
      'payment_verified',
      'processing',
      'shipped',
      'completed',
      'rejected',
      'cancelled',
    ])
    .optional(),
  adminNotes: z.string().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderId } = await params

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
        userEmail: users.email,
        userFullName: users.fullName,
        userDiscordName: users.discordName,
      })
      .from(orders)
      .leftJoin(groupBuys, eq(orders.groupBuyId, groupBuys.id))
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))

    const orderPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))

    return NextResponse.json({
      id: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      userFullName: order.userFullName,
      userDiscordName: order.userDiscordName,
      groupBuyId: order.groupBuyId,
      groupBuyName: order.groupBuyName,
      storeOrder: order.storeOrder,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      subtotalUsd: parseFloat(order.subtotalUsd),
      shippingFeeUsd: parseFloat(order.shippingFeeUsd),
      adminFeeUsd: parseFloat(order.adminFeeUsd),
      totalUsd: parseFloat(order.totalUsd),
      customerWalletAddress: order.customerWalletAddress,
      adminNotes: order.adminNotes,
      userNotes: order.userNotes,
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
        withinTolerance: p.withinTolerance,
        status: p.status,
        rejectionReason: p.rejectionReason,
        adminNotes: p.adminNotes,
        createdAt: p.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('GET /api/admin/orders/[orderId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderId } = await params
    const body = await request.json()

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: orders.id, orderStatus: orders.orderStatus })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const updateData: Partial<{ orderStatus: string; adminNotes: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    }

    if (parsed.data.orderStatus !== undefined) updateData.orderStatus = parsed.data.orderStatus
    if (parsed.data.adminNotes !== undefined) updateData.adminNotes = parsed.data.adminNotes

    const [updated] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning()

    await logAdminAction({
      adminUserId: session!.user!.id,
      actionType: 'order_updated',
      targetType: 'order',
      targetId: orderId,
      payload: {
        previousStatus: existing.orderStatus,
        ...parsed.data,
      },
      request,
    })

    return NextResponse.json({
      id: updated.id,
      orderStatus: updated.orderStatus,
      adminNotes: updated.adminNotes,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('PATCH /api/admin/orders/[orderId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
