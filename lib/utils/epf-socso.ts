/**
 * Malaysian EPF (KWSP) & SOCSO/EIS contribution calculator
 * Based on official KWSP & PERKESO tables
 */

// ─── EPF ─────────────────────────────────────────────────────

/** EPF employee contribution rate: 11% of gross wages */
export function calcEpfEmployee(grossWage: number): number {
  if (grossWage <= 0) return 0
  // EPF uses the "Third Schedule" – in practice rounds to nearest RM
  return Math.round(grossWage * 0.11)
}

/** EPF employer contribution: 13% for wages ≤ RM5,000, 12% above */
export function calcEpfEmployer(grossWage: number): number {
  if (grossWage <= 0) return 0
  const rate = grossWage <= 5000 ? 0.13 : 0.12
  return Math.round(grossWage * rate)
}

// ─── SOCSO (PERKESO) ─────────────────────────────────────────

/**
 * SOCSO employee contribution (First Category – Employment Injury + Invalidity)
 * Based on the PERKESO Contribution Rate Table
 * Employee pays 0.5% of wages, capped at RM4,000/month (max RM19.75/month)
 */
export function calcSocsoEmployee(grossWage: number): number {
  if (grossWage <= 0) return 0
  const cappedWage = Math.min(grossWage, 4000)
  // SOCSO table: increments of 0.5 per RM100 wage bracket, simplified
  const raw = cappedWage * 0.005
  // Round up to nearest RM0.05 (SOCSO table granularity)
  return Math.ceil(raw * 20) / 20
}

/** SOCSO employer contribution: ~1.75% of wages (capped at RM4,000) */
export function calcSocsoEmployer(grossWage: number): number {
  if (grossWage <= 0) return 0
  const cappedWage = Math.min(grossWage, 4000)
  return Math.ceil(cappedWage * 0.0175 * 20) / 20
}

// ─── EIS (Employment Insurance System) ───────────────────────

/** EIS employee contribution: 0.2% of wages, capped at RM5,000 (max RM10/month) */
export function calcEisEmployee(grossWage: number): number {
  if (grossWage <= 0) return 0
  const cappedWage = Math.min(grossWage, 5000)
  return Math.ceil(cappedWage * 0.002 * 100) / 100
}

/** EIS employer contribution: 0.2% */
export function calcEisEmployer(grossWage: number): number {
  return calcEisEmployee(grossWage)
}

// ─── Summary ─────────────────────────────────────────────────

export interface EpfSocsoSummary {
  grossWage: number
  epfEmployee: number      // employee contributes to EPF
  epfEmployer: number      // employer contributes to EPF (informational)
  socsoEmployee: number    // SOCSO employee portion
  eisEmployee: number      // EIS employee portion
  totalDeductions: number  // epfEmployee + socsoEmployee + eisEmployee
  netTakehome: number      // grossWage - totalDeductions
}

export function calcEpfSocso(grossWage: number): EpfSocsoSummary {
  const epfEmployee = calcEpfEmployee(grossWage)
  const epfEmployer = calcEpfEmployer(grossWage)
  const socsoEmployee = calcSocsoEmployee(grossWage)
  const eisEmployee = calcEisEmployee(grossWage)
  const totalDeductions = epfEmployee + socsoEmployee + eisEmployee
  return {
    grossWage,
    epfEmployee,
    epfEmployer,
    socsoEmployee,
    eisEmployee,
    totalDeductions,
    netTakehome: grossWage - totalDeductions,
  }
}
