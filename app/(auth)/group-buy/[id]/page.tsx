"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ShoppingCart, Plus, Minus, Clock, Target, AlertCircle, CheckCircle2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { CheckoutOverlay } from "@/components/checkout-overlay"

interface GroupBuyProduct {
  id: string
  name: string
  description: string
  price: number
  regularPrice: number
  currentQuantity: number
  goalQuantity: number
  maxPerUser: number
  inStock: boolean
}

interface GroupBuyDetails {
  id: string
  title: string
  description: string
  image: string
  status: "active" | "ended" | "upcoming"
  endDate: string
  paymentInfo: string
  totalKits: number
  goalKits: number
  products: GroupBuyProduct[]
}

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

// Mock data matching the reference screenshot
const mockGroupBuy: GroupBuyDetails = {
  id: "1",
  title: "SND NEVER DIE Inaugural Group Buy",
  description: "Please read buy info in SND Discord #GB-General-Info",
  image: "/peptide-vial-with-snd-never-die-group-buy-label.jpg",
  status: "active",
  endDate: "2024-02-15",
  paymentInfo: "USDC-ERC20 (Ethereum Network) ONLY",
  totalKits: 847,
  goalKits: 985,
  products: [
    {
      id: "tirz-30",
      name: "Tirzepatide 30",
      description: "High-purity Tirzepatide 30mg vial",
      price: 85.0,
      regularPrice: 120.0,
      currentQuantity: 80,
      goalQuantity: 100,
      maxPerUser: 10,
      inStock: true,
    },
    {
      id: "ss31-50",
      name: "SS-31 (Elamipretide) 50",
      description: "Mitochondrial peptide 50mg",
      price: 95.0,
      regularPrice: 140.0,
      currentQuantity: 50,
      goalQuantity: 80,
      maxPerUser: 5,
      inStock: true,
    },
    {
      id: "reta-20",
      name: "Retatrutide 20",
      description: "Triple agonist peptide 20mg",
      price: 75.0,
      regularPrice: 110.0,
      currentQuantity: 38,
      goalQuantity: 80,
      maxPerUser: 10,
      inStock: true,
    },
    {
      id: "reta-30",
      name: "Retatrutide 30",
      description: "Triple agonist peptide 30mg",
      price: 95.0,
      regularPrice: 135.0,
      currentQuantity: 339,
      goalQuantity: 150,
      maxPerUser: 10,
      inStock: true,
    },
    {
      id: "reta-60",
      name: "Retatrutide 60",
      description: "Triple agonist peptide 60mg",
      price: 165.0,
      regularPrice: 220.0,
      currentQuantity: 13,
      goalQuantity: 50,
      maxPerUser: 5,
      inStock: true,
    },
    {
      id: "bpc-5",
      name: "BPC-157 (5mg)",
      description: "Tissue repair peptide 5mg",
      price: 32.0,
      regularPrice: 45.0,
      currentQuantity: 120,
      goalQuantity: 200,
      maxPerUser: 20,
      inStock: true,
    },
  ],
}

export default function GroupBuyPage() {
  const params = useParams()
  const router = useRouter()
  const [groupBuy] = useState<GroupBuyDetails>(mockGroupBuy)
  const [cart, setCart] = useState<CartItem[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)

  useEffect(() => {
    // Initialize quantities
    const initialQuantities: Record<string, number> = {}
    groupBuy.products.forEach((p) => {
      initialQuantities[p.id] = 0
    })
    setQuantities(initialQuantities)
  }, [groupBuy.products])

  const updateQuantity = (productId: string, delta: number) => {
    const product = groupBuy.products.find((p) => p.id === productId)
    if (!product) return

    setQuantities((prev) => {
      const newQty = Math.max(0, Math.min(product.maxPerUser, (prev[productId] || 0) + delta))
      return { ...prev, [productId]: newQty }
    })
  }

  const setQuantityDirectly = (productId: string, value: string) => {
    const product = groupBuy.products.find((p) => p.id === productId)
    if (!product) return

    const numValue = Number.parseInt(value) || 0
    const clampedValue = Math.max(0, Math.min(product.maxPerUser, numValue))
    setQuantities((prev) => ({ ...prev, [productId]: clampedValue }))
  }

  const addToCart = (product: GroupBuyProduct) => {
    const qty = quantities[product.id] || 0
    if (qty === 0) return

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: Math.min(product.maxPerUser, item.quantity + qty) }
            : item,
        )
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: qty }]
    })

    // Reset quantity input
    setQuantities((prev) => ({ ...prev, [product.id]: 0 }))
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    const product = groupBuy.products.find((p) => p.id === productId)
    if (!product) return

    if (newQuantity <= 0) {
      removeFromCart(productId)
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.productId === productId ? { ...item, quantity: Math.min(product.maxPerUser, newQuantity) } : item,
        ),
      )
    }
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const getProgressColor = (current: number, goal: number) => {
    const percentage = (current / goal) * 100
    if (percentage >= 100) return "bg-green-500"
    if (percentage >= 75) return "bg-yellow-500"
    return "bg-yellow-600"
  }

  const overallProgress = (groupBuy.totalKits / groupBuy.goalKits) * 100

  return (
    <div className="min-h-screen bg-transparent relative">
      <CheckoutOverlay
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        total={cartTotal}
        groupBuyTitle={groupBuy.title}
        groupBuyId={groupBuy.id}
      />

      <div
        className="container mx-auto px-4 py-8 max-w-6xl relative z-10"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 120px, black 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 120px, black 100%)",
        }}
      >
        {/* Header */}
        <div className="pt-32 md:pt-40 mb-6">
          <Link href="/home" className="inline-flex items-center text-yellow-500 hover:text-yellow-400 mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </div>

        {/* Status Banner */}
        {groupBuy.status === "ended" && (
          <Card className="mb-6 bg-red-900/60 backdrop-blur-xl border-red-700/50">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div>
                <p className="font-semibold text-red-100">Campaign Closed</p>
                <p className="text-sm text-red-200/80">
                  This campaign is closed and is no longer accepting contributions.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Group Buy Info Card */}
            <Card className="bg-background/60 backdrop-blur-md border-white/10 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-full md:w-48 h-48 rounded-lg overflow-hidden bg-black/30 border border-white/10">
                      <img
                        src={groupBuy.image || "/placeholder.svg"}
                        alt={groupBuy.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold mb-2">{groupBuy.title}</h1>
                    <p className="text-muted-foreground text-sm mb-2">{groupBuy.paymentInfo}</p>
                    <p className="text-muted-foreground text-sm mb-4">{groupBuy.description}</p>

                    {/* Overall Progress */}
                    <div className="space-y-2">
                      <div className="relative h-3 rounded-full bg-black/30 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${overallProgress >= 100 ? "bg-green-500" : "bg-yellow-500"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, overallProgress)}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xl font-bold ${overallProgress >= 100 ? "text-green-400" : "text-yellow-400"}`}
                        >
                          {groupBuy.totalKits} kits
                        </span>
                        <span className="text-sm text-muted-foreground">of {groupBuy.goalKits} kit goal</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Ends {new Date(groupBuy.endDate).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          {Math.round(overallProgress)}% funded
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products List */}
            <Card className="bg-background/60 backdrop-blur-md border-white/10">
              <CardHeader>
                <CardTitle>Available Products</CardTitle>
                <CardDescription>Select products to add to your order</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AnimatePresence>
                  {groupBuy.products.map((product, index) => {
                    const progressPercent = (product.currentQuantity / product.goalQuantity) * 100
                    const isOverGoal = progressPercent >= 100
                    const qty = quantities[product.id] || 0

                    return (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="border border-white/10 rounded-lg p-4 bg-black/20"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-semibold">{product.name}</h3>
                              <span className={`text-sm ${isOverGoal ? "text-green-400" : "text-muted-foreground"}`}>
                                {product.currentQuantity} / {product.goalQuantity}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{product.description}</p>

                            {/* Product Progress Bar */}
                            <div className="relative h-2 rounded-full bg-black/40 overflow-hidden mb-3">
                              <motion.div
                                className={`h-full rounded-full ${getProgressColor(product.currentQuantity, product.goalQuantity)}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, progressPercent)}%` }}
                                transition={{ duration: 0.8, delay: index * 0.1 }}
                              />
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-yellow-400">${product.price.toFixed(2)}</span>
                              <span className="text-sm text-muted-foreground line-through">
                                ${product.regularPrice.toFixed(2)}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-xs bg-yellow-500/20 text-yellow-200 border-yellow-500/50"
                              >
                                Save {Math.round(((product.regularPrice - product.price) / product.regularPrice) * 100)}
                                %
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 bg-transparent border-white/20"
                                onClick={() => updateQuantity(product.id, -1)}
                                disabled={qty === 0 || groupBuy.status === "ended"}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                value={qty}
                                onChange={(e) => setQuantityDirectly(product.id, e.target.value)}
                                className="w-16 h-8 text-center bg-transparent border-white/20"
                                min={0}
                                max={product.maxPerUser}
                                disabled={groupBuy.status === "ended"}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 bg-transparent border-white/20"
                                onClick={() => updateQuantity(product.id, 1)}
                                disabled={qty >= product.maxPerUser || groupBuy.status === "ended"}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <Button
                              className="bg-yellow-600 hover:bg-yellow-700 text-white"
                              onClick={() => addToCart(product)}
                              disabled={qty === 0 || groupBuy.status === "ended"}
                            >
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              Add
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Max {product.maxPerUser} per user</p>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-32">
              <Card className="bg-background/60 backdrop-blur-md border-white/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Your Cart
                    </CardTitle>
                    {cartItemCount > 0 && <Badge className="bg-yellow-600">{cartItemCount} items</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  {cart.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                      <p className="text-muted-foreground">Your cart is empty</p>
                      <p className="text-xs text-muted-foreground text-center mt-1">Add products to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <AnimatePresence>
                        {cart.map((item) => (
                          <motion.div
                            key={item.productId}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center justify-between border-b border-white/10 pb-3"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm">{item.quantity}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="font-semibold text-sm w-20 text-right">
                              ${(item.price * item.quantity).toFixed(2)}
                            </p>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      <div className="pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-semibold">Total</span>
                          <span className="text-xl font-bold text-yellow-400">${cartTotal.toFixed(2)}</span>
                        </div>
                        <Button
                          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                          size="lg"
                          disabled={groupBuy.status === "ended"}
                          onClick={() => setIsCheckoutOpen(true)}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Proceed to Checkout
                        </Button>
                        <p className="text-xs text-muted-foreground text-center mt-3">{groupBuy.paymentInfo}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
