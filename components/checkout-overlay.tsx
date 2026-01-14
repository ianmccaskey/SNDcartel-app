"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Copy, Check, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { mergeOrCreateOrder } from "@/lib/storage"
import type { Order, OrderItem } from "@/lib/types"

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

interface CheckoutOverlayProps {
  isOpen: boolean
  onClose: () => void
  cart: CartItem[]
  total: number
  groupBuyTitle: string
  groupBuyId: string
}

const paymentOptions = [
  { id: "usdc-eth", label: "USDC (Ethereum)", address: "0x037f355dcF452a88bA72Ffe4B72B33", chain: "Ethereum" },
  { id: "usdc-arb", label: "USDC (Arbitrum)", address: "0x037f355dcF452a88bA72Ffe4B72B33", chain: "Arbitrum" },
  { id: "usdt-eth", label: "USDT (Ethereum)", address: "0x037f355dcF452a88bA72Ffe4B72B33", chain: "Ethereum" },
  { id: "btc", label: "Bitcoin (BTC)", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", chain: "Bitcoin" },
  { id: "eth", label: "Ethereum (ETH)", address: "0x037f355dcF452a88bA72Ffe4B72B33", chain: "Ethereum" },
]

export function CheckoutOverlay({ isOpen, onClose, cart, total, groupBuyTitle, groupBuyId }: CheckoutOverlayProps) {
  const router = useRouter()
  const [selectedPayment, setSelectedPayment] = useState("")
  const [transactionId, setTransactionId] = useState("")
  const [copied, setCopied] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "success" | "error">("idle")

  const selectedPaymentOption = paymentOptions.find((p) => p.id === selectedPayment)

  const copyAddress = async () => {
    if (selectedPaymentOption) {
      await navigator.clipboard.writeText(selectedPaymentOption.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleVerify = async () => {
    if (!transactionId.trim() || !selectedPaymentOption) return

    setVerifying(true)
    setVerificationStatus("idle")

    // Simulate verification process
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Mock result - in production this would check the blockchain
    const success = Math.random() > 0.2
    setVerificationStatus(success ? "success" : "error")
    setVerifying(false)

    if (success) {
      const orderItems: OrderItem[] = cart.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }))

      const newOrder: Order = {
        id: `order-${Date.now()}`,
        groupBuyId, // Added groupBuyId for tracking
        groupBuyTitle,
        totalCost: total,
        txUrl: `https://etherscan.io/tx/${transactionId}`,
        chain: selectedPaymentOption.chain,
        items: orderItems, // Using structured items
        status: "Submitted",
        submittedAt: new Date().toISOString(),
      }

      await mergeOrCreateOrder(newOrder)

      // Redirect to account page after short delay
      setTimeout(() => {
        onClose()
        router.push("/account")
      }, 1500)
    }
  }

  const handleClose = () => {
    setSelectedPayment("")
    setTransactionId("")
    setVerificationStatus("idle")
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
                  <Select value={selectedPayment} onValueChange={setSelectedPayment}>
                    <SelectTrigger className="w-full bg-black/40 border-white/20 h-12 text-white">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent className="checkout-payment-select-content bg-black/90 backdrop-blur-xl border-white/20">
                      {paymentOptions.map((option) => (
                        <SelectItem
                          key={option.id}
                          value={option.id}
                          className="text-white hover:bg-white/10 focus:bg-white/10"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 2: Send Payment */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-white">2. Send Payment</h3>
                  <p className="text-sm text-white/60">
                    Send approx. <span className="text-white font-semibold">${total.toFixed(2)}</span> worth of{" "}
                    <span className="text-white font-semibold">
                      {selectedPaymentOption?.label.split(" ")[0] || "crypto"}
                    </span>{" "}
                    to the address below.
                  </p>
                  <div className="flex items-center gap-2 p-4 bg-black/40 border border-white/20 rounded-lg">
                    <code className="flex-1 text-sm font-mono text-white/90 break-all">
                      {selectedPaymentOption?.address || "Select a payment option first"}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-white/60 hover:text-white hover:bg-white/10"
                      onClick={copyAddress}
                      disabled={!selectedPaymentOption}
                    >
                      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Step 3: Verify Payment */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-white">3. Verify Payment</h3>
                  <p className="text-sm text-white/60">
                    After sending, paste the transaction hash (receipt) from your wallet here.
                  </p>
                  <Textarea
                    placeholder="0x..."
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full bg-black/40 border-white/20 resize-none h-24 font-mono text-sm text-white"
                  />
                </div>

                {/* Verification Status */}
                <AnimatePresence>
                  {verificationStatus !== "idle" && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`flex items-center gap-3 p-4 rounded-lg ${
                        verificationStatus === "success"
                          ? "bg-green-500/20 border border-green-500/50"
                          : "bg-red-500/20 border border-red-500/50"
                      }`}
                    >
                      {verificationStatus === "success" ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                          <div>
                            <p className="font-semibold text-green-400">Payment Verified!</p>
                            <p className="text-sm text-green-300/70">Redirecting to your account...</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-5 w-5 text-red-400" />
                          <div>
                            <p className="font-semibold text-red-400">Verification Failed</p>
                            <p className="text-sm text-red-300/70">
                              Transaction not found. Please check and try again.
                            </p>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Verify Button */}
                <Button
                  className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold"
                  onClick={handleVerify}
                  disabled={!selectedPayment || !transactionId.trim() || verifying || verificationStatus === "success"}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : verificationStatus === "success" ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Redirecting...
                    </>
                  ) : (
                    "Verify My Payment"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
