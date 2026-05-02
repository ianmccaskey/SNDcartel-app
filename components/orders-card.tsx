"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, CheckCircle2, Clock, Truck, XCircle, RotateCcw } from "lucide-react"
import { useState } from "react"
import { OrderDetailOverlay } from "./order-detail-overlay"

export interface ApiOrderItem {
  id: string
  productId: string | null
  storeProductId: string | null
  quantity: number
  unitPriceUsd: number
  lineTotalUsd: number | null
  productNameSnapshot: string
  fulfillmentStatus: string
}

export interface ApiOrderPayment {
  id: string
  txHash: string
  blockchainNetwork: string
  fromWalletAddress: string | null
  amountSubmittedUsd: number | null
  amountExpectedUsd: number
  tokenSymbol: string
  explorerUrl: string
  status: string
  createdAt: string
}

export interface ApiOrder {
  id: string
  groupBuyId: string | null
  groupBuyTitle: string
  storeOrder: boolean
  orderStatus: string
  paymentStatus: string
  subtotalUsd: number
  shippingFeeUsd: number
  adminFeeUsd: number
  totalUsd: number
  customerWalletAddress: string | null
  userNotes: string | null
  createdAt: string
  updatedAt: string
  items: ApiOrderItem[]
  payments?: ApiOrderPayment[]
  shipments?: Array<{
    id: string
    carrier: string | null
    trackingNumber: string | null
    trackingUrl: string | null
    trackingImageUrl: string | null
    shippedAt: string | null
    estimatedDelivery: string | null
    deliveredAt: string | null
    isPartial: boolean
    notes: string | null
  }>
}

interface OrdersCardProps {
  orders: ApiOrder[]
}

function getStatusStyle(orderStatus: string) {
  switch (orderStatus) {
    case "pending_payment":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
    case "payment_submitted":
      return "bg-blue-500/20 text-blue-400 border-blue-500/50"
    case "payment_verified":
      return "bg-green-500/20 text-green-400 border-green-500/50"
    case "processing":
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
    case "shipped":
      return "bg-purple-500/20 text-purple-400 border-purple-500/50"
    case "completed":
      return "bg-teal-500/20 text-teal-400 border-teal-500/50"
    case "rejected":
    case "cancelled":
      return "bg-red-500/20 text-red-400 border-red-500/50"
    default:
      return "bg-white/10 text-white/60 border-white/20"
  }
}

function getStatusIcon(orderStatus: string) {
  switch (orderStatus) {
    case "pending_payment":
      return <Clock className="h-3 w-3" />
    case "payment_verified":
    case "completed":
      return <CheckCircle2 className="h-3 w-3" />
    case "shipped":
      return <Truck className="h-3 w-3" />
    case "rejected":
    case "cancelled":
      return <XCircle className="h-3 w-3" />
    case "processing":
      return <RotateCcw className="h-3 w-3" />
    default:
      return <Package className="h-3 w-3" />
  }
}

function formatStatus(orderStatus: string) {
  return orderStatus
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function OrdersCard({ orders }: OrdersCardProps) {
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null)

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
                  className="border border-white/10 rounded-lg p-4 bg-black/50 hover:bg-black/60 backdrop-blur-sm transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-white">{order.groupBuyTitle}</h4>
                      <p className="text-sm text-muted-foreground">
                        ${order.totalUsd.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${getStatusStyle(order.orderStatus)} flex items-center gap-1`}
                    >
                      {getStatusIcon(order.orderStatus)}
                      {formatStatus(order.orderStatus)}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Products:</p>
                    <div className="flex flex-wrap gap-1">
                      {order.items.map((item) => (
                        <Badge
                          key={item.id}
                          variant="outline"
                          className="text-xs bg-white/10 border-white/20 text-white/90"
                        >
                          {item.productNameSnapshot} x{item.quantity}
                        </Badge>
                      ))}
                    </div>
                  </div>
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
