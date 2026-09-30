-- ============================================================================
-- Vinus Finance v1.109 — data integrity + security   (safe to run repeatedly)
-- Run the whole file in Supabase SQL Editor.
-- ============================================================================
BEGIN;

-- ─── 1. Close tables that were readable/writable with the public anon key ────
-- app_config (AI model settings) is only ever read by the server's service-role
-- client, so RLS with no policy = service role only.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Leftovers from an old trading experiment (no code uses them anymore).
ALTER TABLE IF EXISTS public.bot_trades    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.klines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_data   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.signals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.technicals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.option_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.positions     ENABLE ROW LEVEL SECURITY;

-- Safety net: any per-user table (has user_id) that still has RLS off gets RLS
-- plus an owner-only policy. Tables already protected are left untouched.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      AND EXISTS (SELECT 1 FROM information_schema.columns col
                  WHERE col.table_schema = 'public' AND col.table_name = c.relname
                    AND col.column_name = 'user_id')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid()::text = user_id::text) WITH CHECK (auth.uid()::text = user_id::text)',
      'own_rows_' || r.relname, r.relname);
    RAISE NOTICE 'RLS + owner policy enabled on %', r.relname;
  END LOOP;
END $$;

-- The usage counter is bumped by the server (service role) only.
REVOKE EXECUTE ON FUNCTION public.increment_api_usage(TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_api_usage(TEXT) TO service_role;


-- ─── 2. Statement-anchored balance trigger ────────────────────────────────
-- A transaction dated ON OR BEFORE an account's last_statement_date is already
-- inside the closing balance synced from that statement. Applying it again
-- double-counts — importing May after June added May's activity on top of
-- June's closing balance. Each leg of a transfer checks its own account.
CREATE OR REPLACE FUNCTION public.fn_apply_txn_to_balances_v2(
  p_user UUID, p_type TEXT, p_amount NUMERIC, p_from TEXT, p_to TEXT, p_sign INTEGER, p_date DATE
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_type IN ('income', 'expense', 'transfer') THEN
    UPDATE public.accounts
       SET balance = balance + (CASE WHEN p_type = 'income' THEN 1 ELSE -1 END) * p_amount * p_sign,
           updated_at = NOW()
     WHERE user_id = p_user AND name = p_from
       AND (last_statement_date IS NULL OR p_date IS NULL OR p_date > last_statement_date);
  END IF;
  IF p_type = 'transfer' AND p_to IS NOT NULL THEN
    UPDATE public.accounts
       SET balance = balance + p_amount * p_sign,
           updated_at = NOW()
     WHERE user_id = p_user AND name = p_to
       AND (last_statement_date IS NULL OR p_date IS NULL OR p_date > last_statement_date);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- rename_account() relabels rows in bulk; a pure relabel must never move money
  IF current_setting('app.skip_balance', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.fn_apply_txn_to_balances_v2(
      OLD.user_id, OLD.type::text, OLD.amount, OLD.account_name, OLD.to_account_name, -1, OLD.transaction_date);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.fn_apply_txn_to_balances_v2(
      NEW.user_id, NEW.type::text, NEW.amount, NEW.account_name, NEW.to_account_name, +1, NEW.transaction_date);
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
-- (trigger trg_update_account_balance already points at update_account_balance)


-- ─── 3. Atomic account rename ─────────────────────────────────────────────
-- Transactions and bills reference accounts BY NAME. Renaming only the account
-- row orphaned its whole history. This relabels everything in one transaction
-- (RLS applies: SECURITY INVOKER, so users can only rename their own accounts).
CREATE OR REPLACE FUNCTION public.rename_account(p_account_id UUID, p_new_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_old  TEXT;
  v_user UUID;
  v_new  TEXT := btrim(p_new_name);
BEGIN
  IF v_new IS NULL OR v_new = '' THEN
    RAISE EXCEPTION '户口名称不能为空';
  END IF;
  SELECT name, user_id INTO v_old, v_user FROM public.accounts WHERE id = p_account_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION '找不到这个户口';
  END IF;
  IF v_old = v_new THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounts
             WHERE user_id = v_user AND lower(name) = lower(v_new) AND id <> p_account_id) THEN
    RAISE EXCEPTION '已经有一个叫「%」的户口了', v_new;
  END IF;

  PERFORM set_config('app.skip_balance', 'on', true);   -- transaction-local
  UPDATE public.accounts      SET name = v_new, updated_at = NOW() WHERE id = p_account_id;
  UPDATE public.transactions  SET account_name        = v_new WHERE user_id = v_user AND account_name        = v_old;
  UPDATE public.transactions  SET to_account_name     = v_new WHERE user_id = v_user AND to_account_name     = v_old;
  UPDATE public.monthly_bills SET auto_deduct_account = v_new WHERE user_id = v_user AND auto_deduct_account = v_old;
  PERFORM set_config('app.skip_balance', 'off', true);
END $$;

COMMIT;

-- Check: every table and whether RLS is on (rls_on = false should now only be
-- tables without per-user data, if any).
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;
