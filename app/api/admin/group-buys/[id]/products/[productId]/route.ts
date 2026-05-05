import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuys, products } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const updateSchema = z.object({
  peptideName: z.string().optional(),
  massDosage: z.string().optional(),
  moq: z.number().int().min(1).optional(),
  price: z.number().min(0).optional(),
  manualAdjustment: z.number().int().optional(),
  dimensions: z
    .object({
      length: z.number().min(0),
      width: z.number().min(0),
      height: z.number().min(0),
      weight: z.number().min(0),
    })
    .optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: groupBuyId, productId } = await params

    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!existing || existing.deletedAt || existing.groupBuyId !== groupBuyId) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { dimensions, price, moq, ...rest } = parsed.data
    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (rest.peptideName !== undefined) updateData.peptideName = rest.peptideName || null
    if (rest.massDosage !== undefined) updateData.massDosage = rest.massDosage || null
    if (moq !== undefined) updateData.moq = moq
    if (price !== undefined) updateData.priceUsd = price.toFixed(2)
    if (rest.manualAdjustment !== undefined) updateData.manualAdjustment = rest.manualAdjustment

    if (dimensions !== undefined) {
      updateData.dimLengthIn = dimensions.length ? dimensions.length.toFixed(3) : null
      updateData.dimWidthIn = dimensions.width ? dimensions.width.toFixed(3) : null
      updateData.dimHeightIn = dimensions.height ? dimensions.height.toFixed(3) : null
      updateData.weightOz = dimensions.weight ? dimensions.weight.toFixed(3) : null
    }

    // Recompute name
    const newPeptide = (rest.peptideName ?? existing.peptideName) ?? ''
    const newDosage = (rest.massDosage ?? existing.massDosage) ?? ''
    updateData.name = [newPeptide, newDosage].filter(Boolean).join(' ') || existing.name

    await db.update(products).set(updateData).where(eq(products.id, productId))

    // Recalculate campaign totalMoqGoal
    const allProds = await db
      .select({ moq: products.moq })
      .from(products)
      .where(and(eq(products.groupBuyId, groupBuyId), isNull(products.deletedAt)))

    const totalMoq = allProds.reduce((s, p) => s + p.moq, 0) || 1
    await db.update(groupBuys).set({ totalMoqGoal: totalMoq, updatedAt: new Date() }).where(eq(groupBuys.id, groupBuyId))

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'product_updated',
      targetType: 'product',
      targetId: productId,
      payload: { groupBuyId, updates: parsed.data },
      request,
    })

    const [updated] = await db.select().from(products).where(eq(products.id, productId)).limit(1)

    return NextResponse.json({
      id: updated.id,
      peptideName: updated.peptideName ?? '',
      massDosage: updated.massDosage ?? '',
      moq: updated.moq,
      price: parseFloat(updated.priceUsd),
      orderedCount: updated.kitsOrdered,
      manualAdjustment: updated.manualAdjustment,
      dimensions: {
        length: updated.dimLengthIn ? parseFloat(updated.dimLengthIn) : 0,
        width: updated.dimWidthIn ? parseFloat(updated.dimWidthIn) : 0,
        height: updated.dimHeightIn ? parseFloat(updated.dimHeightIn) : 0,
        weight: updated.weightOz ? parseFloat(updated.weightOz) : 0,
      },
    })
  } catch (error) {
    console.error('PATCH /api/admin/group-buys/[id]/products/[productId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: groupBuyId, productId } = await params

    const [existing] = await db
      .select({ id: products.id, name: products.name, groupBuyId: products.groupBuyId, deletedAt: products.deletedAt })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!existing || existing.deletedAt || existing.groupBuyId !== groupBuyId) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, productId))

    // Recalculate campaign totalMoqGoal
    const remaining = await db
      .select({ moq: products.moq })
      .from(products)
      .where(and(eq(products.groupBuyId, groupBuyId), isNull(products.deletedAt)))

    const totalMoq = remaining.reduce((s, p) => s + p.moq, 0) || 1
    await db.update(groupBuys).set({ totalMoqGoal: totalMoq, updatedAt: new Date() }).where(eq(groupBuys.id, groupBuyId))

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'product_deleted',
      targetType: 'product',
      targetId: productId,
      payload: { groupBuyId, name: existing.name },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/admin/group-buys/[id]/products/[productId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
