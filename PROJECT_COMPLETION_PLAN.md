# SNDcartel — Project Completion Plan

## Context

After ~28 commits of UI iteration on top of the deployed v0-scaffold baseline, we're pausing feature/UI churn to produce a project-completion roadmap. The app needs to go from "demo-able" to "capable of running a real group buy end-to-end" — covering admin setup, customer participation, payment verification, fulfillment, reporting, and completed-buy history. A new third user persona ("Group Buy Operator/Runner") is also being introduced — currently the schema only knows `user` and `admin`.

This document is **analysis and sequencing**. No implementation should happen until a concrete first step is explicitly approved.

---

## 1. Current State Audit

Backed by a deep three-way exploration of the codebase (auth+customer surfaces, admin+operator concerns, and data-model+API). Bottom line up front: **the app is far further along than it feels.** Customer flow, admin flow, schema, and ~38 API routes are real and end-to-end functional. The gaps are concentrated in (a) the missing operator role, (b) payment rejection/resubmission paths, (c) reporting depth, and (d) some build-config hygiene.

### Symbol legend
- ✅ Implemented & working (data flows end-to-end)
- 🟡 Partially implemented (UI or backend partial)
- ⚠️ UI-only / mock data
- ❌ Missing
- 🔧 Broken / needs refactor

### Audit by area

| Area | Status | Notes |
|---|---|---|
| **Auth — register, login, session** | ✅ | NextAuth v5 credentials, bcrypt, JWT session with role; middleware protects everything except `/login`, `/register`, static, webhooks |
| **Account profile setup** | ✅ | `/account` with 4 cards; `profileComplete` auto-computed and gates ordering at API level (`/api/orders` returns 422 if incomplete) |
| **User roles** | 🟡 | Schema is `'user' \| 'admin'` only — **no operator role**. Role exposed in session and gates `/admin` |
| **Admin dashboard** | ✅ | 6 tabs (Analytics / Campaigns / Store / Users / Payments / Fulfillment), all with real data |
| **Group buy creation & setup** | ✅ | `campaign-management.tsx` (1269 lines) drives create/edit, products, MOQ, dates, fees, accepted payments; status FSM (draft→active→closed→fulfilled) wired |
| **Per-product setup** | ✅ | Add/edit/delete products inside a campaign with name/price/MOQ/dimensions/maxPerUser/sortOrder |
| **Customer browsing** | ✅ | `/home` lists active group buys with products as indicator pills, uses `SNDvial.mp4` placeholder |
| **Cart / order flow** | ✅ | Quantities, in-cart edits, multi-product orders, MOQ progress, max-per-user (UI-only — see gap below) |
| **Checkout overlay & payment submission** | ✅ | Pick payment method, wallet auto-fill, submit order, show "Verify Payment" caption + button, polling for status |
| **Crypto wallet handling (admin destination)** | ✅ | Per-campaign `acceptedPayments` rows store token + network + wallet address |
| **Crypto wallet handling (customer source)** | ✅ | `users.wallets` multi-chain (Eth/Sol/Btc/Polygon/Base/Arbitrum/Other); auto-fills checkout |
| **Payment verification (auto)** | ✅ | Alchemy webhook → `lib/payment-matcher.ts` → confidence scoring (≥80 auto-approves) → `payments` row + `alchemyWebhookEvents` audit |
| **Payment verification (manual)** | ✅ | Admin Payments tab; approve/reject endpoints write `reviewedBy/reviewedAt`, log to `adminActions` |
| **Payment rejection visible to customer** | 🟡 | UI styles for `rejected` exist in order overlay but **no code path drives the customer side** of a rejection. Customer sees stuck `pending_payment` |
| **Resubmit payment flow** | ❌ | No customer-side path to update a TX hash / re-link a payment after rejection |
| **Order status tracking** | ✅ | `pending_payment → payment_submitted → payment_verified → processing → shipped → completed` (+ `rejected`/`cancelled`); customer sees order detail overlay |
| **Order status history (audit)** | ❌ | Transitions are not timestamped beyond `updatedAt`. No history table. Compliance / dispute risk |
| **Fulfillment workflow** | ✅ | Admin Fulfillment tab; per-item status (`awaiting_vendor → on_hand → packed → shipped → delivered`); bulk-mark-shipped flow; partial shipments |
| **Shipping / tracking** | ✅ | `shipments` table + `/api/admin/shipments`; carrier, tracking number, ETA, tracking image upload |
| **Customer tracking visibility** | 🟡 | Order detail overlay renders shipments and tracking links, but no carrier scan timeline (no `tracking_events` table) |
| **Email notifications** | 🟡 | `lib/email.ts` + `templates/shipping-notification.tsx` built and wired into admin shipment creation. **Not invoked anywhere else** (no order-confirmation email, no payment-verified email) |
| **Reporting / analytics** | 🟡 | Basic real aggregates (total users / orders / revenue / active GBs / pending payments); no per-product, no fulfillment-status breakdown, no exports, no date filters |
| **Completed group buys view (customer)** | ✅ | Order History card on `/account` |
| **Completed group buys view (admin)** | 🟡 | Campaigns list shows `closed`/`fulfilled` statuses; no dedicated "completion summary" report per buy |
| **Admin/operator permissions** | 🟡 | Binary admin gate (`session.user.role === 'admin'`). `groupBuys.createdBy` is *recorded* but never used. No scoping infrastructure |
| **Database schema** | ✅ (mostly) | 12 tables; complete for v1 lifecycle; missing: operator-assignment table, order-status-history table, payment-rejection-history, carrier-tracking-events |
| **API integration** | ✅ | 38 real routes, no stubs/501s, Zod-validated, audit-logged |
| **Mock data still in production code** | ✅ (clean) | None in `app/`/`components/`/`lib/`. Hardcoded values are config-style: USDC contract addresses (correct), seed file admin credentials (dev-only) |
| **Hardcoded that should be dynamic** | 🟡 | `next.config.ts` has `allowedDevOrigins: ['192.168.18.5']` (a dev machine IP that shouldn't ship); `ignoreBuildErrors: true` masks TS issues |
| **Store catalog (browse)** | ✅ | Conditional "Join Group Buy" link works |
| **Store checkout end-to-end** | 🟡 | Order creates with `storeOrder: true`, but the store overlay doesn't render payment-method selection (uses `NEXT_PUBLIC_STORE_WALLET_ADDRESS` env). Different shape from group-buy checkout |
| **Max-per-user enforcement** | 🟡 | UI-only. `/api/orders` POST does not re-check the constraint server-side — bypassable by direct API call |
| **CI / type-check / tests** | ❌ | No test files, no GitHub Actions, build-time TypeScript errors silently ignored |

---

## 2. Workflow Mapping

The intended workflows for the three personas. ✅ marks steps the app already supports; 🟡 marks supported-but-incomplete; ❌ marks not yet built.

### 2.1 Admin workflow
1. ✅ Login at `/login`
2. ✅ Land on `/admin` dashboard with 6-tab overview
3. 🟡 Create / manage users (list works; role/status edits exist via `PATCH /api/admin/users/[id]` per route inventory but no clear "promote to operator" UI yet)
4. ❌ Assign roles **including operator**
5. ❌ Assign operators to specific group buys
6. ✅ Create a group buy (`POST /api/admin/group-buys`)
7. ✅ Add products to a group buy (`POST /api/admin/group-buys/[id]/products`)
8. ✅ Configure pricing, MOQ, max-per-user, dates, descriptions, images, fees, accepted payment options
9. ✅ Monitor orders for any campaign
10. ✅ Verify payments — both auto-matched and manual
11. ✅ Move order statuses (`/api/admin/orders/[orderId]` PATCH)
12. ✅ Manage fulfillment — packed, shipped, delivered, partial
13. ✅ Add tracking info
14. 🟡 View reports (basic aggregates exist; deeper reporting missing)
15. ✅ Close / complete a group buy (status FSM)
16. 🟡 Review completed buy history (campaigns list shows past statuses, but no per-buy completion summary)

### 2.2 Group Buy Runner / Operator workflow
1. ❌ Login (works mechanically, but operator role does not exist yet)
2. ❌ Dashboard scoped to their own group buys
3. ❌ Create / manage their own group buys
4. ❌ Add / edit products inside their own group buys
5. ❌ View orders only for their group buys
6. ❌ Verify / manage payments only for their group buys
7. ❌ Manage fulfillment only for their group buys
8. ❌ View reports only for their group buys
9. ❌ Close / complete their own group buys
10. ❌ Cannot see unrelated platform-wide data

**The entire operator persona is not yet implemented.** Schema records `groupBuys.createdBy` but it's not wired to anything.

### 2.3 Customer workflow
1. ✅ Register at `/register`
2. ✅ Complete account profile (name, Discord, shipping address; `profileComplete` boolean enforced server-side)
3. ✅ Add crypto wallet(s) to profile — multi-chain
4. ✅ View active group buys on `/home`
5. ✅ Open a campaign at `/group-buy/[id]`
6. ✅ Review product options including images (placeholder), pricing, MOQ progress, max-per-user
7. ✅ Select products and quantities, add to cart
8. ✅ Submit order (`POST /api/orders`)
9. ✅ Receive payment instructions (destination wallet, exact amount)
10. ✅ Submit transaction (sends crypto from saved wallet, taps Verify Payment)
11. ✅ See payment pending → polling → verified status
12. 🟡 See payment rejected (UI ready, no driving code path)
13. ❌ Resubmit a rejected payment with a new TX hash
14. ✅ See order processing / shipped / completed status
15. ✅ See tracking info (carrier + tracking #) once shipment is created
16. 🟡 Receive shipping email (built, but currently only fires from admin shipment-create — not from customer's order page state changes)
17. ✅ View completed order history on `/account`

---

## 3. Gap Analysis

| # | Feature / workflow area | Current status | What exists | What's missing | Dependencies | Risk / complexity | Priority |
|---|---|---|---|---|---|---|---|
| 1 | Operator role + scoped access | ❌ | `role: user/admin`, `createdBy` on group buys | New role, ownership table, scoped API filters, scoped admin UI | Schema migration + auth touch + API rewrite for ~10 routes | **High** (touches every admin route) | **P0** |
| 2 | Payment rejection → customer notified → resubmission | 🟡 | Admin can reject; UI styles for `rejected` exist | Reject must transition order to `payment_rejected` visible to customer; resubmit endpoint; resubmit UI in checkout overlay | Schema (add `payment_rejection_history` optional); customer order overlay | Medium | **P0** |
| 3 | Server-side max-per-user enforcement | 🟡 | UI clamps; no server check | Add validation in `/api/orders` POST | None | Low | **P0** (security) |
| 4 | Order status history / audit timeline | ❌ | `adminActions` covers admin moves; order's own transitions not timestamped | New `order_status_history` table populated by all status mutations | Schema migration; touch every status-change handler | Medium | P1 |
| 5 | Reporting depth | 🟡 | Basic overview aggregates | Per-product totals, fulfillment status breakdown, payment completion rate, CSV export, date filters | Aggregation queries, new admin endpoints, client UI | Medium | P1 |
| 6 | Per-buy completion summary | 🟡 | Status FSM exists | "Close & finalize" report with totals, per-product, per-payment, per-fulfillment | Builds on #5 | Low–Medium | P1 |
| 7 | Email notifications fired from order state | 🟡 | Resend wired for shipping; templates exist | Order-confirmation email; payment-verified email; payment-rejected email; partial-shipment email | Trigger plumbing in API handlers | Low | P1 |
| 8 | Carrier tracking timeline | ❌ | Single shipment row | Optional `tracking_events` table populated by carrier APIs (USPS/UPS/FedEx) or manual scan entries | Schema; integrations (defer) | High (integrations) | P2 (post-MVP) |
| 9 | Customer order cancellation | ❌ | No path | "Cancel order" UI + endpoint while in `pending_payment` | None | Low | P2 |
| 10 | Manual payment-stuck timeout / unblock | ❌ | Polling stops at 5 min silently | Show "still searching for your payment, try refreshing or contact support" with option to manually link a TX | Touch checkout overlay | Low | P2 |
| 11 | Store checkout payment-method UI | 🟡 | Hardcoded env wallet, no select | Mirror group-buy checkout's payment-method picker (or formally drop store as a v1 feature) | Same shape as GB checkout | Low–Medium | P2 |
| 12 | next.config hygiene | 🟡 | `ignoreBuildErrors: true`, hardcoded dev IP | Remove both, fix surfaced TS errors | Many small TS fixes likely | Medium | P0 (foundation) |
| 13 | Tests + CI | ❌ | None | At minimum: smoke tests on order placement, payment matcher, role check | Vitest + Playwright setup | Medium | P2 |
| 14 | npm scripts for db ops | 🟡 | drizzle-kit configured but no `db:push`/`db:seed` scripts | Add to `package.json` | None | Trivial | P0 |
| 15 | Ship-confirmation email triggered for customer | 🟡 | Wired admin-side only | Same `sendShippingNotification` call from any path that creates a shipment | Audit insertion sites | Low | P1 |

---

## 4. Completion Roadmap

### Phase 0 — Stabilize and audit (1–2 days)
**Goal:** clean foundation before adding anything new.

- [ ] Remove `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` from [`next.config.ts`](E:/workspace/SNDcartel-app/next.config.ts); fix every TypeScript error that surfaces (most likely `drizzle-orm` typing in admin route handlers — visible from earlier `tsc` runs)
- [ ] Remove hardcoded `allowedDevOrigins: ['192.168.18.5']` from `next.config.ts`
- [ ] Add npm scripts to `package.json`: `db:push`, `db:generate`, `db:migrate`, `db:seed`
- [ ] Document the deploy branch convention (currently `v0/appleporgy-3573-0ca5d4ff`); decide whether to rename to `main` or formal `production`
- [ ] Add `.env.example` parity check vs production env vars
- [ ] Decide: should `db/seed-orders.ts` and the test orders it created (still in production Neon DB) be removed? Or kept as dev fixtures? Document the answer

### Phase 1 — Schema & data-model deltas (1–2 days)
**Goal:** introduce only the tables and columns we actually need; ship migrations.

Critical files: [`db/schema.ts`](E:/workspace/SNDcartel-app/db/schema.ts), `drizzle.config.ts`.

- [ ] Add `'operator'` to `users.role` enum (or keep as `text` and add allow-list)
- [ ] Add `groupBuyOperators` junction table: `(id, groupBuyId, operatorId, createdAt, createdBy)` with unique `(groupBuyId, operatorId)`. Choosing junction over array column for indexability and audit clarity
- [ ] Add `orderStatusHistory` table: `(id, orderId, fromStatus, toStatus, changedBy, reason, createdAt)`. Populate from every status-mutation handler
- [ ] Optional: `paymentResubmissions` table or just additional rows in existing `payments` table — decide based on resubmission UX (see Phase 5)
- [ ] Push migration to dev Neon, then to prod Neon manually (`drizzle-kit push`)

### Phase 2 — Auth & role-based access (2–3 days)
**Goal:** make the operator role real, retrofit existing admin routes to allow operator access only for owned group buys.

- [ ] Update [`auth.config.ts`](E:/workspace/SNDcartel-app/auth.config.ts) so `session.user.role` returns `'user' | 'admin' | 'operator'`
- [ ] Update [`middleware.ts`](E:/workspace/SNDcartel-app/middleware.ts): `/admin/*` allowed for `admin` AND `operator` (existing all-or-nothing gate splits)
- [ ] Build a new `lib/permissions.ts` with helpers:
  - `requireAdmin(session)`
  - `requireAdminOrOperator(session)`
  - `canManageGroupBuy(session, groupBuyId)` — admin always true; operator true iff row in `groupBuyOperators`
  - `listManageableGroupBuyIds(session)` — admin: all; operator: filtered list
- [ ] Retrofit each admin endpoint:

| Endpoint pattern | Admin | Operator (own only) |
|---|---|---|
| `/api/admin/group-buys` GET | all | only theirs |
| `/api/admin/group-buys/[id]` GET / PATCH | yes | yes if owned |
| `/api/admin/group-buys/[id]/status` PATCH | yes | yes if owned |
| `/api/admin/group-buys/[id]/products/*` | yes | yes if owned |
| `/api/admin/orders` (with `groupBuyId` filter) | all | only theirs |
| `/api/admin/orders/[orderId]` GET / PATCH | yes | yes if order's groupBuy is owned |
| `/api/admin/payments` GET | all | only theirs |
| `/api/admin/payments/[id]/(approve\|reject)` PATCH | yes | yes if payment's order's groupBuy is owned |
| `/api/admin/shipments` POST / PATCH | yes | yes if order's groupBuy is owned |
| `/api/admin/users*` | yes | **no** (admin-only) |
| `/api/admin/store/*` | yes | **no** (admin-only) |
| `/api/admin/analytics/*` | yes (all) | yes (filtered to owned campaigns) |
- [ ] Add an admin-only "Operators" management screen — list users, promote/demote, assign to specific group buys (`POST /api/admin/group-buys/[id]/operators`)

### Phase 3 — Admin / operator group-buy setup polish (1–2 days)
**Goal:** make sure the operator's "scoped admin" experience is clean. Most building blocks already exist; this is mostly UI gating + one new screen.

- [ ] Hide tabs operator shouldn't see (`Users`, `Store` — admin-only). Conditional render in [`app/(auth)/admin/page.tsx`](E:/workspace/SNDcartel-app/app/(auth)/admin/page.tsx)
- [ ] Filter campaign list in [`components/admin/campaign-management.tsx`](E:/workspace/SNDcartel-app/components/admin/campaign-management.tsx) to ownable-only when role is `operator`
- [ ] Add "+ Operator" assignment UI in campaign editor (admin only)

### Phase 4 — Customer participation polish (0.5–1 day)
**Goal:** server-side enforcement + email coverage. Customer flow is already real.

- [ ] Add server-side `maxPerUser` check in [`app/api/orders/route.ts`](E:/workspace/SNDcartel-app/app/api/orders/route.ts) POST (security gap #3)
- [ ] Add order-confirmation email at order create (reuse [`lib/email.ts`](E:/workspace/SNDcartel-app/lib/email.ts), add `templates/order-confirmation.tsx`)
- [ ] Add payment-verified email when status transitions to `payment_verified` (both auto via Alchemy and manual via admin approve)

### Phase 5 — Payment verification: full rejection / resubmission cycle (2–3 days)
**Goal:** close the rejection hole.

- [ ] Update admin reject endpoint to transition order to `payment_rejected` (currently it stops at the payments row only)
- [ ] Add `rejected` to `paymentStatus` allowed states explicitly; surface in customer's order detail overlay
- [ ] Add payment-rejected email
- [ ] In customer order detail overlay: when status is `payment_rejected`, show "Resubmit payment" button → reopens the checkout overlay seeded with the same cart and a clear message
- [ ] New endpoint: `POST /api/orders/[orderId]/resubmit-payment` that creates a *new* `payments` row tied to the existing order, kicks off polling again
- [ ] Insert `orderStatusHistory` row at every transition

### Phase 6 — Fulfillment polish (0.5–1 day)
**Goal:** mostly done; just close gaps.

- [ ] Insert `orderStatusHistory` row from shipment create / item-status update handlers
- [ ] Confirm `sendShippingNotification` fires correctly for both single-order and bulk fulfillment paths
- [ ] Add minimal carrier-status-fetched timestamp (manually updated by admin) — defer real carrier API integration

### Phase 7 — Reporting & completion (2–3 days)
**Goal:** admin / operator can prove a campaign succeeded.

- [ ] New admin endpoint: `GET /api/admin/group-buys/[id]/report` — returns per-product unit totals, payment status breakdown (verified / rejected / pending count and $), fulfillment status breakdown, profit/buffer if `metadata.fees` present
- [ ] New `Reports` tab or per-campaign "Completion Report" modal showing the above with charts
- [ ] CSV export of a campaign's orders + payments
- [ ] When campaign is `closed` or `fulfilled`, surface this report by default
- [ ] Operator-scoped reporting (uses `listManageableGroupBuyIds`)

### Phase 8 — UI polish and QA (2–3 days)
**Goal:** one pass through every screen with realistic data, real role testing, and a clean responsive sweep.

- [ ] Empty states and loading skeletons for every list-based screen
- [ ] Error toasts for every mutation
- [ ] Permission tests — log in as each role, confirm boundaries
- [ ] Mobile viewport sweep (we've been at 500px; need 360–414 coverage)
- [ ] End-to-end happy path: admin creates GB → assigns operator → operator adds product → customer places order → Alchemy auto-verifies → operator marks shipped → customer sees tracking → operator closes campaign → admin reads report
- [ ] Production readiness checklist (env vars, migrations applied, Alchemy webhook pointed at prod, Resend domain verified)

---

## 5. Recommended Build Order

The order below is optimized to make the app **functional** as quickly as possible, then **scoped**, then **polished**:

1. **Phase 0** — foundation cleanup. Without this, every later change is risky.
2. **Phase 1** — schema deltas. Locks in the shape; everything depends on it.
3. **Phase 2** — auth & roles. Unlocks the operator persona, which is the biggest currently-missing capability.
4. **Phase 4** — customer-side server-side enforcement + email. Quick wins, security-relevant.
5. **Phase 5** — payment rejection / resubmission. Closes the most user-visible gap in the customer flow.
6. **Phase 3** — admin / operator UI polish. Makes the operator's daily experience real.
7. **Phase 6** — fulfillment polish. Mostly already done; tidying.
8. **Phase 7** — reporting. The "I can prove this campaign worked" capability.
9. **Phase 8** — UI polish + end-to-end QA.

Total estimated wall-clock time at one focused engineer: **10–17 working days**.

---

## 6. Screen / Page Inventory

### Public / unauthenticated
| Screen | Status | Action |
|---|---|---|
| `/` (landing) | ✅ | Keep |
| `/login` | ✅ | Keep |
| `/register` | ✅ | Keep |

### Authenticated — Customer
| Screen | Status | Action |
|---|---|---|
| `/home` | ✅ | Keep, no changes |
| `/group-buy/[id]` | ✅ | Add resubmit-payment affordance (Phase 5) |
| `/account` | ✅ | Keep; ensure rejected payments are visible in Order History (Phase 5) |
| `/store` | 🟡 | Decide v1 scope: drop or finish payment-method picker (Phase 2-deferred) |

### Authenticated — Admin / Operator
| Screen | Status | Action |
|---|---|---|
| `/admin` (Analytics tab) | 🟡 | Real data, expand with completion reports (Phase 7) |
| `/admin` (Campaigns tab) | ✅ | Add operator-assignment UI (Phase 2/3) |
| `/admin` (Store tab) | ✅ | Hide for operators (Phase 3) |
| `/admin` (Users tab) | ✅ | Add "promote to operator" + "assign to group buy" (Phase 2) |
| `/admin` (Payments tab) | ✅ | Filter by operator-owned; add "rejected" sub-state visibility (Phase 2/5) |
| `/admin` (Fulfillment tab) | ✅ | Filter by operator-owned (Phase 2) |
| **NEW** `/admin/operators` or in-tab UI | ❌ | New admin screen for promoting users to operator and assigning campaigns (Phase 2) |
| **NEW** Per-campaign Completion Report | ❌ | Modal or sub-page reachable from a closed campaign (Phase 7) |

### Removable
- The orphaned `public/peptide-vial-with-snd-never-die-group-buy-label.jpg` and the now-unreferenced `public/40a7640a0_SND_GB2.gif` placeholder GIF can be deleted in Phase 0 cleanup.

---

## 7. Permission Matrix

✅ allowed · ❌ denied · 🟡 allowed for owned resources only

| Capability | Customer | Operator | Admin |
|---|---|---|---|
| View active group buys | ✅ | ✅ | ✅ |
| Place an order | ✅ | ✅ | ✅ |
| View own order history | ✅ | ✅ | ✅ |
| Create a group buy | ❌ | ✅ | ✅ |
| Edit a group buy | ❌ | 🟡 own | ✅ |
| Add / edit products in a group buy | ❌ | 🟡 own | ✅ |
| View orders | ❌ (only own) | 🟡 in own GBs | ✅ |
| Approve / reject payments | ❌ | 🟡 in own GBs | ✅ |
| Manage fulfillment / tracking | ❌ | 🟡 in own GBs | ✅ |
| View reports | ❌ | 🟡 own GBs | ✅ |
| Manage users (promote, suspend) | ❌ | ❌ | ✅ |
| Assign operators to group buys | ❌ | ❌ | ✅ |
| Manage standalone store products | ❌ | ❌ | ✅ |
| Global settings (env / wallets) | ❌ | ❌ | ✅ |
| View completed group buys | 🟡 if participated | 🟡 own | ✅ |
| Resubmit a rejected payment | ✅ own | ❌ | ❌ |

---

## 8. Definition of Done

The app is complete enough to run a real group buy when **every box** below is checked:

### Foundation
- [ ] `next.config.ts` does not ignore TypeScript or ESLint errors
- [ ] All migrations applied to production Neon DB
- [ ] Alchemy webhook points at production URL with correct signing key
- [ ] All env vars documented in `.env.example` and present in production

### Admin
- [ ] Admin can create and publish a group buy
- [ ] Admin can add products with full configuration (price, MOQ, max-per-user, image, dimensions)
- [ ] Admin can configure accepted payment options (token + chain + wallet)
- [ ] Admin can promote a user to operator
- [ ] Admin can assign one or more operators to a group buy
- [ ] Admin can view and manage *every* group buy
- [ ] Admin can manage users globally
- [ ] Admin can manage the standalone store

### Operator
- [ ] Operator sees only their assigned group buys in the campaigns list
- [ ] Operator can edit campaign details for owned campaigns
- [ ] Operator can add / edit products in owned campaigns
- [ ] Operator can verify or reject payments only for orders in their owned campaigns
- [ ] Operator can manage fulfillment / tracking only for orders in their owned campaigns
- [ ] Operator can see analytics filtered to their campaigns
- [ ] Operator cannot access user management, store management, or other operators' campaigns
- [ ] Operator can close / complete their own group buys

### Customer
- [ ] Customer can register and complete profile
- [ ] Customer cannot place orders before profile is complete (server-enforced)
- [ ] Customer can place an order; server enforces max-per-user
- [ ] Customer can submit payment and see verification progress
- [ ] Customer can see if payment is rejected and resubmit with a new TX
- [ ] Customer receives an email at order confirmation, payment verified, and shipped
- [ ] Customer can see fulfillment / shipping / tracking status throughout
- [ ] Customer can view completed order history with item details

### System / data integrity
- [ ] Order status history table populated for every transition
- [ ] All status changes trigger appropriate emails
- [ ] Admin actions logged to `adminActions` (already true)
- [ ] Reports show accurate totals (per-product, per-payment, per-fulfillment)
- [ ] Group buy can be closed/completed and produce a completion report
- [ ] Role permissions verified end-to-end: a curl with operator session against admin-only endpoint returns 403
- [ ] No critical mock data remains in production code
- [ ] Mobile (375 / 412) and desktop workflows usable end-to-end

---

## Recommended exact first implementation step

**Phase 0, Item 1 — Remove `typescript.ignoreBuildErrors: true` from [`next.config.ts`](E:/workspace/SNDcartel-app/next.config.ts) and fix every TypeScript error that surfaces.**

Why this is the single right first step:
- It's a foundation move; every subsequent code change is more reliable when the type-checker is actually enforcing.
- It will surface the ~150 pre-existing TS errors logged earlier (mostly `drizzle-orm` typing across admin handlers and a few NextAuth callback shape issues). These are real signal for code that's silently miscompiling.
- It's contained to a known set of files. We can timebox it to a half-day; if any error is a refactor rather than a typing fix, isolate it and continue.
- Once it's clean, every other phase becomes much faster — schema typing flows correctly, refactors fail at compile time instead of runtime, the operator-role retrofit can be safely done across many files.
- Zero risk to behavior — pure type plumbing, no functional change.

Concrete steps for that single item:
1. Edit [`next.config.ts`](E:/workspace/SNDcartel-app/next.config.ts) to remove `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`. Also remove `allowedDevOrigins: ['192.168.18.5']` while in there.
2. Run `pnpm tsc --noEmit` and capture the error list.
3. Fix in batches grouped by file. Most fixes will be Drizzle `.where()` typing — likely needs explicit `eq` import discipline or generic type widening.
4. Verify `pnpm build` passes locally.
5. Commit and push to dev branch — but **do not yet promote to deploy** until we've also added `db:push`/`db:seed` npm scripts (the rest of Phase 0).

If approved, I'll start implementation right after we exit plan mode.
