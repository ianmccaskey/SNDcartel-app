"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Assignment {
  assignmentId: string
  operatorId: string
  operatorEmail: string
  operatorName: string | null
  createdAt: string
}

interface OperatorCandidate {
  id: string
  email: string
  fullName: string | null
}

interface Props {
  campaignId: string
}

/**
 * Admin-only section in the campaign editor for assigning operator-role users
 * to this campaign. The endpoint refuses non-operator targets, so the candidate
 * list pre-filters to role=operator. Operators are not shown this section at
 * all (the parent gates by role).
 */
export function CampaignOperatorsCard({ campaignId }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [candidates, setCandidates] = useState<OperatorCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<string>("")
  const [assigning, setAssigning] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/group-buys/${campaignId}/operators`)
      if (!res.ok) throw new Error(`Failed to load assignments (${res.status})`)
      const data = (await res.json()) as Assignment[]
      setAssignments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments")
    }
  }, [campaignId])

  const fetchCandidates = useCallback(async () => {
    try {
      // The admin users list returns every user; filter client-side to operators.
      const res = await fetch("/api/admin/users")
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`)
      const data = (await res.json()) as Array<{ id: string; email: string; fullName: string | null; role: string }>
      setCandidates(data.filter((u) => u.role === "operator"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users")
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAssignments(), fetchCandidates()]).finally(() => setLoading(false))
  }, [fetchAssignments, fetchCandidates])

  const assign = async () => {
    if (!selectedCandidate) return
    setAssigning(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/group-buys/${campaignId}/operators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatorId: selectedCandidate }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? "Assignment failed")
      }
      setSelectedCandidate("")
      await fetchAssignments()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed")
    } finally {
      setAssigning(false)
    }
  }

  const removeAssignment = async (operatorId: string) => {
    setRemovingId(operatorId)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/group-buys/${campaignId}/operators/${operatorId}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error(`Remove failed (${res.status})`)
      await fetchAssignments()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed")
    } finally {
      setRemovingId(null)
    }
  }

  const assignableCandidates = candidates.filter(
    (c) => !assignments.some((a) => a.operatorId === c.id),
  )

  return (
    <Card className="bg-black/60 backdrop-blur-md border-white/10 overflow-hidden">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="flex items-center gap-2 text-white">
          <UserPlus className="w-4 h-4 text-[#FFC700]" />
          Operators
        </CardTitle>
        <p className="text-xs text-gray-400 mt-1">
          Operator-role users assigned here can manage this campaign — view orders,
          verify payments, mark fulfillment. They cannot manage users or the store.
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Current assignments */}
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-500">No operators assigned yet.</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li
                    key={a.assignmentId}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">
                        {a.operatorName || a.operatorEmail}
                      </p>
                      {a.operatorName && (
                        <p className="text-xs text-gray-400 truncate">{a.operatorEmail}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAssignment(a.operatorId)}
                      disabled={removingId === a.operatorId}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8"
                    >
                      {removingId === a.operatorId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add new assignment */}
            <div className="flex gap-2 pt-2 border-t border-white/10">
              <Select
                value={selectedCandidate}
                onValueChange={setSelectedCandidate}
                disabled={assigning || assignableCandidates.length === 0}
              >
                <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white">
                  <SelectValue
                    placeholder={
                      assignableCandidates.length === 0
                        ? "No operators available — promote a user first"
                        : "Select an operator to assign…"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur-md border-white/10 text-white">
                  {assignableCandidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName ? `${c.fullName} (${c.email})` : c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={assign}
                disabled={!selectedCandidate || assigning}
                className="bg-[#FFC700] hover:bg-[#E6B300] text-black"
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}
