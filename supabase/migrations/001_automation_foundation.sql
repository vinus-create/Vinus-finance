-- ============================================================================
-- VINUS FINANCE — Migration 001: Automation Foundation (极致自动化基建)
-- Run this ENTIRE file in the Supabase SQL Editor. Safe to run multiple times
-- (fully idempotent). Verified against live DB introspection on 2026-06-12.
--
-- Adds:
--   1. Schema drift reconciliation (columns code already relies on)
--   2. Canonical definitions for previously ad-hoc tables
--   3. Import batches + transaction fingerprint (deduplication)
--   4. Dual-ledger business profile
--   5. Loan amortization persistence (principal vs interest)
--   6. Account auto-discovery support
--   7. Canonical balance trigger that handles transfers (single-row model)
-- ============================================================================


-- ─── 1. ENUM DRIFT (no-ops on live DB, needed for fresh installs) ───────────
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'furniture';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'household';


-- ─── 2. TRANSACTIONS — columns code already inserts + dedup support ─────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS ledger                TEXT        NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS to_account_name       TEXT,
  ADD COLUMN IF NOT EXISTS import_batch_id       UUID,
  ADD COLUMN IF NOT EXISTS is_duplicate_override BOOLEAN     NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  ALTER TABLE public.transactions
    ADD CONSTRAINT chk_ledger CHECK (ledger IN ('personal', 'business'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─── 3. PROFILES — columns code already uses (no-ops on live DB) ─────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number   TEXT,
  ADD COLUMN IF NOT EXISTS telegram_id    BIGINT,
  ADD COLUMN IF NOT EXISTS date_of_birth  DATE,
  ADD COLUMN IF NOT EXISTS gender         TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS state          TEXT,
  ADD COLUMN IF NOT EXISTS occupation     TEXT,
  ADD COLUMN IF NOT EXISTS monthly_income NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS children_count INTEGER NOT NULL DEFAULT 0;


-- ─── 4. CANONICAL TABLES (previously created ad-hoc, now in source control) ──

CREATE TABLE IF NOT EXISTS public.accounts (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
  account_type         TEXT        NOT NULL DEFAULT 'bank'
    CHECK (account_type IN ('bank', 'ewallet', 'investment', 'cash', 'credit_card', 'other')),
  institution          TEXT,
  account_number       TEXT,
  balance              NUMERIC     NOT NULL DEFAULT 0,
  currency             TEXT        NOT NULL DEFAULT 'MYR',
  color                TEXT,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  include_in_net_worth BOOLEAN     NOT NULL DEFAULT TRUE,
  due_day              INTEGER,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounts: owner full access" ON public.accounts;
CREATE POLICY "accounts: owner full access" ON public.accounts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Account auto-discovery support (NEW columns)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS auto_created        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_statement_date DATE;

CREATE TABLE IF NOT EXISTS public.stock_holdings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker         TEXT        NOT NULL,
  company_name   TEXT,
  exchange       TEXT,
  asset_type     TEXT        DEFAULT 'stock'
    CHECK (asset_type IN ('stock', 'etf', 'gold', 'crypto', 'mutual_fund', 'other')),
  shares         NUMERIC     NOT NULL DEFAULT 0,
  avg_cost_price NUMERIC     NOT NULL DEFAULT 0,
  currency       TEXT        NOT NULL DEFAULT 'USD',
  notes          TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock_holdings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_holdings: owner full access" ON public.stock_holdings;
CREATE POLICY "stock_holdings: owner full access" ON public.stock_holdings
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.stock_trades (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker          TEXT        NOT NULL,
  company_name    TEXT,
  trade_type      TEXT        NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  shares          NUMERIC     NOT NULL,
  price_per_share NUMERIC     NOT NULL,
  total_amount    NUMERIC     NOT NULL,
  fees            NUMERIC     NOT NULL DEFAULT 0,
  trade_date      DATE        NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_trades: owner full access" ON public.stock_trades;
CREATE POLICY "stock_trades: owner full access" ON public.stock_trades
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.stock_watchlist (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker       TEXT        NOT NULL,
  company_name TEXT,
  exchange     TEXT,
  target_price NUMERIC,
  notes        TEXT,
  added_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock_watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_watchlist: owner full access" ON public.stock_watchlist;
CREATE POLICY "stock_watchlist: owner full access" ON public.stock_watchlist
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.savings_goals (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  emoji          TEXT        NOT NULL DEFAULT '🎯',
  target_amount  NUMERIC     NOT NULL,
  current_amount NUMERIC     NOT NULL DEFAULT 0,
  target_date    DATE,
  color          TEXT        NOT NULL DEFAULT '#10b981',
  is_completed   BOOLEAN     NOT NULL DEFAULT FALSE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "savings_goals: owner full access" ON public.savings_goals;
CREATE POLICY "savings_goals: owner full access" ON public.savings_goals
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.receivables (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debtor_name TEXT        NOT NULL,
  amount      NUMERIC     NOT NULL,
  description TEXT,
  due_date    DATE,
  is_paid     BOOLEAN     NOT NULL DEFAULT FALSE,
  paid_date   DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receivables: owner full access" ON public.receivables;
CREATE POLICY "receivables: owner full access" ON public.receivables
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_assets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  asset_type      TEXT        NOT NULL DEFAULT 'other'
    CHECK (asset_type IN ('property', 'vehicle', 'valuables', 'business', 'other')),
  estimated_value NUMERIC     NOT NULL DEFAULT 0,
  purchase_price  NUMERIC,
  purchase_date   DATE,
  description     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_assets: owner full access" ON public.user_assets;
CREATE POLICY "user_assets: owner full access" ON public.user_assets
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.monthly_bills (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  amount              NUMERIC     NOT NULL DEFAULT 0,
  due_day             INTEGER     NOT NULL DEFAULT 1,
  expense_category    TEXT,
  emoji               TEXT        DEFAULT '💡',
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  auto_remind         BOOLEAN     NOT NULL DEFAULT FALSE,
  auto_budget         BOOLEAN     NOT NULL DEFAULT FALSE,
  auto_deduct_account TEXT,
  frequency_months    INTEGER     NOT NULL DEFAULT 1,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.monthly_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monthly_bills: owner full access" ON public.monthly_bills;
CREATE POLICY "monthly_bills: owner full access" ON public.monthly_bills
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tax_payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_year INTEGER     NOT NULL,
  payment_type    TEXT,
  installment     INTEGER     NOT NULL DEFAULT 1,
  amount          NUMERIC     NOT NULL DEFAULT 0,
  payment_date    DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tax_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax_payments: owner full access" ON public.tax_payments;
CREATE POLICY "tax_payments: owner full access" ON public.tax_payments
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─── 5. IMPORT BATCHES (statement-level dedup + audit trail) ─────────────────

CREATE TABLE IF NOT EXISTS public.import_batches (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type            TEXT        NOT NULL
    CHECK (source_type IN ('pdf', 'image', 'investment', 'text', 'voice')),
  file_name              TEXT,
  file_hash              TEXT,        -- sha256 hex of raw file bytes
  statement_period_start DATE,
  statement_period_end   DATE,
  account_id             UUID        REFERENCES public.accounts(id) ON DELETE SET NULL,
  status                 TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'rejected_duplicate')),
  total_rows             INTEGER     NOT NULL DEFAULT 0,
  inserted_rows          INTEGER     NOT NULL DEFAULT 0,
  duplicate_rows         INTEGER     NOT NULL DEFAULT 0,
  overridden_rows        INTEGER     NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Same file (by content hash) can only complete once per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_import_batches_file
  ON public.import_batches(user_id, file_hash)
  WHERE file_hash IS NOT NULL AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_import_batches_user
  ON public.import_batches(user_id, created_at DESC);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "import_batches: owner full access" ON public.import_batches;
CREATE POLICY "import_batches: owner full access" ON public.import_batches
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Link transactions to their import batch
DO $$ BEGIN
  ALTER TABLE public.transactions
    ADD CONSTRAINT fk_transactions_import_batch
    FOREIGN KEY (import_batch_id) REFERENCES public.import_batches(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_import_batch
  ON public.transactions(import_batch_id) WHERE import_batch_id IS NOT NULL;


-- ─── 6. TRANSACTION FINGERPRINT (row-level dedup) ────────────────────────────
-- IMPORTANT: this recipe has a TypeScript twin in lib/utils/dedup.ts
-- (computeDedupHash). Any change here MUST be mirrored there byte-for-byte.
-- Recipe: md5( user_id | lower(account) | YYYY-MM-DD | type | amount(2dp) |
--              ref-number OR whitespace-normalized lowercase description )

CREATE OR REPLACE FUNCTION public.fn_txn_dedup_hash(
  p_user    UUID,
  p_account TEXT,
  p_date    DATE,
  p_type    TEXT,
  p_amount  NUMERIC,
  p_ref     TEXT,
  p_desc    TEXT
) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT md5(
    p_user::text || '|' ||
    lower(coalesce(p_account, '')) || '|' ||
    to_char(p_date, 'YYYY-MM-DD') || '|' ||
    p_type || '|' ||
    to_char(p_amount, 'FM999999999990.00') || '|' ||
    coalesce(
      nullif(trim(p_ref), ''),
      lower(regexp_replace(coalesce(p_desc, ''), '\s+', ' ', 'g'))
    )
  )
$$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS dedup_hash TEXT
  GENERATED ALWAYS AS (
    public.fn_txn_dedup_hash(
      user_id, account_name, transaction_date,
      type::text, amount, reference_number, description
    )
  ) STORED;

-- Deliberately NOT unique: legitimate identical same-day transactions exist
-- (two identical kopitiam orders). Enforcement is API-level with override.
CREATE INDEX IF NOT EXISTS idx_transactions_dedup
  ON public.transactions(user_id, dedup_hash);


-- ─── 7. DUAL LEDGER — business profile ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.business_profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT        NOT NULL,
  ssm_number    TEXT,
  business_type TEXT,        -- e.g. 'ecommerce', 'fnb', 'retail', 'services', 'freelance'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_profiles: owner full access" ON public.business_profiles;
CREATE POLICY "business_profiles: owner full access" ON public.business_profiles
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_ledger
  ON public.transactions(user_id, ledger) WHERE ledger = 'business';


-- ─── 8. LOAN AMORTIZATION — principal vs interest per payment ────────────────

CREATE TABLE IF NOT EXISTS public.loan_payments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  loan_id             UUID        NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  transaction_id      UUID        UNIQUE REFERENCES public.transactions(id) ON DELETE SET NULL,
  payment_date        DATE        NOT NULL,
  amount              NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  principal_component NUMERIC(15, 2) NOT NULL DEFAULT 0,
  interest_component  NUMERIC(15, 2) NOT NULL DEFAULT 0,
  balance_after       NUMERIC(15, 2) NOT NULL DEFAULT 0,
  is_extra_payment    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_payments_loan
  ON public.loan_payments(user_id, loan_id, payment_date DESC);

ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loan_payments: owner full access" ON public.loan_payments;
CREATE POLICY "loan_payments: owner full access" ON public.loan_payments
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─── 9. CANONICAL BALANCE TRIGGER (now transfer-aware) ───────────────────────
-- Replaces ALL previous ad-hoc balance triggers on transactions. After this
-- migration, application code must NOT manually adjust account balances for
-- income/expense/transfer rows — the trigger is the single source of truth.
--   income   → account_name balance += amount
--   expense  → account_name balance -= amount
--   transfer → account_name (from) -= amount, to_account_name (to) += amount

-- Drop every old balance-related trigger on transactions (name unknown across
-- ad-hoc installs), but keep unrelated triggers like set_transactions_updated_at.
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN
    SELECT tg.tgname
    FROM pg_trigger tg
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE tg.tgrelid = 'public.transactions'::regclass
      AND NOT tg.tgisinternal
      AND (tg.tgname ~* 'balance|account' OR p.proname ~* 'balance|account')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.transactions', t.tgname);
  END LOOP;
END $$;

-- sign = +1 to apply a row's effect, -1 to reverse it
CREATE OR REPLACE FUNCTION public.fn_apply_txn_to_balances(
  p_user UUID, p_type TEXT, p_amount NUMERIC, p_from TEXT, p_to TEXT, p_sign INTEGER
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_type = 'income' THEN
    UPDATE public.accounts SET balance = balance + (p_amount * p_sign), updated_at = NOW()
      WHERE user_id = p_user AND name = p_from;
  ELSIF p_type = 'expense' THEN
    UPDATE public.accounts SET balance = balance - (p_amount * p_sign), updated_at = NOW()
      WHERE user_id = p_user AND name = p_from;
  ELSIF p_type = 'transfer' THEN
    UPDATE public.accounts SET balance = balance - (p_amount * p_sign), updated_at = NOW()
      WHERE user_id = p_user AND name = p_from;
    IF p_to IS NOT NULL THEN
      UPDATE public.accounts SET balance = balance + (p_amount * p_sign), updated_at = NOW()
        WHERE user_id = p_user AND name = p_to;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Reverse the OLD row's effect first (edit / delete)
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.fn_apply_txn_to_balances(
      OLD.user_id, OLD.type::text, OLD.amount, OLD.account_name, OLD.to_account_name, -1
    );
  END IF;
  -- Apply the NEW row's effect (insert / edit)
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.fn_apply_txn_to_balances(
      NEW.user_id, NEW.type::text, NEW.amount, NEW.account_name, NEW.to_account_name, +1
    );
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER trg_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();


-- ============================================================================
-- DONE. After running this, deploy the matching app version (≥ 1.075) which
-- removes the manual balance updates from TransferForm — the trigger now
-- handles transfer balances. Do not run app < 1.075 against this schema when
-- recording transfers, or balances will double-count.
-- ============================================================================
