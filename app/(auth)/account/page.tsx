"use client"

import { useState, useEffect } from "react"
import { AccountDetailsCard } from "@/components/account-details-card"
import { ShippingAddressCard } from "@/components/shipping-address-card"
import { WalletsCard } from "@/components/wallets-card"
import { OrdersCard } from "@/components/orders-card"
import type { Wallet, Order, OrderItem } from "@/lib/types"
import { loadFromStorage, saveToStorage } from "@/lib/storage"

function aggregateOrdersByGroupBuy(orders: Order[]): Order[] {
  const orderMap = new Map<string, Order>()

  for (const order of orders) {
    const key = order.groupBuyTitle || order.groupBuyId || order.id

    if (orderMap.has(key)) {
      const existingOrder = orderMap.get(key)!

      // Merge items - aggregate quantities for same products
      const itemsMap = new Map<string, OrderItem>()

      for (const item of existingOrder.items) {
        const itemObj = typeof item === "string" ? { productId: item, name: item, quantity: 1, price: 0 } : item
        itemsMap.set(itemObj.productId || itemObj.name, { ...itemObj })
      }

      for (const item of order.items) {
        const itemObj = typeof item === "string" ? { productId: item, name: item, quantity: 1, price: 0 } : item
        const itemKey = itemObj.productId || itemObj.name
        if (itemsMap.has(itemKey)) {
          const existing = itemsMap.get(itemKey)!
          existing.quantity += itemObj.quantity
        } else {
          itemsMap.set(itemKey, { ...itemObj })
        }
      }

      // Update the existing order with merged data
      existingOrder.items = Array.from(itemsMap.values())
      existingOrder.totalCost = (existingOrder.totalCost || 0) + (order.totalCost || order.total || 0)

      // Collect all transaction URLs
      existingOrder.allTxUrls = existingOrder.allTxUrls || []
      if (existingOrder.txUrl && !existingOrder.allTxUrls.includes(existingOrder.txUrl)) {
        existingOrder.allTxUrls.push(existingOrder.txUrl)
      }
      if (order.txUrl && !existingOrder.allTxUrls.includes(order.txUrl)) {
        existingOrder.allTxUrls.push(order.txUrl)
      }

      // Keep the most recent submission date
      if (order.submittedAt && (!existingOrder.submittedAt || order.submittedAt > existingOrder.submittedAt)) {
        existingOrder.submittedAt = order.submittedAt
      }

      // Keep Delivered status if any order has it
      if (order.status === "Delivered") {
        existingOrder.status = "Delivered"
      }
    } else {
      // Clone the order to avoid mutations
      const txUrls: string[] = []
      if (order.txUrl) txUrls.push(order.txUrl)

      orderMap.set(key, {
        ...order,
        items: order.items.map((item) =>
          typeof item === "string" ? { productId: item, name: item, quantity: 1, price: 0 } : { ...item },
        ),
        totalCost: order.totalCost || order.total || 0,
        allTxUrls: txUrls,
      })
    }
  }

  return Array.from(orderMap.values())
}

export default function AccountPage() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    const savedWallets = loadFromStorage<Wallet[]>("wallets") || []
    setWallets(savedWallets)
    const savedOrders = loadFromStorage<Order[]>("orders") || []

    const hasRatCartelOrder = savedOrders.some(
      (o) => o.groupBuyId === "rat-cartel" || o.groupBuyTitle === "SND x Rat Cartel Group Buy",
    )
    if (!hasRatCartelOrder) {
      const defaultOrder: Order = {
        id: "rat-cartel-001",
        groupBuyId: "rat-cartel",
        groupBuyTitle: "SND x Rat Cartel Group Buy",
        items: [
          { productId: "tirz-30", name: "Tirzepatide 30mg", quantity: 2, price: 45 },
          { productId: "reta-20", name: "Retatrutide 20mg", quantity: 1, price: 55 },
        ],
        totalCost: 145,
        status: "Delivered",
        txUrl: "https://etherscan.io/tx/0x7a3b9f2c",
        chain: "Ethereum",
        submittedAt: new Date("2024-12-15").toISOString(),
      }
      savedOrders.unshift(defaultOrder)
    }

    const aggregatedOrders = aggregateOrdersByGroupBuy(savedOrders)
    saveToStorage("orders", aggregatedOrders)
    setOrders(aggregatedOrders)
  }, [])

  const handleAddWallet = (wallet: Omit<Wallet, "id">) => {
    const newWallet = { ...wallet, id: Date.now().toString() }
    const updatedWallets = [...wallets, newWallet]
    setWallets(updatedWallets)
    saveToStorage("wallets", updatedWallets)
  }

  const handleRemoveWallet = (id: string) => {
    const updatedWallets = wallets.filter((w) => w.id !== id)
    setWallets(updatedWallets)
    saveToStorage("wallets", updatedWallets)
  }

  return (
    <div className="min-h-screen bg-transparent relative">
      <div
        className="container mx-auto px-4 py-8 max-w-6xl relative z-10"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 120px, black 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 120px, black 100%)",
        }}
      >
        <div className="mb-8 pt-32 md:pt-40">
          <h1 className="text-4xl font-bold mb-2">Account Settings</h1>
          <p className="text-muted-foreground">Manage your account details and preferences</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <AccountDetailsCard />
          <ShippingAddressCard />
          <WalletsCard wallets={wallets} onAdd={handleAddWallet} onRemove={handleRemoveWallet} />
          <OrdersCard orders={orders} />
        </div>
      </div>
    </div>
  )
}
