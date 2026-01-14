"use client"

import { X, ExternalLink, Package, CheckCircle2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { Order } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"

interface OrderDetailOverlayProps {
  order: Order | null
  onClose: () => void
}

type ProductStatus = "Awaiting Vendor" | "On Hand"

export function OrderDetailOverlay({ order, onClose }: OrderDetailOverlayProps) {
  const [productStatuses] = useState<Record<string, ProductStatus>>(() => {
    const statuses: Record<string, ProductStatus> = {}
    if (order) {
      order.items.forEach((item) => {
        const itemName = typeof item === "string" ? item : item.name
        // Randomly assign status for demo - in production this would be from API
        statuses[itemName] = Math.random() > 0.5 ? "On Hand" : "Awaiting Vendor"
      })
    }
    return statuses
  })

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

  const getProductStatusStyle = (status: ProductStatus) => {
    return status === "On Hand"
      ? "bg-green-500/20 text-green-400 border-green-500/50"
      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
  }

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "Submitted":
        return <CheckCircle2 className="h-4 w-4" />
      case "Delivered":
        return <Package className="h-4 w-4" />
      default:
        return null
    }
  }

  if (!order) return null

  const transactions = order.allTxUrls || (order.txUrl ? [order.txUrl] : [])

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Overlay Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/10 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">{order.groupBuyTitle}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="font-semibold text-cyan-400">
                    ${(order.totalCost ?? order.total ?? 0).toFixed(2)}
                  </span>
                  <span>via {order.chain || "Crypto"}</span>
                  {order.submittedAt && <span>{new Date(order.submittedAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Status Badge */}
                <Badge
                  variant="outline"
                  className={`${getStatusStyle(order.status)} flex items-center gap-2 px-3 py-1`}
                >
                  {getStatusIcon(order.status)}
                  <span className="font-semibold">{order.status}</span>
                </Badge>
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Transactions Section */}
            {transactions.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Transaction Records
                </h3>
                <div className="space-y-2">
                  {transactions.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-black/20 hover:bg-black/40 rounded-lg border border-white/5 hover:border-cyan-500/30 transition-all group"
                    >
                      <span className="text-sm text-muted-foreground">
                        Payment {transactions.length > 1 ? `${idx + 1} of ${transactions.length}` : ""}
                      </span>
                      <span className="text-xs text-cyan-400 group-hover:text-cyan-300 flex items-center gap-1">
                        View on Blockchain
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Products Section */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Products Ordered</h3>
              <div className="space-y-3">
                {order.items.map((item, idx) => {
                  const itemName = typeof item === "string" ? item : item.name
                  const itemQuantity = typeof item === "string" ? 1 : item.quantity
                  const itemPrice = typeof item === "string" ? 0 : item.price
                  const productStatus = productStatuses[itemName] || "Awaiting Vendor"

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white">{itemName}</h4>
                          <p className="text-sm text-muted-foreground">
                            Quantity: {itemQuantity}
                            {itemPrice > 0 && ` • $${itemPrice.toFixed(2)} each`}
                          </p>
                        </div>
                        <Badge variant="outline" className={`${getProductStatusStyle(productStatus)} text-xs`}>
                          {productStatus}
                        </Badge>
                      </div>
                      {itemPrice > 0 && (
                        <p className="text-xs text-cyan-400 font-semibold">
                          Subtotal: ${(itemPrice * itemQuantity).toFixed(2)}
                        </p>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Order Value</span>
                <span className="text-2xl font-bold text-cyan-400">
                  ${(order.totalCost ?? order.total ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
