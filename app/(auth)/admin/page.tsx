"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CampaignManagement } from "@/components/admin/campaign-management"
import { StoreManagement } from "@/components/admin/store-management"
import { UserbaseManagement } from "@/components/admin/userbase-management"

export default function AdminPage() {
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
          <h1 className="text-4xl font-bold mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">Manage campaigns, store inventory, and users</p>
        </div>

        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="bg-background/60 backdrop-blur-md border border-white/10 mb-6">
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="store">Store</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <CampaignManagement />
          </TabsContent>

          <TabsContent value="store">
            <StoreManagement />
          </TabsContent>

          <TabsContent value="users">
            <UserbaseManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
