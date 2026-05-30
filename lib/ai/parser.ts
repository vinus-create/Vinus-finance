import { getFlashModel } from './gemini'
import { buildTextPrompt, buildImagePrompt, buildBankStatementPrompt, buildVoiceAudioPrompt } from './prompts'
import type { ExpenseCategory, IncomeCategory, TransactionType } from '@/lib/types/app.types'

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
  is_tax_deductible: boolean
  confidence: number
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

  const today = new Date().toISOString().slice(0, 10)
  const dateStr = typeof raw.transaction_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.transaction_date)
    ? raw.transaction_date
    : today

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
    const result = await model.generateContent(buildTextPrompt(input))
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
    const result = await model.generateContent([
      { text: buildImagePrompt() },
      { inlineData: { mimeType, data: base64Data } },
    ])
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
    const result = await model.generateContent([
      { text: buildVoiceAudioPrompt() },
      { inlineData: { mimeType, data: base64Data } },
    ])
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
    const result = await model.generateContent([
      { text: buildBankStatementPrompt() },
      { inlineData: { mimeType: 'application/pdf', data: base64Data } },
    ])
    const text = result.response.text()
    const { transactions, accountInfo } = parseBankStatementJSON(text)
    return { success: true, transactions, source: 'pdf', accountInfo }
  } catch (err) {
    console.error('[parsePDFTransaction]', err)
    return { success: false, transactions: [], source: 'pdf', error: String(err) }
  }
}
