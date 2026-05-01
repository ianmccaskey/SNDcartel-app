# SNDcartel — Group Buy Marketplace

A community peptide group-buy platform. Users join time-limited campaigns, submit crypto payments, and admins verify transactions and fulfill orders.

## Quick Start

```bash
pnpm install
# Configure .env.local (see below)
pnpm drizzle-kit push    # sync schema to Neon
pnpm dev                  # http://localhost:3000
```

## Environment (.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `NEXTAUTH_SECRET` | Yes | Generate: `openssl rand -base64 32` |
| `ALCHEMY_API_KEY` | For payments | Alchemy API key for tx verification |
| `ALCHEMY_WEBHOOK_SIGNING_KEY` | For payments | Alchemy webhook signing key |
| `RESEND_API_KEY` | Optional | For transactional emails |
| `EMAIL_FROM` | Optional | Sender email address |

Current DB is Neon at `ep-dawn-frost-ank3q83t-pooler.c-6.us-east-1.aws.neon.tech`. NEXTAUTH_SECRET in .env.local is a placeholder — replace before production.

## Tech Stack

- **Next.js 16** — App Router (Server Components + Client Components)
- **React 19** + TypeScript
- **Neon Postgres** — serverless
- **Drizzle ORM** — type-safe queries + schema (no raw SQL in app code)
- **NextAuth v5** — credentials-based auth with session cookies (not JWT)
- **Tailwind CSS v4** + **shadcn/ui** + **Radix UI** — component library
- **Alchemy SDK** — on-chain transaction verification + webhooks
- **Recharts** — admin analytics charts
- **Resend** — transactional email (shipping notifications)

## Project Structure

```
SNDcartel-app/
├── app/
│   ├── (auth)/                  # Authenticated pages
│   │   ├── layout.tsx           # Auth layout (sidebar + user context)
│   │   ├── home/                # Campaign browser (landing page)
│   │   ├── group-buy/[id]/      # Campaign detail + checkout
│   │   ├── store/               # Product catalog
│   │   ├── account/             # User profile + orders
│   │   ├── account-simple/      # Simplified account view
│   │   ├── admin/               # Admin panel (analytics, campaigns, orders)
│   │   ├── login/
│   │   └── register/
│   ├── api/                     # 40+ API routes (see API section)
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   ├── error.tsx                # Error boundary
│   ├── not-found.tsx            # 404
│   └── globals.css
├── components/
│   ├── admin/                   # Admin panel components
│   └── ui/                      # Shared UI primitives (shadcn-style)
├── db/
│   ├── schema.ts                # Drizzle table definitions (466 lines)
│   ├── index.ts                 # DB client
│   └── seed.ts                  # Seed data
├── lib/
│   ├── auth.ts                  # NextAuth v5 config
│   ├── alchemy.ts               # Alchemy SDK helpers
│   ├── payment-matcher.ts       # TX hash matching logic
│   ├── audit.ts                 # Audit log helpers
│   ├── email.ts                 # Resend email helpers
│   ├── tracking.ts              # Shipment tracking helpers
│   ├── storage.ts               # File/image storage (R2)
│   ├── types.ts                 # Shared TypeScript types
│   ├── utils.ts                 # Utility functions (cn, formatters)
│   └── admin-types.ts           # Admin-specific types
├── types/
│   └── next-auth.d.ts           # NextAuth type extensions
├── templates/
│   └── shipping-notification.tsx # Email template (React Email)
├── public/                      # Static assets
├── styles/                      # Global styles
├── SPEC.md                      # Full feature specification
├── ARCHITECTURE.md              # Detailed architecture doc (55 KB)
├── ALCHEMY_INTEGRATION.md       # Alchemy setup guide
├── README.md                    # Setup instructions
├── package.json                 # Dependencies
├── auth.config.ts               # NextAuth middleware config
├── middleware.ts                 # Next.js middleware (auth protection)
├── drizzle.config.ts            # Drizzle Kit configuration
└── tsconfig.json
```

## Database Schema

Tables (all in public schema):
- **users** — id, username, email, password_hash, role (user/admin), shipping_address, country, state, postal_code, phone
- **group_buys** — id, name, description, vendor, start_date, end_date, status (active/closed/fulfilled), payment_wallet, supported_networks
- **products** — id, group_buy_id, name, description, price, moq, weight, dimensions, images, vendor_ref
- **orders** — id, user_id, group_buy_id, order_status, payment_status, created_at
- **order_items** — id, order_id, product_id, quantity, price
- **payments** — id, order_id, tx_hash, blockchain_network, amount_sent, wallet_used, status (pending/verified/rejected), verified_by, explorer_link
- **shipments** — id, order_id, tracking_number, carrier, tracking_image, shipped_at, status
- **admin_actions** — id, admin_id, action, target_type, target_id, details, created_at (audit log)

## API Routes

### Public
- `POST /api/auth/register` — Register new user
- `POST /api/auth/[...nextauth]` — NextAuth handler (login, logout, session)
- `GET /api/group-buys` — List active group buys
- `GET /api/group-buys/[id]` — Get group buy details
- `GET /api/store/products` — List store products

### Authenticated User
- `GET /api/users/me` — Current user profile
- `GET/POST /api/users/me/wallets` — User crypto wallets
- `DELETE /api/users/me/wallets/[walletId]`
- `POST /api/orders` — Create order
- `GET /api/orders/[orderId]` — Get order details
- `GET /api/orders/[orderId]/payment-status` — Check payment verification

### Admin (all require admin role)
- **Analytics:** `GET /api/admin/analytics/overview`, `/revenue`, `/orders`
- **Group Buys:** CRUD at `/api/admin/group-buys` + products sub-routes + status updates
- **Orders:** List, view, verify payment, bulk fulfillment
- **Payments:** List, approve, reject
- **Shipments:** CRUD + tracking image upload
- **Store Products:** CRUD
- **Users:** List, update role
- **Uploads:** File upload handler

### Webhooks
- `POST /api/webhooks/alchemy` — Alchemy transaction webhook receiver

## Auth System

- **Provider:** NextAuth v5 with Credentials provider
- **Password hashing:** bcryptjs
- **Session:** Database sessions (cookie-based, not JWT)
- **Middleware:** Protects `/(auth)` routes, redirects unauthenticated users to `/login`
- **Admin escalation:** Set `role = 'admin'` in users table via SQL

## Order Lifecycle

```
pending_payment → payment_submitted → payment_verified → processing → shipped → completed
```

## Payment Flow

1. User selects group buy, creates order
2. User sends crypto to designated wallet, submits TX hash
3. System stores TX info, generates explorer link
4. Admin reviews TX (compares amount, network, wallet)
5. Admin approves → order advances to `payment_verified`
6. Admin can reject with reason

Alchemy webhooks auto-detect incoming transactions and match them to pending orders.

## Conventions

- **File names:** lowercase with hyphens (e.g., `payment-matcher.ts`)
- **Components:** PascalCase (e.g., `PaymentVerifier.tsx`)
- **API routes:** RESTful, Next.js App Router `route.ts` handlers
- **Database:** Drizzle ORM for all queries — no raw SQL outside `db/`
- **Styling:** Tailwind utility classes + shadcn/ui component patterns
- **Types:** Shared types in `lib/types.ts`, admin types in `lib/admin-types.ts`
- **Auth:** All `(auth)` routes are protected by middleware
- **Secrets:** Never commit credentials. `.env.local` is in `.gitignore`

## What's Built

All 8 phases from the original SPEC.md are implemented:
- ✅ User accounts with registration, login, profile
- ✅ Group buy campaigns with MOQ tracking
- ✅ Order system with 6-state workflow
- ✅ Crypto payment submission + explorer links
- ✅ Admin panel with full CRUD
- ✅ Payment verification workflow
- ✅ Shipping & fulfillment with tracking
- ✅ Analytics dashboard with charts

## What Needs Work

- `.env.local` needs a real `NEXTAUTH_SECRET` before production
- Alchemy API keys need to be added for live payment verification
- Resend API key needed for email notifications
- Database has not been seeded — run `pnpm tsx db/seed.ts` after schema push
- No test suite exists
- No CI/CD pipeline configured

## Git Strategy

- `main` — stable baseline (this commit = complete 8-phase app)
- `claude-code` — active development branch (you're working here)
- Open PRs from `claude-code` → `main` for review

---

*Project originally built by OpenClaw agent (March 2026). Migrated to E: drive and handed off April 2026.*
