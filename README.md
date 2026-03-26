# SNDcartel — Group Buy Marketplace

A community peptide group-buy platform. Users join time-limited campaigns, submit crypto payments (USDC/USDT/ETH/SOL/BTC), and admins verify transactions and fulfill orders.

## Stack

- **Next.js 16** — App Router, Server Components
- **PostgreSQL** — [Neon](https://neon.tech) serverless Postgres
- **Drizzle ORM** — type-safe query builder + migrations
- **NextAuth v5** — credentials-based auth with session cookies
- **Alchemy** — on-chain transaction verification via SDK + webhooks
- **Cloudflare R2** — file/image storage (optional)
- **Resend** — transactional email (optional)
- **Recharts** — admin analytics charts
- **Tailwind CSS v4** — styling

## Setup

### 1. Clone & install

```bash
git clone <repo-url>
cd SNDcartel-app
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App base URL (e.g. `http://localhost:3000`) |
| `ALCHEMY_API_KEY` | Alchemy API key for tx verification |
| `ALCHEMY_WEBHOOK_SIGNING_KEY` | Alchemy webhook signing key |
| `NEXT_PUBLIC_STORE_WALLET_ADDRESS` | USDC wallet for store purchases |

Optional (email & file storage):
- `RESEND_API_KEY` + `EMAIL_FROM` — for order emails
- `R2_*` vars or `BLOB_READ_WRITE_TOKEN` — for image uploads

### 3. Run database migrations

```bash
pnpm drizzle-kit push
```

Or generate and apply migration SQL:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 4. Seed (optional)

```bash
pnpm tsx db/seed.ts
```

### 5. Start dev server

```bash
pnpm dev
```

App runs at [http://localhost:3000](http://localhost:3000).

## Creating an Admin Account

Register normally at `/register`, then update the role in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Key Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/register` | Sign up |
| `/home` | Campaign browser |
| `/group-buy/[id]` | Campaign detail & checkout |
| `/store` | Store product catalog |
| `/account` | User profile & orders |
| `/admin` | Admin panel (analytics, campaigns, payments, fulfillment) |

## Alchemy Webhook Setup

1. Go to [dashboard.alchemy.com](https://dashboard.alchemy.com) → Webhooks
2. Create a webhook pointing to `https://your-domain.com/api/webhooks/alchemy`
3. Copy the signing key to `ALCHEMY_WEBHOOK_SIGNING_KEY`
4. Add the USDC wallet addresses you want to monitor

## Project Structure

```
app/
  (auth)/          — authenticated pages
  api/             — API routes
  not-found.tsx    — 404 page
  error.tsx        — error boundary
components/
  admin/           — admin panel components
  ui/              — shared UI primitives (shadcn-style)
db/
  schema.ts        — Drizzle table definitions
  index.ts         — DB client
lib/
  auth.ts          — NextAuth config
  alchemy.ts       — Alchemy SDK helpers
  payment-matcher.ts — TX hash matching logic
  email.ts         — Resend email helpers
  audit.ts         — Audit log helpers
```
