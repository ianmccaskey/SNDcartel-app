import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuyOperators, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { logAdminAction } from '@/lib/audit'

// DELETE /api/admin/group-buys/[id]/operators/[operatorId]
// Admin-only: remove an operator's assignment for this group buy.
// Does NOT modify the user's role — to fully demote a user, PATCH the user row.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; operatorId: string }> },
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: groupBuyId, operatorId } = await params

    const [existing] = await db
      .select({ id: groupBuyOperators.id })
      .from(groupBuyOperators)
      .where(
        and(
          eq(groupBuyOperators.groupBuyId, groupBuyId),
          eq(groupBuyOperators.operatorId, operatorId),
        ),
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Look up operator email for the audit log.
    const [target] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, operatorId))
      .limit(1)

    await db.delete(groupBuyOperators).where(eq(groupBuyOperators.id, existing.id))

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'operator_unassigned',
      targetType: 'group_buy',
      targetId: groupBuyId,
      payload: { operatorId, operatorEmail: target?.email },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/admin/group-buys/[id]/operators/[operatorId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
