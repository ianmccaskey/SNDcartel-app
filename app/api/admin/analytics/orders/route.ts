import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Orders per day for the last 30 days
    const rows = await db
      .select({
        date: sql<string>`date_trunc('day', created_at)::date::text`,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(total_usd::numeric), 0)::float`,
      })
      .from(orders)
      .where(sql`created_at >= now() - interval '30 days'`)
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`)

    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('[analytics/orders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
