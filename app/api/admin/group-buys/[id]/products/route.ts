import { NextResponse } from 'next/server'
import { eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuys, products } from '@/db/schema'
import { auth } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const addProductSchema = z.object({
  peptideName: z.string().optional().default(''),
  massDosage: z.string().optional().default(''),
  moq: z.number().int().min(1).default(1),
  price: z.number().min(0).default(0),
  manualAdjustment: z.number().int().default(0),
  dimensions: z
    .object({
      length: z.number().min(0).default(0),
      width: z.number().min(0).default(0),
      height: z.number().min(0).default(0),
      weight: z.number().min(0).default(0),
    })
    .optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: groupBuyId } = await params

    const [gb] = await db
      .select({ id: groupBuys.id, deletedAt: groupBuys.deletedAt })
      .from(groupBuys)
      .where(eq(groupBuys.id, groupBuyId))
      .limit(1)

    if (!gb || gb.deletedAt) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = addProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { peptideName, massDosage, moq, price, manualAdjustment, dimensions } = parsed.data

    const name = [peptideName, massDosage].filter(Boolean).join(' ') || 'New Product'

    const [newProduct] = await db
      .insert(products)
      .values({
        groupBuyId,
        name,
        peptideName: peptideName || null,
        massDosage: massDosage || null,
        moq,
        priceUsd: price.toFixed(2),
        manualAdjustment,
        dimLengthIn: dimensions?.length ? dimensions.length.toFixed(3) : null,
        dimWidthIn: dimensions?.width ? dimensions.width.toFixed(3) : null,
        dimHeightIn: dimensions?.height ? dimensions.height.toFixed(3) : null,
        weightOz: dimensions?.weight ? dimensions.weight.toFixed(3) : null,
      })
      .returning()

    // Recalculate totalMoqGoal
    const allProds = await db
      .select({ moq: products.moq })
      .from(products)
      .where(eq(products.groupBuyId, groupBuyId))
      .where(isNull(products.deletedAt))

    const totalMoq = allProds.reduce((s, p) => s + p.moq, 0) || 1
    await db.update(groupBuys).set({ totalMoqGoal: totalMoq, updatedAt: new Date() }).where(eq(groupBuys.id, groupBuyId))

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'product_added',
      targetType: 'product',
      targetId: newProduct.id,
      payload: { groupBuyId, name },
      request,
    })

    return NextResponse.json(
      {
        id: newProduct.id,
        peptideName: newProduct.peptideName ?? '',
        massDosage: newProduct.massDosage ?? '',
        moq: newProduct.moq,
        price: parseFloat(newProduct.priceUsd),
        orderedCount: newProduct.kitsOrdered,
        manualAdjustment: newProduct.manualAdjustment,
        dimensions: {
          length: newProduct.dimLengthIn ? parseFloat(newProduct.dimLengthIn) : 0,
          width: newProduct.dimWidthIn ? parseFloat(newProduct.dimWidthIn) : 0,
          height: newProduct.dimHeightIn ? parseFloat(newProduct.dimHeightIn) : 0,
          weight: newProduct.weightOz ? parseFloat(newProduct.weightOz) : 0,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('POST /api/admin/group-buys/[id]/products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
