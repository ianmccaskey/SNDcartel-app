"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { AccountDetails } from "@/lib/types"
import { useState } from "react"

interface AccountDetailsCardProps {
  account: AccountDetails | null
  onSave: (account: AccountDetails) => void
}

export function AccountDetailsCard({ account, onSave }: AccountDetailsCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [fullName, setFullName] = useState(account?.fullName || "")
  const [discordName, setDiscordName] = useState(account?.discordName || "")

  const handleSave = () => {
    onSave({
      fullName,
      discordName,
      shippingAddress: account?.shippingAddress || { line1: "", city: "", state: "", zip: "" },
    })
    setIsEditing(false)
  }

  return (
    <Card className="bg-background/80 backdrop-blur-md border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Account Details</CardTitle>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        ) : (
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={!isEditing}
            placeholder="Enter your full name"
          />
        </div>
        <div>
          <Label htmlFor="discordName">Discord Name</Label>
          <Input
            id="discordName"
            value={discordName}
            onChange={(e) => setDiscordName(e.target.value)}
            disabled={!isEditing}
            placeholder="Enter your Discord username"
          />
        </div>
      </CardContent>
    </Card>
  )
}
