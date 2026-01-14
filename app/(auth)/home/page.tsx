"use client"

import { useEffect, useState } from "react"
import { storage } from "@/lib/storage"
import type { GroupBuy, Order } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AccountWarningBanner } from "@/components/account-warning-banner"
import Link from "next/link"

// Mock data for active group buys
const mockGroupBuys: GroupBuy[] = [
  {
    id: "1",
    title: "SND NEVER DIE Inaugural Group Buy",
    endDate: "2024-02-15",
    description: "High quality peptides at group pricing - USDC-ERC20 only",
  },
  {
    id: "2",
    title: "TB-500 Group Buy",
    endDate: "2024-01-20",
    description: "Premium TB-500 peptide with testing certificates",
  },
]

export default function HomePage() {
  const [isAccountComplete, setIsAccountComplete] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    setIsAccountComplete(storage.isAccountComplete())
    setOrders(storage.getOrders())
  }, [])

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
          <h1 className="text-4xl font-bold mb-2">Home</h1>
          <p className="text-muted-foreground font-semibold">Welcome to the SND Cartel group buying platform</p>
        </div>

        {!isAccountComplete && (
          <div className="mb-6">
            <AccountWarningBanner />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="bg-background/60 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle>Active Group Buys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockGroupBuys.map((buy) => (
                <div key={buy.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium">{buy.title}</h3>
                    <Badge variant="outline">Ends {new Date(buy.endDate).toLocaleDateString()}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{buy.description}</p>
                  <Link href={`/group-buy/${buy.id}`}>
                    <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700" disabled={!isAccountComplete}>
                      Participate
                    </Button>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle>Completed Group Buys</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No completed group buys yet.</p>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 3).map((order) => (
                    <div key={order.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{order.groupBuyTitle}</span>
                        <Badge variant="secondary" className="text-xs">
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">${order.totalCost.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
              {orders.length > 3 && (
                <Link href="/account">
                  <Button variant="link" size="sm" className="mt-3 p-0">
                    View all orders
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
