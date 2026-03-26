import { NextResponse } from 'next/server'
import { eq, desc, and, sql } from 'drizzle-orm'
import { db } from '@/db'
import { payments, orders, users, groupBuys } from '@/db/schema'
import { auth } from '@/lib/auth'

function requireAdmin(session: Awaited<ReturnType<typeof auth>>) {
  return !!(session?.user?.id && session.user.role === 'admin')
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!requireAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? 'pending'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const offset = (page - 1) * limit

    const whereClause = status === 'all' ? undefined : eq(payments.status, status)

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(whereClause)

    const rows = await db
      .select({
        id: payments.id,
        orderId: payments.orderId,
        userId: payments.userId,
        txHash: payments.txHash,
        blockchainNetwork: payments.blockchainNetwork,
        fromWalletAddress: payments.fromWalletAddress,
        amountSubmittedUsd: payments.amountSubmittedUsd,
        amountExpectedUsd: payments.amountExpectedUsd,
        tokenSymbol: payments.tokenSymbol,
        explorerUrl: payments.explorerUrl,
        withinTolerance: payments.withinTolerance,
        status: payments.status,
        rejectionReason: payments.rejectionReason,
        adminNotes: payments.adminNotes,
        reviewedAt: payments.reviewedAt,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
        orderStatus: orders.orderStatus,
        orderTotalUsd: orders.totalUsd,
        groupBuyId: orders.groupBuyId,
        customerWalletAddress: orders.customerWalletAddress,
        userEmail: users.email,
        userFullName: users.fullName,
        groupBuyName: groupBuys.name,
      })
      .from(payments)
      .leftJoin(orders, eq(payments.orderId, orders.id))
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(groupBuys, eq(orders.groupBuyId, groupBuys.id))
      .where(whereClause)
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset)

    const result = rows.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      userId: p.userId,
      userEmail: p.userEmail,
      userFullName: p.userFullName,
      groupBuyId: p.groupBuyId,
      groupBuyName: p.groupBuyName,
      txHash: p.txHash,
      blockchainNetwork: p.blockchainNetwork,
      fromWalletAddress: p.fromWalletAddress,
      customerWalletAddress: p.customerWalletAddress,
      amountSubmittedUsd: p.amountSubmittedUsd ? parseFloat(p.amountSubmittedUsd) : null,
      amountExpectedUsd: parseFloat(p.amountExpectedUsd),
      tokenSymbol: p.tokenSymbol,
      explorerUrl: p.explorerUrl,
      withinTolerance: p.withinTolerance,
      status: p.status,
      rejectionReason: p.rejectionReason,
      adminNotes: p.adminNotes,
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      orderStatus: p.orderStatus,
      orderTotalUsd: p.orderTotalUsd ? parseFloat(p.orderTotalUsd) : null,
    }))

    return NextResponse.json({
      payments: result,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    })
  } catch (error) {
    console.error('GET /api/admin/payments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
