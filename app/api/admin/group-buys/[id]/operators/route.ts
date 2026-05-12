import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuys, groupBuyOperators, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { canManageGroupBuy, requireAdminOrOperator } from '@/lib/permissions'
import { logAdminAction } from '@/lib/audit'
import { z } from 'zod'

const assignSchema = z.object({
  operatorId: z.string().uuid(),
})

// GET /api/admin/group-buys/[id]/operators
// Returns the operators currently assigned to this group buy.
// Visible to: admin (always) or operator-of-this-buy (so they can see who else
// is helping). Anyone else is forbidden.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminOrOperator()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    if (!(await canManageGroupBuy(session, id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rows = await db
      .select({
        assignmentId: groupBuyOperators.id,
        operatorId: groupBuyOperators.operatorId,
        operatorEmail: users.email,
        operatorName: users.fullName,
        createdAt: groupBuyOperators.createdAt,
        createdBy: groupBuyOperators.createdBy,
      })
      .from(groupBuyOperators)
      .innerJoin(users, eq(groupBuyOperators.operatorId, users.id))
      .where(eq(groupBuyOperators.groupBuyId, id))
      .orderBy(groupBuyOperators.createdAt)

    return NextResponse.json(
      rows.map((r) => ({
        assignmentId: r.assignmentId,
        operatorId: r.operatorId,
        operatorEmail: r.operatorEmail,
        operatorName: r.operatorName,
        createdAt: r.createdAt.toISOString(),
        createdBy: r.createdBy,
      })),
    )
  } catch (error) {
    console.error('GET /api/admin/group-buys/[id]/operators error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/group-buys/[id]/operators
// Admin-only: assigns an existing operator (or admin) user to this group buy.
// The target user's role is not modified — promote them via PATCH /api/admin/users/[id] first.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: groupBuyId } = await params
    const body = await request.json()

    const parsed = assignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { operatorId } = parsed.data

    // Verify both the group buy and the target user exist + are usable.
    const [[gb], [target]] = await Promise.all([
      db
        .select({ id: groupBuys.id, deletedAt: groupBuys.deletedAt, name: groupBuys.name })
        .from(groupBuys)
        .where(eq(groupBuys.id, groupBuyId))
        .limit(1),
      db
        .select({ id: users.id, role: users.role, email: users.email, deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, operatorId))
        .limit(1),
    ])

    if (!gb || gb.deletedAt) {
      return NextResponse.json({ error: 'Group buy not found' }, { status: 404 })
    }
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only operator-role users can be assigned. Admins manage everything via
    // role and do not need (and would be confusing to receive) rows here.
    if (target.role !== 'operator') {
      return NextResponse.json(
        { error: 'Target user must have role=operator. Promote them first via PATCH /api/admin/users/[id].' },
        { status: 422 },
      )
    }

    // Idempotent: if the assignment already exists, return it instead of erroring.
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

    if (existing) {
      return NextResponse.json({ assignmentId: existing.id, alreadyAssigned: true }, { status: 200 })
    }

    const [inserted] = await db
      .insert(groupBuyOperators)
      .values({
        groupBuyId,
        operatorId,
        createdBy: session.user.id,
      })
      .returning({ id: groupBuyOperators.id, createdAt: groupBuyOperators.createdAt })

    await logAdminAction({
      adminUserId: session.user.id,
      actionType: 'operator_assigned',
      targetType: 'group_buy',
      targetId: groupBuyId,
      payload: { operatorId, operatorEmail: target.email, groupBuyName: gb.name },
      request,
    })

    return NextResponse.json(
      {
        assignmentId: inserted.id,
        operatorId,
        operatorEmail: target.email,
        createdAt: inserted.createdAt.toISOString(),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('POST /api/admin/group-buys/[id]/operators error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
