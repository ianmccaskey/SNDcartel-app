import { NextResponse } from 'next/server'
import { fetchRecentEvmTransfers } from '@/lib/chain-providers/evm'
import { fetchRecentSolanaTransfers } from '@/lib/chain-providers/solana'
import {
  listActiveSweepTargets,
  processNormalizedTransfer,
} from '@/lib/chain-providers/process-transfer'

// Backup payment-detection job. Runs periodically (driven by GitHub Actions
// cron or DO Scheduled Job — see workflow in .github/workflows/sweep-payments.yml)
// to catch payments missed by the real-time Alchemy webhook OR to detect
// chains we don't have webhooks for (Solana).
//
// Auth: Bearer token equal to CRON_SECRET. Set the same value in both DO env
// vars and the GitHub Actions secret driving the workflow.
//
// Idempotency: every transfer is checked against alchemy_webhook_events by
// transaction_hash before processing — duplicates are no-ops.

const SWEEP_WINDOW_MS = 1000 * 60 * 60 * 6 // 6 hours of lookback per run

// Networks the sweep can actually fetch transfers for.
const SUPPORTED_NETWORKS: ReadonlySet<string> = new Set([
  'ethereum',
  'polygon',
  'base',
  'solana',
])

export async function POST(request: Request) {
  return handle(request)
}

// Also accept GET so the same endpoint can be triggered from a browser /
// curl during manual testing without needing to specify a method.
export async function GET(request: Request) {
  return handle(request)
}

async function handle(request: Request): Promise<Response> {
  // 1. Auth
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('sweep-payments: CRON_SECRET not set; rejecting all requests')
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }
  const auth = request.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. Determine sweep targets: which (network, wallet[]) pairs to scan.
    const targets = await listActiveSweepTargets()
    if (targets.size === 0) {
      return NextResponse.json({ ok: true, summary: 'no active campaigns to sweep' })
    }

    const sinceMs = Date.now() - SWEEP_WINDOW_MS
    const runId = new Date().toISOString()

    // 3. Fetch transfers per network. Parallel — different RPC endpoints.
    const fetchPromises: Array<Promise<{ network: string; transfers: unknown[] }>> = []

    for (const [network, wallets] of targets) {
      if (!SUPPORTED_NETWORKS.has(network)) {
        // Bitcoin etc. — defer to v2 BlockCypher integration.
        continue
      }

      if (network === 'solana') {
        fetchPromises.push(
          fetchRecentSolanaTransfers(wallets, sinceMs).then((transfers) => ({
            network,
            transfers,
          })),
        )
      } else {
        fetchPromises.push(
          fetchRecentEvmTransfers(
            network as 'ethereum' | 'polygon' | 'base',
            wallets,
            sinceMs,
          ).then((transfers) => ({ network, transfers })),
        )
      }
    }

    const fetched = await Promise.all(fetchPromises)

    // 4. Run every fetched transfer through the shared processor. Sequential
    //    so the idempotency check (which races on the unique tx_hash index)
    //    can't double-insert. Most sweeps process zero or one transfers per run.
    const summary = {
      networks: [] as Array<{
        network: string
        fetched: number
        duplicates: number
        matched: number
        autoApproved: number
        wrongChain: number
      }>,
      runId,
    }

    for (const { network, transfers } of fetched) {
      const stats = {
        network,
        fetched: transfers.length,
        duplicates: 0,
        matched: 0,
        autoApproved: 0,
        wrongChain: 0,
      }

      for (const t of transfers) {
        const result = await processNormalizedTransfer(
          t as Parameters<typeof processNormalizedTransfer>[0],
          'sweep',
          runId,
        )
        if (result.duplicate) stats.duplicates += 1
        if (result.matchedOrderId) stats.matched += 1
        if (result.autoApproved) stats.autoApproved += 1
        if (result.wrongChain) stats.wrongChain += 1
      }

      summary.networks.push(stats)
    }

    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    console.error('POST /api/cron/sweep-payments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
