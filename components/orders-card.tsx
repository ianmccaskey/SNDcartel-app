"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Order } from "@/lib/types"
import { ExternalLink, Package, CheckCircle2 } from "lucide-react"
import { useState } from "react"
import { OrderDetailOverlay } from "./order-detail-overlay"

interface OrdersCardProps {
  orders: Order[]
}

export function OrdersCard({ orders }: OrdersCardProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const getStatusStyle = (status: Order["status"]) => {
    switch (status) {
      case "Submitted":
        return "bg-green-500/20 text-green-400 border-green-500/50"
      case "Delivered":
        return "bg-teal-500/20 text-teal-400 border-teal-500/50"
      case "Confirmed":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50"
      case "Shipped":
        return "bg-purple-500/20 text-purple-400 border-purple-500/50"
      case "Received":
        return "bg-teal-500/20 text-teal-400 border-teal-500/50"
      default:
        return "bg-white/10 text-white/60 border-white/20"
    }
  }

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "Submitted":
        return <CheckCircle2 className="h-3 w-3" />
      case "Delivered":
        return <Package className="h-3 w-3" />
      default:
        return null
    }
  }

  return (
    <>
      <Card className="bg-background/80 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="border border-white/10 rounded-lg p-4 bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-white">{order.groupBuyTitle}</h4>
                      <p className="text-sm text-muted-foreground">
                        ${(order.totalCost ?? order.total ?? 0).toFixed(2)} via {order.chain || "Crypto"}
                      </p>
                      {order.submittedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(order.submittedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={`${getStatusStyle(order.status)} flex items-center gap-1`}>
                      {getStatusIcon(order.status)}
                      {order.status}
                    </Badge>
                  </div>
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">Products:</p>
                    <div className="flex flex-wrap gap-1">
                      {order.items.map((item, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-white/5 border-white/10">
                          {typeof item === "string" ? item : `${item.name} x${item.quantity}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {order.allTxUrls && order.allTxUrls.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {order.allTxUrls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1 transition-colors"
                        >
                          Transaction {idx + 1}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  ) : order.txUrl ? (
                    <a
                      href={order.txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1 transition-colors"
                    >
                      View Transaction
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailOverlay order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </>
  )
}
