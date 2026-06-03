import type { LangCode } from '@/lib/i18n'

// ─── Expense category labels ──────────────────────────────────
const EXPENSE_LABEL: Record<string, Record<LangCode, string>> = {
  mamak:             { en: 'Mamak',                    ms: 'Mamak',                    zh: '马来餐厅' },  // legacy — kept for old transactions
  restaurant:        { en: 'Eat',                      ms: 'Makan',                    zh: '吃' },
  grocery:           { en: 'Grocery',                  ms: 'Barang Dapur',             zh: '超市/杂货' },
  grab_food:         { en: 'GrabFood / Delivery',      ms: 'GrabFood / Delivery',      zh: '外卖/送餐' },
  coffee:            { en: 'Drink',                    ms: 'Minum',                    zh: '喝' },
  tol:               { en: 'Toll',                     ms: 'Tol',                      zh: '过路费' },
  grab_transport:    { en: 'Grab / e-Hailing',         ms: 'Grab / e-Hailing',         zh: '网约车' },
  petrol:            { en: 'Petrol',                   ms: 'Petrol',                   zh: '汽油' },
  parking:           { en: 'Parking',                  ms: 'Parking',                  zh: '停车费' },
  lrt_mrt:           { en: 'LRT / MRT / Bus',          ms: 'LRT / MRT / Bas',          zh: '轻快铁/地铁' },
  touch_n_go:        { en: "Touch 'n Go",              ms: "Touch 'n Go",              zh: "Touch 'n Go" },
  epf_kwsp:          { en: 'EPF / KWSP',               ms: 'KWSP / EPF',               zh: '公积金' },
  socso_perkeso:     { en: 'SOCSO / PERKESO',          ms: 'PERKESO / SOCSO',          zh: '社保/SOCSO' },
  income_tax:        { en: 'Income Tax',               ms: 'Cukai Pendapatan',         zh: '所得税' },
  electricity_tnb:   { en: 'TNB / Electricity',        ms: 'TNB / Elektrik',           zh: '电费/TNB' },
  water_syabas:      { en: 'Water (SYABAS)',            ms: 'Air (SYABAS)',             zh: '水费' },
  internet_telco:    { en: 'Internet / Telco',         ms: 'Internet / Telco',         zh: '网络/电话' },
  insurance:         { en: 'Insurance / Takaful',      ms: 'Insurans / Takaful',       zh: '保险/回教保险' },
  rent_mortgage:     { en: 'Rent / Mortgage',          ms: 'Sewa / Mortgage',          zh: '租金/房贷' },
  shopee:            { en: 'Online Shopping',           ms: 'Beli Online',              zh: '网购' },
  lazada:            { en: 'Online Shopping',           ms: 'Beli Online',              zh: '网购' },  // legacy alias
  clothing:          { en: 'Clothing',                 ms: 'Pakaian',                  zh: '服装' },
  electronics:       { en: 'Electronics',              ms: 'Elektronik',               zh: '电子产品' },
  household:         { en: 'Household',                ms: 'Keperluan Rumah',          zh: '家用' },
  furniture:         { en: 'Furniture',                ms: 'Perabot',                  zh: '家具' },
  medical:           { en: 'Medical / Clinic',         ms: 'Perubatan / Klinik',       zh: '医疗/诊所' },
  pharmacy:          { en: 'Pharmacy',                 ms: 'Farmasi',                  zh: '药房' },
  gym:               { en: 'Gym / Sports',             ms: 'Gym / Sukan',              zh: '健身/运动' },
  education:         { en: 'Education',                ms: 'Pendidikan',               zh: '教育' },
  books:             { en: 'Books & Magazines',        ms: 'Buku & Majalah',           zh: '书籍/杂志' },
  entertainment:     { en: 'Entertainment',            ms: 'Hiburan',                  zh: '娱乐' },
  travel:            { en: 'Travel',                   ms: 'Pelancongan',              zh: '旅游' },
  subscription:      { en: 'Subscription',             ms: 'Langganan',                zh: '订阅服务' },
  loan_repayment:    { en: 'Loan Repayment',           ms: 'Bayar Pinjaman',           zh: '还款' },
  investment:        { en: 'Investment',               ms: 'Pelaburan',                zh: '投资' },
  savings:           { en: 'Savings',                  ms: 'Simpanan',                 zh: '储蓄' },
  other_expense:     { en: 'Others',                   ms: 'Lain-lain',                zh: '其他' },
}

// ─── Income category labels ───────────────────────────────────
const INCOME_LABEL: Record<string, Record<LangCode, string>> = {
  salary:            { en: 'Salary',                   ms: 'Gaji',                     zh: '薪资' },
  bonus:             { en: 'Bonus',                    ms: 'Bonus',                    zh: '奖金' },
  freelance:         { en: 'Freelance',                ms: 'Freelance',                zh: '自由职业' },
  business_income:   { en: 'Business Income',          ms: 'Pendapatan Perniagaan',    zh: '商业收入' },
  rental_income:     { en: 'Rental Income',            ms: 'Pendapatan Sewa',          zh: '租金收入' },
  dividend:          { en: 'Dividend',                 ms: 'Dividen',                  zh: '股息' },
  interest:          { en: 'Interest / Profit',        ms: 'Faedah / Keuntungan',      zh: '利息/利润' },
  epf_withdrawal:    { en: 'EPF Withdrawal',           ms: 'Pengeluaran KWSP',         zh: '公积金提款' },
  government_aid:    { en: 'STR / Government Aid',     ms: 'STR / Bantuan Kerajaan',   zh: '政府援助金' },
  other_income:      { en: 'Others',                   ms: 'Lain-lain',                zh: '其他收入' },
}

// ─── Expense group names ──────────────────────────────────────
// keys are the Malay group strings stored in EXPENSE_CATEGORIES
const GROUP_LABEL: Record<string, Record<LangCode, string>> = {
  'Makan & Minum':   { en: 'Food & Drink',        ms: 'Makan & Minum',    zh: '餐饮' },
  'Pengangkutan':    { en: 'Transport',            ms: 'Pengangkutan',     zh: '交通' },
  'Kewangan MY':     { en: 'MY Finance',           ms: 'Kewangan MY',      zh: '马来西亚金融' },
  'Bil & Utiliti':   { en: 'Bills & Utilities',    ms: 'Bil & Utiliti',    zh: '账单与水电' },
  'Membeli-belah':   { en: 'Shopping',             ms: 'Membeli-belah',    zh: '购物' },
  'Kesihatan':       { en: 'Health',               ms: 'Kesihatan',        zh: '医疗健康' },
  'Pendidikan':      { en: 'Education',            ms: 'Pendidikan',       zh: '教育' },
  'Hiburan':         { en: 'Entertainment',        ms: 'Hiburan',          zh: '娱乐' },
  'Kewangan':        { en: 'Financial',            ms: 'Kewangan',         zh: '金融' },
  'Lain-lain':       { en: 'Others',               ms: 'Lain-lain',        zh: '其他' },
  'Pendapatan':      { en: 'Income',               ms: 'Pendapatan',       zh: '收入' },
  'Pelaburan':       { en: 'Investment',           ms: 'Pelaburan',        zh: '投资' },
}

/**
 * Get translated label for an expense category.
 * Falls back to the original Malay label if not found.
 */
export function getExpenseCategoryLabel(category: string, lang: LangCode): string {
  return EXPENSE_LABEL[category]?.[lang] ?? EXPENSE_LABEL[category]?.['en'] ?? category
}

/**
 * Get translated label for an income category.
 */
export function getIncomeCategoryLabel(category: string, lang: LangCode): string {
  return INCOME_LABEL[category]?.[lang] ?? INCOME_LABEL[category]?.['en'] ?? category
}

/**
 * Get translated label for either expense or income category.
 * Pass type = 'expense' | 'income' | 'transfer'
 */
export function getCategoryLabel(
  category: string | null | undefined,
  type: string,
  lang: LangCode,
): string {
  if (!category) return ''
  if (type === 'income') return getIncomeCategoryLabel(category, lang)
  return getExpenseCategoryLabel(category, lang)
}

/**
 * Get translated group name.
 * The `group` param is the Malay group string from EXPENSE_CATEGORIES.
 */
export function getCategoryGroupLabel(group: string, lang: LangCode): string {
  return GROUP_LABEL[group]?.[lang] ?? GROUP_LABEL[group]?.['en'] ?? group
}
