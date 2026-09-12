/**
 * Billing-cycle date math.
 *
 * A fintracker "month" is not always a calendar month — an org can anchor its
 * cycle to a day (e.g. 19 Apr – 18 May is "May"). This is the single
 * implementation; `packages/apps/fintracker/src/expenseCycle.ts` re-exports
 * from here, and the analysis MCP imports it directly, so the app, the
 * dashboard endpoint and the MCP always bucket transactions identically.
 */
import { MNS } from '@fintracker-vault/config'

export type ExpenseCycleMode = 'regular' | 'custom'

export interface FintrackerPrefs {
  expenseCycle: {
    mode: ExpenseCycleMode
    /** Custom only: previous month [anchorDay] → label month [anchorDay − 1]. */
    anchorDay: number
  }
}

export const DEFAULT_FINTRACKER_PREFS: FintrackerPrefs = {
  expenseCycle: { mode: 'regular', anchorDay: 19 },
}

function defaults(): FintrackerPrefs {
  return { expenseCycle: { ...DEFAULT_FINTRACKER_PREFS.expenseCycle } }
}

/** Read prefs out of a settings JSONB blob. Unknown keys are dropped. */
export function parseFintrackerPrefs(raw: unknown): FintrackerPrefs {
  if (!raw || typeof raw !== 'object') return defaults()
  const ft = (raw as Record<string, unknown>).fintracker
  if (!ft || typeof ft !== 'object') return defaults()
  const ec = (ft as Record<string, unknown>).expenseCycle
  const mode: ExpenseCycleMode =
    ec && typeof ec === 'object' && (ec as Record<string, unknown>).mode === 'custom'
      ? 'custom'
      : 'regular'
  let anchorDay = 19
  if (ec && typeof ec === 'object') {
    const n = Number((ec as Record<string, unknown>).anchorDay)
    if (Number.isFinite(n)) anchorDay = Math.min(28, Math.max(1, Math.floor(n)))
  }
  // Custom mode ends at anchorDay − 1, so day 1 would produce an empty window.
  if (mode === 'custom' && anchorDay < 2) anchorDay = 2
  // The upper clamp is 28, not 31: an anchor of 29-31 builds a start date like
  // `2026-02-31` for February, which Postgres rejects and which surfaced as a
  // 500 on the whole month rather than as a settings validation error.
  return { expenseCycle: { mode, anchorDay } }
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const isoFromYmd = (y: number, m0: number, d: number) => `${y}-${pad2(m0 + 1)}-${pad2(d)}`

/** Inclusive calendar-month range for a labelled month/year. */
export function regularCycleRange(month: string, year: string): { start: string; end: string } {
  const mi = MNS.indexOf(month as (typeof MNS)[number])
  if (mi < 0) throw new Error('Invalid month')
  const y = parseInt(year, 10)
  if (!Number.isFinite(y)) throw new Error('Invalid year')
  const last = new Date(y, mi + 1, 0)
  return {
    start: isoFromYmd(y, mi, 1),
    end: isoFromYmd(last.getFullYear(), last.getMonth(), last.getDate()),
  }
}

/** Anchored cycle: previous month [anchorDay] → label month [anchorDay − 1]. */
export function customCycleRange(
  month: string,
  year: string,
  anchorDay: number,
): { start: string; end: string } {
  const mi = MNS.indexOf(month as (typeof MNS)[number])
  if (mi < 0) throw new Error('Invalid month')
  const y = parseInt(year, 10)
  if (!Number.isFinite(y)) throw new Error('Invalid year')
  const end = isoFromYmd(y, mi, Math.max(1, anchorDay - 1))
  let sm = mi - 1
  let sy = y
  if (sm < 0) {
    sm = 11
    sy--
  }
  return { start: isoFromYmd(sy, sm, anchorDay), end }
}

export function cycleDateRange(
  month: string,
  year: string,
  prefs: FintrackerPrefs,
): { start: string; end: string } {
  return prefs.expenseCycle.mode === 'custom'
    ? customCycleRange(month, year, prefs.expenseCycle.anchorDay)
    : regularCycleRange(month, year)
}

export function monthYearKey(month: string, year: string): string {
  const i = MNS.indexOf(month as (typeof MNS)[number])
  if (i < 0) throw new Error('Invalid month')
  return `${year}-${pad2(i + 1)}`
}

/** The last `count` cycles ending at (month, year), oldest first. */
export function buildCycleRanges(
  month: string,
  year: string,
  prefs: FintrackerPrefs,
  count: number,
): { key: string; start: string; end: string }[] {
  const mi = MNS.indexOf(month as (typeof MNS)[number])
  if (mi < 0) return []
  const y = parseInt(year, 10)
  if (!Number.isFinite(y)) return []

  const out: { key: string; start: string; end: string }[] = []
  for (let back = count - 1; back >= 0; back--) {
    const d = new Date(y, mi - back, 1)
    const m = MNS[d.getMonth()]
    const yy = String(d.getFullYear())
    try {
      const { start, end } = cycleDateRange(m, yy, prefs)
      out.push({ key: monthYearKey(m, yy), start, end })
    } catch {
      /* skip unrepresentable month */
    }
  }
  return out
}
