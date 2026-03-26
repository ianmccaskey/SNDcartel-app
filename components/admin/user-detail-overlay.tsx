"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Copy, Check, Edit2, Save, Plus, Minus, Trash2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string
  productId: string | null
  storeProductId: string | null
  quantity: number
  unitPriceUsd: number
  lineTotalUsd: number | null
  productNameSnapshot: string
  fulfillmentStatus: string
}

interface AdminOrder {
  id: string
  groupBuyId: string | null
  groupBuyName: string | null
  storeOrder: boolean
  orderStatus: string
  paymentStatus: string
  subtotalUsd: number
  shippingFeeUsd: number
  adminFeeUsd: number
  totalUsd: number
  adminNotes: string | null
  createdAt: string
  items: OrderItem[]
}

interface AdminUserDetail {
  id: string
  email: string
  fullName: string | null
  discordName: string | null
  phone: string | null
  accountStatus: string
  profileComplete: boolean
  role: string
  shippingAddress: {
    line1: string | null
    line2: string | null
    city: string | null
    state: string | null
    zip: string | null
    country: string | null
  }
  notes: string | null
  createdAt: string
  lastLoginAt: string | null
  wallets: Array<{ id: string; chain: string; address: string; label: string | null }>
  orders: AdminOrder[]
}

interface AvailableProduct {
  id: string
  name: string
  price: number
  groupBuyId: string
  groupBuyName: string
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserDetailOverlayProps {
  userId: string
  onClose: () => void
  onUpdated?: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FULFILLMENT_STATUSES = ["awaiting_vendor", "on_hand", "packed", "shipped", "delivered"]
const ORDER_STATUSES = [
  "pending_payment",
  "payment_submitted",
  "payment_verified",
  "processing",
  "shipped",
  "completed",
  "rejected",
  "cancelled",
]

function orderStatusBadge(status: string) {
  const colors: Record<string, string> = {
    pending_payment: "bg-yellow-500/20 text-yellow-400",
    payment_submitted: "bg-blue-500/20 text-blue-400",
    payment_verified: "bg-teal-500/20 text-teal-400",
    processing: "bg-purple-500/20 text-purple-400",
    shipped: "bg-indigo-500/20 text-indigo-400",
    completed: "bg-green-500/20 text-green-400",
    rejected: "bg-red-500/20 text-red-400",
    cancelled: "bg-gray-500/20 text-gray-400",
  }
  return (
    <Badge className={colors[status] ?? "bg-gray-500/20 text-gray-400"}>
      {status.replace(/_/g, " ")}
    </Badge>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UserDetailOverlay({ userId, onClose, onUpdated }: UserDetailOverlayProps) {
  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([])

  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  // Inline user field editing
  const [editingField, setEditingField] = useState<"discord" | "notes" | null>(null)
  const [editedDiscord, setEditedDiscord] = useState("")
  const [editedNotes, setEditedNotes] = useState("")
  const [savingField, setSavingField] = useState(false)

  // Order editing
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [editingStatus, setEditingStatus] = useState("")
  const [savingOrder, setSavingOrder] = useState(false)

  // Add product to order
  const [addingToOrderId, setAddingToOrderId] = useState<string | null>(null)
  const [newProductId, setNewProductId] = useState("")
  const [addingProduct, setAddingProduct] = useState(false)

  const fetchUser = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (!res.ok) throw new Error("Failed to load user")
      const data: AdminUserDetail = await res.json()
      setUser(data)
      setEditedDiscord(data.discordName ?? "")
      setEditedNotes(data.notes ?? "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [userId])

  const fetchAvailableProducts = useCallback(async () => {
    try {
      // Fetch active group buys and their products for the add-product selector
      const res = await fetch("/api/admin/group-buys")
      if (!res.ok) return
      const campaigns: Array<{ id: string; name: string; status: string; products: Array<{ id: string; peptideName: string; massDosage: string; price: number }> }> = await res.json()
      const active = campaigns.filter((c) => c.status === "active" || c.status === "draft")
      const prods: AvailableProduct[] = []
      for (const gb of active) {
        for (const p of gb.products ?? []) {
          prods.push({
            id: p.id,
            name: `${p.peptideName ?? ""}${p.massDosage ? " " + p.massDosage : ""}`.trim() || "Product",
            price: p.price,
            groupBuyId: gb.id,
            groupBuyName: gb.name,
          })
        }
      }
      setAvailableProducts(prods)
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    fetchUser()
    fetchAvailableProducts()
  }, [fetchUser, fetchAvailableProducts])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddress(text)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  // Save user field (discord or notes)
  const saveUserField = async (field: "discord" | "notes") => {
    if (!user) return
    setSavingField(true)
    try {
      const body: Record<string, string> = {}
      if (field === "discord") body.discordName = editedDiscord
      if (field === "notes") body.notes = editedNotes
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Save failed")
      const updated = await res.json()
      setUser((u) =>
        u
          ? {
              ...u,
              discordName: updated.discordName ?? u.discordName,
              notes: updated.notes ?? u.notes,
            }
          : u,
      )
      setEditingField(null)
      onUpdated?.()
    } catch {
      // keep editing state on failure
    } finally {
      setSavingField(false)
    }
  }

  // Update order status
  const saveOrderStatus = async (orderId: string) => {
    setSavingOrder(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus: editingStatus }),
      })
      if (!res.ok) throw new Error("Save failed")
      setUser((u) =>
        u
          ? {
              ...u,
              orders: u.orders.map((o) =>
                o.id === orderId ? { ...o, orderStatus: editingStatus } : o,
              ),
            }
          : u,
      )
      setEditingOrderId(null)
    } catch {
      // keep editing
    } finally {
      setSavingOrder(false)
    }
  }

  // Update item fulfillment status
  const updateFulfillmentStatus = async (orderId: string, itemId: string, fulfillmentStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillmentStatus }),
      })
      if (!res.ok) return
      setUser((u) =>
        u
          ? {
              ...u,
              orders: u.orders.map((o) =>
                o.id === orderId
                  ? {
                      ...o,
                      items: o.items.map((item) =>
                        item.id === itemId ? { ...item, fulfillmentStatus } : item,
                      ),
                    }
                  : o,
              ),
            }
          : u,
      )
    } catch {
      // non-fatal
    }
  }

  // Update item quantity
  const updateItemQuantity = async (orderId: string, itemId: string, quantity: number) => {
    if (quantity < 1) return
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      })
      if (!res.ok) return
      setUser((u) =>
        u
          ? {
              ...u,
              orders: u.orders.map((o) =>
                o.id === orderId
                  ? {
                      ...o,
                      items: o.items.map((item) =>
                        item.id === itemId ? { ...item, quantity } : item,
                      ),
                    }
                  : o,
              ),
            }
          : u,
      )
    } catch {
      // non-fatal
    }
  }

  // Remove item from order
  const removeItem = async (orderId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}`, { method: "DELETE" })
      if (!res.ok) return
      setUser((u) =>
        u
          ? {
              ...u,
              orders: u.orders.map((o) =>
                o.id === orderId ? { ...o, items: o.items.filter((item) => item.id !== itemId) } : o,
              ),
            }
          : u,
      )
    } catch {
      // non-fatal
    }
  }

  // Add product to order
  const addProduct = async (orderId: string) => {
    if (!newProductId) return
    const product = availableProducts.find((p) => p.id === newProductId)
    if (!product) return
    setAddingProduct(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
          unitPriceUsd: product.price,
          productNameSnapshot: product.name,
        }),
      })
      if (!res.ok) return
      const newItem: OrderItem = await res.json()
      setUser((u) =>
        u
          ? {
              ...u,
              orders: u.orders.map((o) =>
                o.id === orderId ? { ...o, items: [...o.items, newItem] } : o,
              ),
            }
          : u,
      )
      setNewProductId("")
      setAddingToOrderId(null)
    } catch {
      // non-fatal
    } finally {
      setAddingProduct(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div>
              {user ? (
                <>
                  <h2 className="text-2xl font-bold text-white">{user.fullName ?? user.email}</h2>
                  <p className="text-gray-400 text-sm mt-1">{user.email}</p>
                </>
              ) : (
                <h2 className="text-2xl font-bold text-white">Loading...</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchUser}
                disabled={loading}
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-64">
            {loading && !user ? (
              <p className="text-muted-foreground text-center py-8">Loading user data...</p>
            ) : error ? (
              <p className="text-red-400 text-center py-8">{error}</p>
            ) : user ? (
              <>
                {/* User Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[#FFC700]">User Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400">User ID</Label>
                      <p className="text-white font-mono text-xs">{user.id}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Name</Label>
                      <p className="text-white text-sm">{user.fullName ?? "—"}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Email</Label>
                      <p className="text-white text-sm">{user.email}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Member Since</Label>
                      <p className="text-white text-sm">{new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Account Status</Label>
                      <Badge
                        className={`mt-1 ${
                          user.accountStatus === "active"
                            ? "bg-green-500/20 text-green-400"
                            : user.accountStatus === "suspended"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {user.accountStatus}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-gray-400">Last Login</Label>
                      <p className="text-white text-sm">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Profile Complete</Label>
                      <Badge className={`mt-1 ${user.profileComplete ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        {user.profileComplete ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-gray-400">Role</Label>
                      <p className="text-white text-sm capitalize">{user.role}</p>
                    </div>
                  </div>

                  {/* Discord Field */}
                  <div className="border border-white/10 rounded-lg p-4 bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-gray-400">Discord</Label>
                      {editingField === "discord" ? (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingField(null); setEditedDiscord(user.discordName ?? "") }}
                            className="text-gray-400 hover:text-white h-7 px-2"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveUserField("discord")}
                            disabled={savingField}
                            className="bg-[#FFC700] text-black hover:bg-[#FFC700]/90 h-7 px-2"
                          >
                            <Save className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingField("discord")}
                          className="text-gray-400 hover:text-white h-7 px-2"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                    {editingField === "discord" ? (
                      <Input
                        value={editedDiscord}
                        onChange={(e) => setEditedDiscord(e.target.value)}
                        placeholder="Discord username"
                        className="bg-white/10 border-white/20 text-white"
                      />
                    ) : (
                      <p className="text-white text-sm">{user.discordName || "—"}</p>
                    )}
                  </div>

                  {/* Shipping Address */}
                  <div className="border border-white/10 rounded-lg p-4 bg-white/5">
                    <Label className="text-gray-400 mb-2 block">Shipping Address</Label>
                    {user.shippingAddress?.line1 ? (
                      <div className="text-white text-sm space-y-0.5">
                        <p>{user.shippingAddress.line1}</p>
                        {user.shippingAddress.line2 && <p>{user.shippingAddress.line2}</p>}
                        <p>
                          {user.shippingAddress.city}, {user.shippingAddress.state}{" "}
                          {user.shippingAddress.zip}
                        </p>
                        {user.shippingAddress.country && <p>{user.shippingAddress.country}</p>}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No shipping address on file</p>
                    )}
                  </div>

                  {/* Admin Notes Field */}
                  <div className="border border-white/10 rounded-lg p-4 bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-gray-400">Admin Notes</Label>
                      {editingField === "notes" ? (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingField(null); setEditedNotes(user.notes ?? "") }}
                            className="text-gray-400 hover:text-white h-7 px-2"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveUserField("notes")}
                            disabled={savingField}
                            className="bg-[#FFC700] text-black hover:bg-[#FFC700]/90 h-7 px-2"
                          >
                            <Save className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingField("notes")}
                          className="text-gray-400 hover:text-white h-7 px-2"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                    {editingField === "notes" ? (
                      <textarea
                        value={editedNotes}
                        onChange={(e) => setEditedNotes(e.target.value)}
                        placeholder="Add admin notes..."
                        className="w-full p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
                        rows={3}
                      />
                    ) : (
                      <p className="text-white text-sm">{user.notes || "—"}</p>
                    )}
                  </div>

                  {/* Wallet Addresses */}
                  {user.wallets.length > 0 && (
                    <div>
                      <Label className="text-gray-400 mb-2 block">
                        Wallet Addresses ({user.wallets.length})
                      </Label>
                      <div className="space-y-2">
                        {user.wallets.map((wallet) => (
                          <div
                            key={wallet.id}
                            className="flex items-center gap-2 p-2 bg-white/5 rounded border border-white/10"
                          >
                            <Badge variant="secondary" className="shrink-0 text-xs">{wallet.chain}</Badge>
                            <code className="flex-1 text-sm text-white break-all">{wallet.address}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(wallet.address)}
                              className="shrink-0"
                            >
                              {copiedAddress === wallet.address ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Purchase History */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[#FFC700]">
                    Purchase History ({user.orders.length})
                  </h3>
                  {user.orders.length === 0 ? (
                    <p className="text-gray-500 text-sm">No orders yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {user.orders.map((order) => {
                        const isEditingStatus = editingOrderId === order.id
                        return (
                          <div key={order.id} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
                            {/* Order Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-white">
                                  {order.storeOrder ? "Store Purchase" : (order.groupBuyName ?? "Group Buy")}
                                </h4>
                                <p className="text-sm text-gray-400">
                                  {new Date(order.createdAt).toLocaleDateString()}
                                </p>
                                <p className="text-xs font-mono text-gray-500 mt-0.5">{order.id}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isEditingStatus ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingOrderId(null)}
                                      className="text-gray-400 h-7"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => saveOrderStatus(order.id)}
                                      disabled={savingOrder}
                                      className="bg-[#FFC700] text-black hover:bg-[#FFC700]/90 h-7 px-2"
                                    >
                                      <Save className="w-3 h-3 mr-1" />
                                      Save
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingOrderId(order.id)
                                      setEditingStatus(order.orderStatus)
                                    }}
                                    className="text-gray-400 hover:text-white"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Order Details */}
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-400 block">Status</span>
                                {isEditingStatus ? (
                                  <select
                                    value={editingStatus}
                                    onChange={(e) => setEditingStatus(e.target.value)}
                                    className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                                    style={{ colorScheme: "dark" }}
                                  >
                                    {ORDER_STATUSES.map((s) => (
                                      <option key={s} value={s} style={{ background: "#1a1a1a" }}>
                                        {s.replace(/_/g, " ")}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="mt-1">{orderStatusBadge(order.orderStatus)}</div>
                                )}
                              </div>
                              <div>
                                <span className="text-gray-400 block">Total</span>
                                <p className="text-white font-semibold mt-1">${order.totalUsd.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-gray-400 block">Payment</span>
                                <p className="text-white mt-1">{order.paymentStatus}</p>
                              </div>
                            </div>

                            {/* Products */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400 text-sm">Products</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setAddingToOrderId(order.id)
                                    setNewProductId("")
                                  }}
                                  className="text-[#FFC700] hover:text-[#FFC700]/80 h-7 px-2"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add Product
                                </Button>
                              </div>

                              {addingToOrderId === order.id && (
                                <div className="flex items-center gap-2 p-2 bg-[#FFC700]/10 rounded border border-[#FFC700]/30">
                                  <select
                                    value={newProductId}
                                    onChange={(e) => setNewProductId(e.target.value)}
                                    className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                                    style={{ colorScheme: "dark" }}
                                  >
                                    <option value="">Select a product...</option>
                                    {availableProducts.length === 0 && (
                                      <option disabled>No active group buy products</option>
                                    )}
                                    {availableProducts.map((p) => (
                                      <option key={p.id} value={p.id} style={{ background: "#1a1a1a" }}>
                                        {p.name} — ${p.price} ({p.groupBuyName})
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    size="sm"
                                    onClick={() => addProduct(order.id)}
                                    disabled={!newProductId || addingProduct}
                                    className="bg-[#FFC700] text-black hover:bg-[#FFC700]/90 h-7 px-2"
                                  >
                                    Add
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setAddingToOrderId(null)}
                                    className="text-gray-400 h-7 px-2"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}

                              {order.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10"
                                >
                                  <div className="flex-1">
                                    <span className="text-white text-sm">{item.productNameSnapshot}</span>
                                    <span className="text-gray-400 text-xs ml-2">(${item.unitPriceUsd}/ea)</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => updateItemQuantity(order.id, item.id, item.quantity - 1)}
                                      disabled={item.quantity <= 1}
                                      className="h-6 w-6 text-gray-400 hover:text-white"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </Button>
                                    <span className="text-white text-sm w-6 text-center">{item.quantity}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => updateItemQuantity(order.id, item.id, item.quantity + 1)}
                                      className="h-6 w-6 text-gray-400 hover:text-white"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                    <select
                                      value={item.fulfillmentStatus}
                                      onChange={(e) =>
                                        updateFulfillmentStatus(order.id, item.id, e.target.value)
                                      }
                                      className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
                                      style={{ colorScheme: "dark" }}
                                    >
                                      {FULFILLMENT_STATUSES.map((s) => (
                                        <option key={s} value={s} style={{ background: "#1a1a1a" }}>
                                          {s.replace(/_/g, " ")}
                                        </option>
                                      ))}
                                    </select>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeItem(order.id, item.id)}
                                      className="h-6 w-6 text-red-400 hover:text-red-300 ml-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}

                              {order.items.length === 0 && (
                                <p className="text-gray-500 text-xs">No items in this order.</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
