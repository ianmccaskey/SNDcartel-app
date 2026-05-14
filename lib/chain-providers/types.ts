/**
 * Common chain-provider types. The two recognised pipelines today are:
 *
 *   - Alchemy webhooks   →  inbound POST  →  /api/webhooks/alchemy
 *   - Periodic sweep job →  /api/cron/sweep-payments  →  lib/chain-providers/*
 *
 * Both pipelines normalize their results into `NormalizedTransfer` so the
 * downstream matcher and audit-log inserter don't care about source.
 */

export type Network = 'ethereum' | 'polygon' | 'base' | 'solana'

/**
 * The chains that have webhook-based real-time detection. Everything else
 * relies purely on the periodic sweep.
 */
export const WEBHOOK_NETWORKS: Network[] = ['ethereum', 'polygon', 'base']

/** USDC contracts per network. */
export const USDC_CONTRACT: Record<Network, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  // SPL token mint on Solana mainnet
  solana: 'EPjFWdd5AufqSSqeM2qN1XzybapC8G4wEGGkZwyTDt1v',
}

/** Decimals of the USDC token on each chain. EVM USDC is 6; Solana USDC is 6. */
export const USDC_DECIMALS = 6

/**
 * A USDC transfer observed on-chain, regardless of which provider surfaced it.
 * Values are normalized:
 *   - amountUsd is the human-readable USD value (6-decimal USDC parsed to a float)
 *   - addresses are lowercased for EVM, original case preserved for Solana
 *   - transactionHash is the chain-native hash (0x-prefixed for EVM, base58 for Solana)
 */
export interface NormalizedTransfer {
  network: Network
  transactionHash: string
  blockNumber: number
  fromAddress: string
  toAddress: string
  tokenAddress: string
  amountUsd: number
  /** ISO timestamp of when the chain confirmed the transfer, when available. */
  observedAt?: string
}
