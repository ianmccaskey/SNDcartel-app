import type { AccountDetails, Wallet, Order } from "./types"

const STORAGE_KEYS = {
  ACCOUNT: "snd_account_details",
  WALLETS: "snd_wallets",
  ORDERS: "snd_orders",
}

export const storage = {
  getAccount: (): AccountDetails | null => {
    if (typeof window === "undefined") return null
    const data = localStorage.getItem(STORAGE_KEYS.ACCOUNT)
    return data ? JSON.parse(data) : null
  },

  saveAccount: (account: AccountDetails) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.ACCOUNT, JSON.stringify(account))
  },

  getWallets: (): Wallet[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.WALLETS)
    return data ? JSON.parse(data) : []
  },

  saveWallets: (wallets: Wallet[]) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets))
  },

  getOrders: (): Order[] => {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem(STORAGE_KEYS.ORDERS)
    return data ? JSON.parse(data) : []
  },

  saveOrders: (orders: Order[]) => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders))
  },

  isAccountComplete: (): boolean => {
    const account = storage.getAccount()
    if (!account) return false

    return !!(
      account.fullName &&
      account.discordName &&
      account.shippingAddress.line1 &&
      account.shippingAddress.city &&
      account.shippingAddress.state &&
      account.shippingAddress.zip
    )
  },
}

export function loadFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : null
}

export function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

let orderLock = false
const orderQueue: (() => void)[] = []

async function acquireOrderLock(): Promise<void> {
  return new Promise((resolve) => {
    if (!orderLock) {
      orderLock = true
      resolve()
    } else {
      orderQueue.push(() => {
        orderLock = true
        resolve()
      })
    }
  })
}

function releaseOrderLock(): void {
  orderLock = false
  const next = orderQueue.shift()
  if (next) next()
}

export async function mergeOrCreateOrder(newOrder: Order): Promise<void> {
  await acquireOrderLock()

  try {
    const existingOrders = storage.getOrders()
    const existingOrderIndex = existingOrders.findIndex((o) => o.groupBuyId === newOrder.groupBuyId)

    if (existingOrderIndex !== -1) {
      // Merge with existing order
      const existingOrder = existingOrders[existingOrderIndex]

      // Aggregate items: if same productId exists, add quantities; otherwise add new item
      const mergedItems = [...existingOrder.items]

      newOrder.items.forEach((newItem) => {
        const existingItemIndex = mergedItems.findIndex((item) => item.productId === newItem.productId)

        if (existingItemIndex !== -1) {
          // Add to existing quantity
          mergedItems[existingItemIndex].quantity += newItem.quantity
        } else {
          // Add new item
          mergedItems.push(newItem)
        }
      })

      // Update the order
      existingOrders[existingOrderIndex] = {
        ...existingOrder,
        items: mergedItems,
        totalCost: existingOrder.totalCost + newOrder.totalCost,
        lastUpdated: new Date().toISOString(),
      }
    } else {
      // Create new order
      existingOrders.push(newOrder)
    }

    storage.saveOrders(existingOrders)
  } finally {
    releaseOrderLock()
  }
}
