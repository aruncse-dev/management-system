/**
 * Cross-module read-only aggregates.
 *
 * Everything here is SELECT-only and org-scoped. Both the fintracker dashboard
 * endpoint and the analysis MCP server import from this module, so the two can
 * never disagree about what "net worth" or "surplus" means.
 *
 * DO NOT add INSERT/UPDATE/DELETE to this file — the MCP server's read-only
 * guarantee is enforced by it importing only from here.
 *
 * Callers pass explicit date ranges rather than a month count, because a
 * "month" in fintracker is a configurable billing cycle (see the app's
 * `expenseCycle.ts`). Keeping the cycle math with the caller means the trend
 * buckets always match what the Monthly tab shows.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { getDb } from '../neon'
import { paymentSources, transactions } from '../schema/transactions'
import { savings } from '../schema/savings'
import { goldItems, goldResources } from '../schema/gold'
import { stocks, mutualFunds } from '../schema/portfolio'
import { cashLoanRepayments, cashLoans, emiLoanRepayments, emiLoans, jewelLoanRepayments, jewelLoans } from '../schema/loans'
import { subscriptions } from '../schema/subscriptions'
import { lending } from '../schema/lending'
import { normalizeToMonthly, nextRenewal, daysUntil } from '@fintracker-vault/utils'

type Db = ReturnType<typeof getDb>

/** Org scope, matching the dispatcher's legacy fallback: null org ⇒ the `org_id IS NULL` bucket. */
function scopeOf(table: { orgId: unknown }, orgId: string | null) {
  const col = table.orgId as Parameters<typeof eq>[0]
  return orgId ? eq(col, orgId) : isNull(col)
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export type CycleRange = { key: string; start: string; end: string }

export type TrendPoint = {
  key: string
  income: number
  expense: number
  savings: number
  net: number
}

/**
 * Income/expense per cycle.
 *
 * One query covering the whole span, bucketed in JS — not N round-trips, and
 * not a SQL `GROUP BY month_year` (that column is written but never read, and
 * drifts from the real cycle window for custom anchor days).
 */
export async function getIncomeExpenseTrend(
  db: Db,
  orgId: string | null,
  ranges: CycleRange[],
): Promise<TrendPoint[]> {
  if (ranges.length === 0) return []
  // Bucket by the stored cycle label, not by re-deriving a date window from the
  // live anchor day. Deriving meant that changing the anchor silently re-sliced
  // every past cycle, and that this trend could disagree with the transaction
  // list (which is filtered the same way) about which rows a cycle contains.
  const keys = ranges.map((r) => r.key)

  const rows = await db
    .select({ monthYear: transactions.monthYear, amount: transactions.amount, type: transactions.type })
    .from(transactions)
    .where(and(scopeOf(transactions, orgId), inArray(transactions.monthYear, keys)))

  return ranges.map((range) => {
    let income = 0
    let expense = 0
    let sav = 0
    for (const r of rows) {
      if (String(r.monthYear) !== range.key) continue
      const amt = num(r.amount)
      if (r.type === 'Income') income += amt
      else if (r.type === 'Expense') expense += amt
      else if (r.type === 'Savings') sav += amt
      // Transfers move money between own accounts — never income or expense.
    }
    return { key: range.key, income, expense, savings: sav, net: income - expense - sav }
  })
}

/**
 * Trailing average monthly income and expense from actuals.
 *
 * There is no expected-income setting in this app; income exists only as past
 * transactions. Cycles with zero income are excluded from the income average so
 * a not-yet-complete current cycle does not drag it down.
 */
export async function getDerivedMonthlyIncome(
  db: Db,
  orgId: string | null,
  ranges: CycleRange[],
): Promise<{ avgIncome: number; avgExpense: number; surplus: number; sampleMonths: number }> {
  const trend = await getIncomeExpenseTrend(db, orgId, ranges)
  const earning = trend.filter((t) => t.income > 0)
  const avgIncome = earning.length
    ? earning.reduce((s, t) => s + t.income, 0) / earning.length
    : 0
  const spending = trend.filter((t) => t.expense > 0 || t.savings > 0)
  const avgExpense = spending.length
    ? spending.reduce((s, t) => s + t.expense + t.savings, 0) / spending.length
    : 0
  return {
    avgIncome,
    avgExpense,
    surplus: avgIncome - avgExpense,
    sampleMonths: earning.length,
  }
}

export type LoanOutstanding = {
  id: string
  name: string
  kind: 'emi' | 'jewel' | 'cash'
  /**
   * Total still payable if the loan runs to term — principal PLUS all future
   * contracted interest. This is the "how much more money leaves my pocket"
   * figure the Loans page and net worth show.
   *
   * Never feed this to anything that applies `annualRate`: the interest is
   * already baked in, so doing so counts it twice.
   */
  outstanding: number
  /**
   * Principal still owed, with future interest stripped out. This is the
   * balance that actually accrues `annualRate`, so it is what every payoff
   * and amortization projection must be built from.
   */
  principalOutstanding: number
  annualRate: number
  monthlyPayment: number
}

/**
 * Active loans with outstanding balances.
 *
 * Deliberately mirrors the arithmetic on the Loans page so the dashboard and
 * that page reconcile:
 *  - EMI:   (emi × tenure) − (emi × paidEmis). Includes unaccrued future
 *           interest; it is a total-payable figure, not a principal balance.
 *  - Jewel: principal × (1 + rate/100) − repayments. `rate` is applied flat,
 *           with no time dimension, exactly as the page does today.
 *  - Cash:  principal − repayments. Interest-free.
 *
 * `principalOutstanding` is the same debt with future interest removed. Payoff
 * math re-applies `annualRate` itself, so handing it `outstanding` charges
 * interest on interest — every projection then came out too slow and too
 * expensive. The two figures are deliberately both returned rather than one
 * being derived at each call site, because which one is correct depends
 * entirely on whether the caller applies a rate.
 */
export async function getLoanOutstanding(
  db: Db,
  orgId: string | null,
): Promise<LoanOutstanding[]> {
  const isOpen = (status: string | null) => String(status ?? 'Ongoing') !== 'Closed'

  const [emiRows, jewelRows, cashRows, emiPays, jewelPays, cashPays] = await Promise.all([
    db.select().from(emiLoans).where(scopeOf(emiLoans, orgId)),
    db.select().from(jewelLoans).where(scopeOf(jewelLoans, orgId)),
    db.select().from(cashLoans).where(scopeOf(cashLoans, orgId)),
    // An empty list is valid: the loan then shows only its opening count.
    //
    // This read used to swallow every error into an empty list, from a time the
    // table might not have existed. It does now — but the swallow also turned a
    // permission or connection failure into "no repayments recorded", which
    // understates what has been paid and so overstates every outstanding
    // balance and payoff projection built on it. A missing table should fail
    // loudly rather than quietly produce wrong money.
    db.select().from(emiLoanRepayments).where(scopeOf(emiLoanRepayments, orgId)),
    db.select().from(jewelLoanRepayments).where(scopeOf(jewelLoanRepayments, orgId)),
    db.select().from(cashLoanRepayments).where(scopeOf(cashLoanRepayments, orgId)),
  ])

  const paidBy = (rows: { loanId: string; amount: string | null }[]) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.loanId, (m.get(r.loanId) ?? 0) + num(r.amount))
    return m
  }
  const emiPaid = paidBy(emiPays)
  const jewelPaid = paidBy(jewelPays)
  const cashPaid = paidBy(cashPays)

  const out: LoanOutstanding[] = []

  for (const r of emiRows) {
    if (!isOpen(r.status)) continue
    const emi = num(r.emiAmount)
    // `paidEmis` is the OPENING count — instalments paid before row-level
    // tracking existed — and repayment rows are everything paid since. Adding
    // them is the whole figure.
    //
    // The alternative was to fabricate a repayment row per historical
    // instalment so the sum alone was the truth, but those dates were guesses:
    // 65 invented rows sat in the repayment history looking like records of
    // payments nobody could vouch for. An opening count states plainly that the
    // detail is not known, which is the honest thing to say.
    const paid = emi * (r.paidEmis ?? 0) + (emiPaid.get(r.id) ?? 0)
    const outstanding = emi * r.tenureMonths - paid
    if (outstanding <= 0) continue
    const annualRate = num(r.rate)
    // Principal balance = present value of the instalments still to run. The
    // instalment count is derived from the rupees paid (not `paidEmis` alone)
    // so part-payments shorten the schedule instead of being ignored.
    const monthlyRate = annualRate / 12 / 100
    const instalmentsLeft = emi > 0 ? Math.max(r.tenureMonths - paid / emi, 0) : 0
    const principalOutstanding =
      monthlyRate > 0 && instalmentsLeft > 0
        ? (emi * (1 - Math.pow(1 + monthlyRate, -instalmentsLeft))) / monthlyRate
        : outstanding
    out.push({
      id: r.id,
      name: r.name,
      kind: 'emi',
      outstanding,
      principalOutstanding: Math.min(principalOutstanding, outstanding),
      annualRate,
      monthlyPayment: emi,
    })
  }

  for (const r of jewelRows) {
    if (!isOpen(r.status)) continue
    const principal = num(r.principal)
    const repaid = jewelPaid.get(r.id) ?? 0
    const outstanding = principal * (1 + num(r.rate) / 100) - repaid
    if (outstanding <= 0) continue
    out.push({
      id: r.id,
      name: r.name,
      kind: 'jewel',
      outstanding,
      // Repayments are treated as principal-first, so the interest-bearing
      // balance falls as they land.
      principalOutstanding: Math.min(Math.max(principal - repaid, 0), outstanding),
      annualRate: num(r.rate),
      monthlyPayment: 0,
    })
  }

  for (const r of cashRows) {
    if (!isOpen(r.status)) continue
    const outstanding = num(r.amountReceived) - (cashPaid.get(r.id) ?? 0)
    if (outstanding <= 0) continue
    out.push({
      id: r.id,
      name: r.personName,
      kind: 'cash',
      outstanding,
      // Interest-free, so the two bases are the same figure.
      principalOutstanding: outstanding,
      annualRate: 0,
      monthlyPayment: 0,
    })
  }

  return out
}

export type NetWorth = {
  assets: { savings: number; gold: number; stocks: number; mutualFunds: number; total: number }
  liabilities: { emi: number; jewel: number; cash: number; total: number }
  net: number
}

/**
 * Assets minus liabilities.
 *
 * `goldRatePerGram` comes from the caller's settings (there is no rate table).
 * Gold excludes items whose location resource is flagged `skip` — matching the
 * gold page's "estimated personal value".
 */
export async function getNetWorth(
  db: Db,
  orgId: string | null,
  opts: { goldRatePerGram: number },
): Promise<NetWorth> {
  const [savingsRows, items, resources, stockRows, mfRows, loans] = await Promise.all([
    db
      .select({ amount: savings.amount, type: savings.type })
      .from(savings)
      .where(scopeOf(savings, orgId)),
    db.select().from(goldItems).where(scopeOf(goldItems, orgId)),
    db.select().from(goldResources).where(scopeOf(goldResources, orgId)),
    db.select({ qty: stocks.qty, lastPrice: stocks.lastPrice }).from(stocks).where(scopeOf(stocks, orgId)),
    db
      .select({ currentValue: mutualFunds.currentValue })
      .from(mutualFunds)
      .where(scopeOf(mutualFunds, orgId)),
    getLoanOutstanding(db, orgId),
  ])

  // Transfers move between own accounts and net to zero across the book.
  const savingsTotal = savingsRows.reduce((sum, r) => {
    const t = String(r.type).toUpperCase()
    if (t === 'INCOME') return sum + num(r.amount)
    if (t === 'EXPENSE') return sum - num(r.amount)
    return sum
  }, 0)

  const skipped = new Set(resources.filter((r) => r.skip).map((r) => r.id))
  const grams = items.reduce(
    (sum, i) => (i.locationId && skipped.has(i.locationId) ? sum : sum + num(i.weightG)),
    0,
  )
  const goldTotal = grams * opts.goldRatePerGram

  const stocksTotal = stockRows.reduce((s, r) => s + num(r.qty) * num(r.lastPrice), 0)
  const mfTotal = mfRows.reduce((s, r) => s + num(r.currentValue), 0)

  const byKind = (kind: LoanOutstanding['kind']) =>
    loans.filter((l) => l.kind === kind).reduce((s, l) => s + l.outstanding, 0)

  const assetsTotal = savingsTotal + goldTotal + stocksTotal + mfTotal
  const liabilities = { emi: byKind('emi'), jewel: byKind('jewel'), cash: byKind('cash'), total: 0 }
  liabilities.total = liabilities.emi + liabilities.jewel + liabilities.cash

  return {
    assets: {
      savings: savingsTotal,
      gold: goldTotal,
      stocks: stocksTotal,
      mutualFunds: mfTotal,
      total: assetsTotal,
    },
    liabilities,
    net: assetsTotal - liabilities.total,
  }
}

export type LendingOutstanding = {
  /** Everything handed out, all time. */
  lent: number
  /** Everything received back. */
  repaid: number
  /** Still owed to the org — `lent - repaid`, floored at 0 per book. */
  outstanding: number
  /** Per book (`lending`, `vijaya-amma`, …), largest outstanding first. */
  books: { slug: string; lent: number; repaid: number; outstanding: number }[]
}

/**
 * Money lent out and not yet repaid.
 *
 * Deliberately NOT folded into `getNetWorth()`: receivables are a softer asset
 * than a bank balance, and changing net worth would silently move the figure
 * the MCP server reports. The Overview shows this alongside net worth instead.
 *
 * Negative per-book balances are floored at 0 — a book that has received more
 * than it lent is a bookkeeping artefact, not a debt the org owes.
 */
export async function getLendingOutstanding(
  db: Db,
  orgId: string | null,
): Promise<LendingOutstanding> {
  const rows = await db.select().from(lending).where(scopeOf(lending, orgId))

  const byBook = new Map<string, { lent: number; repaid: number }>()
  for (const r of rows) {
    const slug = String(r.sheetSlug || 'lending')
    const book = byBook.get(slug) ?? { lent: 0, repaid: 0 }
    const amount = num(r.amount)
    // `REPAY` is the canonical stored value and what the transaction mirror
    // writes; `RECEIVED` is a legacy alias for the same thing. Matching only
    // one of them silently drops real repayments and overstates what is owed.
    const type = String(r.type).trim().toUpperCase()
    if (type === 'LEND') book.lent += amount
    else if (type === 'REPAY' || type === 'RECEIVED') book.repaid += amount
    byBook.set(slug, book)
  }

  const books = Array.from(byBook.entries())
    .map(([slug, b]) => ({
      slug,
      lent: b.lent,
      repaid: b.repaid,
      outstanding: Math.max(0, b.lent - b.repaid),
    }))
    .sort((a, b) => b.outstanding - a.outstanding)

  return {
    lent: books.reduce((s, b) => s + b.lent, 0),
    repaid: books.reduce((s, b) => s + b.repaid, 0),
    outstanding: books.reduce((s, b) => s + b.outstanding, 0),
    books,
  }
}

export type CommittedOutflow = {
  emi: number
  subscriptions: number
  total: number
  upcomingRenewals: { name: string; amount: number; dueDate: string; daysLeft: number }[]
}

/**
 * Fixed monthly commitments: loan EMIs plus subscriptions normalised to a month.
 *
 * Both this and the subscriptions page now price plans with
 * `normalizeToMonthly` from `@fintracker-vault/utils` over `status = 'active'`
 * rows only, so the two screens agree. They used to disagree by design: the
 * page summed every row regardless of status and only counted plans whose
 * cycle was literally `monthly`.
 */
export async function getCommittedMonthlyOutflow(
  db: Db,
  orgId: string | null,
  opts: { usdToInr: number; today?: Date },
): Promise<CommittedOutflow> {
  const now = opts.today ?? new Date()
  const [loans, subs] = await Promise.all([
    getLoanOutstanding(db, orgId),
    db
      .select()
      .from(subscriptions)
      .where(and(scopeOf(subscriptions, orgId), eq(subscriptions.status, 'active'))),
  ])

  const emi = loans.reduce((s, l) => s + l.monthlyPayment, 0)

  let subsTotal = 0
  const upcomingRenewals: CommittedOutflow['upcomingRenewals'] = []

  for (const s of subs) {
    const amountInr =
      String(s.currency).toUpperCase() === 'USD' ? num(s.amount) * opts.usdToInr : num(s.amount)
    subsTotal += normalizeToMonthly(amountInr, s.billingCycle)

    const due = nextRenewal({
      startDate: String(s.startDate),
      endDate: s.endDate ? String(s.endDate) : null,
      cycle: s.billingCycle,
      autopay: Boolean(s.autopay),
      now,
    })
    if (due) {
      const daysLeft = daysUntil(due, now)
      if (daysLeft >= 0 && daysLeft <= 30) {
        upcomingRenewals.push({
          name: s.name,
          amount: amountInr,
          dueDate: toIsoDate(due),
          daysLeft,
        })
      }
    }
  }

  upcomingRenewals.sort((a, b) => a.daysLeft - b.daysLeft)
  return { emi, subscriptions: subsTotal, total: emi + subsTotal, upcomingRenewals }
}

/** Local-time ISO date, matching how `nextRenewal` parses. */
function toIsoDate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type AccountBalance = {
  /** Payment-source name — the key transactions actually match on. */
  name: string
  /** `savings_bank` | `rd` | `fd` | `cash` | `other` */
  kind: string
  /** `savings` | `monthly` | `both` */
  usedFor: string
  closedOn: string | null
  inflow: number
  outflow: number
  /** Opening balance plus every transaction ever recorded against this source. */
  balance: number
}

/**
 * All-time balance per payment account.
 *
 * The monthly dashboard derives the same shape client-side from one cycle's
 * rows (`acctFlows` in the fintracker app). This is the lifetime version, for
 * pages like `/overview` that never load transactions at all — and it is a
 * different number by design: all-time ≥ cycle-scoped except on a brand new
 * book. Each page labels which one it is showing.
 *
 * Two quirks of the existing data model that this has to honour rather than fix:
 *
 *  - **Transactions name their source** (`transactions.mode`), they do not point
 *    at `payment_sources.id`. So the fold keys by trimmed lowercase name, and an
 *    account renamed without the cascade simply stops matching its history.
 *  - **Opening balances are not a table.** They live in the fintracker settings
 *    JSON blob, keyed by account name, so the caller passes them in. Keeping
 *    them out of here is what lets the MCP server import this module without
 *    pulling app settings along.
 *
 * `Transfer` is the only two-sided type: it leaves `mode` and lands on
 * `transfer_to`. `Savings` is a legacy outflow type, counted as one.
 */
export async function getAccountBalances(
  db: Db,
  orgId: string | null,
  opts: { openingBal?: Record<string, number> } = {},
): Promise<AccountBalance[]> {
  const [sources, rows] = await Promise.all([
    db
      .select({
        name: paymentSources.name,
        kind: paymentSources.accountKind,
        usedFor: paymentSources.usedFor,
        closedOn: paymentSources.closedOn,
        isActive: paymentSources.isActive,
        sortOrder: paymentSources.sortOrder,
      })
      .from(paymentSources)
      .where(and(scopeOf(paymentSources, orgId), eq(paymentSources.sourceType, 'account'))),
    db
      .select({
        mode: transactions.mode,
        transferTo: transactions.transferTo,
        type: transactions.type,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(scopeOf(transactions, orgId)),
  ])

  const openingBal = opts.openingBal ?? {}
  const byKey = new Map<string, AccountBalance>()
  const keyOf = (v: string | null | undefined) => String(v ?? '').trim().toLowerCase()

  for (const s of sources) {
    if (s.isActive === false) continue
    byKey.set(keyOf(s.name), {
      name: s.name,
      kind: s.kind ?? 'savings_bank',
      usedFor: s.usedFor,
      closedOn: s.closedOn ? String(s.closedOn) : null,
      inflow: 0,
      outflow: 0,
      balance: num(openingBal[s.name]),
    })
  }

  for (const r of rows) {
    const amount = num(r.amount)
    if (!amount) continue
    const src = byKey.get(keyOf(r.mode))
    if (src) {
      if (r.type === 'Income') src.inflow += amount
      else src.outflow += amount
    }
    if (r.type === 'Transfer') {
      const dest = byKey.get(keyOf(r.transferTo))
      if (dest) dest.inflow += amount
    }
  }

  const out = [...byKey.values()]
  for (const a of out) a.balance = a.balance + a.inflow - a.outflow
  // Biggest first: the same order the dashboard's account sheet already uses.
  return out.sort((a, b) => b.balance - a.balance)
}
