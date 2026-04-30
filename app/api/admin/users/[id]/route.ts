import { NextResponse } from 'next/server'
import { eq, desc, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { users, orders, orderItems, wallets, groupBuys } from '@/db/schema'
import { auth } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

function requireAdmin(session: Awaited<ReturnType<typeof auth>>) {
  return !!(session?.user?.id && session.user.role === 'admin')
}

const patchSchema = z.object({
  notes: z.string().optional(),
  accountStatus: z.enum(['active', 'suspended', 'pending']).optional(),
  discordName: z.string().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!requireAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        discordName: users.discordName,
        phone: users.phone,
        accountStatus: users.accountStatus,
        profileComplete: users.profileComplete,
        role: users.role,
        shippingLine1: users.shippingLine1,
        shippingLine2: users.shippingLine2,
        shippingCity: users.shippingCity,
        shippingState: users.shippingState,
        shippingZip: users.shippingZip,
        shippingCountry: users.shippingCountry,
        notes: users.notes,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch wallets
    const userWallets = await db
      .select({ id: wallets.id, chain: wallets.chain, address: wallets.address, label: wallets.label })
      .from(wallets)
      .where(eq(wallets.userId, id))

    // Fetch orders with items
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
        adminNotes: orders.adminNotes,
        createdAt: orders.createdAt,
        groupBuyName: groupBuys.name,
      })
      .from(orders)
      .leftJoin(groupBuys, eq(orders.groupBuyId, groupBuys.id))
      .where(eq(orders.userId, id))
      .orderBy(desc(orders.createdAt))

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

    return NextResponse.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      discordName: user.discordName,
      phone: user.phone,
      accountStatus: user.accountStatus,
      profileComplete: user.profileComplete,
      role: user.role,
      shippingAddress: {
        line1: user.shippingLine1,
        line2: user.shippingLine2,
        city: user.shippingCity,
        state: user.shippingState,
        zip: user.shippingZip,
        country: user.shippingCountry,
      },
      notes: user.notes,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      wallets: userWallets,
      orders: userOrders.map((o) => ({
        id: o.id,
        groupBuyId: o.groupBuyId,
        groupBuyName: o.groupBuyName,
        storeOrder: o.storeOrder,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        subtotalUsd: parseFloat(o.subtotalUsd),
        shippingFeeUsd: parseFloat(o.shippingFeeUsd),
        adminFeeUsd: parseFloat(o.adminFeeUsd),
        totalUsd: parseFloat(o.totalUsd),
        adminNotes: o.adminNotes,
        createdAt: o.createdAt.toISOString(),
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
      })),
    })
  } catch (error) {
    console.error('GET /api/admin/users/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!requireAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: Partial<{ notes: string | null; accountStatus: string; discordName: string | null; updatedAt: Date }> = {
      updatedAt: new Date(),
    }

    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes
    if (parsed.data.accountStatus !== undefined) updateData.accountStatus = parsed.data.accountStatus
    if (parsed.data.discordName !== undefined) updateData.discordName = parsed.data.discordName

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({ id: users.id, accountStatus: users.accountStatus, notes: users.notes, discordName: users.discordName })

    await logAdminAction({
      adminUserId: session!.user!.id,
      actionType: 'user_updated',
      targetType: 'user',
      targetId: id,
      payload: parsed.data,
      request,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/admin/users/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
