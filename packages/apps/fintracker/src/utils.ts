import { ACCOUNTS, CC_MODES, OTHER_CR, ALL_CR, MNS } from './config'
import type { Budget, OpeningBal, Transaction } from './types'

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

export function catIcon(cat: string) {
  const icons: Record<string, string> = {
    'Long Term Loan':'🏠','Jewel Loan':'💍','Insurance':'🛡️','SIP/Savings':'📈',
    'Emergency Fund':'🚨','Rent':'🏘️','Vijaya Amma':'👵','Staff Salary':'👷',
    'Groceries':'🛒','Rice':'🍚','Milk':'🥛','Vegetables':'🥦','Fruits':'🍎',
    'Food/Eating Out':'🍽️','Snacks':'🍿','Meat':'🥩','Education':'🎓','Kids':'👶',
    'Health & Medical':'💊','Amma':'🙏','Body Care':'🧴','Dress':'👗',
    'Entertainment':'🎬','Travel':'✈️','Gifts/Functions':'🎁','Home Care':'🏡',
    'Maintenance':'🔧','Internet/Recharge':'📱','Electricity':'⚡','Cylinder':'🔥',
    'Car':'🚗','Daily Expenses':'💰','NGO':'❤️','Others':'📦',
    'Salary':'💵','Cashback':'💳','Other Income':'💸',
    'Cash':'💵','HDFC Bank':'🏦','Wallet':'👛',
    'ICICI':'💳','HDFC':'💳','Bommi':'🤝','Ramya':'🤝',
  }
  return icons[cat] || '📌'
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
  const active = Object.entries(budget).filter(([, b]) => b > 0)
  const totalBudget = active.reduce((s, [, b]) => s + b, 0)
  const totalSpent = active.reduce((s, [c]) => s + (cm[c] || 0), 0)
  const ovCount = active.filter(([c, b]) => (cm[c] || 0) > b).length
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
