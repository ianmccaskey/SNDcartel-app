import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuys, products, acceptedPayments } from '@/db/schema'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const [gb] = await db
      .select()
      .from(groupBuys)
      .where(and(eq(groupBuys.id, id), isNull(groupBuys.deletedAt)))
      .limit(1)

    if (!gb) {
      return NextResponse.json({ error: 'Group buy not found' }, { status: 404 })
    }

    const [gbProducts, gbPayments] = await Promise.all([
      db
        .select()
        .from(products)
        .where(and(eq(products.groupBuyId, id), isNull(products.deletedAt)))
        .orderBy(products.sortOrder, products.createdAt),
      db
        .select()
        .from(acceptedPayments)
        .where(eq(acceptedPayments.groupBuyId, id)),
    ])

    // Build paymentInfo string from accepted payments
    const paymentInfo =
      gbPayments.length > 0
        ? gbPayments.map((p) => `${p.token} (${p.network})`).join(', ') + ' ONLY'
        : 'Contact admin for payment details'

    // Map status to UI status
    const uiStatus: 'active' | 'ended' | 'upcoming' =
      gb.status === 'active'
        ? 'active'
        : gb.status === 'draft'
          ? 'upcoming'
          : 'ended'

    const result = {
      id: gb.id,
      title: gb.name,
      description: gb.description ?? '',
      image: gb.imageUrl ?? '/placeholder.svg',
      status: uiStatus,
      endDate: gb.endDate ? gb.endDate.toISOString() : '',
      paymentInfo,
      totalKits: gb.totalKitsOrdered,
      goalKits: gb.totalMoqGoal,
      acceptedPayments: gbPayments.map((p) => ({
        id: p.id,
        token: p.token,
        network: p.network,
        walletAddress: p.walletAddress,
      })),
      products: gbProducts.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? '',
        price: parseFloat(p.priceUsd),
        regularPrice: parseFloat(p.regularPriceUsd ?? p.priceUsd),
        currentQuantity: p.kitsOrdered + p.manualAdjustment,
        goalQuantity: p.moq,
        maxPerUser: p.maxPerUser ?? 10,
        inStock: p.inStock,
      })),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/group-buys/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
