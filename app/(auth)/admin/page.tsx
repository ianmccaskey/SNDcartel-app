"use client"
import { useSession } from "next-auth/react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CampaignManagement } from "@/components/admin/campaign-management"
import { StoreManagement } from "@/components/admin/store-management"
import { UserbaseManagement } from "@/components/admin/userbase-management"
import { PaymentVerification } from "@/components/admin/payment-verification"
import { FulfillmentManagement } from "@/components/admin/fulfillment-management"
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard"

export default function AdminPage() {
  const { data: session } = useSession()
  // Operators are admin-adjacent: they can see analytics/campaigns/payments/
  // fulfillment scoped to their assigned group buys, but never Users (global
  // user management) or Store (standalone catalog).
  const isAdmin = session?.user?.role === "admin"

  // Build the visible tab set so the grid sizing stays in sync.
  const tabs = isAdmin
    ? ["analytics", "campaigns", "store", "users", "payments", "fulfillment"]
    : ["analytics", "campaigns", "payments", "fulfillment"]

  // Tailwind needs literal class names to JIT-compile, so map the count
  // explicitly rather than templating the value in.
  const gridClass =
    tabs.length === 6
      ? "grid-cols-3 sm:grid-cols-6"
      : "grid-cols-2 sm:grid-cols-4"

  return (
    <div className="min-h-screen bg-transparent relative">
      <div
        className="container mx-auto px-4 py-8 max-w-7xl relative z-10"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 120px, black 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 120px, black 100%)",
        }}
      >
        <div className="mb-8 pt-32 md:pt-40">
          <h1 className="text-4xl font-bold mb-2">{isAdmin ? "Admin Panel" : "Operator Panel"}</h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Manage campaigns, store inventory, users, payments, and fulfillment"
              : "Manage your assigned campaigns, payments, and fulfillment"}
          </p>
        </div>

        <Tabs defaultValue="analytics" className="w-full">
          <TabsList
            className={`bg-background/60 backdrop-blur-md border border-white/10 mb-6 grid ${gridClass} h-auto w-full gap-1 sm:gap-4`}
          >
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            {isAdmin && <TabsTrigger value="store">Store</TabsTrigger>}
            {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="campaigns">
            <CampaignManagement />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="store">
              <StoreManagement />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="users">
              <UserbaseManagement />
            </TabsContent>
          )}

          <TabsContent value="payments">
            <PaymentVerification />
          </TabsContent>

          <TabsContent value="fulfillment">
            <FulfillmentManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
