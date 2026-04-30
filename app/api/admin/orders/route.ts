import { NextResponse } from 'next/server'
import { eq, desc, and, inArray, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderItems, groupBuys, users, payments } from '@/db/schema'
import { auth } from '@/lib/auth'

function requireAdmin(session: Awaited<ReturnType<typeof auth>>) {
  return !!(session?.user?.id && session.user.role === 'admin')
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!requireAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const groupBuyId = searchParams.get('groupBuyId')
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const offset = (page - 1) * limit

    const conditions = []
    if (groupBuyId) conditions.push(eq(orders.groupBuyId, groupBuyId))
    if (status) conditions.push(eq(orders.orderStatus, status))
    if (userId) conditions.push(eq(orders.userId, userId))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(whereClause)

    const rows = await db
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
      })
      .from(orders)
      .leftJoin(groupBuys, eq(orders.groupBuyId, groupBuys.id))
      .leftJoin(users, eq(orders.userId, users.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset)

    // Fetch items for returned orders
    const orderIds = rows.map((o) => o.id)
    let allItems: Array<{
      id: string
      orderId: string
      productId: string | null
      storeProductId: string | null
      quantity: number
      unitPriceUsd: string
      lineTotalUsd: string | null
      productNameSnapshot: string
      fulfillmentStatus: string
    }> = []

    if (orderIds.length > 0) {
      allItems = await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          storeProductId: orderItems.storeProductId,
          quantity: orderItems.quantity,
          unitPriceUsd: orderItems.unitPriceUsd,
          lineTotalUsd: orderItems.lineTotalUsd,
          productNameSnapshot: orderItems.productNameSnapshot,
          fulfillmentStatus: orderItems.fulfillmentStatus,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds))
    }

    const itemsByOrderId = allItems.reduce(
      (acc, item) => {
        if (!acc[item.orderId]) acc[item.orderId] = []
        acc[item.orderId].push(item)
        return acc
      },
      {} as Record<string, typeof allItems>,
    )

    const result = rows.map((o) => ({
      id: o.id,
      userId: o.userId,
      userEmail: o.userEmail,
      userFullName: o.userFullName,
      groupBuyId: o.groupBuyId,
      groupBuyName: o.groupBuyName,
      storeOrder: o.storeOrder,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      subtotalUsd: parseFloat(o.subtotalUsd),
      shippingFeeUsd: parseFloat(o.shippingFeeUsd),
      adminFeeUsd: parseFloat(o.adminFeeUsd),
      totalUsd: parseFloat(o.totalUsd),
      customerWalletAddress: o.customerWalletAddress,
      adminNotes: o.adminNotes,
      userNotes: o.userNotes,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      items: (itemsByOrderId[o.id] ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        storeProductId: item.storeProductId,
        quantity: item.quantity,
        unitPriceUsd: parseFloat(item.unitPriceUsd),
        lineTotalUsd: item.lineTotalUsd ? parseFloat(item.lineTotalUsd) : null,
        productNameSnapshot: item.productNameSnapshot,
        fulfillmentStatus: item.fulfillmentStatus,
      })),
    }))

    return NextResponse.json({
      orders: result,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    })
  } catch (error) {
    console.error('GET /api/admin/orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
