import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { storeProducts } from '@/db/schema'
import { auth } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.number().min(0).optional(),
  available: z.boolean().optional(),
  imageUrl: z.string().optional().nullable(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const [existing] = await db
      .select()
      .from(storeProducts)
      .where(eq(storeProducts.id, id))
      .limit(1)

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null
    if (parsed.data.category !== undefined) updateData.category = parsed.data.category
    if (parsed.data.price !== undefined) updateData.priceUsd = parsed.data.price.toFixed(2)
    if (parsed.data.available !== undefined) updateData.available = parsed.data.available
    if (parsed.data.imageUrl !== undefined) updateData.imageUrl = parsed.data.imageUrl

    await db.update(storeProducts).set(updateData).where(eq(storeProducts.id, id))

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'store_product_updated',
      targetType: 'store_product',
      targetId: id,
      payload: { updates: parsed.data },
      request,
    })

    const [updated] = await db.select().from(storeProducts).where(eq(storeProducts.id, id)).limit(1)

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description ?? '',
      category: updated.category,
      price: parseFloat(updated.priceUsd),
      available: updated.available,
      imageUrl: updated.imageUrl ?? undefined,
      createdAt: updated.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('PATCH /api/admin/store/products/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const [existing] = await db
      .select({ id: storeProducts.id, name: storeProducts.name })
      .from(storeProducts)
      .where(eq(storeProducts.id, id))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await db.update(storeProducts).set({ deletedAt: new Date() }).where(eq(storeProducts.id, id))

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'store_product_deleted',
      targetType: 'store_product',
      targetId: id,
      payload: { name: existing.name },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/admin/store/products/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
