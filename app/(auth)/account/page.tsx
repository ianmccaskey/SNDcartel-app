"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface UserProfile {
  id: string
  email: string
  role: string
  fullName: string | null
  discordName: string | null
  shippingLine1: string | null
  shippingLine2: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingZip: string | null
  profileComplete: boolean
}

interface Wallet {
  id: string
  chain: string
  address: string
}

export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [fullName, setFullName] = useState("")
  const [discordName, setDiscordName] = useState("")
  const [shippingLine1, setShippingLine1] = useState("")
  const [shippingLine2, setShippingLine2] = useState("")
  const [shippingCity, setShippingCity] = useState("")
  const [shippingState, setShippingState] = useState("")
  const [shippingZip, setShippingZip] = useState("")

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        // Load profile
        const profileRes = await fetch("/api/users/me")
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          setProfile(profileData)
          setFullName(profileData.fullName || "")
          setDiscordName(profileData.discordName || "")
          setShippingLine1(profileData.shippingLine1 || "")
          setShippingLine2(profileData.shippingLine2 || "")
          setShippingCity(profileData.shippingCity || "")
          setShippingState(profileData.shippingState || "")
          setShippingZip(profileData.shippingZip || "")
        }

        // Load wallets
        const walletsRes = await fetch("/api/users/me/wallets")
        if (walletsRes.ok) {
          const walletsData = await walletsRes.json()
          setWallets(walletsData)
        }

      } catch (err) {
        setError(`Error loading data: ${err}`)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          discordName,
          shippingLine1,
          shippingLine2,
          shippingCity,
          shippingState,
          shippingZip,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setProfile(updated)
        setError(null)
      } else {
        setError(`Failed to save: ${res.status}`)
      }
    } catch (err) {
      setError(`Error saving: ${err}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-screen bg-black text-white">
        <div 
          className="relative z-10 container mx-auto px-4"
          style={{
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 120px, black 100%)",
          }}
        >
          <div className="mb-8 pt-32 md:pt-40">
            <h1 className="text-4xl font-bold mb-2">Account Settings</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      <div 
        className="relative z-10 container mx-auto px-4"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 120px, black 100%)",
        }}
      >
        <div className="mb-8 pt-32 md:pt-40">
          <h1 className="text-4xl font-bold mb-2">Account Settings</h1>
          <p className="text-muted-foreground">Manage your account details and preferences</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Details */}
          <Card className="bg-background/80 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile?.email || ""}
                  disabled
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label htmlFor="discordName">Discord Name</Label>
                <Input
                  id="discordName"
                  value={discordName}
                  onChange={(e) => setDiscordName(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card className="bg-background/80 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="shippingLine1">Address Line 1</Label>
                <Input
                  id="shippingLine1"
                  value={shippingLine1}
                  onChange={(e) => setShippingLine1(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label htmlFor="shippingLine2">Address Line 2</Label>
                <Input
                  id="shippingLine2"
                  value={shippingLine2}
                  onChange={(e) => setShippingLine2(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="shippingCity">City</Label>
                  <Input
                    id="shippingCity"
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <Label htmlFor="shippingState">State</Label>
                  <Input
                    id="shippingState"
                    value={shippingState}
                    onChange={(e) => setShippingState(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="shippingZip">ZIP Code</Label>
                <Input
                  id="shippingZip"
                  value={shippingZip}
                  onChange={(e) => setShippingZip(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Crypto Wallets */}
          <Card className="bg-background/80 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle>Crypto Wallets</CardTitle>
            </CardHeader>
            <CardContent>
              {wallets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No wallets added yet.</p>
              ) : (
                <div className="space-y-3">
                  {wallets.map((wallet) => (
                    <div key={wallet.id} className="flex items-center justify-between p-3 border rounded-lg border-white/10">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{wallet.chain}</div>
                        <div className="text-xs text-muted-foreground truncate">{wallet.address}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="md:col-span-2">
            <Button 
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full md:w-auto"
            >
              {saving ? "Saving..." : "[Save Changes]"}
            </Button>
            {profile?.profileComplete && (
              <p className="text-sm text-green-400 mt-2">✓ Profile is complete</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}