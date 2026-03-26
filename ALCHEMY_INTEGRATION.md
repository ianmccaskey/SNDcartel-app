# Alchemy Integration for Automated Payment Verification

## Overview

Integrate Alchemy to replace manual payment verification with automated USDC transfer detection and matching.

## Enhanced Payment Flow

### Current (Manual) Flow
1. User places order → status: `pending_payment`
2. User sends USDC to campaign wallet
3. User manually submits transaction hash
4. Admin reviews transaction on Etherscan
5. Admin manually marks order as verified

### New (Automated) Flow  
1. User places order → status: `pending_payment`
2. **System stores user's wallet address**
3. User sends USDC to campaign wallet
4. **Alchemy webhook fires on USDC transfer**
5. **System auto-matches transfer to order**
6. **Order auto-marked as verified** → email notification

## Technical Architecture

### Alchemy SDK Integration
```typescript
// lib/alchemy.ts
import { Alchemy, Network } from 'alchemy-sdk'

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
}

export const alchemy = new Alchemy(settings)
```

### Webhook Endpoint
```typescript
// app/api/webhooks/alchemy/route.ts
export async function POST(request: Request) {
  // 1. Verify webhook signature
  // 2. Parse transfer event
  // 3. Match to pending orders
  // 4. Update order status
  // 5. Send confirmation email
}
```

### Payment Matching Algorithm
```typescript
interface PaymentMatch {
  orderId: string
  confidence: number // 0-100
  reasons: string[]
}

async function matchPaymentToOrder(transfer: AlchemyTransfer): Promise<PaymentMatch[]> {
  const matches = []
  
  // Find orders with matching customer wallet
  const orders = await findPendingOrdersByWallet(transfer.from)
  
  for (const order of orders) {
    let confidence = 0
    const reasons = []
    
    // Exact wallet match
    if (transfer.from.toLowerCase() === order.customerWallet.toLowerCase()) {
      confidence += 40
      reasons.push('wallet_exact_match')
    }
    
    // Amount match (within tolerance)
    const expectedUSD = order.totalUsd
    const receivedUSD = usdcToUsd(transfer.value)
    const tolerance = 0.05 // 5%
    
    if (Math.abs(expectedUSD - receivedUSD) <= expectedUSD * tolerance) {
      confidence += 40
      reasons.push('amount_within_tolerance')
    }
    
    // Recent order (within 24h)
    const hoursSinceOrder = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceOrder <= 24) {
      confidence += 20
      reasons.push('recent_order')
    }
    
    matches.push({ orderId: order.id, confidence, reasons })
  }
  
  return matches.sort((a, b) => b.confidence - a.confidence)
}
```

## Database Schema Changes

### Add Customer Wallet to Orders
```sql
ALTER TABLE orders 
ADD COLUMN customer_wallet_address TEXT;

CREATE INDEX idx_orders_customer_wallet ON orders(customer_wallet_address);
```

### Webhook Events Audit Trail
```sql
CREATE TABLE alchemy_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      TEXT NOT NULL,           -- Alchemy webhook ID
  event_type      TEXT NOT NULL,           -- 'GRAPHQL_WEBHOOK'
  transaction_hash TEXT NOT NULL,
  block_number    INTEGER NOT NULL,
  from_address    TEXT NOT NULL,
  to_address      TEXT NOT NULL,
  token_address   TEXT NOT NULL,           -- USDC contract
  value_raw       TEXT NOT NULL,           -- Raw token amount
  value_usd       NUMERIC(10,2),           -- USD equivalent
  network         TEXT NOT NULL,           -- 'ethereum'
  processed       BOOLEAN NOT NULL DEFAULT false,
  matched_order_id UUID REFERENCES orders(id),
  match_confidence INTEGER,                -- 0-100
  match_reasons   TEXT[],
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alchemy_events_tx_hash ON alchemy_webhook_events(transaction_hash);
CREATE INDEX idx_alchemy_events_to_address ON alchemy_webhook_events(to_address);
CREATE INDEX idx_alchemy_events_processed ON alchemy_webhook_events(processed);
```

## Environment Variables

```bash
# Alchemy
ALCHEMY_API_KEY=your_alchemy_api_key
ALCHEMY_WEBHOOK_SIGNING_KEY=your_webhook_signing_key

# USDC Contract Addresses
USDC_CONTRACT_ETHEREUM=0xA0b86a33E6441038DF2c28C74b1a7ab4aca7f1e2
USDC_CONTRACT_POLYGON=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
USDC_CONTRACT_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

## API Endpoints

### Payment Status Check (for frontend polling)
```typescript
GET /api/orders/[id]/payment-status
// Returns: { status: 'pending' | 'verified', confidence?: number }
```

### Manual Payment Verification (fallback)
```typescript
POST /api/admin/orders/[id]/verify-payment
// Body: { transactionHash: string, override?: boolean }
```

### Payment Events (for debugging)
```typescript
GET /api/admin/alchemy/events?orderId=123
// Returns webhook events related to an order
```

## Implementation Phases

### Phase 3A: Basic Alchemy Setup
- Install Alchemy SDK
- Create webhook endpoint
- Add customer_wallet_address to orders
- Basic transfer detection

### Phase 3B: Payment Matching
- Implement matching algorithm
- Add confidence scoring
- Create audit trail table
- Admin review interface for low-confidence matches

### Phase 3C: Multi-chain Support
- Add Polygon USDC support
- Add Base USDC support
- Network detection logic
- Chain-specific contract addresses

### Phase 3D: Real-time Updates
- WebSocket integration for live payment status
- Frontend payment status polling
- Email notifications on payment confirmation
- Mobile push notifications (future)

## Benefits

### User Experience
- No transaction hash entry required
- Instant payment confirmation
- Clear payment status updates
- Reduced user errors

### Admin Experience  
- Eliminates manual payment verification
- Audit trail for all transactions
- Confidence scoring for edge cases
- Automated order processing

### Technical Benefits
- Reduced support tickets
- Scalable to multiple chains
- Real-time payment processing
- Comprehensive transaction logs

## Edge Cases & Fallbacks

### Low Confidence Matches
- Admin review queue for matches <80% confidence
- Manual override capability
- Customer service tools for payment issues

### Webhook Failures
- Retry mechanism with exponential backoff  
- Manual transaction lookup API
- Health monitoring for webhook endpoint

### Multiple Matches
- Prefer highest confidence match
- Flag for admin review if multiple high-confidence matches
- Timestamp-based disambiguation

This integration transforms the payment experience from manual/error-prone to automated/professional while maintaining the flexibility to handle edge cases.