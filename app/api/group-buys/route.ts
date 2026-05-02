import { NextResponse } from 'next/server'
import { and, eq, or, isNull, gt, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuys, products } from '@/db/schema'

export async function GET() {
  try {
    const now = new Date()

    const activeGroupBuys = await db
      .select({
        id: groupBuys.id,
        name: groupBuys.name,
        description: groupBuys.description,
        endDate: groupBuys.endDate,
        totalKitsOrdered: groupBuys.totalKitsOrdered,
        totalMoqGoal: groupBuys.totalMoqGoal,
        status: groupBuys.status,
        imageUrl: groupBuys.imageUrl,
      })
      .from(groupBuys)
      .where(
        and(
          eq(groupBuys.status, 'active'),
          isNull(groupBuys.deletedAt),
          or(isNull(groupBuys.endDate), gt(groupBuys.endDate, now)),
        ),
      )
      .orderBy(groupBuys.createdAt)

    // Bulk-fetch products for all active group buys (one query, then group in JS).
    const groupBuyIds = activeGroupBuys.map((gb) => gb.id)
    const productRows =
      groupBuyIds.length > 0
        ? await db
            .select({
              id: products.id,
              name: products.name,
              groupBuyId: products.groupBuyId,
              sortOrder: products.sortOrder,
            })
            .from(products)
            .where(and(inArray(products.groupBuyId, groupBuyIds), isNull(products.deletedAt)))
            .orderBy(products.sortOrder, products.createdAt)
        : []

    const productsByGroupBuyId = new Map<string, Array<{ id: string; name: string }>>()
    for (const p of productRows) {
      if (!productsByGroupBuyId.has(p.groupBuyId)) {
        productsByGroupBuyId.set(p.groupBuyId, [])
      }
      productsByGroupBuyId.get(p.groupBuyId)!.push({ id: p.id, name: p.name })
    }

    // Map to the shape the UI expects (matches lib/types GroupBuy)
    const result = activeGroupBuys.map((gb) => ({
      id: gb.id,
      title: gb.name,
      description: gb.description ?? '',
      endDate: gb.endDate ? gb.endDate.toISOString() : '',
      totalKitsOrdered: gb.totalKitsOrdered,
      totalMoqGoal: gb.totalMoqGoal,
      imageUrl: gb.imageUrl,
      products: productsByGroupBuyId.get(gb.id) ?? [],
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/group-buys error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
