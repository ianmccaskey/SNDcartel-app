import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders, alchemyWebhookEvents } from '@/db/schema'
import { verifyAlchemySignature, USDC_CONTRACTS, usdcRawToUsd } from '@/lib/alchemy'
import { matchPaymentToOrders, AUTO_APPROVE_THRESHOLD, type AlchemyTransfer } from '@/lib/payment-matcher'

// App Router automatically gives us the raw body via request.text(),
// which is what we need for HMAC verification — no extra config required.

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-alchemy-signature') ?? ''

    // Verify webhook authenticity
    if (!verifyAlchemySignature(rawBody, signature)) {
      console.warn('Alchemy webhook: invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)

    // Alchemy Address Activity webhook shape
    const activity = payload?.event?.activity
    if (!Array.isArray(activity)) {
      return NextResponse.json({ ok: true, skipped: 'no activity' })
    }

    const webhookId: string = payload?.webhookId ?? 'unknown'
    const network: string = (payload?.event?.network ?? 'ETH_MAINNET').toLowerCase().replace('_mainnet', '')

    const results: Array<{ txHash: string; matched: boolean; orderId?: string; confidence?: number }> = []

    for (const event of activity) {
      // Only process ERC-20 token transfers (USDC)
      if (event.category !== 'token') continue

      const txHash: string = event.hash
      const fromAddress: string = (event.fromAddress ?? '').toLowerCase()
      const toAddress: string = (event.toAddress ?? '').toLowerCase()
      const rawContract = event.rawContract

      if (!rawContract) continue

      const tokenAddress: string = (rawContract.address ?? '').toLowerCase()

      // Check if this is a USDC transfer
      const usdcAddress = USDC_CONTRACTS[network]?.toLowerCase()
      if (!usdcAddress || tokenAddress !== usdcAddress) continue

      const valueRaw: string = rawContract.rawValue ?? '0x0'
      const valueUsd = usdcRawToUsd(valueRaw)
      const blockNumber: number = parseInt(event.blockNum ?? '0x0', 16)

      // Avoid duplicate processing
      const existing = await db
        .select({ id: alchemyWebhookEvents.id })
        .from(alchemyWebhookEvents)
        .where(eq(alchemyWebhookEvents.transactionHash, txHash))
        .limit(1)

      if (existing.length > 0) {
        results.push({ txHash, matched: false })
        continue
      }

      const transfer: AlchemyTransfer = {
        transactionHash: txHash,
        blockNumber,
        fromAddress,
        toAddress,
        tokenAddress,
        valueRaw,
        network,
      }

      // Run payment matching
      const matches = await matchPaymentToOrders(transfer)
      const topMatch = matches[0]

      // Insert webhook event audit record
      const [webhookEvent] = await db
        .insert(alchemyWebhookEvents)
        .values({
          webhookId,
          eventType: 'ADDRESS_ACTIVITY',
          transactionHash: txHash,
          blockNumber,
          fromAddress,
          toAddress,
          tokenAddress,
          valueRaw,
          valueUsd: valueUsd.toFixed(2),
          network,
          processed: false,
          matchedOrderId: topMatch ? topMatch.orderId : null,
          matchConfidence: topMatch ? topMatch.confidence : null,
          matchReasons: topMatch ? topMatch.reasons : null,
        })
        .returning()

      if (!topMatch || topMatch.confidence < AUTO_APPROVE_THRESHOLD) {
        // Low confidence or no match — leave for admin review
        await db
          .update(alchemyWebhookEvents)
          .set({ processed: true })
          .where(eq(alchemyWebhookEvents.id, webhookEvent.id))

        results.push({ txHash, matched: false })
        continue
      }

      // Auto-approve: update order status
      await db
        .update(orders)
        .set({
          orderStatus: 'payment_verified',
          paymentStatus: 'verified',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, topMatch.orderId))

      await db
        .update(alchemyWebhookEvents)
        .set({ processed: true })
        .where(eq(alchemyWebhookEvents.id, webhookEvent.id))

      results.push({ txHash, matched: true, orderId: topMatch.orderId, confidence: topMatch.confidence })
    }

    return NextResponse.json({ ok: true, processed: results.length, results })
  } catch (error) {
    console.error('POST /api/webhooks/alchemy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
