/**
 * Loan math. Pure functions, no I/O.
 *
 * `calculateEMI` was previously module-private in
 * `packages/apps/fintracker/src/pages/loans.tsx` (used only for one form autofill).
 * It lives here so the dashboard, the loans page and the analysis MCP all share
 * one implementation.
 *
 * Convention: `annualRate` is a percentage (12 means 12% p.a.), never a fraction.
 */

/** Reducing-balance EMI: P·i·(1+i)^n / ((1+i)^n − 1). Returns 0 for nonsense input. */
export function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0 || annualRate < 0) return 0
  const monthlyRate = annualRate / 12 / 100
  if (monthlyRate === 0) return principal / tenureMonths
  const pow = Math.pow(1 + monthlyRate, tenureMonths)
  if (!Number.isFinite(pow)) return 0
  const denominator = pow - 1
  if (denominator === 0) return principal / tenureMonths
  const emi = (principal * monthlyRate * pow) / denominator
  return Number.isFinite(emi) ? emi : 0
}

/**
 * Months to clear `outstanding` at a fixed `monthlyPayment`.
 *
 * Returns `Infinity` when the payment cannot cover accruing interest — the loan
 * never closes. Callers must handle that rather than rendering "Infinity months".
 */
export function monthsToPayoff(
  outstanding: number,
  monthlyPayment: number,
  annualRate: number,
): number {
  if (outstanding <= 0) return 0
  if (monthlyPayment <= 0) return Number.POSITIVE_INFINITY
  const monthlyRate = annualRate / 12 / 100
  if (monthlyRate <= 0) return Math.ceil(outstanding / monthlyPayment)

  const interestOnly = outstanding * monthlyRate
  if (monthlyPayment <= interestOnly) return Number.POSITIVE_INFINITY

  const n =
    -Math.log(1 - (outstanding * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate)
  return Number.isFinite(n) ? Math.ceil(n) : Number.POSITIVE_INFINITY
}

/** Monthly payment needed to clear `outstanding` in exactly `months`. */
export function requiredPaymentForMonths(
  outstanding: number,
  annualRate: number,
  months: number,
): number {
  return calculateEMI(outstanding, annualRate, months)
}

export type AmortizationRow = {
  month: number
  payment: number
  interest: number
  principal: number
  balance: number
}

/**
 * Period-by-period split of a loan.
 *
 * `extraPerMonth` models prepayment. Capped at 600 periods so a payment that
 * barely exceeds interest cannot spin forever.
 */
export function buildAmortization(
  principal: number,
  annualRate: number,
  monthlyPayment: number,
  extraPerMonth = 0,
): AmortizationRow[] {
  const rows: AmortizationRow[] = []
  if (principal <= 0 || monthlyPayment <= 0) return rows

  const monthlyRate = annualRate / 12 / 100
  const pay = monthlyPayment + Math.max(extraPerMonth, 0)
  let balance = principal

  for (let month = 1; month <= 600 && balance > 0.005; month++) {
    const interest = balance * monthlyRate
    if (pay <= interest) break // never amortises; bail rather than loop
    const payment = Math.min(pay, balance + interest)
    const principalPart = payment - interest
    balance = balance - principalPart
    rows.push({
      month,
      payment,
      interest,
      principal: principalPart,
      balance: Math.max(balance, 0),
    })
  }
  return rows
}

/** Total interest over the life of a loan at a given payment. */
export function totalInterest(
  principal: number,
  annualRate: number,
  monthlyPayment: number,
  extraPerMonth = 0,
): number {
  return buildAmortization(principal, annualRate, monthlyPayment, extraPerMonth).reduce(
    (sum, r) => sum + r.interest,
    0,
  )
}

/** Interest avoided by paying `extraPerMonth` on top of the scheduled payment. */
export function interestSaved(
  principal: number,
  annualRate: number,
  monthlyPayment: number,
  extraPerMonth: number,
): number {
  if (extraPerMonth <= 0) return 0
  const base = totalInterest(principal, annualRate, monthlyPayment)
  const faster = totalInterest(principal, annualRate, monthlyPayment, extraPerMonth)
  return Math.max(base - faster, 0)
}

export type PayoffLoan = {
  id: string
  name: string
  kind: 'emi' | 'jewel' | 'cash'
  outstanding: number
  /** Annual %. Cash loans are interest-free (0); jewel rate is flat, see note below. */
  annualRate: number
  /** Contractual monthly payment. 0 for jewel/cash, which have no schedule. */
  monthlyPayment: number
}

export type PayoffStep = PayoffLoan & {
  order: number
  /** Months from now until this loan closes, given the strategy. Infinity if never. */
  closesInMonths: number
}

/**
 * Order loans for repayment and project when each closes.
 *
 * `avalanche` targets the highest rate first (least interest paid);
 * `snowball` targets the smallest balance first (fastest first win).
 *
 * Surplus rolls forward: once a loan closes, its payment is added to the pool
 * attacking the next one.
 */
export function planPayoff(
  loans: PayoffLoan[],
  monthlySurplus: number,
  strategy: 'avalanche' | 'snowball',
): PayoffStep[] {
  const active = loans.filter((l) => l.outstanding > 0)
  const ordered = [...active].sort((a, b) =>
    strategy === 'avalanche'
      ? b.annualRate - a.annualRate || a.outstanding - b.outstanding
      : a.outstanding - b.outstanding || b.annualRate - a.annualRate,
  )

  let pool = Math.max(monthlySurplus, 0) + ordered.reduce((s, l) => s + l.monthlyPayment, 0)
  let elapsed = 0

  return ordered.map((loan, i) => {
    const months = monthsToPayoff(loan.outstanding, pool, loan.annualRate)
    if (Number.isFinite(months)) elapsed += months
    // This loan's own payment stays in the pool for the next target.
    return { ...loan, order: i + 1, closesInMonths: Number.isFinite(months) ? elapsed : months }
  })
}

/**
 * What it would take to clear everything within `months`.
 * Returns the required monthly payment and the shortfall against actual surplus.
 */
export function closeAllWithin(
  loans: PayoffLoan[],
  months: number,
  monthlySurplus: number,
): { requiredMonthly: number; availableMonthly: number; shortfall: number; feasible: boolean } {
  const requiredMonthly = loans
    .filter((l) => l.outstanding > 0)
    .reduce((sum, l) => sum + requiredPaymentForMonths(l.outstanding, l.annualRate, months), 0)
  const availableMonthly =
    Math.max(monthlySurplus, 0) + loans.reduce((s, l) => s + l.monthlyPayment, 0)
  const shortfall = Math.max(requiredMonthly - availableMonthly, 0)
  return { requiredMonthly, availableMonthly, shortfall, feasible: shortfall === 0 }
}
