import { NextResponse } from 'next/server'
import { sql, isNull, eq, and, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { users, orders, payments, groupBuys } from '@/db/schema'
import { listManageableGroupBuyIds, requireAdminOrOperator } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await requireAdminOrOperator()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ownable = await listManageableGroupBuyIds(session)
    if (ownable !== null && ownable.length === 0) {
      // Operator with no assignments — every aggregate is zero.
      return NextResponse.json({
        totalUsers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        activeGroupBuys: 0,
        pendingPayments: 0,
      })
    }

    const ordersGbCondition = ownable !== null ? inArray(orders.groupBuyId, ownable) : undefined
    const groupBuysGbCondition = ownable !== null ? inArray(groupBuys.id, ownable) : undefined

    const [
      [{ totalUsers }],
      [{ totalOrders }],
      [{ totalRevenue }],
      [{ activeGroupBuys }],
      [{ pendingPayments }],
    ] = await Promise.all([
      // Operators see only the distinct users who have placed orders in
      // their assigned group buys; admins see all non-deleted users.
      ownable !== null
        ? db
            .select({
              totalUsers: sql<number>`count(distinct ${orders.userId})::int`,
            })
            .from(orders)
            .where(ordersGbCondition)
        : db
            .select({ totalUsers: sql<number>`count(*)::int` })
            .from(users)
            .where(isNull(users.deletedAt)),

      db.select({ totalOrders: sql<number>`count(*)::int` })
        .from(orders)
        .where(ordersGbCondition),

      db
        .select({
          totalRevenue: sql<number>`coalesce(sum(total_usd::numeric), 0)::float`,
        })
        .from(orders)
        .where(ordersGbCondition),

      db
        .select({ activeGroupBuys: sql<number>`count(*)::int` })
        .from(groupBuys)
        .where(
          ownable !== null
            ? and(sql`status = 'active' and deleted_at is null`, groupBuysGbCondition)
            : sql`status = 'active' and deleted_at is null`,
        ),

      // Pending payments: join through orders so we can scope by group buy.
      ownable !== null
        ? db
            .select({ pendingPayments: sql<number>`count(*)::int` })
            .from(payments)
            .leftJoin(orders, eq(payments.orderId, orders.id))
            .where(and(sql`${payments.status} = 'pending'`, inArray(orders.groupBuyId, ownable)))
        : db
            .select({ pendingPayments: sql<number>`count(*)::int` })
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
