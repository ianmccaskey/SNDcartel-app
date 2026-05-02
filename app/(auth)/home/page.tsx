"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AccountWarningBanner } from "@/components/account-warning-banner"
import { pickProductIcon } from "@/lib/product-icons"
import Link from "next/link"

interface ActiveGroupBuyProduct {
  id: string
  name: string
}

interface ActiveGroupBuy {
  id: string
  title: string
  description: string
  endDate: string
  totalKitsOrdered: number
  totalMoqGoal: number
  imageUrl: string | null
  products: ActiveGroupBuyProduct[]
}

function GroupBuySkeleton() {
  return (
    <div className="border rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between mb-2">
        <div className="h-4 bg-white/10 rounded w-48" />
        <div className="h-5 bg-white/10 rounded w-24" />
      </div>
      <div className="h-3 bg-white/10 rounded w-full mb-1" />
      <div className="h-3 bg-white/10 rounded w-3/4 mb-3" />
      <div className="h-8 bg-white/10 rounded w-24" />
    </div>
  )
}

export default function HomePage() {
  const [isAccountComplete, setIsAccountComplete] = useState(false)
  const [groupBuys, setGroupBuys] = useState<ActiveGroupBuy[]>([])
  const [loadingGroupBuys, setLoadingGroupBuys] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check profile completeness from API
    fetch("/api/users/me")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.profileComplete) setIsAccountComplete(true)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch("/api/group-buys")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load group buys")
        return res.json()
      })
      .then((data) => setGroupBuys(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingGroupBuys(false))
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
              {loadingGroupBuys ? (
                <>
                  <GroupBuySkeleton />
                  <GroupBuySkeleton />
                </>
              ) : error ? (
                <p className="text-sm text-red-400">{error}</p>
              ) : groupBuys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active group buys at this time.</p>
              ) : (
                groupBuys.map((buy) => {
                  const progressPct = buy.totalMoqGoal > 0
                    ? Math.min(100, Math.round((buy.totalKitsOrdered / buy.totalMoqGoal) * 100))
                    : 0
                  return (
                    <div key={buy.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium">{buy.title}</h3>
                        {buy.endDate && (
                          <Badge variant="outline">
                            Ends {new Date(buy.endDate).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{buy.description}</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        {buy.totalKitsOrdered} / {buy.totalMoqGoal} kits ({progressPct}%)
                      </p>
                      {buy.products && buy.products.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3" aria-label="Available products">
                          {buy.products.map((p) => {
                            const Icon = pickProductIcon(p.name)
                            return (
                              <Link key={p.id} href={`/group-buy/${buy.id}`} title={p.name}>
                                <Button variant="secondary" size="icon" aria-label={p.name}>
                                  <Icon className="size-4" />
                                </Button>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                      <Link href={`/group-buy/${buy.id}`}>
                        <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700" disabled={!isAccountComplete}>
                          Participate
                        </Button>
                      </Link>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle>Completed Group Buys</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No completed group buys yet.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
