import { NextResponse } from 'next/server'
import { and, eq, isNull, count, sum } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuys, acceptedPayments, products, orders } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { mapToCampaign } from '../route'
import { z } from 'zod'

// Extract network from token string e.g. "USDC (Ethereum)" → "Ethereum"
function extractNetwork(token: string): string {
  const match = token.match(/\(([^)]+)\)/)
  return match ? match[1] : 'Ethereum'
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  creatorDisplayName: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  publicLaunchTime: z.string().optional().nullable(),
  adminFee: z.number().min(0).optional(),
  shippingFee: z.number().min(0).optional(),
  acceptedPayments: z
    .array(
      z.object({
        id: z.string().optional(),
        token: z.string(),
        walletAddress: z.string(),
      }),
    )
    .optional(),
  metadata: z
    .object({
      finalPaymentInfo: z.record(z.string()).optional(),
      cryptoFeeOptions: z.array(z.object({ id: z.string(), token: z.string(), walletAddress: z.string() })).optional(),
      boxSizes: z.array(z.unknown()).optional(),
      defaultPaddingFactor: z.number().optional(),
    })
    .optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const [gb] = await db
      .select()
      .from(groupBuys)
      .where(eq(groupBuys.id, id))
      .limit(1)

    if (!gb || gb.deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [gbPayments, gbProducts, orderStats] = await Promise.all([
      db.select().from(acceptedPayments).where(eq(acceptedPayments.groupBuyId, id)),
      db
        .select()
        .from(products)
        .where(and(eq(products.groupBuyId, id), isNull(products.deletedAt))),
      db
        .select({ count: count(), total: sum(orders.totalUsd) })
        .from(orders)
        .where(eq(orders.groupBuyId, id)),
    ])

    const campaign = mapToCampaign(gb, gbPayments, gbProducts)
    return NextResponse.json({
      ...campaign,
      orderCount: Number(orderStats[0]?.count ?? 0),
      orderTotal: parseFloat(String(orderStats[0]?.total ?? '0')),
    })
  } catch (error) {
    console.error('GET /api/admin/group-buys/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const [existing] = await db
      .select()
      .from(groupBuys)
      .where(eq(groupBuys.id, id))
      .limit(1)

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { acceptedPayments: newPayments, metadata: newMeta, ...fields } = parsed.data

    // Build update object for main table
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (fields.name !== undefined) updateData.name = fields.name
    if (fields.creatorDisplayName !== undefined) updateData.creatorDisplayName = fields.creatorDisplayName
    if (fields.description !== undefined) updateData.description = fields.description
    if (fields.imageUrl !== undefined) updateData.imageUrl = fields.imageUrl
    if (fields.deadline !== undefined) updateData.endDate = fields.deadline ? new Date(fields.deadline) : null
    if (fields.publicLaunchTime !== undefined)
      updateData.publicLaunchTime = fields.publicLaunchTime ? new Date(fields.publicLaunchTime) : null
    if (fields.adminFee !== undefined) updateData.adminFeeUsd = fields.adminFee.toFixed(2)
    if (fields.shippingFee !== undefined) updateData.shippingFeeUsd = fields.shippingFee.toFixed(2)

    // Merge metadata
    if (newMeta !== undefined) {
      const existingMeta = (existing.metadata as Record<string, unknown>) ?? {}
      updateData.metadata = { ...existingMeta, ...newMeta }
    }

    await db.update(groupBuys).set(updateData).where(eq(groupBuys.id, id))

    // Replace accepted payments if provided
    if (newPayments !== undefined) {
      await db.delete(acceptedPayments).where(eq(acceptedPayments.groupBuyId, id))
      if (newPayments.length > 0) {
        await db.insert(acceptedPayments).values(
          newPayments.map((p) => ({
            groupBuyId: id,
            token: p.token,
            walletAddress: p.walletAddress,
            network: extractNetwork(p.token),
          })),
        )
      }
    }

    // Recalculate totalMoqGoal from products
    const gbProducts = await db
      .select({ moq: products.moq })
      .from(products)
      .where(and(eq(products.groupBuyId, id), isNull(products.deletedAt)))

    const totalMoq = gbProducts.reduce((sum, p) => sum + p.moq, 0) || 1
    await db.update(groupBuys).set({ totalMoqGoal: totalMoq, updatedAt: new Date() }).where(eq(groupBuys.id, id))

    await logAdminAction({
      adminUserId: session!.user!.id,
      actionType: 'group_buy_updated',
      targetType: 'group_buy',
      targetId: id,
      payload: { before: { name: existing.name, status: existing.status }, updates: fields },
      request,
    })

    // Return full updated campaign
    const [updated] = await db.select().from(groupBuys).where(eq(groupBuys.id, id)).limit(1)
    const [updatedPayments, updatedProducts] = await Promise.all([
      db.select().from(acceptedPayments).where(eq(acceptedPayments.groupBuyId, id)),
      db
        .select()
        .from(products)
        .where(and(eq(products.groupBuyId, id), isNull(products.deletedAt))),
    ])

    return NextResponse.json(mapToCampaign(updated, updatedPayments, updatedProducts))
  } catch (error) {
    console.error('PATCH /api/admin/group-buys/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const [existing] = await db
      .select({ id: groupBuys.id, name: groupBuys.name })
      .from(groupBuys)
      .where(eq(groupBuys.id, id))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await db.update(groupBuys).set({ deletedAt: new Date() }).where(eq(groupBuys.id, id))

    await logAdminAction({
      adminUserId: session!.user!.id,
      actionType: 'group_buy_deleted',
      targetType: 'group_buy',
      targetId: id,
      payload: { name: existing.name },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/admin/group-buys/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
