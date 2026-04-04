"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
  ImageIcon,
  X,
  AlertTriangle,
} from "lucide-react"
import { CARRIERS } from "@/lib/tracking"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminOrderItem {
  id: string
  productNameSnapshot: string
  quantity: number
  fulfillmentStatus: string
}

interface AdminOrder {
  id: string
  userEmail: string | null
  userFullName: string | null
  groupBuyId: string | null
  groupBuyName: string | null
  orderStatus: string
  totalUsd: number
  createdAt: string
  items: AdminOrderItem[]
  shipments?: AdminShipment[]
}

interface AdminShipment {
  id: string
  orderId: string
  carrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  trackingImageUrl: string | null
  shippedAt: string | null
  estimatedDelivery: string | null
  deliveredAt: string | null
  isPartial: boolean
  notes: string | null
}

interface GroupBuySummary {
  id: string
  name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FULFILLMENT_ORDER = ['awaiting_vendor', 'on_hand', 'packed', 'shipped', 'delivered']

function worstFulfillmentStatus(items: AdminOrderItem[]): string {
  if (items.length === 0) return 'awaiting_vendor'
  const indices = items.map((i) => FULFILLMENT_ORDER.indexOf(i.fulfillmentStatus))
  return FULFILLMENT_ORDER[Math.min(...indices)] ?? 'awaiting_vendor'
}

function formatStatus(s: string) {
  return s.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function getFulfillmentStyle(status: string) {
  switch (status) {
    case 'delivered':   return 'bg-teal-500/20 text-teal-400 border-teal-500/50'
    case 'shipped':     return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
    case 'packed':      return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
    case 'on_hand':     return 'bg-green-500/20 text-green-400 border-green-500/50'
    case 'awaiting_vendor':
    default:            return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
  }
}

// ─── Mark Shipped Modal ────────────────────────────────────────────────────────

interface MarkShippedModalProps {
  orders: AdminOrder[]
  onClose: () => void
  onSuccess: () => void
}

function MarkShippedModal({ orders, onClose, onSuccess }: MarkShippedModalProps) {
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [estimatedDelivery, setEstimatedDelivery] = useState('')
  const [isPartial, setIsPartial] = useState(false)
  const [notes, setNotes] = useState('')
  const [trackingImageFile, setTrackingImageFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isBatch = orders.length > 1
  const title = isBatch
    ? `Ship ${orders.length} Orders`
    : `Mark Shipped — ${orders[0]?.userFullName ?? orders[0]?.userEmail ?? 'Order'}`

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)
    try {
      for (const order of orders) {
        const res = await fetch('/api/admin/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            carrier: carrier || undefined,
            trackingNumber: trackingNumber || undefined,
            estimatedDelivery: estimatedDelivery
              ? new Date(estimatedDelivery).toISOString()
              : undefined,
            isPartial,
            notes: notes || undefined,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Failed to create shipment')
        }

        const shipment = await res.json()

        // Upload tracking image if provided (only for single order or attach to first)
        if (trackingImageFile && !isBatch) {
          const formData = new FormData()
          formData.append('file', trackingImageFile)
          await fetch(`/api/admin/shipments/${shipment.id}/tracking-image`, {
            method: 'POST',
            body: formData,
          })
        }
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md bg-black/90 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Carrier */}
          <div className="space-y-1.5">
            <Label className="text-white/80">Carrier</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select carrier..." />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20" position="popper" sideOffset={4}>
                {CARRIERS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tracking Number */}
          <div className="space-y-1.5">
            <Label className="text-white/80">Tracking Number</Label>
            <Input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="1Z999AA10123456784"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono"
            />
          </div>

          {/* Estimated Delivery */}
          <div className="space-y-1.5">
            <Label className="text-white/80">Estimated Delivery</Label>
            <Input
              type="date"
              value={estimatedDelivery}
              onChange={(e) => setEstimatedDelivery(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          {/* Partial Shipment */}
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
            <Checkbox
              id="partial"
              checked={isPartial}
              onCheckedChange={(v) => setIsPartial(!!v)}
              className="border-white/30"
            />
            <div>
              <label htmlFor="partial" className="text-sm text-white cursor-pointer font-medium">
                Partial Shipment
              </label>
              <p className="text-xs text-white/40">Remaining items will ship separately</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-white/80">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Missing reta-30, ships separately..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
              rows={2}
            />
          </div>

          {/* Tracking Image (single order only) */}
          {!isBatch && (
            <div className="space-y-1.5">
              <Label className="text-white/80">Tracking Image</Label>
              {trackingImageFile ? (
                <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                  <ImageIcon className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm text-white flex-1 truncate">{trackingImageFile.name}</span>
                  <button
                    onClick={() => setTrackingImageFile(null)}
                    className="text-white/40 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 p-3 bg-white/5 border border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                  <ImageIcon className="h-4 w-4 text-white/40" />
                  <span className="text-sm text-white/40">Upload tracking screenshot...</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setTrackingImageFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="border-white/20 text-white hover:bg-white/10">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
          >
            {isSubmitting ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Shipping...</>
            ) : (
              <><Truck className="h-4 w-4 mr-2" />{isBatch ? `Ship ${orders.length} Orders` : 'Mark Shipped'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Mark Delivered Modal ─────────────────────────────────────────────────────

interface MarkDeliveredModalProps {
  shipment: AdminShipment
  onClose: () => void
  onSuccess: () => void
}

function MarkDeliveredModal({ shipment, onClose, onSuccess }: MarkDeliveredModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleConfirm() {
    setIsSubmitting(true)
    try {
      await fetch(`/api/admin/shipments/${shipment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markDelivered: true }),
      })
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm bg-black/90 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Confirm Delivery</DialogTitle>
        </DialogHeader>
        <p className="text-white/60 text-sm py-2">
          Mark this shipment as delivered? This will set the order status to <strong className="text-white">Completed</strong>.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/20 text-white hover:bg-white/10">
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting} className="bg-teal-500 hover:bg-teal-400 text-black font-bold">
            {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-2" />Mark Delivered</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FulfillmentManagement() {
  const [groupBuys, setGroupBuys] = useState<GroupBuySummary[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [shipmentsByOrderId, setShipmentsByOrderId] = useState<Record<string, AdminShipment[]>>({})
  const [selectedGroupBuyId, setSelectedGroupBuyId] = useState<string>('all')
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('all')
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)

  // Modal state
  const [markShippedOrders, setMarkShippedOrders] = useState<AdminOrder[] | null>(null)
  const [markDeliveredShipment, setMarkDeliveredShipment] = useState<AdminShipment | null>(null)

  // ── Fetch group buys ──
  useEffect(() => {
    fetch('/api/admin/group-buys?limit=100')
      .then((r) => r.json())
      .then((data) => {
        if (data.groupBuys) {
          setGroupBuys(
            data.groupBuys.map((gb: { id: string; name: string }) => ({ id: gb.id, name: gb.name })),
          )
        }
      })
      .catch(console.error)
  }, [])

  // ── Fetch orders + shipments ──
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setSelectedOrderIds(new Set())
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (selectedGroupBuyId !== 'all') params.set('groupBuyId', selectedGroupBuyId)

      const [ordersRes, shipmentsRes] = await Promise.all([
        fetch(`/api/admin/orders?${params}`),
        selectedGroupBuyId !== 'all'
          ? fetch(`/api/admin/shipments?groupBuyId=${selectedGroupBuyId}`)
          : fetch('/api/admin/shipments'),
      ])

      const ordersData = await ordersRes.json()
      const shipmentsData = await shipmentsRes.json()

      setOrders(ordersData.orders ?? [])

      const byOrderId: Record<string, AdminShipment[]> = {}
      for (const s of shipmentsData.shipments ?? []) {
        if (!byOrderId[s.orderId]) byOrderId[s.orderId] = []
        byOrderId[s.orderId].push(s)
      }
      setShipmentsByOrderId(byOrderId)
    } catch (err) {
      console.error('FulfillmentManagement fetchData error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedGroupBuyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Filter orders by fulfillment status ──
  const filteredOrders = orders.filter((o) => {
    if (fulfillmentFilter === 'all') return true
    return worstFulfillmentStatus(o.items) === fulfillmentFilter
  })

  // ── Selection helpers ──
  function toggleOrder(orderId: string) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      next.has(orderId) ? next.delete(orderId) : next.add(orderId)
      return next
    })
  }

  function toggleAll() {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)))
    }
  }

  // ── Bulk mark packed ──
  async function handleBulkMarkPacked() {
    if (selectedOrderIds.size === 0) return
    try {
      await fetch('/api/admin/orders/bulk-fulfillment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selectedOrderIds),
          fulfillmentStatus: 'packed',
        }),
      })
      fetchData()
    } catch (err) {
      console.error('bulk mark packed error:', err)
    }
  }

  // ── Batch ship selected ──
  function handleBatchShip() {
    const selectedOrders = filteredOrders.filter((o) => selectedOrderIds.has(o.id))
    if (selectedOrders.length > 0) {
      setMarkShippedOrders(selectedOrders)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Select value={selectedGroupBuyId} onValueChange={setSelectedGroupBuyId}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="All Group Buys" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-white/20" position="popper" sideOffset={4}>
              <SelectItem value="all">All Group Buys</SelectItem>
              {groupBuys.map((gb) => (
                <SelectItem key={gb.id} value={gb.id}>{gb.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-white/20" position="popper" sideOffset={4}>
              <SelectItem value="all">All Statuses</SelectItem>
              {FULFILLMENT_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isLoading}
          className="border-white/20 text-white hover:bg-white/10"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* ── Bulk Action Bar ── */}
      {selectedOrderIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
          <span className="text-sm text-cyan-400 font-medium">
            {selectedOrderIds.size} order{selectedOrderIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkMarkPacked}
              className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
            >
              <Package className="h-4 w-4 mr-1" />
              Mark Packed
            </Button>
            <Button
              size="sm"
              onClick={handleBatchShip}
              className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40"
            >
              <Truck className="h-4 w-4 mr-1" />
              Ship Selected
            </Button>
          </div>
        </div>
      )}

      {/* ── Orders Table ── */}
      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2rem_1fr_1fr_1fr_8rem_8rem] gap-3 px-4 py-3 border-b border-white/10 text-xs text-white/40 font-medium uppercase tracking-wider">
          <div className="flex items-center">
            <Checkbox
              checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
              onCheckedChange={toggleAll}
              className="border-white/20"
            />
          </div>
          <div>Customer</div>
          <div>Items</div>
          <div>Shipments</div>
          <div>Fulfillment</div>
          <div>Actions</div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-white/40">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/40 gap-2">
            <Package className="h-8 w-8" />
            <p>No orders match the current filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredOrders.map((order) => {
              const orderShipments = shipmentsByOrderId[order.id] ?? []
              const worstStatus = worstFulfillmentStatus(order.items)
              const isSelected = selectedOrderIds.has(order.id)
              const isShipped = order.orderStatus === 'shipped' || order.orderStatus === 'completed'

              return (
                <div
                  key={order.id}
                  className={`grid grid-cols-[2rem_1fr_1fr_1fr_8rem_8rem] gap-3 px-4 py-4 items-start transition-colors ${
                    isSelected ? 'bg-cyan-500/5' : 'hover:bg-white/5'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="pt-0.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOrder(order.id)}
                      className="border-white/20"
                    />
                  </div>

                  {/* Customer */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {order.userFullName ?? order.userEmail ?? 'Unknown'}
                    </p>
                    {order.userFullName && (
                      <p className="text-xs text-white/40 truncate">{order.userEmail}</p>
                    )}
                    <p className="text-xs text-cyan-400 font-semibold mt-0.5">${order.totalUsd.toFixed(2)}</p>
                    <p className="text-xs text-white/30">{new Date(order.createdAt).toLocaleDateString()}</p>
                    {order.groupBuyName && (
                      <p className="text-xs text-white/40 mt-0.5 truncate">{order.groupBuyName}</p>
                    )}
                  </div>

                  {/* Items */}
                  <div className="space-y-1">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${getFulfillmentStyle(item.fulfillmentStatus)}`}
                        >
                          {formatStatus(item.fulfillmentStatus)}
                        </Badge>
                        <span className="text-xs text-white/70 truncate">
                          {item.productNameSnapshot} ×{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Shipments */}
                  <div className="space-y-1.5">
                    {orderShipments.length === 0 ? (
                      <p className="text-xs text-white/30">None</p>
                    ) : (
                      orderShipments.map((s) => (
                        <div key={s.id} className="text-xs space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-3 w-3 text-purple-400" />
                            <span className="text-white/70">{s.carrier ?? 'Unknown'}</span>
                            {s.isPartial && (
                              <Badge variant="outline" className="text-[10px] py-0 bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                                Partial
                              </Badge>
                            )}
                          </div>
                          {s.trackingNumber && (
                            <p className="font-mono text-white/50 text-[11px]">{s.trackingNumber}</p>
                          )}
                          {s.trackingUrl && (
                            <a
                              href={s.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                            >
                              Track <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                          {s.trackingImageUrl && (
                            <a
                              href={s.trackingImageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-white/40 hover:text-white"
                            >
                              <ImageIcon className="h-3 w-3" /> Image
                            </a>
                          )}
                          {s.deliveredAt ? (
                            <p className="text-teal-400 text-[11px]">
                              Delivered {new Date(s.deliveredAt).toLocaleDateString()}
                            </p>
                          ) : s.shippedAt ? (
                            <p className="text-white/30 text-[11px]">
                              Shipped {new Date(s.shippedAt).toLocaleDateString()}
                            </p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Overall Fulfillment */}
                  <div>
                    <Badge variant="outline" className={`text-xs ${getFulfillmentStyle(worstStatus)}`}>
                      {formatStatus(worstStatus)}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5">
                    {!isShipped && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMarkShippedOrders([order])}
                        className="text-xs border-purple-500/40 text-purple-400 hover:bg-purple-500/10 h-7 px-2"
                      >
                        <Truck className="h-3 w-3 mr-1" />
                        Ship
                      </Button>
                    )}
                    {orderShipments.length > 0 && !orderShipments[orderShipments.length - 1].deliveredAt && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMarkDeliveredShipment(orderShipments[orderShipments.length - 1])}
                        className="text-xs border-teal-500/40 text-teal-400 hover:bg-teal-500/10 h-7 px-2"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Delivered
                      </Button>
                    )}
                    {isShipped && orderShipments.every((s) => s.deliveredAt) && (
                      <span className="text-xs text-teal-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Complete
                      </span>
                    )}
                    {order.orderStatus === 'processing' || order.orderStatus === 'payment_verified' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await fetch(`/api/admin/orders/${order.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderStatus: 'processing' }),
                          }).catch(console.error)
                        }}
                        className="text-xs border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 h-7 px-2"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Processing
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Summary ── */}
      {!isLoading && filteredOrders.length > 0 && (
        <p className="text-xs text-white/30 text-right">
          {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Modals ── */}
      {markShippedOrders && (
        <MarkShippedModal
          orders={markShippedOrders}
          onClose={() => setMarkShippedOrders(null)}
          onSuccess={() => {
            setMarkShippedOrders(null)
            setSelectedOrderIds(new Set())
            fetchData()
          }}
        />
      )}
      {markDeliveredShipment && (
        <MarkDeliveredModal
          shipment={markDeliveredShipment}
          onClose={() => setMarkDeliveredShipment(null)}
          onSuccess={() => {
            setMarkDeliveredShipment(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
