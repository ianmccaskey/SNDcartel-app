# SNDcartel — Community Group-Buy Marketplace

A web app that lets a community pool together to buy peptides at bulk pricing. Members join time-limited campaigns, pay in crypto, and admins verify payments and ship orders out.

---

## Table of contents

1. [What this app actually does](#what-this-app-actually-does)
2. [The user journey, plain English](#the-user-journey-plain-english)
3. [The admin journey, plain English](#the-admin-journey-plain-english)
4. [The tech stack — what it's built on, and why](#the-tech-stack--whats-built-on-and-why)
5. [How the pieces fit together](#how-the-pieces-fit-together)
6. [End-to-end workflows](#end-to-end-workflows)
   - [Sign up & profile setup](#workflow-1-sign-up--profile-setup)
   - [Browse and join a group buy](#workflow-2-browse-and-join-a-group-buy)
   - [Place an order and pay with crypto](#workflow-3-place-an-order-and-pay-with-crypto)
   - [Automatic payment verification](#workflow-4-automatic-payment-verification)
   - [Admin manages a campaign](#workflow-5-admin-manages-a-campaign)
   - [Fulfillment and shipping](#workflow-6-fulfillment-and-shipping)
   - [Deployment](#workflow-7-deployment-git-push--digitalocean)
7. [Project structure](#project-structure)
8. [Local development setup](#local-development-setup)
9. [Operations & deployment](#operations--deployment)
10. [Commands cheat sheet](#commands-cheat-sheet)
11. [Glossary](#glossary)

---

## What this app actually does

A **group buy** is when a bunch of people pool their orders together so they can buy something at wholesale prices instead of retail. Like Costco but organized by a community for a specific time-limited campaign.

SNDcartel is the platform that runs this end-to-end:

- **Admins** spin up a campaign: "We're buying SS-31, Tirzepatide, and BPC-157 from a vendor. The minimum order quantity (MOQ) is 985 kits. We need everyone's orders by June 1."
- **Members** browse active campaigns, pick the products they want, and pay in cryptocurrency (USDC, mostly).
- **The platform** automatically watches the campaign's wallet address, matches incoming crypto payments to orders, and marks them verified — no admin in the loop for the happy path.
- **Admins** manage everything: campaigns, payments that didn't auto-match, shipping, tracking numbers, refunds.
- **Members** get notified when their order ships and can track it from their account page.

The platform exists because group buys traditionally live on Discord and spreadsheets — this is the structured replacement.

---

## The user journey, plain English

1. **Create an account** with email + password and fill in shipping address. (You need a complete profile before you can order anything.)
2. **Add a crypto wallet address** to your profile. Pick the chain — Ethereum, Polygon, Solana, etc. You can add more than one.
3. **Browse the home page.** See active group buys, pictures, descriptions, and which products are available.
4. **Tap a campaign** to see prices, MOQ progress (e.g. "847 of 985 kits"), and the products on offer.
5. **Add items to your cart**, choose quantities (each product has a per-user max).
6. **Hit Proceed to Checkout.** Pick which crypto + chain you want to pay with — your matching wallet auto-fills as the "sending" address.
7. **Send the crypto** from your wallet to the displayed campaign wallet, exact amount.
8. **The platform detects your transaction automatically.** Within a minute or two, the order flips from "pending" to "verified" — no admin intervention needed if everything matches.
9. **Wait for the campaign to close** (e.g. June 1). Admins then place the bulk order with the vendor.
10. **When your kit ships**, you get an email with tracking. The order page also shows the carrier and tracking number.
11. **Get a delivery notification** when the carrier confirms it arrived.

Account page (`/account`) is your hub: order history, payment status, wallet management, profile.

---

## The admin journey, plain English

1. **Log in** with an admin account (admin role is set in the database; not self-serve).
2. **Open `/admin`** — five tabs:
   - **Analytics** — total users, total orders, revenue, active campaigns
   - **Campaigns** — create, edit, close, fulfill group buys; set products, prices, MOQ, dimensions, payment wallets, fees
   - **Store** — manage standalone (always-available) products
   - **Users** — search registered users, change roles, view their order history
   - **Payments** — manually approve/reject payment submissions that didn't auto-verify (e.g. wrong amount, wrong chain)
   - **Fulfillment** — once a campaign closes, mark items as packed → shipped → delivered, attach tracking numbers + carrier info
3. **Set up a campaign:**
   - Name, description, image (1:1 photo or short MP4 video — think hero shot)
   - Start/end dates, MOQ goal
   - Accepted payment options (e.g. "USDC on Ethereum", "USDC on Polygon") — each with the wallet address that customers will pay to
   - Products with name, description, price, regular price, peptide name, mass/dosage, MOQ per product, max per user, product/box dimensions
4. **Watch the campaign fill up.** Members place orders. Most payments auto-verify in seconds; flagged ones (e.g. wrong amount) wait in the Payments tab for admin review.
5. **Close the campaign** when the deadline hits or MOQ is reached.
6. **Place the vendor order** offline, receive the kits.
7. **In Fulfillment:** mark items as `on_hand` when they arrive, `packed`, then create shipments per order with carrier + tracking number. The platform emails customers automatically.
8. **Done.** Kits arrive, deliveries confirm, the campaign moves to `fulfilled`.

---

## The tech stack — what it's built on, and why

SNDcartel is a single Next.js application talking to one Postgres database, with a few external services bolted on for specialized work.

| Piece | What it is | Why this choice |
|---|---|---|
| **Next.js 16** (App Router) | The web framework. Renders pages, handles routing, runs API routes server-side. | One framework for the UI and the backend — no separate Express server to deploy. App Router makes server components first-class so most page rendering happens on the server, which is faster and cheaper. |
| **TypeScript** | JavaScript with types. | Catches whole categories of bugs at edit time before they reach a user. Especially useful when the codebase touches money, addresses, and database rows. |
| **PostgreSQL** via [Neon](https://neon.tech) | The database. Stores users, orders, payments, campaigns, products, audit logs. | Postgres is the boring, battle-tested choice. Neon makes it serverless — it scales to zero when idle (cheap) and handles connection pooling for serverless deployments (which is hard with vanilla Postgres). |
| **Drizzle ORM** | TypeScript layer on top of Postgres. | Lets us write queries like `db.select().from(orders).where(eq(orders.userId, id))` instead of raw SQL strings, with full type safety. Schema and migrations live in code, version-controlled. |
| **NextAuth v5** | Authentication. Manages "is this user logged in?" + sessions. | Industry-standard. Handles password hashing (bcrypt), session cookies, route protection middleware. Self-hosted, no third-party identity provider required. |
| **Alchemy SDK + webhooks** | On-chain transaction monitoring. Watches campaign wallet addresses, fires our endpoint when a USDC transfer happens. | Building blockchain RPC infrastructure is its own engineering org. Alchemy lets us listen to multi-chain transfers without running our own nodes, and their webhook signing keys make sure we only act on real notifications. |
| **Tailwind CSS v4** + **shadcn/ui** | Styling and UI components. | Tailwind = utility classes, no separate CSS files, very fast iteration. shadcn = ready-to-use components (buttons, modals, tables) that we *own* the source for — no upgrade-treadmill of an external dependency. |
| **Radix UI** (under shadcn) | Accessibility primitives for things like dialogs, dropdowns, popovers. | Hard problems (focus management, keyboard navigation, screen-reader semantics) are already solved correctly so we don't ship inaccessible UI. |
| **framer-motion** + **GSAP** | Animations and page transitions. | Smooth UI without writing keyframes by hand. |
| **Recharts** | Admin analytics charts. | React-native charting that pairs cleanly with the rest of the stack. |
| **Resend** (optional) | Transactional email — order confirmations, shipping notifications. | Cheap, no SMTP server to babysit. |
| **Cloudflare R2** or **DigitalOcean Spaces** | Image/file storage for product photos and shipping label images. | Cheap S3-compatible blob storage. R2 has no egress fees; Spaces is colocated with our deployment. |

### What that buys us

- **One language end-to-end** (TypeScript) so the developer can move fluidly between front-end, API, database queries, and external integrations.
- **Type safety from the database row up to the React component**. If a column is renamed in `db/schema.ts`, every consumer breaks at compile time, not at runtime.
- **Zero-management infra** for the parts where managing it is dumb. Postgres scales on Neon. Files sit on R2/Spaces. Alchemy watches the chain. We focus on product code.
- **Self-hostable.** Other than Alchemy + Neon (which both have free tiers), there's no required SaaS dependency. The whole app could in theory be moved to a single VM with self-hosted Postgres if needed.

---

## How the pieces fit together

```
                                      ┌──────────────────────┐
                                      │  Browser (user)      │
                                      │  - React UI          │
                                      │  - Tailwind / shadcn │
                                      └──────────┬───────────┘
                                                 │ HTTPS
                                                 ▼
                ┌─────────────────────────────────────────────────────────┐
                │  Next.js app (DigitalOcean App Platform)                │
                │                                                         │
                │  ┌────────────────────┐    ┌─────────────────────────┐  │
                │  │ Pages (RSC + RC)   │    │ API routes              │  │
                │  │ /home, /admin, …   │◄──►│ /api/orders, …          │  │
                │  │                    │    │ NextAuth handler        │  │
                │  │                    │    │ Alchemy webhook         │  │
                │  └────────────────────┘    └────────┬────────────────┘  │
                └────────────────────────────────────┬┴───────────┬───────┘
                                                    │             │
                                          Drizzle ORM            HTTPS
                                                    │             │
                                                    ▼             ▼
                                      ┌──────────────┐    ┌────────────────┐
                                      │ Neon Postgres│    │ Alchemy API +  │
                                      │              │    │ webhooks       │
                                      │ users        │    │ (USDC monitor) │
                                      │ orders       │    └────────┬───────┘
                                      │ payments     │             │
                                      │ shipments    │             │ tx events
                                      │ ...          │             │
                                      └──────────────┘             │
                                                                   ▼
                                                          ┌──────────────┐
                                                          │ Ethereum,    │
                                                          │ Polygon, …   │
                                                          │ blockchains  │
                                                          └──────────────┘

                Side services:    Resend (email)    R2/Spaces (image storage)
```

A user clicks something → React component re-renders → if it needs server data, calls an API route → API route uses Drizzle to read/write Postgres → returns JSON → component updates. The Alchemy webhook flow runs in the background, parallel to user activity.

---

## End-to-end workflows

### Workflow 1: Sign up & profile setup

1. New visitor lands on `/` (the marketing/login page).
2. Clicks **Register** → goes to `/register`. Fills email + password + name.
3. POST `/api/auth/register` creates a new row in the `users` table with a bcrypt-hashed password and the role `user`.
4. NextAuth signs them in (issues a session cookie) and redirects to `/home`.
5. A banner reminds them to complete their shipping address before they can place orders. They navigate to `/account` and fill it in.
6. They optionally add crypto wallet addresses (`Ethereum`, `Solana`, `Polygon`, etc.) — these will be auto-suggested at checkout time.

### Workflow 2: Browse and join a group buy

1. `/home` calls `GET /api/group-buys` → returns active campaigns + their products list.
2. The page renders an "Active Group Buys" card with the campaign image (or short looping video), title, end date, products as a row of indicator pills, and a yellow Participate button.
3. User clicks **Participate** → navigates to `/group-buy/[id]`.
4. `/api/group-buys/[id]` returns full campaign detail + every product with its MOQ progress, price, max-per-user, and the campaign's accepted payment options.
5. User picks quantities, taps **Add** on each product → items appear in the cart sidebar (desktop) or below the products (mobile).

### Workflow 3: Place an order and pay with crypto

1. With items in the cart, user taps **Proceed to Checkout**.
2. The page smooth-scrolls to the top of the screen and the **checkout overlay** slides in.
3. **Step 1 — Pick a payment method.** A dropdown lists the campaign's accepted payment options (e.g. "USDC (Ethereum)", "USDC (Polygon)").
4. **Step 2 — Wallet auto-fill.** As soon as a payment method is chosen, the user's saved wallet for that chain auto-fills into the "sending wallet address" input. (User can override if they want to send from a different wallet.)
5. **Step 3 — Review payment instructions.** The destination wallet address (the campaign's) and the exact amount to send are displayed with a copy button.
6. User goes to their actual crypto wallet (MetaMask, Phantom, etc.) and sends the funds to the displayed address.
7. User taps **Verify Payment**. (Caption above the button: *"Only verify once payment has been sent."*)
8. POST `/api/orders` creates an `orders` row, an `order_items` row per cart item, and a `payments` row capturing: user's wallet address, the chain, and the expected USD amount.
9. The order is in status `pending_payment`. The overlay flips to "Order Placed" and starts polling `/api/orders/[id]/payment-status` every 5 seconds.

### Workflow 4: Automatic payment verification

This runs in the background, parallel to whatever the user is doing.

1. **Alchemy is configured** with the campaign's wallet addresses to watch. When any USDC transfer hits one of those addresses, Alchemy POSTs a webhook to `/api/webhooks/alchemy`.
2. **Webhook signature is verified** using `ALCHEMY_WEBHOOK_SIGNING_KEY` so we know the call really came from Alchemy.
3. The webhook handler logs the event to `alchemy_webhook_events` (the audit table) and runs the **payment matcher** (`lib/payment-matcher.ts`):
   - Find a `pending_payment` order whose user's wallet matches the `from` address of the incoming transfer
   - Compare the transferred USDC amount to the order's expected amount (with a small tolerance, ~1%)
   - Compute a confidence score
4. If the confidence score is **≥ 80**, the matcher auto-approves: order moves to `payment_verified`, payment row is updated.
5. The user's polling endpoint sees the new status, the overlay flips to "Payment Verified!", and redirects them to `/account`.
6. If confidence is **< 80**: the payment row is left in `pending` for an admin to review manually in the Payments tab.

### Workflow 5: Admin manages a campaign

1. Admin opens `/admin/campaigns`. Hits **+ New Campaign**.
2. Fills in campaign details: name, description, hero image, start/end dates, MOQ goal.
3. Adds **accepted payment options** — each one is a `{token, network, walletAddress}` triple. The same campaign can accept USDC on Ethereum, USDC on Polygon, USDT on Solana, etc.
4. Adds **products** — name, description, peptide name, dosage, price, regular price, MOQ per product, max per user, dimensions for shipping math.
5. Saves. Campaign goes live with status `active` once start date passes.
6. As orders come in, admin watches the **MOQ progress bar** in the campaign editor.
7. Admin can manually adjust kits ordered (e.g. for orders placed offline that need to be counted).
8. When the campaign closes, admin places the bulk order with the vendor offline.

### Workflow 6: Fulfillment and shipping

1. Vendor delivers the kits to the admin.
2. Admin opens `/admin/fulfillment` (a 6-column table on desktop, stacked card layout on mobile — Customer / Items / Shipments / Fulfillment status / Actions).
3. As kits arrive, admin marks each item: `awaiting_vendor` → `on_hand` → `packed`.
4. When ready to ship, admin clicks **Ship** on an order:
   - Picks carrier (USPS / UPS / FedEx / DHL)
   - Enters tracking number
   - Optionally uploads a tracking image
   - Hits Save
5. A `shipments` row is created. Order status moves to `shipped`. The customer is emailed via Resend with the tracking link.
6. Carrier eventually marks the package delivered. (Admin sets `deliveredAt` manually for now; future: automatic via carrier APIs.)
7. Order moves to `completed`.

### Workflow 7: Deployment (`git push` → DigitalOcean)

1. Developer commits and pushes to the configured deploy branch (`v0/appleporgy-3573-0ca5d4ff` for now).
2. DigitalOcean App Platform detects the push (webhook from GitHub) and starts a new build.
3. Build runs `pnpm install` → `pnpm build` → produces a Next.js production build.
4. New build is rolled out, replacing the previous version with zero downtime (App Platform handles the swap).
5. Live URL serves the new code immediately on cutover.
6. Database migrations are NOT auto-run — they must be applied manually via `pnpm drizzle-kit push` from a developer machine pointed at the production DATABASE_URL. (This is intentional — schema changes are deliberate.)

---

## Project structure

```
SNDcartel-app/
├── app/                      Next.js App Router pages and API routes
│   ├── (auth)/               Pages that require a logged-in user
│   │   ├── home/             Campaign browser
│   │   ├── group-buy/[id]/   Campaign detail + checkout
│   │   ├── store/            Always-available product catalog
│   │   ├── account/          User profile, orders, wallets
│   │   └── admin/            Admin panel (analytics, campaigns, etc.)
│   ├── api/                  Server-side endpoints
│   │   ├── auth/             NextAuth handler
│   │   ├── group-buys/       Public campaign listing & detail
│   │   ├── orders/           Order placement, payment-status polling
│   │   ├── store/            Store product listing
│   │   ├── users/me/         Current user + their wallets
│   │   ├── webhooks/alchemy/ Alchemy payment webhook receiver
│   │   └── admin/            Admin-only endpoints (gated by role check)
│   ├── login/, register/     Public auth pages
│   ├── layout.tsx            Root HTML shell
│   └── globals.css           Global styling, theme variables
├── components/
│   ├── admin/                Admin panel components (campaign editor, etc.)
│   ├── ui/                   Shared primitives (Button, Card, Tabs, …)
│   └── group-buy-image-box.tsx, orders-card.tsx, …
├── db/
│   ├── schema.ts             Drizzle table definitions (the source of truth)
│   ├── index.ts              Database client export
│   └── seed.ts               Idempotent seed for admin user + sample campaign
├── lib/
│   ├── auth.ts               NextAuth configuration
│   ├── alchemy.ts            Alchemy SDK helpers (signature verify, etc.)
│   ├── payment-matcher.ts    Confidence-scoring logic for incoming transfers
│   ├── product-icons.ts      Map peptide names → lucide icons
│   ├── email.ts              Resend wrappers
│   ├── audit.ts              Admin action logging
│   └── types.ts, utils.ts    Shared types and helpers
├── public/                   Static assets (images, video placeholders, fonts)
├── templates/                React-Email templates for Resend
├── auth.config.ts            Edge-safe NextAuth config (used by middleware)
├── middleware.ts             Route protection (redirect unauth to /login)
├── drizzle.config.ts         Migration tool config
└── package.json, tsconfig.json, next.config.ts, postcss.config.mjs
```

---

## Local development setup

### Prerequisites

- **Node.js 20+** (the project uses Next.js 16 which requires modern Node)
- **pnpm** package manager: `npm install -g pnpm`
- A **Neon Postgres** database (free tier is fine) — sign up at https://neon.tech and create a project
- An **Alchemy** API key — sign up at https://alchemy.com (free tier supports several chains)

### 1. Clone and install

```bash
git clone https://github.com/ianmccaskey/SNDcartel-app.git
cd SNDcartel-app
pnpm install
```

### 2. Environment variables

Copy the template:

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon connection string (find it in your Neon dashboard) |
| `NEXTAUTH_SECRET` | Random string. Generate one: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` for dev |
| `ALCHEMY_API_KEY` | From Alchemy dashboard |
| `ALCHEMY_WEBHOOK_SIGNING_KEY` | From Alchemy dashboard, set when you create a webhook |

Optional (only needed if you want emails or image uploads to work locally):

| Variable | What |
|---|---|
| `RESEND_API_KEY` + `EMAIL_FROM` | Transactional emails |
| `R2_*` or DigitalOcean Spaces creds | Image uploads |

### 3. Set up the database

Push the Drizzle schema:

```bash
DOTENV_CONFIG_PATH=.env.local pnpm drizzle-kit push
```

This creates all the tables defined in `db/schema.ts`.

### 4. Seed an admin user (optional but useful)

```bash
DOTENV_CONFIG_PATH=.env.local pnpm tsx db/seed.ts
```

Creates `admin@sndcartel.com` / `admin123` and a sample group buy with products.

### 5. Run the dev server

```bash
pnpm dev
```

Visit http://localhost:3000.

### 6. (Optional) Seed test orders

If you want realistic data in the Fulfillment table to design against:

```bash
DOTENV_CONFIG_PATH=.env.local pnpm tsx db/seed-orders.ts
```

Adds 3 orders tied to the admin user, in a mix of fulfillment statuses. Cleanup SQL is documented in the script header.

---

## Operations & deployment

### Hosting

The production app lives on **DigitalOcean App Platform**, building from a Git branch. Pushing to the configured deploy branch triggers a new build automatically.

### Environment variables in production

Set the same variables you used locally — but with production values — in the App Platform spec:

- DATABASE_URL must point to your **production** Neon branch
- NEXTAUTH_URL must be the live URL (`https://your-domain.com`)
- ALCHEMY_WEBHOOK_SIGNING_KEY must match the webhook configured in Alchemy to point at your production URL

### The Alchemy webhook

In the Alchemy dashboard:

1. Webhooks → **Create webhook**
2. Webhook URL: `https://your-domain.com/api/webhooks/alchemy`
3. Network: pick the chains you want to monitor (Ethereum, Polygon, Solana, etc.)
4. Type: USDC transfer notifications
5. Add the campaign payment wallet addresses you want to watch
6. Copy the signing key into `ALCHEMY_WEBHOOK_SIGNING_KEY` in your prod env

When you add a new campaign with a new payment wallet, you also need to add that wallet to the Alchemy webhook config — otherwise no notifications fire and payments won't auto-verify.

### Database migrations in production

Migrations are not auto-run. After merging a schema change:

```bash
# Local machine, with DATABASE_URL temporarily pointed at prod:
DATABASE_URL='postgresql://...prod...' pnpm drizzle-kit push
```

Drizzle compares the schema in code with the live database and applies the diff. Always inspect the generated SQL first; never blindly accept destructive changes.

### Promoting an admin

After someone registers normally, promote them via SQL:

```sql
UPDATE users SET role = 'admin' WHERE email = 'them@example.com';
```

You can run this against Neon via their SQL editor or via `psql`.

### Logs and observability

DigitalOcean App Platform → Runtime Logs streams the Next.js server output. Errors include stack traces. For deeper investigation, the Postgres logs are in the Neon dashboard.

---

## Commands cheat sheet

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start dev server at http://localhost:3000 |
| `pnpm build` | Production build (run before pushing if you want to catch type errors locally) |
| `pnpm start` | Run a previously-built production server locally |
| `pnpm lint` | Run ESLint |
| `pnpm drizzle-kit push` | Apply schema in `db/schema.ts` to the database |
| `pnpm drizzle-kit generate` | Generate a SQL migration from a schema change |
| `pnpm drizzle-kit migrate` | Apply generated SQL migrations |
| `pnpm tsx db/seed.ts` | Seed admin + sample group buy |
| `pnpm tsx db/seed-orders.ts` | Seed 3 test orders for fulfillment UI |

For any `pnpm tsx` or `pnpm drizzle-kit` command on Windows that errors with `DATABASE_URL not set`, prefix with `DOTENV_CONFIG_PATH=.env.local` so the script picks up your env file.

---

## Glossary

- **Group buy** — a community pooling orders together to hit a vendor's minimum and get bulk pricing.
- **MOQ** (Minimum Order Quantity) — the threshold a campaign needs to hit before the vendor will fulfill it. Often expressed in "kits".
- **Kit** — one unit a member is buying. A campaign might need 985 kits to trigger.
- **Peptide** — the product type this app sells. Specific products have names like Tirzepatide, BPC-157, SS-31.
- **USDC, USDT** — stablecoins (cryptocurrencies pegged to the US dollar). The most common payment method on the platform.
- **Chain / Network** — which blockchain a transaction lives on. The same coin (USDC) exists on multiple chains (Ethereum, Polygon, Solana, Base, etc.) and you must send + receive on the *same* chain.
- **TX hash** — the unique ID of a blockchain transaction. Every payment has one.
- **MetaMask, Phantom** — popular crypto wallets. The platform doesn't care which one you use; it cares about the wallet *address* you're sending from.
- **Webhook** — a server-to-server notification. Alchemy POSTs to our endpoint when a relevant blockchain event happens.
- **RSC / RC** — React Server Components / React Client Components. Next.js App Router lets us mix both — the heavy data-fetching is RSC, the interactive bits are RC.
- **App Platform** — DigitalOcean's managed hosting. Like Heroku for the modern era; we hand it a repo and it builds + deploys on push.
- **Drizzle** — TypeScript ORM. Lets us write database queries with autocompletion and type checks.
- **NextAuth** — authentication library. Owns "is this request from a logged-in user?" logic.
- **Alchemy** — blockchain infrastructure. We use it to listen for incoming USDC transfers without running our own blockchain nodes.
- **Resend** — transactional email service. Used for shipping notifications.

---

## Where to look in the code for "the X feature"

| If you want to understand… | Start here |
|---|---|
| How a user signs up | `app/(auth)/register/page.tsx` + `app/api/auth/register/route.ts` + `lib/auth.ts` |
| The home page UI | `app/(auth)/home/page.tsx` |
| The campaign detail + checkout | `app/(auth)/group-buy/[id]/page.tsx` + `components/checkout-overlay.tsx` |
| Order placement | `app/api/orders/route.ts` |
| How payments auto-verify | `lib/payment-matcher.ts` + `app/api/webhooks/alchemy/route.ts` + `lib/alchemy.ts` |
| The admin panel | `app/(auth)/admin/page.tsx` + every `components/admin/*.tsx` |
| Database schema | `db/schema.ts` |
| Routing / auth gating | `middleware.ts` + `auth.config.ts` |
| Theme & global styles | `app/globals.css` + Tailwind config |

For the full architectural deep-dive, see [`ARCHITECTURE.md`](./ARCHITECTURE.md). For the original product spec see [`SPEC.md`](./SPEC.md). Alchemy-specific details live in [`ALCHEMY_INTEGRATION.md`](./ALCHEMY_INTEGRATION.md).
