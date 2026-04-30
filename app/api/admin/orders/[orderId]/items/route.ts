import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderItems, products, storeProducts } from '@/db/schema'
import { auth } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

function requireAdmin(session: Awaited<ReturnType<typeof auth>>) {
  return !!(session?.user?.id && session.user.role === 'admin')
}

const addItemSchema = z.object({
  productId: z.string().uuid().optional(),
  storeProductId: z.string().uuid().optional(),
  quantity: z.number().int().min(1),
  unitPriceUsd: z.number().positive(),
  productNameSnapshot: z.string().min(1),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await auth()
    if (!requireAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderId } = await params
    const body = await request.json()

    const parsed = addItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const [order] = await db
      .select({ id: orders.id, totalUsd: orders.totalUsd, subtotalUsd: orders.subtotalUsd })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { productId, storeProductId, quantity, unitPriceUsd, productNameSnapshot } = parsed.data

    const [newItem] = await db
      .insert(orderItems)
      .values({
        orderId,
        productId: productId ?? null,
        storeProductId: storeProductId ?? null,
        quantity,
        unitPriceUsd: unitPriceUsd.toFixed(2),
        productNameSnapshot,
        fulfillmentStatus: 'awaiting_vendor',
      })
      .returning()

    // Recalculate subtotal and total
    const lineTotal = quantity * unitPriceUsd
    await db
      .update(orders)
      .set({
        subtotalUsd: sql`${orders.subtotalUsd} + ${lineTotal.toFixed(2)}`,
        totalUsd: sql`${orders.totalUsd} + ${lineTotal.toFixed(2)}`,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))

    await logAdminAction({
      adminUserId: session!.user!.id,
      actionType: 'order_item_added',
      targetType: 'order',
      targetId: orderId,
      payload: { productNameSnapshot, quantity, unitPriceUsd },
      request,
    })

    return NextResponse.json(
      {
        id: newItem.id,
        orderId: newItem.orderId,
        productId: newItem.productId,
        storeProductId: newItem.storeProductId,
        quantity: newItem.quantity,
        unitPriceUsd: parseFloat(newItem.unitPriceUsd),
        productNameSnapshot: newItem.productNameSnapshot,
        fulfillmentStatus: newItem.fulfillmentStatus,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('POST /api/admin/orders/[orderId]/items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
