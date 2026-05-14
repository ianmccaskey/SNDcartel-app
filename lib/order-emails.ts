import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders, users, groupBuys } from '@/db/schema'
import { sendPaymentVerified, sendPaymentRejected } from '@/lib/email'

function appUrl(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}${path}`
}

/**
 * Look up the order + user + (optional) group buy in a single round trip and
 * fire the payment-verified email. Fire-and-forget — call sites should `void`
 * the returned promise.
 *
 * Used by both the Alchemy webhook (auto match) and the admin approve endpoint
 * (manual) so the customer always gets exactly one email per verification.
 */
export async function notifyPaymentVerified(
  orderId: string,
  verifiedBy: 'auto' | 'manual',
): Promise<void> {
  try {
    const [row] = await db
      .select({
        orderId: orders.id,
        totalUsd: orders.totalUsd,
        storeOrder: orders.storeOrder,
        email: users.email,
        fullName: users.fullName,
        groupBuyName: groupBuys.name,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .leftJoin(groupBuys, eq(orders.groupBuyId, groupBuys.id))
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!row) {
      console.warn(`notifyPaymentVerified: order ${orderId} not found`)
      return
    }

    await sendPaymentVerified({
      to: row.email,
      data: {
        orderTitle: row.groupBuyName ?? (row.storeOrder ? 'Store Purchase' : 'Group Buy'),
        userFullName: row.fullName,
        orderId: row.orderId,
        totalUsd: parseFloat(row.totalUsd),
        orderUrl: appUrl('/account'),
        verifiedBy,
      },
    })
  } catch (err) {
    // Email path must never break verification.
    console.error('notifyPaymentVerified failed:', err)
  }
}

/**
 * Mirror of `notifyPaymentVerified` for the rejection path. Fetches the order
 * + user + group buy in one round trip and fires the payment-rejected email.
 * Fire-and-forget — call sites should `void` the returned promise.
 */
export async function notifyPaymentRejected(orderId: string, reason: string): Promise<void> {
  try {
    const [row] = await db
      .select({
        orderId: orders.id,
        totalUsd: orders.totalUsd,
        storeOrder: orders.storeOrder,
        email: users.email,
        fullName: users.fullName,
        groupBuyName: groupBuys.name,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .leftJoin(groupBuys, eq(orders.groupBuyId, groupBuys.id))
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!row) {
      console.warn(`notifyPaymentRejected: order ${orderId} not found`)
      return
    }

    await sendPaymentRejected({
      to: row.email,
      data: {
        orderTitle: row.groupBuyName ?? (row.storeOrder ? 'Store Purchase' : 'Group Buy'),
        userFullName: row.fullName,
        orderId: row.orderId,
        totalUsd: parseFloat(row.totalUsd),
        reason,
        orderUrl: appUrl('/account'),
      },
    })
  } catch (err) {
    console.error('notifyPaymentRejected failed:', err)
  }
}
