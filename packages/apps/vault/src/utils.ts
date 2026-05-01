import { ACCOUNTS, CC_MODES, OTHER_CR, ALL_CR, MNS } from './config'
import type { Budget, OpeningBal, Transaction } from './types'

export function INR(n: number) {
  const abs = Math.abs(n)
  const hasDecimals = abs % 1 !== 0
  if (hasDecimals) {
    return '₹' + abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }
  return '₹' + Math.round(abs).toLocaleString('en-IN')
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
  const result: Record<string, { inflow: number; outflow: number; current: number }> = {}
  ACCOUNTS.forEach(acc => {
    let inflow = 0, outflow = 0
    rows.forEach(r => {
      if (r.m === acc) {
        if (r.t === 'Income') inflow += r.a
        else if (r.t === 'Expense') outflow += r.a
        else if (r.t === 'Transfer') outflow += r.a
      }
      if (r.t === 'Transfer' && r.notes?.startsWith('→' + acc)) inflow += r.a
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
