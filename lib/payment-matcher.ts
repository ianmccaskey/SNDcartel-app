import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders } from '@/db/schema'
import { usdcRawToUsd } from './alchemy'

export interface AlchemyTransfer {
  transactionHash: string
  blockNumber: number
  fromAddress: string
  toAddress: string
  tokenAddress: string
  valueRaw: string
  network: string
}

export interface PaymentMatch {
  orderId: string
  confidence: number // 0–100
  reasons: string[]
}

/**
 * Find pending orders that match an inbound USDC transfer.
 * Confidence scoring:
 *   +40  exact wallet match (transfer.from === order.customerWalletAddress)
 *   +40  amount within 5% tolerance
 *   +20  order placed within last 24 hours
 * Auto-approve threshold: confidence >= 80
 */
export async function matchPaymentToOrders(transfer: AlchemyTransfer): Promise<PaymentMatch[]> {
  const receivedUsd = usdcRawToUsd(transfer.valueRaw)

  // Find all pending_payment orders that have a customer wallet address
  const pendingOrders = await db
    .select({
      id: orders.id,
      customerWalletAddress: orders.customerWalletAddress,
      totalUsd: orders.totalUsd,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.orderStatus, 'pending_payment'))

  const matches: PaymentMatch[] = []

  for (const order of pendingOrders) {
    if (!order.customerWalletAddress) continue

    let confidence = 0
    const reasons: string[] = []

    // Wallet match
    if (transfer.fromAddress.toLowerCase() === order.customerWalletAddress.toLowerCase()) {
      confidence += 40
      reasons.push('wallet_exact_match')
    } else {
      // If wallet doesn't match at all, skip — we require at least wallet match
      continue
    }

    // Amount match within 5% tolerance
    const expectedUsd = parseFloat(order.totalUsd)
    const tolerance = 0.05
    if (Math.abs(expectedUsd - receivedUsd) <= expectedUsd * tolerance) {
      confidence += 40
      reasons.push('amount_within_tolerance')
    } else {
      reasons.push(`amount_mismatch: expected $${expectedUsd.toFixed(2)}, received $${receivedUsd.toFixed(2)}`)
    }

    // Recent order (within 24 hours)
    const hoursSinceOrder = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceOrder <= 24) {
      confidence += 20
      reasons.push('recent_order')
    } else {
      reasons.push(`older_order: ${Math.floor(hoursSinceOrder)}h ago`)
    }

    matches.push({ orderId: order.id, confidence, reasons })
  }

  return matches.sort((a, b) => b.confidence - a.confidence)
}

export const AUTO_APPROVE_THRESHOLD = 80
