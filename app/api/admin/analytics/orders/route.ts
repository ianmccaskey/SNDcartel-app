import { NextResponse } from 'next/server'
import { sql, and, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { orders } from '@/db/schema'
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
        ? and(sql`created_at >= now() - interval '30 days'`, inArray(orders.groupBuyId, ownable))
        : sql`created_at >= now() - interval '30 days'`

    // Orders per day for the last 30 days
    const rows = await db
      .select({
        date: sql<string>`date_trunc('day', created_at)::date::text`,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(total_usd::numeric), 0)::float`,
      })
      .from(orders)
      .where(whereClause)
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`)

    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('[analytics/orders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
