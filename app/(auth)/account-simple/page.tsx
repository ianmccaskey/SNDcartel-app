"use client"

import { useState, useEffect } from "react"

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

export default function SimpleAccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/users/me")
        if (res.ok) {
          const data = await res.json()
          setProfile(data)
        } else {
          setError(`Failed to load profile: ${res.status}`)
        }
      } catch (err) {
        setError(`Error: ${err}`)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <h1 className="text-2xl font-bold mb-4">Account Settings</h1>
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <h1 className="text-2xl font-bold mb-4">Account Settings</h1>
        <p className="text-red-400">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Account Settings</h1>
      
      {profile ? (
        <div className="space-y-4">
          <div>
            <strong>Email:</strong> {profile.email}
          </div>
          <div>
            <strong>Role:</strong> {profile.role}
          </div>
          <div>
            <strong>Full Name:</strong> {profile.fullName || "Not set"}
          </div>
          <div>
            <strong>Discord Name:</strong> {profile.discordName || "Not set"}
          </div>
          <div>
            <strong>Profile Complete:</strong> {profile.profileComplete ? "Yes" : "No"}
          </div>
          <div>
            <strong>Shipping Address:</strong>
            <br />
            {profile.shippingLine1 || "Not set"}
            {profile.shippingLine2 && (
              <>
                <br />
                {profile.shippingLine2}
              </>
            )}
            {profile.shippingCity && (
              <>
                <br />
                {profile.shippingCity}, {profile.shippingState} {profile.shippingZip}
              </>
            )}
          </div>
        </div>
      ) : (
        <p>No profile data</p>
      )}
    </div>
  )
}