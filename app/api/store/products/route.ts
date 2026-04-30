import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { storeProducts } from '@/db/schema'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const conditions = [eq(storeProducts.available, true), isNull(storeProducts.deletedAt)]
    if (category) {
      conditions.push(eq(storeProducts.category, category))
    }

    const products = await db
      .select({
        id: storeProducts.id,
        name: storeProducts.name,
        description: storeProducts.description,
        category: storeProducts.category,
        priceUsd: storeProducts.priceUsd,
        imageUrl: storeProducts.imageUrl,
        available: storeProducts.available,
      })
      .from(storeProducts)
      .where(and(...conditions))
      .orderBy(storeProducts.sortOrder, storeProducts.createdAt)

    return NextResponse.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? '',
        category: p.category,
        price: parseFloat(p.priceUsd),
        imageUrl: p.imageUrl ?? null,
        available: p.available,
      })),
    )
  } catch (error) {
    console.error('GET /api/store/products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
