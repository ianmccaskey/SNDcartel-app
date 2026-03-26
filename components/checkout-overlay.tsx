"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Copy, Check, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react"

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

interface AcceptedPayment {
  id: string
  token: string
  network: string
  walletAddress: string
}

interface CheckoutOverlayProps {
  isOpen: boolean
  onClose: () => void
  cart: CartItem[]
  total: number
  groupBuyTitle: string
  groupBuyId: string
  acceptedPayments: AcceptedPayment[]
}

export function CheckoutOverlay({
  isOpen,
  onClose,
  cart,
  total,
  groupBuyTitle,
  groupBuyId,
  acceptedPayments,
}: CheckoutOverlayProps) {
  const router = useRouter()
  const [selectedPaymentId, setSelectedPaymentId] = useState("")
  const [customerWallet, setCustomerWallet] = useState("")
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pollStatus, setPollStatus] = useState<"idle" | "polling" | "verified" | "error">("idle")

  const selectedPayment = acceptedPayments.find((p) => p.id === selectedPaymentId)

  const copyAddress = async () => {
    if (selectedPayment) {
      await navigator.clipboard.writeText(selectedPayment.walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Poll payment status after order is created
  const pollPaymentStatus = useCallback(async (id: string) => {
    setPollStatus("polling")
    let attempts = 0
    const maxAttempts = 60 // 5 minutes at 5s intervals

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
            onClose()
            router.push("/account")
          }, 2000)
          return
        }

        // Keep polling
        setTimeout(poll, 5000)
      } catch {
        setTimeout(poll, 5000)
      }
    }

    poll()
  }, [onClose, router])

  const handleSubmit = async () => {
    if (!selectedPayment || !customerWallet.trim()) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupBuyId,
          storeOrder: false,
          customerWalletAddress: customerWallet.trim(),
          items: cart.map((item) => ({
            productId: item.productId,
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
    setSelectedPaymentId("")
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
                <div>
                  <h2 className="text-xl font-bold">Total:</h2>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-cyan-400">${total.toFixed(2)}</span>
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
              <div className="p-6 space-y-6">
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
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                          <Clock className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-cyan-400">Order Placed!</p>
                            <p className="text-sm text-white/60">
                              Send your payment and we&apos;ll automatically detect it.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h3 className="font-semibold text-white">Send Payment To:</h3>
                          <div className="flex items-center gap-2 p-4 bg-black/40 border border-white/20 rounded-lg">
                            <code className="flex-1 text-sm font-mono text-white/90 break-all">
                              {selectedPayment?.walletAddress}
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
                            Send exactly <span className="text-white font-semibold">${total.toFixed(2)}</span> in{" "}
                            <span className="text-white font-semibold">{selectedPayment?.token}</span>
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
                    <p className="text-white/70">To complete your pledge, please follow these steps:</p>

                    {/* Step 1: Select Payment */}
                    <div className="checkout-payment-step space-y-3 text-white">
                      <h3 className="font-semibold text-white">1. Select Payment Option</h3>
                      <style jsx>{`
                        .checkout-payment-step {
                          color: white;
                        }
                        .checkout-payment-step h3 {
                          color: white !important;
                        }
                        .checkout-payment-select-content [data-radix-select-item] {
                          color: #ffffff !important;
                          background-color: transparent !important;
                        }
                        .checkout-payment-select-content [data-radix-select-item]:hover,
                        .checkout-payment-select-content [data-radix-select-item][data-highlighted] {
                          background-color: rgba(255, 255, 255, 0.1) !important;
                          color: #ffffff !important;
                        }
                      `}</style>
                      {acceptedPayments.length === 0 ? (
                        <p className="text-sm text-white/50">No payment options configured for this group buy.</p>
                      ) : (
                        <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                          <SelectTrigger className="w-full bg-black/40 border-white/20 h-12 text-white">
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent className="checkout-payment-select-content bg-black/90 backdrop-blur-xl border-white/20">
                            {acceptedPayments.map((option) => (
                              <SelectItem
                                key={option.id}
                                value={option.id}
                                className="text-white hover:bg-white/10 focus:bg-white/10"
                              >
                                {option.token} ({option.network})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Step 2: Enter Your Wallet */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-white">2. Your Sending Wallet Address</h3>
                      <p className="text-sm text-white/60">
                        Enter the wallet address you&apos;ll send from so we can automatically verify your payment.
                      </p>
                      <Input
                        placeholder="0x... or your wallet address"
                        value={customerWallet}
                        onChange={(e) => setCustomerWallet(e.target.value)}
                        className="w-full bg-black/40 border-white/20 font-mono text-sm text-white"
                      />
                    </div>

                    {/* Step 3: Send Payment */}
                    {selectedPayment && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-white">3. Send Payment</h3>
                        <p className="text-sm text-white/60">
                          Send exactly <span className="text-white font-semibold">${total.toFixed(2)}</span> in{" "}
                          <span className="text-white font-semibold">{selectedPayment.token}</span> to:
                        </p>
                        <div className="flex items-center gap-2 p-4 bg-black/40 border border-white/20 rounded-lg">
                          <code className="flex-1 text-sm font-mono text-white/90 break-all">
                            {selectedPayment.walletAddress}
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
                    )}

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
                      className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold"
                      onClick={handleSubmit}
                      disabled={
                        !selectedPaymentId ||
                        !customerWallet.trim() ||
                        submitting ||
                        acceptedPayments.length === 0
                      }
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
