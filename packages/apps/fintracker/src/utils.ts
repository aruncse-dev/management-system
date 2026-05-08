import { ACCOUNTS, CC_MODES, OTHER_CR, ALL_CR, MNS, CATEGORIES, INCOME_CATS } from './config'
import type { Budget, BudgetEntry, OpeningBal, Transaction } from './types'

export function INR(n: number) {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN')
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
  const mo = MNS.indexOf(m[2])
  if (mo < 0) return ''
  return `20${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

export function dateKey(s: string) {
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (!m) return 0
  const mo = MNS.indexOf(m[2])
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
        }
      })
      .filter((e): e is BudgetEntry => e != null)
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([name, amount]) => ({
      id: `legacy:${name}`,
      name,
      amount: Number(amount) || 0,
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

export function sumCC(rows: Transaction[]) {
  return rows.filter(r => CC_MODES.includes(r.m)).reduce((s, r) => s + r.a, 0)
}

export function sumOtherCr(rows: Transaction[]) {
  return rows.filter(r => OTHER_CR.includes(r.m)).reduce((s, r) => s + r.a, 0)
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

export function acctFlows(rows: Transaction[], openingBal: OpeningBal) {
  const accountByLower = Object.fromEntries(ACCOUNTS.map(acc => [acc.toLowerCase(), acc])) as Record<string, string>
  function normalizeAccount(name: string) {
    return accountByLower[String(name || '').trim().toLowerCase()] || ''
  }
  function transferTarget(notes: string) {
    const raw = String(notes || '').trim()
    if (!raw) return ''
    // Current format: "→Wallet · note", legacy: "-> Wallet", fallback: "... to Wallet"
    const direct = raw.match(/^(?:→|->)\s*([^·|,]+?)(?:\s*[·|,].*)?$/)
    if (direct?.[1]) return normalizeAccount(direct[1])
    const any = raw.match(/\bto\s+(cash|hdfc bank|wallet)\b/i)
    if (any?.[1]) return normalizeAccount(any[1])
    return ''
  }

  const result: Record<string, { inflow: number; outflow: number; current: number }> = {}
  ACCOUNTS.forEach(acc => {
    let inflow = 0, outflow = 0
    rows.forEach(r => {
      if (r.m === acc) {
        if (r.t === 'Income') inflow += r.a
        else if (r.t === 'Expense' || r.t === 'Savings') outflow += r.a
        else if (r.t === 'Transfer') outflow += r.a
      }
      if (r.t === 'Transfer' && transferTarget(r.notes) === acc) inflow += r.a
    })
    const opening = openingBal[acc] || 0
    result[acc] = { inflow, outflow, current: opening + inflow - outflow }
  })
  return result
}

export function currentMonthYear() {
  const now = new Date()
  const cycleDay = 19
  let mi = now.getMonth()
  let yr = now.getFullYear()
  if (now.getDate() >= cycleDay) {
    mi = (mi + 1) % 12
    if (mi === 0) yr++
  }
  return { month: MNS[mi], year: String(yr) }
}
