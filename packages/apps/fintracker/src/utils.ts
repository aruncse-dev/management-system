import { MNS, CATEGORIES, INCOME_CATS, BUDGET_GLOBAL_MONTH_KEY } from './config'
import type { Budget, BudgetEntry, OpeningBal, Transaction } from './types'
import { formatCurrency } from '../../../shared/utils/src/formatters'

/** Legacy helper: always formats as INR (used only if something still imports `INR`). */
export function INR(n: number) {
  return formatCurrency(n, 'INR', true)
}

export function fd(s: string) {
  if (!s) return '—'
  const m = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})/)
  return m ? parseInt(m[1]) + ' ' + m[2] : s
}

export function isoDate(s: string) {
  if (!s) return ''
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (!m) return ''
  const mo = (MNS as readonly string[]).indexOf(m[2])
  if (mo < 0) return ''
  return `20${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

export function dateKey(s: string) {
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (!m) return 0
  const mo = (MNS as readonly string[]).indexOf(m[2])
  return parseInt('20' + m[3]) * 10000 + (mo + 1) * 100 + parseInt(m[1])
}

/** Accepts `BudgetEntry[]` or legacy `{ [category]: amount }` map shape. */
/** Append budget line names not already in `staticList` (stable order: static first). */
export function mergeCategoriesWithBudgetNames(staticList: readonly string[], budget: Budget): string[] {
  const seen = new Set(staticList.map(s => String(s)))
  const out = [...staticList]
  for (const e of budget) {
    const n = String(e.name ?? '').trim()
    if (n && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}

/** API / DB month key: `YYYY-MM` (e.g. May 2026 → `2026-05`). */
export function monthYearApiKey(month: string, year: string): string {
  const i = MNS.indexOf(month as (typeof MNS)[number])
  if (i < 0) throw new Error('Invalid month')
  return `${year}-${String(i + 1).padStart(2, '0')}`
}

export function expenseCategoriesWithBudget(budget: Budget): string[] {
  return mergeCategoriesWithBudgetNames(CATEGORIES, budget)
}

export function incomeCategoriesWithBudget(budget: Budget): string[] {
  return mergeCategoriesWithBudgetNames([...CATEGORIES, ...INCOME_CATS], budget)
}

export function coerceBudget(raw: unknown): Budget {
  if (Array.isArray(raw)) {
    return raw
      .map((e: unknown): BudgetEntry | null => {
        if (!e || typeof e !== 'object') return null
        const o = e as Record<string, unknown>
        const name = String(o.name ?? '').trim()
        if (!name) return null
        return {
          id: String(o.id ?? ''),
          name,
          amount: Number(o.amount) || 0,
          monthYear:
            typeof o.monthYear === 'string' && o.monthYear.trim()
              ? o.monthYear.trim()
              : BUDGET_GLOBAL_MONTH_KEY,
          startMonth: typeof o.startMonth === 'string' ? o.startMonth : null,
          endMonth: typeof o.endMonth === 'string' ? o.endMonth : null,
        }
      })
      .filter((e): e is BudgetEntry => e != null)
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([name, amount]) => ({
      id: `legacy:${name}`,
      name,
      amount: Number(amount) || 0,
      monthYear: BUDGET_GLOBAL_MONTH_KEY,
      startMonth: null,
      endMonth: null,
    }))
  }
  return []
}

export function catMap(rows: Transaction[], _budget?: Budget) {
  const cm: Record<string, number> = {}
  rows.filter(r => r.t === 'Expense').forEach(r => {
    cm[r.c] = (cm[r.c] || 0) + r.a
  })
  return cm
}

export function sumType(rows: Transaction[], type: string) {
  return rows.filter(r => r.t === type).reduce((s, r) => s + r.a, 0)
}

/** Destination label from legacy transfer `notes` (`→Cash`, `→HDFC Bank · memo`). */
export function transferNotesDestination(notes: string): string {
  const raw = String(notes || '').trim()
  const m = raw.match(/^(?:→|->)\s*(.+?)(?:\s*·\s*[\s\S]*)?$/)
  return (m?.[1] || '').trim()
}

/** Resolved transfer destination: `transferTo` column, else legacy `→…` in `notes`. */
export function transactionTransferDestination(row: Pick<Transaction, 't' | 'notes' | 'transferTo'>): string {
  if (row.t !== 'Transfer') return ''
  const col = (row.transferTo ?? '').trim()
  if (col) return col
  return transferNotesDestination(row.notes ?? '')
}

export function sumCC(rows: Transaction[], creditCardModeNames: readonly string[]) {
  return rows.filter(r => creditCardModeNames.includes(r.m)).reduce((s, r) => s + r.a, 0)
}

export function sumOtherCr(rows: Transaction[], informalCreditModeNames: readonly string[]) {
  return rows.filter(r => informalCreditModeNames.includes(r.m)).reduce((s, r) => s + r.a, 0)
}

export function budgetSummary(budget: Budget, cm: Record<string, number>) {
  const rows = budget.filter(e => e.name.trim())
  const totalBudget = rows.reduce((s, e) => s + e.amount, 0)
  const totalSpent = rows.reduce((s, e) => s + (cm[e.name] || 0), 0)
  const ovCount = rows.filter(e => (cm[e.name] || 0) > e.amount).length
  const totalOver = totalSpent > totalBudget
  const totalPct = totalBudget ? Math.min((totalSpent / totalBudget) * 100, 100) : 0
  const tCol = totalOver ? 'var(--rm)' : 'var(--gm)'
  return { totalBudget, totalSpent, ovCount, totalOver, totalPct, tCol }
}

export function acctFlows(
  rows: Transaction[],
  openingBal: OpeningBal,
  monthlyAccountNames: readonly string[],
  /** Include credit / informal names so transfer destinations resolve the same as in the UI. */
  transferParticipantNames?: readonly string[],
) {
  const nameUniverse =
    transferParticipantNames && transferParticipantNames.length > 0
      ? transferParticipantNames
      : monthlyAccountNames
  const accountByLower = Object.fromEntries(nameUniverse.map(acc => [acc.toLowerCase(), acc])) as Record<
    string,
    string
  >
  function normalizeAccount(name: string) {
    return accountByLower[String(name || '').trim().toLowerCase()] || ''
  }
  function resolvedTransferDest(row: Transaction): string {
    const dest = transactionTransferDestination(row)
    if (dest) return normalizeAccount(dest)
    const raw = String(row.notes || '').trim()
    const esc = nameUniverse.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    if (esc.length) {
      const re = new RegExp(`\\bto\\s+(${esc})\\b`, 'i')
      const m = raw.match(re)
      if (m?.[1]) return normalizeAccount(m[1])
    }
    return ''
  }

  const result: Record<string, { inflow: number; outflow: number; current: number }> = {}
  for (const acc of monthlyAccountNames) {
    let inflow = 0,
      outflow = 0
    rows.forEach(r => {
      if (r.m === acc) {
        if (r.t === 'Income') inflow += r.a
        else if (r.t === 'Expense' || r.t === 'Savings') outflow += r.a
        else if (r.t === 'Transfer') outflow += r.a
      }
      if (r.t === 'Transfer' && resolvedTransferDest(r) === acc) inflow += r.a
    })
    const opening = openingBal[acc] || 0
    result[acc] = { inflow, outflow, current: opening + inflow - outflow }
  }
  return result
}

/**
 * The cycle label that "today" falls in.
 *
 * The anchor day was hard-coded to 19 here while the real value lives in the
 * org's prefs, so an org on any other anchor got a nav that opened on the wrong
 * cycle and a summary computed for it. Callers with prefs to hand should pass
 * the anchor; the default preserves the previous behaviour for those that
 * cannot (the store initialises before settings have loaded).
 *
 * In `regular` mode there is no anchor at all — the label is just the calendar
 * month — which is why `anchorDay` is optional rather than required.
 */
export function currentMonthYear(prefs?: { expenseCycle: { mode: string; anchorDay: number } }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const day = Number(parts.find(p => p.type === 'day')!.value)
  const month = Number(parts.find(p => p.type === 'month')!.value) - 1
  const year = Number(parts.find(p => p.type === 'year')!.value)
  // In `regular` mode the label *is* the calendar month, so nothing rolls over.
  if (prefs && prefs.expenseCycle.mode !== 'custom') return { month: MNS[month], year: String(year) }
  // 29-31 cannot be an anchor: the cycle would build dates like 2026-02-31,
  // which Postgres rejects outright.
  const cycleDay = prefs
    ? Math.min(28, Math.max(2, Math.floor(prefs.expenseCycle.anchorDay)))
    : 19
  let mi = month
  let yr = year
  if (day >= cycleDay) {
    mi = (mi + 1) % 12
    if (mi === 0) yr++
  }
  return { month: MNS[mi], year: String(yr) }
}
