import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { shipments, orders, orderItems } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { getTrackingUrl } from '@/lib/tracking'
import { z } from 'zod'

const patchShipmentSchema = z.object({
  carrier: z.string().min(1).optional(),
  trackingNumber: z.string().min(1).optional(),
  estimatedDelivery: z.string().datetime({ offset: true }).nullable().optional(),
  deliveredAt: z.string().datetime({ offset: true }).nullable().optional(),
  isPartial: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  markDelivered: z.boolean().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const [shipment] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.id, id))
      .limit(1)

    if (!shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...shipment,
      shippedAt: shipment.shippedAt?.toISOString() ?? null,
      estimatedDelivery: shipment.estimatedDelivery?.toISOString() ?? null,
      deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('GET /api/admin/shipments/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = patchShipmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: shipments.id, orderId: shipments.orderId, carrier: shipments.carrier, trackingNumber: shipments.trackingNumber })
      .from(shipments)
      .where(eq(shipments.id, id))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })
    }

    const now = new Date()
    const updateData: Record<string, unknown> = { updatedAt: now }

    if (parsed.data.carrier !== undefined) updateData.carrier = parsed.data.carrier
    if (parsed.data.trackingNumber !== undefined) updateData.trackingNumber = parsed.data.trackingNumber
    if (parsed.data.estimatedDelivery !== undefined) {
      updateData.estimatedDelivery = parsed.data.estimatedDelivery ? new Date(parsed.data.estimatedDelivery) : null
    }
    if (parsed.data.isPartial !== undefined) updateData.isPartial = parsed.data.isPartial
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes

    // Regenerate tracking URL if carrier or tracking number changed
    const newCarrier = (parsed.data.carrier ?? existing.carrier) as string | null
    const newTrackingNumber = (parsed.data.trackingNumber ?? existing.trackingNumber) as string | null
    if (parsed.data.carrier !== undefined || parsed.data.trackingNumber !== undefined) {
      updateData.trackingUrl =
        newCarrier && newTrackingNumber ? getTrackingUrl(newCarrier, newTrackingNumber) || null : null
    }

    // Handle mark delivered
    if (parsed.data.markDelivered) {
      updateData.deliveredAt = now
      // Update order to completed and all items to delivered
      await db
        .update(orders)
        .set({ orderStatus: 'completed', updatedAt: now })
        .where(eq(orders.id, existing.orderId))
      await db
        .update(orderItems)
        .set({ fulfillmentStatus: 'delivered', updatedAt: now })
        .where(eq(orderItems.orderId, existing.orderId))
    } else if (parsed.data.deliveredAt !== undefined) {
      updateData.deliveredAt = parsed.data.deliveredAt ? new Date(parsed.data.deliveredAt) : null
    }

    const [updated] = await db
      .update(shipments)
      .set(updateData as Partial<typeof shipments.$inferInsert>)
      .where(eq(shipments.id, id))
      .returning()

    await logAdminAction({
      adminUserId: session!.user!.id,
      actionType: 'shipment_updated',
      targetType: 'shipment',
      targetId: id,
      payload: { ...parsed.data, orderId: existing.orderId },
      request,
    })

    return NextResponse.json({
      id: updated.id,
      orderId: updated.orderId,
      carrier: updated.carrier,
      trackingNumber: updated.trackingNumber,
      trackingUrl: updated.trackingUrl,
      trackingImageUrl: updated.trackingImageUrl,
      shippedAt: updated.shippedAt?.toISOString() ?? null,
      estimatedDelivery: updated.estimatedDelivery?.toISOString() ?? null,
      deliveredAt: updated.deliveredAt?.toISOString() ?? null,
      isPartial: updated.isPartial,
      notes: updated.notes,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('PATCH /api/admin/shipments/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
