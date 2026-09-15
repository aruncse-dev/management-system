/**
 * Insurance premium mode math.
 *
 * A premium mode is *almost* a billing cycle, which is why this file leans on
 * `subscriptionCycle.ts` rather than copying it — that copying is exactly how
 * the subscription cycle math drifted into two disagreeing implementations
 * before it was unified.
 *
 * The one place they genuinely differ is `single`. A single-premium policy has
 * no period and no next due date, so it cannot be a `BillingCycle`:
 * `MONTHS_PER_CYCLE` and `addCycle` would have no honest answer for it. It
 * lives here instead, in a superset type, and every function below is explicit
 * about what it means.
 *
 * The other difference is what "overdue" means — see `nextPremiumDue`.
 */

import {
  type BillingCycle,
  MONTHS_PER_CYCLE,
  addCycle,
  normalizeToMonthly,
  parseLocalDate,
} from './subscriptionCycle'

/** Every recurring mode is also a `BillingCycle`; `single` is the exception. */
export type PremiumMode = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'single'

export const PREMIUM_MODES: readonly PremiumMode[] = [
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
  'single',
]

export const PREMIUM_MODE_LABELS: Record<PremiumMode, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-Yearly',
  yearly: 'Yearly',
  single: 'Single Premium',
}

/**
 * Aliases seen in real `premium_mode` values.
 *
 * The column has always been free text typed into an open field, so the same
 * mode arrives spelled several ways. Separator normalisation is handled by
 * `parseBillingCycle`; this map covers the cases that are different *words*.
 */
const PREMIUM_MODE_ALIASES: Record<string, PremiumMode> = {
  annual: 'yearly',
  annually: 'yearly',
  year: 'yearly',
  month: 'monthly',
  quarter: 'quarterly',
  semi_annual: 'half_yearly',
  semi_annually: 'half_yearly',
  halfyearly: 'half_yearly',
  single_premium: 'single',
  one_time: 'single',
  onetime: 'single',
  lump_sum: 'single',
  lumpsum: 'single',
}

/**
 * Strict parse — returns `null` rather than guessing.
 *
 * Same contract as `parseBillingCycle`: a mode nobody can read must not be
 * silently costed as monthly. Callers decide what an unknown mode means.
 */
export function parsePremiumMode(raw: string): PremiumMode | null {
  const c = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (!c) return null
  if ((PREMIUM_MODES as readonly string[]).includes(c)) return c as PremiumMode
  return PREMIUM_MODE_ALIASES[c] ?? null
}

/** Display label for a raw stored value, falling back to the raw text. */
export function premiumModeLabel(raw: string): string {
  const mode = parsePremiumMode(raw)
  return mode ? PREMIUM_MODE_LABELS[mode] : String(raw ?? '').trim()
}

/**
 * The billing cycle a mode bills on, or `null` when it does not recur.
 *
 * `single` is the only `null` for a *readable* mode — that is the whole reason
 * this function exists rather than callers casting the string.
 */
export function premiumModeToBillingCycle(mode: PremiumMode | null): BillingCycle | null {
  if (!mode || mode === 'single') return null
  return mode
}

/**
 * Cost per month, or 0 when there is no recurring cost.
 *
 * A single premium contributes **0** to a monthly commitment: it is one payment
 * that already happened (or will happen once), not money leaving every month.
 * Pricing it as monthly would inflate `/overview`'s committed total forever.
 * An unreadable mode also returns 0, for the same reason `normalizeToMonthly`
 * does — a row nobody can price must not be folded into a total as if it were
 * monthly.
 */
export function monthlyPremiumCost(amount: number, rawMode: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const cycle = premiumModeToBillingCycle(parsePremiumMode(rawMode))
  if (!cycle) return 0
  return normalizeToMonthly(amount, cycle)
}

/** `n` whole cycles past `from`. Every premium cycle is month-based, so no weekly case. */
function advanceCycles(from: Date, cycle: BillingCycle, n: number): Date {
  const next = new Date(from.getTime())
  if (n <= 0) return next
  const per = MONTHS_PER_CYCLE[cycle]
  // Guard rather than assume: a weekly cycle would be 0 months and loop forever
  // in meaning, silently returning the issue date for every policy.
  if (!per) return next
  next.setMonth(next.getMonth() + n * per)
  return next
}

export interface NextPremiumDueOpts {
  /** Policy issue date — the schedule anchor. */
  issueDate?: string | null
  maturityDate?: string | null
  /** Raw `insurance.premium_mode`. */
  premiumMode: string
  /** Premiums paid before row-level tracking existed. See `paid_premiums_opening`. */
  paidPremiumsOpening?: number
  /** Date of the most recent ledger row, or null when the ledger is empty. */
  lastPaidOn?: string | null
  /**
   * Years of premiums, when that differs from the policy term.
   *
   * Null for a regular-pay plan, where premiums run to maturity.
   */
  premiumPaymentTermYears?: number | null
  /**
   * The end date is a renewal rather than an ending.
   *
   * Health and motor cover roll over yearly, so the schedule must not stop at
   * `maturityDate`.
   */
  renews?: boolean
}

/**
 * The next premium due date, or `null` when there isn't one.
 *
 * Deliberately **not** `nextRenewal()` from `subscriptionCycle.ts`. That
 * function anchors on the start date, honours autopay, and rolls forward past a
 * lapse — which is right for a subscription, because the vendor charges whether
 * you look or not. A premium is the opposite: if you did not pay it, it is
 * *overdue*, not quietly renewed. So this returns a date in the past and lets
 * the caller show a negative `daysUntil`, which is the signal the whole feature
 * exists to surface.
 *
 * Ledger-first: once any premium has been recorded, the schedule runs from the
 * latest recorded payment rather than from the opening count. A correcting or
 * duplicate row therefore cannot push the due date forward twice.
 */
export function nextPremiumDue(opts: NextPremiumDueOpts): Date | null {
  const mode = parsePremiumMode(opts.premiumMode)
  const issue = parseLocalDate(opts.issueDate ?? null)
  const lastPaid = parseLocalDate(opts.lastPaidOn ?? null)
  const opening = Number.isFinite(opts.paidPremiumsOpening)
    ? Math.max(0, Number(opts.paidPremiumsOpening))
    : 0

  // A single premium is due once. Once anything is recorded against it — an
  // opening count or a ledger row — there is nothing further to pay.
  if (mode === 'single') {
    if (opening > 0 || lastPaid) return null
    return issue
  }

  const cycle = premiumModeToBillingCycle(mode)
  // No readable cycle, or no anchor to count from: the UI says so rather than
  // inventing a date.
  if (!cycle || !issue) return null

  const due = lastPaid ? addCycle(lastPaid, cycle) : advanceCycles(issue, cycle, opening)

  // Premiums stop at the END of the paying term, not at maturity. A limited-pay
  // plan ("pay 16, covered 25") is still active for nine more years, and
  // clamping on maturity alone would invent a premium every month of them.
  //
  // The comparison is `>=`, not `>`, because the paying term is exclusive of its
  // end anniversary: 16 years of monthly premiums from 21-May-2025 is exactly
  // 192 payments, the last on 21-Apr-2041. A `>` here lets a 193rd through on
  // 21-May-2041 — one premium that is not owed, on every limited-pay policy.
  const payTerm = Number(opts.premiumPaymentTermYears)
  if (Number.isFinite(payTerm) && payTerm > 0) {
    const lastPayable = new Date(issue.getTime())
    lastPayable.setFullYear(lastPayable.getFullYear() + payTerm)
    if (due >= lastPayable) return null
  }

  // A renewing policy has no maturity to clamp against — its end date is the
  // date it rolls over, so the schedule carries straight through it. Stopping
  // here would silence the app exactly when the renewal reminder matters.
  if (opts.renews) return due

  const maturity = parseLocalDate(opts.maturityDate ?? null)
  if (maturity && due > maturity) return null

  return due
}



/** Premiums per policy year, from the mode. `single` pays once, so 1. */
function premiumsPerYear(cycle: BillingCycle | null, mode: PremiumMode | null): number | null {
  if (mode === 'single') return 1
  if (!cycle) return null
  const months = MONTHS_PER_CYCLE[cycle]
  // Weekly is not a premium mode, but guard rather than divide by zero.
  return months ? 12 / months : null
}

export type PremiumProgress = {
  /** How many premiums fall in one policy year. */
  perYear: number
  /**
   * Total premiums payable over the paying term.
   *
   * Null when the policy renews indefinitely — health cover has no final
   * premium, so counting toward one would be inventing an end.
   */
  total: number | null
  paid: number
  /**
   * Premiums still to pay: over the whole term for a policy that ends, or over
   * the CURRENT YEAR for one that renews.
   */
  remaining: number | null
  /** When the last premium falls due. Null for a renewing policy. */
  lastPayableOn: Date | null
}

/**
 * How far through its premiums a policy is.
 *
 * Three shapes, because "how many left" is a different question for each:
 *
 *   limited pay   16 years monthly = 192 premiums, ending 2041 — a real finish
 *   regular pay   premiums run to maturity, so the term is the policy term
 *   renewing      no end at all, so the useful count is "left this year"
 *
 * Returns nulls rather than guesses when the term cannot be worked out — a
 * policy with no dates should show nothing, not a confident zero.
 */
export function premiumProgress(opts: {
  issueDate?: string | null
  maturityDate?: string | null
  premiumMode: string
  premiumPaymentTermYears?: number | null
  renews?: boolean
  paidCount?: number
}): PremiumProgress {
  const mode = parsePremiumMode(opts.premiumMode)
  const cycle = premiumModeToBillingCycle(mode)
  const perYear = premiumsPerYear(cycle, mode)
  const paid = Number.isFinite(opts.paidCount) ? Math.max(0, Number(opts.paidCount)) : 0

  if (!perYear) return { perYear: 0, total: null, paid, remaining: null, lastPayableOn: null }

  if (mode === 'single') {
    return {
      perYear: 1,
      total: 1,
      paid,
      remaining: paid > 0 ? 0 : 1,
      lastPayableOn: parseLocalDate(opts.issueDate ?? null),
    }
  }

  // A renewing policy never finishes, so the only honest count is how many are
  // left before it rolls over. `% perYear` restarts it at each renewal.
  if (opts.renews) {
    return {
      perYear,
      total: null,
      paid,
      remaining: perYear - (paid % perYear),
      lastPayableOn: null,
    }
  }

  const issue = parseLocalDate(opts.issueDate ?? null)
  const maturity = parseLocalDate(opts.maturityDate ?? null)
  const declaredTerm = Number(opts.premiumPaymentTermYears)

  // Prefer the stated paying term; otherwise premiums run to maturity.
  const termYears =
    Number.isFinite(declaredTerm) && declaredTerm > 0
      ? declaredTerm
      : issue && maturity
        ? Math.round((maturity.getTime() - issue.getTime()) / (365.2425 * 86_400_000))
        : null

  if (!termYears || termYears <= 0 || !issue) {
    return { perYear, total: null, paid, remaining: null, lastPayableOn: null }
  }

  const total = Math.round(termYears * perYear)
  // The paying term is exclusive of its end anniversary, so the final premium
  // falls one cycle before it — the same boundary `nextPremiumDue` clamps on.
  const lastPayableOn = new Date(issue.getTime())
  lastPayableOn.setMonth(lastPayableOn.getMonth() + (total - 1) * MONTHS_PER_CYCLE[cycle!])

  return { perYear, total, paid, remaining: Math.max(0, total - paid), lastPayableOn }
}

/**
 * Progress as one short string: `16 / 192`.
 *
 * A renewing policy counts within the current year instead — it has no total to
 * count toward — so twelve paid reads `0 / 12`, a fresh year rather than a
 * finished one. Formatting lives here so the two apps cannot word it
 * differently.
 */
export function premiumProgressLabel(g: PremiumProgress): string {
  if (g.total !== null) return `${g.paid} / ${g.total}`
  if (g.remaining !== null) return `${g.perYear - g.remaining} / ${g.perYear}`
  return String(g.paid)
}
