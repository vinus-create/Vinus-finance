// ─── Enums (mirror the PostgreSQL enums) ─────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer'

export type ExpenseCategory =
  | 'restaurant'
  | 'grocery'
  | 'grab_food'
  | 'coffee'
  | 'household'
  | 'furniture'
  | 'tol'
  | 'grab_transport'
  | 'petrol'
  | 'parking'
  | 'lrt_mrt'
  | 'touch_n_go'
  | 'epf_kwsp'
  | 'socso_perkeso'
  | 'income_tax'
  | 'electricity_tnb'
  | 'water_syabas'
  | 'internet_telco'
  | 'insurance'
  | 'rent_mortgage'
  | 'shopee'
  | 'lazada'
  | 'clothing'
  | 'electronics'
  | 'medical'
  | 'pharmacy'
  | 'gym'
  | 'education'
  | 'books'
  | 'entertainment'
  | 'travel'
  | 'subscription'
  | 'loan_repayment'
  | 'investment'
  | 'savings'
  | 'other_expense'

export type IncomeCategory =
  | 'salary'
  | 'bonus'
  | 'freelance'
  | 'business_income'
  | 'rental_income'
  | 'dividend'
  | 'interest'
  | 'epf_withdrawal'
  | 'government_aid'
  | 'other_income'

export type LoanType =
  | 'personal_loan'
  | 'home_loan'
  | 'car_loan'
  | 'business_loan'
  | 'credit_card'
  | 'bnpl'
  | 'other_loan'

export type InterestMethod =
  | 'reducing_balance'
  | 'flat_rate'
  | 'islamic_bba'
  | 'islamic_murabahah'
  | 'islamic_tawarruq'
  | 'zero_interest'

export type TaxFormType = 'BE' | 'B'

export type TaxReliefCategory =
  | 'individual_self'
  | 'disabled_self'
  | 'spouse'
  | 'child_unmarried_18'
  | 'child_student'
  | 'child_disabled'
  | 'life_insurance_epf'
  | 'epf_voluntary'
  | 'private_retirement'
  | 'education_insurance'
  | 'medical_insurance'
  | 'socso_voluntary'
  | 'medical_expenses'
  | 'serious_illness'
  | 'vaccination'
  | 'complete_medical_exam'
  | 'mental_health'
  | 'self_education'
  | 'sspn'
  | 'lifestyle'
  | 'lifestyle_additional'
  | 'ev_charging'
  | 'breastfeeding'
  | 'childcare_fees'
  | 'housing_loan_interest'
  | 'zakat_fitrah'
  | 'other_relief'

export type ReminderFrequency = 'once' | 'weekly' | 'monthly' | 'yearly'
export type ReminderStatus = 'active' | 'snoozed' | 'completed' | 'cancelled'

// ─── DB Row Types ─────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string | null
  display_name: string | null
  avatar_url: string | null
  ic_number: string | null
  tax_identification_number: string | null
  tax_form_type: TaxFormType
  currency: string
  locale: string
  timezone: string
  push_enabled: boolean
  email_reminders: boolean
  onboarding_done: boolean
  created_at: string
  updated_at: string
}

export type LedgerType = 'personal' | 'business'

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  currency: string
  expense_category: ExpenseCategory | null
  income_category: IncomeCategory | null
  description: string | null
  notes: string | null
  merchant_name: string | null
  reference_number: string | null
  account_name: string
  transaction_date: string
  ledger: LedgerType
  is_tax_deductible: boolean
  tax_relief_id: string | null
  receipt_url: string | null
  created_at: string
  updated_at: string
}

export interface Loan {
  id: string
  user_id: string
  name: string
  lender_name: string | null
  loan_type: LoanType
  interest_method: InterestMethod
  is_islamic: boolean
  principal_amount: number
  outstanding_balance: number
  interest_rate: number
  monthly_payment: number
  tenure_months: number
  remaining_months: number | null
  start_date: string
  end_date: string | null
  next_payment_date: string | null
  account_number: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TaxRelief {
  id: string
  user_id: string
  assessment_year: number
  tax_form: TaxFormType
  category: TaxReliefCategory
  claimed_amount: number
  max_allowed: number | null
  description: string | null
  receipt_urls: string[] | null
  linked_transaction_ids: string[] | null
  created_at: string
  updated_at: string
}

export interface Reminder {
  id: string
  user_id: string
  title: string
  description: string | null
  amount: number | null
  currency: string
  due_date: string
  frequency: ReminderFrequency
  status: ReminderStatus
  snoozed_until: string | null
  notify_push: boolean
  notify_email: boolean
  days_before: number
  linked_loan_id: string | null
  created_at: string
  updated_at: string
}

export type AccountType = 'bank' | 'ewallet' | 'investment' | 'cash' | 'credit_card' | 'other'

export interface Account {
  id: string
  user_id: string
  name: string
  account_type: AccountType
  institution: string | null
  account_number: string | null
  balance: number
  currency: string
  color: string | null
  is_active: boolean
  include_in_net_worth: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type AssetType = 'stock' | 'etf' | 'gold' | 'crypto' | 'mutual_fund' | 'other'

export interface StockHolding {
  id: string
  user_id: string
  ticker: string
  company_name: string | null
  exchange: string | null
  asset_type: AssetType
  shares: number
  avg_cost_price: number
  currency: string
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StockTrade {
  id: string
  user_id: string
  ticker: string
  company_name: string | null
  trade_type: 'buy' | 'sell'
  shares: number
  price_per_share: number
  total_amount: number
  fees: number
  trade_date: string
  notes: string | null
  created_at: string
}

export interface StockWatchlist {
  id: string
  user_id: string
  ticker: string
  company_name: string | null
  exchange: string | null
  target_price: number | null
  notes: string | null
  added_at: string
}

export interface Budget {
  id: string
  user_id: string
  period_year: number
  period_month: number
  expense_category: ExpenseCategory
  budget_amount: number
  currency: string
  carry_over: boolean
  notes: string | null
  created_at: string
  updated_at: string
}
