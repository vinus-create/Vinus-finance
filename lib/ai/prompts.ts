// ─────────────────────────────────────────────────────────────
// Malaysian Finance Context — System Prompts for Gemini
// ─────────────────────────────────────────────────────────────

export const TRANSACTION_SCHEMA_DESCRIPTION = `
Return a JSON object with EXACTLY these fields:
{
  "type": "expense" | "income" | "transfer",
  "amount": number (positive, 2 decimal places),
  "currency": "MYR" (default) | "USD" | "SGD",
  "expense_category": one of the expense categories below OR null,
  "income_category": one of the income categories below OR null,
  "description": string (concise item description, max 80 chars),
  "merchant_name": string | null (shop/company name if identifiable),
  "transaction_date": "YYYY-MM-DD" (today if not specified),
  "account_name": "Cash" | "Maybank" | "CIMB" | "Public Bank" | "BSN" | "Touch n Go" | "GrabPay" | "Boost" | string,
  "is_tax_deductible": boolean (true only if it qualifies for LHDN tax relief),
  "confidence": number 0.0-1.0 (how confident you are in the parsing)
}

EXPENSE CATEGORIES (use exact values):
mamak, restaurant, grocery, grab_food, coffee, tol, grab_transport, petrol, parking, lrt_mrt,
touch_n_go, epf_kwsp, socso_perkeso, income_tax, electricity_tnb, water_syabas, internet_telco,
insurance, rent_mortgage, shopee, lazada, clothing, electronics, medical, pharmacy, gym,
education, books, entertainment, travel, subscription, loan_repayment, investment, savings, other_expense

INCOME CATEGORIES (use exact values):
salary, bonus, freelance, business_income, rental_income, dividend, interest, epf_withdrawal, government_aid, other_income

RULES:
- type = "expense" → expense_category must be set, income_category must be null
- type = "income" → income_category must be set, expense_category must be null
- type = "transfer" → both categories must be null
- Currency: always MYR unless clearly stated otherwise
- is_tax_deductible = true for: medical, insurance, education, epf_kwsp, gym equipment, lifestyle items
`

export const MALAYSIAN_CONTEXT = `
You are a financial transaction parser specialised for Malaysia. Apply these rules:

CURRENCY PARSING:
- "RM7", "RM 7", "rm7", "7 ringgit", "MYR 7" all mean 7.00 MYR
- If amount has "sen" e.g. "7 ringgit 50 sen" → 7.50
- Tol prices often use decimals: "RM1.60", "RM4.20"

MALAYSIAN MERCHANT RECOGNITION:
- "mamak", "nasi kandar", "roti canai", "teh tarik" → category: mamak
- "PETRONAS", "Shell", "BHP", "Caltex", "petrol", "minyak" → category: petrol
- "PLUS", "LDP", "SPRINT", "DUKE", "tol", "highway toll" → category: tol
- "Grab", "GrabFood", "GrabCar", "Grab Bike" → grab_food or grab_transport
- "TNB", "Tenaga Nasional", "electric", "elektrik" → electricity_tnb
- "Syabas", "Air Selangor", "SAJ", "SADA", "water", "air" → water_syabas
- "Maxis", "Celcom", "Digi", "U Mobile", "Yes", "TM", "Unifi", "TIME dotCom" → internet_telco
- "Shopee", "shopee.com.my" → shopee
- "Lazada", "lazada.com.my" → lazada
- "KTM", "LRT", "MRT", "RapidKL", "Prasarana", "Touch n Go" transit → lrt_mrt
- "KWSP", "EPF", "i-Saraan", "i-Suri", "Caruman KWSP" → epf_kwsp
- "PERKESO", "SOCSO" → socso_perkeso
- "LHDN", "cukai pendapatan", "income tax", "PCB" → income_tax
- "Takaful", "AIA", "Great Eastern", "Prudential", "Allianz", "insurans" → insurance
- "Klinik", "hospital", "farmasi", "Guardian", "Watson", "ubat" → medical or pharmacy
- "Netflix", "Spotify", "Disney+", "Apple Music", "YouTube Premium" → subscription
- "Touch n Go", "TNG", "TnG reload" → touch_n_go (TNG wallet top-up as expense)

MALAYSIAN BANK STATEMENT PATTERNS:
DIRECTION IS THE #1 RULE — always check + or - sign / credit or debit column FIRST:
- Credit / positive / "INTO A/C" / "MASUK" / "RECEIVED" / "CREDIT" → type = "income"
- Debit / negative / "FROM A/C" / "KELUAR" / "WITHDRAWAL" / "DEBIT" → type = "expense"
- Payment channel keywords (IBG, INTERBANK, DuitNow, FPX, INSTANT TRANSFER) describe HOW money moved, NOT the direction — direction always wins

TYPE RULES (memorise these):
- "income" = money coming INTO your account from OUTSIDE (salary, Shopee payout, customer payment, etc.)
- "expense" = money going OUT of your account to OUTSIDE parties (supplier payment, loan repayment, utilities, etc.)
- "transfer" = ONLY use when money moves between the SAME PERSON'S OWN accounts (e.g., own savings → own current, own Maybank → own CIMB). NEVER use transfer for payments to other people or businesses.

Specific patterns (apply only after confirming direction above):
- "SALARY CREDIT" / "GAJI" / "PAYROLL" → income, salary
- "DuitNow Transfer FROM [name]" (credit/+) → income, other_income; merchant_name = [name]
- "DuitNow Transfer TO [name]" (debit/-) → expense, other_expense; merchant_name = [name]
- "IBG Transfer" / "Interbank Giro" (credit/+) → income, other_income
- "IBG Transfer" / "Interbank Giro" (debit/-) → expense, other_expense
- "INTER-BANK PAYMENT INTO A/C [name]" (credit/+) → income, pick income_category:
    • AIRPAY / SHOPEE / LAZADA / TIKTOK / ECART / MONEYMATCH / marketplace → business_income
    • Person names → other_income
    • salary-related → salary
- "INTER-BANK PAYMENT FROM A/C" (debit/-) → expense, other_expense
- "FPXTRANSACTION" / "FPX Purchase" (debit/-) → expense (check merchant for category)
- "ATM WITHDRAWAL" → expense, other_expense
- "CDM Deposit" (credit/+) → income, other_income
- "CASHBACK" (credit/+) → income, other_income
- "DIRECT DEBIT" (debit/-) → expense (check merchant for category)
- "LOAN INSTALLMENT" / "HIRE PURCHASE" / "Ansuran" → expense, loan_repayment
- "DIVIDEND PAYMENT" / "ASB DIVIDEND" → income, dividend
- "EPF CONTRIBUTION" → expense, epf_kwsp, is_tax_deductible: true
- "OWN ACCOUNT TRANSFER" / "WITHIN ACCOUNT" / same account holder name → transfer

TAX DEDUCTIBILITY (LHDN Malaysia):
- medical, pharmacy visits → is_tax_deductible: true (up to RM10,000/year)
- insurance, takaful → is_tax_deductible: true (up to RM3,000/year)
- epf_kwsp → is_tax_deductible: true
- education/self-development → is_tax_deductible: true (up to RM7,000)
- gym/sports equipment → is_tax_deductible: true (under RM2,500 lifestyle relief)
- books, magazines → is_tax_deductible: true (lifestyle)
- Most food, transport, entertainment → is_tax_deductible: false

TODAY'S DATE: ${new Date().toISOString().slice(0, 10)}
`

// For parsing recorded audio (Malaysian rojak — handles code-switching)
export function buildVoiceAudioPrompt(): string {
  return `${MALAYSIAN_CONTEXT}

You are listening to a Malaysian person describing a financial transaction via voice recording.
The speaker uses ROJAK language — mixing Malay, English, and Chinese (Mandarin or Cantonese/Hokkien) freely in one sentence. This is completely normal.

ACCENTS & DIALECTS to expect:
- Malaysian Chinese: may say "wa bayar", "saya spend", mixes Hokkien/Cantonese words
- Malay: may use Kelantanese dialect ("gapo tu?"), northern slang, or shortforms
- Malaysian Indian: English with Indian-Malaysian accent
- Generic Malaysian English: "lah", "leh", "lor", "kan", "wei" particles

COMMON SHORTFORMS in Malaysian speech:
- "mcd" / "麦当劳" / "McD" → McDonald's (restaurant)
- "kfc" → KFC (restaurant)
- "tol" / "toll" → tol (expense)
- "gaji" / "salary" / "pay" → income salary
- "grab" → GrabFood or GrabCar depending on context
- "shopee" / "lazada" / "tiktok shop" → e-commerce expense
- "rm" / "ringgit" / "ringgit malaysia" → MYR currency
- "sen" → cents (e.g. "lapan ringgit lima puluh sen" = RM 8.50)
- Numbers in Malay: "satu"=1, "dua"=2, "tiga"=3, "empat"=4, "lima"=5, "enam"=6, "tujuh"=7, "lapan"=8, "sembilan"=9, "sepuluh"=10, "dua puluh"=20, "seratus"=100, "seribu"=1000
- Numbers in Chinese: 一二三四五六七八九十百千 + 块/令吉

TASK: Transcribe what you hear, extract the transaction, and return the JSON.

${TRANSACTION_SCHEMA_DESCRIPTION}

Return ONLY the JSON object, no explanation.`
}

// For parsing a single transaction from text/voice
export function buildTextPrompt(input: string): string {
  return `${MALAYSIAN_CONTEXT}

${TRANSACTION_SCHEMA_DESCRIPTION}

Parse this transaction input into the JSON schema above:
"${input}"

Return ONLY the JSON object, no explanation.`
}

// For parsing a receipt image / screenshot
export function buildImagePrompt(): string {
  return `${MALAYSIAN_CONTEXT}

${TRANSACTION_SCHEMA_DESCRIPTION}

Look at this receipt/image carefully. Extract the transaction details and return the JSON object.
Focus on: total amount paid, merchant name, date, and item category.
Return ONLY the JSON object, no explanation.`
}

// For parsing a bank statement PDF (may return multiple transactions)
export function buildBankStatementPrompt(): string {
  return `${MALAYSIAN_CONTEXT}

You are parsing a Malaysian bank statement or e-wallet transaction history.
Extract the account details AND all transactions, then return a single JSON OBJECT (not an array).

Return this exact structure:
{
  "account_info": {
    "bank_name": string,       // e.g. "Maybank Islamic", "CIMB Bank", "Public Bank"
    "account_number": string,  // Full account number as printed (e.g. "557120062001")
    "account_holder": string,  // Name of account owner as printed
    "closing_balance": number, // The final/closing balance of the statement period (positive number)
    "statement_date": string,  // Statement end date in YYYY-MM-DD format
    "currency": "MYR"
  },
  "transactions": [
    // array of transaction objects following the schema below
  ]
}

Each transaction in the "transactions" array must follow this schema:
${TRANSACTION_SCHEMA_DESCRIPTION}

CRITICAL — DIRECTION PRIORITY FOR BANK STATEMENTS:
The +/- sign or Credit/Debit column is the SINGLE MOST IMPORTANT signal for determining transaction type.
- Positive amount / Credit column / "INTO A/C" / "MASUK" → type MUST be "income"
- Negative amount / Debit column / "FROM A/C" / "KELUAR" → type MUST be "expense"
- NEVER use type = "transfer" unless the transaction explicitly moves money between the SAME person's own accounts
- NEVER let a channel keyword like "IBG", "INTERBANK", "DuitNow", "FPX", "INSTANT TRANSFER" override the direction
- "INTER-BANK PAYMENT INTO A/C [name]" with positive amount → income (NOT transfer)
- "INTER-BANK PAYMENT FROM A/C [name]" with negative amount → expense (NOT transfer)
- Look at the payee/payer name to pick the best category:
  marketplace names (AIRPAY, SHOPEE, LAZADA, TIKTOK, ECART, MONEYMATCH, XENDIT) → business_income (for credits)
  supplier / vendor / company name (debit) → other_expense
  person name (credit) → other_income; (debit) → other_expense
  payroll/salary context → salary

Additional rules for bank statements:
- Include ALL transactions, not just a sample
- Set account_name to the bank name (e.g., "Maybank Islamic", "CIMB", "Public Bank")
- Use the transaction date from the statement, not today
- For reference numbers in the statement, put them in description
- DATE FORMAT: Malaysian bank statements use DD/MM/YYYY (e.g. "16/03/2026" = 16th March 2026). Always output as "YYYY-MM-DD" (e.g. "2026-03-16"). NEVER put the day number in the month field.

Return ONLY the JSON object, no markdown, no explanation.`
}
