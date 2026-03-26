import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('user'), // 'user' | 'admin'

    // Profile fields
    fullName: text('full_name'),
    discordName: text('discord_name'),
    phone: text('phone'),
    country: text('country'),
    stateRegion: text('state_region'),
    postalCode: text('postal_code'),

    // Shipping address (denormalized, single address per user)
    shippingLine1: text('shipping_line1'),
    shippingLine2: text('shipping_line2'),
    shippingCity: text('shipping_city'),
    shippingState: text('shipping_state'),
    shippingZip: text('shipping_zip'),
    shippingCountry: text('shipping_country').default('USA'),

    // Status
    accountStatus: text('account_status').notNull().default('active'), // 'active' | 'suspended' | 'pending'
    profileComplete: boolean('profile_complete').notNull().default(false),
    emailVerified: boolean('email_verified').notNull().default(false),

    // Admin metadata
    notes: text('notes'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_role').on(table.role),
    index('idx_users_account_status').on(table.accountStatus),
  ],
)

// ─── Wallets ─────────────────────────────────────────────────────────────────

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chain: text('chain').notNull(), // 'Ethereum' | 'Solana' | 'Bitcoin' | 'Polygon' | 'Base' | 'Arbitrum' | 'Other'
    address: text('address').notNull(),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_wallets_user_id').on(table.userId),
    uniqueIndex('idx_wallets_user_chain_address').on(table.userId, table.chain, table.address),
  ],
)

// ─── Group Buys ──────────────────────────────────────────────────────────────

export const groupBuys = pgTable(
  'group_buys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    vendor: text('vendor'),
    imageUrl: text('image_url'),

    // Timing
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    publicLaunchTime: timestamp('public_launch_time', { withTimezone: true }),

    // Status: 'draft' | 'active' | 'closed' | 'fulfilled'
    status: text('status').notNull().default('draft'),

    // Payment configuration
    paymentWalletAddress: text('payment_wallet_address'),
    supportedNetworks: text('supported_networks')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    // Fees
    adminFeeUsd: numeric('admin_fee_usd', { precision: 10, scale: 2 }).notNull().default('0'),
    shippingFeeUsd: numeric('shipping_fee_usd', { precision: 10, scale: 2 }).notNull().default('0'),
    paymentTolerancePct: numeric('payment_tolerance_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('5.00'),

    // Admin
    creatorDisplayName: text('creator_display_name'),
    createdBy: uuid('created_by').references(() => users.id),

    // MOQ tracking (denormalized for performance)
    totalMoqGoal: integer('total_moq_goal').notNull().default(1),
    totalKitsOrdered: integer('total_kits_ordered').notNull().default(0),

    // Extra admin config: finalPaymentInfo, cryptoFeeOptions, boxSizes, defaultPaddingFactor
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_group_buys_status').on(table.status),
    index('idx_group_buys_end_date').on(table.endDate),
  ],
)

// ─── Accepted Payments (per group buy) ───────────────────────────────────────

export const acceptedPayments = pgTable(
  'accepted_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupBuyId: uuid('group_buy_id')
      .notNull()
      .references(() => groupBuys.id, { onDelete: 'cascade' }),
    token: text('token').notNull(), // e.g. 'USDC (Ethereum)', 'ETH'
    walletAddress: text('wallet_address').notNull(),
    network: text('network').notNull(), // e.g. 'Ethereum', 'Solana'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_accepted_payments_group_buy').on(table.groupBuyId)],
)

// ─── Products (scoped to a group buy) ────────────────────────────────────────

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupBuyId: uuid('group_buy_id')
      .notNull()
      .references(() => groupBuys.id, { onDelete: 'cascade' }),

    // Identity
    name: text('name').notNull(),
    peptideName: text('peptide_name'),
    massDosage: text('mass_dosage'),
    description: text('description'),
    vendorRef: text('vendor_ref'),

    // Pricing
    priceUsd: numeric('price_usd', { precision: 10, scale: 2 }).notNull(),
    regularPriceUsd: numeric('regular_price_usd', { precision: 10, scale: 2 }),

    // MOQ
    moq: integer('moq').notNull().default(1),
    maxPerUser: integer('max_per_user'),
    manualAdjustment: integer('manual_adjustment').notNull().default(0),
    kitsOrdered: integer('kits_ordered').notNull().default(0),

    // Physical dimensions
    dimLengthIn: numeric('dim_length_in', { precision: 8, scale: 3 }),
    dimWidthIn: numeric('dim_width_in', { precision: 8, scale: 3 }),
    dimHeightIn: numeric('dim_height_in', { precision: 8, scale: 3 }),
    weightOz: numeric('weight_oz', { precision: 8, scale: 3 }),

    // Status
    inStock: boolean('in_stock').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_products_group_buy').on(table.groupBuyId),
    index('idx_products_deleted').on(table.deletedAt),
  ],
)

// ─── Store Products (standalone catalog, not tied to a group buy) ─────────────

export const storeProducts = pgTable(
  'store_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('Uncategorized'),
    priceUsd: numeric('price_usd', { precision: 10, scale: 2 }).notNull(),
    imageUrl: text('image_url'),
    available: boolean('available').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('idx_store_products_available').on(table.available)],
)

// ─── Orders ──────────────────────────────────────────────────────────────────

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    groupBuyId: uuid('group_buy_id').references(() => groupBuys.id),
    storeOrder: boolean('store_order').notNull().default(false),

    // Status lifecycle:
    // pending_payment → payment_submitted → payment_verified → processing → shipped → completed
    // rejected | cancelled (terminal)
    orderStatus: text('order_status').notNull().default('pending_payment'),

    // Payment status (separate from fulfillment)
    paymentStatus: text('payment_status').notNull().default('pending'),

    // Totals (denormalized for query performance)
    subtotalUsd: numeric('subtotal_usd', { precision: 10, scale: 2 }).notNull().default('0'),
    shippingFeeUsd: numeric('shipping_fee_usd', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    adminFeeUsd: numeric('admin_fee_usd', { precision: 10, scale: 2 }).notNull().default('0'),
    totalUsd: numeric('total_usd', { precision: 10, scale: 2 }).notNull().default('0'),

    // Alchemy: customer's wallet address for automated payment matching
    customerWalletAddress: text('customer_wallet_address'),

    // Notes
    adminNotes: text('admin_notes'),
    userNotes: text('user_notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_orders_user_id').on(table.userId),
    index('idx_orders_group_buy_id').on(table.groupBuyId),
    index('idx_orders_order_status').on(table.orderStatus),
    index('idx_orders_payment_status').on(table.paymentStatus),
    index('idx_orders_created_at').on(table.createdAt),
    index('idx_orders_customer_wallet').on(table.customerWalletAddress),
  ],
)

// ─── Order Items ─────────────────────────────────────────────────────────────

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id),
    storeProductId: uuid('store_product_id').references(() => storeProducts.id),
    quantity: integer('quantity').notNull(),
    unitPriceUsd: numeric('unit_price_usd', { precision: 10, scale: 2 }).notNull(),
    lineTotalUsd: numeric('line_total_usd', { precision: 10, scale: 2 }).generatedAlwaysAs(
      sql`quantity * unit_price_usd`,
    ),

    // Product name snapshot at time of order
    productNameSnapshot: text('product_name_snapshot').notNull(),

    // Per-item fulfillment status
    // 'awaiting_vendor' | 'on_hand' | 'packed' | 'shipped' | 'delivered'
    fulfillmentStatus: text('fulfillment_status').notNull().default('awaiting_vendor'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_order_items_order_id').on(table.orderId),
    index('idx_order_items_product_id').on(table.productId),
  ],
)

// ─── Payments ─────────────────────────────────────────────────────────────────

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Submitted by user
    txHash: text('tx_hash').notNull(),
    blockchainNetwork: text('blockchain_network').notNull(), // 'Ethereum' | 'Solana' | 'Bitcoin' | ...
    fromWalletAddress: text('from_wallet_address'),
    amountSubmittedUsd: numeric('amount_submitted_usd', { precision: 10, scale: 2 }),
    amountExpectedUsd: numeric('amount_expected_usd', { precision: 10, scale: 2 }).notNull(),
    tokenSymbol: text('token_symbol').notNull(), // 'USDC' | 'ETH' | 'SOL' | ...

    // Computed
    explorerUrl: text('explorer_url').notNull(),
    withinTolerance: boolean('within_tolerance'),

    // Review: 'pending' | 'approved' | 'rejected'
    status: text('status').notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    adminNotes: text('admin_notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_payments_order_id').on(table.orderId),
    index('idx_payments_status').on(table.status),
    index('idx_payments_tx_hash').on(table.txHash),
    uniqueIndex('idx_payments_tx_hash_network').on(table.txHash, table.blockchainNetwork),
  ],
)

// ─── Shipments ────────────────────────────────────────────────────────────────

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),

    carrier: text('carrier'),
    trackingNumber: text('tracking_number'),
    trackingUrl: text('tracking_url'),
    trackingImageUrl: text('tracking_image_url'),

    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    estimatedDelivery: timestamp('estimated_delivery', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),

    isPartial: boolean('is_partial').notNull().default(false),
    notes: text('notes'),

    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_shipments_order_id').on(table.orderId),
    index('idx_shipments_tracking_number').on(table.trackingNumber),
  ],
)

// ─── Admin Actions (Audit Log) ────────────────────────────────────────────────

export const adminActions = pgTable(
  'admin_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => users.id),
    actionType: text('action_type').notNull(), // e.g. 'payment_approved', 'order_status_changed'
    targetType: text('target_type').notNull(), // 'order' | 'payment' | 'user' | 'group_buy' | ...
    targetId: uuid('target_id').notNull(),
    payload: jsonb('payload'),
    ipAddress: text('ip_address'), // INET stored as text
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_admin_actions_admin_user').on(table.adminUserId),
    index('idx_admin_actions_target').on(table.targetType, table.targetId),
    index('idx_admin_actions_action_type').on(table.actionType),
    index('idx_admin_actions_created_at').on(table.createdAt),
  ],
)

// ─── Alchemy Webhook Events ───────────────────────────────────────────────────

export const alchemyWebhookEvents = pgTable(
  'alchemy_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    webhookId: text('webhook_id').notNull(),
    eventType: text('event_type').notNull(), // 'GRAPHQL_WEBHOOK'
    transactionHash: text('transaction_hash').notNull(),
    blockNumber: integer('block_number').notNull(),
    fromAddress: text('from_address').notNull(),
    toAddress: text('to_address').notNull(),
    tokenAddress: text('token_address').notNull(), // USDC contract address
    valueRaw: text('value_raw').notNull(),
    valueUsd: numeric('value_usd', { precision: 10, scale: 2 }),
    network: text('network').notNull(), // 'ethereum' | 'polygon' | 'base'
    processed: boolean('processed').notNull().default(false),
    matchedOrderId: uuid('matched_order_id').references(() => orders.id),
    matchConfidence: integer('match_confidence'), // 0–100
    matchReasons: text('match_reasons').array(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_alchemy_events_tx_hash').on(table.transactionHash),
    index('idx_alchemy_events_to_address').on(table.toAddress),
    index('idx_alchemy_events_processed').on(table.processed),
  ],
)

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Wallet = typeof wallets.$inferSelect
export type NewWallet = typeof wallets.$inferInsert

export type GroupBuy = typeof groupBuys.$inferSelect
export type NewGroupBuy = typeof groupBuys.$inferInsert

export type AcceptedPayment = typeof acceptedPayments.$inferSelect
export type NewAcceptedPayment = typeof acceptedPayments.$inferInsert

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert

export type StoreProduct = typeof storeProducts.$inferSelect
export type NewStoreProduct = typeof storeProducts.$inferInsert

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert

export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert

export type Shipment = typeof shipments.$inferSelect
export type NewShipment = typeof shipments.$inferInsert

export type AdminAction = typeof adminActions.$inferSelect
export type NewAdminAction = typeof adminActions.$inferInsert

export type AlchemyWebhookEvent = typeof alchemyWebhookEvents.$inferSelect
export type NewAlchemyWebhookEvent = typeof alchemyWebhookEvents.$inferInsert
