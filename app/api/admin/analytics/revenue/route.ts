import { NextResponse } from 'next/server'
import { sql, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { orders, groupBuys } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Revenue per group buy (top 10)
    const rows = await db
      .select({
        groupBuyId: orders.groupBuyId,
        name: groupBuys.name,
        orderCount: sql<number>`count(${orders.id})::int`,
        revenue: sql<number>`coalesce(sum(${orders.totalUsd}::numeric), 0)::float`,
      })
      .from(orders)
      .leftJoin(groupBuys, sql`${orders.groupBuyId} = ${groupBuys.id}`)
      .where(isNull(groupBuys.deletedAt))
      .groupBy(orders.groupBuyId, groupBuys.name)
      .orderBy(sql`sum(${orders.totalUsd}::numeric) desc nulls last`)
      .limit(10)

    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('[analytics/revenue]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
