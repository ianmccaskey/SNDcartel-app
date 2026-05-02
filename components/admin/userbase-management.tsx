"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserDetailOverlay } from "./user-detail-overlay"

interface AdminUserRow {
  id: string
  email: string
  fullName: string | null
  discordName: string | null
  accountStatus: string
  profileComplete: boolean
  role: string
  orderCount: number
  createdAt: string
  lastLoginAt: string | null
  notes: string | null
}

export function UserbaseManagement() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "100" })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      setUsers(data.users)
      setTotal(data.pagination.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return (
    <div className="space-y-6">
      <Card className="bg-background/60 backdrop-blur-md border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Management</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchUsers}
              disabled={loading}
              className="text-muted-foreground hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">{total} registered user{total !== 1 ? "s" : ""}</p>
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name or email..."
                className="pl-10 bg-background/40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && users.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {debouncedSearch ? "No users match your search." : "No registered users yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Discord</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <TableCell>
                      <p className="font-medium text-white">{user.fullName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                      {user.discordName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.accountStatus === "active"
                            ? "bg-green-500/20 text-green-400"
                            : user.accountStatus === "suspended"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }
                      >
                        {user.accountStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.orderCount}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedUserId && (
        <UserDetailOverlay
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onUpdated={fetchUsers}
        />
      )}
    </div>
  )
}
