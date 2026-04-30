import { NextResponse } from 'next/server'
import { eq, desc, and, isNull, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderItems, groupBuys, storeProducts, products, users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const createOrderSchema = z.object({
  groupBuyId: z.string().uuid().optional(),
  storeOrder: z.boolean().optional().default(false),
  customerWalletAddress: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        storeProductId: z.string().uuid().optional(),
        quantity: z.number().int().min(1),
        unitPriceUsd: z.number().positive(),
        productNameSnapshot: z.string().min(1),
      }),
    )
    .min(1),
  userNotes: z.string().optional(),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const userOrders = await db
      .select({
        id: orders.id,
        groupBuyId: orders.groupBuyId,
        storeOrder: orders.storeOrder,
        orderStatus: orders.orderStatus,
        paymentStatus: orders.paymentStatus,
        subtotalUsd: orders.subtotalUsd,
        shippingFeeUsd: orders.shippingFeeUsd,
        adminFeeUsd: orders.adminFeeUsd,
        totalUsd: orders.totalUsd,
        customerWalletAddress: orders.customerWalletAddress,
        userNotes: orders.userNotes,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        groupBuyName: groupBuys.name,
      })
      .from(orders)
      .leftJoin(groupBuys, eq(orders.groupBuyId, groupBuys.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))

    // Fetch items for all orders
    const orderIds = userOrders.map((o) => o.id)
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

    const result = userOrders.map((order) => ({
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
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: (itemsByOrderId[order.id] ?? []).map((item) => ({
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

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()

    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { groupBuyId, storeOrder, customerWalletAddress, items, userNotes } = parsed.data

    // Validate user profile is complete before placing an order
    const [user] = await db
      .select({ profileComplete: users.profileComplete })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user?.profileComplete) {
      return NextResponse.json(
        { error: 'Profile incomplete. Please complete your profile before placing an order.' },
        { status: 422 },
      )
    }

    // If group buy order, validate GB is active
    if (groupBuyId) {
      const [gb] = await db
        .select({ status: groupBuys.status })
        .from(groupBuys)
        .where(and(eq(groupBuys.id, groupBuyId), isNull(groupBuys.deletedAt)))
        .limit(1)

      if (!gb) {
        return NextResponse.json({ error: 'Group buy not found' }, { status: 404 })
      }
      if (gb.status !== 'active') {
        return NextResponse.json({ error: 'Group buy is not currently active' }, { status: 409 })
      }
    }

    // Validate each product exists and is in stock
    for (const item of items) {
      if (item.productId) {
        const [prod] = await db
          .select({ inStock: products.inStock, deletedAt: products.deletedAt })
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1)
        if (!prod || prod.deletedAt) {
          return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 404 })
        }
        if (!prod.inStock) {
          return NextResponse.json(
            { error: `Product "${item.productNameSnapshot}" is out of stock` },
            { status: 409 },
          )
        }
      } else if (item.storeProductId) {
        const [prod] = await db
          .select({ available: storeProducts.available, deletedAt: storeProducts.deletedAt })
          .from(storeProducts)
          .where(eq(storeProducts.id, item.storeProductId))
          .limit(1)
        if (!prod || prod.deletedAt) {
          return NextResponse.json({ error: `Store product ${item.storeProductId} not found` }, { status: 404 })
        }
        if (!prod.available) {
          return NextResponse.json(
            { error: `Product "${item.productNameSnapshot}" is not available` },
            { status: 409 },
          )
        }
      }
    }

    // Calculate totals
    const subtotalUsd = items.reduce((sum, item) => sum + item.unitPriceUsd * item.quantity, 0)

    let shippingFeeUsd = 0
    let adminFeeUsd = 0

    if (groupBuyId) {
      const [gb] = await db
        .select({ shippingFeeUsd: groupBuys.shippingFeeUsd, adminFeeUsd: groupBuys.adminFeeUsd })
        .from(groupBuys)
        .where(eq(groupBuys.id, groupBuyId))
        .limit(1)

      if (gb) {
        shippingFeeUsd = parseFloat(gb.shippingFeeUsd)
        adminFeeUsd = parseFloat(gb.adminFeeUsd)
      }
    }

    const totalUsd = subtotalUsd + shippingFeeUsd + adminFeeUsd

    // Create order in a transaction
    const [newOrder] = await db
      .insert(orders)
      .values({
        userId,
        groupBuyId: groupBuyId ?? null,
        storeOrder: storeOrder ?? false,
        orderStatus: 'pending_payment',
        paymentStatus: 'pending',
        subtotalUsd: subtotalUsd.toFixed(2),
        shippingFeeUsd: shippingFeeUsd.toFixed(2),
        adminFeeUsd: adminFeeUsd.toFixed(2),
        totalUsd: totalUsd.toFixed(2),
        customerWalletAddress: customerWalletAddress ?? null,
        userNotes: userNotes ?? null,
      })
      .returning()

    // Insert order items
    const itemValues = items.map((item) => ({
      orderId: newOrder.id,
      productId: item.productId ?? null,
      storeProductId: item.storeProductId ?? null,
      quantity: item.quantity,
      unitPriceUsd: item.unitPriceUsd.toFixed(2),
      productNameSnapshot: item.productNameSnapshot,
      fulfillmentStatus: 'awaiting_vendor' as const,
    }))

    await db.insert(orderItems).values(itemValues)

    // Update kits_ordered count on products
    for (const item of items) {
      if (item.productId) {
        await db
          .update(products)
          .set({ kitsOrdered: sql`${products.kitsOrdered} + ${item.quantity}` })
          .where(eq(products.id, item.productId))
      }
    }

    // Update group buy total_kits_ordered
    if (groupBuyId) {
      const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)
      await db
        .update(groupBuys)
        .set({ totalKitsOrdered: sql`${groupBuys.totalKitsOrdered} + ${totalQty}` })
        .where(eq(groupBuys.id, groupBuyId))
    }

    return NextResponse.json(
      {
        id: newOrder.id,
        orderStatus: newOrder.orderStatus,
        paymentStatus: newOrder.paymentStatus,
        totalUsd: parseFloat(newOrder.totalUsd),
        createdAt: newOrder.createdAt.toISOString(),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
