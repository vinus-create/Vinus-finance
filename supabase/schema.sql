-- ============================================================
-- VINUS FINANCE — PostgreSQL Schema
-- Target: Supabase (gbxzmiewrzbagwxrdskh.supabase.co)
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUMS ───────────────────────────────────────────────────

CREATE TYPE transaction_type AS ENUM (
  'income',
  'expense',
  'transfer'
);

CREATE TYPE expense_category AS ENUM (
  -- Food & Drink
  'mamak',
  'restaurant',
  'grocery',
  'grab_food',
  'coffee',
  -- Transport
  'tol',
  'grab_transport',
  'petrol',
  'parking',
  'lrt_mrt',
  -- Malaysian Finance
  'touch_n_go',
  'epf_kwsp',
  'socso_perkeso',
  'income_tax',
  -- Bills & Utilities
  'electricity_tnb',
  'water_syabas',
  'internet_telco',
  'insurance',
  'rent_mortgage',
  -- E-Commerce / Shopping
  'shopee',
  'lazada',
  'clothing',
  'electronics',
  -- Health
  'medical',
  'pharmacy',
  'gym',
  -- Education
  'education',
  'books',
  -- Entertainment
  'entertainment',
  'travel',
  'subscription',
  -- Financial
  'loan_repayment',
  'investment',
  'savings',
  -- Other
  'other_expense'
);

CREATE TYPE income_category AS ENUM (
  'salary',
  'bonus',
  'freelance',
  'business_income',
  'rental_income',
  'dividend',
  'interest',
  'epf_withdrawal',
  'government_aid',
  'other_income'
);

CREATE TYPE loan_type AS ENUM (
  'personal_loan',
  'home_loan',
  'car_loan',
  'business_loan',
  'credit_card',
  'bnpl',
  'other_loan'
);

CREATE TYPE interest_method AS ENUM (
  'reducing_balance',
  'flat_rate',
  'islamic_bba',
  'islamic_murabahah',
  'islamic_tawarruq',
  'zero_interest'
);

CREATE TYPE tax_form_type AS ENUM (
  'BE',
  'B'
);

CREATE TYPE tax_relief_category AS ENUM (
  'individual_self',
  'disabled_self',
  'spouse',
  'child_unmarried_18',
  'child_student',
  'child_disabled',
  'life_insurance_epf',
  'epf_voluntary',
  'private_retirement',
  'education_insurance',
  'medical_insurance',
  'socso_voluntary',
  'medical_expenses',
  'serious_illness',
  'vaccination',
  'complete_medical_exam',
  'mental_health',
  'self_education',
  'sspn',
  'lifestyle',
  'lifestyle_additional',
  'ev_charging',
  'breastfeeding',
  'childcare_fees',
  'housing_loan_interest',
  'zakat_fitrah',
  'other_relief'
);

CREATE TYPE reminder_frequency AS ENUM (
  'once',
  'weekly',
  'monthly',
  'yearly'
);

CREATE TYPE reminder_status AS ENUM (
  'active',
  'snoozed',
  'completed',
  'cancelled'
);


-- ─── HELPER: updated_at trigger function ─────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─── TABLE: profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                        UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                 TEXT,
  display_name              TEXT,
  avatar_url                TEXT,
  ic_number                 TEXT,
  tax_identification_number TEXT,
  tax_form_type             tax_form_type NOT NULL DEFAULT 'BE',
  currency                  CHAR(3)       NOT NULL DEFAULT 'MYR',
  locale                    TEXT          NOT NULL DEFAULT 'ms-MY',
  timezone                  TEXT          NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  push_enabled              BOOLEAN       NOT NULL DEFAULT FALSE,
  email_reminders           BOOLEAN       NOT NULL DEFAULT TRUE,
  onboarding_done           BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_profiles_tax_form ON public.profiles(tax_form_type);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: owner can select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: owner can insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: owner can update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: owner can delete"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── TABLE: transactions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id                UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type              transaction_type  NOT NULL,
  amount            NUMERIC(15, 2)    NOT NULL CHECK (amount > 0),
  currency          CHAR(3)           NOT NULL DEFAULT 'MYR',
  expense_category  expense_category,
  income_category   income_category,
  description       TEXT,
  notes             TEXT,
  merchant_name     TEXT,
  reference_number  TEXT,
  account_name      TEXT              NOT NULL DEFAULT 'Cash',
  transaction_date  DATE              NOT NULL DEFAULT CURRENT_DATE,
  is_tax_deductible BOOLEAN           NOT NULL DEFAULT FALSE,
  tax_relief_id     UUID,
  receipt_url       TEXT,
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_category_consistency CHECK (
    (type = 'expense'  AND expense_category IS NOT NULL AND income_category IS NULL) OR
    (type = 'income'   AND income_category  IS NOT NULL AND expense_category IS NULL) OR
    (type = 'transfer' AND expense_category IS NULL     AND income_category IS NULL)
  )
);

CREATE TRIGGER set_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_transactions_user_id     ON public.transactions(user_id);
CREATE INDEX idx_transactions_user_date   ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_type        ON public.transactions(user_id, type);
CREATE INDEX idx_transactions_expense_cat ON public.transactions(user_id, expense_category)
  WHERE expense_category IS NOT NULL;
CREATE INDEX idx_transactions_income_cat  ON public.transactions(user_id, income_category)
  WHERE income_category IS NOT NULL;
CREATE INDEX idx_transactions_tax         ON public.transactions(user_id, is_tax_deductible)
  WHERE is_tax_deductible = TRUE;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions: owner full access"
  ON public.transactions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── TABLE: loans ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loans (
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                TEXT            NOT NULL,
  lender_name         TEXT,
  loan_type           loan_type       NOT NULL,
  interest_method     interest_method NOT NULL DEFAULT 'reducing_balance',
  is_islamic          BOOLEAN         NOT NULL DEFAULT FALSE,
  principal_amount    NUMERIC(15, 2)  NOT NULL CHECK (principal_amount > 0),
  outstanding_balance NUMERIC(15, 2)  NOT NULL CHECK (outstanding_balance >= 0),
  interest_rate       NUMERIC(6, 4)   NOT NULL CHECK (interest_rate >= 0),
  monthly_payment     NUMERIC(15, 2)  NOT NULL CHECK (monthly_payment > 0),
  tenure_months       INTEGER         NOT NULL CHECK (tenure_months > 0),
  remaining_months    INTEGER         CHECK (remaining_months >= 0),
  start_date          DATE            NOT NULL,
  end_date            DATE,
  next_payment_date   DATE,
  account_number      TEXT,
  notes               TEXT,
  is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_loans_user_id      ON public.loans(user_id);
CREATE INDEX idx_loans_active       ON public.loans(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_loans_next_payment ON public.loans(user_id, next_payment_date);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loans: owner full access"
  ON public.loans
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── TABLE: tax_reliefs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tax_reliefs (
  id                      UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID                  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_year         INTEGER               NOT NULL CHECK (assessment_year >= 2020),
  tax_form                tax_form_type         NOT NULL DEFAULT 'BE',
  category                tax_relief_category   NOT NULL,
  claimed_amount          NUMERIC(10, 2)        NOT NULL DEFAULT 0 CHECK (claimed_amount >= 0),
  max_allowed             NUMERIC(10, 2),
  description             TEXT,
  receipt_urls            TEXT[],
  linked_transaction_ids  UUID[],
  created_at              TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, assessment_year, category)
);

CREATE TRIGGER set_tax_reliefs_updated_at
  BEFORE UPDATE ON public.tax_reliefs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_tax_reliefs_user_year ON public.tax_reliefs(user_id, assessment_year);
CREATE INDEX idx_tax_reliefs_category  ON public.tax_reliefs(user_id, category);

ALTER TABLE public.tax_reliefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_reliefs: owner full access"
  ON public.tax_reliefs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add FK from transactions to tax_reliefs (after both tables exist)
ALTER TABLE public.transactions
  ADD CONSTRAINT fk_transaction_tax_relief
  FOREIGN KEY (tax_relief_id) REFERENCES public.tax_reliefs(id) ON DELETE SET NULL;


-- ─── TABLE: reminders ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reminders (
  id             UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID               NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title          TEXT               NOT NULL,
  description    TEXT,
  amount         NUMERIC(15, 2),
  currency       CHAR(3)            NOT NULL DEFAULT 'MYR',
  due_date       DATE               NOT NULL,
  frequency      reminder_frequency NOT NULL DEFAULT 'monthly',
  status         reminder_status    NOT NULL DEFAULT 'active',
  snoozed_until  DATE,
  notify_push    BOOLEAN            NOT NULL DEFAULT TRUE,
  notify_email   BOOLEAN            NOT NULL DEFAULT FALSE,
  days_before    INTEGER            NOT NULL DEFAULT 3 CHECK (days_before >= 0),
  linked_loan_id UUID               REFERENCES public.loans(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_reminders_user_id  ON public.reminders(user_id);
CREATE INDEX idx_reminders_due_date ON public.reminders(user_id, due_date);
CREATE INDEX idx_reminders_active   ON public.reminders(user_id, status) WHERE status = 'active';

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders: owner full access"
  ON public.reminders
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── TABLE: budgets ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budgets (
  id               UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_year      INTEGER           NOT NULL CHECK (period_year >= 2020),
  period_month     INTEGER           NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  expense_category expense_category  NOT NULL,
  budget_amount    NUMERIC(15, 2)    NOT NULL CHECK (budget_amount >= 0),
  currency         CHAR(3)           NOT NULL DEFAULT 'MYR',
  carry_over       BOOLEAN           NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_year, period_month, expense_category)
);

CREATE TRIGGER set_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_budgets_user_period ON public.budgets(user_id, period_year, period_month);
CREATE INDEX idx_budgets_category    ON public.budgets(user_id, expense_category);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets: owner full access"
  ON public.budgets
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
