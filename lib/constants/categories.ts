import type { ExpenseCategory, IncomeCategory } from '@/lib/types/app.types'

export interface CategoryMeta {
  value: ExpenseCategory | IncomeCategory
  label: string
  icon: string
  group: string
}

export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  // Food & Drink
  { value: 'mamak', label: 'Mamak', icon: '🍜', group: 'Makan & Minum' },
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️', group: 'Makan & Minum' },
  { value: 'grocery', label: 'Barang Dapur', icon: '🛒', group: 'Makan & Minum' },
  { value: 'grab_food', label: 'GrabFood / Delivery', icon: '🛵', group: 'Makan & Minum' },
  { value: 'coffee', label: 'Kopi & Minuman', icon: '☕', group: 'Makan & Minum' },
  // Transport
  { value: 'tol', label: 'Tol', icon: '🛣️', group: 'Pengangkutan' },
  { value: 'grab_transport', label: 'Grab / e-Hailing', icon: '🚗', group: 'Pengangkutan' },
  { value: 'petrol', label: 'Petrol', icon: '⛽', group: 'Pengangkutan' },
  { value: 'parking', label: 'Parking', icon: '🅿️', group: 'Pengangkutan' },
  { value: 'lrt_mrt', label: 'LRT / MRT / Bus', icon: '🚇', group: 'Pengangkutan' },
  // Malaysian Finance
  { value: 'touch_n_go', label: 'Touch \'n Go / TNG', icon: '💳', group: 'Kewangan MY' },
  { value: 'epf_kwsp', label: 'KWSP / EPF', icon: '🏦', group: 'Kewangan MY' },
  { value: 'socso_perkeso', label: 'PERKESO / SOCSO', icon: '🛡️', group: 'Kewangan MY' },
  { value: 'income_tax', label: 'Cukai Pendapatan', icon: '🏛️', group: 'Kewangan MY' },
  // Bills & Utilities
  { value: 'electricity_tnb', label: 'TNB / Elektrik', icon: '⚡', group: 'Bil & Utiliti' },
  { value: 'water_syabas', label: 'Air (SYABAS/SAJ)', icon: '💧', group: 'Bil & Utiliti' },
  { value: 'internet_telco', label: 'Internet / Telco', icon: '📱', group: 'Bil & Utiliti' },
  { value: 'insurance', label: 'Insurans / Takaful', icon: '🔒', group: 'Bil & Utiliti' },
  { value: 'rent_mortgage', label: 'Sewa / Mortgage', icon: '🏠', group: 'Bil & Utiliti' },
  // Shopping
  { value: 'shopee', label: 'Shopee', icon: '🛍️', group: 'Membeli-belah' },
  { value: 'lazada', label: 'Lazada', icon: '📦', group: 'Membeli-belah' },
  { value: 'clothing', label: 'Pakaian', icon: '👗', group: 'Membeli-belah' },
  { value: 'electronics', label: 'Elektronik', icon: '💻', group: 'Membeli-belah' },
  // Health
  { value: 'medical', label: 'Perubatan / Klinik', icon: '🏥', group: 'Kesihatan' },
  { value: 'pharmacy', label: 'Farmasi', icon: '💊', group: 'Kesihatan' },
  { value: 'gym', label: 'Gym / Sukan', icon: '💪', group: 'Kesihatan' },
  // Education
  { value: 'education', label: 'Pendidikan', icon: '🎓', group: 'Pendidikan' },
  { value: 'books', label: 'Buku & Majalah', icon: '📚', group: 'Pendidikan' },
  // Entertainment
  { value: 'entertainment', label: 'Hiburan', icon: '🎬', group: 'Hiburan' },
  { value: 'travel', label: 'Pelancongan', icon: '✈️', group: 'Hiburan' },
  { value: 'subscription', label: 'Langganan (Netflix dll)', icon: '📺', group: 'Hiburan' },
  // Financial
  { value: 'loan_repayment', label: 'Bayar Pinjaman', icon: '💰', group: 'Kewangan' },
  { value: 'investment', label: 'Pelaburan', icon: '📈', group: 'Kewangan' },
  { value: 'savings', label: 'Simpanan', icon: '🏧', group: 'Kewangan' },
  // Other
  { value: 'other_expense', label: 'Lain-lain', icon: '📌', group: 'Lain-lain' },
]

export const INCOME_CATEGORIES: CategoryMeta[] = [
  { value: 'salary', label: 'Gaji', icon: '💼', group: 'Pendapatan' },
  { value: 'bonus', label: 'Bonus', icon: '🎁', group: 'Pendapatan' },
  { value: 'freelance', label: 'Freelance', icon: '💻', group: 'Pendapatan' },
  { value: 'business_income', label: 'Pendapatan Perniagaan', icon: '🏪', group: 'Pendapatan' },
  { value: 'rental_income', label: 'Pendapatan Sewa', icon: '🏠', group: 'Pendapatan' },
  { value: 'dividend', label: 'Dividen', icon: '📊', group: 'Pelaburan' },
  { value: 'interest', label: 'Faedah / Keuntungan', icon: '💹', group: 'Pelaburan' },
  { value: 'epf_withdrawal', label: 'Pengeluaran KWSP', icon: '🏦', group: 'Kewangan' },
  { value: 'government_aid', label: 'STR / Bantuan Kerajaan', icon: '🇲🇾', group: 'Kewangan' },
  { value: 'other_income', label: 'Lain-lain', icon: '📌', group: 'Lain-lain' },
]

// Group expense categories by group label
export const EXPENSE_CATEGORY_GROUPS = EXPENSE_CATEGORIES.reduce<
  Record<string, CategoryMeta[]>
>((acc, cat) => {
  if (!acc[cat.group]) acc[cat.group] = []
  acc[cat.group].push(cat)
  return acc
}, {})

// Quick lookup by value
export const EXPENSE_CATEGORY_MAP = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c])
) as Record<ExpenseCategory, CategoryMeta>

export const INCOME_CATEGORY_MAP = Object.fromEntries(
  INCOME_CATEGORIES.map((c) => [c.value, c])
) as Record<IncomeCategory, CategoryMeta>
