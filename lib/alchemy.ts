import { Alchemy, Network } from 'alchemy-sdk'
import { createHmac } from 'crypto'

if (!process.env.ALCHEMY_API_KEY) {
  console.warn('ALCHEMY_API_KEY is not set — Alchemy features will be unavailable')
}

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY ?? '',
  network: Network.ETH_MAINNET,
}

export const alchemy = new Alchemy(settings)

// USDC contract addresses per network
export const USDC_CONTRACTS: Record<string, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
}

// USDC has 6 decimals
export function usdcRawToUsd(rawValue: string): number {
  return parseInt(rawValue, 16) / 1_000_000
}

export function buildExplorerUrl(network: string, txHash: string): string {
  switch (network.toLowerCase()) {
    case 'ethereum':
      return `https://etherscan.io/tx/${txHash}`
    case 'polygon':
      return `https://polygonscan.com/tx/${txHash}`
    case 'base':
      return `https://basescan.org/tx/${txHash}`
    case 'arbitrum':
      return `https://arbiscan.io/tx/${txHash}`
    case 'solana':
      return `https://solscan.io/tx/${txHash}`
    default:
      return `https://etherscan.io/tx/${txHash}`
  }
}

export function verifyAlchemySignature(rawBody: string, signature: string): boolean {
  const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY
  if (!signingKey) return false

  const hmac = createHmac('sha256', signingKey)
  hmac.update(rawBody, 'utf8')
  const digest = hmac.digest('hex')
  return digest === signature
}
