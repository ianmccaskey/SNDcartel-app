import { NextResponse } from 'next/server'
import { verifyAlchemySignature, USDC_CONTRACTS, usdcRawToUsd } from '@/lib/alchemy'
import { processNormalizedTransfer } from '@/lib/chain-providers/process-transfer'
import type { NormalizedTransfer } from '@/lib/chain-providers/types'

// App Router automatically gives us the raw body via request.text(),
// which is what we need for HMAC verification — no extra config required.
//
// This receiver only handles EVM Address Activity webhooks (Ethereum, Polygon,
// Base) today. Solana Address Activity webhooks DO exist (Alchemy added them
// in beta), but the v1.5 follow-up has to land first — the Solana payload
// shape (network = "SOLANA_MAINNET") omits preTokenBalances, so adding the
// path means decoding SPL instructions or making a getTransaction enrichment
// call per event. Until then, Solana payments are picked up by the periodic
// sweep job in /api/cron/sweep-payments, which uses getTransaction directly.

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

    const results: Array<{
      transactionHash: string
      matched: boolean
      orderId?: string | null
      confidence?: number | null
      wrongChain?: boolean
      duplicate?: boolean
    }> = []

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

      const normalized: NormalizedTransfer = {
        network: network as NormalizedTransfer['network'],
        transactionHash: txHash,
        blockNumber,
        fromAddress,
        toAddress,
        tokenAddress,
        amountUsd: valueUsd,
      }

      const result = await processNormalizedTransfer(normalized, 'webhook', webhookId)

      results.push({
        transactionHash: result.transactionHash,
        matched: result.matchedOrderId !== null && !result.wrongChain,
        orderId: result.matchedOrderId,
        confidence: result.matchConfidence,
        wrongChain: result.wrongChain,
        duplicate: result.duplicate,
      })
    }

    return NextResponse.json({ ok: true, processed: results.length, results })
  } catch (error) {
    console.error('POST /api/webhooks/alchemy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
