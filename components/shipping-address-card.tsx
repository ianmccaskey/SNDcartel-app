"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface ShippingData {
  shippingLine1: string
  shippingLine2: string
  shippingCity: string
  shippingState: string
  shippingZip: string
}

interface ShippingAddressCardProps {
  shippingLine1: string
  shippingLine2: string
  shippingCity: string
  shippingState: string
  shippingZip: string
  onSave: (data: ShippingData) => Promise<void>
}

export function ShippingAddressCard({
  shippingLine1: initialLine1,
  shippingLine2: initialLine2,
  shippingCity: initialCity,
  shippingState: initialState,
  shippingZip: initialZip,
  onSave,
}: ShippingAddressCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [line1, setLine1] = useState(initialLine1)
  const [line2, setLine2] = useState(initialLine2)
  const [city, setCity] = useState(initialCity)
  const [state, setState] = useState(initialState)
  const [zip, setZip] = useState(initialZip)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        shippingLine1: line1,
        shippingLine2: line2,
        shippingCity: city,
        shippingState: state,
        shippingZip: zip,
      })
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-background/80 backdrop-blur-md border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Shipping Address</CardTitle>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        ) : (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="line1">Address Line 1</Label>
          <Input
            id="line1"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            disabled={!isEditing}
            placeholder="Street address"
          />
        </div>
        <div>
          <Label htmlFor="line2">Address Line 2 (Optional)</Label>
          <Input
            id="line2"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            disabled={!isEditing}
            placeholder="Apt, suite, etc."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!isEditing}
              placeholder="City"
            />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={!isEditing}
              placeholder="State"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="zip">ZIP Code</Label>
          <Input
            id="zip"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            disabled={!isEditing}
            placeholder="ZIP code"
          />
        </div>
      </CardContent>
    </Card>
  )
}
