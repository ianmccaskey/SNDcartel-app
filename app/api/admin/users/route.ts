import { NextResponse } from 'next/server'
import { desc, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { users, orders, wallets } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const offset = (page - 1) * limit

    const whereClause = search
      ? or(ilike(users.email, `%${search}%`), ilike(users.fullName, `%${search}%`))
      : undefined

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(whereClause)

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        discordName: users.discordName,
        accountStatus: users.accountStatus,
        profileComplete: users.profileComplete,
        role: users.role,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        notes: users.notes,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset)

    // Get order counts per user
    const userIds = rows.map((u) => u.id)
    const orderCounts: Record<string, number> = {}
    if (userIds.length > 0) {
      const counts = await db
        .select({
          userId: orders.userId,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .groupBy(orders.userId)
      for (const { userId, count } of counts) {
        orderCounts[userId] = count
      }
    }

    const result = rows.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      discordName: u.discordName,
      accountStatus: u.accountStatus,
      profileComplete: u.profileComplete,
      role: u.role,
      orderCount: orderCounts[u.id] ?? 0,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      notes: u.notes,
    }))

    return NextResponse.json({
      users: result,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    })
  } catch (error) {
    console.error('GET /api/admin/users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
