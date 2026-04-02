"use client"

import { useState, useEffect } from "react"
import { AccountDetailsCard } from "@/components/account-details-card"
import { ShippingAddressCard } from "@/components/shipping-address-card"
import { WalletsCard } from "@/components/wallets-card"
import { OrdersCard } from "@/components/orders-card"
import { ErrorBoundary } from "@/components/error-boundary"
import type { ApiOrder } from "@/components/orders-card"
import type { Wallet } from "@/lib/types"

interface UserProfile {
  id: string
  email: string
  role: string
  fullName: string | null
  discordName: string | null
  shippingLine1: string | null
  shippingLine2: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingZip: string | null
  profileComplete: boolean
}

export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, walletsRes, ordersRes] = await Promise.all([
          fetch("/api/users/me"),
          fetch("/api/users/me/wallets"),
          fetch("/api/orders"),
        ])

        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data)
        }

        if (walletsRes.ok) {
          const data = await walletsRes.json()
          // Map DB wallets to the UI Wallet type
          setWallets(
            data.map((w: { id: string; chain: string; address: string }) => ({
              id: w.id,
              chain: w.chain as Wallet["chain"],
              address: w.address,
            })),
          )
        }

        if (ordersRes.ok) {
          const data = await ordersRes.json()
          setOrders(data)
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSaveProfile = async (data: object) => {
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setProfile(updated)
      } else {
        console.error("Failed to save profile:", res.status)
      }
    } catch (error) {
      console.error("Error saving profile:", error)
    }
  }

  const handleAddWallet = async (wallet: Omit<Wallet, "id">) => {
    try {
      const res = await fetch("/api/users/me/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: wallet.chain, address: wallet.address }),
      })
      if (res.ok) {
        const newWallet = await res.json()
        setWallets((prev) => [
          ...prev,
          { id: newWallet.id, chain: newWallet.chain as Wallet["chain"], address: newWallet.address },
        ])
      } else {
        console.error("Failed to add wallet:", res.status)
      }
    } catch (error) {
      console.error("Error adding wallet:", error)
    }
  }

  const handleRemoveWallet = async (id: string) => {
    try {
      const res = await fetch(`/api/users/me/wallets/${id}`, { method: "DELETE" })
      if (res.ok) {
        setWallets((prev) => prev.filter((w) => w.id !== id))
      } else {
        console.error("Failed to remove wallet:", res.status)
      }
    } catch (error) {
      console.error("Error removing wallet:", error)
    }
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

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <AccountDetailsCard
              fullName={profile?.fullName ?? ""}
              discordName={profile?.discordName ?? ""}
              onSave={(data) => handleSaveProfile(data)}
            />
            <ShippingAddressCard
              shippingLine1={profile?.shippingLine1 ?? ""}
              shippingLine2={profile?.shippingLine2 ?? ""}
              shippingCity={profile?.shippingCity ?? ""}
              shippingState={profile?.shippingState ?? ""}
              shippingZip={profile?.shippingZip ?? ""}
              onSave={(data) => handleSaveProfile(data)}
            />
            <WalletsCard wallets={wallets} onAdd={handleAddWallet} onRemove={handleRemoveWallet} />
            <OrdersCard orders={orders} />
          </div>
        )}
      </div>
    </div>
  )
}
