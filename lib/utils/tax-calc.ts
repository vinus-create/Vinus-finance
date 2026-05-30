// ─── Malaysian Income Tax Calculator (YA 2024) ───────────────
// Based on LHDN BE Form (employment income)

export interface TaxBracket {
  from: number
  to: number
  rate: number
  cumulative: number  // tax on income up to `from`
}

// YA 2024 progressive tax brackets
export const TAX_BRACKETS_2024: TaxBracket[] = [
  { from: 0,       to: 5_000,       rate: 0,    cumulative: 0 },
  { from: 5_000,   to: 20_000,      rate: 1,    cumulative: 0 },
  { from: 20_000,  to: 35_000,      rate: 3,    cumulative: 150 },
  { from: 35_000,  to: 50_000,      rate: 8,    cumulative: 600 },
  { from: 50_000,  to: 70_000,      rate: 13,   cumulative: 1_800 },
  { from: 70_000,  to: 100_000,     rate: 21,   cumulative: 4_400 },
  { from: 100_000, to: 400_000,     rate: 24,   cumulative: 10_700 },
  { from: 400_000, to: 600_000,     rate: 24.5, cumulative: 82_700 },
  { from: 600_000, to: 2_000_000,   rate: 25,   cumulative: 131_700 },
  { from: 2_000_000, to: Infinity,  rate: 30,   cumulative: 481_700 },
]

export function calcIncomeTax(chargeableIncome: number): number {
  if (chargeableIncome <= 0) return 0
  const bracket = [...TAX_BRACKETS_2024].reverse().find(b => chargeableIncome > b.from)
  if (!bracket) return 0
  const taxInBracket = (chargeableIncome - bracket.from) * (bracket.rate / 100)
  return Math.round((bracket.cumulative + taxInBracket) * 100) / 100
}

// ─── LHDN Tax Reliefs (YA 2024 BE Form) ──────────────────────

export interface ReliefMeta {
  category: string
  label: string
  cap: number | null   // null = unlimited (e.g. zakat)
  description: string
  autoFromTxn: boolean // can be auto-populated from transactions
}

export const RELIEF_META: ReliefMeta[] = [
  // Individual
  { category: 'individual_self',       label: 'Diri Sendiri',                   cap: 9_000,  description: 'Pelepasan individu asas', autoFromTxn: false },
  // Insurance & EPF
  { category: 'life_insurance_epf',    label: 'Insurans Hayat + KWSP',          cap: 7_000,  description: 'Gabungan premium insurans hayat dan caruman KWSP', autoFromTxn: true },
  { category: 'epf_voluntary',         label: 'KWSP Sukarela (i-Saraan/i-Suri)',cap: 3_000,  description: 'Caruman sukarela ke KWSP', autoFromTxn: true },
  { category: 'medical_insurance',     label: 'Insurans Perubatan & Pendidikan', cap: 3_000,  description: 'Premium insurans kesihatan/pendidikan', autoFromTxn: true },
  { category: 'private_retirement',    label: 'KWSP / PRS Sukarela',            cap: 3_000,  description: 'Skim Persaraan Swasta (PRS)', autoFromTxn: false },
  { category: 'socso_voluntary',       label: 'PERKESO Sukarela',               cap: 350,    description: 'Caruman PERKESO sukarela', autoFromTxn: true },
  // Medical
  { category: 'medical_expenses',      label: 'Perubatan Ibu Bapa',             cap: 8_000,  description: 'Kos perubatan, rawatan, perawatan ibu bapa', autoFromTxn: false },
  { category: 'serious_illness',       label: 'Penyakit Serius / OKU Diri',     cap: 10_000, description: 'Kos rawatan penyakit serius / OKU diri/pasangan/anak', autoFromTxn: true },
  { category: 'mental_health',         label: 'Kesihatan Mental',               cap: 1_000,  description: 'Kos pemeriksaan/rawatan kesihatan mental', autoFromTxn: true },
  { category: 'vaccination',           label: 'Vaksinasi Diri & Keluarga',      cap: 1_000,  description: 'Kos vaksinasi (diri, pasangan, anak)', autoFromTxn: true },
  { category: 'complete_medical_exam', label: 'Pemeriksaan Perubatan Penuh',    cap: 1_000,  description: 'Kos pemeriksaan perubatan menyeluruh', autoFromTxn: true },
  // Education
  { category: 'self_education',        label: 'Pendidikan Diri',                cap: 7_000,  description: 'Yuran pengajian/kursus peningkatan kemahiran', autoFromTxn: true },
  { category: 'sspn',                  label: 'SSPN Net Simpanan',              cap: 8_000,  description: 'Simpanan Skim Simpanan Pendidikan Nasional', autoFromTxn: false },
  // Lifestyle
  { category: 'lifestyle',             label: 'Gaya Hidup (Buku, Internet, dll)', cap: 2_500, description: 'Buku, majalah, sukan, langganan internet, komputer', autoFromTxn: true },
  { category: 'lifestyle_additional',  label: 'Gaya Hidup Tambahan (Sukan)',    cap: 1_000,  description: 'Peralatan sukan, yuran gym, pendaftaran pertandingan', autoFromTxn: true },
  { category: 'ev_charging',           label: 'Kemudahan Pengecas EV',          cap: 2_500,  description: 'Kos pemasangan kemudahan pengecas kenderaan elektrik', autoFromTxn: false },
  // Family
  { category: 'spouse',                label: 'Pasangan',                       cap: 4_000,  description: 'Pelepasan untuk pasangan (tiada pendapatan)', autoFromTxn: false },
  { category: 'child_unmarried_18',    label: 'Anak Bawah 18 Tahun',            cap: 2_000,  description: 'Setiap anak yang tidak berkahwin bawah 18 tahun', autoFromTxn: false },
  { category: 'child_student',         label: 'Anak Pelajar IPT',               cap: 8_000,  description: 'Anak yang belajar di institusi pengajian tinggi', autoFromTxn: false },
  { category: 'child_disabled',        label: 'Anak OKU',                       cap: 6_000,  description: 'Anak yang kurang upaya', autoFromTxn: false },
  { category: 'breastfeeding',         label: 'Penyusuan Susu Ibu',             cap: 1_000,  description: 'Peralatan penyusuan (anak bawah 2 tahun)', autoFromTxn: false },
  { category: 'childcare_fees',        label: 'Yuran Pusat Jagaan / Tadika',    cap: 3_000,  description: 'Yuran pusat jagaan atau tadika berdaftar', autoFromTxn: false },
  // Housing & Zakat
  { category: 'housing_loan_interest', label: 'Faedah Pinjaman Perumahan',      cap: 10_000, description: 'Faedah pinjaman rumah pertama (sewaan)', autoFromTxn: false },
  { category: 'zakat_fitrah',          label: 'Zakat / Fitrah',                 cap: null,   description: 'Zakat dan fitrah (potongan penuh)', autoFromTxn: false },
  { category: 'disabled_self',         label: 'OKU Diri Sendiri',               cap: 6_000,  description: 'Pelepasan tambahan untuk individu OKU', autoFromTxn: false },
]

export const RELIEF_MAP = Object.fromEntries(RELIEF_META.map(r => [r.category, r]))

export function totalRelief(reliefs: { category: string; claimed_amount: number }[]): number {
  return reliefs.reduce((s, r) => {
    const meta = RELIEF_MAP[r.category]
    const capped = meta?.cap != null ? Math.min(r.claimed_amount, meta.cap) : r.claimed_amount
    return s + capped
  }, 0)
}

export interface TaxSummary {
  grossIncome: number
  totalRelief: number
  chargeableIncome: number
  estimatedTax: number
  effectiveRate: number
}

export function calcTaxSummary(
  grossIncome: number,
  reliefs: { category: string; claimed_amount: number }[]
): TaxSummary {
  const relief = totalRelief(reliefs)
  const chargeable = Math.max(0, grossIncome - relief)
  const tax = calcIncomeTax(chargeable)
  return {
    grossIncome,
    totalRelief: relief,
    chargeableIncome: chargeable,
    estimatedTax: tax,
    effectiveRate: grossIncome > 0 ? (tax / grossIncome) * 100 : 0,
  }
}
