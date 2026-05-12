import { MNS } from './config'

/** Stored under `users.settings.fintracker` (single JSON object). */
export type ExpenseCycleMode = 'regular' | 'custom'

export interface FintrackerPrefs {
  expenseCycle: {
    mode: ExpenseCycleMode
    /** Custom only: cycle is previous calendar month [anchorDay] → this label month [anchorDay − 1] (e.g. 19 Apr – 18 May when viewing May). Clamped to valid calendar days. */
    anchorDay: number
  }
}

export const DEFAULT_FINTRACKER_PREFS: FintrackerPrefs = {
  expenseCycle: { mode: 'regular', anchorDay: 19 },
}

export function parseFintrackerPrefs(raw: unknown): FintrackerPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FINTRACKER_PREFS, expenseCycle: { ...DEFAULT_FINTRACKER_PREFS.expenseCycle } }
  const o = raw as Record<string, unknown>
  const ft = o.fintracker
  if (!ft || typeof ft !== 'object') return { ...DEFAULT_FINTRACKER_PREFS, expenseCycle: { ...DEFAULT_FINTRACKER_PREFS.expenseCycle } }
  const f = ft as Record<string, unknown>
  const ec = f.expenseCycle
  const mode = ec && typeof ec === 'object' && (ec as Record<string, unknown>).mode === 'custom' ? 'custom' : 'regular'
  let anchorDay = 19
  if (ec && typeof ec === 'object') {
    const n = Number((ec as Record<string, unknown>).anchorDay)
    if (Number.isFinite(n)) anchorDay = Math.min(31, Math.max(1, Math.floor(n)))
  }
  if (mode === 'custom' && anchorDay < 2) anchorDay = 2
  return { expenseCycle: { mode, anchorDay } }
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** ISO date yyyy-mm-dd for local calendar (month 0 = Jan). */
function isoFromYmd(y: number, m0: number, d: number) {
  const dt = new Date(y, m0, d)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
}

/** Inclusive calendar-month range for the labelled month/year (MNS + 4-digit year). */
export function regularCycleRange(month: string, year: string): { start: string; end: string } {
  const mi = MNS.indexOf(month as (typeof MNS)[number])
  if (mi < 0) throw new Error('Invalid month')
  const y = parseInt(year, 10)
  if (!Number.isFinite(y)) throw new Error('Invalid year')
  const start = isoFromYmd(y, mi, 1)
  const last = new Date(y, mi + 1, 0)
  const end = isoFromYmd(last.getFullYear(), last.getMonth(), last.getDate())
  return { start, end }
}

/**
 * Custom cycle for label month M / year Y: previous month [anchorDay] → M [anchorDay − 1].
 * Example anchor 19, May 2026 → 2026-04-19 … 2026-05-18.
 */
export function customCycleRange(month: string, year: string, anchorDay: number): { start: string; end: string } {
  const mi = MNS.indexOf(month as (typeof MNS)[number])
  if (mi < 0) throw new Error('Invalid month')
  const y = parseInt(year, 10)
  if (!Number.isFinite(y)) throw new Error('Invalid year')
  const endDay = Math.max(1, anchorDay - 1)
  const end = isoFromYmd(y, mi, endDay)
  let sm = mi - 1
  let sy = y
  if (sm < 0) {
    sm = 11
    sy--
  }
  const start = isoFromYmd(sy, sm, anchorDay)
  return { start, end }
}

export function cycleDateRange(month: string, year: string, prefs: FintrackerPrefs): { start: string; end: string } {
  if (prefs.expenseCycle.mode === 'custom') {
    return customCycleRange(month, year, prefs.expenseCycle.anchorDay)
  }
  return regularCycleRange(month, year)
}

/** Subtitle under month nav (e.g. `19 Apr – 18 May` or `1 May – 31 May`). */
export function cycleSubtitle(month: string, year: string, prefs: FintrackerPrefs): string {
  try {
    const { start, end } = cycleDateRange(month, year, prefs)
    const [sy, sm, sd] = start.split('-').map(Number)
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
