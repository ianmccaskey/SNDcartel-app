export interface Campaign {
  id: string
  name: string
  creatorDisplayName: string
  description: string
  imageUrl?: string
  status: "draft" | "active" | "closed" | "fulfilled"
  deadline?: string
  publicLaunchTime?: string
  totalMOQ: number
  acceptedPayments: AcceptedPayment[]
  adminFee: number // USD flat
  shippingFee: number // USD flat
  finalPaymentInfo: {
    paypal?: string
    venmo?: string
    zelle?: string
  }
  cryptoFeeOptions: CryptoPaymentOption[]
  products: CampaignProduct[]
  boxSizes?: ShippingBoxSize[]
  defaultPaddingFactor?: number // Percentage (e.g., 10 = 10%)
  createdAt: string
  updatedAt: string
}

export interface ShippingBoxSize {
  id: string
  name: string // e.g., "Small", "6x4x2"
  length: number // Inner dimension
  width: number // Inner dimension
  height: number // Inner dimension
  unit: "in" | "cm" // Unit of measurement
  volume: number // Computed L×W×H in cubic inches (stored in in³ for consistency)
  isActive: boolean // Whether this box size will be used
  notes?: string // Optional notes like "Fits up to 10 vials"
}

export interface AcceptedPayment {
  id: string
  token: string // e.g. "USDT (Ethereum)", "USDC (Solana)"
  walletAddress: string
}

export interface CryptoPaymentOption {
  id: string
  token: string
  walletAddress: string
}

export interface CampaignProduct {
  id: string
  peptideName: string
  massDosage: string // e.g. "10MG", "50MG"
  moq: number // MOQ in kits
  price: number // USD
  orderedCount: number
  manualAdjustment: number
  dimensions?: {
    length: number // in inches
    width: number // in inches
    height: number // in inches
    weight: number // in ounces
  }
}

// Kept for backwards compat but not used in new UI:
export interface ShippingBox {
  id: string
  name: string
  internalDimensions: {
    length: number
    width: number
    height: number
  }
  maxWeight: number
}

export interface StoreProduct {
  id: string
  name: string
  description: string
  price: number
  available: boolean
  category: string
  imageUrl?: string | null
  createdAt: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  walletAddresses: string[]
  orderHistory: string[]
  createdAt: string
  discordName?: string
  phoneNumber?: string
  shippingAddress?: {
    line1: string
    line2?: string
    city: string
    state: string
    zip: string
    country?: string
  }
  accountStatus?: "Active" | "Suspended" | "Pending"
  totalSpent?: number
  lastLoginAt?: string
  notes?: string
}
