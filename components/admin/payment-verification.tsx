"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CheckCircle, XCircle, ExternalLink, AlertTriangle, RefreshCw } from "lucide-react"

interface PaymentRow {
  id: string
  orderId: string
  userId: string
  userEmail: string | null
  userFullName: string | null
  groupBuyName: string | null
  txHash: string
  blockchainNetwork: string
  fromWalletAddress: string | null
  customerWalletAddress: string | null
  amountSubmittedUsd: number | null
  amountExpectedUsd: number
  tokenSymbol: string
  explorerUrl: string
  withinTolerance: boolean | null
  status: string
  rejectionReason: string | null
  adminNotes: string | null
  reviewedAt: string | null
  createdAt: string
  orderStatus: string | null
  orderTotalUsd: number | null
  alchemyMatch?: {
    matchConfidence: number | null
    matchReasons: string[] | null
    valueUsd: number | null
    fromAddress: string
    network: string
  } | null
}

type FilterStatus = "pending" | "approved" | "rejected" | "all"

function toleranceBadge(payment: PaymentRow) {
  if (payment.amountSubmittedUsd === null) {
    return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">No amount</Badge>
  }
  const expected = payment.amountExpectedUsd
  const submitted = payment.amountSubmittedUsd
  const diff = Math.abs(submitted - expected)
  const pct = (diff / expected) * 100

  if (pct <= 1) {
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
        ✓ Exact ({submitted.toFixed(2)})
      </Badge>
    )
  } else if (pct <= 5) {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        ~ Within 5% ({submitted.toFixed(2)})
      </Badge>
    )
  } else {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        ✗ Off by {pct.toFixed(1)}% ({submitted.toFixed(2)})
      </Badge>
    )
  }
}

function confidenceBadge(score: number | null) {
  if (score === null) return null
  if (score >= 80) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{score}% match</Badge>
  if (score >= 50) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{score}% match</Badge>
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{score}% match</Badge>
}

function statusBadge(status: string) {
  if (status === "approved") return <Badge className="bg-green-500/20 text-green-400">Approved</Badge>
  if (status === "rejected") return <Badge className="bg-red-500/20 text-red-400">Rejected</Badge>
  return <Badge className="bg-yellow-500/20 text-yellow-400">Pending</Badge>
}

export function PaymentVerification() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [filter, setFilter] = useState<FilterStatus>("pending")
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [actionNotes, setActionNotes] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/payments?status=${filter}&limit=100`)
      if (!res.ok) throw new Error("Failed to fetch payments")
      const data = await res.json()
      setPayments(data.payments)
      setTotal(data.pagination.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const openDetail = async (payment: PaymentRow) => {
    setSelectedPayment(payment)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}`)
      if (res.ok) {
        const detail = await res.json()
        setSelectedPayment(detail)
      }
    } catch {
      // keep existing data
    } finally {
      setDetailLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedPayment) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/payments/${selectedPayment.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: actionNotes || undefined }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Approval failed")
      }
      setApproveDialogOpen(false)
      setSelectedPayment(null)
      setActionNotes("")
      fetchPayments()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedPayment || !rejectReason.trim()) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/payments/${selectedPayment.id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason, adminNotes: actionNotes || undefined }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Rejection failed")
      }
      setRejectDialogOpen(false)
      setSelectedPayment(null)
      setRejectReason("")
      setActionNotes("")
      fetchPayments()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-background/60 backdrop-blur-md border-white/10">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Payment Verification</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-white/10 overflow-hidden">
                {(["pending", "approved", "rejected", "all"] as FilterStatus[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 text-sm capitalize transition-colors ${
                      filter === f
                        ? "bg-[#FFC700] text-black font-medium"
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchPayments}
                disabled={loading}
                className="text-muted-foreground hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            {total} payment{total !== 1 ? "s" : ""} — {filter === "all" ? "all statuses" : filter}
          </p>
        </CardHeader>
        <CardContent>
          {loading && payments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading payments...</p>
          ) : payments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No {filter === "all" ? "" : filter} payments found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order / User</TableHead>
                  <TableHead>TX Hash</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Tolerance</TableHead>
                  <TableHead>Alchemy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className="cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => openDetail(payment)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-mono text-xs text-white">{payment.orderId.slice(0, 8)}…</p>
                        <p className="text-xs text-muted-foreground">{payment.userEmail ?? "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-xs text-white">
                          {payment.txHash.slice(0, 10)}…
                        </code>
                        <a
                          href={payment.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#FFC700] hover:text-[#FFC700]/80"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{payment.blockchainNetwork}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-white">
                        ${payment.amountExpectedUsd.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>{toleranceBadge(payment)}</TableCell>
                    <TableCell>
                      {payment.alchemyMatch
                        ? confidenceBadge(payment.alchemyMatch.matchConfidence)
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>{statusBadge(payment.status)}</TableCell>
                    <TableCell>
                      {payment.status === "pending" && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-500 text-white h-7 px-2"
                            onClick={() => {
                              setSelectedPayment(payment)
                              setActionNotes("")
                              setActionError(null)
                              setApproveDialogOpen(true)
                            }}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2"
                            onClick={() => {
                              setSelectedPayment(payment)
                              setRejectReason("")
                              setActionNotes("")
                              setActionError(null)
                              setRejectDialogOpen(true)
                            }}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Detail Panel */}
      {selectedPayment && !approveDialogOpen && !rejectDialogOpen && (
        <Card className="bg-background/60 backdrop-blur-md border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Payment Detail</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPayment(null)}
                className="text-muted-foreground hover:text-white"
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailLoading ? (
              <p className="text-muted-foreground text-sm">Loading detail...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-gray-400">Payment ID</Label>
                  <p className="font-mono text-xs text-white">{selectedPayment.id}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Order ID</Label>
                  <p className="font-mono text-xs text-white">{selectedPayment.orderId}</p>
                </div>
                <div>
                  <Label className="text-gray-400">User</Label>
                  <p className="text-white">{selectedPayment.userFullName ?? selectedPayment.userEmail ?? "—"}</p>
                  <p className="text-muted-foreground text-xs">{selectedPayment.userEmail}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Group Buy</Label>
                  <p className="text-white">{selectedPayment.groupBuyName ?? "Store Order"}</p>
                </div>
                <div>
                  <Label className="text-gray-400">TX Hash</Label>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-white break-all">{selectedPayment.txHash}</code>
                    <a
                      href={selectedPayment.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FFC700] hover:text-[#FFC700]/80 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400">Network / Token</Label>
                  <p className="text-white">{selectedPayment.blockchainNetwork} · {selectedPayment.tokenSymbol}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Amount Expected</Label>
                  <p className="text-white font-semibold">${selectedPayment.amountExpectedUsd.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-gray-400">Amount Submitted</Label>
                  <div>{toleranceBadge(selectedPayment)}</div>
                </div>
                <div>
                  <Label className="text-gray-400">From Wallet</Label>
                  <code className="text-xs text-white">{selectedPayment.fromWalletAddress ?? "—"}</code>
                </div>
                <div>
                  <Label className="text-gray-400">Customer Wallet</Label>
                  <code className="text-xs text-white">{selectedPayment.customerWalletAddress ?? "—"}</code>
                </div>
                {selectedPayment.alchemyMatch && (
                  <>
                    <div className="col-span-2">
                      <Label className="text-gray-400 mb-1 block">Alchemy Match</Label>
                      <div className="p-3 bg-white/5 rounded border border-white/10 space-y-1">
                        <div className="flex items-center gap-2">
                          {confidenceBadge(selectedPayment.alchemyMatch.matchConfidence)}
                          {selectedPayment.alchemyMatch.valueUsd !== null && (
                            <span className="text-xs text-muted-foreground">
                              On-chain: ${selectedPayment.alchemyMatch.valueUsd.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {selectedPayment.alchemyMatch.matchReasons && selectedPayment.alchemyMatch.matchReasons.length > 0 && (
                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                            {selectedPayment.alchemyMatch.matchReasons.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <Label className="text-gray-400">Status</Label>
                  <div className="mt-1">{statusBadge(selectedPayment.status)}</div>
                </div>
                {selectedPayment.rejectionReason && (
                  <div>
                    <Label className="text-gray-400">Rejection Reason</Label>
                    <p className="text-red-400 text-sm">{selectedPayment.rejectionReason}</p>
                  </div>
                )}
                {selectedPayment.adminNotes && (
                  <div className="col-span-2">
                    <Label className="text-gray-400">Admin Notes</Label>
                    <p className="text-white text-sm">{selectedPayment.adminNotes}</p>
                  </div>
                )}
                <div>
                  <Label className="text-gray-400">Submitted</Label>
                  <p className="text-white text-sm">{new Date(selectedPayment.createdAt).toLocaleString()}</p>
                </div>
                {selectedPayment.reviewedAt && (
                  <div>
                    <Label className="text-gray-400">Reviewed</Label>
                    <p className="text-white text-sm">{new Date(selectedPayment.reviewedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
            {selectedPayment.status === "pending" && !detailLoading && (
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <Button
                  className="bg-green-600 hover:bg-green-500 text-white"
                  onClick={() => {
                    setActionNotes("")
                    setActionError(null)
                    setApproveDialogOpen(true)
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Payment
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setRejectReason("")
                    setActionNotes("")
                    setActionError(null)
                    setRejectDialogOpen(true)
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Payment
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="bg-black/95 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Approve Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-sm text-green-400">
              This will mark the payment as approved and update the order status to{" "}
              <strong>payment_verified</strong>.
            </div>
            {selectedPayment && (
              <div className="text-sm text-muted-foreground">
                Order: <span className="font-mono text-white">{selectedPayment.orderId.slice(0, 12)}…</span>
                {" · "}Expected: <span className="text-white">${selectedPayment.amountExpectedUsd.toFixed(2)}</span>
              </div>
            )}
            <div>
              <Label className="text-gray-400 mb-1 block">Admin Notes (optional)</Label>
              <Input
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Add any notes..."
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            {actionError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {actionError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setApproveDialogOpen(false)}
              disabled={actionLoading}
              className="text-muted-foreground hover:text-white"
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-500 text-white"
              onClick={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-black/95 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
              This will mark the payment as rejected and revert the order to{" "}
              <strong>pending_payment</strong>.
            </div>
            <div>
              <Label className="text-gray-400 mb-1 block">
                Rejection Reason <span className="text-red-400">*</span>
              </Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Amount mismatch, wrong network, suspicious TX..."
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400 mb-1 block">Admin Notes (optional)</Label>
              <Input
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Internal notes..."
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            {actionError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {actionError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRejectDialogOpen(false)}
              disabled={actionLoading}
              className="text-muted-foreground hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectReason.trim()}
            >
              {actionLoading ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
