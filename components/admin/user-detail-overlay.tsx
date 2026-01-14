"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Copy, Check, Edit2, Save, Plus, Minus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { AdminUser } from "@/lib/admin-types"
import type { Order, OrderItem } from "@/lib/types"
import { saveToStorage } from "@/lib/storage"

const AVAILABLE_PRODUCTS = [
  { id: "tirz-30", name: "Tirzepatide 30mg", price: 85 },
  { id: "tirz-60", name: "Tirzepatide 60mg", price: 150 },
  { id: "ss31-50", name: "SS-31 (Elamipretide) 50mg", price: 95 },
  { id: "reta-20", name: "Retatrutide 20mg", price: 75 },
  { id: "reta-30", name: "Retatrutide 30mg", price: 105 },
  { id: "reta-60", name: "Retatrutide 60mg", price: 180 },
  { id: "bpc-157", name: "BPC-157 10mg", price: 45 },
  { id: "tb-500", name: "TB-500 10mg", price: 55 },
]

interface UserDetailOverlayProps {
  user: AdminUser
  orders: Order[]
  onClose: () => void
  onUpdateOrders: (updatedOrders: Order[]) => void
  onUpdateUser?: (updatedUser: AdminUser) => void
}

export function UserDetailOverlay({ user, orders, onClose, onUpdateOrders, onUpdateUser }: UserDetailOverlayProps) {
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [editedOrder, setEditedOrder] = useState<Partial<Order>>({})
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [addingProductToOrderId, setAddingProductToOrderId] = useState<string | null>(null)
  const [newProductId, setNewProductId] = useState("")

  const [editingDiscord, setEditingDiscord] = useState(false)
  const [editingShipping, setEditingShipping] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)

  const [editedDiscord, setEditedDiscord] = useState(user.discordName || "")
  const [editedShipping, setEditedShipping] = useState(
    user.shippingAddress || {
      line1: "",
      line2: "",
      city: "",
      state: "",
      zip: "",
      country: "",
    },
  )
  const [editedNotes, setEditedNotes] = useState(user.notes || "")

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddress(text)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const saveDiscord = () => {
    const updatedUser = { ...user, discordName: editedDiscord }
    saveToStorage("users", [updatedUser])
    onUpdateUser?.(updatedUser)
    setEditingDiscord(false)
  }

  const saveShipping = () => {
    const updatedUser = { ...user, shippingAddress: editedShipping as AdminUser["shippingAddress"] }
    saveToStorage("users", [updatedUser])
    onUpdateUser?.(updatedUser)
    setEditingShipping(false)
  }

  const saveNotes = () => {
    const updatedUser = { ...user, notes: editedNotes }
    saveToStorage("users", [updatedUser])
    onUpdateUser?.(updatedUser)
    setEditingNotes(false)
  }

  const startEditing = (order: Order) => {
    setEditingOrderId(order.id)
    setEditedOrder({ ...order })
  }

  const cancelEditing = () => {
    setEditingOrderId(null)
    setEditedOrder({})
    setAddingProductToOrderId(null)
    setNewProductId("")
  }

  const saveOrder = () => {
    if (!editingOrderId) return

    const updatedItems = editedOrder.items || []
    let newTotalCost = 0
    updatedItems.forEach((item) => {
      if (typeof item !== "string") {
        newTotalCost += item.price * item.quantity
      }
    })

    const updatedOrders = orders.map((order) =>
      order.id === editingOrderId
        ? { ...order, ...editedOrder, totalCost: newTotalCost, lastUpdated: new Date().toISOString() }
        : order,
    )

    saveToStorage("orders", updatedOrders)
    onUpdateOrders(updatedOrders)

    setEditingOrderId(null)
    setEditedOrder({})
    setAddingProductToOrderId(null)
    setNewProductId("")
  }

  const updateProductQuantity = (itemIndex: number, newQuantity: number) => {
    const currentItems = editedOrder.items || []
    if (newQuantity < 1) return

    const updatedItems = currentItems.map((item, idx) => {
      if (idx === itemIndex && typeof item !== "string") {
        return { ...item, quantity: newQuantity }
      }
      return item
    })

    setEditedOrder({ ...editedOrder, items: updatedItems })
  }

  const removeProductFromOrder = (itemIndex: number) => {
    const currentItems = editedOrder.items || []
    const updatedItems = currentItems.filter((_, idx) => idx !== itemIndex)
    setEditedOrder({ ...editedOrder, items: updatedItems })
  }

  const addProductToOrder = () => {
    if (!newProductId) return

    const product = AVAILABLE_PRODUCTS.find((p) => p.id === newProductId)
    if (!product) return

    const currentItems = editedOrder.items || []

    // Check if product already exists in order
    const existingIndex = currentItems.findIndex((item) => typeof item !== "string" && item.productId === product.id)

    let updatedItems: (OrderItem | string)[]
    if (existingIndex >= 0) {
      // Increment quantity if product already exists
      updatedItems = currentItems.map((item, idx) => {
        if (idx === existingIndex && typeof item !== "string") {
          return { ...item, quantity: item.quantity + 1 }
        }
        return item
      })
    } else {
      // Add new product
      const newItem: OrderItem = {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
      }
      updatedItems = [...currentItems, newItem]
    }

    setEditedOrder({ ...editedOrder, items: updatedItems })
    setNewProductId("")
    setAddingProductToOrderId(null)
  }

  const updateProductStatus = (orderId: string, productName: string, newStatus: "Awaiting Vendor" | "On Hand") => {
    const updatedOrders = orders.map((order) => {
      if (order.id === orderId) {
        return {
          ...order,
          productStatuses: {
            ...(order.productStatuses || {}),
            [productName]: newStatus,
          },
        }
      }
      return order
    })

    saveToStorage("orders", updatedOrders)
    onUpdateOrders(updatedOrders)
  }

  const canEditOrder = (order: Order) => order.status !== "Delivered"

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
              <h2 className="text-2xl font-bold text-white">{user.name}</h2>
              <p className="text-gray-400 text-sm mt-1">{user.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-64">
            {/* User Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#FFC700]">User Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">User ID</Label>
                  <p className="text-white font-mono text-sm">{user.id}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Name</Label>
                  <p className="text-white text-sm">{user.name}</p>
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
                  <Badge variant={user.accountStatus === "Active" ? "default" : "secondary"} className="mt-1">
                    {user.accountStatus || "Active"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-gray-400">Total Spent</Label>
                  <p className="text-white text-sm font-semibold">${(user.totalSpent || 0).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Last Login</Label>
                  <p className="text-white text-sm">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>

              {/* Discord Field */}
              <div className="border border-white/10 rounded-lg p-4 bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-gray-400">Discord</Label>
                  {editingDiscord ? (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingDiscord(false)
                          setEditedDiscord(user.discordName || "")
                        }}
                        className="text-gray-400 hover:text-white h-7 px-2"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveDiscord}
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
                      onClick={() => setEditingDiscord(true)}
                      className="text-gray-400 hover:text-white h-7 px-2"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                {editingDiscord ? (
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

              {/* Shipping Address Field */}
              <div className="border border-white/10 rounded-lg p-4 bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-gray-400">Shipping Address</Label>
                  {editingShipping ? (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingShipping(false)
                          setEditedShipping(
                            user.shippingAddress || { line1: "", line2: "", city: "", state: "", zip: "", country: "" },
                          )
                        }}
                        className="text-gray-400 hover:text-white h-7 px-2"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveShipping}
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
                      onClick={() => setEditingShipping(true)}
                      className="text-gray-400 hover:text-white h-7 px-2"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                {editingShipping ? (
                  <div className="space-y-2">
                    <Input
                      value={editedShipping.line1 || ""}
                      onChange={(e) => setEditedShipping({ ...editedShipping, line1: e.target.value })}
                      placeholder="Street address"
                      className="bg-white/10 border-white/20 text-white"
                    />
                    <Input
                      value={editedShipping.line2 || ""}
                      onChange={(e) => setEditedShipping({ ...editedShipping, line2: e.target.value })}
                      placeholder="Apt, suite, etc. (optional)"
                      className="bg-white/10 border-white/20 text-white"
                    />
                    <Input
                      value={editedShipping.city || ""}
                      onChange={(e) => setEditedShipping({ ...editedShipping, city: e.target.value })}
                      placeholder="City"
                      className="bg-white/10 border-white/20 text-white"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={editedShipping.state || ""}
                        onChange={(e) => setEditedShipping({ ...editedShipping, state: e.target.value })}
                        placeholder="State"
                        className="bg-white/10 border-white/20 text-white"
                      />
                      <Input
                        value={editedShipping.zip || ""}
                        onChange={(e) => setEditedShipping({ ...editedShipping, zip: e.target.value })}
                        placeholder="ZIP"
                        className="bg-white/10 border-white/20 text-white"
                      />
                      <Input
                        value={editedShipping.country || ""}
                        onChange={(e) => setEditedShipping({ ...editedShipping, country: e.target.value })}
                        placeholder="Country"
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    {user.shippingAddress?.line1 ? (
                      <>
                        <p className="text-white text-sm">{user.shippingAddress.line1}</p>
                        {user.shippingAddress.line2 && (
                          <p className="text-white text-sm">{user.shippingAddress.line2}</p>
                        )}
                        <p className="text-white text-sm">
                          {user.shippingAddress.city}, {user.shippingAddress.state} {user.shippingAddress.zip}
                        </p>
                        {user.shippingAddress.country && (
                          <p className="text-white text-sm">{user.shippingAddress.country}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm">No shipping address on file</p>
                    )}
                  </div>
                )}
              </div>

              {/* Admin Notes Field */}
              <div className="border border-white/10 rounded-lg p-4 bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-gray-400">Admin Notes</Label>
                  {editingNotes ? (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingNotes(false)
                          setEditedNotes(user.notes || "")
                        }}
                        className="text-gray-400 hover:text-white h-7 px-2"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveNotes}
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
                      onClick={() => setEditingNotes(true)}
                      className="text-gray-400 hover:text-white h-7 px-2"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                {editingNotes ? (
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
              <div>
                <Label className="text-gray-400 mb-2 block">Wallet Addresses ({user.walletAddresses.length})</Label>
                <div className="space-y-2">
                  {user.walletAddresses.map((addr, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-white/5 rounded border border-white/10">
                      <code className="flex-1 text-sm text-white break-all">{addr}</code>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(addr)} className="shrink-0">
                        {copiedAddress === addr ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Purchase History */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#FFC700]">Purchase History ({orders.length})</h3>
              <div className="space-y-4">
                {orders.map((order) => {
                  const isEditing = editingOrderId === order.id
                  const currentOrder = isEditing ? { ...order, ...editedOrder } : order
                  const isEditable = canEditOrder(order)

                  return (
                    <div key={order.id} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
                      {/* Order Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {isEditing ? (
                            <Input
                              value={currentOrder.groupBuyTitle}
                              onChange={(e) => setEditedOrder({ ...editedOrder, groupBuyTitle: e.target.value })}
                              className="bg-white/10 border-white/20 text-white"
                            />
                          ) : (
                            <h4 className="font-semibold text-white">{currentOrder.groupBuyTitle}</h4>
                          )}
                          <p className="text-sm text-gray-400">
                            {currentOrder.submittedAt
                              ? new Date(currentOrder.submittedAt).toLocaleDateString()
                              : "Invalid Date"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={cancelEditing} className="text-gray-400">
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={saveOrder}
                                className="bg-[#FFC700] text-black hover:bg-[#FFC700]/90"
                              >
                                <Save className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                            </>
                          ) : (
                            isEditable && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEditing(order)}
                                className="text-gray-400 hover:text-white"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Status</span>
                          {isEditing ? (
                            <>
                              <style>
                                {`
                                  .edit-purchase-history-status-select option {
                                    color: #000;
                                    background-color: #fff;
                                  }
                                `}
                              </style>
                              <select
                                value={currentOrder.status}
                                onChange={(e) =>
                                  setEditedOrder({
                                    ...editedOrder,
                                    status: e.target.value as "Submitted" | "Delivered",
                                  })
                                }
                                className="edit-purchase-history-status-select mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                              >
                                <option value="Submitted">Submitted</option>
                                <option value="Delivered">Delivered</option>
                              </select>
                            </>
                          ) : (
                            <Badge
                              className={`mt-1 ${currentOrder.status === "Delivered" ? "bg-teal-500" : "bg-green-500"}`}
                            >
                              {currentOrder.status}
                            </Badge>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-400">Total</span>
                          {isEditing ? (
                            <p className="text-white font-semibold">
                              $
                              {(editedOrder.items || [])
                                .reduce((sum, item) => {
                                  if (typeof item !== "string") {
                                    return sum + item.price * item.quantity
                                  }
                                  return sum
                                }, 0)
                                .toFixed(2)}
                            </p>
                          ) : (
                            <p className="text-white font-semibold">
                              ${(currentOrder.totalCost || currentOrder.total || 0).toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-400">Chain</span>
                          <p className="text-white">{currentOrder.chain || "Crypto"}</p>
                        </div>
                      </div>

                      {/* Products - Enhanced with quantity editing */}
                      {currentOrder.items && currentOrder.items.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">Products</span>
                            {isEditing && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAddingProductToOrderId(order.id)}
                                className="text-[#FFC700] hover:text-[#FFC700]/80 h-7 px-2"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add Product
                              </Button>
                            )}
                          </div>

                          {isEditing && addingProductToOrderId === order.id && (
                            <div className="flex items-center gap-2 p-2 bg-[#FFC700]/10 rounded border border-[#FFC700]/30">
                              <style>
                                {`
                                  .add-product-native-select option {
                                    color: #000;
                                    background-color: #fff;
                                  }
                                `}
                              </style>
                              <select
                                value={newProductId}
                                onChange={(e) => setNewProductId(e.target.value)}
                                className="add-product-native-select flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                              >
                                <option value="">Select a product...</option>
                                {AVAILABLE_PRODUCTS.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} - ${p.price}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                onClick={addProductToOrder}
                                disabled={!newProductId}
                                className="bg-[#FFC700] text-black hover:bg-[#FFC700]/90 h-7 px-2"
                              >
                                Add
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setAddingProductToOrderId(null)
                                  setNewProductId("")
                                }}
                                className="text-gray-400 h-7 px-2"
                              >
                                Cancel
                              </Button>
                            </div>
                          )}

                          {(isEditing ? editedOrder.items || currentOrder.items : currentOrder.items).map(
                            (item, idx) => {
                              const itemName = typeof item === "string" ? item : item.name
                              const itemQty = typeof item === "string" ? 1 : item.quantity
                              const itemPrice = typeof item === "string" ? 0 : item.price
                              const productStatus = currentOrder.productStatuses?.[itemName] || "Awaiting Vendor"

                              return (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10"
                                >
                                  <div className="flex-1">
                                    <span className="text-white text-sm">{itemName}</span>
                                    {isEditing && typeof item !== "string" && (
                                      <span className="text-gray-400 text-xs ml-2">(${itemPrice}/ea)</span>
                                    )}
                                  </div>

                                  {isEditing && typeof item !== "string" ? (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => updateProductQuantity(idx, itemQty - 1)}
                                        disabled={itemQty <= 1}
                                        className="h-6 w-6 text-gray-400 hover:text-white"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </Button>
                                      <span className="text-white text-sm w-8 text-center">{itemQty}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => updateProductQuantity(idx, itemQty + 1)}
                                        className="h-6 w-6 text-gray-400 hover:text-white"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeProductFromOrder(idx)}
                                        className="h-6 w-6 text-red-400 hover:text-red-300 ml-2"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-white text-sm mr-2">x{itemQty}</span>
                                      <select
                                        value={productStatus}
                                        onChange={(e) =>
                                          updateProductStatus(
                                            order.id,
                                            itemName,
                                            e.target.value as "Awaiting Vendor" | "On Hand",
                                          )
                                        }
                                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                                      >
                                        <option value="Awaiting Vendor">Awaiting Vendor</option>
                                        <option value="On Hand">On Hand</option>
                                      </select>
                                    </div>
                                  )}
                                </div>
                              )
                            },
                          )}
                        </div>
                      )}

                      {isEditing && (!currentOrder.items || currentOrder.items.length === 0) && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">Products</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAddingProductToOrderId(order.id)}
                              className="text-[#FFC700] hover:text-[#FFC700]/80 h-7 px-2"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Product
                            </Button>
                          </div>
                          <p className="text-gray-500 text-sm">No products in this order</p>
                        </div>
                      )}

                      {/* Transaction Links */}
                      {(currentOrder.allTxUrls || currentOrder.txUrl) && (
                        <div className="space-y-1">
                          <span className="text-gray-400 text-sm">Transactions</span>
                          <div className="flex flex-wrap gap-2">
                            {currentOrder.allTxUrls ? (
                              currentOrder.allTxUrls.map((url, idx) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#FFC700] hover:underline text-sm"
                                >
                                  View TX #{idx + 1}
                                </a>
                              ))
                            ) : (
                              <a
                                href={currentOrder.txUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#FFC700] hover:underline text-sm"
                              >
                                View Transaction
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {!isEditable && (
                        <p className="text-gray-500 text-xs italic">
                          This order has been delivered and cannot be modified.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
