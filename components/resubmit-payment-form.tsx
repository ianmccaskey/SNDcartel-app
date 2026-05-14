"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  orderId: string
  totalUsd: number
  /**
   * "rejected" — admin rejected a prior payment; show the warning palette
   *   and the rejection reason loaded from /payment-status.
   * "pending" — order is still in pending_payment; show as a neutral
   *   "Submit your payment" form for customers whose payments haven't been
   *   auto-matched yet (Alchemy not configured, low-confidence match, etc).
   */
  mode?: "rejected" | "pending"
  /** Called after a successful submit so the parent can refresh order state. */
  onSubmitted?: () => void
}

interface PaymentStatusResponse {
  orderStatus: string
  paymentStatus: string
  latestPayment: {
    id: string
    txHash: string
    status: string
    rejectionReason?: string | null
    createdAt: string
  } | null
}

const NETWORK_OPTIONS = [
  "Ethereum",
  "Solana",
  "Polygon",
  "Base",
  "Arbitrum",
  "Bitcoin",
  "Other",
]

/**
 * Shown inside OrderDetailOverlay when an order is in 'payment_rejected'
 * state. Fetches the most recent rejection reason from the payment-status
 * endpoint and lets the customer submit a new transaction hash. On success
 * the parent should refetch the order list.
 */
export function ResubmitPaymentForm({ orderId, totalUsd, mode = "rejected", onSubmitted }: Props) {
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [reasonLoading, setReasonLoading] = useState(true)

  const [txHash, setTxHash] = useState("")
  const [network, setNetwork] = useState<string>("Ethereum")
  const [fromAddress, setFromAddress] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const fetchReason = useCallback(async () => {
    // Only relevant in 'rejected' mode — for 'pending' there's no prior
    // rejection to display.
    if (mode !== "rejected") {
      setReasonLoading(false)
      return
    }
    setReasonLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/payment-status`)
      if (!res.ok) return
      const data = (await res.json()) as PaymentStatusResponse
      if (data.latestPayment?.status === "rejected") {
        setRejectionReason(data.latestPayment.rejectionReason ?? null)
      }
    } catch {
      // non-fatal — the reason is informational
    } finally {
      setReasonLoading(false)
    }
  }, [mode, orderId])

  useEffect(() => {
    fetchReason()
  }, [fetchReason])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!txHash.trim()) {
      setError("Transaction hash is required")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/submit-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionHash: txHash.trim(),
          blockchainNetwork: network,
          fromWalletAddress: fromAddress.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error ?? "Submission failed")
      }
      setSuccess(true)
      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="border border-green-500/40 bg-green-500/10 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-semibold">Payment submitted</p>
        </div>
        <p className="text-sm text-white/80">
          Your transaction has been recorded and is awaiting verification. You&apos;ll receive
          an email once it&apos;s confirmed.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (typeof window !== "undefined") window.location.reload()
          }}
          className="bg-white/5 border-white/10 hover:bg-white/10"
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          Refresh
        </Button>
      </div>
    )
  }

  const isRejected = mode === "rejected"
  const containerClasses = isRejected
    ? "border border-orange-500/40 bg-orange-500/10 rounded-lg p-4 space-y-4"
    : "border border-cyan-500/30 bg-cyan-500/5 rounded-lg p-4 space-y-4"
  const iconClasses = isRejected
    ? "h-5 w-5 text-orange-300 mt-0.5 shrink-0"
    : "h-5 w-5 text-cyan-300 mt-0.5 shrink-0"
  const titleClasses = isRejected
    ? "text-orange-300 font-semibold"
    : "text-cyan-300 font-semibold"
  const title = isRejected ? "Payment needs attention" : "Submit your payment"
  const bodyText = isRejected ? (
    <>
      Your previous payment couldn&apos;t be verified
      {totalUsd > 0 && (
        <>
          {" "}
          (expected <span className="font-mono">${totalUsd.toFixed(2)}</span>)
        </>
      )}
      . Submit a new transaction hash and we&apos;ll review it again.
    </>
  ) : (
    <>
      Once you&apos;ve sent payment from your wallet, paste the transaction hash
      here so we can record it
      {totalUsd > 0 && (
        <>
          {" "}
          (expected <span className="font-mono">${totalUsd.toFixed(2)}</span>)
        </>
      )}
      .
    </>
  )

  return (
    <div className={containerClasses}>
      <div className="flex items-start gap-2">
        <AlertCircle className={iconClasses} />
        <div className="flex-1">
          <p className={titleClasses}>{title}</p>
          <p className="text-sm text-white/80 mt-1">{bodyText}</p>
          {!reasonLoading && rejectionReason && (
            <p className="text-xs text-white/60 mt-2">
              <span className="font-semibold text-white/80">Reason:</span> {rejectionReason}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="resubmit-txhash" className="text-xs text-white/70">
            Transaction hash
          </Label>
          <Input
            id="resubmit-txhash"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x… (paste from your wallet)"
            disabled={submitting}
            className="bg-black/40 border-white/10 text-white mt-1 font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="resubmit-network" className="text-xs text-white/70">
              Network
            </Label>
            <Select value={network} onValueChange={setNetwork} disabled={submitting}>
              <SelectTrigger
                id="resubmit-network"
                className="bg-black/40 border-white/10 text-white mt-1"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur-md border-white/10 text-white">
                {NETWORK_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="resubmit-from" className="text-xs text-white/70">
              From wallet (optional)
            </Label>
            <Input
              id="resubmit-from"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="0x… or other chain address"
              disabled={submitting}
              className="bg-black/40 border-white/10 text-white mt-1 font-mono text-xs"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <Button
          type="submit"
          disabled={submitting || !txHash.trim()}
          className="w-full bg-[#FFC700] hover:bg-[#E6B300] text-black font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…
            </>
          ) : isRejected ? (
            "Submit new payment"
          ) : (
            "Submit payment"
          )}
        </Button>
      </form>
    </div>
  )
}
