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
  reference_number: string | null   // bank ref / receipt no / order ID (dedup key)
  transaction_date: string
  transaction_time?: string | null   // HH:MM (24h) if available on statement, else null
  account_name: string
  to_account_name?: string | null   // for internal transfers only
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
  account_type: 'bank' | 'ewallet' | 'credit_card'
  closing_balance: number | null
  statement_period_start: string | null
  statement_period_end: string | null
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

  const refRaw = typeof raw.reference_number === 'string' ? raw.reference_number.trim() : ''

  return {
    type,
    amount,
    currency: typeof raw.currency === 'string' ? raw.currency : 'MYR',
    expense_category,
    income_category,
    description: typeof raw.description === 'string' ? raw.description.slice(0, 120) : '',
    merchant_name: typeof raw.merchant_name === 'string' ? raw.merchant_name : null,
    reference_number: refRaw !== '' ? refRaw.slice(0, 64) : null,
    transaction_date: dateStr,
    account_name: typeof raw.account_name === 'string' ? raw.account_name : 'Cash',
    to_account_name: type === 'transfer' && typeof raw.to_account_name === 'string' && raw.to_account_name.trim() !== ''
      ? raw.to_account_name.trim()
      : null,
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
    const isoDate = (v: unknown): string | null =>
      typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
    accountInfo = {
      bank_name:       typeof ai.bank_name === 'string'       ? ai.bank_name.trim()       : '',
      account_number:  typeof ai.account_number === 'string'  ? ai.account_number.trim()  : '',
      account_holder:  typeof ai.account_holder === 'string'  ? ai.account_holder.trim()  : '',
      account_type:    ai.account_type === 'ewallet' ? 'ewallet'
                     : ai.account_type === 'credit_card' ? 'credit_card' : 'bank',
      closing_balance: typeof ai.closing_balance === 'number' ? ai.closing_balance        : null,
      statement_period_start: isoDate(ai.statement_period_start),
      statement_period_end:   isoDate(ai.statement_period_end),
      statement_date:  typeof ai.statement_date === 'string'  ? ai.statement_date         : '',
      currency:        typeof ai.currency === 'string'         ? ai.currency               : 'MYR',
    }
  }

  return { transactions, accountInfo }
}

// ─── Parsers ────────────────────────────────────────────────────

export async function parseTextTransaction(input: string): Promise<ParseResult> {
  try {
    const model = await getFlashModel()
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
    const model = await getFlashModel()
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
    const model = await getFlashModel()
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

// Long statements get split so Gemini never silently drops rows on big PDFs.
const PDF_CHUNK_THRESHOLD = 8   // split when statement has more pages than this
const PDF_CHUNK_SIZE = 6        // pages per Gemini call (no overlap)

async function parsePDFSingle(
  base64Data: string,
  chunk?: { index: number; total: number },
): Promise<{ transactions: ParsedTransaction[]; accountInfo: StatementAccountInfo | null }> {
  const model = await getFlashModel()
  const result = await withRetry(() => model.generateContent([
    { text: buildBankStatementPrompt(chunk) },
    { inlineData: { mimeType: 'application/pdf', data: base64Data } },
  ]))
  return parseBankStatementJSON(result.response.text())
}

export async function parsePDFTransaction(base64Data: string): Promise<ParseResult> {
  try {
    // Page count check — fall back to single-shot if pdf-lib can't read it
    let pageCount = 0
    let srcDoc: import('pdf-lib').PDFDocument | null = null
    try {
      const { PDFDocument } = await import('pdf-lib')
      srcDoc = await PDFDocument.load(Buffer.from(base64Data, 'base64'), { ignoreEncryption: true })
      pageCount = srcDoc.getPageCount()
    } catch {
      srcDoc = null
    }

    if (!srcDoc || pageCount <= PDF_CHUNK_THRESHOLD) {
      const { transactions, accountInfo } = await parsePDFSingle(base64Data)
      return { success: true, transactions, source: 'pdf', accountInfo }
    }

    // Chunked parse: split into PDF_CHUNK_SIZE-page sub-documents (zero overlap)
    const { PDFDocument } = await import('pdf-lib')
    const totalChunks = Math.ceil(pageCount / PDF_CHUNK_SIZE)
    const allTransactions: ParsedTransaction[] = []
    let accountInfo: StatementAccountInfo | null = null

    for (let c = 0; c < totalChunks; c++) {
      const start = c * PDF_CHUNK_SIZE
      const pageIndices = Array.from(
        { length: Math.min(PDF_CHUNK_SIZE, pageCount - start) },
        (_, i) => start + i,
      )
      const sub = await PDFDocument.create()
      const pages = await sub.copyPages(srcDoc, pageIndices)
      pages.forEach(p => sub.addPage(p))
      const subBase64 = Buffer.from(await sub.save()).toString('base64')

      const part = await parsePDFSingle(subBase64, { index: c + 1, total: totalChunks })
      allTransactions.push(...part.transactions)
      // account_info comes from the chunk containing the statement header (usually #1)
      if (!accountInfo?.bank_name && part.accountInfo?.bank_name) accountInfo = part.accountInfo
      // closing balance is printed at the END of the statement — prefer later chunks
      if (accountInfo && part.accountInfo?.closing_balance !== null && part.accountInfo?.closing_balance !== undefined) {
        accountInfo.closing_balance = part.accountInfo.closing_balance
      }
    }

    return { success: true, transactions: allTransactions, source: 'pdf', accountInfo }
  } catch (err) {
    console.error('[parsePDFTransaction]', err)
    return { success: false, transactions: [], source: 'pdf', error: String(err) }
  }
}

export async function parseBankStatementImage(
  base64Data: string,
  mimeType: 'image/jpeg' | 'image/png'
): Promise<ParseResult> {
  try {
    const model = await getFlashModel()
    const result = await withRetry(() => model.generateContent([
      { text: buildBankStatementPrompt() },
      { inlineData: { mimeType, data: base64Data } },
    ]))
    const text = result.response.text()
    const { transactions, accountInfo } = parseBankStatementJSON(text)
    return { success: true, transactions, source: 'pdf', accountInfo }
  } catch (err) {
    console.error('[parseBankStatementImage]', err)
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
    const model = await getFlashModel()
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
