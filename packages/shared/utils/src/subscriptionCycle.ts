/**
 * Subscription billing-cycle math.
 *
 * This is the single implementation. Before it existed the same three
 * functions lived in `packages/apps/fintracker/src/pages/subscriptions.tsx`
 * and in `packages/shared/db/src/queries/analytics.ts`, and the copies
 * disagreed in four ways — autopay handling, iteration cap, UTC vs local date
 * parsing, and whether cancelled plans counted — so `/subscriptions` and
 * `/overview` printed different money for the same plans.
 *
 * NOT to be confused with `cycle.ts`, which owns the org's *expense* cycle
 * (the anchored month, e.g. 19 Apr – 18 May). That is an unrelated concept.
 */

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly'

export const BILLING_CYCLES: readonly BillingCycle[] = [
  'weekly',
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
]

/** Rupees per USD when the org has not set a rate. One value, server and client. */
export const DEFAULT_USD_TO_INR = 83

/**
 * Correction steps after the arithmetic jump below.
 *
 * The jump lands within one cycle of the target, so this only absorbs
 * month-length clamping (31 Jan + 1 month). It is not a roll-forward budget:
 * the previous implementations looped one cycle at a time and capped at 600,
 * which silently returned "no renewal" for a weekly plan anchored more than
 * ~11 years back.
 */
const MAX_CORRECTION_STEPS = 8

export const MONTHS_PER_CYCLE: Record<BillingCycle, number> = {
  weekly: 0, // handled by day arithmetic, not months
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
}

/**
 * Strict parse — returns `null` rather than guessing.
 *
 * Both previous copies used a `default:` branch that silently treated an
 * unrecognised cycle as monthly, so a `half-yearly` row was costed at 6× its
 * real monthly rate. Callers now decide what to do with an unknown cycle.
 *
 * Separators are normalised before comparing (`Half-Yearly`, `half yearly` and
 * `half_yearly` are one cycle, not three), because `insurance.premium_mode` has
 * always been free text and carries every spelling. Normalising is not
 * guessing — an unrecognised *word* still returns `null`.
 */
export function parseBillingCycle(raw: string): BillingCycle | null {
  const c = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  return (BILLING_CYCLES as readonly string[]).includes(c) ? (c as BillingCycle) : null
}

/**
 * Cost per month, normalised across cycles.
 *
 * Returns 0 for an unrecognised cycle: a row nobody can price must not be
 * folded into a total as if it were monthly.
 */
export function normalizeToMonthly(amount: number, cycle: string): number {
  const c = parseBillingCycle(cycle)
  if (!Number.isFinite(amount)) return 0
  switch (c) {
    case 'weekly':
      return (amount * 52) / 12
    case 'monthly':
      return amount
    case 'quarterly':
      return amount / 3
    case 'half_yearly':
      return amount / 6
    case 'yearly':
      return amount / 12
    default:
      return 0
  }
}

/** Parse a `YYYY-MM-DD` (or any parseable) date in LOCAL time. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const dt = new Date(raw)
  return Number.isNaN(dt.getTime()) ? null : dt
}

/** One cycle forward. An unrecognised cycle advances by a month, the safest step. */
export function addCycle(date: Date, cycle: string): Date {
  const next = new Date(date.getTime())
  switch (parseBillingCycle(cycle)) {
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'quarterly':
      next.setMonth(next.getMonth() + 3)
      break
    case 'half_yearly':
      next.setMonth(next.getMonth() + 6)
      break
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1)
      break
    default:
      next.setMonth(next.getMonth() + 1)
  }
  return next
}

export interface NextRenewalOpts {
  startDate: string
  /** Empty or null when the plan has no end. */
  endDate?: string | null
  cycle: string
  /** Without autopay a lapsed plan does not silently roll forward. */
  autopay?: boolean
  now?: Date
}

/**
 * The next billing date, or `null` when there isn't one.
 *
 * `null` is returned when the plan has already ended, when a non-autopay plan
 * has lapsed, or when the dates are unparseable. The server copy used to
 * anchor on `endDate` and then roll forward past it, so a plan that ended last
 * year reported a renewal next month.
 */
export function nextRenewal(opts: NextRenewalOpts): Date | null {
  const now = opts.now ?? new Date()
  const start = parseLocalDate(opts.startDate)
  if (!start) return null

  const end = parseLocalDate(opts.endDate ?? null)
  // An ended plan bills no more, whatever its cycle says.
  if (end && end < now) return null

  let due = end ?? addCycle(start, opts.cycle)

  if (due > now) return due
  if (!opts.autopay) return null

  // Jump most of the way in one step rather than walking cycle by cycle, then
  // correct. Walking made the cost proportional to how old the plan is.
  due = fastForward(due, now, opts.cycle)
  for (let i = 0; i < MAX_CORRECTION_STEPS && due <= now; i++) {
    due = addCycle(due, opts.cycle)
  }
  if (due <= now) return null
  if (end && due > end) return null
  return due
}

/** Advance `due` to within one cycle of `now` arithmetically. */
function fastForward(due: Date, now: Date, cycle: string): Date {
  const c = parseBillingCycle(cycle)
  if (!c || due > now) return due

  if (c === 'weekly') {
    const weekMs = 7 * 86_400_000
    const steps = Math.floor((now.getTime() - due.getTime()) / weekMs)
    if (steps <= 0) return due
    const next = new Date(due.getTime())
    next.setDate(next.getDate() + steps * 7)
    return next
  }

  const per = MONTHS_PER_CYCLE[c]
  const monthsApart =
    (now.getFullYear() - due.getFullYear()) * 12 + (now.getMonth() - due.getMonth())
  const steps = Math.floor(monthsApart / per)
  if (steps <= 0) return due
  const next = new Date(due.getTime())
  next.setMonth(next.getMonth() + steps * per)
  return next
}

/** Whole days from `now` until `date`, rounded up. */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000)
}
