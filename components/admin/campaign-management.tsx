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
import { Plus, X, Upload, ChevronDown, ChevronUp, Copy, AlertTriangle } from "lucide-react"
import { loadFromStorage, saveToStorage } from "@/lib/storage"

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
    // Convert each dimension to inches first, then calculate volume
    return cmToInches(length) * cmToInches(width) * cmToInches(height)
  }
  return length * width * height
}

export const findSmallestFittingBox = (
  requiredVolume: number,
  boxSizes: ShippingBoxSize[],
  paddingFactor = 0,
): ShippingBoxSize | null => {
  // Apply padding factor to required volume
  const adjustedVolume = requiredVolume * (1 + paddingFactor / 100)

  // Filter active boxes that can fit the volume, sorted by volume ascending
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const storedCampaigns = loadFromStorage<Campaign[]>("admin_campaigns") || []
    setCampaigns(storedCampaigns)
    if (storedCampaigns.length > 0 && !selectedCampaign) {
      setSelectedCampaign(storedCampaigns[0])
    }
  }, [])

  const saveCampaigns = (updatedCampaigns: Campaign[]) => {
    setCampaigns(updatedCampaigns)
    saveToStorage("admin_campaigns", updatedCampaigns)
  }

  const createNewCampaign = () => {
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: "",
      creatorDisplayName: "",
      description: "",
      status: "draft",
      totalMOQ: 1,
      acceptedPayments: [],
      adminFee: 0,
      shippingFee: 0,
      finalPaymentInfo: {},
      cryptoFeeOptions: [],
      products: [],
      boxSizes: [], // Initialize boxSizes
      defaultPaddingFactor: 0, // Initialize defaultPaddingFactor
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated = [...campaigns, newCampaign]
    saveCampaigns(updated)
    setSelectedCampaign(newCampaign)
  }

  const updateCampaign = (updates: Partial<Campaign>) => {
    if (!selectedCampaign) return
    const updated = campaigns.map((c) =>
      c.id === selectedCampaign.id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c,
    )
    saveCampaigns(updated)
    setSelectedCampaign({ ...selectedCampaign, ...updates })
  }

  const deleteCampaign = () => {
    if (!selectedCampaign) return
    const updated = campaigns.filter((c) => c.id !== selectedCampaign.id)
    saveCampaigns(updated)
    setSelectedCampaign(updated[0] || null)
  }

  const handleCampaignChange = (id: string) => {
    setSelectedCampaign(campaigns.find((c) => c.id === id) || null)
  }

  // Payment methods
  const addAcceptedPayment = () => {
    if (!selectedCampaign) return
    const newPayment: AcceptedPayment = {
      id: Date.now().toString(),
      token: "USDT (Ethereum)",
      walletAddress: "",
    }
    const currentPayments = selectedCampaign.acceptedPayments || []
    updateCampaign({
      acceptedPayments: [...currentPayments, newPayment],
    })
  }

  const updateAcceptedPayment = (id: string, updates: Partial<AcceptedPayment>) => {
    if (!selectedCampaign) return
    const currentPayments = selectedCampaign.acceptedPayments || []
    const updatedPayments = currentPayments.map((p) => (p.id === id ? { ...p, ...updates } : p))
    updateCampaign({ acceptedPayments: updatedPayments })
  }

  const removeAcceptedPayment = (id: string) => {
    if (!selectedCampaign) return
    const currentPayments = selectedCampaign.acceptedPayments || []
    updateCampaign({
      acceptedPayments: currentPayments.filter((p) => p.id !== id),
    })
  }

  // Crypto fee options
  const addCryptoFeeOption = () => {
    if (!selectedCampaign) return
    const newOption: CryptoPaymentOption = {
      id: Date.now().toString(),
      token: "USDT (Ethereum)",
      walletAddress: "",
    }
    const currentOptions = selectedCampaign.cryptoFeeOptions || []
    updateCampaign({
      cryptoFeeOptions: [...currentOptions, newOption],
    })
  }

  const updateCryptoFeeOption = (id: string, updates: Partial<CryptoPaymentOption>) => {
    if (!selectedCampaign) return
    const currentOptions = selectedCampaign.cryptoFeeOptions || []
    const updatedOptions = currentOptions.map((o) => (o.id === id ? { ...o, ...updates } : o))
    updateCampaign({ cryptoFeeOptions: updatedOptions })
  }

  const removeCryptoFeeOption = (id: string) => {
    if (!selectedCampaign) return
    const currentOptions = selectedCampaign.cryptoFeeOptions || []
    updateCampaign({
      cryptoFeeOptions: currentOptions.filter((o) => o.id !== id),
    })
  }

  // Products
  const addProduct = () => {
    if (!selectedCampaign) return
    const newProduct: CampaignProduct = {
      id: Date.now().toString(),
      peptideName: "",
      massDosage: "",
      moq: 1,
      price: 0,
      orderedCount: 0,
      manualAdjustment: 0,
      dimensions: { length: 0, width: 0, height: 0, weight: 0 },
    }
    const currentProducts = selectedCampaign.products || []
    updateCampaign({
      products: [...currentProducts, newProduct],
    })
  }

  const updateProduct = (id: string, updates: Partial<CampaignProduct>) => {
    if (!selectedCampaign) return
    const currentProducts = selectedCampaign.products || []
    const updatedProducts = currentProducts.map((p) => (p.id === id ? { ...p, ...updates } : p))
    const totalMOQ = updatedProducts.reduce((sum, p) => sum + p.moq, 0)
    updateCampaign({ products: updatedProducts, totalMOQ })
  }

  const removeProduct = (id: string) => {
    if (!selectedCampaign) return
    const currentProducts = selectedCampaign.products || []
    const updatedProducts = currentProducts.filter((p) => p.id !== id)
    const totalMOQ = updatedProducts.reduce((sum, p) => sum + p.moq, 0) || 1
    updateCampaign({ products: updatedProducts, totalMOQ })
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        updateCampaign({ imageUrl: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const addBoxSize = () => {
    if (!selectedCampaign) return
    const newBoxSize: ShippingBoxSize = {
      id: Date.now().toString(),
      name: "",
      length: 0,
      width: 0,
      height: 0,
      unit: "in",
      volume: 0,
      isActive: true,
      notes: "",
    }
    const currentBoxSizes = selectedCampaign.boxSizes || []
    updateCampaign({
      boxSizes: [...currentBoxSizes, newBoxSize],
    })
  }

  const updateBoxSize = (id: string, updates: Partial<ShippingBoxSize>) => {
    if (!selectedCampaign) return
    const currentBoxSizes = selectedCampaign.boxSizes || []
    const updatedBoxSizes = currentBoxSizes.map((box) => {
      if (box.id !== id) return box
      const updatedBox = { ...box, ...updates }
      // Recalculate volume if dimensions or unit changed
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
    // Sort by volume ascending
    updatedBoxSizes.sort((a, b) => a.volume - b.volume)
    updateCampaign({ boxSizes: updatedBoxSizes })
  }

  const removeBoxSize = (id: string) => {
    if (!selectedCampaign) return
    const currentBoxSizes = selectedCampaign.boxSizes || []
    updateCampaign({
      boxSizes: currentBoxSizes.filter((box) => box.id !== id),
    })
  }

  const duplicateBoxSize = (box: ShippingBoxSize) => {
    if (!selectedCampaign) return
    const duplicatedBox: ShippingBoxSize = {
      ...box,
      id: Date.now().toString(),
      name: `${box.name} (Copy)`,
    }
    const currentBoxSizes = selectedCampaign.boxSizes || []
    const updatedBoxSizes = [...currentBoxSizes, duplicatedBox].sort((a, b) => a.volume - b.volume)
    updateCampaign({ boxSizes: updatedBoxSizes })
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
      {/* Campaign Selector */}
      <Card className="bg-black/60 backdrop-blur-md border-white/10 p-6">
        <div className="admin-campaign-header">
          <div className="flex flex-col gap-4">
            {/* Heading and action buttons row */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-0">
              <Label className="text-white font-medium whitespace-nowrap">Select Campaign:</Label>
              {/* Action buttons - appear next to heading on desktop, below on mobile */}
              <div className="flex gap-2 md:ml-auto order-2 md:order-none">
                {selectedCampaign && (
                  <Button
                    onClick={deleteCampaign}
                    variant="outline"
                    className="admin-campaign-btn-delete border-red-500 text-red-500 hover:bg-red-500/10 bg-transparent"
                  >
                    Delete
                  </Button>
                )}
                <Button
                  onClick={createNewCampaign}
                  className="admin-campaign-btn-new bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Campaign
                </Button>
              </div>
            </div>

            {/* Dropdown and status - appears below heading on mobile */}
            <div className="flex items-center gap-3">
              <Select value={selectedCampaign?.id || ""} onValueChange={handleCampaignChange}>
                <SelectTrigger className="bg-black/40 border-white/20 text-white">
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent className="bg-black/95 backdrop-blur-md border-white/20">
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name || "Untitled Campaign"} ({campaign.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCampaign && (
                <Badge
                  className={
                    selectedCampaign.status === "active"
                      ? "bg-green-600"
                      : selectedCampaign.status === "closed"
                        ? "bg-red-600"
                        : "bg-gray-600"
                  }
                >
                  {selectedCampaign.status}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Component-scoped CSS for campaign header and crypto dropdown */}
      <style jsx>{`
        .admin-campaign-header {
          /* Desktop layout unchanged */
        }
        
        /* Mobile/tablet specific adjustments */
        @media (max-width: 768px) {
          .admin-campaign-header .admin-campaign-btn-delete,
          .admin-campaign-header .admin-campaign-btn-new {
            /* Reduce button height and padding for mobile/tablet */
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

      {selectedCampaign && (
        <>
          {/* Create New Campaign Section */}
          <Card className="bg-black/60 backdrop-blur-md border-white/10 overflow-hidden">
            <SectionHeader title="Create New Campaign" section="basic" />
            {expandedSections.basic && (
              <CardContent className="p-6 space-y-6">
                <p className="text-gray-400 text-sm -mt-2">Fill in the details for your new group buy.</p>

                {/* Title and Creator Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Campaign Title</Label>
                    <Input
                      value={selectedCampaign.name}
                      onChange={(e) => updateCampaign({ name: e.target.value })}
                      className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                      placeholder="Enter campaign title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Creator Display Name</Label>
                    <Input
                      value={selectedCampaign.creatorDisplayName}
                      onChange={(e) => updateCampaign({ creatorDisplayName: e.target.value })}
                      className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                      placeholder="e.g. John D."
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-white font-medium">Description</Label>
                  <Textarea
                    value={selectedCampaign.description}
                    onChange={(e) => updateCampaign({ description: e.target.value })}
                    className="bg-black/40 border-white/20 text-white placeholder:text-gray-500 min-h-[100px] resize-y"
                    placeholder="Describe your group buy..."
                  />
                </div>

                {/* Campaign Image Upload */}
                <div className="space-y-2">
                  <Label className="text-white font-medium">Campaign Image</Label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/20 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-white/30 transition-colors min-h-[200px] bg-black/20"
                  >
                    {selectedCampaign.imageUrl ? (
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
                        <p className="text-gray-500 text-sm mt-1">PNG, JPG, GIF</p>
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

                {/* MOQ and Deadline */}
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
                      onChange={(e) => updateCampaign({ deadline: e.target.value })}
                      className="bg-black/40 border-white/20 text-white w-32 md:w-full"
                    />
                  </div>
                </div>

                {/* Public Launch Time */}
                <div className="space-y-2">
                  <Label className="text-white font-medium">Public Launch Time (Optional)</Label>
                  <Input
                    type="datetime-local"
                    value={selectedCampaign.publicLaunchTime || ""}
                    onChange={(e) => updateCampaign({ publicLaunchTime: e.target.value })}
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
                          <SelectContent className="bg-black/95 backdrop-blur-md border-white/20 accepted-payments-crypto-select">
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
                          <SelectContent className="bg-black/95 backdrop-blur-md border-white/20 products-peptide-select">
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

                    <div className="grid grid-cols-2 gap-4">
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

                    {/* Product Dimensions Section */}
                    <div className="border-t border-white/10 pt-4 space-y-4">
                      <Label className="text-white font-medium text-sm">
                        Product Dimensions (for fulfillment box calculation)
                      </Label>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-2">
                          <Label className="text-gray-400 text-xs h-5">Length (in)</Label>
                          <Input
                            type="number"
                            value={product.dimensions?.length || ""}
                            onChange={(e) =>
                              updateProduct(product.id, {
                                dimensions: {
                                  ...product.dimensions,
                                  length: Number.parseFloat(e.target.value) || 0,
                                  width: product.dimensions?.width || 0,
                                  height: product.dimensions?.height || 0,
                                  weight: product.dimensions?.weight || 0,
                                },
                              })
                            }
                            className="bg-black/40 border-white/20 text-white text-sm h-10"
                            placeholder="0"
                            min="0"
                            step="0.1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-400 text-xs h-5">Width (in)</Label>
                          <Input
                            type="number"
                            value={product.dimensions?.width || ""}
                            onChange={(e) =>
                              updateProduct(product.id, {
                                dimensions: {
                                  ...product.dimensions,
                                  length: product.dimensions?.length || 0,
                                  width: Number.parseFloat(e.target.value) || 0,
                                  height: product.dimensions?.height || 0,
                                  weight: product.dimensions?.weight || 0,
                                },
                              })
                            }
                            className="bg-black/40 border-white/20 text-white text-sm h-10"
                            placeholder="0"
                            min="0"
                            step="0.1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-400 text-xs h-5">Height (in)</Label>
                          <Input
                            type="number"
                            value={product.dimensions?.height || ""}
                            onChange={(e) =>
                              updateProduct(product.id, {
                                dimensions: {
                                  ...product.dimensions,
                                  length: product.dimensions?.length || 0,
                                  width: product.dimensions?.width || 0,
                                  height: Number.parseFloat(e.target.value) || 0,
                                  weight: product.dimensions?.weight || 0,
                                },
                              })
                            }
                            className="bg-black/40 border-white/20 text-white text-sm h-10"
                            placeholder="0"
                            min="0"
                            step="0.1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-400 text-xs h-5">Weight (oz)</Label>
                          <Input
                            type="number"
                            value={product.dimensions?.weight || ""}
                            onChange={(e) =>
                              updateProduct(product.id, {
                                dimensions: {
                                  ...product.dimensions,
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
                  variant="outline"
                  className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 bg-transparent"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </CardContent>
            )}
          </Card>

          <Card className="bg-black/60 backdrop-blur-md border-white/10 overflow-hidden">
            <SectionHeader title="Shipping Box Sizes" section="shipping" count={safeBoxSizes.length} />
            {expandedSections.shipping && (
              <CardContent className="p-6 space-y-4">
                <p className="text-gray-400 text-sm -mt-2">
                  Define shipping box sizes for this campaign. Orders will be assigned to the smallest box that fits
                  their volume.
                </p>

                {/* Default Padding Factor */}
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
                          updateCampaign({ defaultPaddingFactor: Number.parseFloat(e.target.value) || 0 })
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

                {/* Box Size Rows */}
                {safeBoxSizes.map((box, index) => (
                  <div
                    key={box.id}
                    className={`relative border rounded-lg p-4 space-y-4 ${
                      box.isActive ? "border-white/20 bg-black/20" : "border-white/10 bg-black/10 opacity-60"
                    }`}
                  >
                    {/* Row Header with Actions */}
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

                    {/* Box Name and Active Toggle */}
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

                    {/* Dimensions */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-2">
                        <Label className="text-gray-400 text-xs">
                          Length <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          type="number"
                          value={box.length || ""}
                          onChange={(e) => updateBoxSize(box.id, { length: Number.parseFloat(e.target.value) || 0 })}
                          className="bg-black/40 border-white/20 text-white text-sm"
                          placeholder="0"
                          min="0.01"
                          step="0.1"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-400 text-xs">
                          Width <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          type="number"
                          value={box.width || ""}
                          onChange={(e) => updateBoxSize(box.id, { width: Number.parseFloat(e.target.value) || 0 })}
                          className="bg-black/40 border-white/20 text-white text-sm"
                          placeholder="0"
                          min="0.01"
                          step="0.1"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-400 text-xs">
                          Height <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          type="number"
                          value={box.height || ""}
                          onChange={(e) => updateBoxSize(box.id, { height: Number.parseFloat(e.target.value) || 0 })}
                          className="bg-black/40 border-white/20 text-white text-sm"
                          placeholder="0"
                          min="0.01"
                          step="0.1"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-400 text-xs">
                          Unit <span className="text-red-400">*</span>
                        </Label>
                        <Select value={box.unit} onValueChange={(unit: "in" | "cm") => updateBoxSize(box.id, { unit })}>
                          <SelectTrigger className="bg-black/40 border-white/20 text-white text-sm h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black/95 backdrop-blur-md border-white/20 box-unit-select">
                            <SelectItem value="in">in</SelectItem>
                            <SelectItem value="cm">cm</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Computed Volume Display */}
                    <div className="flex items-center gap-2 p-2 bg-black/30 rounded border border-white/5">
                      <span className="text-gray-400 text-sm">Computed Volume:</span>
                      <span className="text-[#FFC700] font-mono font-semibold">
                        {box.volume > 0 ? `${box.volume.toFixed(2)} in³` : "—"}
                      </span>
                      {box.unit === "cm" && box.volume > 0 && (
                        <span className="text-gray-500 text-xs">(converted from cm)</span>
                      )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs">Notes (optional)</Label>
                      <Input
                        value={box.notes || ""}
                        onChange={(e) => updateBoxSize(box.id, { notes: e.target.value })}
                        className="bg-black/40 border-white/20 text-white placeholder:text-gray-500 text-sm"
                        placeholder="e.g. Fits up to 10 vials, Use for small orders"
                      />
                    </div>

                    {/* Validation Warning */}
                    {(box.name === "" || box.length <= 0 || box.width <= 0 || box.height <= 0) && (
                      <div className="flex items-center gap-2 text-yellow-500 text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Please fill in all required fields (name and dimensions must be greater than 0)</span>
                      </div>
                    )}
                  </div>
                ))}

                {/* No boxes message */}
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

                {/* Admin Fee and Shipping Fee */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-white font-medium">Admin Fee (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        type="number"
                        value={selectedCampaign.adminFee}
                        onChange={(e) => updateCampaign({ adminFee: Number.parseFloat(e.target.value) || 0 })}
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
                        onChange={(e) => updateCampaign({ shippingFee: Number.parseFloat(e.target.value) || 0 })}
                        className="bg-black/40 border-white/20 text-white pl-7"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                {/* Final Payment Info */}
                <div className="space-y-4">
                  <Label className="text-white font-medium">Final Payment Info</Label>
                  <Input
                    value={safeFinalPaymentInfo.paypal || ""}
                    onChange={(e) =>
                      updateCampaign({
                        finalPaymentInfo: { ...safeFinalPaymentInfo, paypal: e.target.value },
                      })
                    }
                    className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                    placeholder="PayPal (username, email, or link)"
                  />
                  <Input
                    value={safeFinalPaymentInfo.venmo || ""}
                    onChange={(e) =>
                      updateCampaign({
                        finalPaymentInfo: { ...safeFinalPaymentInfo, venmo: e.target.value },
                      })
                    }
                    className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                    placeholder="Venmo (username or link)"
                  />
                  <Input
                    value={safeFinalPaymentInfo.zelle || ""}
                    onChange={(e) =>
                      updateCampaign({
                        finalPaymentInfo: { ...safeFinalPaymentInfo, zelle: e.target.value },
                      })
                    }
                    className="bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                    placeholder="Zelle (email or phone number)"
                  />
                </div>

                {/* Fee Payment Crypto Options */}
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
                            <SelectContent className="bg-black/95 backdrop-blur-md border-white/20">
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
            <Button className="bg-[#FFC700] hover:bg-[#E6B300] text-black px-8 font-semibold">Save Campaign</Button>
          </div>
        </>
      )}
    </div>
  )
}
