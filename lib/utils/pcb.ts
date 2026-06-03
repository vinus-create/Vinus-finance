/**
 * Malaysia PCB (Potongan Cukai Berjadual) monthly tax deduction calculator
 * Based on LHDN Income Tax Act 1967, YA 2024 rates
 *
 * Formula: (Annual gross - EPF 11% - Personal relief - Spouse relief) × tax rate ÷ 12
 */

// Progressive tax brackets — YA 2024
// cumBase = total tax owed at the lower bound of this bracket
const BRACKETS: Array<{ lower: number; upper: number; rate: number; cumBase: number }> = [
  { lower: 0,           upper: 5_000,       rate: 0,     cumBase: 0 },
  { lower: 5_000,       upper: 20_000,      rate: 0.01,  cumBase: 0 },
  { lower: 20_000,      upper: 35_000,      rate: 0.03,  cumBase: 150 },
  { lower: 35_000,      upper: 50_000,      rate: 0.08,  cumBase: 600 },
  { lower: 50_000,      upper: 70_000,      rate: 0.13,  cumBase: 1_800 },
  { lower: 70_000,      upper: 100_000,     rate: 0.21,  cumBase: 4_400 },
  { lower: 100_000,     upper: 400_000,     rate: 0.24,  cumBase: 10_700 },
  { lower: 400_000,     upper: 600_000,     rate: 0.245, cumBase: 82_700 },
  { lower: 600_000,     upper: 2_000_000,   rate: 0.25,  cumBase: 131_700 },
  { lower: 2_000_000,   upper: Infinity,    rate: 0.30,  cumBase: 481_700 },
]

function calcAnnualTax(chargeableIncome: number): number {
  if (chargeableIncome <= 0) return 0
  for (const b of BRACKETS) {
    if (chargeableIncome <= b.upper) {
      return b.cumBase + (chargeableIncome - b.lower) * b.rate
    }
  }
  return 0
}

export interface PcbSummary {
  grossMonthly: number
  annualGross: number
  epfDeduction: number       // 11% EPF already deducted
  personalRelief: number     // RM9,000 self
  spouseRelief: number       // RM4,000 if married
  chargeableIncome: number
  annualTax: number
  monthlyPcb: number         // rounded up to nearest RM1
}

/**
 * @param grossMonthly  Monthly gross salary (before EPF)
 * @param isMarried     Include RM4,000 spouse relief
 */
export function calcPcb(grossMonthly: number, isMarried = false): PcbSummary {
  const annualGross = grossMonthly * 12
  const epfDeduction = Math.round(annualGross * 0.11)
  const personalRelief = 9_000
  const spouseRelief = isMarried ? 4_000 : 0
  const chargeableIncome = Math.max(0, annualGross - epfDeduction - personalRelief - spouseRelief)
  const annualTax = calcAnnualTax(chargeableIncome)
  const monthlyPcb = Math.ceil(annualTax / 12)

  return {
    grossMonthly,
    annualGross,
    epfDeduction,
    personalRelief,
    spouseRelief,
    chargeableIncome,
    annualTax,
    monthlyPcb,
  }
}
