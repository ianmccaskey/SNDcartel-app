import { NextResponse } from 'next/server'
import { and, eq, or, isNull, gt } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuys } from '@/db/schema'

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

    // Map to the shape the UI expects (matches lib/types GroupBuy)
    const result = activeGroupBuys.map((gb) => ({
      id: gb.id,
      title: gb.name,
      description: gb.description ?? '',
      endDate: gb.endDate ? gb.endDate.toISOString() : '',
      totalKitsOrdered: gb.totalKitsOrdered,
      totalMoqGoal: gb.totalMoqGoal,
      imageUrl: gb.imageUrl,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/group-buys error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
