"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Copy, Check, Loader2, AlertCircle, CheckCircle2, Clock, Trash2, Minus, Plus } from "lucide-react"

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

interface StoreCheckoutOverlayProps {
  isOpen: boolean
  onClose: () => void
  cartItems: CartItem[]
  onCartUpdate: (items: CartItem[]) => void
}

// Store orders use a fixed USDC/ETH wallet configured in env
const STORE_WALLET_ADDRESS = process.env.NEXT_PUBLIC_STORE_WALLET_ADDRESS ?? "Contact admin for payment address"
const STORE_TOKEN = "USDC (Ethereum)"

export function StoreCheckoutOverlay({ isOpen, onClose, cartItems, onCartUpdate }: StoreCheckoutOverlayProps) {
  const router = useRouter()
  const [customerWallet, setCustomerWallet] = useState("")
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pollStatus, setPollStatus] = useState<"idle" | "polling" | "verified">("idle")

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const copyAddress = async () => {
    await navigator.clipboard.writeText(STORE_WALLET_ADDRESS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updateItemQuantity = (productId: string, quantity: number) => {
    const updated = cartItems.map((item) =>
      item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item,
    )
    onCartUpdate(updated)
  }

  const removeItem = (productId: string) => {
    onCartUpdate(cartItems.filter((item) => item.productId !== productId))
  }

  const pollPaymentStatus = useCallback(
    async (id: string) => {
      setPollStatus("polling")
      let attempts = 0
      const maxAttempts = 60

      const poll = async () => {
        if (attempts >= maxAttempts) {
          setPollStatus("idle")
          return
        }
        attempts++

        try {
          const res = await fetch(`/api/orders/${id}/payment-status`)
          if (!res.ok) return
          const data = await res.json()

          if (data.paymentStatus === "verified" || data.orderStatus === "payment_verified") {
            setPollStatus("verified")
            setTimeout(() => {
              onCartUpdate([])
              onClose()
              router.push("/account")
            }, 2000)
            return
          }

          setTimeout(poll, 5000)
        } catch {
          setTimeout(poll, 5000)
        }
      }

      poll()
    },
    [onCartUpdate, onClose, router],
  )

  const handleSubmit = async () => {
    if (!customerWallet.trim()) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeOrder: true,
          customerWalletAddress: customerWallet.trim(),
          items: cartItems.map((item) => ({
            storeProductId: item.productId,
            quantity: item.quantity,
            unitPriceUsd: item.price,
            productNameSnapshot: item.name,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to place order.")
        return
      }

      setOrderId(data.id)
      pollPaymentStatus(data.id)
    } catch {
      setSubmitError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setCustomerWallet("")
    setSubmitError(null)
    setPollStatus("idle")
    setOrderId(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={handleClose}
          />

          {/* Overlay Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md z-[201] overflow-auto"
          >
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-bold">Checkout</h2>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-yellow-400">${total.toFixed(2)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white/60 hover:text-white hover:bg-white/10"
                    onClick={handleClose}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {orderId ? (
                  /* Post-order: payment instructions + polling */
                  <div className="space-y-6">
                    {pollStatus === "verified" ? (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-4 rounded-lg bg-green-500/20 border border-green-500/50"
                      >
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                        <div>
                          <p className="font-semibold text-green-400">Payment Verified!</p>
                          <p className="text-sm text-green-300/70">Redirecting to your account...</p>
                        </div>
                      </motion.div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                          <Clock className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-yellow-400">Order Placed!</p>
                            <p className="text-sm text-white/60">
                              Send your payment and we&apos;ll automatically detect it.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h3 className="font-semibold text-white">
                            Send {STORE_TOKEN} To:
                          </h3>
                          <div className="flex items-center gap-2 p-4 bg-black/40 border border-white/20 rounded-lg">
                            <code className="flex-1 text-sm font-mono text-white/90 break-all">
                              {STORE_WALLET_ADDRESS}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="flex-shrink-0 text-white/60 hover:text-white hover:bg-white/10"
                              onClick={copyAddress}
                            >
                              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                          <p className="text-sm text-white/60">
                            Amount:{" "}
                            <span className="text-white font-semibold">${total.toFixed(2)}</span>
                          </p>
                        </div>

                        {pollStatus === "polling" && (
                          <div className="flex items-center gap-2 text-sm text-white/50">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Waiting for payment detection...
                          </div>
                        )}

                        <Button
                          variant="ghost"
                          className="w-full text-white/60 hover:text-white"
                          onClick={() => {
                            onCartUpdate([])
                            onClose()
                            router.push("/account")
                          }}
                        >
                          I&apos;ll pay later — go to my account
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  /* Pre-order form */
                  <>
                    <button
                      onClick={handleClose}
                      className="text-yellow-400 hover:text-yellow-300 text-sm font-medium underline"
                    >
                      ← Continue Shopping
                    </button>

                    {/* Cart Items */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-white">Order Summary</h3>
                      <div className="space-y-2 bg-black/40 rounded-lg p-3 border border-white/10">
                        {cartItems.map((item) => (
                          <div
                            key={item.productId}
                            className="flex items-center justify-between text-white/80 text-sm"
                          >
                            <div className="flex-1">
                              <p className="text-white">{item.name}</p>
                              <p>${item.price.toFixed(2)} each</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}
                                className="p-1 hover:bg-white/10 rounded"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}
                                className="p-1 hover:bg-white/10 rounded"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => removeItem(item.productId)}
                                className="p-1 hover:bg-red-500/20 rounded ml-2"
                              >
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-white/70">To complete your purchase, please follow these steps:</p>

                    {/* Step 1: Your wallet */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-white">1. Your Sending Wallet Address</h3>
                      <p className="text-sm text-white/60">
                        Enter the wallet you&apos;ll send from so we can automatically verify your payment.
                      </p>
                      <Input
                        placeholder="0x... or your wallet address"
                        value={customerWallet}
                        onChange={(e) => setCustomerWallet(e.target.value)}
                        className="w-full bg-black/40 border-white/20 font-mono text-sm text-white"
                      />
                    </div>

                    {/* Step 2: Send Payment */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-white">2. Send Payment</h3>
                      <p className="text-sm text-white/60">
                        Send exactly <span className="text-white font-semibold">${total.toFixed(2)}</span> in{" "}
                        <span className="text-white font-semibold">{STORE_TOKEN}</span> to:
                      </p>
                      <div className="flex items-center gap-2 p-4 bg-black/40 border border-white/20 rounded-lg">
                        <code className="flex-1 text-sm font-mono text-white/90 break-all">
                          {STORE_WALLET_ADDRESS}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 text-white/60 hover:text-white hover:bg-white/10"
                          onClick={copyAddress}
                        >
                          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                      {submitError && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-center gap-3 p-4 rounded-lg bg-red-500/20 border border-red-500/50"
                        >
                          <AlertCircle className="h-5 w-5 text-red-400" />
                          <p className="text-sm text-red-300">{submitError}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Place Order Button */}
                    <Button
                      className="w-full h-12 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold"
                      onClick={handleSubmit}
                      disabled={!customerWallet.trim() || submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Placing Order...
                        </>
                      ) : (
                        "Place Order & Get Payment Instructions"
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
