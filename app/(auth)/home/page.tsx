"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AccountWarningBanner } from "@/components/account-warning-banner"
import { pickProductIcon } from "@/lib/product-icons"
import { cn } from "@/lib/utils"
import { Package } from "lucide-react"
import Link from "next/link"

// Default placeholder served from /public when a group buy has no imageUrl.
const DEFAULT_GROUP_BUY_IMAGE = "/sndvial.mp4"

// Detect video sources so we can render <video> instead of <img>. Matches the
// extension at the end of the path (allowing for query strings).
function isVideoSrc(src: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(src)
}

function GroupBuyImageBox({
  imageUrl,
  title,
  className,
}: {
  imageUrl: string | null
  title: string
  className?: string
}) {
  const [mediaFailed, setMediaFailed] = useState(false)
  const src = imageUrl || DEFAULT_GROUP_BUY_IMAGE
  const isVideo = isVideoSrc(src)

  return (
    <div
      className={cn(
        "aspect-square rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden",
        className,
      )}
    >
      {mediaFailed ? (
        <div className="w-full h-full flex items-center justify-center">
          <Package className="size-8 text-white/30" />
        </div>
      ) : isVideo ? (
        <video
          src={src}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-label={title}
          className="w-full h-full object-cover"
          onError={() => setMediaFailed(true)}
        />
      ) : (
        <img
          src={src}
          alt={title}
          className="w-full h-full object-cover"
          onError={() => setMediaFailed(true)}
        />
      )}
    </div>
  )
}

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

        <div className="grid gap-6 mb-8">
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
                  return (
                    <div key={buy.id} className="border rounded-lg p-4 relative">
                      {buy.endDate && (
                        <Badge
                          variant="outline"
                          className="absolute -top-2.5 right-4 z-10 bg-background whitespace-nowrap"
                        >
                          Ends {new Date(buy.endDate).toLocaleDateString()}
                        </Badge>
                      )}
                      {/*
                        2-column grid. Image is top-left in col 1 (row-span-1
                        on phone, row-span-3 on md+). Title and description
                        live together in col 2 row 1. Pills and Participate
                        sit in col 2 on md+ (md:col-start-2) and span both
                        cols full-width on phone (col-span-2).
                      */}
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 md:gap-x-4 gap-y-3 items-start">
                        <GroupBuyImageBox
                          imageUrl={buy.imageUrl}
                          title={buy.title}
                          className="w-20 sm:w-24 md:w-40 lg:w-48 md:row-span-3 self-start"
                        />
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold mb-2 break-words">
                            <span
                              aria-hidden
                              className="inline-block size-2 rounded-full bg-primary shadow-glow shadow-primary/50 animate-pulse mr-2 align-middle"
                            />
                            {buy.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">{buy.description}</p>
                        </div>
                        {buy.products && buy.products.length > 0 && (
                          <div
                            className="col-span-2 md:col-span-1 md:col-start-2 flex flex-wrap gap-2"
                            aria-label="Available products"
                          >
                            {buy.products.map((p) => {
                              const Icon = pickProductIcon(p.name)
                              return (
                                <Link key={p.id} href={`/group-buy/${buy.id}`} title={p.name}>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    aria-label={p.name}
                                    className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                                  >
                                    <Icon className="size-3.5 sm:size-4" />
                                    <span>{p.name}</span>
                                  </Button>
                                </Link>
                              )
                            })}
                          </div>
                        )}
                        <Link
                          href={`/group-buy/${buy.id}`}
                          className="col-span-2 md:col-span-1 md:col-start-2"
                        >
                          <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700" disabled={!isAccountComplete}>
                            Participate
                          </Button>
                        </Link>
                      </div>
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
