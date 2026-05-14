import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderStatusHistory } from '@/db/schema'

/**
 * The valid order status values. This list mirrors the comment on
 * orders.order_status in db/schema.ts and the transitions enforced by the
 * status-FSM UI in components/admin/campaign-management.
 */
export type OrderStatus =
  | 'pending_payment'
  | 'payment_submitted'
  | 'payment_verified'
  | 'processing'
  | 'shipped'
  | 'completed'
  | 'payment_rejected'
  | 'rejected'
  | 'cancelled'

interface TransitionArgs {
  /** Order whose status should change. */
  orderId: string
  /**
   * The expected current status. Used as an optimistic-concurrency guard:
   * if the row's status is something else by the time we write, the update
   * affects zero rows and `transitionOrderStatus` returns `false`. Pass
   * `undefined` to skip the guard (system-driven transitions that should
   * apply regardless of current state).
   */
  fromStatus?: OrderStatus
  /** Target status. */
  toStatus: OrderStatus
  /** User who initiated this transition, or `null` for system-driven. */
  changedBy: string | null
  /** Optional human-readable reason (rejection message, admin note, etc). */
  reason?: string
  /**
   * Additional columns to update alongside `order_status`. Useful for keeping
   * `payment_status` in sync, recording adminNotes, etc. Allowed keys map to
   * the orders table.
   */
  extraUpdates?: Partial<{
    paymentStatus: string
    adminNotes: string | null
  }>
}

/**
 * Atomically updates `orders.order_status` and writes a row to
 * `order_status_history`. Returns true if the order row was actually updated
 * (i.e. the `fromStatus` guard, if any, matched).
 *
 * Drizzle's neon-http driver doesn't expose interactive transactions, so the
 * pattern below uses an UPDATE..RETURNING guarded by the optional fromStatus
 * predicate, then an INSERT on success. If the UPDATE doesn't return a row
 * (status didn't match), no history row is written.
 */
export async function transitionOrderStatus({
  orderId,
  fromStatus,
  toStatus,
  changedBy,
  reason,
  extraUpdates,
}: TransitionArgs): Promise<boolean> {
  const updatePayload: Record<string, unknown> = {
    orderStatus: toStatus,
    updatedAt: new Date(),
    ...(extraUpdates ?? {}),
  }

  const where = fromStatus
    ? and(eq(orders.id, orderId), eq(orders.orderStatus, fromStatus))
    : eq(orders.id, orderId)

  // Drizzle types `.set()` to the columns object — `Partial<$inferInsert>`
  // captures the loose runtime shape correctly without losing type checking
  // on the table identifier.
  const updated = await db
    .update(orders)
    .set(updatePayload as Partial<typeof orders.$inferInsert>)
    .where(where)
    .returning({ id: orders.id, prevStatus: orders.orderStatus })

  if (updated.length === 0) {
    // fromStatus guard failed — order isn't in the expected state.
    return false
  }

  // The returned row reflects the post-update state, so we already know
  // toStatus matches. For `from_status` history we re-derive: if a fromStatus
  // guard was provided, use it (it must have matched). Otherwise null.
  await db.insert(orderStatusHistory).values({
    orderId,
    fromStatus: fromStatus ?? null,
    toStatus,
    changedBy,
    reason: reason ?? null,
  })

  return true
}
