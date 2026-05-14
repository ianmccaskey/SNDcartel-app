import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders, payments } from '@/db/schema'
import { auth } from '@/lib/auth'
import { buildExplorerUrl } from '@/lib/alchemy'
import { transitionOrderStatus } from '@/lib/order-status'
import { z } from 'zod'

// Customer-side payment submission. Used both for the initial submission
// (after the customer sends crypto to the campaign's destination wallet) and
// for the resubmit path after an admin rejects a prior payment.
//
// Creates a new payments row with status='pending', advances order_status to
// payment_submitted, and writes an orderStatusHistory record. Admin then
// approves or rejects through the existing flows.

const submitSchema = z.object({
  transactionHash: z.string().min(1).max(200),
  blockchainNetwork: z.string().min(1).max(50),
  tokenSymbol: z.string().min(1).max(20).default('USDC'),
  fromWalletAddress: z.string().optional(),
  amountSubmittedUsd: z.number().positive().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await params
    const userId = session.user.id

    const body = await request.json()
    const parsed = submitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { transactionHash, blockchainNetwork, tokenSymbol, fromWalletAddress, amountSubmittedUsd } =
      parsed.data

    const [order] = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        orderStatus: orders.orderStatus,
        totalUsd: orders.totalUsd,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Allowed source states: customer can submit (or resubmit) a TX hash any
    // time the order is awaiting payment or after a rejection. Once verified
    // or further along, this endpoint must refuse — admins handle changes via
    // the admin endpoints.
    const ALLOWED_FROM = ['pending_payment', 'payment_submitted', 'payment_rejected']
    if (!ALLOWED_FROM.includes(order.orderStatus)) {
      return NextResponse.json(
        { error: `Cannot submit payment from order state '${order.orderStatus}'` },
        { status: 409 },
      )
    }

    // Insert the new payments row. The unique index on (tx_hash,
    // blockchain_network) protects against the same TX being recorded twice.
    let paymentId: string
    try {
      const [inserted] = await db
        .insert(payments)
        .values({
          orderId,
          userId,
          txHash: transactionHash.trim(),
          blockchainNetwork,
          fromWalletAddress: fromWalletAddress?.trim() || null,
          amountSubmittedUsd: amountSubmittedUsd?.toFixed(2) ?? null,
          amountExpectedUsd: order.totalUsd,
          tokenSymbol,
          explorerUrl: buildExplorerUrl(blockchainNetwork, transactionHash.trim()),
          status: 'pending',
        })
        .returning({ id: payments.id })
      paymentId = inserted.id
    } catch (err) {
      // Most likely a unique-constraint violation on (tx_hash, network).
      console.error('submit-payment insert failed:', err)
      return NextResponse.json(
        { error: 'This transaction has already been submitted.' },
        { status: 409 },
      )
    }

    // Advance order to payment_submitted (or leave it there for resubmits)
    // and log to orderStatusHistory. No fromStatus guard: any of the three
    // allowed-from states can move to payment_submitted, and the customer
    // already passed the check above.
    await transitionOrderStatus({
      orderId,
      toStatus: 'payment_submitted',
      changedBy: userId,
      reason:
        order.orderStatus === 'payment_rejected'
          ? 'Customer resubmitted payment after rejection'
          : 'Customer submitted payment',
      extraUpdates: { paymentStatus: 'pending' },
    })

    return NextResponse.json(
      {
        paymentId,
        orderId,
        status: 'pending',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('POST /api/orders/[orderId]/submit-payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
