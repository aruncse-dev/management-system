/**
 * Reminders: what is about to be debited, and whether the account it comes out
 * of can cover it.
 *
 * Built entirely from the dashboard summary the app already fetches (renewals
 * plus all-time account balances), so it costs no extra request.
 */
import type { AccountBalanceRow, DashboardSummary } from '../api'

/** A due is "imminent" — worth a notification and a balance check — within this many days. */
export const ALERT_DAYS = 2
/** The dashboard card lists anything due within this window. */
export const SHOW_DAYS = 7

type Renewal = DashboardSummary['committed']['upcomingRenewals'][number]

export type DueItem = {
  key: string
  name: string
  amount: number
  dueDate: string
  /** Negative = overdue. */
  daysLeft: number
  kind: Renewal['kind']
  paymentMethod: string
  /** The account the payment method resolved to, when it is a bank/cash account. */
  account: { name: string; balance: number } | null
}

export type LowBalanceAlert = {
  account: string
  balance: number
  /** Total of imminent dues against this account. */
  due: number
  shortfall: number
  items: DueItem[]
}

export type Reminders = {
  /** Due within `SHOW_DAYS` (or overdue), soonest first. */
  items: DueItem[]
  /** Due within `ALERT_DAYS` (or overdue). */
  imminent: DueItem[]
  lowBalance: LowBalanceAlert[]
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

const CARD_WORDS = /\b(card|credit|cc|amex|visa|mastercard|rupay)\b/

function words(s: string): string[] {
  return norm(s).split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * Match a free-text payment method ("HDFC", "HDFC Bank a/c") to an account.
 * Exact name first; otherwise a single account matched on whole words.
 * Ambiguous, credit-source or card-like methods resolve to null — a card has a
 * limit, not a balance, so a balance check would be wrong.
 */
export function matchAccount(
  method: string,
  accounts: AccountBalanceRow[],
  creditSources: readonly string[] = [],
): AccountBalanceRow | null {
  const m = norm(method)
  if (!m) return null
  // A configured card or informal credit, or anything that reads like a card,
  // is charged against a limit — never balance-check it against a bank account.
  if (creditSources.some(c => norm(c) === m) || CARD_WORDS.test(m)) return null
  const open = accounts.filter(a => !a.closedOn)
  const exact = open.find(a => norm(a.name) === m)
  if (exact) return exact
  // Whole words only: every word of the account name appears in the method
  // ("HDFC Bank" in "HDFC Bank a/c"), or the reverse.
  const mw = new Set(words(m))
  const loose = open.filter(a => {
    const aw = words(a.name)
    if (!aw.length) return false
    const amw = new Set(aw)
    return aw.every(w => mw.has(w)) || [...mw].every(w => amw.has(w))
  })
  return loose.length === 1 ? loose[0] : null
}

export function buildReminders(
  summary: Pick<DashboardSummary, 'committed' | 'accounts'> | null,
  creditSources: readonly string[] = [],
): Reminders {
  if (!summary) return { items: [], imminent: [], lowBalance: [] }
  const accounts = summary.accounts ?? []

  const items: DueItem[] = summary.committed.upcomingRenewals
    .filter(r => r.daysLeft <= SHOW_DAYS)
    .map(r => {
      const acct = matchAccount(r.paymentMethod ?? '', accounts, creditSources)
      return {
        key: `${r.kind}:${r.id ?? r.name}:${r.dueDate}`,
        name: r.name,
        amount: r.amount,
        dueDate: r.dueDate,
        daysLeft: r.daysLeft,
        kind: r.kind,
        paymentMethod: r.paymentMethod ?? '',
        account: acct ? { name: acct.name, balance: acct.balance } : null,
      }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const imminent = items.filter(i => i.daysLeft <= ALERT_DAYS)

  // Group imminent dues by account: two debits that each fit can still
  // overdraw the account together.
  const byAccount = new Map<string, LowBalanceAlert>()
  for (const i of imminent) {
    if (!i.account) continue
    const g = byAccount.get(i.account.name) ?? {
      account: i.account.name,
      balance: i.account.balance,
      due: 0,
      shortfall: 0,
      items: [],
    }
    g.due += i.amount
    g.items.push(i)
    byAccount.set(i.account.name, g)
  }
  const lowBalance = [...byAccount.values()]
    .map(g => ({ ...g, shortfall: Math.max(0, g.due - g.balance) }))
    .filter(g => g.shortfall > 0)
    .sort((a, b) => b.shortfall - a.shortfall)

  return { items, imminent, lowBalance }
}

/** "today", "tomorrow", "in 3 days", "2 days overdue". */
export function dueLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft} day${daysLeft === -1 ? '' : 's'} overdue`
  if (daysLeft === 0) return 'today'
  if (daysLeft === 1) return 'tomorrow'
  return `in ${daysLeft} days`
}
