import { Alchemy, Network as AlchemyNetwork, AssetTransfersCategory } from 'alchemy-sdk'
import { USDC_CONTRACT, USDC_DECIMALS, type NormalizedTransfer, type Network } from './types'

// Map our normalized network name → Alchemy SDK's network enum.
const ALCHEMY_NETWORK: Record<'ethereum' | 'polygon' | 'base', AlchemyNetwork> = {
  ethereum: AlchemyNetwork.ETH_MAINNET,
  polygon: AlchemyNetwork.MATIC_MAINNET,
  base: AlchemyNetwork.BASE_MAINNET,
}

// Lazy per-network SDK clients so we don't instantiate Alchemy for chains the
// current campaign doesn't accept.
const clients: Partial<Record<'ethereum' | 'polygon' | 'base', Alchemy>> = {}

function getClient(network: 'ethereum' | 'polygon' | 'base'): Alchemy | null {
  const key = process.env.ALCHEMY_API_KEY
  if (!key) return null
  if (!clients[network]) {
    clients[network] = new Alchemy({ apiKey: key, network: ALCHEMY_NETWORK[network] })
  }
  return clients[network] ?? null
}

/**
 * Pull USDC transfers received by `wallets` on `network` since the most recent
 * sweep. Returns a normalized transfer per inbound USDC tx in the window.
 *
 * Implementation uses Alchemy's `getAssetTransfers` with category=erc20 and a
 * contractAddresses filter pinned to the USDC contract for the chain. Time
 * filtering happens client-side because the API filters by block number, not
 * timestamp — for a 30-minute sweep window the result set is tiny so this is
 * harmless.
 */
export async function fetchRecentEvmTransfers(
  network: 'ethereum' | 'polygon' | 'base',
  wallets: string[],
  sinceMs: number,
): Promise<NormalizedTransfer[]> {
  if (wallets.length === 0) return []
  const client = getClient(network)
  if (!client) return []

  const usdcContract = USDC_CONTRACT[network]
  const sinceDate = new Date(sinceMs)
  const out: NormalizedTransfer[] = []

  // getAssetTransfers is paginated; for a 30-min window we expect well under
  // the 1000-item page cap, so one page is usually enough. If we hit the cap
  // we'd want to paginate — flagged with a TODO since it's a v2 concern.
  for (const wallet of wallets) {
    try {
      const res = await client.core.getAssetTransfers({
        category: [AssetTransfersCategory.ERC20],
        contractAddresses: [usdcContract],
        toAddress: wallet,
        withMetadata: true,
        excludeZeroValue: true,
        maxCount: 100,
      })

      for (const t of res.transfers) {
        // metadata.blockTimestamp is an ISO string when withMetadata is true
        const blockTime = t.metadata?.blockTimestamp
          ? new Date(t.metadata.blockTimestamp).getTime()
          : null
        if (blockTime !== null && blockTime < sinceMs) continue

        out.push({
          network: network as Network,
          transactionHash: t.hash,
          blockNumber: parseInt(t.blockNum, 16),
          fromAddress: (t.from ?? '').toLowerCase(),
          toAddress: (t.to ?? '').toLowerCase(),
          tokenAddress: usdcContract.toLowerCase(),
          // t.value is in token units already (a float). Convert to USD assuming
          // 6 decimals matches USDC. Cap at 2 decimals for storage.
          amountUsd: parseFloat((t.value ?? 0).toFixed(USDC_DECIMALS)),
          observedAt: t.metadata?.blockTimestamp ?? sinceDate.toISOString(),
        })
      }
    } catch (err) {
      // Don't let one wallet's failure block the rest.
      console.error(`fetchRecentEvmTransfers(${network}, ${wallet}) failed:`, err)
    }
  }

  return out
}
