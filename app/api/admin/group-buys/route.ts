import { NextResponse } from 'next/server'
import { isNull } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuys, acceptedPayments, products } from '@/db/schema'
import { auth } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

function requireAdmin(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.id || session.user.role !== 'admin') return false
  return true
}

const createSchema = z.object({
  name: z.string().min(1).default('Untitled Campaign'),
  creatorDisplayName: z.string().optional().default(''),
  description: z.string().optional().default(''),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!requireAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const allGroupBuys = await db
      .select({
        id: groupBuys.id,
        name: groupBuys.name,
        creatorDisplayName: groupBuys.creatorDisplayName,
        description: groupBuys.description,
        imageUrl: groupBuys.imageUrl,
        status: groupBuys.status,
        endDate: groupBuys.endDate,
        publicLaunchTime: groupBuys.publicLaunchTime,
        totalMoqGoal: groupBuys.totalMoqGoal,
        totalKitsOrdered: groupBuys.totalKitsOrdered,
        adminFeeUsd: groupBuys.adminFeeUsd,
        shippingFeeUsd: groupBuys.shippingFeeUsd,
        paymentWalletAddress: groupBuys.paymentWalletAddress,
        supportedNetworks: groupBuys.supportedNetworks,
        metadata: groupBuys.metadata,
        createdAt: groupBuys.createdAt,
        updatedAt: groupBuys.updatedAt,
      })
      .from(groupBuys)
      .where(isNull(groupBuys.deletedAt))
      .orderBy(groupBuys.createdAt)

    // Fetch all accepted_payments and products for these campaigns
    const gbIds = allGroupBuys.map((gb) => gb.id)
    let payments: Array<{ id: string; groupBuyId: string; token: string; walletAddress: string; network: string }> = []
    let prods: Array<{
      id: string
      groupBuyId: string
      name: string
      peptideName: string | null
      massDosage: string | null
      moq: number
      priceUsd: string
      kitsOrdered: number
      manualAdjustment: number
      dimLengthIn: string | null
      dimWidthIn: string | null
      dimHeightIn: string | null
      weightOz: string | null
      deletedAt: Date | null
    }> = []

    if (gbIds.length > 0) {
      payments = await db.select().from(acceptedPayments)
      prods = await db
        .select()
        .from(products)
        .where(isNull(products.deletedAt))
    }

    const paymentsByGb: Record<string, typeof payments> = {}
    for (const p of payments) {
      if (!paymentsByGb[p.groupBuyId]) paymentsByGb[p.groupBuyId] = []
      paymentsByGb[p.groupBuyId].push(p)
    }

    const prodsByGb: Record<string, typeof prods> = {}
    for (const p of prods) {
      if (!prodsByGb[p.groupBuyId]) prodsByGb[p.groupBuyId] = []
      prodsByGb[p.groupBuyId].push(p)
    }

    const result = allGroupBuys.map((gb) => mapToCampaign(gb, paymentsByGb[gb.id] ?? [], prodsByGb[gb.id] ?? []))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/admin/group-buys error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!requireAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const [newGb] = await db
      .insert(groupBuys)
      .values({
        name: parsed.data.name,
        creatorDisplayName: parsed.data.creatorDisplayName,
        description: parsed.data.description,
        status: 'draft',
        createdBy: session!.user!.id,
        metadata: { finalPaymentInfo: {}, cryptoFeeOptions: [], boxSizes: [], defaultPaddingFactor: 0 },
      })
      .returning()

    await logAdminAction({
      adminUserId: session!.user!.id,
      actionType: 'group_buy_created',
      targetType: 'group_buy',
      targetId: newGb.id,
      payload: { name: newGb.name },
      request,
    })

    return NextResponse.json(mapToCampaign(newGb, [], []), { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/group-buys error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Maps DB row + related data to the Campaign shape expected by the frontend
export function mapToCampaign(
  gb: {
    id: string
    name: string
    creatorDisplayName: string | null
    description: string | null
    imageUrl: string | null
    status: string
    endDate: Date | null
    publicLaunchTime: Date | null
    totalMoqGoal: number
    totalKitsOrdered: number
    adminFeeUsd: string
    shippingFeeUsd: string
    metadata: unknown
    createdAt: Date
    updatedAt: Date
  },
  payments: Array<{ id: string; token: string; walletAddress: string; network?: string }>,
  prods: Array<{
    id: string
    peptideName: string | null
    massDosage: string | null
    moq: number
    priceUsd: string
    kitsOrdered: number
    manualAdjustment: number
    dimLengthIn: string | null
    dimWidthIn: string | null
    dimHeightIn: string | null
    weightOz: string | null
  }>,
) {
  const meta = (gb.metadata as Record<string, unknown> | null) ?? {}

  return {
    id: gb.id,
    name: gb.name,
    creatorDisplayName: gb.creatorDisplayName ?? '',
    description: gb.description ?? '',
    imageUrl: gb.imageUrl ?? undefined,
    status: gb.status as 'draft' | 'active' | 'closed',
    deadline: gb.endDate ? gb.endDate.toISOString().split('T')[0] : undefined,
    publicLaunchTime: gb.publicLaunchTime ? gb.publicLaunchTime.toISOString().slice(0, 16) : undefined,
    totalMOQ: gb.totalMoqGoal,
    adminFee: parseFloat(gb.adminFeeUsd),
    shippingFee: parseFloat(gb.shippingFeeUsd),
    acceptedPayments: payments.map((p) => ({ id: p.id, token: p.token, walletAddress: p.walletAddress })),
    finalPaymentInfo: (meta.finalPaymentInfo as Record<string, string>) ?? {},
    cryptoFeeOptions: (meta.cryptoFeeOptions as Array<{ id: string; token: string; walletAddress: string }>) ?? [],
    products: prods.map((p) => ({
      id: p.id,
      peptideName: p.peptideName ?? '',
      massDosage: p.massDosage ?? '',
      moq: p.moq,
      price: parseFloat(p.priceUsd),
      orderedCount: p.kitsOrdered,
      manualAdjustment: p.manualAdjustment,
      dimensions: {
        length: p.dimLengthIn ? parseFloat(p.dimLengthIn) : 0,
        width: p.dimWidthIn ? parseFloat(p.dimWidthIn) : 0,
        height: p.dimHeightIn ? parseFloat(p.dimHeightIn) : 0,
        weight: p.weightOz ? parseFloat(p.weightOz) : 0,
      },
    })),
    boxSizes: (meta.boxSizes as unknown[]) ?? [],
    defaultPaddingFactor: (meta.defaultPaddingFactor as number) ?? 0,
    createdAt: gb.createdAt.toISOString(),
    updatedAt: gb.updatedAt.toISOString(),
  }
}
