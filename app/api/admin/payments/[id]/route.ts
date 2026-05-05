import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { payments, orders, users, groupBuys, alchemyWebhookEvents } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const [payment] = await db
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
      .where(eq(payments.id, id))
      .limit(1)

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Fetch matching Alchemy webhook event if any
    const [alchemyMatch] = await db
      .select({
        matchConfidence: alchemyWebhookEvents.matchConfidence,
        matchReasons: alchemyWebhookEvents.matchReasons,
        valueUsd: alchemyWebhookEvents.valueUsd,
        fromAddress: alchemyWebhookEvents.fromAddress,
        network: alchemyWebhookEvents.network,
      })
      .from(alchemyWebhookEvents)
      .where(eq(alchemyWebhookEvents.transactionHash, payment.txHash))
      .limit(1)

    return NextResponse.json({
      id: payment.id,
      orderId: payment.orderId,
      userId: payment.userId,
      userEmail: payment.userEmail,
      userFullName: payment.userFullName,
      groupBuyId: payment.groupBuyId,
      groupBuyName: payment.groupBuyName,
      txHash: payment.txHash,
      blockchainNetwork: payment.blockchainNetwork,
      fromWalletAddress: payment.fromWalletAddress,
      customerWalletAddress: payment.customerWalletAddress,
      amountSubmittedUsd: payment.amountSubmittedUsd ? parseFloat(payment.amountSubmittedUsd) : null,
      amountExpectedUsd: parseFloat(payment.amountExpectedUsd),
      tokenSymbol: payment.tokenSymbol,
      explorerUrl: payment.explorerUrl,
      withinTolerance: payment.withinTolerance,
      status: payment.status,
      rejectionReason: payment.rejectionReason,
      adminNotes: payment.adminNotes,
      reviewedAt: payment.reviewedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      orderStatus: payment.orderStatus,
      orderTotalUsd: payment.orderTotalUsd ? parseFloat(payment.orderTotalUsd) : null,
      alchemyMatch: alchemyMatch
        ? {
            matchConfidence: alchemyMatch.matchConfidence,
            matchReasons: alchemyMatch.matchReasons,
            valueUsd: alchemyMatch.valueUsd ? parseFloat(alchemyMatch.valueUsd) : null,
            fromAddress: alchemyMatch.fromAddress,
            network: alchemyMatch.network,
          }
        : null,
    })
  } catch (error) {
    console.error('GET /api/admin/payments/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
