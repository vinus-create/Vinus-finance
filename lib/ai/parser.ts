import { getFlashModel, getFlashModelHQ } from './gemini'
import { buildTextPrompt, buildImagePrompt, buildBankStatementPrompt, buildVoiceAudioPrompt, buildInvestmentStatementPrompt } from './prompts'
import type { ExpenseCategory, IncomeCategory, TransactionType, LedgerType } from '@/lib/types/app.types'

// ─── Output Schema ─────────────────────────────────────────────

export interface ParsedTransaction {
  type: TransactionType
  amount: number
  currency: string
  expense_category: ExpenseCategory | null
  income_category: IncomeCategory | null
  description: string
  merchant_name: string | null
  transaction_date: string
  account_name: string
  ledger: LedgerType
  is_tax_deductible: boolean
  confidence: number
}

// ─── Investment Statement Types ──────────────────────────────
export interface ParsedStockTrade {
  ticker: string
  company_name: string | null
  trade_type: 'buy' | 'sell'
  shares: number
  price_per_share: number
  total_amount: number
  fees: number
  trade_date: string
  currency: string
  notes: string | null
}

export interface InvestmentStatementInfo {
  broker_name: string
  account_holder: string
  account_number: string
  statement_date: string
  currency: string
  total_value: number | null
}

export interface InvestmentParseResult {
  success: boolean
  trades: ParsedStockTrade[]
  statementInfo: InvestmentStatementInfo | null
  error?: string
}

export interface StatementAccountInfo {
  bank_name: string
  account_number: string        // full account number as printed
  account_holder: string
  closing_balance: number | null
  statement_date: string
  currency: string
}

export interface ParseResult {
  success: boolean
  transactions: ParsedTransaction[]
  source: 'text' | 'voice' | 'image' | 'pdf'
  accountInfo?: StatementAccountInfo | null
  error?: string
}

// ─── Helpers ──────────────────────────────────────────────────

/** Returns today's date in YYYY-MM-DD using MY timezone (UTC+8) */
function todayMY(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
}

/** Calls fn() with exponential backoff — 2 retries, delays 500ms / 1s */
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries) throw err
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)))
    }
  }
  throw new Error('unreachable')
}

// ─── Validation & Sanitisation ────────────────────────────────

const VALID_EXPENSE_CATEGORIES = new Set([
  'mamak','restaurant','grocery','grab_food','coffee','tol','grab_transport','petrol',
  'parking','lrt_mrt','touch_n_go','epf_kwsp','socso_perkeso','income_tax',
  'electricity_tnb','water_syabas','internet_telco','insurance','rent_mortgage',
  'shopee','lazada','clothing','electronics','medical','pharmacy','gym',
  'education','books','entertainment','travel','subscription',
  'loan_repayment','investment','savings','other_expense',
])

const VALID_INCOME_CATEGORIES = new Set([
  'salary','bonus','freelance','business_income','rental_income',
  'dividend','interest','epf_withdrawal','government_aid','other_income',
])

// Income categories that signal a business transaction
const BUSINESS_INCOME_CATEGORIES = new Set([
  'business_income', 'rental_income', 'freelance',
])

function sanitiseTransaction(raw: Record<string, unknown>): ParsedTransaction {
  const type = (['income','expense','transfer'].includes(raw.type as string)
    ? raw.type : 'expense') as TransactionType

  const amount = typeof raw.amount === 'number' && raw.amount > 0
    ? Math.round(raw.amount * 100) / 100
    : 0

  const expense_category = type === 'expense' && VALID_EXPENSE_CATEGORIES.has(raw.expense_category as string)
    ? raw.expense_category as ExpenseCategory
    : type === 'expense' ? 'other_expense' : null

  const income_category = type === 'income' && VALID_INCOME_CATEGORIES.has(raw.income_category as string)
    ? raw.income_category as IncomeCategory
    : type === 'income' ? 'other_income' : null

  const dateStr = typeof raw.transaction_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.transaction_date)
    ? raw.transaction_date
    : todayMY()

  // Auto-detect business ledger: business_income / rental / freelance → business
  const rawLedger = raw.ledger as string | undefined
  const autoLedger: LedgerType = (rawLedger === 'business')
    || (type === 'income' && income_category !== null && BUSINESS_INCOME_CATEGORIES.has(income_category))
    ? 'business' : 'personal'

  return {
    type,
    amount,
    currency: typeof raw.currency === 'string' ? raw.currency : 'MYR',
    expense_category,
    income_category,
    description: typeof raw.description === 'string' ? raw.description.slice(0, 120) : '',
    merchant_name: typeof raw.merchant_name === 'string' ? raw.merchant_name : null,
    transaction_date: dateStr,
    account_name: typeof raw.account_name === 'string' ? raw.account_name : 'Cash',
    ledger: autoLedger,
    is_tax_deductible: raw.is_tax_deductible === true,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.7,
  }
}

function parseGeminiJSON(text: string): ParsedTransaction[] {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned)
  if (Array.isArray(parsed)) {
    return parsed.map(item => sanitiseTransaction(item as Record<string, unknown>))
  }
  return [sanitiseTransaction(parsed as Record<string, unknown>)]
}

/** Parse the bank-statement response which returns { account_info, transactions } */
function parseBankStatementJSON(text: string): {
  transactions: ParsedTransaction[]
  accountInfo: StatementAccountInfo | null
} {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned)

  // Backwards-compatible: if AI returned a plain array, handle gracefully
  if (Array.isArray(parsed)) {
    return {
      transactions: parsed.map(item => sanitiseTransaction(item as Record<string, unknown>)),
      accountInfo: null,
    }
  }

  const txnRaw = parsed.transactions
  const transactions = Array.isArray(txnRaw)
    ? txnRaw.map((item: Record<string, unknown>) => sanitiseTransaction(item))
    : []

  const ai = parsed.account_info as Record<string, unknown> | undefined
  let accountInfo: StatementAccountInfo | null = null
  if (ai) {
    accountInfo = {
      bank_name:       typeof ai.bank_name === 'string'       ? ai.bank_name.trim()       : '',
      account_number:  typeof ai.account_number === 'string'  ? ai.account_number.trim()  : '',
      account_holder:  typeof ai.account_holder === 'string'  ? ai.account_holder.trim()  : '',
      closing_balance: typeof ai.closing_balance === 'number' ? ai.closing_balance        : null,
      statement_date:  typeof ai.statement_date === 'string'  ? ai.statement_date         : '',
      currency:        typeof ai.currency === 'string'         ? ai.currency               : 'MYR',
    }
  }

  return { transactions, accountInfo }
}

// ─── Parsers ────────────────────────────────────────────────────

export async function parseTextTransaction(input: string): Promise<ParseResult> {
  try {
    const model = getFlashModel()
    const result = await withRetry(() => model.generateContent(buildTextPrompt(input)))
    const text = result.response.text()
    const transactions = parseGeminiJSON(text)
    return { success: true, transactions, source: 'text' }
  } catch (err) {
    console.error('[parseTextTransaction]', err)
    return { success: false, transactions: [], source: 'text', error: String(err) }
  }
}

export async function parseImageTransaction(
  base64Data: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
): Promise<ParseResult> {
  try {
    const model = getFlashModel()
    const result = await withRetry(() => model.generateContent([
      { text: buildImagePrompt() },
      { inlineData: { mimeType, data: base64Data } },
    ]))
    const text = result.response.text()
    const transactions = parseGeminiJSON(text)
    return { success: true, transactions, source: 'image' }
  } catch (err) {
    console.error('[parseImageTransaction]', err)
    return { success: false, transactions: [], source: 'image', error: String(err) }
  }
}

/** Parse a recorded voice audio clip — handles Malaysian rojak code-switching */
export async function parseVoiceAudioTransaction(
  base64Data: string,
  mimeType: string,
): Promise<ParseResult> {
  try {
    const model = getFlashModel()
    const result = await withRetry(() => model.generateContent([
      { text: buildVoiceAudioPrompt() },
      { inlineData: { mimeType, data: base64Data } },
    ]))
    const text = result.response.text()
    const transactions = parseGeminiJSON(text)
    return { success: true, transactions, source: 'voice' }
  } catch (err) {
    console.error('[parseVoiceAudioTransaction]', err)
    return { success: false, transactions: [], source: 'voice', error: String(err) }
  }
}

export async function parsePDFTransaction(base64Data: string): Promise<ParseResult> {
  try {
    const model = getFlashModel()
    const result = await withRetry(() => model.generateContent([
      { text: buildBankStatementPrompt() },
      { inlineData: { mimeType: 'application/pdf', data: base64Data } },
    ]))
    const text = result.response.text()
    const { transactions, accountInfo } = parseBankStatementJSON(text)
    return { success: true, transactions, source: 'pdf', accountInfo }
  } catch (err) {
    console.error('[parsePDFTransaction]', err)
    return { success: false, transactions: [], source: 'pdf', error: String(err) }
  }
}

// ─── Investment Statement Parser ─────────────────────────────

function parseInvestmentJSON(text: string): { trades: ParsedStockTrade[]; statementInfo: InvestmentStatementInfo | null } {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned)

  const ai = parsed.statement_info as Record<string, unknown> | undefined
  const statementInfo: InvestmentStatementInfo | null = ai ? {
    broker_name:     typeof ai.broker_name === 'string'     ? ai.broker_name     : '',
    account_holder:  typeof ai.account_holder === 'string'  ? ai.account_holder  : '',
    account_number:  typeof ai.account_number === 'string'  ? ai.account_number  : '',
    statement_date:  typeof ai.statement_date === 'string'  ? ai.statement_date  : '',
    currency:        typeof ai.currency === 'string'         ? ai.currency         : 'USD',
    total_value:     typeof ai.total_value === 'number'      ? ai.total_value      : null,
  } : null

  const rawTrades = Array.isArray(parsed.trades) ? parsed.trades : []
  const trades: ParsedStockTrade[] = rawTrades.map((r: Record<string, unknown>) => ({
    ticker:          typeof r.ticker === 'string' ? r.ticker.toUpperCase().trim() : 'UNKNOWN',
    company_name:    typeof r.company_name === 'string' ? r.company_name : null,
    trade_type:      r.trade_type === 'sell' ? 'sell' : 'buy',
    shares:          typeof r.shares === 'number' && r.shares > 0 ? r.shares : 0,
    price_per_share: typeof r.price_per_share === 'number' ? r.price_per_share : 0,
    total_amount:    typeof r.total_amount === 'number' ? r.total_amount : 0,
    fees:            typeof r.fees === 'number' ? r.fees : 0,
    trade_date:      typeof r.trade_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.trade_date) ? r.trade_date : todayMY(),
    currency:        typeof r.currency === 'string' ? r.currency : 'USD',
    notes:           typeof r.notes === 'string' ? r.notes : null,
  })).filter((t: ParsedStockTrade) => t.shares > 0)

  return { trades, statementInfo }
}

export async function parseInvestmentStatement(base64Data: string): Promise<InvestmentParseResult> {
  try {
    const model = getFlashModel()
    const result = await withRetry(() => model.generateContent([
      { text: buildInvestmentStatementPrompt() },
      { inlineData: { mimeType: 'application/pdf', data: base64Data } },
    ]))
    const text = result.response.text()
    const { trades, statementInfo } = parseInvestmentJSON(text)
    return { success: true, trades, statementInfo }
  } catch (err) {
    console.error('[parseInvestmentStatement]', err)
    return { success: false, trades: [], statementInfo: null, error: String(err) }
  }
}
