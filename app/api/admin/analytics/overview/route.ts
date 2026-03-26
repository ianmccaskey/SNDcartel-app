import { NextResponse } from 'next/server'
import { sql, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { users, orders, payments, groupBuys } from '@/db/schema'
import { auth } from '@/lib/auth'

function requireAdmin(session: Awaited<ReturnType<typeof auth>>) {
  return !!(session?.user?.id && session.user.role === 'admin')
}

export async function GET() {
  try {
    const session = await auth()
    if (!requireAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [
      [{ totalUsers }],
      [{ totalOrders }],
      [{ totalRevenue }],
      [{ activeGroupBuys }],
      [{ pendingPayments }],
    ] = await Promise.all([
      db.select({ totalUsers: sql<number>`count(*)::int` })
        .from(users)
        .where(isNull(users.deletedAt)),

      db.select({ totalOrders: sql<number>`count(*)::int` })
        .from(orders),

      db.select({
        totalRevenue: sql<number>`coalesce(sum(total_usd::numeric), 0)::float`,
      }).from(orders),

      db.select({ activeGroupBuys: sql<number>`count(*)::int` })
        .from(groupBuys)
        .where(sql`status = 'active' and deleted_at is null`),

      db.select({ pendingPayments: sql<number>`count(*)::int` })
        .from(payments)
        .where(sql`status = 'pending'`),
    ])

    return NextResponse.json({
      totalUsers,
      totalOrders,
      totalRevenue,
      activeGroupBuys,
      pendingPayments,
    })
  } catch (err) {
    console.error('[analytics/overview]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
