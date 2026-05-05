"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Users, ShoppingCart, DollarSign, Package, Clock, RefreshCw } from "lucide-react"

interface OverviewStats {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  activeGroupBuys: number
  pendingPayments: number
}

interface OrderDataPoint {
  date: string
  count: number
  revenue: number
}

interface RevenueByGroupBuy {
  groupBuyId: string | null
  name: string | null
  orderCount: number
  revenue: number
}

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  color = "text-[#FFC700]",
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  subtitle?: string
  color?: string
}) {
  return (
    <Card className="bg-background/60 backdrop-blur-md border-white/10">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide font-mono">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="p-2 bg-white/5 rounded border border-white/10">
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "rgba(0,0,0,0.85)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "6px",
  color: "#fff",
  fontSize: 12,
}

export function AnalyticsDashboard() {
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [orderData, setOrderData] = useState<OrderDataPoint[]>([])
  const [revenueData, setRevenueData] = useState<RevenueByGroupBuy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [overviewRes, ordersRes, revenueRes] = await Promise.all([
        fetch("/api/admin/analytics/overview"),
        fetch("/api/admin/analytics/orders"),
        fetch("/api/admin/analytics/revenue"),
      ])

      if (!overviewRes.ok || !ordersRes.ok || !revenueRes.ok) {
        throw new Error("Failed to fetch analytics data")
      }

      const [overviewData, ordersData, revenueData] = await Promise.all([
        overviewRes.json(),
        ordersRes.json(),
        revenueRes.json(),
      ])

      setOverview(overviewData)
      setOrderData(ordersData.data ?? [])
      setRevenueData(revenueData.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 animate-spin text-[#FFC700]" />
        <span className="ml-3 text-muted-foreground">Loading analytics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-red-400 mb-4">{error}</p>
        <Button onClick={fetchAll} variant="outline" size="sm">
          Retry
        </Button>
      </div>
    )
  }

  const formatRevenue = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`

  const formatDate = (d: string) => {
    const date = new Date(d)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Analytics Overview</h2>
          <p className="text-sm text-muted-foreground">Platform metrics and revenue data</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchAll}
          className="text-muted-foreground hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Users"
          value={overview?.totalUsers.toLocaleString() ?? "—"}
          icon={Users}
        />
        <StatCard
          title="Total Orders"
          value={overview?.totalOrders.toLocaleString() ?? "—"}
          icon={ShoppingCart}
        />
        <StatCard
          title="Total Revenue"
          value={overview ? formatRevenue(overview.totalRevenue) : "—"}
          icon={DollarSign}
        />
        <StatCard
          title="Active Group Buys"
          value={overview?.activeGroupBuys ?? "—"}
          icon={Package}
          color="text-green-400"
        />
        <StatCard
          title="Pending Payments"
          value={overview?.pendingPayments ?? "—"}
          icon={Clock}
          color={overview && overview.pendingPayments > 0 ? "text-yellow-400" : "text-muted-foreground"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders over time */}
        <Card className="bg-background/60 backdrop-blur-md border-white/10">
          <CardHeader>
            <CardTitle className="text-base">Orders — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {orderData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">No order data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={orderData.map((d) => ({ ...d, date: formatDate(d.date) }))}>
                  <defs>
                    <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFC700" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FFC700" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#888", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Orders"
                    stroke="#FFC700"
                    strokeWidth={2}
                    fill="url(#orderGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue over time */}
        <Card className="bg-background/60 backdrop-blur-md border-white/10">
          <CardHeader>
            <CardTitle className="text-base">Revenue — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {orderData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">No revenue data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={orderData.map((d) => ({ ...d, date: formatDate(d.date) }))}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fill: "#888", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#revGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Group Buy */}
      <Card className="bg-background/60 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Revenue by Group Buy (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">No group buy revenue data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={revenueData.map((d) => ({
                  name: d.name ?? "Store",
                  revenue: d.revenue,
                  orders: d.orderCount,
                }))}
                layout="vertical"
                margin={{ left: 8, right: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#888", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#ccc", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(v: number, name: string) => [
                    name === "revenue" ? `$${v.toFixed(2)}` : v,
                    name === "revenue" ? "Revenue" : "Orders",
                  ]}
                />
                <Bar dataKey="revenue" name="revenue" fill="#FFC700" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
