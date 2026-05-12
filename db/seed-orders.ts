/**
 * One-off seed script for test fulfillment data.
 * Creates 3 orders with mixed fulfillment statuses tied to admin@sndcartel.com.
 * Each test order is tagged via user_notes = SEED_MARKER for easy cleanup:
 *   DELETE FROM shipments WHERE notes = '[seed-test-fulfillment]';
 *   DELETE FROM order_items WHERE order_id IN
 *     (SELECT id FROM orders WHERE user_notes = '[seed-test-fulfillment]');
 *   DELETE FROM orders WHERE user_notes = '[seed-test-fulfillment]';
 *
 * Run with:
 *   DOTENV_CONFIG_PATH=.env.local pnpm tsx db/seed-orders.ts
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from './index'
import { users, groupBuys, products, orders, orderItems, shipments } from './schema'

const SEED_MARKER = '[seed-test-fulfillment]'

async function seedOrders() {
  // ── Find admin ──
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@sndcartel.com'))
    .limit(1)
  if (!admin) {
    throw new Error("Admin user not found. Run 'pnpm tsx db/seed.ts' first.")
  }

  // ── Find an active group buy ──
  const [activeGB] = await db
    .select()
    .from(groupBuys)
    .where(eq(groupBuys.status, 'active'))
    .limit(1)
  if (!activeGB) {
    throw new Error("No active group buy found. Run 'pnpm tsx db/seed.ts' first.")
  }

  // ── Get its products ──
  const gbProducts = await db
    .select()
    .from(products)
    .where(eq(products.groupBuyId, activeGB.id))
    .limit(3)
  if (gbProducts.length < 1) {
    throw new Error('No products in active group buy.')
  }
  const p1 = gbProducts[0]
  const p2 = gbProducts[Math.min(1, gbProducts.length - 1)]
  const p3 = gbProducts[Math.min(2, gbProducts.length - 1)]

  // ── Idempotency: skip if marker rows already exist ──
  const existing = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.userNotes, SEED_MARKER))
    .limit(1)
  if (existing.length > 0) {
    console.log(`Test orders with marker '${SEED_MARKER}' already exist — skipping.`)
    console.log('To re-seed: delete them via SQL using the cleanup commands at the top of this file.')
    return
  }

  // ── Order 1: Awaiting Vendor (single item, no shipment) ──
  const [order1] = await db
    .insert(orders)
    .values({
      userId: admin.id,
      groupBuyId: activeGB.id,
      storeOrder: false,
      orderStatus: 'payment_verified',
      paymentStatus: 'verified',
      subtotalUsd: p1.priceUsd,
      totalUsd: p1.priceUsd,
      userNotes: SEED_MARKER,
    })
    .returning({ id: orders.id })

  await db.insert(orderItems).values({
    orderId: order1.id,
    productId: p1.id,
    quantity: 1,
    unitPriceUsd: p1.priceUsd,
    productNameSnapshot: p1.name,
    fulfillmentStatus: 'awaiting_vendor',
  })

  console.log(`Order 1 (awaiting_vendor) created: ${order1.id}`)

  // ── Order 2: Mixed packed/on_hand (two items, no shipment) ──
  const order2Subtotal = (parseFloat(p1.priceUsd) * 2 + parseFloat(p2.priceUsd)).toFixed(2)
  const [order2] = await db
    .insert(orders)
    .values({
      userId: admin.id,
      groupBuyId: activeGB.id,
      storeOrder: false,
      orderStatus: 'processing',
      paymentStatus: 'verified',
      subtotalUsd: order2Subtotal,
      totalUsd: order2Subtotal,
      userNotes: SEED_MARKER,
    })
    .returning({ id: orders.id })

  await db.insert(orderItems).values([
    {
      orderId: order2.id,
      productId: p1.id,
      quantity: 2,
      unitPriceUsd: p1.priceUsd,
      productNameSnapshot: p1.name,
      fulfillmentStatus: 'packed',
    },
    {
      orderId: order2.id,
      productId: p2.id,
      quantity: 1,
      unitPriceUsd: p2.priceUsd,
      productNameSnapshot: p2.name,
      fulfillmentStatus: 'on_hand',
    },
  ])

  console.log(`Order 2 (processing, mixed item statuses) created: ${order2.id}`)

  // ── Order 3: Shipped with tracking ──
  const [order3] = await db
    .insert(orders)
    .values({
      userId: admin.id,
      groupBuyId: activeGB.id,
      storeOrder: false,
      orderStatus: 'shipped',
      paymentStatus: 'verified',
      subtotalUsd: p3.priceUsd,
      totalUsd: p3.priceUsd,
      userNotes: SEED_MARKER,
    })
    .returning({ id: orders.id })

  await db.insert(orderItems).values({
    orderId: order3.id,
    productId: p3.id,
    quantity: 1,
    unitPriceUsd: p3.priceUsd,
    productNameSnapshot: p3.name,
    fulfillmentStatus: 'shipped',
  })

  await db.insert(shipments).values({
    orderId: order3.id,
    carrier: 'USPS',
    trackingNumber: 'TEST9405511899223197428348',
    trackingUrl:
      'https://tools.usps.com/go/TrackConfirmAction?tLabels=TEST9405511899223197428348',
    shippedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    notes: SEED_MARKER,
    createdBy: admin.id,
  })

  console.log(`Order 3 (shipped with tracking) created: ${order3.id}`)

  console.log('---')
  console.log(`Seeded 3 test orders on group buy "${activeGB.name}" for ${admin.email}.`)
  console.log("Cleanup: DELETE WHERE user_notes / notes = '[seed-test-fulfillment]'")
}

async function run() {
  try {
    await seedOrders()
    process.exit(0)
  } catch (err) {
    console.error('seed-orders failed:', err)
    process.exit(1)
  }
}

run()
