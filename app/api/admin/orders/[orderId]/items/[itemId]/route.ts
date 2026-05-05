import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderItems } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const patchItemSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  fulfillmentStatus: z
    .enum(['awaiting_vendor', 'on_hand', 'packed', 'shipped', 'delivered'])
    .optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string; itemId: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderId, itemId } = await params
    const body = await request.json()

    const parsed = patchItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const [existing] = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        quantity: orderItems.quantity,
        unitPriceUsd: orderItems.unitPriceUsd,
        fulfillmentStatus: orderItems.fulfillmentStatus,
      })
      .from(orderItems)
      .where(eq(orderItems.id, itemId))
      .limit(1)

    if (!existing || existing.orderId !== orderId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const updateData: Partial<{ quantity: number; fulfillmentStatus: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    }

    if (parsed.data.quantity !== undefined) updateData.quantity = parsed.data.quantity
    if (parsed.data.fulfillmentStatus !== undefined) updateData.fulfillmentStatus = parsed.data.fulfillmentStatus

    const [updated] = await db
      .update(orderItems)
      .set(updateData)
      .where(eq(orderItems.id, itemId))
      .returning()

    // If quantity changed, recalculate order totals
    if (parsed.data.quantity !== undefined) {
      const qtyDiff = parsed.data.quantity - existing.quantity
      const unitPrice = parseFloat(existing.unitPriceUsd)
      const dollarDiff = (qtyDiff * unitPrice).toFixed(2)
      await db
        .update(orders)
        .set({
          subtotalUsd: sql`${orders.subtotalUsd} + ${dollarDiff}`,
          totalUsd: sql`${orders.totalUsd} + ${dollarDiff}`,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
    }

    await logAdminAction({
      adminUserId: session!.user!.id,
      actionType: 'order_item_updated',
      targetType: 'order',
      targetId: orderId,
      payload: { itemId, ...parsed.data },
      request,
    })

    return NextResponse.json({
      id: updated.id,
      quantity: updated.quantity,
      fulfillmentStatus: updated.fulfillmentStatus,
      unitPriceUsd: parseFloat(updated.unitPriceUsd),
      lineTotalUsd: updated.lineTotalUsd ? parseFloat(updated.lineTotalUsd) : null,
    })
  } catch (error) {
    console.error('PATCH /api/admin/orders/[orderId]/items/[itemId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orderId: string; itemId: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderId, itemId } = await params

    const [existing] = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        quantity: orderItems.quantity,
        unitPriceUsd: orderItems.unitPriceUsd,
        productNameSnapshot: orderItems.productNameSnapshot,
      })
      .from(orderItems)
      .where(eq(orderItems.id, itemId))
      .limit(1)

    if (!existing || existing.orderId !== orderId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await db.delete(orderItems).where(eq(orderItems.id, itemId))

    // Recalculate order totals
    const lineTotal = (existing.quantity * parseFloat(existing.unitPriceUsd)).toFixed(2)
    await db
      .update(orders)
      .set({
        subtotalUsd: sql`${orders.subtotalUsd} - ${lineTotal}`,
        totalUsd: sql`${orders.totalUsd} - ${lineTotal}`,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))

    await logAdminAction({
      adminUserId: session!.user!.id,
      actionType: 'order_item_removed',
      targetType: 'order',
      targetId: orderId,
      payload: { itemId, productNameSnapshot: existing.productNameSnapshot },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/admin/orders/[orderId]/items/[itemId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
