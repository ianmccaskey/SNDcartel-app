export interface Wallet {
  id: string
  chain: "Ethereum" | "Solana" | "Bitcoin" | "Polygon" | "Other"
  address: string
}

export interface Order {
  id: string
  groupBuyId: string // Added groupBuyId to track orders by group buy
  groupBuyTitle: string
  totalCost?: number
  total?: number // Legacy field for backwards compatibility
  txUrl?: string
  allTxUrls?: string[] // Added to store multiple transaction URLs when orders are aggregated
  chain?: string
  items: (OrderItem | string)[] // Changed from string[] to OrderItem[] for better aggregation
  status: "Submitted" | "Delivered" | "Unconfirmed" | "Confirmed" | "Shipped" | "Received"
  submittedAt?: string
  lastUpdated?: string // Track when order was last updated
  productStatuses?: Record<string, "Awaiting Vendor" | "On Hand"> // Added productStatuses to track individual product fulfillment
}

export interface OrderItem {
  productId: string
  name: string
  quantity: number
  price: number
}

export interface AccountDetails {
  fullName: string
  discordName: string
  shippingAddress: {
    line1: string
    line2?: string
    city: string
    state: string
    zip: string
  }
}

export interface GroupBuy {
  id: string
  title: string
  endDate: string
  description: string
}
