import { NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { shipments, orders, orderItems, users, groupBuys } from '@/db/schema'
import { auth } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { getTrackingUrl } from '@/lib/tracking'
import { sendShippingNotification } from '@/lib/email'
import { z } from 'zod'

function requireAdmin(session: Awaited<ReturnType<typeof auth>>) {
  return !!(session?.user?.id && session.user.role === 'admin')
}

const createShipmentSchema = z.object({
  orderId: z.string().uuid(),
  carrier: z.string().min(1).optional(),
  trackingNumber: z.string().min(1).optional(),
  estimatedDelivery: z.string().datetime({ offset: true }).optional(),
  isPartial: z.boolean().default(false),
  notes: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!requireAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const groupBuyId = searchParams.get('groupBuyId')
    const orderId = searchParams.get('orderId')

    // Build subquery: get order IDs belonging to the groupBuy
    let orderIds: string[] | null = null
    if (groupBuyId) {
      const gbOrders = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.groupBuyId, groupBuyId))
      orderIds = gbOrders.map((o) => o.id)
      if (orderIds.length === 0) return NextResponse.json({ shipments: [] })
    }

    const rows = await db
      .select({
        id: shipments.id,
        orderId: shipments.orderId,
        carrier: shipments.carrier,
        trackingNumber: shipments.trackingNumber,
        trackingUrl: shipments.trackingUrl,
        trackingImageUrl: shipments.trackingImageUrl,
        shippedAt: shipments.shippedAt,
        estimatedDelivery: shipments.estimatedDelivery,
        deliveredAt: shipments.deliveredAt,
        isPartial: shipments.isPartial,
        notes: shipments.notes,
        createdAt: shipments.createdAt,
        updatedAt: shipments.updatedAt,
      })
      .from(shipments)
      .where(
        orderId
          ? eq(shipments.orderId, orderId)
          : orderIds
            ? inArray(shipments.orderId, orderIds)
            : undefined,
      )
      .orderBy(shipments.createdAt)

    return NextResponse.json({
      shipments: rows.map((s) => ({
        ...s,
        shippedAt: s.shippedAt?.toISOString() ?? null,
        estimatedDelivery: s.estimatedDelivery?.toISOString() ?? null,
        deliveredAt: s.deliveredAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('GET /api/admin/shipments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!requireAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createShipmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { orderId, carrier, trackingNumber, estimatedDelivery, isPartial, notes } = parsed.data

    // Verify order exists and fetch user email + group buy name for the email
    const [order] = await db
      .select({
        id: orders.id,
        orderStatus: orders.orderStatus,
        userId: orders.userId,
        userEmail: users.email,
        userFullName: users.fullName,
        groupBuyName: groupBuys.name,
        storeOrder: orders.storeOrder,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(groupBuys, eq(orders.groupBuyId, groupBuys.id))
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Generate tracking URL
    const trackingUrl =
      carrier && trackingNumber ? getTrackingUrl(carrier, trackingNumber) || null : null

    const now = new Date()

    const [shipment] = await db
      .insert(shipments)
      .values({
        orderId,
        carrier: carrier ?? null,
        trackingNumber: trackingNumber ?? null,
        trackingUrl,
        shippedAt: now,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
        isPartial: isPartial ?? false,
        notes: notes ?? null,
        createdBy: session!.user!.id,
      })
      .returning()

    // Update order status to 'shipped' (unless partial-complete logic defers it)
    await db
      .update(orders)
      .set({ orderStatus: 'shipped', updatedAt: now })
      .where(eq(orders.id, orderId))

    // Update all order items fulfillment status to 'shipped'
    if (!isPartial) {
      await db
        .update(orderItems)
        .set({ fulfillmentStatus: 'shipped', updatedAt: now })
        .where(eq(orderItems.orderId, orderId))
    }

    await logAdminAction({
      adminUserId: session!.user!.id,
      actionType: 'shipment_created',
      targetType: 'shipment',
      targetId: shipment.id,
      payload: { orderId, carrier, trackingNumber, isPartial, notes },
      request,
    })

    // Send shipping notification email (non-blocking)
    if (order.userEmail) {
      const orderTitle = order.groupBuyName ?? (order.storeOrder ? 'Store Order' : 'Order')
      sendShippingNotification({
        to: order.userEmail,
        data: {
          orderTitle,
          userFullName: order.userFullName,
          carrier: carrier ?? null,
          trackingNumber: trackingNumber ?? null,
          trackingUrl,
          estimatedDelivery: estimatedDelivery
            ? new Date(estimatedDelivery).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : null,
          isPartial: isPartial ?? false,
          notes: notes ?? null,
        },
      })
    }

    return NextResponse.json(
      {
        id: shipment.id,
        orderId: shipment.orderId,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl,
        shippedAt: shipment.shippedAt?.toISOString() ?? null,
        estimatedDelivery: shipment.estimatedDelivery?.toISOString() ?? null,
        isPartial: shipment.isPartial,
        notes: shipment.notes,
        createdAt: shipment.createdAt.toISOString(),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('POST /api/admin/shipments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
