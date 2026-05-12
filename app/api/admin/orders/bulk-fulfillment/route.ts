import { NextResponse } from 'next/server'
import { inArray, eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { orderItems, orders } from '@/db/schema'
import { listManageableGroupBuyIds, requireAdminOrOperator } from '@/lib/permissions'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const bulkFulfillmentSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(200),
  fulfillmentStatus: z.enum(['awaiting_vendor', 'on_hand', 'packed', 'shipped', 'delivered']),
})

export async function POST(request: Request) {
  try {
    const session = await requireAdminOrOperator()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = bulkFulfillmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { orderIds, fulfillmentStatus } = parsed.data

    const ownable = await listManageableGroupBuyIds(session)
    if (ownable !== null) {
      // Operator: verify every requested order belongs to a group buy they
      // manage. Reject the whole request if any order is out of scope so we
      // never silently drop updates.
      if (ownable.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const ownedRows = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(inArray(orders.id, orderIds), inArray(orders.groupBuyId, ownable)))
      if (ownedRows.length !== orderIds.length) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const result = await db
      .update(orderItems)
      .set({ fulfillmentStatus, updatedAt: new Date() })
      .where(inArray(orderItems.orderId, orderIds))
      .returning({ id: orderItems.id })

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'bulk_fulfillment_status_updated',
      targetType: 'order',
      targetId: orderIds[0],
      payload: { orderIds, fulfillmentStatus, itemsUpdated: result.length },
      request,
    })

    return NextResponse.json({ ok: true, itemsUpdated: result.length })
  } catch (error) {
    console.error('POST /api/admin/orders/bulk-fulfillment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
