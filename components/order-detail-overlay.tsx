"use client"

import { X, ExternalLink, Package, CheckCircle2, Clock, Truck, XCircle, RotateCcw, ImageIcon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { ApiOrder } from "./orders-card"
import { Badge } from "@/components/ui/badge"

interface OrderDetailOverlayProps {
  order: ApiOrder | null
  onClose: () => void
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
      return <Clock className="h-4 w-4" />
    case "payment_verified":
    case "completed":
      return <CheckCircle2 className="h-4 w-4" />
    case "shipped":
      return <Truck className="h-4 w-4" />
    case "rejected":
    case "cancelled":
      return <XCircle className="h-4 w-4" />
    case "processing":
      return <RotateCcw className="h-4 w-4" />
    default:
      return <Package className="h-4 w-4" />
  }
}

function getFulfillmentStyle(status: string) {
  switch (status) {
    case "delivered":
      return "bg-teal-500/20 text-teal-400 border-teal-500/50"
    case "shipped":
      return "bg-purple-500/20 text-purple-400 border-purple-500/50"
    case "packed":
      return "bg-blue-500/20 text-blue-400 border-blue-500/50"
    case "on_hand":
      return "bg-green-500/20 text-green-400 border-green-500/50"
    case "awaiting_vendor":
    default:
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
  }
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function OrderDetailOverlay({ order, onClose }: OrderDetailOverlayProps) {
  if (!order) return null

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
                  <span className="font-semibold text-cyan-400">${order.totalUsd.toFixed(2)}</span>
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`${getStatusStyle(order.orderStatus)} flex items-center gap-2 px-3 py-1`}
                >
                  {getStatusIcon(order.orderStatus)}
                  <span className="font-semibold">{formatStatus(order.orderStatus)}</span>
                </Badge>
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
            {/* Payments Section */}
            {order.payments && order.payments.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Payment Records
                </h3>
                <div className="space-y-2">
                  {order.payments.map((payment, idx) => (
                    <a
                      key={payment.id}
                      href={payment.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-black/20 hover:bg-black/40 rounded-lg border border-white/5 hover:border-cyan-500/30 transition-all group"
                    >
                      <div>
                        <span className="text-sm text-muted-foreground">
                          {payment.tokenSymbol} on {payment.blockchainNetwork}
                          {order.payments!.length > 1 && ` (${idx + 1} of ${order.payments!.length})`}
                        </span>
                        {payment.amountSubmittedUsd && (
                          <p className="text-xs text-white/40">${payment.amountSubmittedUsd.toFixed(2)}</p>
                        )}
                      </div>
                      <span className="text-xs text-cyan-400 group-hover:text-cyan-300 flex items-center gap-1">
                        View on Blockchain
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Shipments Section */}
            {order.shipments && order.shipments.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Shipments
                </h3>
                <div className="space-y-2">
                  {order.shipments.map((shipment, idx) => (
                    <div key={shipment.id} className="p-4 bg-black/20 rounded-lg border border-white/5 space-y-3">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {shipment.carrier && (
                              <p className="text-sm text-white font-semibold">{shipment.carrier}</p>
                            )}
                            {order.shipments!.length > 1 && (
                              <span className="text-xs text-white/40">Shipment {idx + 1} of {order.shipments!.length}</span>
                            )}
                            {shipment.isPartial && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                Partial
                              </span>
                            )}
                            {shipment.deliveredAt && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Delivered
                              </span>
                            )}
                          </div>
                          {shipment.trackingNumber && (
                            <p className="text-xs font-mono text-white/60 mt-1">{shipment.trackingNumber}</p>
                          )}
                        </div>
                        {shipment.trackingUrl && (
                          <a
                            href={shipment.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 shrink-0"
                          >
                            Track
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="flex flex-wrap gap-4 text-xs text-white/40">
                        {shipment.shippedAt && (
                          <span>Shipped {new Date(shipment.shippedAt).toLocaleDateString()}</span>
                        )}
                        {shipment.estimatedDelivery && !shipment.deliveredAt && (
                          <span>Est. delivery {new Date(shipment.estimatedDelivery).toLocaleDateString()}</span>
                        )}
                        {shipment.deliveredAt && (
                          <span className="text-teal-400">Delivered {new Date(shipment.deliveredAt).toLocaleDateString()}</span>
                        )}
                      </div>

                      {/* Notes */}
                      {shipment.notes && (
                        <p className="text-xs text-white/50 italic">{shipment.notes}</p>
                      )}

                      {/* Tracking image */}
                      {shipment.trackingImageUrl && (
                        <a
                          href={shipment.trackingImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          View tracking image
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Products Section */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Products Ordered</h3>
              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{item.productNameSnapshot}</h4>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {item.quantity}
                          {item.unitPriceUsd > 0 && ` • $${item.unitPriceUsd.toFixed(2)} each`}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`${getFulfillmentStyle(item.fulfillmentStatus)} text-xs`}
                      >
                        {formatStatus(item.fulfillmentStatus)}
                      </Badge>
                    </div>
                    {item.lineTotalUsd && (
                      <p className="text-xs text-cyan-400 font-semibold">
                        Subtotal: ${item.lineTotalUsd.toFixed(2)}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg p-4 space-y-2">
              {order.subtotalUsd !== order.totalUsd && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-white">${order.subtotalUsd.toFixed(2)}</span>
                  </div>
                  {order.shippingFeeUsd > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="text-white">${order.shippingFeeUsd.toFixed(2)}</span>
                    </div>
                  )}
                  {order.adminFeeUsd > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Admin Fee</span>
                      <span className="text-white">${order.adminFeeUsd.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-2" />
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Order Value</span>
                <span className="text-2xl font-bold text-cyan-400">${order.totalUsd.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
