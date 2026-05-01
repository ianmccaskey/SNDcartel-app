"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type {
  Campaign,
  CampaignProduct,
  AcceptedPayment,
  CryptoPaymentOption,
  ShippingBoxSize,
} from "@/lib/admin-types"
import { Plus, X, Upload, ChevronDown, ChevronUp, Copy, AlertTriangle, Loader2 } from "lucide-react"

const CRYPTO_OPTIONS = ["USDT (Ethereum)", "USDC (Ethereum)", "USDT (Solana)", "USDC (Solana)", "ETH", "SOL", "BTC"]

const PEPTIDE_OPTIONS = [
  "Tirzepatide",
  "Retatrutide",
  "Semaglutide",
  "BPC-157",
  "TB-500",
  "SS-31 (Elamipretide)",
  "GHK-Cu",
  "NAD+",
  "Epithalon",
  "Selank",
]

const cmToInches = (cm: number): number => cm / 2.54

const calculateVolume = (length: number, width: number, height: number, unit: "in" | "cm"): number => {
  if (unit === "cm") {
    return cmToInches(length) * cmToInches(width) * cmToInches(height)
  }
  return length * width * height
}

export const findSmallestFittingBox = (
  requiredVolume: number,
  boxSizes: ShippingBoxSize[],
  paddingFactor = 0,
): ShippingBoxSize | null => {
  const adjustedVolume = requiredVolume * (1 + paddingFactor / 100)
  const fittingBoxes = boxSizes
    .filter((box) => box.isActive && box.volume >= adjustedVolume)
    .sort((a, b) => a.volume - b.volume)
  return fittingBoxes.length > 0 ? fittingBoxes[0] : null
}

export function CampaignManagement() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    payments: true,
    products: true,
    shipping: true,
    fees: true,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadCampaigns = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/group-buys")
      if (!res.ok) throw new Error(await res.text())
      const data: Campaign[] = await res.json()
      setCampaigns(data)
      if (data.length > 0 && !selectedCampaign) {
        setSelectedCampaign(data[0])
      }
    } catch (e) {
      setError("Failed to load campaigns")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Campaign CRUD ─────────────────────────────────────────────────────────

  const createNewCampaign = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/group-buys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Campaign" }),
      })
      if (!res.ok) throw new Error(await res.text())
      const newCampaign: Campaign = await res.json()
      setCampaigns((prev) => [...prev, newCampaign])
      setSelectedCampaign(newCampaign)
    } catch (e) {
      setError("Failed to create campaign")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const saveCampaign = async () => {
    if (!selectedCampaign) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/group-buys/${selectedCampaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedCampaign.name,
          creatorDisplayName: selectedCampaign.creatorDisplayName,
          description: selectedCampaign.description,
          imageUrl: selectedCampaign.imageUrl ?? null,
          deadline: selectedCampaign.deadline ?? null,
          publicLaunchTime: selectedCampaign.publicLaunchTime ?? null,
          adminFee: selectedCampaign.adminFee,
          shippingFee: selectedCampaign.shippingFee,
          acceptedPayments: selectedCampaign.acceptedPayments,
          metadata: {
            finalPaymentInfo: selectedCampaign.finalPaymentInfo,
            cryptoFeeOptions: selectedCampaign.cryptoFeeOptions,
            boxSizes: selectedCampaign.boxSizes ?? [],
            defaultPaddingFactor: selectedCampaign.defaultPaddingFactor ?? 0,
          },
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated: Campaign = await res.json()
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedCampaign(updated)
    } catch (e) {
      setError("Failed to save campaign")
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const deleteCampaign = async () => {
    if (!selectedCampaign) return
    if (!confirm(`Delete campaign "${selectedCampaign.name}"? This cannot be undone.`)) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/group-buys/${selectedCampaign.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      const updated = campaigns.filter((c) => c.id !== selectedCampaign.id)
      setCampaigns(updated)
      setSelectedCampaign(updated[0] || null)
    } catch (e) {
      setError("Failed to delete campaign")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const changeStatus = async (newStatus: "active" | "closed" | "fulfilled") => {
    if (!selectedCampaign) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/group-buys/${selectedCampaign.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Status change failed")
      }
      const updated = { ...selectedCampaign, status: newStatus }
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedCampaign(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to change status")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Local field updates (optimistic, saved on "Save Campaign") ────────────

  const handleCampaignChange = (id: string) => {
    setSelectedCampaign(campaigns.find((c) => c.id === id) || null)
  }

  const updateLocal = (updates: Partial<Campaign>) => {
    if (!selectedCampaign) return
    const updated = { ...selectedCampaign, ...updates }
    setSelectedCampaign(updated)
    setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  // ── Accepted payments ─────────────────────────────────────────────────────

  const addAcceptedPayment = () => {
    if (!selectedCampaign) return
    const newPayment: AcceptedPayment = {
      id: `local-${Date.now()}`,
      token: "USDT (Ethereum)",
      walletAddress: "",
    }
    updateLocal({ acceptedPayments: [...(selectedCampaign.acceptedPayments || []), newPayment] })
  }

  const updateAcceptedPayment = (id: string, updates: Partial<AcceptedPayment>) => {
    if (!selectedCampaign) return
    const updated = (selectedCampaign.acceptedPayments || []).map((p) => (p.id === id ? { ...p, ...updates } : p))
    updateLocal({ acceptedPayments: updated })
  }

  const removeAcceptedPayment = (id: string) => {
    if (!selectedCampaign) return
    updateLocal({ acceptedPayments: (selectedCampaign.acceptedPayments || []).filter((p) => p.id !== id) })
  }

  // ── Crypto fee options ────────────────────────────────────────────────────

  const addCryptoFeeOption = () => {
    if (!selectedCampaign) return
    const newOption: CryptoPaymentOption = {
      id: `local-${Date.now()}`,
      token: "USDT (Ethereum)",
      walletAddress: "",
    }
    updateLocal({ cryptoFeeOptions: [...(selectedCampaign.cryptoFeeOptions || []), newOption] })
  }

  const updateCryptoFeeOption = (id: string, updates: Partial<CryptoPaymentOption>) => {
    if (!selectedCampaign) return
    const updated = (selectedCampaign.cryptoFeeOptions || []).map((o) => (o.id === id ? { ...o, ...updates } : o))
    updateLocal({ cryptoFeeOptions: updated })
  }

  const removeCryptoFeeOption = (id: string) => {
    if (!selectedCampaign) return
    updateLocal({ cryptoFeeOptions: (selectedCampaign.cryptoFeeOptions || []).filter((o) => o.id !== id) })
  }

  // ── Products (immediate API calls) ───────────────────────────────────────

  const addProduct = async () => {
    if (!selectedCampaign) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/group-buys/${selectedCampaign.id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peptideName: "", massDosage: "", moq: 1, price: 0 }),
      })
      if (!res.ok) throw new Error(await res.text())
      const newProduct: CampaignProduct = await res.json()
      const updatedProducts = [...(selectedCampaign.products || []), newProduct]
      const totalMOQ = updatedProducts.reduce((s, p) => s + p.moq, 0) || 1
      updateLocal({ products: updatedProducts, totalMOQ })
    } catch (e) {
      setError("Failed to add product")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const updateProduct = async (id: string, updates: Partial<CampaignProduct>) => {
    if (!selectedCampaign) return
    // Optimistic local update
    const updatedProducts = (selectedCampaign.products || []).map((p) => (p.id === id ? { ...p, ...updates } : p))
    const totalMOQ = updatedProducts.reduce((s, p) => s + p.moq, 0) || 1
    updateLocal({ products: updatedProducts, totalMOQ })
  }

  const saveProductToApi = async (product: CampaignProduct) => {
    if (!selectedCampaign) return
    // Fire-and-forget product PATCH (called when a product field loses focus via a blur handler if desired)
    // For now products are persisted via "Save Campaign" → PATCH /group-buys/:id
    // Individual product PATCH is available if needed
    try {
      await fetch(`/api/admin/group-buys/${selectedCampaign.id}/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peptideName: product.peptideName,
          massDosage: product.massDosage,
          moq: product.moq,
          price: product.price,
          manualAdjustment: product.manualAdjustment,
          dimensions: product.dimensions,
        }),
      })
    } catch (e) {
      console.error("Failed to save product:", e)
    }
  }

  const removeProduct = async (id: string) => {
    if (!selectedCampaign) return
    // Optimistic remove
    const updatedProducts = (selectedCampaign.products || []).filter((p) => p.id !== id)
    const totalMOQ = updatedProducts.reduce((s, p) => s + p.moq, 0) || 1
    updateLocal({ products: updatedProducts, totalMOQ })

    try {
      const res = await fetch(`/api/admin/group-buys/${selectedCampaign.id}/products/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
    } catch (e) {
      setError("Failed to remove product")
      console.error(e)
      // Reload to restore correct state
      await loadCampaigns()
    }
  }

  // ── Image upload ──────────────────────────────────────────────────────────

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedCampaign) return

    const formData = new FormData()
    formData.append("file", file)

    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Upload failed")
      }
      const { url } = await res.json()
      updateLocal({ imageUrl: url })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Image upload failed")
      console.error(e)
    } finally {
      setLoading(false)
      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // ── Box sizes ─────────────────────────────────────────────────────────────

  const addBoxSize = () => {
    if (!selectedCampaign) return
    const newBoxSize: ShippingBoxSize = {
      id: `local-${Date.now()}`,
      name: "",
      length: 0,
      width: 0,
      height: 0,
      unit: "in",
      volume: 0,
      isActive: true,
      notes: "",
    }
    updateLocal({ boxSizes: [...(selectedCampaign.boxSizes || []), newBoxSize] })
  }

  const updateBoxSize = (id: string, updates: Partial<ShippingBoxSize>) => {
    if (!selectedCampaign) return
    const updatedBoxSizes = (selectedCampaign.boxSizes || []).map((box) => {
      if (box.id !== id) return box
      const updatedBox = { ...box, ...updates }
      if (
        updates.length !== undefined ||
        updates.width !== undefined ||
        updates.height !== undefined ||
        updates.unit !== undefined
      ) {
        updatedBox.volume = calculateVolume(updatedBox.length, updatedBox.width, updatedBox.height, updatedBox.unit)
      }
      return updatedBox
    })
    updatedBoxSizes.sort((a, b) => a.volume - b.volume)
    updateLocal({ boxSizes: updatedBoxSizes })
  }

  const removeBoxSize = (id: string) => {
    if (!selectedCampaign) return
    updateLocal({ boxSizes: (selectedCampaign.boxSizes || []).filter((box) => box.id !== id) })
  }

  const duplicateBoxSize = (box: ShippingBoxSize) => {
    if (!selectedCampaign) return
    const duplicatedBox: ShippingBoxSize = {
      ...box,
      id: `local-${Date.now()}`,
      name: `${box.name} (Copy)`,
    }
    const updatedBoxSizes = [...(selectedCampaign.boxSizes || []), duplicatedBox].sort((a, b) => a.volume - b.volume)
    updateLocal({ boxSizes: updatedBoxSizes })
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const SectionHeader = ({
    title,
    section,
    count,
  }: { title: string; section: keyof typeof expandedSections; count?: number }) => (
    <div
      className="flex items-center justify-between cursor-pointer py-4 px-6 border-b border-white/10"
      onClick={() => toggleSection(section)}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {count !== undefined && (
          <Badge variant="outline" className="text-xs">
            {count}
          </Badge>
        )}
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="w-5 h-5 text-muted-foreground" />
      ) : (
        <ChevronDown className="w-5 h-5 text-muted-foreground" />
      )}
    </div>
  )

  const safeAcceptedPayments = selectedCampaign?.acceptedPayments || []
  const safeCryptoFeeOptions = selectedCampaign?.cryptoFeeOptions || []
  const safeProducts = selectedCampaign?.products || []
  const safeFinalPaymentInfo = selectedCampaign?.finalPaymentInfo || { paypal: "", venmo: "", zelle: "" }
  const safeBoxSizes = selectedCampaign?.boxSizes || []

  return (
    <div className="space-y-6 pb-6">
      {/* Error banner */}
      {error && (
        <div className="bg-red-900/40 border border-red-500/40 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Campaign Selector */}
      <Card className="bg-black/60 backdrop-blur-md border-white/10 p-6">
        <div className="admin-campaign-header">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-0">
              <Label className="text-white font-medium whitespace-nowrap">Select Campaign:</Label>
              <div className="flex gap-2 md:ml-auto order-2 md:order-none">
                {selectedCampaign && (
                  <Button
                    onClick={deleteCampaign}
                    disabled={loading}
                    variant="outline"
                    className="admin-campaign-btn-delete border-red-500 text-red-500 hover:bg-red-500/10 bg-transparent"
                  >
                    Delete
                  </Button>
                )}
                <Button
                  onClick={createNewCampaign}
                  disabled={loading}
                  className="admin-campaign-btn-new bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  New Campaign
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Select value={selectedCampaign?.id || ""} onValueChange={handleCampaignChange}>
                <SelectTrigger className="bg-black/40 border-white/20 text-white">
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent className="bg-black/95 backdrop-blur-md border-white/20 text-white" position="popper" sideOffset={4}>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name || "Untitled Campaign"} ({campaign.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCampaign && (
                <>
                  <Badge
                    className={
                      selectedCampaign.status === "active"
                        ? "bg-green-600"
                        : selectedCampaign.status === "closed"
                          ? "bg-red-600"
                          : selectedCampaign.status === "fulfilled"
                            ? "bg-blue-600"
                            : "bg-gray-600"
                    }
                  >
                    {selectedCampaign.status}
                  </Badge>
                  {/* Status action buttons */}
                  {selectedCampaign.status === "draft" && (
                    <Button
                      onClick={() => changeStatus("active")}
                      disabled={loading}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white text-xs"
                    >
                      Publish
                    </Button>
                  )}
                  {selectedCampaign.status === "active" && (
                    <Button
                      onClick={() => changeStatus("closed")}
                      disabled={loading}
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
                    >
                      Close
                    </Button>
                  )}
                  {selectedCampaign.status === "closed" && (
                    <Button
                      onClick={() => changeStatus("fulfilled")}
                      disabled={loading}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    >
                      Mark Fulfilled
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Component-scoped CSS */}
      <style jsx>{`
        .admin-campaign-header {
          /* Desktop layout unchanged */
        }

        @media (max-width: 768px) {
          .admin-campaign-header .admin-campaign-btn-delete,
          .admin-campaign-header .admin-campaign-btn-new {
            padding: 0.375rem 0.875rem;
            font-size: 0.875rem;
            height: auto;
            min-height: 2rem;
          }

          .admin-campaign-header .admin-campaign-btn-new svg {
            width: 0.875rem;
            height: 0.875rem;
          }
        }

        .accepted-payments-crypto-select [role="option"] {
          color: #ffffff !important;
          background-color: #000000 !important;
        }
        .accepted-payments-crypto-select [role="option"]:hover,
        .accepted-payments-crypto-select [role="option"][data-highlighted] {
          background-color: #1a1a1a !important;
        }
        .products-peptide-select [role="option"] {
          color: #ffffff !important;
          background-color: #000000 !important;
        }
        .products-peptide-select [role="option"]:hover,
        .products-peptide-select [role="option"][data-highlighted] {
          background-color: #1a1a1a !important;
        }
        .box-unit-select [role="option"] {
          color: #ffffff !important;
          background-color: #000000 !important;
        }
        .box-unit-select [role="option"]:hover,
        .box-unit-select [role="option"][data-highlighted] {
          background-color: #1a1a1a !important;
        }
      `}</style>

      {loading && campaigns.length === 0 && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-3" />
          Loading campaigns...
        </div>
      )}

      {selectedCampaign && (
        <>
          {/* Basic Info Section */}
          <Card className="bg-black/60 backdrop-blur-md border-white/10 overflow-hidden">
            <SectionHeader title="Create New Campaign" section="basic" />
            {expandedSections.basic && (
              <CardContent className="p-6 space-y-6">
                <p className="text-gray-400 text-sm -mt-2">Fill in the details for your new group buy.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Campaign Title</Label>
                    <Input
                      value={selectedCampaign.name}
                      onChange={(e) => updateLocal({ name: e.target.value })}
                      className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                      placeholder="Enter campaign title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Creator Display Name</Label>
                    <Input
                      value={selectedCampaign.creatorDisplayName}
                      onChange={(e) => updateLocal({ creatorDisplayName: e.target.value })}
                      className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                      placeholder="e.g. John D."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Description</Label>
                  <Textarea
                    value={selectedCampaign.description}
                    onChange={(e) => updateLocal({ description: e.target.value })}
                    className="bg-black/40 border-white/20 text-white placeholder:text-gray-500 min-h-[100px] resize-y"
                    placeholder="Describe your group buy..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Campaign Image</Label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/20 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-white/30 transition-colors min-h-[200px] bg-black/20"
                  >
                    {loading ? (
                      <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
                    ) : selectedCampaign.imageUrl ? (
                      <img
                        src={selectedCampaign.imageUrl || "/placeholder.svg"}
                        alt="Campaign"
                        className="max-h-[180px] object-contain rounded"
                      />
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-gray-500 mb-3" />
                        <p className="text-gray-400">
                          <span className="text-yellow-500">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-gray-500 text-sm mt-1">PNG, JPG, GIF, WebP · max 5MB</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
                  <div className="flex flex-row md:flex-col gap-4 md:gap-2 items-start md:items-start justify-between md:justify-start">
                    <div className="flex flex-col gap-1">
                      <Label className="text-white font-medium">Total Campaign MOQ</Label>
                      <p className="text-sm text-gray-400 md:text-gray-300">(Auto-Calculated)</p>
                    </div>
                    <Input
                      value={selectedCampaign.totalMOQ || 0}
                      readOnly
                      className="bg-black/40 border-white/20 text-yellow-500 font-semibold w-24 md:w-full"
                    />
                  </div>
                  <div className="flex md:flex-col items-center justify-between gap-4 md:gap-2 md:space-y-2">
                    <Label className="text-white font-medium whitespace-nowrap md:whitespace-normal">Deadline</Label>
                    <Input
                      type="date"
                      value={selectedCampaign.deadline || ""}
                      onChange={(e) => updateLocal({ deadline: e.target.value })}
                      className="bg-black/40 border-white/20 text-white w-32 md:w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white font-medium">Public Launch Time (Optional)</Label>
                  <Input
                    type="datetime-local"
                    value={selectedCampaign.publicLaunchTime || ""}
                    onChange={(e) => updateLocal({ publicLaunchTime: e.target.value })}
                    className="bg-black/40 border-white/20 text-white"
                  />
                  <p className="text-gray-500 text-sm">
                    Campaign will automatically go public at this time. Leave empty if you want to manually control
                    visibility.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Accepted Payments Section */}
          <Card className="bg-black/60 backdrop-blur-md border-white/10 overflow-hidden">
            <SectionHeader title="Accepted Payments" section="payments" count={safeAcceptedPayments.length} />
            {expandedSections.payments && (
              <CardContent className="p-6 space-y-4">
                <p className="text-gray-400 text-sm -mt-2">
                  Select which cryptocurrencies can be used and their specific payout addresses.
                </p>

                {safeAcceptedPayments.map((payment) => (
                  <div key={payment.id} className="border border-white/10 rounded-lg p-4 bg-black/20">
                    <div className="flex gap-3 items-start mb-3">
                      <div className="flex-1">
                        <Select
                          value={payment.token}
                          onValueChange={(token) => updateAcceptedPayment(payment.id, { token })}
                        >
                          <SelectTrigger className="bg-black/40 border-white/20 text-white h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black/95 backdrop-blur-md border-white/20 text-white" position="popper" sideOffset={4}>
                            {CRYPTO_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option} className="text-white">
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={() => removeAcceptedPayment(payment.id)}
                        size="icon"
                        className="bg-red-500 hover:bg-red-600 h-11 w-11 shrink-0"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Payout Wallet Address</Label>
                      <Input
                        value={payment.walletAddress}
                        onChange={(e) => updateAcceptedPayment(payment.id, { walletAddress: e.target.value })}
                        className="bg-black/40 border-white/20 text-white placeholder:text-gray-400"
                        placeholder="0x... or Solana address for this token"
                      />
                    </div>
                  </div>
                ))}

                <Button
                  onClick={addAcceptedPayment}
                  variant="outline"
                  className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 bg-transparent w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Payment Option
                </Button>
              </CardContent>
            )}
          </Card>

          {/* Products Section */}
          <Card className="bg-black/60 backdrop-blur-md border-white/10 overflow-hidden">
            <SectionHeader title="Products" section="products" count={safeProducts.length} />
            {expandedSections.products && (
              <CardContent className="p-6 space-y-4">
                <p className="text-gray-400 text-sm -mt-2">
                  Add the peptides available in this campaign and their individual MOQ.
                </p>

                {safeProducts.map((product) => (
                  <div
                    key={product.id}
                    className="relative border border-white/20 rounded-lg p-4 space-y-4 bg-black/20"
                  >
                    <Button
                      onClick={() => removeProduct(product.id)}
                      size="icon"
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>

                    <div className="grid grid-cols-1 gap-4 pr-12">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Peptide</Label>
                        <Select
                          value={product.peptideName}
                          onValueChange={(peptideName) => updateProduct(product.id, { peptideName })}
                        >
                          <SelectTrigger className="bg-black/40 border-white/20 text-white">
                            <SelectValue placeholder="Select or create peptide..." />
                          </SelectTrigger>
                          <SelectContent className="bg-black/95 backdrop-blur-md border-white/20 text-white" position="popper" sideOffset={4}>
                            {PEPTIDE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Mass/Dosage</Label>
                        <Input
                          value={product.massDosage}
                          onChange={(e) => updateProduct(product.id, { massDosage: e.target.value })}
                          className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                          placeholder="e.g. 10MG, 50MG"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">MOQ (Kits)</Label>
                        <Input
                          type="number"
                          value={product.moq}
                          onChange={(e) => updateProduct(product.id, { moq: Number.parseInt(e.target.value) || 0 })}
                          className="bg-black/40 border-white/20 text-white"
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Price (USD)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                          <Input
                            type="number"
                            value={product.price}
                            onChange={(e) =>
                              updateProduct(product.id, { price: Number.parseFloat(e.target.value) || 0 })
                            }
                            className="bg-black/40 border-white/20 text-white pl-7"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Product Dimensions */}
                    <div className="border-t border-white/10 pt-4 space-y-4">
                      <Label className="text-white font-medium text-sm">
                        Product Dimensions (for fulfillment box calculation)
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(["length", "width", "height"] as const).map((dim) => (
                          <div key={dim} className="space-y-2">
                            <Label className="text-gray-400 text-xs h-5 capitalize">{dim} (in)</Label>
                            <Input
                              type="number"
                              value={product.dimensions?.[dim] || ""}
                              onChange={(e) =>
                                updateProduct(product.id, {
                                  dimensions: {
                                    length: product.dimensions?.length || 0,
                                    width: product.dimensions?.width || 0,
                                    height: product.dimensions?.height || 0,
                                    weight: product.dimensions?.weight || 0,
                                    [dim]: Number.parseFloat(e.target.value) || 0,
                                  },
                                })
                              }
                              className="bg-black/40 border-white/20 text-white text-sm h-10"
                              placeholder="0"
                              min="0"
                              step="0.1"
                            />
                          </div>
                        ))}
                        <div className="space-y-2">
                          <Label className="text-gray-400 text-xs h-5">Weight (oz)</Label>
                          <Input
                            type="number"
                            value={product.dimensions?.weight || ""}
                            onChange={(e) =>
                              updateProduct(product.id, {
                                dimensions: {
                                  length: product.dimensions?.length || 0,
                                  width: product.dimensions?.width || 0,
                                  height: product.dimensions?.height || 0,
                                  weight: Number.parseFloat(e.target.value) || 0,
                                },
                              })
                            }
                            className="bg-black/40 border-white/20 text-white text-sm h-10"
                            placeholder="0"
                            min="0"
                            step="0.1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  onClick={addProduct}
                  disabled={loading}
                  variant="outline"
                  className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 bg-transparent"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Product
                </Button>
              </CardContent>
            )}
          </Card>

          {/* Shipping Box Sizes Section */}
          <Card className="bg-black/60 backdrop-blur-md border-white/10 overflow-hidden">
            <SectionHeader title="Shipping Box Sizes" section="shipping" count={safeBoxSizes.length} />
            {expandedSections.shipping && (
              <CardContent className="p-6 space-y-4">
                <p className="text-gray-400 text-sm -mt-2">
                  Define shipping box sizes for this campaign. Orders will be assigned to the smallest box that fits
                  their volume.
                </p>

                <div className="flex items-center gap-4 p-4 bg-black/20 rounded-lg border border-white/10">
                  <div className="flex-1 space-y-2">
                    <Label className="text-white font-medium">Default Padding Factor (%)</Label>
                    <p className="text-gray-500 text-xs">
                      Inflates required volume before selecting a box (e.g., 10% adds 10% to order volume)
                    </p>
                  </div>
                  <div className="w-32">
                    <div className="relative">
                      <Input
                        type="number"
                        value={selectedCampaign.defaultPaddingFactor || 0}
                        onChange={(e) =>
                          updateLocal({ defaultPaddingFactor: Number.parseFloat(e.target.value) || 0 })
                        }
                        className="bg-black/40 border-white/20 text-white pr-8"
                        min="0"
                        max="100"
                        step="1"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>
                </div>

                {safeBoxSizes.map((box, index) => (
                  <div
                    key={box.id}
                    className={`relative border rounded-lg p-4 space-y-4 ${
                      box.isActive ? "border-white/20 bg-black/20" : "border-white/10 bg-black/10 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-sm font-mono">#{index + 1}</span>
                        {box.volume > 0 && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {box.volume.toFixed(2)} in³
                          </Badge>
                        )}
                        {!box.isActive && (
                          <Badge variant="outline" className="text-xs text-gray-500 border-gray-500">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => duplicateBoxSize(box)}
                          size="sm"
                          variant="ghost"
                          className="text-gray-400 hover:text-white h-8 px-2"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => removeBoxSize(box.id)}
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2"
                          title="Delete"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr,auto] gap-4 items-end">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">
                          Box Name/Label <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          value={box.name}
                          onChange={(e) => updateBoxSize(box.id, { name: e.target.value })}
                          className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                          placeholder="e.g. Small, 6x4x2, Medium Flat"
                          required
                        />
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <Label className="text-gray-400 text-sm">Active</Label>
                        <button
                          type="button"
                          onClick={() => updateBoxSize(box.id, { isActive: !box.isActive })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            box.isActive ? "bg-[#FFC700]" : "bg-gray-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              box.isActive ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(["length", "width", "height"] as const).map((dim) => (
                        <div key={dim} className="space-y-2">
                          <Label className="text-gray-400 text-xs capitalize">
                            {dim} <span className="text-red-400">*</span>
                          </Label>
                          <Input
                            type="number"
                            value={box[dim] || ""}
                            onChange={(e) =>
                              updateBoxSize(box.id, { [dim]: Number.parseFloat(e.target.value) || 0 })
                            }
                            className="bg-black/40 border-white/20 text-white text-sm"
                            placeholder="0"
                            min="0.01"
                            step="0.1"
                            required
                          />
                        </div>
                      ))}
                      <div className="space-y-2">
                        <Label className="text-gray-400 text-xs">
                          Unit <span className="text-red-400">*</span>
                        </Label>
                        <Select
                          value={box.unit}
                          onValueChange={(unit: "in" | "cm") => updateBoxSize(box.id, { unit })}
                        >
                          <SelectTrigger className="bg-black/40 border-white/20 text-white text-sm h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black/95 backdrop-blur-md border-white/20 text-white" position="popper" sideOffset={4}>
                            <SelectItem value="in">in</SelectItem>
                            <SelectItem value="cm">cm</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-black/30 rounded border border-white/5">
                      <span className="text-gray-400 text-sm">Computed Volume:</span>
                      <span className="text-[#FFC700] font-mono font-semibold">
                        {box.volume > 0 ? `${box.volume.toFixed(2)} in³` : "—"}
                      </span>
                      {box.unit === "cm" && box.volume > 0 && (
                        <span className="text-gray-500 text-xs">(converted from cm)</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs">Notes (optional)</Label>
                      <Input
                        value={box.notes || ""}
                        onChange={(e) => updateBoxSize(box.id, { notes: e.target.value })}
                        className="bg-black/40 border-white/20 text-white placeholder:text-gray-500 text-sm"
                        placeholder="e.g. Fits up to 10 vials, Use for small orders"
                      />
                    </div>

                    {(box.name === "" || box.length <= 0 || box.width <= 0 || box.height <= 0) && (
                      <div className="flex items-center gap-2 text-yellow-500 text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Please fill in all required fields (name and dimensions must be greater than 0)</span>
                      </div>
                    )}
                  </div>
                ))}

                {safeBoxSizes.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No box sizes defined yet.</p>
                    <p className="text-sm mt-1">Add box sizes to enable automatic box selection during fulfillment.</p>
                  </div>
                )}

                <Button
                  onClick={addBoxSize}
                  variant="outline"
                  className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 bg-transparent"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Box Size
                </Button>
              </CardContent>
            )}
          </Card>

          {/* Fees & Final Payment Section */}
          <Card className="bg-black/60 backdrop-blur-md border-white/10 overflow-hidden">
            <SectionHeader title="Fees & Final Payment" section="fees" count={safeCryptoFeeOptions.length} />
            {expandedSections.fees && (
              <CardContent className="p-6 space-y-6">
                <p className="text-gray-400 text-sm -mt-2">
                  Set post-campaign fees and provide payment info for final settlement.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Admin Fee (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        type="number"
                        value={selectedCampaign.adminFee}
                        onChange={(e) => updateLocal({ adminFee: Number.parseFloat(e.target.value) || 0 })}
                        className="bg-black/40 border-white/20 text-white pl-7"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Shipping Fee (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        type="number"
                        value={selectedCampaign.shippingFee}
                        onChange={(e) => updateLocal({ shippingFee: Number.parseFloat(e.target.value) || 0 })}
                        className="bg-black/40 border-white/20 text-white pl-7"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-white font-medium">Final Payment Info</Label>
                  {(["paypal", "venmo", "zelle"] as const).map((method) => (
                    <Input
                      key={method}
                      value={safeFinalPaymentInfo[method] || ""}
                      onChange={(e) =>
                        updateLocal({
                          finalPaymentInfo: { ...safeFinalPaymentInfo, [method]: e.target.value },
                        })
                      }
                      className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                      placeholder={
                        method === "paypal"
                          ? "PayPal (username, email, or link)"
                          : method === "venmo"
                            ? "Venmo (username or link)"
                            : "Zelle (email or phone number)"
                      }
                    />
                  ))}
                </div>

                <div className="space-y-4">
                  <Label className="text-white font-medium">Fee Payment Crypto Options</Label>
                  {safeCryptoFeeOptions.map((option) => (
                    <div key={option.id} className="space-y-3">
                      <div className="flex gap-3 items-start">
                        <div className="flex-1">
                          <Select
                            value={option.token}
                            onValueChange={(token) => updateCryptoFeeOption(option.id, { token })}
                          >
                            <SelectTrigger className="bg-black/40 border-white/20 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-black/95 backdrop-blur-md border-white/20 text-white" position="popper" sideOffset={4}>
                              {CRYPTO_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => removeCryptoFeeOption(option.id)}
                          size="icon"
                          className="bg-red-500 hover:bg-red-600 h-10 w-10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <Input
                        value={option.walletAddress}
                        onChange={(e) => updateCryptoFeeOption(option.id, { walletAddress: e.target.value })}
                        className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                        placeholder="0x... or Solana address for this token"
                      />
                    </div>
                  ))}
                  <Button
                    onClick={addCryptoFeeOption}
                    variant="outline"
                    className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 bg-transparent"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Crypto Fee Option
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={saveCampaign}
              disabled={saving}
              className="bg-[#FFC700] hover:bg-[#E6B300] text-black px-8 font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Campaign"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
