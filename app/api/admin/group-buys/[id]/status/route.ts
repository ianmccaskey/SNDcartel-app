import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuys } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['closed'],
  closed: ['fulfilled'],
  fulfilled: [],
}

const statusSchema = z.object({
  status: z.enum(['draft', 'active', 'closed', 'fulfilled']),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const parsed = statusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: groupBuys.id, status: groupBuys.status, name: groupBuys.name, deletedAt: groupBuys.deletedAt })
      .from(groupBuys)
      .where(eq(groupBuys.id, id))
      .limit(1)

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { status: newStatus } = parsed.data
    const allowed = VALID_TRANSITIONS[existing.status] ?? []

    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from '${existing.status}' to '${newStatus}'` },
        { status: 422 },
      )
    }

    await db.update(groupBuys).set({ status: newStatus, updatedAt: new Date() }).where(eq(groupBuys.id, id))

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'group_buy_status_changed',
      targetType: 'group_buy',
      targetId: id,
      payload: { from: existing.status, to: newStatus, name: existing.name },
      request,
    })

    return NextResponse.json({ ok: true, id, status: newStatus })
  } catch (error) {
    console.error('PATCH /api/admin/group-buys/[id]/status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
