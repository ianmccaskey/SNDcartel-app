-- Phase 1 — Schema deltas for the operator persona + order status history.
--
-- This migration is ADDITIVE ONLY. It does not alter, drop, or backfill any
-- existing column or row. It introduces two new tables that the Phase 2 auth
-- retrofit and the Phase 5 payment-rejection cycle will populate.
--
-- All statements use IF NOT EXISTS so the script is idempotent — re-running it
-- against a database where it has already been applied is a safe no-op.
--
-- Apply with:
--   psql "$DATABASE_URL" -f drizzle/0001_phase1_operator_role_and_history.sql
-- Or via Neon SQL Editor (paste the file contents).

BEGIN;

-- ─── group_buy_operators ────────────────────────────────────────────────────
-- Junction table mapping operator users to the group buys they may manage.
-- Admins implicitly manage every group buy and do NOT need rows here.

CREATE TABLE IF NOT EXISTS "group_buy_operators" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_buy_id"  uuid NOT NULL,
  "operator_id"   uuid NOT NULL,
  "created_by"    uuid,
  "created_at"    timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'group_buy_operators_group_buy_id_group_buys_id_fk') THEN
    ALTER TABLE "group_buy_operators"
      ADD CONSTRAINT "group_buy_operators_group_buy_id_group_buys_id_fk"
      FOREIGN KEY ("group_buy_id") REFERENCES "public"."group_buys"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'group_buy_operators_operator_id_users_id_fk') THEN
    ALTER TABLE "group_buy_operators"
      ADD CONSTRAINT "group_buy_operators_operator_id_users_id_fk"
      FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'group_buy_operators_created_by_users_id_fk') THEN
    ALTER TABLE "group_buy_operators"
      ADD CONSTRAINT "group_buy_operators_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_group_buy_operators_unique"
  ON "group_buy_operators" ("group_buy_id", "operator_id");

CREATE INDEX IF NOT EXISTS "idx_group_buy_operators_operator"
  ON "group_buy_operators" ("operator_id");

-- ─── order_status_history ───────────────────────────────────────────────────
-- Append-only audit trail of every orderStatus transition.
-- A row is inserted from every handler that mutates orders.order_status.
-- changed_by is NULL for system-driven transitions (e.g. Alchemy webhook).

CREATE TABLE IF NOT EXISTS "order_status_history" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id"     uuid NOT NULL,
  "from_status"  text,
  "to_status"    text NOT NULL,
  "changed_by"   uuid,
  "reason"       text,
  "created_at"   timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'order_status_history_order_id_orders_id_fk') THEN
    ALTER TABLE "order_status_history"
      ADD CONSTRAINT "order_status_history_order_id_orders_id_fk"
      FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'order_status_history_changed_by_users_id_fk') THEN
    ALTER TABLE "order_status_history"
      ADD CONSTRAINT "order_status_history_changed_by_users_id_fk"
      FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_order_status_history_order"
  ON "order_status_history" ("order_id");

CREATE INDEX IF NOT EXISTS "idx_order_status_history_created"
  ON "order_status_history" ("created_at");

-- ─── users.role ─────────────────────────────────────────────────────────────
-- 'operator' is a new allowed value alongside 'user' and 'admin'.
-- The column is plain text (no enum), so no DDL is needed — the application
-- layer (Phase 2 lib/permissions.ts) will enforce the allow-list at the
-- API boundary.

COMMIT;
