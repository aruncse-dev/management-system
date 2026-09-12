import type { NextApiRequest, NextApiResponse } from 'next'
import { and, desc, eq, isNull, lte, gte, ne, or } from 'drizzle-orm'
import type { FtSessionData } from '@fintracker-vault/auth'
import type { Transaction } from '../types'
import { MNS } from '../config'
import { currentMonthYear, isoDate } from '../utils'
import { budgetAppliesToLabelMonth, parseFintrackerPrefs } from '../expenseCycle'
import {
  getDb,
  budget,
  cashLoanRepayments,
  cashLoans,
  emiLoans,
  goldHistory,
  goldItems,
  goldResources,
  jewelLoanRepayments,
  emiLoanRepayments,
  jewelLoans,
  lending,
  mutualFunds,
  organizations,
  paymentSources,
  savings,
  stocks,
  subscriptions,
  subscriptionCharges,
  transactions,
  getIntegrationProviderBySlug,
  integrationHasCredentials,
  listOrgsForUserEmail,
  users,
  getIncomeExpenseTrend,
  getDerivedMonthlyIncome,
  getAccountBalances,
  getNetWorth,
  getCommittedMonthlyOutflow,
  getLoanOutstanding,
  type CycleRange,
} from '@fintracker-vault/db'
import { buildCycleRanges, closeAllWithin, planPayoff } from '@fintracker-vault/utils'
import { normalizeLendingSheetSlug } from './lendingSheetSlug'
import {
  loadSavingsAccountLookup,
  resolveSavingsAccountId,
  savingsAccountDisplayName,
} from './savingsAccounts'
import {
  countGoldItemsUsingResource,
  isGoldResourceType,
  loadGoldResourceLookup,
  resolveGoldResourceId,
} from './goldResources'
import {
  connectionStatusToLegacyToken,
  disconnectOrgIntegration,
  getIntegrationAuthUrl,
  getIntegrationStatus,
  requireOrgIdForIntegrations,
  syncOrgMutualFundsFromIntegrations,
  syncOrgPortfolioFromIntegrations,
  syncOrgStocksFromIntegrations,
} from './integrations'

const BUDGET_SCOPE_KEY = '__global__'

type BudgetScope = { mode: 'org'; orgId: string } | { mode: 'legacy' }

async function resolveBudgetScope(email: string, sessionOrgId: string | undefined): Promise<BudgetScope> {
  const oid = sessionOrgId?.trim()
  if (!oid) return { mode: 'legacy' }
  const orgs = await listOrgsForUserEmail(email)
  if (!orgs.some((o) => o.id === oid)) return { mode: 'legacy' }
  return { mode: 'org', orgId: oid }
}

function budgetRowsBaseWhere(scope: BudgetScope) {
  if (scope.mode === 'org') return eq(budget.orgId, scope.orgId)
  return isNull(budget.orgId)
}

/** WHERE clause for org-scoped data filtering (no user_email, only org_id). */
function whereOrgFilter(table: any, scope: BudgetScope) {
  if (scope.mode === 'org') return eq(table.orgId, scope.orgId)
  return isNull(table.orgId)
}

function normalizeBudgetMonthYearKey(raw: string): string | null {
  const s = raw.trim()
  if (s === BUDGET_SCOPE_KEY) return BUDGET_SCOPE_KEY
  if (/^\d{4}-\d{2}$/.test(s)) return s
  return null
}

function resolvePostedBudgetMonthYear(
  body: Record<string, unknown>,
): { ok: true; key: string } | { ok: false; error: string } {
  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '')
  const direct = str('monthYear') || str('budgetMonthYear')
  if (direct) {
    const n = normalizeBudgetMonthYearKey(direct)
    if (n === null) return { ok: false, error: 'Invalid monthYear (use __global__ or YYYY-MM)' }
    return { ok: true, key: n }
  }
  const month = str('month')
  const year = str('year')
  if (month && year) {
    try {
      return { ok: true, key: monthYearKey(month, year) }
    } catch {
      return { ok: false, error: 'Invalid month/year' }
    }
  }
  return { ok: true, key: BUDGET_SCOPE_KEY }
}

/** Like `resolvePostedBudgetMonthYear`, but if the body omits month fields, use `defaultKey` (e.g. existing row). */
function resolvePostedBudgetMonthYearOrDefault(
  body: Record<string, unknown>,
  defaultKey: string,
): { ok: true; key: string } | { ok: false; error: string } {
  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '')
  const hasExplicit =
    str('monthYear') !== '' ||
    str('budgetMonthYear') !== '' ||
    (str('month') !== '' && str('year') !== '')
  if (!hasExplicit) return { ok: true, key: defaultKey }
  return resolvePostedBudgetMonthYear(body)
}

function readPostedBudgetRangeMonth(
  body: Record<string, unknown>,
  key: 'startMonth' | 'endMonth',
): string | null {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return null
  const v = body[key]
  if (v === null || v === undefined) return null
  if (typeof v === 'string') {
    const t = v.trim()
    return t || null
  }
  return null
}

function budgetRangeFromMonths(
  startMonth: string | null,
  endMonth: string | null,
): { ok: true; startMonth: string | null; endMonth: string | null; monthYear: string } | { ok: false; error: string } {
  if (startMonth && !/^\d{4}-\d{2}$/.test(startMonth)) return { ok: false, error: 'Invalid startMonth (use YYYY-MM)' }
  if (endMonth && !/^\d{4}-\d{2}$/.test(endMonth)) return { ok: false, error: 'Invalid endMonth (use YYYY-MM)' }
  let monthYear = BUDGET_SCOPE_KEY
  if (startMonth === endMonth && startMonth) monthYear = startMonth
  return { ok: true, startMonth, endMonth, monthYear }
}

function resolvePostedBudgetRange(
  body: Record<string, unknown>,
): { ok: true; startMonth: string | null; endMonth: string | null; monthYear: string } | { ok: false; error: string } {
  return budgetRangeFromMonths(
    readPostedBudgetRangeMonth(body, 'startMonth'),
    readPostedBudgetRangeMonth(body, 'endMonth'),
  )
}

function resolvePostedBudgetRangeForUpdate(
  body: Record<string, unknown>,
  existing: { startMonth: string | null; endMonth: string | null; monthYear: string },
): { ok: true; startMonth: string | null; endMonth: string | null; monthYear: string } | { ok: false; error: string } {
  const hasStart = Object.prototype.hasOwnProperty.call(body, 'startMonth')
  const hasEnd = Object.prototype.hasOwnProperty.call(body, 'endMonth')
  if (!hasStart && !hasEnd) {
    return {
      ok: true,
      startMonth: existing.startMonth ?? null,
      endMonth: existing.endMonth ?? null,
      monthYear: existing.monthYear,
    }
  }
  const startMonth = hasStart
    ? readPostedBudgetRangeMonth(body, 'startMonth')
    : (existing.startMonth ?? null)
  const endMonth = hasEnd
    ? readPostedBudgetRangeMonth(body, 'endMonth')
    : (existing.endMonth ?? null)
  return budgetRangeFromMonths(startMonth, endMonth)
}

async function loadMergedBudgetForMonth(
  db: ReturnType<typeof getDb>,
  scope: BudgetScope,
  monthKey: string,
): Promise<{ id: string; name: string; amount: number; monthYear: string; startMonth: string | null; endMonth: string | null }[]> {
  const base = budgetRowsBaseWhere(scope)
  const rows = await db
    .select()
    .from(budget)
    .where(
      and(
        base,
        or(
          isNull(budget.startMonth),
          lte(budget.startMonth, monthKey)
        ),
        or(
          isNull(budget.endMonth),
          gte(budget.endMonth, monthKey)
        )
      )
    )
  const applicable = rows.filter(r =>
    budgetAppliesToLabelMonth(
      { monthYear: r.monthYear, startMonth: r.startMonth ?? null, endMonth: r.endMonth ?? null },
      monthKey,
    ),
  )
  const byCat = new Map<string, (typeof applicable)[number]>()
  for (const r of applicable) {
    const existing = byCat.get(r.category)
    if (!existing) {
      byCat.set(r.category, r)
    } else {
      const isCurrentPinned = r.startMonth === r.endMonth && r.startMonth !== null
      const isExistingPinned = existing.startMonth === existing.endMonth && existing.startMonth !== null
      if (isCurrentPinned && !isExistingPinned) {
        byCat.set(r.category, r)
      }
    }
  }
  return [...byCat.values()].map((r) => ({
    id: r.id,
    name: r.category,
    amount: num(r.amount),
    monthYear: r.monthYear,
    startMonth: r.startMonth ?? null,
    endMonth: r.endMonth ?? null,
  }))
}

function monthYearKey(month: string, year: string): string {
  const i = MNS.indexOf(month as (typeof MNS)[number])
  if (i < 0) throw new Error('Invalid month')
  return `${year}-${String(i + 1).padStart(2, '0')}`
}

function parseMonthYearKey(key: string): { month: string; year: string } | null {
  const m = key.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const mi = parseInt(m[2], 10) - 1
  if (mi < 0 || mi > 11) return null
  return { month: MNS[mi], year: m[1] }
}

function gasDateFromIso(iso: string): string {
  if (!iso) return ''
  const [y, mo, d] = iso.split('-')
  const mi = parseInt(mo, 10) - 1
  if (mi < 0 || mi > 11) return ''
  return `${d}-${MNS[mi]}-${y.slice(2)}`
}

function num(v: string | number | boolean | null | undefined): number {
  if (v === null || v === undefined || typeof v === 'boolean') return 0
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/** Largest value `numeric(10,3)` can hold: 10 digits total, 3 after the point. */
const MAX_GOLD_WEIGHT_G = 9_999_999.999

/**
 * Gold weights as a storable string, or null when unusable.
 *
 * `num()` is too permissive here — it turns unparseable input into 0 and lets
 * negatives through, both of which silently corrupt gram totals.
 */
function goldWeight(v: unknown): string | null {
  if (typeof v === 'boolean' || v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n) || n <= 0 || n > MAX_GOLD_WEIGHT_G) return null
  return String(Math.round(n * 1000) / 1000)
}

/** Trimmed non-empty string, or null. */
function reqText(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s : null
}

function readOpeningBal(settings: unknown): Record<string, number> {
  if (!settings || typeof settings !== 'object') return {}
  const raw = (settings as Record<string, unknown>).openingBal
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    const n = typeof v === 'number' ? v : parseFloat(String(v))
    if (Number.isFinite(n)) out[k] = n
  }
  return out
}

/**
 * Optional date field: an empty string is "not set", not a date.
 *
 * The forms submit '' for a cleared date, and `typeof '' === 'string'` passed
 * straight through to a `date` column, which Postgres rejects.
 */
function optionalDate(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * Module kinds a transaction can point at. A transaction carries `ref_kind` +
 * `ref_id` — a soft reference, not a foreign key — so one entry in the register
 * can also create the module's own row.
 */
const LOAN_REF_KINDS = ['jewel_loan', 'cash_loan', 'emi_loan'] as const
type LoanRefKind = (typeof LOAN_REF_KINDS)[number]

/** Savings is referenced too, but its target is an account rather than a loan. */
const SAVINGS_REF_KIND = 'savings'

/**
 * Derived-id prefix marking a module row the register created.
 *
 * The pair is addressable from either side through this alone — there is no
 * foreign key and no join table.
 */
export const MIRROR_ID_PREFIX = 'txn:'

/**
 * Lending has no per-person table — a lending row *is* one event — so the ref
 * names the book and the person instead of an existing row: `<sheetSlug>|<name>`.
 * That keeps typo-forked balances out (the name comes from a list, never typed)
 * while staying a plain soft reference.
 */
const LENDING_REF_KIND = 'lending'
const SUBSCRIPTION_REF_KIND = 'subscription'

function parseLendingRef(refId: string): { sheetSlug: string; name: string } | null {
  const idx = refId.indexOf('|')
  if (idx <= 0) return null
  const sheetSlug = refId.slice(0, idx).trim()
  const name = refId.slice(idx + 1).trim()
  return sheetSlug && name ? { sheetSlug, name } : null
}

function isLoanRefKind(k: unknown): k is LoanRefKind {
  return typeof k === 'string' && (LOAN_REF_KINDS as readonly string[]).includes(k)
}

/** All three repayment tables share one shape, so one mirror routine covers them. */
function loanRepaymentTable(kind: LoanRefKind) {
  if (kind === 'jewel_loan') return jewelLoanRepayments
  if (kind === 'cash_loan') return cashLoanRepayments
  return emiLoanRepayments
}

function readRefFromBody(body: Record<string, unknown>): { refKind: string | null; refId: string | null } {
  const kindRaw = typeof body.refKind === 'string' ? body.refKind.trim() : ''
  const idRaw = typeof body.refId === 'string' ? body.refId.trim() : ''
  if (!kindRaw || !idRaw) return { refKind: null, refId: null }
  return { refKind: kindRaw, refId: idRaw }
}

/**
 * Refusal text for editing a row the register owns.
 *
 * Amount and date on a mirrored row come from its transaction, so an edit made
 * here is overwritten the next time that transaction is saved. Deleting is
 * allowed — that unlinks the pair — but editing in place is not.
 */
const MIRROR_READONLY_MESSAGE =
  'This entry was created from a transaction. Edit it in Monthly → Transactions, or delete it here to unlink the two.'

/** The transaction id inside a mirrored row's derived id, or null if not mirrored. */
export function transactionIdFromMirrorId(id: unknown): string | null {
  const s = String(id ?? '')
  return s.startsWith(MIRROR_ID_PREFIX) ? s.slice(MIRROR_ID_PREFIX.length) : null
}

/**
 * Unlink the transaction that produced a mirrored row.
 *
 * Called when a mirrored row is deleted from the module page it appears on.
 * Clearing `ref_kind`/`ref_id` is the part that makes the deletion stick: the
 * mirror is derived state, so while the transaction still points here, the next
 * save of that transaction re-creates the row and the deletion silently undoes
 * itself.
 *
 * The transaction itself is deliberately kept. The money did leave the account
 * — that is a fact about the register — the user is only saying it should stop
 * feeding this module. Deleting spend from a screen that is not the register
 * would be far too easy to do by accident.
 *
 * A no-op for an id that is not a mirror, so callers can pass any row id.
 */
async function unlinkMirrorSource(
  db: ReturnType<typeof getDb>,
  scope: BudgetScope,
  rowId: unknown,
): Promise<void> {
  const txnId = transactionIdFromMirrorId(rowId)
  if (!txnId) return
  await db
    .update(transactions)
    .set({ refKind: null, refId: null })
    .where(and(whereOrgFilter(transactions, scope), eq(transactions.id, txnId)))
}

/**
 * Mirror a referenced transaction into the module's own ledger.
 *
 * Covers every referencable module: the three loan types, savings deposits,
 * lending, and subscription charges. The mirrored row's id is derived from the
 * transaction id (`txn:<id>`), so the pair is addressable from either side
 * without a join table or a foreign key — re-running this for the same
 * transaction updates rather than duplicates, and deleting the transaction can
 * find its mirror exactly.
 *
 * `prevRefKind` is where the mirror used to live: a user can repoint a
 * transaction from a jewel loan to an EMI loan, and the stale row has to go
 * with it.
 *
 * Direction follows the transaction type — a loan repayment or a subscription
 * charge is money leaving, lending money out is an Expense and getting it back
 * is Income — so a link that cannot represent the current type simply does not
 * mirror rather than writing something false.
 */
/**
 * A transfer whose destination is a savings-only account is a savings deposit.
 *
 * The savings ledger and the register were entirely separate: 77 savings rows,
 * ₹8.5L, and not one matching transaction. Rather than add a second dropdown
 * for something the user already chose, the existing "Transfer To" picker is
 * enough — if it names a savings account, the deposit is mirrored.
 *
 * Accounts marked `both` are deliberately excluded: those already appear in the
 * monthly balances, so mirroring them would count the same money twice.
 */
async function resolveSavingsTransferTarget(
  db: ReturnType<typeof getDb>,
  scope: BudgetScope,
  typeStr: string,
  transferTo: string | null,
): Promise<string | null> {
  if (typeStr !== 'Transfer' || !transferTo) return null
  const [src] = await db
    .select()
    .from(paymentSources)
    .where(
      and(
        whereOrgFilter(paymentSources, scope),
        eq(paymentSources.name, transferTo),
        eq(paymentSources.sourceType, 'account'),
        eq(paymentSources.usedFor, 'savings'),
      ),
    )
    .limit(1)
  return src?.id ?? null
}

/**
 * The amount a mirrored row should carry.
 *
 * A transaction records what actually left the account, which is often rounded
 * — a ₹30,316 EMI typed as ₹30,300. The module's ledger must not inherit that
 * rounding: an EMI schedule is contractual, so a rounded copy would leave the
 * loan permanently ₹16 short and the outstanding figure wrong.
 *
 * So wherever the target defines its own scheduled amount, the mirror uses it
 * and the transaction keeps its own. The rule is the same for every reference
 * kind; it simply has nothing to apply to where no schedule exists:
 *
 *   emi_loan      loan's `emi_amount`      — fixed, no part payment
 *   subscription  subscription's `amount`  — the plan price
 *   savings       account's `rd_instalment` when the account is an RD
 *   jewel/cash    none — repayments genuinely vary, so the transaction wins
 *   lending       none — every amount is its own
 */
async function scheduledAmountFor(
  db: ReturnType<typeof getDb>,
  scope: BudgetScope,
  kind: string,
  refId: string,
): Promise<number | null> {
  if (kind === 'emi_loan') {
    const [loan] = await db
      .select({ v: emiLoans.emiAmount })
      .from(emiLoans)
      .where(and(whereOrgFilter(emiLoans, scope), eq(emiLoans.id, refId)))
      .limit(1)
    const n = Number(loan?.v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  if (kind === SUBSCRIPTION_REF_KIND) {
    const [sub] = await db
      .select({ v: subscriptions.amount })
      .from(subscriptions)
      .where(and(whereOrgFilter(subscriptions, scope), eq(subscriptions.id, refId)))
      .limit(1)
    const n = Number(sub?.v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  if (kind === SAVINGS_REF_KIND) {
    const [acct] = await db
      .select({ v: paymentSources.rdInstalment })
      .from(paymentSources)
      .where(and(whereOrgFilter(paymentSources, scope), eq(paymentSources.id, refId)))
      .limit(1)
    const n = Number(acct?.v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

async function syncTransactionMirror(
  db: ReturnType<typeof getDb>,
  scope: BudgetScope,
  orgId: string | null,
  opts: {
    txnId: string
    prevRefKind: string | null
    refKind: string | null
    refId: string | null
    isoDate: string
    amount: number
    note: string
    type: string
  },
): Promise<void> {
  const prev = isLoanRefKind(opts.prevRefKind) ? opts.prevRefKind : null
  const next =
    isLoanRefKind(opts.refKind) && opts.refId && opts.type === 'Expense' && opts.amount > 0
      ? opts.refKind
      : null
  const prevSavings = opts.prevRefKind === SAVINGS_REF_KIND
  const nextSavings = opts.refKind === SAVINGS_REF_KIND && opts.refId && opts.amount > 0
  const prevLending = opts.prevRefKind === LENDING_REF_KIND
  const nextLending =
    opts.refKind === LENDING_REF_KIND &&
    opts.refId &&
    opts.amount > 0 &&
    (opts.type === 'Expense' || opts.type === 'Income')
  const prevSub = opts.prevRefKind === SUBSCRIPTION_REF_KIND
  const nextSub =
    opts.refKind === SUBSCRIPTION_REF_KIND && opts.refId && opts.amount > 0 && opts.type === 'Expense'
  if (!prev && !next && !prevSavings && !nextSavings && !prevLending && !nextLending && !prevSub && !nextSub)
    return

  const pairedId = `${MIRROR_ID_PREFIX}${opts.txnId}`

  if (prevLending) {
    await db.delete(lending).where(and(whereOrgFilter(lending, scope), eq(lending.id, pairedId)))
  }
  if (nextLending && opts.refId) {
    const target = parseLendingRef(opts.refId)
    if (target) {
      await db.insert(lending).values({
        id: pairedId,
        orgId,
        sheetSlug: target.sheetSlug,
        date: opts.isoDate,
        name: target.name,
        amount: String(opts.amount),
        // Money out is a loan given; money in is that loan coming back.
        type: opts.type === 'Income' ? 'REPAY' : 'LEND',
        description: opts.note || 'From transaction',
      })
    }
  }

  if (prevSub) {
    await db
      .delete(subscriptionCharges)
      .where(and(whereOrgFilter(subscriptionCharges, scope), eq(subscriptionCharges.id, pairedId)))
  }
  if (nextSub && opts.refId) {
    const scheduled = await scheduledAmountFor(db, scope, SUBSCRIPTION_REF_KIND, opts.refId)
    await db.insert(subscriptionCharges).values({
      id: pairedId,
      orgId,
      subscriptionId: opts.refId,
      date: opts.isoDate,
      amount: String(scheduled ?? opts.amount),
      note: opts.note || 'From transaction',
    })
  }

  if (prevSavings) {
    await db.delete(savings).where(and(whereOrgFilter(savings, scope), eq(savings.id, pairedId)))
  }
  if (nextSavings && opts.refId) {
    const scheduled = await scheduledAmountFor(db, scope, SAVINGS_REF_KIND, opts.refId)
    await db.insert(savings).values({
      id: pairedId,
      orgId,
      date: opts.isoDate,
      account: opts.refId,
      amount: String(scheduled ?? opts.amount),
      description: opts.note || 'From transaction',
      // The savings ledger sees an arrival, whatever the register calls the move.
      type: 'INCOME',
      toAccount: null,
      category: null,
    })
  }
  if (prev) {
    const table = loanRepaymentTable(prev)
    await db.delete(table).where(and(whereOrgFilter(table, scope), eq(table.id, pairedId)))
  }

  if (next && opts.refId) {
    const scheduled = await scheduledAmountFor(db, scope, next, opts.refId)
    await db.insert(loanRepaymentTable(next)).values({
      id: pairedId,
      orgId,
      loanId: opts.refId,
      date: opts.isoDate,
      amount: String(scheduled ?? opts.amount),
      note: opts.note || 'From transaction',
    })
  }
}

function readTransferToFromBody(body: Record<string, unknown>, typeStr: string): string | null {
  if (String(typeStr) !== 'Transfer') return null
  const raw =
    typeof body.transferTo === 'string'
      ? body.transferTo
      : typeof body.transfer_to === 'string'
        ? body.transfer_to
        : ''
  const t = raw.trim()
  return t.length ? t : null
}

function rowFromDb(r: typeof transactions.$inferSelect): Transaction {
  const tt = r.transferTo?.trim()
  return {
    id: r.id,
    date: gasDateFromIso(String(r.date)),
    desc: r.description,
    a: num(r.amount),
    c: r.category ?? '',
    t: r.type as Transaction['t'],
    m: r.mode ?? '',
    notes: r.notes ?? '',
    ...(tt ? { transferTo: tt } : {}),
    ...(r.refKind && r.refId ? { refKind: r.refKind, refId: r.refId } : {}),
  }
}

async function loadUserSettingsRow(db: ReturnType<typeof getDb>, email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return u ?? null
}

async function mergeUserSettings(
  db: ReturnType<typeof getDb>,
  email: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const u = await loadUserSettingsRow(db, email)
  const prev = (u?.settings && typeof u.settings === 'object' ? u.settings : {}) as Record<string, unknown>
  await db
    .update(users)
    .set({
      settings: { ...prev, ...patch },
      updatedAt: new Date(),
    })
    .where(eq(users.email, email))
}

async function loadFintrackerSettingsJson(
  db: ReturnType<typeof getDb>,
  email: string,
  scope: BudgetScope,
): Promise<Record<string, unknown>> {
  if (scope.mode === 'org') {
    const [row] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, scope.orgId))
      .limit(1)
    const s = row?.settings
    return (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
  }
  const u = await loadUserSettingsRow(db, email)
  const s = u?.settings
  return (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
}

async function mergeOrgSettings(
  db: ReturnType<typeof getDb>,
  orgId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const [row] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  const prev = (row?.settings && typeof row.settings === 'object' ? row.settings : {}) as Record<string, unknown>
  await db
    .update(organizations)
    .set({
      settings: { ...prev, ...patch },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId))
}

async function mergeFintrackerSettings(
  db: ReturnType<typeof getDb>,
  email: string,
  scope: BudgetScope,
  patch: Record<string, unknown>,
): Promise<void> {
  if (scope.mode === 'org') {
    await mergeOrgSettings(db, scope.orgId, patch)
  } else {
    await mergeUserSettings(db, email, patch)
  }
}

async function computeMonths(db: ReturnType<typeof getDb>, scope: BudgetScope) {
  const txMonths = await db
    .select({ k: transactions.monthYear })
    .from(transactions)
    .where(whereOrgFilter(transactions, scope))
    .groupBy(transactions.monthYear)
  const bMonths = await db
    .select({ k: budget.monthYear })
    .from(budget)
    .where(budgetRowsBaseWhere(scope))
    .groupBy(budget.monthYear)

  const keySet = new Set<string>()
  for (const r of txMonths) {
    if (r.k) keySet.add(r.k)
  }
  for (const r of bMonths) {
    if (r.k && r.k !== BUDGET_SCOPE_KEY) keySet.add(r.k)
  }

  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keySet.add(monthYearKey(MNS[d.getMonth()], String(d.getFullYear())))
  }
  try {
    const c = currentMonthYear()
    keySet.add(monthYearKey(c.month, c.year))
  } catch {
    /* ignore */
  }

  const refs: { month: string; year: string }[] = []
  for (const k of keySet) {
    const p = parseMonthYearKey(k)
    if (p) refs.push(p)
  }
  refs.sort((a, b) => monthYearKey(a.month, a.year).localeCompare(monthYearKey(b.month, b.year)))
  return refs
}


function ok<T>(res: NextApiResponse, data: T, traceId?: string) {
  return res.status(200).json({ ok: true as const, data, ...(traceId ? { traceId } : {}) })
}

function fail(res: NextApiResponse, status: number, error: string, traceId?: string) {
  return res.status(status).json({ ok: false as const, error, ...(traceId ? { traceId } : {}) })
}

export async function handleFintrackerMainApi(req: NextApiRequest, res: NextApiResponse, session: FtSessionData) {
  const traceId =
    typeof req.query.traceId === 'string'
      ? req.query.traceId
      : typeof req.body?.traceId === 'string'
        ? req.body.traceId
        : undefined

  let db: ReturnType<typeof getDb>
  try {
    db = getDb()
  } catch (e) {
    return fail(res, 500, e instanceof Error ? e.message : 'Database unavailable', traceId)
  }

  const emailRaw = session.email
  if (!emailRaw) {
    return fail(res, 401, 'Unauthorized', traceId)
  }
  const em = emailRaw.toLowerCase()
  const budgetScope = await resolveBudgetScope(em, session.activeOrgId)
  /** Use resolved org scope for writes (ignores stale `activeOrgId` when user is not a member). */
  const scopeOrgId = budgetScope.mode === 'org' ? budgetScope.orgId : null

  try {
    if (req.method === 'GET') {
      const action = typeof req.query.action === 'string' ? req.query.action : ''
      const mod = typeof req.query.module === 'string' ? req.query.module : ''

      if (mod === 'settings' && action === 'get') {
        const s = (await loadFintrackerSettingsJson(db, em, budgetScope)) as Record<string, string | number | boolean>
        const fintracker = parseFintrackerPrefs(s)
        return ok(res, {
          goldRate: num(s.goldRate),
          usdToInr: s.usdToInr !== undefined ? num(s.usdToInr) : undefined,
          currency: s.currency || 'INR',
          roundOff: s.roundOff !== false,
          loansSpreadsheetId: s.loansSpreadsheetId ? String(s.loansSpreadsheetId) : undefined,
          emiSheetName: s.emiSheetName ? String(s.emiSheetName) : undefined,
          expensesSheetId: s.expensesSheetId ? String(s.expensesSheetId) : undefined,
          assetsSheetId: s.assetsSheetId ? String(s.assetsSheetId) : undefined,
          fintracker,
          fintrackerJson: JSON.stringify(fintracker),
        })
      }

      if ((mod === 'integrations' || mod === 'stocks') && action === 'getTokenStatus') {
        const provider =
          typeof req.query.provider === 'string' && req.query.provider.trim()
            ? req.query.provider.trim()
            : 'upstox'
        const orgId = await requireOrgIdForIntegrations(em, session.activeOrgId)
        if (!orgId) return ok(res, { hasToken: false }, traceId)
        const status = await getIntegrationStatus(orgId, provider)
        return ok(res, connectionStatusToLegacyToken(status), traceId)
      }

      if ((mod === 'integrations' || mod === 'stocks') && action === 'getAuthUrl') {
        const provider =
          typeof req.query.provider === 'string' && req.query.provider.trim()
            ? req.query.provider.trim()
            : 'upstox'
        const orgId = await requireOrgIdForIntegrations(em, session.activeOrgId)
        if (!orgId) return fail(res, 400, 'Organization required for integrations', traceId)
        const auth = await getIntegrationAuthUrl(orgId, provider, req.headers)
        if (!auth) {
          const row = await getIntegrationProviderBySlug(provider)
          if (!row || !integrationHasCredentials(row)) {
            return fail(
              res,
              400,
              'Integration API key and secret are missing. Set them in Admin → Integrations or via INTEGRATION_<SLUG>_CLIENT_ID / _CLIENT_SECRET env.',
              traceId,
            )
          }
          return fail(res, 501, 'Integration is not configured or not enabled for this organization.', traceId)
        }
        return ok(res, { url: auth.url, redirectUri: auth.redirectUri }, traceId)
      }

      if (mod === 'lending' && action === 'getEntries') {
        const sheetRaw =
          typeof req.query.sheetName === 'string'
            ? req.query.sheetName
            : typeof req.query.sheet === 'string'
              ? req.query.sheet
              : undefined
        const book = normalizeLendingSheetSlug(sheetRaw)
        const rows = await db
          .select()
          .from(lending)
          .where(and(whereOrgFilter(lending, budgetScope), eq(lending.sheetSlug, book)))
          .orderBy(desc(lending.date))
        return ok(
          res,
          rows.map((r) => ({
            id: r.id,
            date: String(r.date),
            name: r.name,
            amount: r.amount,
            type: r.type,
            description: r.description ?? '',
          })),
        )
      }

      if (mod === 'savings' && action === 'getEntries') {
        const rows = await db.select().from(savings).where(whereOrgFilter(savings, budgetScope)).orderBy(desc(savings.date))
        const acctLookup = await loadSavingsAccountLookup(db, scopeOrgId)
        return ok(
          res,
          rows.map((r) => {
            const accountStored = String(r.account ?? '')
            const toStored = r.toAccount ? String(r.toAccount) : undefined
            return {
              id: r.id,
              date: String(r.date),
              account: accountStored,
              accountName: savingsAccountDisplayName(acctLookup, accountStored),
              amount: r.amount,
              desc: r.description ?? '',
              type: r.type,
              toAccount: toStored,
              toAccountName: toStored ? savingsAccountDisplayName(acctLookup, toStored) : undefined,
              category: r.category ?? undefined,
            }
          }),
        )
      }

      if (mod === 'gold' && action === 'getEntries') {
        const rows = await db
          .select()
          .from(goldItems)
          .where(whereOrgFilter(goldItems, budgetScope))
          .orderBy(goldItems.name)
        return ok(
          res,
          rows.map((r) => {
            const wg = num(r.weightG)
            return {
              id: r.id,
              name: r.name,
              weight_g: wg,
              person_id: r.personId ?? null,
              location_id: r.locationId ?? null,
            }
          }),
        )
      }

      if (mod === 'gold' && action === 'getResources') {
        const rawType = typeof req.query.type === 'string' ? req.query.type : undefined
        if (rawType !== undefined && !isGoldResourceType(rawType)) {
          return fail(res, 400, 'Resource type must be person or location', traceId)
        }
        const typeFilter = rawType
        const orgWhere = whereOrgFilter(goldResources, budgetScope)
        const rows = await db
          .select()
          .from(goldResources)
          .where(typeFilter ? and(orgWhere, eq(goldResources.type, typeFilter)) : orgWhere)
        return ok(
          res,
          rows.map((r) => ({
            id: r.id,
            type: r.type as 'person' | 'location',
            name: r.name,
            skip: r.skip,
            org_id: r.orgId ?? undefined,
          })),
        )
      }

      if (mod === 'gold' && action === 'getHistory') {
        const rows = await db.select().from(goldHistory).where(whereOrgFilter(goldHistory, budgetScope)).orderBy(desc(goldHistory.date))
        return ok(
          res,
          rows.map((r) => ({
            id: r.id,
            date: String(r.date),
            type: r.type as 'IN' | 'OUT',
            name: r.name,
            weight_g: num(r.weightG),
            note: r.note ?? undefined,
          })),
        )
      }

      if (mod === 'loans') {
        const typ = typeof req.query.type === 'string' ? req.query.type : ''
        if (action === 'getEntries' && typ === 'jewel') {
          const rows = await db.select().from(jewelLoans).where(whereOrgFilter(jewelLoans, budgetScope))
          return ok(
            res,
            rows.map((r) => ({
              id: r.id,
              name: r.name,
              bank: r.bank ?? '',
              principal: r.principal,
              rate: r.rate,
              start_date: String(r.startDate),
              end_date: r.endDate ? String(r.endDate) : '',
              paid_amount: r.paidAmount,
              status: r.status || 'Ongoing',
            })),
          )
        }
        if (action === 'getEntries' && typ === 'cash') {
          const rows = await db.select().from(cashLoans).where(whereOrgFilter(cashLoans, budgetScope))
          return ok(
            res,
            rows.map((r) => ({
              id: r.id,
              person_name: r.personName,
              amount_received: r.amountReceived,
              start_date: String(r.startDate),
              paid_amount: r.paidAmount,
              status: r.status || 'Ongoing',
            })),
          )
        }
        if (action === 'getEntries') {
          const rows = await db.select().from(emiLoans).where(whereOrgFilter(emiLoans, budgetScope))
          return ok(
            res,
            rows.map((r) => ({
              id: r.id,
              name: r.name,
              bank: r.bank ?? '',
              principal: r.principal,
              rate: r.rate,
              start_date: String(r.startDate),
              tenure_months: r.tenureMonths,
              emi_amount: r.emiAmount,
              paid_emis: r.paidEmis,
              status: r.status || 'Ongoing',
            })),
          )
        }
        if (action === 'getHistory' && typ === 'jewel') {
          const rows = await db
            .select()
            .from(jewelLoanRepayments)
            .where(whereOrgFilter(jewelLoanRepayments, budgetScope))
            .orderBy(desc(jewelLoanRepayments.date))
          return ok(
            res,
            rows.map((r) => ({
              id: r.id,
              loan_id: r.loanId,
              date: String(r.date),
              amount: r.amount,
              note: r.note ?? undefined,
            })),
          )
        }
        if (action === 'getHistory' && typ === 'emi') {
          const rows = await db
            .select()
            .from(emiLoanRepayments)
            .where(whereOrgFilter(emiLoanRepayments, budgetScope))
            .orderBy(desc(emiLoanRepayments.date))
          return ok(
            res,
            rows.map((r) => ({
              id: r.id,
              loan_id: r.loanId,
              date: String(r.date),
              amount: r.amount,
              note: r.note ?? undefined,
            })),
          )
        }
        if (action === 'getHistory' && typ === 'cash') {
          const rows = await db
            .select()
            .from(cashLoanRepayments)
            .where(whereOrgFilter(cashLoanRepayments, budgetScope))
            .orderBy(desc(cashLoanRepayments.date))
          return ok(
            res,
            rows.map((r) => ({
              id: r.id,
              loan_id: r.loanId,
              date: String(r.date),
              amount: r.amount,
              note: r.note ?? undefined,
            })),
          )
        }
      }


      if (mod === 'subscriptions' && action === 'getCharges') {
        // Newest first: the only question anyone asks of this list is "when was
        // this last charged, and for how much".
        const rows = await db
          .select()
          .from(subscriptionCharges)
          .where(whereOrgFilter(subscriptionCharges, budgetScope))
          .orderBy(desc(subscriptionCharges.date))
          .catch(() => [])
        return ok(
          res,
          rows.map((r) => ({
            id: r.id,
            subscription_id: r.subscriptionId,
            date: String(r.date),
            amount: r.amount,
            note: r.note ?? undefined,
          })),
        )
      }

      if (mod === 'subscriptions' && action === 'getEntries') {
        const rows = await db
          .select()
          .from(subscriptions)
          .where(whereOrgFilter(subscriptions, budgetScope))
          .orderBy(desc(subscriptions.updatedAt))
        return ok(
          res,
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            category: r.category ?? '',
            amount: r.amount,
            currency: r.currency,
            billing_cycle: r.billingCycle,
            start_date: String(r.startDate),
            end_date: r.endDate ? String(r.endDate) : '',
            autopay: Boolean(r.autopay),
            status: r.status,
            payment_method: r.paymentMethod ?? '',
            app_uuid: r.appUuid ?? undefined,
            notes: r.notes ?? '',
            updated_at: r.updatedAt.toISOString(),
          })),
        )
      }

      if (mod === 'stocks' && action === 'getHoldings') {
        const rows = await db.select().from(stocks).where(whereOrgFilter(stocks, budgetScope))
        return ok(
          res,
          rows.map((r) => ({
            providerSlug: r.providerSlug ?? '',
            symbol: r.symbol,
            company: r.company ?? '',
            isin: r.isin ?? '',
            qty: num(r.qty),
            avgPrice: num(r.avgPrice),
            lastPrice: num(r.lastPrice),
            pnl: num(r.pnl),
            dayChangePct: num(r.dayChangePct),
            synced: r.syncedAt ? r.syncedAt.toISOString() : '',
          })),
        )
      }

      if (mod === 'mutualfunds' && action === 'getHoldings') {
        const rows = await db.select().from(mutualFunds).where(whereOrgFilter(mutualFunds, budgetScope))
        return ok(
          res,
          rows.map((r) => {
            const units = num(r.units)
            const purchased = num(r.purchased)
            const currentValue = num(r.currentValue)
            const storedAvg = num(r.avgPrice)
            const storedLast = num(r.lastPrice)
            const avgPrice = storedAvg > 0 ? storedAvg : units > 0 ? purchased / units : 0
            const lastPrice = storedLast > 0 ? storedLast : units > 0 ? currentValue / units : 0
            const name = r.fundName
            return {
              providerSlug: r.providerSlug ?? '',
              symbol: r.instrumentKey || r.schemeCode || r.folioNo || name.slice(0, 12),
              company: name,
              isin: r.instrumentKey ?? '',
              qty: units,
              avgPrice,
              lastPrice,
              pnl: num(r.profitLoss),
              dayChangePct: 0,
              synced: r.syncedAt ? r.syncedAt.toISOString() : '',
              folioNo: r.folioNo ?? '',
              instrumentKey: r.instrumentKey ?? '',
              lastPriceDate: r.lastPriceDate ?? '',
              pledgedQuantity: num(r.pledgedQuantity),
            }
          }),
        )
      }

      if (action === 'init') {
        const settingsBlob = await loadFintrackerSettingsJson(db, em, budgetScope)
        const initPrefs = parseFintrackerPrefs(settingsBlob)
        const months = await computeMonths(db, budgetScope)
        const mq = typeof req.query.month === 'string' ? req.query.month : ''
        const yq = typeof req.query.year === 'string' ? req.query.year : ''
        let budgetMonthKey: string
        if (mq && yq) {
          try {
            budgetMonthKey = monthYearKey(mq, yq)
          } catch {
            const c = currentMonthYear(initPrefs)
            budgetMonthKey = monthYearKey(c.month, c.year)
          }
        } else {
          const c = currentMonthYear(initPrefs)
          budgetMonthKey = monthYearKey(c.month, c.year)
        }
        const bud = await loadMergedBudgetForMonth(db, budgetScope, budgetMonthKey)
        const fintracker = initPrefs
        const currency = (settingsBlob && typeof settingsBlob === 'object' && (settingsBlob as Record<string, unknown>).currency) || 'INR'
        const roundOff = (settingsBlob && typeof settingsBlob === 'object' && (settingsBlob as Record<string, unknown>).roundOff !== false) !== false
        return ok(
          res,
          {
            months,
            budget: bud,
            openingBal: readOpeningBal(settingsBlob),
            fintracker,
            currency,
            roundOff,
          },
          traceId,
        )
      }

      if (action === 'getData') {
        const month = typeof req.query.month === 'string' ? req.query.month : ''
        const year = typeof req.query.year === 'string' ? req.query.year : ''
        if (!month || !year) return fail(res, 400, 'month and year are required', traceId)
        // Filter on the stored cycle label, not on a date window recomputed from
        // the live anchor day.
        //
        // Budgets have always been keyed by this label while transactions were
        // matched by date, so the two halves of the same screen could disagree
        // about which rows a cycle holds — and changing the anchor re-sliced
        // every past cycle, losing the states they were filed under. One key for
        // both ends that: past cycles keep the rows they were filed with, and
        // only future entries follow a new anchor.
        let my: string
        try {
          my = monthYearKey(month, year)
        } catch {
          return fail(res, 400, 'Invalid month or year', traceId)
        }
        const rows = await db
          .select()
          .from(transactions)
          .where(and(whereOrgFilter(transactions, budgetScope), eq(transactions.monthYear, my)))
          .orderBy(desc(transactions.date))
        return ok(res, rows.map(rowFromDb), traceId)
      }

      if (action === 'summary') {
        const settingsBlob = await loadFintrackerSettingsJson(db, em, budgetScope)
        const prefs = parseFintrackerPrefs(settingsBlob)
        const cur = currentMonthYear(prefs)
        const month = typeof req.query.month === 'string' && req.query.month ? req.query.month : cur.month
        const year = typeof req.query.year === 'string' && req.query.year ? req.query.year : cur.year
        const monthsBack = Math.min(Math.max(parseInt(String(req.query.months ?? '6'), 10) || 6, 2), 24)

        const ranges = buildCycleRanges(month, year, prefs, monthsBack)
        if (!ranges.length) return fail(res, 400, 'Invalid month or year', traceId)
        const currentRange = ranges[ranges.length - 1]

        const blob = settingsBlob as Record<string, string | number | boolean | null | undefined>
        const goldRate = num(blob.goldRate)
        const usdToInr = num(blob.usdToInr) || 83

        const orgId = scopeOrgId
        const [trend, income, netWorth, committed, loans, budgetRows, accounts] = await Promise.all([
          getIncomeExpenseTrend(db, orgId, ranges),
          getDerivedMonthlyIncome(db, orgId, ranges.slice(0, -1)),
          getNetWorth(db, orgId, { goldRatePerGram: goldRate }),
          getCommittedMonthlyOutflow(db, orgId, { usdToInr }),
          getLoanOutstanding(db, orgId),
          loadMergedBudgetForMonth(db, budgetScope, currentRange.key),
          // Opening balances live in this settings blob keyed by account name,
          // not in a table, so the query takes them from here.
          getAccountBalances(db, orgId, { openingBal: readOpeningBal(settingsBlob) }),
        ])

        const thisCycle = trend[trend.length - 1] ?? { income: 0, expense: 0, savings: 0, net: 0, key: currentRange.key }
        const spentThisCycle = thisCycle.expense + thisCycle.savings
        const totalBudget = budgetRows.reduce((sum, b) => sum + b.amount, 0)

        /** How far through the current cycle we are, 0..1 — the basis for pace warnings. */
        const startMs = new Date(currentRange.start).getTime()
        const endMs = new Date(currentRange.end).getTime()
        const nowMs = Date.now()
        const cycleProgress = endMs > startMs
          ? Math.min(Math.max((nowMs - startMs) / (endMs - startMs), 0), 1)
          : 1

        const surplus = income.surplus
        const payoff = planPayoff(
          loans.map(l => ({ ...l })),
          Math.max(surplus, 0),
          'avalanche',
        )
        const twelveMonth = closeAllWithin(loans, 12, Math.max(surplus, 0))

        const suggestions: { tone: 'green' | 'amber' | 'red' | 'navy'; title: string; detail: string }[] = []

        if (totalBudget > 0 && cycleProgress > 0.15) {
          const spendRatio = spentThisCycle / totalBudget
          if (spendRatio > 1) {
            suggestions.push({
              tone: 'red',
              title: 'Over budget',
              detail: `Spent ${Math.round(spendRatio * 100)}% of budget with ${Math.round((1 - cycleProgress) * 100)}% of the cycle left.`,
            })
          } else if (spendRatio > cycleProgress + 0.15) {
            suggestions.push({
              tone: 'amber',
              title: 'Spending ahead of pace',
              detail: `${Math.round(spendRatio * 100)}% of budget used but only ${Math.round(cycleProgress * 100)}% through the cycle.`,
            })
          }
        }

        if (income.sampleMonths >= 2 && spentThisCycle > income.avgExpense * 1.2 && income.avgExpense > 0) {
          const over = Math.round(((spentThisCycle / income.avgExpense) - 1) * 100)
          suggestions.push({
            tone: 'amber',
            title: 'Above your usual spend',
            detail: `This cycle is ${over}% above your ${income.sampleMonths}-month average.`,
          })
        }

        const soon = committed.upcomingRenewals.filter(r => r.daysLeft <= 7)
        if (soon.length) {
          const sum = soon.reduce((a, r) => a + r.amount, 0)
          suggestions.push({
            tone: 'navy',
            title: `${soon.length} renewal${soon.length > 1 ? 's' : ''} within 7 days`,
            detail: `${soon.map(r => r.name).join(', ')} — ${Math.round(sum)} total.`,
          })
        }

        if (loans.length && surplus > 0) {
          const first = payoff[0]
          if (first && Number.isFinite(first.closesInMonths)) {
            suggestions.push({
              tone: 'green',
              title: `Target ${first.name} first`,
              detail: `Highest rate at ${first.annualRate}%. At your current surplus it closes in about ${first.closesInMonths} months.`,
            })
          }
          if (twelveMonth.feasible) {
            suggestions.push({
              tone: 'green',
              title: 'All loans closable within 12 months',
              detail: `Needs ${Math.round(twelveMonth.requiredMonthly)}/month; you have about ${Math.round(twelveMonth.availableMonthly)}.`,
            })
          } else if (twelveMonth.shortfall > 0) {
            suggestions.push({
              tone: 'navy',
              title: 'A 12-month close needs more room',
              detail: `Short by about ${Math.round(twelveMonth.shortfall)}/month. Ask the analysis MCP for a payoff plan.`,
            })
          }
        }

        if (surplus < 0 && income.sampleMonths >= 2) {
          suggestions.push({
            tone: 'red',
            title: 'Spending exceeds income',
            detail: `Averaging ${Math.round(Math.abs(surplus))}/month more than you earn over ${income.sampleMonths} months.`,
          })
        }

        return ok(
          res,
          {
            monthKey: currentRange.key,
            cycle: { start: currentRange.start, end: currentRange.end, progress: cycleProgress },
            trend,
            thisCycle,
            income,
            netWorth,
            committed,
            budget: { total: totalBudget, spent: spentThisCycle },
            accounts,
            loans,
            payoff,
            twelveMonth,
            suggestions,
          },
          traceId,
        )
      }

      return fail(res, 400, `Unknown GET action: ${mod ? `${mod}/` : ''}${action}`, traceId)
    }

    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
      const action = typeof body.action === 'string' ? body.action : ''
      const mod = typeof body.module === 'string' ? body.module : ''

      if (mod === 'settings' && action === 'save') {
        const prev = await loadFintrackerSettingsJson(db, em, budgetScope)
        const patch: Record<string, unknown> = {}
        for (const k of ['goldRate', 'usdToInr', 'loansSpreadsheetId', 'emiSheetName', 'expensesSheetId', 'assetsSheetId', 'currency', 'roundOff']) {
          if (body[k] !== undefined) patch[k] = body[k]
        }
        if (body.fintracker !== undefined && body.fintracker !== null && typeof body.fintracker === 'object') {
          const prevFt =
            prev.fintracker && typeof prev.fintracker === 'object' && !Array.isArray(prev.fintracker)
              ? (prev.fintracker as Record<string, unknown>)
              : {}
          patch.fintracker = { ...prevFt, ...(body.fintracker as Record<string, unknown>) }
        }
        await mergeFintrackerSettings(db, em, budgetScope, patch)
        return ok(res, true, traceId)
      }

      if ((mod === 'integrations' || mod === 'stocks') && (action === 'resetAuth' || action === 'disconnect')) {
        const provider =
          typeof body.provider === 'string' && body.provider.trim() ? body.provider.trim() : 'upstox'
        const orgId = await requireOrgIdForIntegrations(em, session.activeOrgId)
        if (!orgId) return fail(res, 400, 'Organization required for integrations', traceId)
        await disconnectOrgIntegration(orgId, provider)
        return ok(res, true, traceId)
      }

      if (mod === 'integrations' && action === 'syncPortfolio') {
        const orgId = await requireOrgIdForIntegrations(em, session.activeOrgId)
        if (!orgId) return fail(res, 401, 'REAUTH_REQUIRED', traceId)
        try {
          const result = await syncOrgPortfolioFromIntegrations(orgId)
          return ok(res, result, traceId)
        } catch (e) {
          const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
          if (code === 'TOKEN_EXPIRED' || code === 'REAUTH_REQUIRED') {
            return fail(res, 401, code, traceId)
          }
          return fail(res, 502, e instanceof Error ? e.message : 'Sync failed', traceId)
        }
      }

      if (mod === 'stocks' && action === 'sync') {
        const orgId = await requireOrgIdForIntegrations(em, session.activeOrgId)
        if (!orgId) return fail(res, 401, 'REAUTH_REQUIRED', traceId)
        try {
          const result = await syncOrgStocksFromIntegrations(orgId)
          return ok(res, result, traceId)
        } catch (e) {
          const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
          if (code === 'TOKEN_EXPIRED' || code === 'REAUTH_REQUIRED') {
            return fail(res, 401, code, traceId)
          }
          return fail(res, 502, e instanceof Error ? e.message : 'Sync failed', traceId)
        }
      }

      if (mod === 'mutualfunds' && action === 'sync') {
        const orgId = await requireOrgIdForIntegrations(em, session.activeOrgId)
        if (!orgId) return fail(res, 401, 'REAUTH_REQUIRED', traceId)
        try {
          const result = await syncOrgMutualFundsFromIntegrations(orgId)
          return ok(res, result, traceId)
        } catch (e) {
          const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
          if (code === 'TOKEN_EXPIRED' || code === 'REAUTH_REQUIRED') {
            return fail(res, 401, code, traceId)
          }
          return fail(res, 502, e instanceof Error ? e.message : 'Sync failed', traceId)
        }
      }

      if (mod === 'lending') {
        const book = normalizeLendingSheetSlug(body.sheetName ?? body.sheet)
        if (action === 'addEntry') {
          const id = crypto.randomUUID()
          const dateStr = typeof body.date === 'string' ? body.date : new Date().toISOString().slice(0, 10)
          await db.insert(lending).values({
            id,
            orgId: scopeOrgId,
            sheetSlug: book,
            date: dateStr,
            name: String(body.name ?? ''),
            amount: String(num(body.amount as string | number)),
            type: String(body.type ?? 'LEND'),
            description: typeof body.description === 'string' ? body.description : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          if (transactionIdFromMirrorId(id)) return fail(res, 409, MIRROR_READONLY_MESSAGE, traceId)
          await db
            .update(lending)
            .set({
              date: typeof body.date === 'string' ? body.date : undefined,
              name: typeof body.name === 'string' ? body.name : undefined,
              amount: body.amount !== undefined ? String(num(body.amount as string | number)) : undefined,
              type: typeof body.type === 'string' ? body.type : undefined,
              description: typeof body.description === 'string' ? body.description : undefined,
            })
            .where(and(whereOrgFilter(lending, budgetScope), eq(lending.id, id), eq(lending.sheetSlug, book)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .delete(lending)
            .where(and(whereOrgFilter(lending, budgetScope), eq(lending.id, id), eq(lending.sheetSlug, book)))
          // Deleting a mirrored row unlinks the transaction that made it.
          // Without this the row returns on that transaction's next save.
          await unlinkMirrorSource(db, budgetScope, id)
          return ok(res, true, traceId)
        }
      }

      if (mod === 'savings') {
        if (action === 'addEntry' || action === 'updateEntry') {
          const acctLookup = await loadSavingsAccountLookup(db, scopeOrgId)
          const accountRaw = typeof body.account === 'string' ? body.account : ''
          const accountId = resolveSavingsAccountId(acctLookup, accountRaw)
          if (!accountId) return fail(res, 400, 'Invalid account', traceId)

          const typeStr = String(body.type ?? '').trim()
          const isTransfer = typeStr.toUpperCase() === 'TRANSFER'
          let toAccountId: string | null = null
          if (isTransfer) {
            const toRaw = typeof body.toAccount === 'string' ? body.toAccount : ''
            toAccountId = resolveSavingsAccountId(acctLookup, toRaw)
            if (!toAccountId) return fail(res, 400, 'Invalid to account', traceId)
          }

          if (action === 'addEntry') {
            const id = crypto.randomUUID()
            const dateStr = typeof body.date === 'string' ? body.date : new Date().toISOString().slice(0, 10)
            await db.insert(savings).values({
              id,
              orgId: scopeOrgId,
              date: dateStr,
              account: accountId,
              amount: String(num(body.amount as string | number)),
              description: typeof body.desc === 'string' ? body.desc : typeof body.description === 'string' ? body.description : null,
              type: typeStr,
              toAccount: toAccountId,
              category: typeof body.category === 'string' ? body.category : null,
            })
            return ok(res, id, traceId)
          }

          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          if (transactionIdFromMirrorId(id)) return fail(res, 409, MIRROR_READONLY_MESSAGE, traceId)
          await db
            .update(savings)
            .set({
              date: typeof body.date === 'string' ? body.date : undefined,
              account: accountId,
              amount: body.amount !== undefined ? String(num(body.amount as string | number)) : undefined,
              description:
                typeof body.desc === 'string'
                  ? body.desc
                  : typeof body.description === 'string'
                    ? body.description
                    : undefined,
              type: typeStr ? typeStr : undefined,
              toAccount: toAccountId,
              category: typeof body.category === 'string' ? body.category : undefined,
            })
            .where(and(whereOrgFilter(savings, budgetScope), eq(savings.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(savings).where(and(whereOrgFilter(savings, budgetScope), eq(savings.id, id)))
          // Deleting a mirrored row unlinks the transaction that made it.
          // Without this the row returns on that transaction's next save.
          await unlinkMirrorSource(db, budgetScope, id)
          return ok(res, true, traceId)
        }
      }

      if (mod === 'gold') {
        if (action === 'addEntry' || action === 'updateEntry') {
          const isUpdate = action === 'updateEntry'
          const id = isUpdate ? (typeof body.id === 'string' ? body.id : '') : crypto.randomUUID()
          if (isUpdate && !id) return fail(res, 400, 'Missing id', traceId)

          // On update only validate fields actually present: the action is a
          // partial update, and `null` explicitly clears a link.
          const nameGiven = !isUpdate || body.name !== undefined
          const weightGiven = !isUpdate || body.weight_g !== undefined

          let name: string | undefined
          if (nameGiven) {
            const parsed = reqText(body.name)
            if (!parsed) return fail(res, 400, 'Item name is required', traceId)
            name = parsed
          }

          let weightG: string | undefined
          if (weightGiven) {
            const parsed = goldWeight(body.weight_g)
            if (!parsed) return fail(res, 400, 'Weight must be a number greater than 0', traceId)
            weightG = parsed
          }

          // Resolve person/location against this org's resources. A stale link
          // stored on the row stays editable — only an incoming value is checked.
          let personId: string | null | undefined
          let locationId: string | null | undefined
          if (body.person_id !== undefined || body.location_id !== undefined) {
            const lookup = await loadGoldResourceLookup(db, scopeOrgId)
            if (body.person_id !== undefined) {
              if (body.person_id === null || body.person_id === '') personId = null
              else {
                personId = resolveGoldResourceId(lookup, body.person_id, 'person')
                if (!personId) return fail(res, 400, 'Invalid person', traceId)
              }
            }
            if (body.location_id !== undefined) {
              if (body.location_id === null || body.location_id === '') locationId = null
              else {
                locationId = resolveGoldResourceId(lookup, body.location_id, 'location')
                if (!locationId) return fail(res, 400, 'Invalid location', traceId)
              }
            }
          }

          if (!isUpdate) {
            await db.insert(goldItems).values({
              orgId: scopeOrgId,
              id,
              name: name as string,
              weightG: weightG as string,
              personId: personId ?? null,
              locationId: locationId ?? null,
            })
            return ok(res, id, traceId)
          }

          const updated = await db
            .update(goldItems)
            .set({ name, weightG, personId, locationId })
            .where(and(whereOrgFilter(goldItems, budgetScope), eq(goldItems.id, id)))
            .returning({ id: goldItems.id })
          if (!updated.length) return fail(res, 404, 'Gold item not found', traceId)
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          const removed = await db
            .delete(goldItems)
            .where(and(whereOrgFilter(goldItems, budgetScope), eq(goldItems.id, id)))
            .returning({ id: goldItems.id })
          if (!removed.length) return fail(res, 404, 'Gold item not found', traceId)
          return ok(res, true, traceId)
        }
        if (action === 'addResource' || action === 'updateResource') {
          const isUpdate = action === 'updateResource'
          const id = isUpdate ? (typeof body.id === 'string' ? body.id : '') : crypto.randomUUID()
          if (isUpdate && !id) return fail(res, 400, 'Missing id', traceId)

          let type: string | undefined
          if (!isUpdate || body.type !== undefined) {
            if (!isGoldResourceType(body.type)) {
              return fail(res, 400, 'Resource type must be person or location', traceId)
            }
            type = body.type
          }

          let name: string | undefined
          if (!isUpdate || body.name !== undefined) {
            const parsed = reqText(body.name)
            if (!parsed) return fail(res, 400, 'Name is required', traceId)
            name = parsed
          }

          if (!isUpdate) {
            await db.insert(goldResources).values({
              orgId: scopeOrgId,
              id,
              type: type as string,
              name: name as string,
              skip: body.skip === true,
            })
            return ok(res, id, traceId)
          }

          const updated = await db
            .update(goldResources)
            .set({ type, name, skip: body.skip !== undefined ? body.skip === true : undefined })
            .where(and(whereOrgFilter(goldResources, budgetScope), eq(goldResources.id, id)))
            .returning({ id: goldResources.id })
          if (!updated.length) return fail(res, 404, 'Resource not found', traceId)
          return ok(res, true, traceId)
        }
        if (action === 'deleteResource') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          // There is no FK, so deleting a referenced resource would orphan gold
          // items — they'd keep their grams but vanish from the breakdowns.
          const inUse = await countGoldItemsUsingResource(db, scopeOrgId, id)
          if (inUse > 0) {
            return fail(
              res,
              409,
              `Still used by ${inUse} gold item${inUse === 1 ? '' : 's'}. Reassign them first.`,
              traceId,
            )
          }
          const removed = await db
            .delete(goldResources)
            .where(and(whereOrgFilter(goldResources, budgetScope), eq(goldResources.id, id)))
            .returning({ id: goldResources.id })
          if (!removed.length) return fail(res, 404, 'Resource not found', traceId)
          return ok(res, true, traceId)
        }
        if (action === 'addHistory' || action === 'updateHistory') {
          const isUpdate = action === 'updateHistory'
          const id = isUpdate ? (typeof body.id === 'string' ? body.id : '') : crypto.randomUUID()
          if (isUpdate && !id) return fail(res, 400, 'Missing id', traceId)

          let type: string | undefined
          if (!isUpdate || body.type !== undefined) {
            const raw = typeof body.type === 'string' ? body.type.trim().toUpperCase() : 'IN'
            if (raw !== 'IN' && raw !== 'OUT') {
              return fail(res, 400, 'Movement type must be IN or OUT', traceId)
            }
            type = raw
          }

          let name: string | undefined
          if (!isUpdate || body.name !== undefined) {
            const parsed = reqText(body.name)
            if (!parsed) return fail(res, 400, 'Item name is required', traceId)
            name = parsed
          }

          let weightG: string | undefined
          if (!isUpdate || body.weight_g !== undefined) {
            const parsed = goldWeight(body.weight_g)
            if (!parsed) return fail(res, 400, 'Weight must be a number greater than 0', traceId)
            weightG = parsed
          }

          if (!isUpdate) {
            const dateStr = typeof body.date === 'string' ? body.date : new Date().toISOString().slice(0, 10)
            await db.insert(goldHistory).values({
              orgId: scopeOrgId,
              id,
              date: dateStr,
              type: type as string,
              name: name as string,
              weightG: weightG as string,
              note: typeof body.note === 'string' ? body.note : null,
            })
            return ok(res, id, traceId)
          }

          const updated = await db
            .update(goldHistory)
            .set({
              date: typeof body.date === 'string' ? body.date : undefined,
              type,
              name,
              weightG,
              note: typeof body.note === 'string' ? body.note : undefined,
            })
            .where(and(whereOrgFilter(goldHistory, budgetScope), eq(goldHistory.id, id)))
            .returning({ id: goldHistory.id })
          if (!updated.length) return fail(res, 404, 'History entry not found', traceId)
          return ok(res, true, traceId)
        }
        if (action === 'deleteHistory') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          const removed = await db
            .delete(goldHistory)
            .where(and(whereOrgFilter(goldHistory, budgetScope), eq(goldHistory.id, id)))
            .returning({ id: goldHistory.id })
          if (!removed.length) return fail(res, 404, 'History entry not found', traceId)
          return ok(res, true, traceId)
        }
      }

      if (mod === 'loans') {
        const typ = typeof body.type === 'string' ? body.type : ''
        if (action === 'addEntry' && typ === 'jewel') {
          const id = crypto.randomUUID()
          await db.insert(jewelLoans).values({
            orgId: scopeOrgId,
            id,
            name: String(body.name ?? ''),
            bank: typeof body.bank === 'string' ? body.bank : null,
            principal: String(num(body.principal as string | number)),
            rate: String(num(body.rate as string | number)),
            startDate: String(body.start_date ?? body.startDate ?? new Date().toISOString().slice(0, 10)),
            endDate: optionalDate(body.end_date) ?? optionalDate(body.endDate),
            paidAmount: String(num(body.paid_amount as string | number)),
            status: typeof body.status === 'string' ? body.status : 'Ongoing',
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateEntry' && typ === 'jewel') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .update(jewelLoans)
            .set({
              name: typeof body.name === 'string' ? body.name : undefined,
              bank: typeof body.bank === 'string' ? body.bank : undefined,
              principal: body.principal !== undefined ? String(num(body.principal as string | number)) : undefined,
              rate: body.rate !== undefined ? String(num(body.rate as string | number)) : undefined,
              startDate: typeof body.start_date === 'string' ? body.start_date : undefined,
              endDate: body.end_date !== undefined ? optionalDate(body.end_date) : undefined,
              paidAmount: body.paid_amount !== undefined ? String(num(body.paid_amount as string | number)) : undefined,
              status: typeof body.status === 'string' ? body.status : undefined,
            })
            .where(and(whereOrgFilter(jewelLoans, budgetScope), eq(jewelLoans.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry' && typ === 'jewel') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(jewelLoans).where(and(whereOrgFilter(jewelLoans, budgetScope), eq(jewelLoans.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'addEntry' && typ === 'cash') {
          const id = crypto.randomUUID()
          await db.insert(cashLoans).values({
            orgId: scopeOrgId,
            id,
            personName: String(body.person_name ?? ''),
            amountReceived: String(num(body.amount_received as string | number)),
            startDate: String(body.start_date ?? new Date().toISOString().slice(0, 10)),
            paidAmount: String(num(body.paid_amount as string | number)),
            status: typeof body.status === 'string' ? body.status : 'Ongoing',
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateEntry' && typ === 'cash') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .update(cashLoans)
            .set({
              personName: typeof body.person_name === 'string' ? body.person_name : undefined,
              amountReceived: body.amount_received !== undefined ? String(num(body.amount_received as string | number)) : undefined,
              startDate: typeof body.start_date === 'string' ? body.start_date : undefined,
              paidAmount: body.paid_amount !== undefined ? String(num(body.paid_amount as string | number)) : undefined,
              status: typeof body.status === 'string' ? body.status : undefined,
            })
            .where(and(whereOrgFilter(cashLoans, budgetScope), eq(cashLoans.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry' && typ === 'cash') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(cashLoans).where(and(whereOrgFilter(cashLoans, budgetScope), eq(cashLoans.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'addEntry' && !typ) {
          const id = crypto.randomUUID()
          await db.insert(emiLoans).values({
            orgId: scopeOrgId,
            id,
            name: String(body.name ?? ''),
            bank: typeof body.bank === 'string' ? body.bank : null,
            principal: String(num(body.principal as string | number)),
            rate: String(num(body.rate as string | number)),
            startDate: String(body.start_date ?? new Date().toISOString().slice(0, 10)),
            tenureMonths: parseInt(String(body.tenure_months ?? 0), 10) || 0,
            emiAmount: String(num(body.emi_amount as string | number)),
            paidEmis: parseInt(String(body.paid_emis ?? 0), 10) || 0,
            status: typeof body.status === 'string' ? body.status : 'Ongoing',
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateEntry' && !typ) {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .update(emiLoans)
            .set({
              name: typeof body.name === 'string' ? body.name : undefined,
              bank: typeof body.bank === 'string' ? body.bank : undefined,
              principal: body.principal !== undefined ? String(num(body.principal as string | number)) : undefined,
              rate: body.rate !== undefined ? String(num(body.rate as string | number)) : undefined,
              startDate: typeof body.start_date === 'string' ? body.start_date : undefined,
              tenureMonths:
                body.tenure_months !== undefined ? parseInt(String(body.tenure_months), 10) : undefined,
              emiAmount: body.emi_amount !== undefined ? String(num(body.emi_amount as string | number)) : undefined,
              paidEmis: body.paid_emis !== undefined ? parseInt(String(body.paid_emis), 10) : undefined,
              status: typeof body.status === 'string' ? body.status : undefined,
            })
            .where(and(whereOrgFilter(emiLoans, budgetScope), eq(emiLoans.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry' && !typ) {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(emiLoans).where(and(whereOrgFilter(emiLoans, budgetScope), eq(emiLoans.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'addHistory' && typ === 'jewel') {
          const id = crypto.randomUUID()
          await db.insert(jewelLoanRepayments).values({
            orgId: scopeOrgId,
            id,
            loanId: String(body.loan_id ?? ''),
            date: String(body.date ?? new Date().toISOString().slice(0, 10)),
            amount: String(num(body.amount as string | number)),
            note: typeof body.note === 'string' ? body.note : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateHistory' && typ === 'jewel') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          if (transactionIdFromMirrorId(id)) return fail(res, 409, MIRROR_READONLY_MESSAGE, traceId)
          await db
            .update(jewelLoanRepayments)
            .set({
              loanId: typeof body.loan_id === 'string' ? body.loan_id : undefined,
              date: typeof body.date === 'string' ? body.date : undefined,
              amount: body.amount !== undefined ? String(num(body.amount as string | number)) : undefined,
              note: typeof body.note === 'string' ? body.note : undefined,
            })
            .where(and(whereOrgFilter(jewelLoanRepayments, budgetScope), eq(jewelLoanRepayments.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteHistory' && typ === 'jewel') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(jewelLoanRepayments).where(and(whereOrgFilter(jewelLoanRepayments, budgetScope), eq(jewelLoanRepayments.id, id)))
          // Deleting a mirrored row unlinks the transaction that made it.
          // Without this the row returns on that transaction's next save.
          await unlinkMirrorSource(db, budgetScope, id)
          return ok(res, true, traceId)
        }
        if (action === 'addHistory' && typ === 'emi') {
          const id = crypto.randomUUID()
          await db.insert(emiLoanRepayments).values({
            orgId: scopeOrgId,
            id,
            loanId: String(body.loan_id ?? ''),
            date: String(body.date ?? new Date().toISOString().slice(0, 10)),
            amount: String(num(body.amount as string | number)),
            note: typeof body.note === 'string' ? body.note : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateHistory' && typ === 'emi') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          if (transactionIdFromMirrorId(id)) return fail(res, 409, MIRROR_READONLY_MESSAGE, traceId)
          await db
            .update(emiLoanRepayments)
            .set({
              loanId: typeof body.loan_id === 'string' ? body.loan_id : undefined,
              date: typeof body.date === 'string' ? body.date : undefined,
              amount: body.amount !== undefined ? String(num(body.amount as string | number)) : undefined,
              note: typeof body.note === 'string' ? body.note : undefined,
            })
            .where(and(whereOrgFilter(emiLoanRepayments, budgetScope), eq(emiLoanRepayments.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteHistory' && typ === 'emi') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          // Read the loan before deleting; afterwards there is nothing to point at.
          const [gone] = await db
            .select()
            .from(emiLoanRepayments)
            .where(and(whereOrgFilter(emiLoanRepayments, budgetScope), eq(emiLoanRepayments.id, id)))
            .limit(1)
          await db.delete(emiLoanRepayments).where(and(whereOrgFilter(emiLoanRepayments, budgetScope), eq(emiLoanRepayments.id, id)))
          // Deleting a mirrored row unlinks the transaction that made it.
          // Without this the row returns on that transaction's next save.
          await unlinkMirrorSource(db, budgetScope, id)
          return ok(res, true, traceId)
        }
        // Cash repayments had no update path, so the UI deleted and re-inserted,
        // churning the row id on every edit.
        if (action === 'updateHistory' && typ === 'cash') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          if (transactionIdFromMirrorId(id)) return fail(res, 409, MIRROR_READONLY_MESSAGE, traceId)
          await db
            .update(cashLoanRepayments)
            .set({
              loanId: typeof body.loan_id === 'string' ? body.loan_id : undefined,
              date: typeof body.date === 'string' ? body.date : undefined,
              amount: body.amount !== undefined ? String(num(body.amount as string | number)) : undefined,
              note: typeof body.note === 'string' ? body.note : undefined,
            })
            .where(and(whereOrgFilter(cashLoanRepayments, budgetScope), eq(cashLoanRepayments.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'addHistory' && typ === 'cash') {
          const id = crypto.randomUUID()
          await db.insert(cashLoanRepayments).values({
            orgId: scopeOrgId,
            id,
            loanId: String(body.loan_id ?? ''),
            date: String(body.date ?? new Date().toISOString().slice(0, 10)),
            amount: String(num(body.amount as string | number)),
            note: typeof body.note === 'string' ? body.note : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'deleteHistory' && typ === 'cash') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(cashLoanRepayments).where(and(whereOrgFilter(cashLoanRepayments, budgetScope), eq(cashLoanRepayments.id, id)))
          // Deleting a mirrored row unlinks the transaction that made it.
          // Without this the row returns on that transaction's next save.
          await unlinkMirrorSource(db, budgetScope, id)
          return ok(res, true, traceId)
        }
      }

      if (mod === 'subscriptions') {
        if (action === 'addEntry') {
          const id = crypto.randomUUID()
          await db.insert(subscriptions).values({
            orgId: scopeOrgId,
            id,
            name: String(body.name ?? ''),
            category: typeof body.category === 'string' ? body.category : null,
            amount: String(num(body.amount as string | number)),
            currency: typeof body.currency === 'string' ? body.currency : 'INR',
            billingCycle: String(body.billing_cycle ?? 'monthly'),
            startDate: String(body.start_date ?? new Date().toISOString().slice(0, 10)),
            endDate: optionalDate(body.end_date),
            autopay: Boolean(body.autopay),
            status: typeof body.status === 'string' ? body.status : 'active',
            paymentMethod: typeof body.payment_method === 'string' ? body.payment_method : null,
            appUuid: typeof body.app_uuid === 'string' ? body.app_uuid : null,
            notes: typeof body.notes === 'string' ? body.notes : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .update(subscriptions)
            .set({
              name: typeof body.name === 'string' ? body.name : undefined,
              category: typeof body.category === 'string' ? body.category : undefined,
              amount: body.amount !== undefined ? String(num(body.amount as string | number)) : undefined,
              currency: typeof body.currency === 'string' ? body.currency : undefined,
              billingCycle: typeof body.billing_cycle === 'string' ? body.billing_cycle : undefined,
              startDate: typeof body.start_date === 'string' ? body.start_date : undefined,
              endDate: body.end_date !== undefined ? optionalDate(body.end_date) : undefined,
              autopay: body.autopay !== undefined ? Boolean(body.autopay) : undefined,
              status: typeof body.status === 'string' ? body.status : undefined,
              paymentMethod: typeof body.payment_method === 'string' ? body.payment_method : undefined,
              appUuid: typeof body.app_uuid === 'string' ? body.app_uuid : undefined,
              notes: typeof body.notes === 'string' ? body.notes : undefined,
              updatedAt: new Date(),
            })
            .where(and(whereOrgFilter(subscriptions, budgetScope), eq(subscriptions.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(subscriptions).where(and(whereOrgFilter(subscriptions, budgetScope), eq(subscriptions.id, id)))
          return ok(res, true, traceId)
        }
      }

      if (action === 'saveOpeningBal') {
        const data = body.data as Record<string, unknown> | undefined
        if (!data || typeof data !== 'object') return fail(res, 400, 'Invalid opening balance payload', traceId)
        const ob: Record<string, number> = {}
        for (const [k, v] of Object.entries(data)) {
          const n = typeof v === 'number' ? v : parseFloat(String(v))
          if (Number.isFinite(n)) ob[k] = n
        }
        await mergeFintrackerSettings(db, em, budgetScope, { openingBal: ob })
        return ok(res, true, traceId)
      }

      if (action === 'saveBudget') {
        const budgets = body.budgets as { id?: string; name: string; amount: number; startMonth?: string | null; endMonth?: string | null }[] | undefined
        if (!Array.isArray(budgets)) return fail(res, 400, 'Invalid budgets', traceId)
        const rng = resolvePostedBudgetRange(body)
        if (!rng.ok) return fail(res, 400, rng.error, traceId)
        const deleteWhere = and(
          budgetRowsBaseWhere(budgetScope),
          rng.startMonth ? eq(budget.startMonth, rng.startMonth) : isNull(budget.startMonth),
          rng.endMonth ? eq(budget.endMonth, rng.endMonth) : isNull(budget.endMonth)
        )
        await db.delete(budget).where(deleteWhere)
        for (const e of budgets) {
          if (!e?.name?.trim()) continue
          await db.insert(budget).values({
            id: e.id && typeof e.id === 'string' ? e.id : crypto.randomUUID(),
            orgId: scopeOrgId,
            monthYear: rng.monthYear,
            category: e.name.trim(),
            amount: String(num(e.amount)),
            startMonth: e.startMonth ?? rng.startMonth,
            endMonth: e.endMonth ?? rng.endMonth,
          })
        }
        return ok(res, true, traceId)
      }

      if (action === 'addBudgetEntry') {
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const amt = num(body.amt as string | number)
        if (!name) return fail(res, 400, 'Invalid budget entry', traceId)
        const rng = resolvePostedBudgetRange(body)
        if (!rng.ok) return fail(res, 400, rng.error, traceId)
        const base = budgetRowsBaseWhere(budgetScope)
        const selectWhere = and(
          base,
          eq(budget.category, name),
          rng.startMonth ? eq(budget.startMonth, rng.startMonth) : isNull(budget.startMonth),
          rng.endMonth ? eq(budget.endMonth, rng.endMonth) : isNull(budget.endMonth)
        )
        const [existing] = await db
          .select()
          .from(budget)
          .where(selectWhere)
          .limit(1)
        if (existing) {
          await db
            .update(budget)
            .set({ amount: String(amt) })
            .where(eq(budget.id, existing.id))
          return ok(res, { id: existing.id, name, amount: amt, monthYear: rng.monthYear, startMonth: rng.startMonth, endMonth: rng.endMonth }, traceId)
        }
        const id = crypto.randomUUID()
        await db.insert(budget).values({
          id,
          orgId: scopeOrgId,
          monthYear: rng.monthYear,
          category: name,
          amount: String(amt),
          startMonth: rng.startMonth,
          endMonth: rng.endMonth,
        })
        return ok(res, { id, name, amount: amt, monthYear: rng.monthYear, startMonth: rng.startMonth, endMonth: rng.endMonth }, traceId)
      }

      if (action === 'updateBudgetEntry') {
        const id = typeof body.id === 'string' ? body.id : ''
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const amt = num(body.amt as string | number)
        if (!id || !name) return fail(res, 400, 'Invalid budget entry', traceId)
        const base = budgetRowsBaseWhere(budgetScope)
        const [existingRow] = await db.select().from(budget).where(and(eq(budget.id, id), base)).limit(1)
        if (!existingRow) return fail(res, 404, 'Budget entry not found', traceId)
        const hasRangeFields =
          Object.prototype.hasOwnProperty.call(body, 'startMonth') ||
          Object.prototype.hasOwnProperty.call(body, 'endMonth')
        let rng: { startMonth: string | null; endMonth: string | null; monthYear: string }
        if (hasRangeFields) {
          const parsed = resolvePostedBudgetRangeForUpdate(body, {
            startMonth: existingRow.startMonth ?? null,
            endMonth: existingRow.endMonth ?? null,
            monthYear: existingRow.monthYear,
          })
          if (!parsed.ok) return fail(res, 400, parsed.error, traceId)
          rng = parsed
        } else {
          rng = {
            startMonth: existingRow.startMonth ?? null,
            endMonth: existingRow.endMonth ?? null,
            monthYear: existingRow.monthYear,
          }
        }
        const deleteWhere2 = and(
          base,
          eq(budget.category, name),
          rng.startMonth ? eq(budget.startMonth, rng.startMonth) : isNull(budget.startMonth),
          rng.endMonth ? eq(budget.endMonth, rng.endMonth) : isNull(budget.endMonth),
          ne(budget.id, id)
        )
        await db.delete(budget).where(deleteWhere2)
        await db
          .update(budget)
          .set({ monthYear: rng.monthYear, category: name, amount: String(amt), startMonth: rng.startMonth, endMonth: rng.endMonth })
          .where(and(eq(budget.id, id), base))
        return ok(res, true, traceId)
      }

      if (action === 'deleteBudgetEntry') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!id) return fail(res, 400, 'Missing id', traceId)
        await db.delete(budget).where(and(eq(budget.id, id), budgetRowsBaseWhere(budgetScope)))
        return ok(res, true, traceId)
      }

      if (action === 'addRow') {
        const month = typeof body.month === 'string' ? body.month : ''
        const year = typeof body.year === 'string' ? body.year : ''
        const dateUi = typeof body.date === 'string' ? body.date : ''
        if (!month || !year || !dateUi) return fail(res, 400, 'Invalid transaction', traceId)
        const my = monthYearKey(month, year)
        const id = crypto.randomUUID()
        const iso = isoDate(dateUi)
        if (!iso) return fail(res, 400, 'Invalid date', traceId)
        const typeStr = String(body.t ?? 'Expense')
        const xferTo = readTransferToFromBody(body, typeStr)
        const posted = readRefFromBody(body)
        // A savings deposit is derived from the transfer destination, not typed:
        // the user already picked the account in "Transfer To".
        const savingsTarget = await resolveSavingsTransferTarget(db, budgetScope, typeStr, xferTo)
        const refKind = savingsTarget ? 'savings' : posted.refKind
        const refId = savingsTarget ?? posted.refId
        const amt = num(body.a as string | number)
        const desc = String(body.desc ?? '')
        await db.insert(transactions).values({
          id,
          orgId: scopeOrgId,
          date: iso,
          description: desc,
          amount: String(amt),
          category: String(body.c ?? ''),
          type: typeStr,
          mode: String(body.m ?? ''),
          transferTo: xferTo,
          notes: typeof body.notes === 'string' ? body.notes : '',
          monthYear: my,
          refKind,
          refId,
        })
        // The transaction is already saved; a failed mirror must not lose it.
        await syncTransactionMirror(db, budgetScope, scopeOrgId, {
          txnId: id,
          prevRefKind: null,
          refKind,
          refId,
          isoDate: iso,
          amount: amt,
          note: desc,
          type: typeStr,
        })
        return ok(res, id, traceId)
      }

      if (action === 'updateRow') {
        const id = typeof body.id === 'string' ? body.id : ''
        const month = typeof body.month === 'string' ? body.month : ''
        const year = typeof body.year === 'string' ? body.year : ''
        const dateUi = typeof body.date === 'string' ? body.date : ''
        if (!id || !month || !year || !dateUi) return fail(res, 400, 'Invalid transaction', traceId)
        const my = monthYearKey(month, year)
        const iso = isoDate(dateUi)
        if (!iso) return fail(res, 400, 'Invalid date', traceId)
        const typeStr = String(body.t ?? 'Expense')
        const xferTo = readTransferToFromBody(body, typeStr)
        const posted = readRefFromBody(body)
        const savingsTarget = await resolveSavingsTransferTarget(db, budgetScope, typeStr, xferTo)
        const refKind = savingsTarget ? 'savings' : posted.refKind
        const refId = savingsTarget ?? posted.refId
        const amt = num(body.a as string | number)
        const desc = String(body.desc ?? '')
        // Read the old ref before overwriting it: repointing a transaction has to
        // remove the mirror from wherever it used to be.
        const [before] = await db
          .select({ refKind: transactions.refKind })
          .from(transactions)
          .where(and(whereOrgFilter(transactions, budgetScope), eq(transactions.id, id)))
          .limit(1)
        await db
          .update(transactions)
          .set({
            date: iso,
            description: desc,
            amount: String(amt),
            category: String(body.c ?? ''),
            type: typeStr,
            mode: String(body.m ?? ''),
            transferTo: xferTo,
            notes: typeof body.notes === 'string' ? body.notes : '',
            monthYear: my,
            refKind,
            refId,
          })
          .where(and(whereOrgFilter(transactions, budgetScope), eq(transactions.id, id)))
        await syncTransactionMirror(db, budgetScope, scopeOrgId, {
          txnId: id,
          prevRefKind: before?.refKind ?? null,
          refKind,
          refId,
          isoDate: iso,
          amount: amt,
          note: desc,
          type: typeStr,
        })
        return ok(res, true, traceId)
      }

      if (action === 'deleteRow') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!id) return fail(res, 400, 'Missing id', traceId)
        const [before] = await db
          .select({ refKind: transactions.refKind })
          .from(transactions)
          .where(and(whereOrgFilter(transactions, budgetScope), eq(transactions.id, id)))
          .limit(1)
        await db.delete(transactions).where(and(whereOrgFilter(transactions, budgetScope), eq(transactions.id, id)))
        // Deleting the register entry retires its mirror too — the mirror only
        // ever existed because this transaction created it.
        await syncTransactionMirror(db, budgetScope, scopeOrgId, {
          txnId: id,
          prevRefKind: before?.refKind ?? null,
          refKind: null,
          refId: null,
          isoDate: '',
          amount: 0,
          note: '',
          type: '',
        })
        return ok(res, true, traceId)
      }

      if (action === 'configure') {
        const patch: Record<string, unknown> = {}
        if (body.expensesSheetId !== undefined) patch.expensesSheetId = body.expensesSheetId
        if (body.assetsSheetId !== undefined) patch.assetsSheetId = body.assetsSheetId
        await mergeFintrackerSettings(db, em, budgetScope, patch)
        return ok(res, true, traceId)
      }

      if (action === 'ensureMonth') {
        return ok(res, true, traceId)
      }

      if (action === 'gemini') {
        return fail(res, 501, 'Gemini is not configured on this server.', traceId)
      }

      return fail(res, 400, `Unknown POST action: ${mod ? `${mod}/` : ''}${action}`, traceId)
    }

    res.setHeader('Allow', 'GET, POST')
    return fail(res, 405, 'Method not allowed', traceId)
  } catch (e) {
    console.error('[fintracker /api]', e)
    return fail(res, 500, e instanceof Error ? e.message : 'Server error', traceId)
  }
}
