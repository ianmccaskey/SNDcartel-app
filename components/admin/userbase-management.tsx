"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { AdminUser } from "@/lib/admin-types"
import type { Order } from "@/lib/types"
import { loadFromStorage } from "@/lib/storage"
import { Search } from "lucide-react"
import { UserDetailOverlay } from "./user-detail-overlay"

export function UserbaseManagement() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = () => {
    const storedOrders = loadFromStorage<Order[]>("orders") || []

    const testUndeliveredOrder: Order = {
      id: "test-order-active",
      groupBuyId: "snd-never-die",
      groupBuyTitle: "SND NEVER DIE Inaugural Group Buy",
      status: "Submitted",
      items: [
        {
          productId: "tirzepatide-30",
          name: "Tirzepatide 30mg",
          quantity: 3,
          price: 85,
          fulfillmentStatus: "Awaiting Vendor",
        },
        {
          productId: "ss-31-50",
          name: "SS-31 (Elamipretide) 50mg",
          quantity: 2,
          price: 95,
          fulfillmentStatus: "Awaiting Vendor",
        },
      ],
      totalCost: 445,
      chain: "Ethereum",
      txUrl: "https://etherscan.io/tx/0xabc123def456",
      submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    }

    const allOrders = [testUndeliveredOrder, ...storedOrders]
    setOrders(allOrders)

    const uniqueUsers = new Map<string, AdminUser>()
    allOrders.forEach((order, idx) => {
      const userId = `user-${idx + 1}`
      if (!uniqueUsers.has(userId)) {
        uniqueUsers.set(userId, {
          id: userId,
          name: `User ${idx + 1}`,
          email: `user${idx + 1}@example.com`,
          discordName: `discord_user${idx + 1}`,
          phoneNumber: `+1 (555) ${String(idx + 1).padStart(3, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
          walletAddresses: order.txUrl ? [order.txUrl.split("/").pop() || ""] : [],
          orderHistory: [order.id],
          createdAt: order.submittedAt || new Date().toISOString(),
          accountStatus: "Active",
          totalSpent: order.totalCost || order.total || 0,
          lastLoginAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          shippingAddress: {
            line1: `${Math.floor(Math.random() * 9999) + 1} Main Street`,
            line2: idx % 2 === 0 ? `Apt ${Math.floor(Math.random() * 99) + 1}` : undefined,
            city: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"][idx % 5],
            state: ["NY", "CA", "IL", "TX", "AZ"][idx % 5],
            zip: String(10000 + Math.floor(Math.random() * 89999)),
            country: "USA",
          },
          notes: idx % 3 === 0 ? "Preferred customer. Fast payment history." : undefined,
        })
      }
    })

    setUsers(Array.from(uniqueUsers.values()))
  }

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const getUserOrders = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (!user) return []
    return orders.filter((o) => user.orderHistory.includes(o.id))
  }

  const handleUserClick = (user: AdminUser) => {
    setSelectedUser(user)
  }

  const handleUpdateOrders = (updatedOrders: Order[]) => {
    setOrders(updatedOrders)
    loadUsers() // Reload users to reflect changes
  }

  return (
    <div className="space-y-6">
      <Card className="bg-background/60 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle>User Management</CardTitle>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Wallet Addresses</TableHead>
                <TableHead>Orders</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const userOrders = getUserOrders(user.id)

                return (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => handleUserClick(user)}
                  >
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.walletAddresses.slice(0, 2).map((addr, idx) => (
                          <code key={idx} className="text-xs">
                            {addr.slice(0, 10)}...
                          </code>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{userOrders.length}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedUser && (
        <UserDetailOverlay
          user={selectedUser}
          orders={getUserOrders(selectedUser.id)}
          onClose={() => setSelectedUser(null)}
          onUpdateOrders={handleUpdateOrders}
        />
      )}
    </div>
  )
}
