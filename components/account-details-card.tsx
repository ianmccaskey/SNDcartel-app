"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface AccountDetailsCardProps {
  fullName: string
  discordName: string
  onSave: (data: { fullName: string; discordName: string }) => Promise<void>
}

export function AccountDetailsCard({ fullName: initialFullName, discordName: initialDiscordName, onSave }: AccountDetailsCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState(initialFullName)
  const [discordName, setDiscordName] = useState(initialDiscordName)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave({ fullName, discordName })
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
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
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">{error}</div>
        )}
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
