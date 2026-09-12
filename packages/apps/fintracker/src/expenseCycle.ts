/**
 * Billing-cycle helpers for fintracker.
 *
 * The date math itself lives in `@fintracker-vault/utils` (`cycle.ts`) so the
 * app, the dashboard summary endpoint and the analysis MCP server all bucket
 * transactions identically. This module re-exports it and adds the two
 * app-only pieces: budget month matching and the nav subtitle.
 *
 * Prefs are stored under `organizations.settings.fintracker` when an org is
 * active, otherwise `users.settings.fintracker`.
 */
import { BUDGET_GLOBAL_MONTH_KEY, MNS } from './config'
import { cycleDateRange, type FintrackerPrefs } from '@fintracker-vault/utils'

export {
  DEFAULT_FINTRACKER_PREFS,
  buildCycleRanges,
  customCycleRange,
  cycleDateRange,
  parseFintrackerPrefs,
  regularCycleRange,
  type ExpenseCycleMode,
  type FintrackerPrefs,
} from '@fintracker-vault/utils'

const MONTH_KEY_RE = /^\d{4}-\d{2}$/

/**
 * The months a budget row applies to, as a single `[start, end]` range where
 * `null` means open-ended.
 *
 * A row's applicability used to be decided by two overlapping mechanisms:
 * `monthYear` (`__global__` = always, `YYYY-MM` = that month only) *and* the
 * `startMonth`/`endMonth` range. `monthYear` was only consulted when the range
 * was empty, so a row carrying both silently discarded its `monthYear` — two
 * fields for one job, one of them usually dead.
 *
 * The range is now the only rule. `monthYear` is read here, and nowhere else,
 * purely so rows written before that decision keep behaving as they did.
 */
export function budgetMonthRange(
  entry: { monthYear: string; startMonth: string | null; endMonth: string | null },
): { start: string | null; end: string | null } {
  const start = entry.startMonth?.trim() || null
  const end = entry.endMonth?.trim() || null
  if (start || end) return { start, end }

  // Legacy row: a concrete `monthYear` meant "this month only".
  const monthYear = entry.monthYear?.trim() || BUDGET_GLOBAL_MONTH_KEY
  if (monthYear !== BUDGET_GLOBAL_MONTH_KEY && MONTH_KEY_RE.test(monthYear)) {
    return { start: monthYear, end: monthYear }
  }
  return { start: null, end: null }
}

/**
 * Whether a budget row applies to the labelled nav month (`viewKey` = `YYYY-MM`).
 * Used so e.g. June-only budgets do not appear when viewing July (including custom credit cycles).
 */
export function budgetAppliesToLabelMonth(
  entry: { monthYear: string; startMonth: string | null; endMonth: string | null },
  viewKey: string,
): boolean {
  if (!MONTH_KEY_RE.test(viewKey)) return true
  const { start, end } = budgetMonthRange(entry)
  if (start && start > viewKey) return false
  if (end && end < viewKey) return false
  return true
}

/** Subtitle under month nav (e.g. `19 Apr – 18 May` or `1 May – 31 May 2026`). */
export function cycleSubtitle(month: string, year: string, prefs: FintrackerPrefs): string {
  try {
    const { start, end } = cycleDateRange(month, year, prefs)
    const [, sm, sd] = start.split('-').map(Number)
    const [ey, em, ed] = end.split('-').map(Number)
    const sLabel = `${sd} ${MNS[sm - 1]}`
    const eLabel = `${ed} ${MNS[em - 1]}`
    if (prefs.expenseCycle.mode === 'regular') {
      return `${sLabel} – ${eLabel} ${ey}`
    }
    return `${sLabel} – ${eLabel}`
  } catch {
    return ''
  }
}
