import { USDC_CONTRACT, USDC_DECIMALS, type NormalizedTransfer } from './types'

/**
 * Solana payment scanner. v1 polls public RPC every sweep window — Helius
 * webhooks land in v2 if customers complain about ~30 min latency.
 *
 * Default RPC: api.mainnet-beta.solana.com (no key required). For higher
 * reliability set SOLANA_RPC_URL to a Helius / Triton / QuickNode endpoint.
 *
 * Detection approach for each watched wallet:
 *   1. getSignaturesForAddress(wallet, { until?: lastSeenSignature, limit: 100 })
 *      → recent signatures touching the wallet (any tx involving the address)
 *   2. For each signature, getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 })
 *      → full transaction with parsed instructions
 *   3. Look at meta.preTokenBalances + meta.postTokenBalances for USDC mint
 *      changes that credit the watched wallet. SPL token transfers are tracked
 *      via the SPL Token program, not native lamport movement.
 *   4. Emit a NormalizedTransfer per matching credit.
 *
 * This is intentionally polling-based and dumb. We don't subscribe to logs
 * or rely on websockets — those are nice but require persistent connections
 * we don't want to manage from a serverless app.
 */

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
const USDC_MINT = USDC_CONTRACT.solana

interface RpcResponse<T> {
  jsonrpc: '2.0'
  id: number | string
  result?: T
  error?: { code: number; message: string }
}

interface SignatureInfo {
  signature: string
  slot: number
  blockTime: number | null
  err: unknown
}

interface TokenBalance {
  accountIndex: number
  mint: string
  owner?: string
  uiTokenAmount: {
    amount: string // raw integer string
    decimals: number
    uiAmount: number | null
    uiAmountString: string
  }
}

interface ParsedTransaction {
  slot: number
  blockTime: number | null
  meta: {
    err: unknown
    preTokenBalances?: TokenBalance[]
    postTokenBalances?: TokenBalance[]
  } | null
  transaction: {
    message: {
      accountKeys: Array<{ pubkey: string; signer: boolean; writable: boolean }>
    }
    signatures: string[]
  }
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) {
    throw new Error(`Solana RPC ${method} HTTP ${res.status}`)
  }
  const json = (await res.json()) as RpcResponse<T>
  if (json.error) {
    throw new Error(`Solana RPC ${method} error: ${json.error.message}`)
  }
  if (json.result === undefined) {
    throw new Error(`Solana RPC ${method} returned no result`)
  }
  return json.result
}

/**
 * Pull USDC-credit transfers received by `wallets` on Solana since `sinceMs`.
 *
 * Returns one NormalizedTransfer per inbound USDC credit observed in the
 * window. "Credit" means: a postTokenBalance for the wallet's USDC token
 * account is greater than its preTokenBalance.
 */
export async function fetchRecentSolanaTransfers(
  wallets: string[],
  sinceMs: number,
): Promise<NormalizedTransfer[]> {
  if (wallets.length === 0) return []
  const out: NormalizedTransfer[] = []
  const sinceSec = Math.floor(sinceMs / 1000)

  for (const wallet of wallets) {
    try {
      // 1. Recent signatures for the wallet. Limit 100 is plenty for a 30-min
      //    sweep window even on a busy wallet.
      const sigs = await rpc<SignatureInfo[]>('getSignaturesForAddress', [
        wallet,
        { limit: 100 },
      ])

      // Filter to in-window successful txs only.
      const inWindow = sigs.filter(
        (s) => !s.err && s.blockTime !== null && s.blockTime >= sinceSec,
      )

      // 2. Pull each tx's parsed body. We do these sequentially with a small
      //    delay to be polite to public RPC. Tune SOLANA_RPC_DELAY_MS if needed.
      for (const sig of inWindow) {
        try {
          const tx = await rpc<ParsedTransaction | null>('getTransaction', [
            sig.signature,
            { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' },
          ])
          if (!tx || !tx.meta || tx.meta.err) continue

          const credits = extractUsdcCredits(tx, wallet)
          for (const credit of credits) {
            out.push({
              network: 'solana',
              transactionHash: sig.signature,
              blockNumber: tx.slot,
              fromAddress: credit.from,
              toAddress: wallet,
              tokenAddress: USDC_MINT,
              amountUsd: credit.amountUsd,
              observedAt: tx.blockTime
                ? new Date(tx.blockTime * 1000).toISOString()
                : new Date().toISOString(),
            })
          }
        } catch (err) {
          console.error(`Solana getTransaction(${sig.signature}) failed:`, err)
        }
      }
    } catch (err) {
      console.error(`fetchRecentSolanaTransfers(${wallet}) failed:`, err)
    }
  }

  return out
}

/**
 * Compares pre- and post-token balances on a parsed Solana transaction and
 * returns USDC credits delivered to `recipientWallet`. The wallet owns one
 * or more SPL token accounts; we identify credits as positive deltas in any
 * postTokenBalance whose owner is the recipient and whose mint is USDC.
 *
 * The "from" address is best-effort: we look for the largest negative USDC
 * delta in the same transaction and use that owner. For complex DEX swaps
 * we may not find one (the funder is a program-owned account); in that case
 * we record `from = "unknown"` and let the admin manually verify.
 */
function extractUsdcCredits(
  tx: ParsedTransaction,
  recipientWallet: string,
): Array<{ from: string; amountUsd: number }> {
  const pre = tx.meta?.preTokenBalances ?? []
  const post = tx.meta?.postTokenBalances ?? []

  const credits: Array<{ from: string; amountUsd: number }> = []

  // Build a quick pre-balance index by accountIndex for delta math.
  const preByIndex = new Map<number, TokenBalance>()
  for (const b of pre) preByIndex.set(b.accountIndex, b)

  // Identify candidate "from" — the largest USDC debit in this tx.
  let largestDebit: { owner: string; amount: number } | null = null
  for (const b of post) {
    if (b.mint !== USDC_MINT) continue
    const prev = preByIndex.get(b.accountIndex)
    if (!prev) continue
    const preAmount = parseInt(prev.uiTokenAmount.amount) || 0
    const postAmount = parseInt(b.uiTokenAmount.amount) || 0
    const delta = postAmount - preAmount
    if (delta < 0 && b.owner) {
      const debited = -delta
      if (!largestDebit || debited > largestDebit.amount) {
        largestDebit = { owner: b.owner, amount: debited }
      }
    }
  }

  // Find positive USDC deltas owned by the recipient.
  for (const b of post) {
    if (b.mint !== USDC_MINT) continue
    if (b.owner !== recipientWallet) continue

    const prev = preByIndex.get(b.accountIndex)
    const preAmount = prev ? parseInt(prev.uiTokenAmount.amount) || 0 : 0
    const postAmount = parseInt(b.uiTokenAmount.amount) || 0
    const delta = postAmount - preAmount
    if (delta <= 0) continue

    credits.push({
      from: largestDebit?.owner ?? 'unknown',
      amountUsd: delta / 10 ** USDC_DECIMALS,
    })
  }

  return credits
}

export { USDC_MINT }
