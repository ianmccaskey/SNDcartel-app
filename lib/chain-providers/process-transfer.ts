import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  alchemyWebhookEvents,
  acceptedPayments,
  groupBuys,
  orders,
} from '@/db/schema'
import { matchPaymentToOrders, AUTO_APPROVE_THRESHOLD, type AlchemyTransfer } from '@/lib/payment-matcher'
import { transitionOrderStatus } from '@/lib/order-status'
import { notifyPaymentVerified } from '@/lib/order-emails'
import { buildExplorerUrl } from '@/lib/alchemy'
import type { NormalizedTransfer } from './types'

export type ProcessSource = 'webhook' | 'sweep'

export interface ProcessResult {
  transactionHash: string
  network: string
  /** True iff the audit row already existed and we short-circuited. */
  duplicate: boolean
  /** Order ID this transfer was matched to, or null if no match found. */
  matchedOrderId: string | null
  /** Match confidence (0-100), or null if no match was attempted. */
  matchConfidence: number | null
  /** True iff confidence >= AUTO_APPROVE_THRESHOLD and order was flipped. */
  autoApproved: boolean
  /** True iff a matching order was found but the transfer is on a chain
   *  the order's campaign does not accept (e.g. paid on Base, campaign expects
   *  Ethereum). Manual admin review required. */
  wrongChain: boolean
}

/**
 * End-to-end processor for a normalized USDC transfer. Used by both
 * /api/webhooks/alchemy and /api/cron/sweep-payments so the matching logic,
 * idempotency check, and order/email side effects stay consistent.
 *
 * Idempotency: the unique key is (transaction_hash, network). If an audit row
 * already exists for that pair, we return without doing anything else.
 */
export async function processNormalizedTransfer(
  t: NormalizedTransfer,
  source: ProcessSource,
  sourceId: string,
): Promise<ProcessResult> {
  // 1. Idempotency — has this tx hash already been processed?
  const existing = await db
    .select({ id: alchemyWebhookEvents.id })
    .from(alchemyWebhookEvents)
    .where(eq(alchemyWebhookEvents.transactionHash, t.transactionHash))
    .limit(1)
  if (existing.length > 0) {
    return {
      transactionHash: t.transactionHash,
      network: t.network,
      duplicate: true,
      matchedOrderId: null,
      matchConfidence: null,
      autoApproved: false,
      wrongChain: false,
    }
  }

  // 2. Run the matcher.
  const matches = await matchPaymentToOrders({
    transactionHash: t.transactionHash,
    blockNumber: t.blockNumber,
    fromAddress: t.fromAddress,
    toAddress: t.toAddress,
    tokenAddress: t.tokenAddress,
    valueRaw: usdToValueRaw(t.amountUsd),
    network: t.network,
  } satisfies AlchemyTransfer)

  const topMatch = matches[0]

  // 3. Wrong-chain detection. If we matched an order, check that the order's
  //    campaign accepts this network. If not, don't auto-approve — flag for admin.
  let wrongChain = false
  if (topMatch) {
    const acceptedNetworks = await fetchAcceptedNetworksForOrder(topMatch.orderId)
    if (acceptedNetworks !== null && !acceptedNetworks.includes(t.network)) {
      wrongChain = true
    }
  }

  // 4. Insert audit row.
  const [audit] = await db
    .insert(alchemyWebhookEvents)
    .values({
      webhookId: source === 'sweep' ? `sweep_${t.network}_${sourceId}` : sourceId,
      eventType: source === 'sweep' ? `SWEEP_${t.network.toUpperCase()}` : 'ADDRESS_ACTIVITY',
      transactionHash: t.transactionHash,
      blockNumber: t.blockNumber,
      fromAddress: t.fromAddress,
      toAddress: t.toAddress,
      tokenAddress: t.tokenAddress,
      valueRaw: usdToValueRaw(t.amountUsd),
      valueUsd: t.amountUsd.toFixed(2),
      network: t.network,
      processed: false,
      matchedOrderId: topMatch ? topMatch.orderId : null,
      matchConfidence: topMatch ? topMatch.confidence : null,
      matchReasons: topMatch
        ? wrongChain
          ? [...topMatch.reasons, 'wrong_chain_for_order_campaign']
          : topMatch.reasons
        : null,
      errorMessage: wrongChain
        ? `wrong_chain: order ${topMatch?.orderId} expects different network`
        : null,
    })
    .returning({ id: alchemyWebhookEvents.id })

  // 5. Decide whether to auto-approve.
  const shouldAutoApprove =
    !!topMatch && !wrongChain && topMatch.confidence >= AUTO_APPROVE_THRESHOLD

  if (shouldAutoApprove) {
    await transitionOrderStatus({
      orderId: topMatch.orderId,
      toStatus: 'payment_verified',
      changedBy: null,
      reason: `${source === 'webhook' ? 'Alchemy auto-match' : 'Sweep auto-match'} confidence ${topMatch.confidence}`,
      extraUpdates: { paymentStatus: 'verified' },
    })

    // Customer notification — fire-and-forget.
    void notifyPaymentVerified(topMatch.orderId, 'auto')
  }

  // 6. Mark audit row processed regardless of outcome.
  await db
    .update(alchemyWebhookEvents)
    .set({ processed: true })
    .where(eq(alchemyWebhookEvents.id, audit.id))

  return {
    transactionHash: t.transactionHash,
    network: t.network,
    duplicate: false,
    matchedOrderId: topMatch?.orderId ?? null,
    matchConfidence: topMatch?.confidence ?? null,
    autoApproved: shouldAutoApprove,
    wrongChain,
  }
}

/**
 * For an order, return the list of networks (lowercase) its campaign accepts.
 * Returns `null` if the order is a store order (no campaign — no chain
 * constraint). Returns `[]` if the campaign has no accepted_payments rows,
 * which is treated the same as "no constraint" for backwards compat.
 */
async function fetchAcceptedNetworksForOrder(orderId: string): Promise<string[] | null> {
  const [order] = await db
    .select({ groupBuyId: orders.groupBuyId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
  if (!order || order.groupBuyId === null) return null

  const rows = await db
    .select({ network: acceptedPayments.network })
    .from(acceptedPayments)
    .where(eq(acceptedPayments.groupBuyId, order.groupBuyId))

  if (rows.length === 0) return null

  return rows.map((r) => r.network.toLowerCase())
}

/**
 * Round-trip the USD amount back into a hex string the matcher (built around
 * the legacy Alchemy hex valueRaw) expects. USDC has 6 decimals; we multiply
 * by 1e6 and emit hex. Loses sub-cent precision, which is fine for matching.
 */
function usdToValueRaw(usd: number): string {
  const raw = Math.round(usd * 1_000_000)
  return '0x' + raw.toString(16)
}

/**
 * Convenience: which group_buy_id + network combinations should the sweep
 * cover? Returns one row per accepted_payment on currently active group buys,
 * grouped by network. Used by /api/cron/sweep-payments.
 */
export async function listActiveSweepTargets(): Promise<
  Map<string, string[]>
> {
  const rows = await db
    .select({
      network: acceptedPayments.network,
      walletAddress: acceptedPayments.walletAddress,
    })
    .from(acceptedPayments)
    .innerJoin(groupBuys, eq(acceptedPayments.groupBuyId, groupBuys.id))
    .where(and(eq(groupBuys.status, 'active'), inArray(groupBuys.status, ['active'])))

  // Group by network, dedupe wallets within a network.
  const byNetwork = new Map<string, Set<string>>()
  for (const r of rows) {
    const network = r.network.toLowerCase()
    if (!byNetwork.has(network)) byNetwork.set(network, new Set())
    byNetwork.get(network)!.add(r.walletAddress)
  }

  const out = new Map<string, string[]>()
  for (const [network, wallets] of byNetwork) {
    out.set(network, Array.from(wallets))
  }
  return out
}

// Re-export so callers don't have to import from two places.
export { buildExplorerUrl }
