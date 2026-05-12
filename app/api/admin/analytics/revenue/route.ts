import { NextResponse } from 'next/server'
import { sql, isNull, and, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { orders, groupBuys } from '@/db/schema'
import { listManageableGroupBuyIds, requireAdminOrOperator } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await requireAdminOrOperator()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ownable = await listManageableGroupBuyIds(session)
    if (ownable !== null && ownable.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const whereClause =
      ownable !== null
        ? and(isNull(groupBuys.deletedAt), inArray(orders.groupBuyId, ownable))
        : isNull(groupBuys.deletedAt)

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
      .where(whereClause)
      .groupBy(orders.groupBuyId, groupBuys.name)
      .orderBy(sql`sum(${orders.totalUsd}::numeric) desc nulls last`)
      .limit(10)

    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('[analytics/revenue]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
