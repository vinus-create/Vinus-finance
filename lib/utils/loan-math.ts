// ─── Loan Calculation Utilities ──────────────────────────────
// Supports: Reducing Balance, Flat Rate, Islamic (BBA/Murabahah/Tawarruq), Zero Interest

export interface AmortRow {
  month: number
  payment: number
  principal: number
  interest: number    // "profit" for Islamic
  balance: number
}

export interface CalcResult {
  monthly: number
  totalPayment: number
  totalInterest: number   // "profit" for Islamic
  rows: AmortRow[]        // first min(tenure, 12) rows
}

/**
 * Reducing Balance (Conventional)
 * Standard compound-interest amortization
 */
export function calcReducingBalance(principal: number, annualRate: number, months: number): CalcResult {
  if (months <= 0 || principal <= 0) return empty()
  const r = annualRate / 12 / 100
  const monthly = r > 0
    ? (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
    : principal / months

  let balance = principal
  const rows: AmortRow[] = []
  for (let m = 1; m <= Math.min(months, 12); m++) {
    const interest = balance * r
    const prin = Math.min(monthly - interest, balance)
    balance = Math.max(0, balance - prin)
    rows.push({ month: m, payment: monthly, principal: prin, interest, balance })
  }
  return {
    monthly: round2(monthly),
    totalPayment: round2(monthly * months),
    totalInterest: round2(monthly * months - principal),
    rows: rows.map(r => ({ ...r, payment: round2(r.payment), principal: round2(r.principal), interest: round2(r.interest), balance: round2(r.balance) })),
  }
}

/**
 * Flat Rate (Conventional or Islamic BBA/Murabahah/Tawarruq)
 * Total interest/profit = P × rate% × years; divided equally over tenure
 */
export function calcFlatRate(principal: number, annualRate: number, months: number): CalcResult {
  if (months <= 0 || principal <= 0) return empty()
  const totalProfit = principal * (annualRate / 100) * (months / 12)
  const total = principal + totalProfit
  const monthly = total / months
  const principalPer = principal / months
  const profitPer = totalProfit / months

  let balance = principal
  const rows: AmortRow[] = []
  for (let m = 1; m <= Math.min(months, 12); m++) {
    balance = Math.max(0, balance - principalPer)
    rows.push({ month: m, payment: monthly, principal: principalPer, interest: profitPer, balance })
  }
  return {
    monthly: round2(monthly),
    totalPayment: round2(total),
    totalInterest: round2(totalProfit),
    rows: rows.map(r => ({ ...r, payment: round2(r.payment), principal: round2(r.principal), interest: round2(r.interest), balance: round2(r.balance) })),
  }
}

/**
 * Zero Interest (BNPL, 0% installment)
 */
export function calcZeroInterest(principal: number, months: number): CalcResult {
  if (months <= 0 || principal <= 0) return empty()
  const monthly = principal / months
  const principalPer = monthly
  let balance = principal
  const rows: AmortRow[] = []
  for (let m = 1; m <= Math.min(months, 12); m++) {
    balance = Math.max(0, balance - principalPer)
    rows.push({ month: m, payment: monthly, principal: principalPer, interest: 0, balance })
  }
  return {
    monthly: round2(monthly),
    totalPayment: round2(principal),
    totalInterest: 0,
    rows: rows.map(r => ({ ...r, payment: round2(r.payment), principal: round2(r.principal), balance: round2(r.balance) })),
  }
}

/**
 * Full amortization schedule — all months (no cap).
 * Returns one row per month for the entire tenure.
 */
export function calcFullAmortization(
  principal: number,
  annualRate: number,
  months: number,
  method: string,
): AmortRow[] {
  if (principal <= 0 || months <= 0) return []

  switch (method) {
    case 'reducing_balance':
    case 'zero_interest':
    default: {
      const r = annualRate / 12 / 100
      const monthly = r > 0
        ? (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
        : principal / months
      let balance = principal
      const rows: AmortRow[] = []
      for (let m = 1; m <= months; m++) {
        const interest = round2(balance * r)
        const prin = round2(Math.min(monthly - interest, balance))
        balance = round2(Math.max(0, balance - prin))
        rows.push({ month: m, payment: round2(monthly), principal: prin, interest, balance })
      }
      return rows
    }
    case 'flat_rate':
    case 'islamic_bba':
    case 'islamic_murabahah':
    case 'islamic_tawarruq': {
      const totalProfit = round2(principal * (annualRate / 100) * (months / 12))
      const total = principal + totalProfit
      const monthly = round2(total / months)
      const principalPer = round2(principal / months)
      const interestPer = round2(totalProfit / months)
      let balance = principal
      const rows: AmortRow[] = []
      for (let m = 1; m <= months; m++) {
        balance = round2(Math.max(0, balance - principalPer))
        rows.push({ month: m, payment: monthly, principal: principalPer, interest: interestPer, balance })
      }
      return rows
    }
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function empty(): CalcResult {
  return { monthly: 0, totalPayment: 0, totalInterest: 0, rows: [] }
}

/** Given principal, rate, tenure — auto-pick the right formula by method */
export function calcByMethod(
  principal: number,
  annualRate: number,
  months: number,
  method: string
): CalcResult {
  switch (method) {
    case 'reducing_balance':
      return calcReducingBalance(principal, annualRate, months)
    case 'flat_rate':
    case 'islamic_bba':
    case 'islamic_murabahah':
    case 'islamic_tawarruq':
      return calcFlatRate(principal, annualRate, months)
    case 'zero_interest':
      return calcZeroInterest(principal, months)
    default:
      return calcReducingBalance(principal, annualRate, months)
  }
}

export function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Loan Action Utilities ────────────────────────────────────

export interface PaymentSplit {
  principal: number
  interest: number
}

export interface EarlySettlementResult {
  outstandingPrincipal: number
  rebate: number
  settlementAmount: number
  interestSaved: number
  method: 'reducing' | 'flat'
}

/**
 * Split this month's payment into principal and interest portions.
 * For reducing balance: interest = balance × monthly rate
 * For flat rate / Islamic: equal split throughout tenure
 */
export function calcPaymentSplit(
  outstandingBalance: number,
  principalAmount: number,
  interestRate: number,
  monthlyPayment: number,
  tenureMonths: number,
  interestMethod: string
): PaymentSplit {
  switch (interestMethod) {
    case 'reducing_balance': {
      const r = interestRate / 12 / 100
      const interest = round2(outstandingBalance * r)
      const principal = round2(Math.max(0, monthlyPayment - interest))
      return { principal, interest }
    }
    case 'flat_rate':
    case 'islamic_bba':
    case 'islamic_murabahah':
    case 'islamic_tawarruq': {
      const principal = round2(principalAmount / tenureMonths)
      const interest = round2(Math.max(0, monthlyPayment - principal))
      return { principal, interest }
    }
    case 'zero_interest':
    default:
      return { principal: round2(monthlyPayment), interest: 0 }
  }
}

/**
 * Calculate early settlement figures.
 * Reducing balance: settlement = outstanding balance (no rebate).
 * Flat rate / Islamic: Rule of 78 rebate on remaining interest.
 */
export function calcEarlySettlement(
  outstandingBalance: number,
  principalAmount: number,
  monthlyPayment: number,
  tenureMonths: number,
  remainingMonths: number,
  interestMethod: string
): EarlySettlementResult {
  switch (interestMethod) {
    case 'flat_rate':
    case 'islamic_bba':
    case 'islamic_murabahah':
    case 'islamic_tawarruq': {
      const n = tenureMonths
      const r = remainingMonths
      const totalInterest = round2(monthlyPayment * n - principalAmount)
      // Rule of 78: rebate = totalInterest × r(r+1) / n(n+1)
      const rebate = round2(totalInterest * (r * (r + 1)) / (n * (n + 1)))
      const remainingInterest = round2(monthlyPayment * r - outstandingBalance)
      const settlementAmount = round2(Math.max(outstandingBalance, monthlyPayment * r - rebate))
      const interestSaved = round2(Math.max(0, rebate))
      return {
        outstandingPrincipal: outstandingBalance,
        rebate,
        settlementAmount,
        interestSaved,
        method: 'flat',
      }
    }
    default: {
      // Reducing balance & zero interest: settlement = current outstanding
      return {
        outstandingPrincipal: outstandingBalance,
        rebate: 0,
        settlementAmount: outstandingBalance,
        interestSaved: 0,
        method: 'reducing',
      }
    }
  }
}

/**
 * Recalculate outstanding balance after N months paid.
 * Used when user manually adjusts the months-paid counter.
 */
export function calcBalanceAtMonth(
  principalAmount: number,
  interestRate: number,
  monthlyPayment: number,
  tenureMonths: number,
  monthsPaid: number,
  interestMethod: string
): number {
  const paid = Math.max(0, Math.min(monthsPaid, tenureMonths))
  switch (interestMethod) {
    case 'reducing_balance': {
      const r = interestRate / 12 / 100
      let balance = principalAmount
      for (let i = 0; i < paid; i++) {
        const interest = balance * r
        balance = Math.max(0, balance - (monthlyPayment - interest))
      }
      return round2(balance)
    }
    case 'flat_rate':
    case 'islamic_bba':
    case 'islamic_murabahah':
    case 'islamic_tawarruq': {
      const principalPerMonth = principalAmount / tenureMonths
      return round2(Math.max(0, principalAmount - principalPerMonth * paid))
    }
    case 'zero_interest':
    default:
      return round2(Math.max(0, principalAmount - (principalAmount / tenureMonths) * paid))
  }
}

/** Advance a YYYY-MM-DD date by N months */
export function advanceMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}
