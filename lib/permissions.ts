import type { Session } from 'next-auth'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { groupBuyOperators } from '@/db/schema'
import { getSession, requireAdmin } from '@/lib/auth'

// ─── Role guards (used as the first line in every admin route handler) ───────

// `requireAdmin` is re-exported from lib/auth so callers can pull every guard
// from one place. Use it for endpoints that touch global state (user
// management, store catalog, operator assignments, platform-wide settings):
//
//     const session = await requireAdmin()
//     if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
export { requireAdmin }

/**
 * Admin OR operator guard. Operators must still be scope-checked at the
 * resource level via `canManageGroupBuy()` / `listManageableGroupBuyIds()`.
 *
 * Use this for endpoints whose data is partitioned by group buy:
 *  - group_buys CRUD
 *  - orders / payments / shipments
 *  - analytics (operator view is filtered to their campaigns)
 */
export async function requireAdminOrOperator(): Promise<Session | null> {
  const session = await getSession()
  if (!session?.user?.id) return null
  if (session.user.role !== 'admin' && session.user.role !== 'operator') return null
  return session
}

// ─── Resource-level scoping helpers ──────────────────────────────────────────

/**
 * Returns true if the session's user is allowed to manage the given group buy.
 *  - Admin: always true
 *  - Operator: true iff a `group_buy_operators` row exists pairing them with
 *    this group_buy_id
 *  - Anyone else: false
 */
export async function canManageGroupBuy(
  session: Session | null,
  groupBuyId: string,
): Promise<boolean> {
  if (!session?.user?.id) return false
  if (session.user.role === 'admin') return true
  if (session.user.role !== 'operator') return false

  const [row] = await db
    .select({ id: groupBuyOperators.id })
    .from(groupBuyOperators)
    .where(
      and(
        eq(groupBuyOperators.groupBuyId, groupBuyId),
        eq(groupBuyOperators.operatorId, session.user.id),
      ),
    )
    .limit(1)

  return !!row
}

/**
 * Returns the set of group buy IDs the session's user may manage.
 *  - Admin: returns `null` — interpret as "no filter, all rows".
 *  - Operator: returns the array of assigned IDs (may be empty).
 *  - Anyone else: returns an empty array.
 *
 * Callers should branch on `null` vs array:
 *
 *     const ownable = await listManageableGroupBuyIds(session)
 *     const rows = await db.select().from(orders).where(
 *       ownable === null
 *         ? undefined                                 // admin: all
 *         : inArray(orders.groupBuyId, ownable),      // operator: filtered
 *     )
 */
export async function listManageableGroupBuyIds(
  session: Session | null,
): Promise<string[] | null> {
  if (!session?.user?.id) return []
  if (session.user.role === 'admin') return null
  if (session.user.role !== 'operator') return []

  const rows = await db
    .select({ groupBuyId: groupBuyOperators.groupBuyId })
    .from(groupBuyOperators)
    .where(eq(groupBuyOperators.operatorId, session.user.id))

  return rows.map((r) => r.groupBuyId)
}
