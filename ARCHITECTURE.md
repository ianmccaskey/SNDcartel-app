# SNDcartel App — Architecture & Implementation Guide

## Table of Contents
1. [Repo Assessment](#1-repo-assessment)
2. [Page Analysis](#2-page-analysis)
3. [Production Architecture](#3-production-architecture)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [Phased Implementation Roadmap](#6-phased-implementation-roadmap)

---

## 1. Repo Assessment

### Framework & Stack

| Layer | Current | Notes |
|---|---|---|
| Framework | Next.js 16.1.1 (App Router) | Keep — solid foundation |
| Language | TypeScript 5 | Keep |
| UI Library | shadcn/ui (Radix UI) | Keep |
| Styling | Tailwind CSS v4 | Keep |
| Animations | Framer Motion 12 | Keep |
| 3D Background | Three.js + @react-three/fiber | Keep — particle WebGL canvas |
| Forms | react-hook-form + Zod | Keep — extend for validation |
| State | Component-local useState | Replace with server state |
| Persistence | localStorage only | Replace entirely with DB |
| Auth | None (login navigates directly to /home) | Must build |
| Backend | None | Must build |
| Database | None | Must build |
| File Storage | None | Must build |

**Unused/problematic dependencies to remove:**
- `expo`, `expo-asset`, `expo-file-system`, `expo-gl`, `@expo/dom-webview`, `@expo/metro-runtime` — Expo packages have no relevance to a Next.js web app
- `react-native`, `react-native-reanimated`, `react-native-web`, `react-native-webview`, `react-native-worklets` — same, leftover from v0 scaffold

### Routing Structure

```
app/
├── page.tsx                          # Redirects → /login
├── layout.tsx                        # Root layout: Geist Mono font, WebGL ClientWrapper
├── globals.css                       # Global CSS
└── (auth)/                           # Route group (shares AuthHeader + RouteTransition)
    ├── layout.tsx                    # Auth layout: header + page fade transitions
    ├── login/page.tsx                # Hero component (landing)
    ├── home/page.tsx                 # Dashboard: active group buys + recent orders
    ├── account/page.tsx              # User profile, shipping, wallets, order history
    ├── store/page.tsx                # Product catalog with cart
    └── group-buy/[id]/page.tsx       # Group buy detail, per-product ordering, cart
    └── admin/page.tsx                # Admin panel (Campaigns | Store | Users tabs)
```

**Missing routes that must be created:**
- `/register` — new user registration
- `/group-buy/[id]/page.tsx` — currently hardcoded to a single mock, must fetch by ID
- `/api/**` — the entire API layer

### Component Inventory

**Layout / Shell:**
- `components/client-wrapper.tsx` — WebGL background (Three.js, dynamic import, Leva GUI hidden)
- `components/gl/index.tsx` — GL canvas entry
- `components/gl/particles.tsx` — GPU particle simulation
- `components/gl/shaders/` — pointMaterial, simulationMaterial, vignetteShader, utils
- `components/auth-header.tsx` — Fixed nav bar, animated logo transitions, mobile hamburger
- `components/hero.tsx` — Landing page hero with Log In / Register buttons
- `components/route-transition.tsx` — Framer Motion page fade wrapper
- `components/logo.tsx` — Logo mark
- `components/mobile-menu.tsx` — Exported but logic is embedded in auth-header
- `components/pill.tsx` — Small tag pill component
- `components/theme-provider.tsx` — next-themes wrapper
- `components/account-warning-banner.tsx` — "Complete your profile" alert

**User-Facing Feature Components:**
- `components/account-details-card.tsx` — Full name + Discord name edit (expects `account`/`onSave` props but page renders it without props — **current bug**)
- `components/shipping-address-card.tsx` — Shipping address edit form (same prop bug)
- `components/wallets-card.tsx` — List + remove crypto wallets
- `components/add-wallet-dialog.tsx` — Dialog to add a wallet (chain + address)
- `components/orders-card.tsx` — Order history list, click to open overlay
- `components/order-detail-overlay.tsx` — Full order detail: products, statuses, tx links
- `components/checkout-overlay.tsx` — Group-buy checkout: select payment, copy wallet address, paste tx hash, mock verify → save to localStorage
- `components/store-checkout-overlay.tsx` — Same flow as checkout-overlay but for store cart

**Admin Components:**
- `components/admin/campaign-management.tsx` — Full CRUD for campaigns: basic info, payments, products, shipping box sizes, fees. Data persisted to localStorage key `admin_campaigns`
- `components/admin/store-management.tsx` — Product CRUD table. localStorage key `admin_store_products`
- `components/admin/userbase-management.tsx` — User list table built entirely from injected mock + localStorage orders. **No real user DB.**
- `components/admin/user-detail-overlay.tsx` — User detail: view/edit user info, edit orders, set product fulfillment statuses. Writes to localStorage `orders`

**UI Primitives (shadcn/ui):**
`alert`, `badge`, `button`, `card`, `dialog`, `input`, `label`, `select`, `switch`, `table`, `tabs`, `textarea`

### State Management

All state is **ephemeral client-side only**:
- Component `useState` for UI interactions
- `localStorage` for persistence across page refreshes
- No server state, no shared state between users, no admin visibility into user data

**localStorage keys in use:**
| Key | Content |
|---|---|
| `snd_account_details` | `AccountDetails` (fullName, discordName, shippingAddress) |
| `snd_wallets` | `Wallet[]` |
| `snd_orders` | `Order[]` |
| `wallets` | Duplicate wallets key (storage.ts vs loadFromStorage) |
| `orders` | Duplicate orders key |
| `admin_campaigns` | `Campaign[]` |
| `admin_store_products` | `StoreProduct[]` |
| `users` | Partial `AdminUser` (written by user-detail-overlay but never fully read) |

### Mock Data Locations

All mock data must be ripped out and replaced with API calls:

| File | Mock Identifier | What It Is |
|---|---|---|
| `app/(auth)/home/page.tsx:13` | `mockGroupBuys` | Hardcoded active group buys array |
| `app/(auth)/store/page.tsx:34` | `mockProducts` | Hardcoded product catalog |
| `app/(auth)/group-buy/[id]/page.tsx:47` | `mockGroupBuy` | Single hardcoded group buy with products |
| `app/(auth)/account/page.tsx:93` | `defaultOrder` (rat-cartel) | Injected demo order if none exists |
| `components/admin/userbase-management.tsx:27` | `testUndeliveredOrder` | Injected test order |
| `components/admin/userbase-management.tsx:57` | `uniqueUsers` generation loop | Fake users generated from order data |
| `components/checkout-overlay.tsx:29` | `paymentOptions` | Hardcoded wallet addresses |
| `components/store-checkout-overlay.tsx:27` | `paymentOptions` | Same hardcoded wallets |
| `components/admin/user-detail-overlay.tsx:14` | `AVAILABLE_PRODUCTS` | Hardcoded product list |
| `components/order-detail-overlay.tsx:23` | `Math.random() > 0.5` | Random product fulfillment status |
| `components/checkout-overlay.tsx:65` | `Math.random() > 0.2` | Random payment verification result |
| `components/store-checkout-overlay.tsx:75` | `Math.random() > 0.2` | Same random verification |

### Placeholder / Broken Logic

- **Login/Register buttons** both navigate to `/home` — no auth at all
- **Payment verification** is a random coin flip with a 2s sleep
- **TX explorer URLs** are hardcoded to `etherscan.io` regardless of chain
- **Admin user table** generates fake user records from orders (row 57-84 of userbase-management)
- **Product fulfillment statuses** in OrderDetailOverlay are randomly generated on mount
- **`AccountDetailsCard` and `ShippingAddressCard`** are rendered without required props in account/page.tsx (TypeScript errors suppressed in next.config.ts via `ignoreBuildErrors: true`)
- **Campaign image upload** uses a `fileInputRef` but never sends the image to any server — it's a dead UI element
- **Admin fee / shipping fee** fields exist in the Campaign type and UI but are never applied to order totals
- **`mergeOrCreateOrder`** in storage.ts has a JavaScript-level mutex (orderLock) — this is a hack for localStorage race conditions, not needed with a real DB
- **Group buy `[id]` page** ignores the URL param entirely and always renders the same mock group buy

---

## 2. Page Analysis

### `/login` — Landing / Auth Page
- **Current state:** Purely UI. Hero with "Log In" and "Register" buttons that both go to `/home`.
- **Needs:** Real login form (email + password), separate register route, session management, redirect logic based on auth state.
- **Reusable components to extract:** `AuthForm` (shared by login and register), `PasswordInput`.

### `/home` — User Dashboard
- **Current state:** Mixed. Layout is production-quality. Group buys section is pure mock. Orders section reads from localStorage.
- **Backend required:**
  - `GET /api/group-buys?status=active` — active group buys list
  - `GET /api/orders?userId=me` — user's recent orders
- **State needed:** Server state via `useEffect` fetch or SWR/React Query.
- **Components stay:** Card layout, Badge, AccountWarningBanner.

### `/account` — User Profile
- **Current state:** Mixed. UI is complete. All persistence is localStorage. Has a bug where `AccountDetailsCard` and `ShippingAddressCard` receive no props.
- **Backend required:**
  - `GET /api/users/me` — fetch profile
  - `PATCH /api/users/me` — update profile fields
  - `GET /api/users/me/wallets` — wallet list
  - `POST /api/users/me/wallets` — add wallet
  - `DELETE /api/users/me/wallets/:id` — remove wallet
  - `GET /api/orders?userId=me` — order history
- **State needed:** Server state. Profile completeness check moves to server-side session/middleware.
- **Fix needed:** Pass loaded user data as props to AccountDetailsCard and ShippingAddressCard, replace local save with API call.

### `/store` — Product Catalog
- **Current state:** Mostly UI. Product data is hardcoded mock. Cart is local component state. Checkout is localStorage.
- **Backend required:**
  - `GET /api/store/products` — product list with availability
  - `POST /api/orders` — create order from cart (with payment submission)
- **Cart state:** Can remain local per-session, but order creation must go to API.
- **Note:** Store checkout and group-buy checkout share the same payment flow — extract into a shared `PaymentSubmissionFlow` component.

### `/group-buy/[id]` — Group Buy Detail
- **Current state:** Purely UI/mock. ID param is ignored. All data is one hardcoded object.
- **Backend required:**
  - `GET /api/group-buys/:id` — fetch group buy with products and live MOQ progress
  - `POST /api/orders` — create order with group buy reference
- **State needed:** Server state for group buy data. MOQ progress should be real-time or near-real-time.
- **Key logic to preserve:** Quantity stepper, per-product progress bars, cart sidebar, checkout overlay trigger.

### `/admin` — Admin Panel

**Campaigns Tab:**
- **Current state:** Full CRUD UI, but all data is localStorage. Campaign image uploads go nowhere.
- **Backend required:**
  - Full `GET/POST/PATCH/DELETE /api/admin/group-buys`
  - `POST /api/admin/group-buys/:id/products` — add products
  - `PATCH /api/admin/group-buys/:id/status` — publish/close
  - File upload endpoint for campaign images → S3/R2

**Store Tab:**
- **Current state:** Product CRUD in localStorage.
- **Backend required:**
  - Full `GET/POST/PATCH/DELETE /api/admin/store/products`

**Users Tab:**
- **Current state:** Fake users generated from order data. No real user records.
- **Backend required:**
  - `GET /api/admin/users` — real user list with pagination/search
  - `GET /api/admin/users/:id` — user detail with orders
  - `PATCH /api/admin/users/:id` — update notes, status, discord
  - `GET /api/admin/orders` — all orders with filters
  - `PATCH /api/admin/orders/:id` — update status, add/remove items
  - `PATCH /api/admin/orders/:id/products/:productId/status` — fulfillment status

**Missing admin sections (needed per SPEC):**
- **Payment Verification Tab** — review submitted tx hashes, compare amounts, approve/reject, link to blockchain explorers
- **Fulfillment Tab** — assign tracking numbers, upload tracking images, mark shipped/complete, partial shipments
- **Analytics Tab** — revenue, quantities, MOQ progress per group buy

### Reusable Components (cross-page)

| Component | Used By | Notes |
|---|---|---|
| `CheckoutOverlay` / `StoreCheckoutOverlay` | group-buy/[id], store | Merge into one `PaymentSubmissionOverlay` with `groupBuyId` or `storeMode` prop |
| Order status badge/style logic | orders-card, order-detail-overlay, user-detail-overlay | Extract `OrderStatusBadge` component |
| Product fulfillment status | order-detail-overlay, user-detail-overlay | Extract `FulfillmentStatusBadge` |
| Wallet address display + copy | wallets-card, user-detail-overlay | Extract `WalletAddress` component |
| `CartItem` type | checkout-overlay, store-checkout-overlay, store/page, group-buy/[id]/page | Move to shared types |

---

## 3. Production Architecture

### Recommended Stack

```
Next.js 16 App Router (keep)
├── Frontend: React 19 + shadcn/ui + Tailwind v4 + Framer Motion (keep)
├── Auth: NextAuth.js v5 (Auth.js) — credentials provider + JWT sessions
├── Database: PostgreSQL via Neon (serverless Postgres, Vercel-native)
├── ORM: Drizzle ORM — type-safe, lightweight, Postgres-first
├── API: Next.js Route Handlers (/app/api/**/route.ts)
├── Validation: Zod (already installed) — shared between client and server
├── File Storage: Cloudflare R2 (S3-compatible) or Vercel Blob
│   └── For: campaign images, tracking photos
├── Email: Resend — transactional emails (order confirmation, shipping notification)
└── Deployment: Vercel
```

### Why These Choices

**NextAuth.js v5:** Integrates natively with Next.js App Router. Supports credentials provider for email/password. JWT sessions work well for a small-to-medium user base. Avoids third-party auth vendor lock-in.

**Neon + Drizzle:** Neon is a serverless Postgres that works in Vercel Edge/Node runtimes without connection pool issues. Drizzle gives full type safety without the heavy footprint of Prisma. The schema maps directly to TypeScript types consumed by components.

**Zod for shared validation:** Already installed. Define schemas once, use them for API input validation AND client-side form validation. Single source of truth for data shapes.

**Cloudflare R2:** S3-compatible, no egress fees, straightforward for image uploads. Campaign images and tracking photos are the only file types needed.

**Resend:** Simple transactional email. Required for order confirmation, payment verification results, shipping notifications.

### Auth Architecture

```
User visits /login
→ Credentials provider: email + bcrypt password check against users table
→ JWT session containing { userId, email, role }
→ Middleware (middleware.ts) protects all (auth) routes
→ Admin routes additionally check role === 'admin'

Session available server-side:
  - In Route Handlers: getServerSession(authOptions)
  - In Server Components: getServerSession(authOptions)
  - In Client Components: useSession() hook from NextAuth
```

**Profile completeness gate:** Move from client-side localStorage check to a session flag or middleware check. If `user.profileComplete === false`, redirect to `/account?setup=true` instead of letting them place orders.

### API Structure

All API endpoints live under `app/api/` as Next.js Route Handlers. No separate backend process. The Next.js server IS the backend.

```
app/api/
├── auth/
│   └── [...nextauth]/route.ts      # NextAuth handler
├── users/
│   ├── me/route.ts                 # GET/PATCH current user profile
│   └── me/
│       └── wallets/
│           ├── route.ts            # GET/POST wallets
│           └── [walletId]/route.ts # DELETE wallet
├── group-buys/
│   ├── route.ts                    # GET active group buys
│   └── [id]/route.ts               # GET single group buy with products
├── store/
│   └── products/route.ts           # GET store products
├── orders/
│   ├── route.ts                    # GET user orders, POST create order
│   └── [orderId]/route.ts          # GET single order
├── payments/
│   └── route.ts                    # POST submit payment (tx hash)
└── admin/
    ├── group-buys/
    │   ├── route.ts                # GET all, POST create
    │   └── [id]/route.ts           # GET, PATCH, DELETE
    ├── products/
    │   ├── route.ts                # GET all, POST create
    │   └── [id]/route.ts           # PATCH, DELETE
    ├── store/
    │   └── products/
    │       ├── route.ts
    │       └── [id]/route.ts
    ├── orders/
    │   ├── route.ts                # GET all with filters
    │   └── [id]/route.ts           # PATCH status/items
    ├── payments/
    │   ├── route.ts                # GET pending payments
    │   └── [id]/route.ts           # PATCH approve/reject
    ├── shipments/
    │   ├── route.ts                # POST create shipment
    │   └── [id]/route.ts           # PATCH update tracking
    ├── users/
    │   ├── route.ts                # GET all users
    │   └── [id]/route.ts           # GET/PATCH user
    └── uploads/route.ts            # POST file upload (campaign images, tracking)
```

### Client-Side Data Fetching Strategy

Replace all `useEffect + localStorage` patterns with:
1. **Server Components** for initial data (group buy detail, product list, order history) — no loading state needed, SEO-friendly where relevant
2. **`useSWR` or `@tanstack/react-query`** for data that needs client-side refresh (MOQ progress, order status updates)
3. **Server Actions** for mutations (profile update, add wallet, submit payment) — eliminates manual fetch boilerplate

Recommendation: **SWR** (lighter weight, simpler mental model for this app size). Add `swr` to dependencies.

---

## 4. Database Schema

### Design Notes
- All primary keys use UUIDs (v4) for security and distribution
- `created_at` / `updated_at` on every table
- Soft deletes with `deleted_at` on records that may be referenced (products, group buys)
- Payment tolerance is ~5% (configured per campaign or globally)
- Fulfillment status tracked per order_item, not per order (partial shipments supported)
- Admin action audit log captures every significant state change

---

### Table: `users`
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),

  -- Profile fields
  full_name       TEXT,
  discord_name    TEXT,
  phone           TEXT,
  country         TEXT,
  state_region    TEXT,
  postal_code     TEXT,

  -- Shipping address (denormalized for simplicity, single address per user)
  shipping_line1  TEXT,
  shipping_line2  TEXT,
  shipping_city   TEXT,
  shipping_state  TEXT,
  shipping_zip    TEXT,
  shipping_country TEXT DEFAULT 'USA',

  -- Status
  account_status  TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending')),
  profile_complete BOOLEAN NOT NULL DEFAULT false,
  email_verified  BOOLEAN NOT NULL DEFAULT false,

  -- Admin metadata
  notes           TEXT,
  last_login_at   TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_account_status ON users(account_status);
```

**Profile completeness rule (server-enforced):** `profile_complete = true` when `full_name IS NOT NULL AND shipping_line1 IS NOT NULL AND shipping_city IS NOT NULL AND shipping_state IS NOT NULL AND shipping_zip IS NOT NULL`. Computed and set on each `PATCH /api/users/me`.

---

### Table: `wallets`
```sql
CREATE TABLE wallets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain       TEXT NOT NULL CHECK (chain IN ('Ethereum', 'Solana', 'Bitcoin', 'Polygon', 'Base', 'Arbitrum', 'Other')),
  address     TEXT NOT NULL,
  label       TEXT,                    -- Optional user-defined label
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE UNIQUE INDEX idx_wallets_user_chain_address ON wallets(user_id, chain, address);
```

---

### Table: `group_buys`
```sql
CREATE TABLE group_buys (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  description           TEXT,
  vendor                TEXT,
  image_url             TEXT,                    -- R2/Blob URL

  -- Timing
  start_date            TIMESTAMPTZ,
  end_date              TIMESTAMPTZ,
  public_launch_time    TIMESTAMPTZ,

  -- Status
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'active', 'closed', 'fulfilled')),

  -- Payment configuration
  payment_wallet_address TEXT,                   -- Primary wallet for this campaign
  supported_networks    TEXT[] NOT NULL DEFAULT '{}', -- e.g. ['Ethereum', 'Solana']

  -- Fees
  admin_fee_usd         NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_fee_usd      NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_tolerance_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00,

  -- Admin
  creator_display_name  TEXT,
  created_by            UUID REFERENCES users(id),

  -- MOQ tracking (denormalized for performance, updated by trigger or on order creation)
  total_moq_goal        INTEGER NOT NULL DEFAULT 1,
  total_kits_ordered    INTEGER NOT NULL DEFAULT 0,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_group_buys_status ON group_buys(status);
CREATE INDEX idx_group_buys_end_date ON group_buys(end_date);
```

---

### Table: `accepted_payments`
Payment network options per group buy (maps to `AcceptedPayment` in admin-types):
```sql
CREATE TABLE accepted_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id    UUID NOT NULL REFERENCES group_buys(id) ON DELETE CASCADE,
  token           TEXT NOT NULL,              -- e.g. 'USDC (Ethereum)', 'ETH'
  wallet_address  TEXT NOT NULL,
  network         TEXT NOT NULL,             -- e.g. 'Ethereum', 'Solana'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accepted_payments_group_buy ON accepted_payments(group_buy_id);
```

---

### Table: `products`
Products are scoped to a group buy (campaign products). Store products are a separate concept.
```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id    UUID NOT NULL REFERENCES group_buys(id) ON DELETE CASCADE,

  -- Identity
  name            TEXT NOT NULL,              -- e.g. 'Tirzepatide 30'
  peptide_name    TEXT,                       -- e.g. 'Tirzepatide'
  mass_dosage     TEXT,                       -- e.g. '30MG', '50MG'
  description     TEXT,
  vendor_ref      TEXT,

  -- Pricing
  price_usd       NUMERIC(10,2) NOT NULL,
  regular_price_usd NUMERIC(10,2),           -- For discount display

  -- MOQ
  moq             INTEGER NOT NULL DEFAULT 1,
  max_per_user    INTEGER,
  manual_adjustment INTEGER NOT NULL DEFAULT 0, -- Admin can adjust count
  kits_ordered    INTEGER NOT NULL DEFAULT 0,   -- Denormalized, updated on order

  -- Physical dimensions (for shipping box calculation)
  dim_length_in   NUMERIC(8,3),
  dim_width_in    NUMERIC(8,3),
  dim_height_in   NUMERIC(8,3),
  weight_oz       NUMERIC(8,3),

  -- Status
  in_stock        BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_products_group_buy ON products(group_buy_id);
CREATE INDEX idx_products_deleted ON products(deleted_at) WHERE deleted_at IS NULL;
```

---

### Table: `store_products`
Separate catalog for the standalone store (not tied to a group buy):
```sql
CREATE TABLE store_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'Uncategorized',
  price_usd       NUMERIC(10,2) NOT NULL,
  image_url       TEXT,
  available       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_store_products_available ON store_products(available) WHERE deleted_at IS NULL;
```

---

### Table: `orders`
```sql
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  group_buy_id    UUID REFERENCES group_buys(id),   -- NULL for store orders
  store_order     BOOLEAN NOT NULL DEFAULT false,

  -- Status lifecycle:
  -- pending_payment → payment_submitted → payment_verified → processing → shipped → completed
  -- rejected (terminal)
  order_status    TEXT NOT NULL DEFAULT 'pending_payment'
                    CHECK (order_status IN (
                      'pending_payment',
                      'payment_submitted',
                      'payment_verified',
                      'processing',
                      'shipped',
                      'completed',
                      'rejected',
                      'cancelled'
                    )),

  -- Payment status (separate concern from fulfillment status)
  payment_status  TEXT NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending', 'submitted', 'verified', 'rejected', 'refunded')),

  -- Totals (denormalized for query performance)
  subtotal_usd    NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_fee_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  admin_fee_usd   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_usd       NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Notes
  admin_notes     TEXT,
  user_notes      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_group_buy_id ON orders(group_buy_id);
CREATE INDEX idx_orders_order_status ON orders(order_status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

---

### Table: `order_items`
```sql
CREATE TABLE order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id          UUID REFERENCES products(id),          -- NULL if store product
  store_product_id    UUID REFERENCES store_products(id),    -- NULL if group buy product
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_usd      NUMERIC(10,2) NOT NULL,
  line_total_usd      NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price_usd) STORED,

  -- Snapshot of product name at time of order (in case product is later renamed)
  product_name_snapshot TEXT NOT NULL,

  -- Per-item fulfillment status
  fulfillment_status  TEXT NOT NULL DEFAULT 'awaiting_vendor'
                        CHECK (fulfillment_status IN (
                          'awaiting_vendor',
                          'on_hand',
                          'packed',
                          'shipped',
                          'delivered'
                        )),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

---

### Table: `payments`
```sql
CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id),
  user_id             UUID NOT NULL REFERENCES users(id),

  -- Submitted by user
  tx_hash             TEXT NOT NULL,
  blockchain_network  TEXT NOT NULL,           -- 'Ethereum', 'Solana', 'Bitcoin', etc.
  from_wallet_address TEXT,
  amount_submitted_usd NUMERIC(10,2),          -- User-reported USD value
  amount_expected_usd NUMERIC(10,2) NOT NULL,  -- What we expected them to send
  token_symbol        TEXT NOT NULL,           -- 'USDC', 'ETH', 'SOL', etc.

  -- Computed
  explorer_url        TEXT NOT NULL,           -- Derived from network + tx_hash
  within_tolerance    BOOLEAN,                 -- Set after admin review

  -- Review
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by         UUID REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  admin_notes         TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_tx_hash ON payments(tx_hash);
CREATE UNIQUE INDEX idx_payments_tx_hash_network ON payments(tx_hash, blockchain_network);
```

**Explorer URL generation logic (server-side):**
```typescript
function getExplorerUrl(txHash: string, network: string): string {
  switch (network) {
    case 'Ethereum': return `https://etherscan.io/tx/${txHash}`
    case 'Solana':   return `https://solscan.io/tx/${txHash}`
    case 'Base':     return `https://basescan.org/tx/${txHash}`
    case 'Arbitrum': return `https://arbiscan.io/tx/${txHash}`
    case 'Polygon':  return `https://polygonscan.com/tx/${txHash}`
    case 'Bitcoin':  return `https://mempool.space/tx/${txHash}`
    default:         return `https://etherscan.io/tx/${txHash}`
  }
}
```

---

### Table: `shipments`
```sql
CREATE TABLE shipments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id),

  -- Carrier info
  carrier         TEXT,                        -- 'USPS', 'UPS', 'FedEx', 'DHL', etc.
  tracking_number TEXT,
  tracking_url    TEXT,
  tracking_image_url TEXT,                     -- R2/Blob URL for label/screenshot

  -- Timing
  shipped_at      TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,

  -- Partial shipment support
  is_partial      BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,                        -- E.g. "Missing reta-30, ships separately"

  -- Admin
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipments_order_id ON shipments(order_id);
CREATE INDEX idx_shipments_tracking_number ON shipments(tracking_number);
```

---

### Table: `admin_actions` (Audit Log)
```sql
CREATE TABLE admin_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES users(id),
  action_type     TEXT NOT NULL,               -- e.g. 'payment_approved', 'order_status_changed', 'user_suspended'
  target_type     TEXT NOT NULL,               -- 'order', 'payment', 'user', 'group_buy', 'product', 'shipment'
  target_id       UUID NOT NULL,               -- The affected record ID
  payload         JSONB,                       -- Before/after values or action-specific data
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_actions_admin_user ON admin_actions(admin_user_id);
CREATE INDEX idx_admin_actions_target ON admin_actions(target_type, target_id);
CREATE INDEX idx_admin_actions_action_type ON admin_actions(action_type);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at DESC);
```

### Entity Relationships

```
users (1) ──────────── (many) wallets
users (1) ──────────── (many) orders
users (1) ──────────── (many) payments

group_buys (1) ─────── (many) products
group_buys (1) ─────── (many) accepted_payments
group_buys (1) ─────── (many) orders

orders (1) ─────────── (many) order_items
orders (1) ─────────── (many) payments
orders (1) ─────────── (many) shipments

order_items (many) ─── (1) products  OR  (1) store_products

admin_actions ──────── references any entity via target_type + target_id
```

### Shipping Box Size Table (optional, for admin shipping calculator)
```sql
CREATE TABLE shipping_box_sizes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id UUID REFERENCES group_buys(id) ON DELETE CASCADE,  -- NULL = global default
  name        TEXT NOT NULL,                  -- 'Small', '6x4x2'
  length_in   NUMERIC(8,3) NOT NULL,
  width_in    NUMERIC(8,3) NOT NULL,
  height_in   NUMERIC(8,3) NOT NULL,
  volume_in3  NUMERIC(12,4) GENERATED ALWAYS AS (length_in * width_in * height_in) STORED,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 5. API Endpoints

### Authentication

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/auth/register` | Public | `{ email, password, fullName }` | `{ user, session }` |
| POST | `/api/auth/[...nextauth]` | NextAuth | NextAuth credentials | NextAuth session |
| GET | `/api/auth/session` | Session | — | `{ user }` or 401 |

---

### Users — Self

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/api/users/me` | User | — | Full user profile |
| PATCH | `/api/users/me` | User | Partial user fields | Updated user |
| GET | `/api/users/me/wallets` | User | — | `Wallet[]` |
| POST | `/api/users/me/wallets` | User | `{ chain, address, label? }` | Created wallet |
| DELETE | `/api/users/me/wallets/:walletId` | User | — | 204 |

**GET /api/users/me response shape:**
```typescript
{
  id: string
  email: string
  fullName: string | null
  discordName: string | null
  phone: string | null
  shippingLine1: string | null
  shippingLine2: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingZip: string | null
  shippingCountry: string | null
  profileComplete: boolean
  accountStatus: 'active' | 'suspended' | 'pending'
  role: 'user' | 'admin'
  createdAt: string
}
```

---

### Group Buys (Public/User)

| Method | Path | Auth | Query Params | Response |
|--------|------|------|-------------|----------|
| GET | `/api/group-buys` | User | `status=active` | `GroupBuy[]` with product summaries |
| GET | `/api/group-buys/:id` | User | — | Full `GroupBuy` with products, payment info, MOQ progress |

**GET /api/group-buys/:id response shape:**
```typescript
{
  id: string
  name: string
  description: string
  imageUrl: string | null
  status: 'draft' | 'active' | 'closed' | 'fulfilled'
  endDate: string
  paymentInfo: string                    // "USDC (Ethereum) ONLY"
  totalKitsOrdered: number
  totalMoqGoal: number
  acceptedPayments: {
    id: string
    token: string
    walletAddress: string
    network: string
  }[]
  products: {
    id: string
    name: string
    description: string
    priceUsd: number
    regularPriceUsd: number | null
    moq: number
    maxPerUser: number | null
    kitsOrdered: number
    inStock: boolean
  }[]
}
```

---

### Store Products (Public/User)

| Method | Path | Auth | Query Params | Response |
|--------|------|------|-------------|----------|
| GET | `/api/store/products` | User | `category=peptide` | `StoreProduct[]` |

---

### Orders

| Method | Path | Auth | Body / Params | Response |
|--------|------|------|--------------|----------|
| GET | `/api/orders` | User | `?groupBuyId=&status=` | `Order[]` (current user only) |
| POST | `/api/orders` | User | `{ groupBuyId?, items: [{productId, quantity}] }` | Created `Order` |
| GET | `/api/orders/:orderId` | User | — | Full `Order` with items, payments, shipments |

**POST /api/orders validation:**
- User must have `profileComplete === true`
- Group buy must have `status === 'active'`
- Each product must be `inStock === true`
- Each quantity must be ≤ `maxPerUser`
- Create order with `order_status = 'pending_payment'`

---

### Payments

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/payments` | User | `{ orderId, txHash, network, fromWallet?, amountSubmittedUsd?, tokenSymbol }` | Created `Payment` |

**POST /api/payments logic:**
1. Validate order belongs to current user and is `pending_payment`
2. Compute `explorerUrl` from network + txHash
3. Store payment record with `status = 'pending'`
4. Update order `order_status → 'payment_submitted'`, `payment_status → 'submitted'`
5. Log to `admin_actions`
6. Return payment with explorer URL

---

### Admin — Group Buys

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/admin/group-buys` | Admin | All group buys, all statuses |
| POST | `/api/admin/group-buys` | Admin | Create new campaign |
| GET | `/api/admin/group-buys/:id` | Admin | Full detail including order totals |
| PATCH | `/api/admin/group-buys/:id` | Admin | Update any field |
| DELETE | `/api/admin/group-buys/:id` | Admin | Soft delete (set deleted_at) |
| PATCH | `/api/admin/group-buys/:id/status` | Admin | `{ status: 'active' | 'closed' | 'fulfilled' }` |
| POST | `/api/admin/group-buys/:id/products` | Admin | Add product to campaign |
| PATCH | `/api/admin/group-buys/:id/products/:productId` | Admin | Update product |
| DELETE | `/api/admin/group-buys/:id/products/:productId` | Admin | Remove product |

---

### Admin — Store Products

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/admin/store/products` | Admin | All store products |
| POST | `/api/admin/store/products` | Admin | Create store product |
| PATCH | `/api/admin/store/products/:id` | Admin | Update product |
| DELETE | `/api/admin/store/products/:id` | Admin | Soft delete |

---

### Admin — Orders

| Method | Path | Auth | Query Params / Body | Notes |
|--------|------|------|---------------------|-------|
| GET | `/api/admin/orders` | Admin | `?groupBuyId=&status=&userId=&page=&limit=` | All orders, paginated |
| GET | `/api/admin/orders/:id` | Admin | — | Full order detail |
| PATCH | `/api/admin/orders/:id` | Admin | `{ orderStatus?, adminNotes? }` | Update status |
| PATCH | `/api/admin/orders/:id/items/:itemId` | Admin | `{ quantity?, fulfillmentStatus? }` | Update line item |
| POST | `/api/admin/orders/:id/items` | Admin | `{ productId, quantity }` | Add item to order |
| DELETE | `/api/admin/orders/:id/items/:itemId` | Admin | — | Remove item |

---

### Admin — Payments (Verification)

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| GET | `/api/admin/payments` | Admin | `?status=pending&page=&limit=` | Payments awaiting review |
| GET | `/api/admin/payments/:id` | Admin | — | Full payment detail |
| PATCH | `/api/admin/payments/:id/approve` | Admin | `{ notes? }` | Approve payment → updates order status |
| PATCH | `/api/admin/payments/:id/reject` | Admin | `{ reason }` | Reject payment → order back to pending |

**PATCH approve logic:**
1. Set `payments.status = 'approved'`
2. Update `orders.order_status → 'payment_verified'`, `payment_status → 'verified'`
3. Log to `admin_actions`

---

### Admin — Shipments

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| POST | `/api/admin/shipments` | Admin | `{ orderId, carrier, trackingNumber, isPartial?, notes? }` | Create shipment |
| PATCH | `/api/admin/shipments/:id` | Admin | `{ trackingNumber?, deliveredAt?, ... }` | Update tracking |
| POST | `/api/admin/shipments/:id/tracking-image` | Admin | `FormData` | Upload tracking photo |

**POST shipment logic:**
1. Create shipment record
2. Update `orders.order_status → 'shipped'`
3. Log to `admin_actions`
4. (Future) Send email notification to user

---

### Admin — Users

| Method | Path | Auth | Query Params | Notes |
|--------|------|------|-------------|-------|
| GET | `/api/admin/users` | Admin | `?search=&status=&page=&limit=` | Paginated user list |
| GET | `/api/admin/users/:id` | Admin | — | User + all orders + wallets |
| PATCH | `/api/admin/users/:id` | Admin | `{ notes?, accountStatus?, discordName?, shippingAddress? }` | Update user |

---

### Admin — File Uploads

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| POST | `/api/admin/uploads` | Admin | `FormData { file, type: 'campaign-image' | 'tracking-image' }` | Upload to R2/Blob, return URL |

---

### Admin — Analytics

| Method | Path | Auth | Query Params | Notes |
|--------|------|------|-------------|-------|
| GET | `/api/admin/analytics/overview` | Admin | `?groupBuyId=` | Revenue, order counts, MOQ progress |
| GET | `/api/admin/analytics/payments` | Admin | `?status=` | Payment stats: pending/verified counts and amounts |
| GET | `/api/admin/analytics/fulfillment` | Admin | `?groupBuyId=` | Per-item fulfillment progress |

---

### Response & Error Format

All endpoints return consistent shapes:

**Success:**
```json
{ "data": { ... } }
```

**Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

**HTTP status conventions:**
- 200: Success with body
- 201: Created
- 204: Success, no body
- 400: Validation error (Zod)
- 401: Not authenticated
- 403: Authenticated but unauthorized (wrong role, wrong user)
- 404: Record not found
- 409: Conflict (e.g. duplicate tx hash)
- 500: Unexpected server error

---

---

## 5.1. Alchemy Integration for Automated Payments

### Enhanced Payment System

**Replaces manual transaction hash submission with automated USDC transfer detection.**

#### New Payment Flow
1. User provides wallet address at checkout
2. User sends USDC to campaign wallet  
3. Alchemy webhook detects transfer
4. System auto-matches to pending orders
5. Order automatically marked as verified

#### Additional Database Tables

**Customer Wallet Tracking:**
```sql
-- Add to orders table
ALTER TABLE orders ADD COLUMN customer_wallet_address TEXT;
CREATE INDEX idx_orders_customer_wallet ON orders(customer_wallet_address);
```

**Webhook Event Audit:**
```sql
CREATE TABLE alchemy_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  from_address    TEXT NOT NULL,
  to_address      TEXT NOT NULL,
  token_address   TEXT NOT NULL,           -- USDC contract
  value_usd       NUMERIC(10,2),
  network         TEXT NOT NULL,
  processed       BOOLEAN DEFAULT false,
  matched_order_id UUID REFERENCES orders(id),
  match_confidence INTEGER,                -- 0-100
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

#### Additional API Endpoints
```
POST /api/webhooks/alchemy/payment-received  # Webhook handler
GET  /api/orders/:id/payment-status         # Live payment status
POST /api/admin/payments/:id/force-match    # Manual override
```

#### Environment Variables
```bash
ALCHEMY_API_KEY=your_api_key
ALCHEMY_WEBHOOK_SIGNING_KEY=webhook_secret
USDC_CONTRACT_ETHEREUM=0xA0b86a33E6441038DF2c28C74b1a7ab4aca7f1e2
```

---

## 6. Phased Implementation Roadmap

Phases are ordered by dependency. Each phase produces a functional, deployable increment.

---

### Phase 0 — Foundation (Prerequisite for Everything)
**Goal:** Working project scaffold with DB, auth session, and deploy pipeline. No UI changes yet.

**Tasks:**
1. Remove unused dependencies: expo, react-native, expo-*, etc.
2. Add new dependencies: `next-auth@5`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcryptjs`, `@types/bcryptjs`, `swr`
3. Set up Neon database project
4. Create Drizzle schema file (`db/schema.ts`) with all tables from Section 4
5. Configure `drizzle.config.ts` and run initial migration
6. Configure NextAuth with credentials provider
7. Create `middleware.ts` — protect all `/(auth)/*` routes (redirect to `/login` if no session), protect `/api/admin/*` (require role=admin)
8. Set up environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
9. Deploy to Vercel, confirm env vars are live

**Deliverable:** App deploys. Auth middleware blocks protected routes. DB is migrated.

---

### Phase 1 — Auth & User Profile
**Goal:** Real login, registration, and profile management backed by the DB.

**Dependencies:** Phase 0

**Tasks:**
1. Build `POST /api/auth/register` route handler (validate with Zod, hash password with bcrypt, insert user)
2. Build `/register` page with form (full name, email, password, confirm password)
3. Update `/login` Hero component — replace `[Log In]` / `[Register]` nav links with real form flow
4. Build `GET /api/users/me` and `PATCH /api/users/me` route handlers
5. Fix `AccountDetailsCard` — add missing props, call `PATCH /api/users/me` on save
6. Fix `ShippingAddressCard` — same fix
7. Build `GET/POST/DELETE /api/users/me/wallets` handlers
8. Update `WalletsCard` and `AddWalletDialog` to call API instead of localStorage
9. Move profile completeness check to server: set `profile_complete` on every `PATCH /api/users/me`, use session value in `AccountWarningBanner`
10. Update `AuthHeader` nav — add logout, conditionally show Admin link only for admins
11. Remove all `loadFromStorage`/`saveToStorage` calls from account page and components

**Deliverable:** Users can register, log in, update their profile and shipping address, and add/remove wallets. All data persists in Postgres.

---

### Phase 2 — Group Buys (Read Side)
**Goal:** Group buy data is served from the DB. The home and group-buy detail pages are real.

**Dependencies:** Phase 0, Phase 1

**Tasks:**
1. Build `GET /api/group-buys` — return active group buys (status=active, end_date > now)
2. Build `GET /api/group-buys/:id` — full detail with products and accepted_payments
3. Update `/home` page — remove `mockGroupBuys`, fetch from API via `useSWR`
4. Update `/group-buy/[id]` page — remove `mockGroupBuy`, fetch by actual URL `params.id`
5. Seed one real group buy + products in the database (or via admin UI from Phase 4)
6. Remove `defaultOrder` injection from account/page.tsx
7. Remove `testUndeliveredOrder` from userbase-management.tsx

**Deliverable:** Home page and group buy detail page show real campaign data. Hardcoded mock group buy objects are gone.

---

### Phase 3 — Orders & Payments (Submit Flow)
**Goal:** Users can place orders and submit payment hashes. Orders and payments persist in DB.

**Dependencies:** Phase 2

**Tasks:**
1. Build `POST /api/orders` handler with full validation (profile complete, GB active, stock, maxPerUser)
2. Build `POST /api/payments` handler (validate order, store payment, derive explorerUrl, update order status)
3. Refactor `CheckoutOverlay` — remove `paymentOptions` hardcode, fetch `acceptedPayments` from the current group buy's data (already loaded). Remove random coin flip. Call `POST /api/orders` then `POST /api/payments`. Remove localStorage writes.
4. Refactor `StoreCheckoutOverlay` similarly, call `POST /api/orders` for store purchases
5. Remove `mergeOrCreateOrder` from storage.ts (no longer needed)
6. Build `GET /api/orders` for the current user
7. Update `OrdersCard` and `OrderDetailOverlay` to load from API
8. Remove random product status assignment from `OrderDetailOverlay` — load from `order_items.fulfillment_status`
9. Remove `storage.ts` entirely (or gut it — all localStorage logic is now gone)

**Deliverable:** Users can place orders and submit tx hashes. Orders are stored in Postgres. Order history shows real data. Payment status reflects actual submission.

---

### Phase 4 — Admin: Campaign & Store CRUD
**Goal:** Admin can create, edit, and publish group buys and store products via the UI — all backed by DB.

**Dependencies:** Phase 0 (auth/admin middleware)

**Tasks:**
1. Build all `GET/POST/PATCH/DELETE /api/admin/group-buys` and product sub-endpoints
2. Build all `GET/POST/PATCH/DELETE /api/admin/store/products` endpoints
3. Build `POST /api/admin/uploads` file upload endpoint (Cloudflare R2 or Vercel Blob)
4. Update `CampaignManagement` component — replace `loadFromStorage`/`saveToStorage` with API calls. Wire up image upload to file endpoint.
5. Update `StoreManagement` component — replace localStorage with API calls
6. Add form validation feedback (loading states, error toasts) to both admin components

**Deliverable:** Admins can fully manage campaigns and store products via the UI. Data persists in DB and is immediately visible to users.

---

### Phase 5 — Admin: Order Management & Payment Verification
**Goal:** Admins can view all orders, verify payments, and update order statuses.

**Dependencies:** Phase 3, Phase 4

**Tasks:**
1. Build `GET /api/admin/orders` with filter params (groupBuyId, status, userId, pagination)
2. Build `PATCH /api/admin/orders/:id` (status, notes)
3. Build `PATCH /api/admin/orders/:id/items/:itemId` (quantity, fulfillmentStatus)
4. Build `POST|DELETE /api/admin/orders/:id/items`
5. Build `GET /api/admin/payments` (pending only by default)
6. Build `PATCH /api/admin/payments/:id/approve` and `/reject`
7. Add **Payment Verification Tab** to admin panel: table of pending payments, expected vs submitted amount, tolerance check visual, explorer link, Approve/Reject actions
8. Replace `UserbaseManagement` fake user generation with real `GET /api/admin/users` call
9. Update `UserDetailOverlay` — load real user data, call API for order edits and fulfillment status changes. Remove hardcoded `AVAILABLE_PRODUCTS` — fetch from active group buy products.
10. Add audit log writes (`admin_actions` table) to all admin mutation endpoints

**Deliverable:** Full payment verification workflow. Admins can manage any order. User management shows real users. Every admin action is logged.

---

### Phase 6 — Fulfillment & Shipping
**Goal:** Admins can create shipments, upload tracking info, and users see shipping status.

**Dependencies:** Phase 5

**Tasks:**
1. Build `POST /api/admin/shipments` and `PATCH /api/admin/shipments/:id`
2. Build `POST /api/admin/shipments/:id/tracking-image` (file upload)
3. Add **Fulfillment Tab** to admin panel:
   - Per-group-buy order list with fulfillment status
   - "Mark Shipped" action → opens modal to enter tracking number, carrier, upload tracking image
   - Partial shipment flag with notes
   - Batch shipping action (mark multiple orders shipped)
4. Update `OrderDetailOverlay` — show shipment info (carrier, tracking number, tracking link)
5. Update order status display to match full status lifecycle (pending_payment → ... → completed)
6. Set up Resend email: send shipping notification email when order status changes to 'shipped'

**Deliverable:** End-to-end fulfillment. Users get shipping updates in their dashboard. Admins can handle partial shipments.

---

### Phase 7 — Store Products & Store Page
**Goal:** Store page serves real products from DB, checkout works the same as group buy checkout.

**Dependencies:** Phase 3, Phase 4

**Tasks:**
1. Build `GET /api/store/products` with optional category filter
2. Update `/store` page — remove `mockProducts`, fetch from API
3. The `StoreCheckoutOverlay` already works after Phase 3 changes
4. Wire up "Join Group Buy" button on store page — link to the relevant group buy detail page (currently a dead button)

**Deliverable:** Store serves real products from DB.

---

### Phase 8 — Analytics & Polish
**Goal:** Admin analytics, cleanup, performance, error handling.

**Dependencies:** Phases 4–7

**Tasks:**
1. Build `GET /api/admin/analytics/*` endpoints
2. Add **Analytics Tab** to admin panel: revenue charts (recharts, already installed), MOQ progress per product, pending payment totals, fulfillment completion rate
3. Add proper loading skeletons to all data-fetching components
4. Add error boundary components for fetch failures
5. Fix remaining TypeScript errors — remove `ignoreBuildErrors: true` from next.config.ts
6. Enable Next.js Image optimization — remove `unoptimized: true` from next.config.ts
7. Fix ESLint — remove `ignoreDuringBuilds: true`
8. Add rate limiting to auth endpoints (registration, login)
9. Input sanitization audit across all forms
10. Mobile responsiveness audit on admin tabs

**Deliverable:** Production-ready analytics. Clean build with no suppressed errors.

---

### Summary Dependency Graph

```
Phase 0 (Foundation)
    └── Phase 1 (Auth & Profile)
            └── Phase 2 (Group Buys Read)
                    └── Phase 3 (Orders & Payments) ─────┐
                                                          │
Phase 0 ───────────────── Phase 4 (Admin CRUD) ──────────┤
                                   │                      │
                                   └── Phase 5 (Order Mgmt & Payments)
                                               │
                                               └── Phase 6 (Fulfillment)

Phase 3 + Phase 4 ─── Phase 7 (Store)

Phases 4–7 ─────────── Phase 8 (Analytics & Polish)
```

### What to Preserve From v0

The following must be kept exactly as-is (form and function):

- WebGL particle background (`components/gl/**`) — signature visual
- Page layout: mask gradient on content, glassmorphism cards (`bg-background/60 backdrop-blur-md border-white/10`)
- Route transition animations (Framer Motion fade between pages)
- AuthHeader animated logo transition (login → home)
- Mobile hamburger menu behavior
- Color system: yellow/gold `#FFC700` / `bg-yellow-600` for CTAs, cyan for transaction links, dark transparent cards
- Sentient font (public/Sentient-*.woff) used in hero heading
- `[Log In]` / `[Register]` button bracket style on landing page
- Group buy product cards with progress bars and discount badges
- Cart sidebar sticky behavior on group buy page
- Checkout overlay animation (spring physics)
- Order detail overlay layout
