import { NextResponse } from 'next/server'
import { eq, desc, and, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { payments, orders, users, groupBuys } from '@/db/schema'
import { listManageableGroupBuyIds, requireAdminOrOperator } from '@/lib/permissions'

export async function GET(request: Request) {
  try {
    const session = await requireAdminOrOperator()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ownable = await listManageableGroupBuyIds(session)
    if (ownable !== null && ownable.length === 0) {
      return NextResponse.json({
        payments: [],
        pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
      })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? 'pending'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const offset = (page - 1) * limit

    // For operators: restrict to payments whose order belongs to an
    // assigned group buy. Compute the eligible orderIds up front.
    let operatorOrderIds: string[] | null = null
    if (ownable !== null) {
      const opOrders = await db
        .select({ id: orders.id })
        .from(orders)
        .where(inArray(orders.groupBuyId, ownable))
      operatorOrderIds = opOrders.map((o) => o.id)
      if (operatorOrderIds.length === 0) {
        return NextResponse.json({
          payments: [],
          pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
        })
      }
    }

    const conditions = []
    if (status !== 'all') conditions.push(eq(payments.status, status))
    if (operatorOrderIds !== null) conditions.push(inArray(payments.orderId, operatorOrderIds))
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

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
