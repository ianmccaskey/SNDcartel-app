import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders, payments, adminActions } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { buildExplorerUrl } from '@/lib/alchemy'
import { z } from 'zod'

const verifySchema = z.object({
  transactionHash: z.string().min(1),
  blockchainNetwork: z.string().min(1),
  tokenSymbol: z.string().min(1).default('USDC'),
  amountSubmittedUsd: z.number().positive().optional(),
  fromWalletAddress: z.string().optional(),
  override: z.boolean().optional().default(false),
  adminNotes: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { orderId } = await params
    const body = await request.json()

    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const {
      transactionHash,
      blockchainNetwork,
      tokenSymbol,
      amountSubmittedUsd,
      fromWalletAddress,
      adminNotes,
    } = parsed.data

    // Verify order exists
    const [order] = await db
      .select({ id: orders.id, totalUsd: orders.totalUsd, orderStatus: orders.orderStatus })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.orderStatus === 'payment_verified' || order.orderStatus === 'completed') {
      return NextResponse.json({ error: 'Order payment already verified' }, { status: 409 })
    }

    const explorerUrl = buildExplorerUrl(blockchainNetwork, transactionHash)

    // Fetch order userId
    const [fullOrder] = await db
      .select({ userId: orders.userId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    // Insert payment record
    await db
      .insert(payments)
      .values({
        orderId,
        userId: fullOrder.userId,
        txHash: transactionHash,
        blockchainNetwork,
        fromWalletAddress: fromWalletAddress ?? null,
        amountSubmittedUsd: amountSubmittedUsd?.toFixed(2) ?? null,
        amountExpectedUsd: order.totalUsd,
        tokenSymbol,
        explorerUrl,
        withinTolerance: true,
        status: 'approved',
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        adminNotes: adminNotes ?? null,
      })

    const [payment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(payments.createdAt)
      .limit(1)

    // Update order status to payment_verified
    await db
      .update(orders)
      .set({
        orderStatus: 'payment_verified',
        paymentStatus: 'verified',
        adminNotes: adminNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))

    // Audit log
    await db.insert(adminActions).values({
      adminUserId: session.user.id,
      actionType: 'payment_manually_verified',
      targetType: 'order',
      targetId: orderId,
      payload: {
        transactionHash,
        blockchainNetwork,
        tokenSymbol,
        amountSubmittedUsd,
      },
    })

    return NextResponse.json({ ok: true, paymentId: payment.id, orderId })
  } catch (error) {
    console.error('POST /api/admin/orders/[orderId]/verify-payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
