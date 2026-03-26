import { NextResponse } from 'next/server'
import { isNull } from 'drizzle-orm'
import { db } from '@/db'
import { storeProducts } from '@/db/schema'
import { auth } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  category: z.string().optional().default('Uncategorized'),
  price: z.number().min(0),
  available: z.boolean().optional().default(true),
  imageUrl: z.string().optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const all = await db
      .select()
      .from(storeProducts)
      .where(isNull(storeProducts.deletedAt))
      .orderBy(storeProducts.sortOrder, storeProducts.createdAt)

    return NextResponse.json(
      all.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? '',
        category: p.category,
        price: parseFloat(p.priceUsd),
        available: p.available,
        imageUrl: p.imageUrl ?? undefined,
        createdAt: p.createdAt.toISOString(),
      })),
    )
  } catch (error) {
    console.error('GET /api/admin/store/products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { name, description, category, price, available, imageUrl } = parsed.data

    const [newProduct] = await db
      .insert(storeProducts)
      .values({
        name,
        description: description || null,
        category,
        priceUsd: price.toFixed(2),
        available,
        imageUrl: imageUrl ?? null,
      })
      .returning()

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'store_product_created',
      targetType: 'store_product',
      targetId: newProduct.id,
      payload: { name },
      request,
    })

    return NextResponse.json(
      {
        id: newProduct.id,
        name: newProduct.name,
        description: newProduct.description ?? '',
        category: newProduct.category,
        price: parseFloat(newProduct.priceUsd),
        available: newProduct.available,
        imageUrl: newProduct.imageUrl ?? undefined,
        createdAt: newProduct.createdAt.toISOString(),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('POST /api/admin/store/products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
