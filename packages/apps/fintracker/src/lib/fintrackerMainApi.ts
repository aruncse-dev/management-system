import type { NextApiRequest, NextApiResponse } from 'next'
import { and, between, desc, eq, isNull, ne, or } from 'drizzle-orm'
import type { FtSessionData } from '@fintracker-vault/auth'
import type { Transaction } from '../types'
import { MNS } from '../config'
import { currentMonthYear, isoDate } from '../utils'
import { cycleDateRange, parseFintrackerPrefs } from '../expenseCycle'
import {
  getDb,
  bankingRecords,
  budget,
  cashLoanRepayments,
  cashLoans,
  emiLoans,
  goldHistory,
  goldItems,
  goldResources,
  insurance,
  jewelLoanRepayments,
  jewelLoans,
  lending,
  mutualFunds,
  organizations,
  savings,
  stocks,
  subscriptions,
  transactions,
  listOrgsForUserEmail,
  users,
  vaultApps,
} from '@fintracker-vault/db'
import { normalizeLendingSheetSlug } from './lendingSheetSlug'

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

async function loadMergedBudgetForMonth(
  db: ReturnType<typeof getDb>,
  scope: BudgetScope,
  monthKey: string,
): Promise<{ id: string; name: string; amount: number; monthYear: string }[]> {
  const base = budgetRowsBaseWhere(scope)
  if (monthKey === BUDGET_SCOPE_KEY) {
    const rows = await db.select().from(budget).where(and(base, eq(budget.monthYear, BUDGET_SCOPE_KEY)))
    return rows.map((r) => ({
      id: r.id,
      name: r.category,
      amount: num(r.amount),
      monthYear: r.monthYear,
    }))
  }
  const rows = await db
    .select()
    .from(budget)
    .where(and(base, or(eq(budget.monthYear, monthKey), eq(budget.monthYear, BUDGET_SCOPE_KEY))))
  const byCat = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    if (r.monthYear === BUDGET_SCOPE_KEY) byCat.set(r.category, r)
  }
  for (const r of rows) {
    if (r.monthYear === monthKey) byCat.set(r.category, r)
  }
  return [...byCat.values()].map((r) => ({
    id: r.id,
    name: r.category,
    amount: num(r.amount),
    monthYear: r.monthYear,
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

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : 0
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
        const s = (await loadFintrackerSettingsJson(db, em, budgetScope)) as Record<string, string | number>
        const fintracker = parseFintrackerPrefs(s)
        return ok(res, {
          goldRate: num(s.goldRate),
          usdToInr: s.usdToInr !== undefined ? num(s.usdToInr) : undefined,
          loansSpreadsheetId: s.loansSpreadsheetId ? String(s.loansSpreadsheetId) : undefined,
          emiSheetName: s.emiSheetName ? String(s.emiSheetName) : undefined,
          expensesSheetId: s.expensesSheetId ? String(s.expensesSheetId) : undefined,
          assetsSheetId: s.assetsSheetId ? String(s.assetsSheetId) : undefined,
          fintracker,
          fintrackerJson: JSON.stringify(fintracker),
        })
      }

      if (mod === 'vault' && action === 'get') {
        const s = await loadFintrackerSettingsJson(db, em, budgetScope)
        return ok(res, { vaultSpreadsheetId: s.vaultSpreadsheetId ? String(s.vaultSpreadsheetId) : undefined })
      }

      if (mod === 'stocks' && action === 'getTokenStatus') {
        const s = await loadFintrackerSettingsJson(db, em, budgetScope)
        const tok = s.upstoxToken
        const has = typeof tok === 'string' && tok.length > 0
        return ok(res, { hasToken: has, tokenType: has ? 'legacy' : undefined })
      }

      if (mod === 'stocks' && action === 'getAuthUrl') {
        return fail(res, 501, 'Upstox OAuth is not configured for this deployment.', traceId)
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
        return ok(
          res,
          rows.map((r) => ({
            id: r.id,
            date: String(r.date),
            account: r.account,
            amount: r.amount,
            desc: r.description ?? '',
            type: r.type,
            toAccount: r.toAccount ?? undefined,
            category: r.category ?? undefined,
          })),
        )
      }

      if (mod === 'gold' && action === 'getEntries') {
        const rows = await db.select().from(goldItems).where(whereOrgFilter(goldItems, budgetScope))
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
        const typeFilter = typeof req.query.type === 'string' ? req.query.type : undefined
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
            weight_g: r.weightG,
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
              status: r.status ?? '',
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
              status: r.status ?? '',
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

      if (mod === 'vault' && action === 'getEntries') {
        const rows = await db.select().from(bankingRecords).where(whereOrgFilter(bankingRecords, budgetScope))
        return ok(
          res,
          rows.map((r) => ({
            id: r.id,
            account_holder_name: r.holderName ?? '',
            bank_name: r.bankName,
            app_uuid: r.appUuid ?? undefined,
            account_no: r.accountNo ?? '',
            ifsc: r.ifsc ?? '',
            cif: r.cif ?? '',
            username: r.username ?? '',
            password: r.password ?? '',
            transaction_password: r.transactionPassword ?? '',
            profile_password: r.profilePassword ?? '',
            mpin: r.mpin ?? '',
            updated_at: r.updatedAt ? r.updatedAt.toISOString() : undefined,
          })),
        )
      }

      if (mod === 'vault' && action === 'getEntry') {
        const id = typeof req.query.id === 'string' ? req.query.id : ''
        if (!id) return fail(res, 400, 'Missing id', traceId)
        const [r] = await db
          .select()
          .from(bankingRecords)
          .where(and(whereOrgFilter(bankingRecords, budgetScope), eq(bankingRecords.id, id)))
          .limit(1)
        if (!r) return fail(res, 404, 'Not found', traceId)
        return ok(res, {
          id: r.id,
          account_holder_name: r.holderName ?? '',
          bank_name: r.bankName,
          app_uuid: r.appUuid ?? undefined,
          account_no: r.accountNo ?? '',
          ifsc: r.ifsc ?? '',
          cif: r.cif ?? '',
          username: r.username ?? '',
          password: r.password ?? '',
          transaction_password: r.transactionPassword ?? '',
          profile_password: r.profilePassword ?? '',
          mpin: r.mpin ?? '',
          updated_at: r.updatedAt ? r.updatedAt.toISOString() : undefined,
        })
      }

      if (mod === 'vault' && action === 'getApps') {
        const rows = await db.select().from(vaultApps).where(whereOrgFilter(vaultApps, budgetScope)).orderBy(desc(vaultApps.updatedAt))
        return ok(
          res,
          rows.map((r) => ({
            app_uuid: r.id,
            app_name: r.appName,
            category: r.category ?? '',
            logo: r.logo ?? '',
            app_link: r.appLink ?? '',
            username: r.username ?? '',
            password: r.password ?? '',
            two_factor_enabled: Boolean(r.twoFactor),
            notes: r.notes ?? '',
            updated_at: r.updatedAt.toISOString(),
          })),
        )
      }

      if (mod === 'vault' && action === 'getApp') {
        const app_uuid = typeof req.query.app_uuid === 'string' ? req.query.app_uuid : ''
        if (!app_uuid) return fail(res, 400, 'Missing app_uuid', traceId)
        const [r] = await db
          .select()
          .from(vaultApps)
          .where(and(whereOrgFilter(vaultApps, budgetScope), eq(vaultApps.id, app_uuid)))
          .limit(1)
        if (!r) return fail(res, 404, 'Not found', traceId)
        return ok(res, {
          app_uuid: r.id,
          app_name: r.appName,
          category: r.category ?? '',
          logo: r.logo ?? '',
          app_link: r.appLink ?? '',
          username: r.username ?? '',
          password: r.password ?? '',
          two_factor_enabled: Boolean(r.twoFactor),
          notes: r.notes ?? '',
          updated_at: r.updatedAt.toISOString(),
        })
      }

      if (mod === 'insurance' && action === 'getEntries') {
        const rows = await db.select().from(insurance).where(whereOrgFilter(insurance, budgetScope)).orderBy(desc(insurance.updatedAt))
        return ok(
          res,
          rows.map((r) => ({
            id: r.id,
            policy_type: r.policyType ?? '',
            plan_name: r.planName,
            insurer: r.insurer ?? '',
            app_uuid: r.appId ?? undefined,
            policy_number: r.policyNo ?? '',
            policy_owner: r.owner ?? '',
            premium_amount: r.premium ?? '',
            premium_mode: r.premiumMode ?? '',
            payment_method: r.paymentMethod ?? '',
            policy_term: '',
            issue_date: r.issueDate ? String(r.issueDate) : '',
            maturity_date: r.maturityDate ? String(r.maturityDate) : '',
            sum_assured: r.sumAssured ?? '',
            cash_value: r.cashValue ?? '',
            nominee_name: r.nominee ?? '',
            notes: r.notes ?? '',
            updated_at: r.updatedAt.toISOString(),
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
            const avgPrice = units > 0 ? purchased / units : 0
            const lastPrice = units > 0 ? currentValue / units : 0
            const name = r.fundName
            return {
              symbol: r.schemeCode || r.folioNo || name.slice(0, 12),
              company: name,
              isin: '',
              qty: units,
              avgPrice,
              lastPrice,
              pnl: num(r.profitLoss),
              dayChangePct: 0,
              synced: '',
            }
          }),
        )
      }

      if (action === 'init') {
        const settingsBlob = await loadFintrackerSettingsJson(db, em, budgetScope)
        const months = await computeMonths(db, budgetScope)
        const mq = typeof req.query.month === 'string' ? req.query.month : ''
        const yq = typeof req.query.year === 'string' ? req.query.year : ''
        let budgetMonthKey: string
        if (mq && yq) {
          try {
            budgetMonthKey = monthYearKey(mq, yq)
          } catch {
            const c = currentMonthYear()
            budgetMonthKey = monthYearKey(c.month, c.year)
          }
        } else {
          const c = currentMonthYear()
          budgetMonthKey = monthYearKey(c.month, c.year)
        }
        const bud = await loadMergedBudgetForMonth(db, budgetScope, budgetMonthKey)
        const fintracker = parseFintrackerPrefs(settingsBlob)
        return ok(
          res,
          {
            months,
            budget: bud,
            openingBal: readOpeningBal(settingsBlob),
            fintracker,
          },
          traceId,
        )
      }

      if (action === 'getData') {
        const month = typeof req.query.month === 'string' ? req.query.month : ''
        const year = typeof req.query.year === 'string' ? req.query.year : ''
        if (!month || !year) return fail(res, 400, 'month and year are required', traceId)
        const settingsBlob = await loadFintrackerSettingsJson(db, em, budgetScope)
        const prefs = parseFintrackerPrefs(settingsBlob)
        let start: string
        let end: string
        try {
          ;({ start, end } = cycleDateRange(month, year, prefs))
        } catch {
          return fail(res, 400, 'Invalid month or year', traceId)
        }
        const rows = await db
          .select()
          .from(transactions)
          .where(and(whereOrgFilter(transactions, budgetScope), between(transactions.date, start, end)))
          .orderBy(desc(transactions.date))
        return ok(res, rows.map(rowFromDb), traceId)
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
        for (const k of ['goldRate', 'usdToInr', 'loansSpreadsheetId', 'emiSheetName', 'expensesSheetId', 'assetsSheetId']) {
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

      if (mod === 'vault' && action === 'save') {
        const patch: Record<string, unknown> = {}
        if (body.vaultSpreadsheetId !== undefined) patch.vaultSpreadsheetId = body.vaultSpreadsheetId
        await mergeFintrackerSettings(db, em, budgetScope, patch)
        return ok(res, true, traceId)
      }

      if (mod === 'stocks' && action === 'setToken') {
        const token = typeof body.token === 'string' ? body.token : ''
        await mergeFintrackerSettings(db, em, budgetScope, { upstoxToken: token })
        return ok(res, true, traceId)
      }

      if (mod === 'stocks' && action === 'resetAuth') {
        await mergeFintrackerSettings(db, em, budgetScope, { upstoxToken: '' })
        return ok(res, true, traceId)
      }

      if (mod === 'stocks' && action === 'sync') {
        return ok(res, { count: 0 }, traceId)
      }

      if (mod === 'mutualfunds' && action === 'sync') {
        return ok(res, { count: 0 }, traceId)
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
          return ok(res, true, traceId)
        }
      }

      if (mod === 'savings') {
        if (action === 'addEntry') {
          const id = crypto.randomUUID()
          const dateStr = typeof body.date === 'string' ? body.date : new Date().toISOString().slice(0, 10)
          await db.insert(savings).values({
            id,
            orgId: scopeOrgId,
            date: dateStr,
            account: String(body.account ?? ''),
            amount: String(num(body.amount as string | number)),
            description: typeof body.desc === 'string' ? body.desc : typeof body.description === 'string' ? body.description : null,
            type: String(body.type ?? ''),
            toAccount: typeof body.toAccount === 'string' ? body.toAccount : null,
            category: typeof body.category === 'string' ? body.category : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .update(savings)
            .set({
              date: typeof body.date === 'string' ? body.date : undefined,
              account: typeof body.account === 'string' ? body.account : undefined,
              amount: body.amount !== undefined ? String(num(body.amount as string | number)) : undefined,
              description:
                typeof body.desc === 'string'
                  ? body.desc
                  : typeof body.description === 'string'
                    ? body.description
                    : undefined,
              type: typeof body.type === 'string' ? body.type : undefined,
              toAccount: typeof body.toAccount === 'string' ? body.toAccount : undefined,
              category: typeof body.category === 'string' ? body.category : undefined,
            })
            .where(and(whereOrgFilter(savings, budgetScope), eq(savings.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(savings).where(and(whereOrgFilter(savings, budgetScope), eq(savings.id, id)))
          return ok(res, true, traceId)
        }
      }

      if (mod === 'gold') {
        if (action === 'addEntry') {
          const id = crypto.randomUUID()
          const wg = num(body.weight_g as string | number)
          await db.insert(goldItems).values({
            orgId: scopeOrgId,
            id,
            name: String(body.name ?? ''),
            weightG: String(wg),
            personId: typeof body.person_id === 'string' ? body.person_id : null,
            locationId: typeof body.location_id === 'string' ? body.location_id : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .update(goldItems)
            .set({
              name: typeof body.name === 'string' ? body.name : undefined,
              weightG: body.weight_g !== undefined ? String(num(body.weight_g as string | number)) : undefined,
              personId: body.person_id !== undefined ? (typeof body.person_id === 'string' ? body.person_id : null) : undefined,
              locationId: body.location_id !== undefined ? (typeof body.location_id === 'string' ? body.location_id : null) : undefined,
            })
            .where(and(whereOrgFilter(goldItems, budgetScope), eq(goldItems.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(goldItems).where(and(whereOrgFilter(goldItems, budgetScope), eq(goldItems.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'addResource') {
          const id = crypto.randomUUID()
          await db.insert(goldResources).values({
            orgId: scopeOrgId,
            id,
            type: String(body.type ?? ''),
            name: String(body.name ?? ''),
            skip: body.skip === true,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateResource') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .update(goldResources)
            .set({
              type: typeof body.type === 'string' ? body.type : undefined,
              name: typeof body.name === 'string' ? body.name : undefined,
              skip: body.skip !== undefined ? body.skip === true : undefined,
            })
            .where(and(whereOrgFilter(goldResources, budgetScope), eq(goldResources.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteResource') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(goldResources).where(and(whereOrgFilter(goldResources, budgetScope), eq(goldResources.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'addHistory') {
          const id = crypto.randomUUID()
          const dateStr = typeof body.date === 'string' ? body.date : new Date().toISOString().slice(0, 10)
          await db.insert(goldHistory).values({
            orgId: scopeOrgId,
            id,
            date: dateStr,
            type: String(body.type ?? 'IN'),
            name: String(body.name ?? ''),
            weightG: String(num(body.weight_g as string | number)),
            note: typeof body.note === 'string' ? body.note : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateHistory') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .update(goldHistory)
            .set({
              date: typeof body.date === 'string' ? body.date : undefined,
              type: typeof body.type === 'string' ? body.type : undefined,
              name: typeof body.name === 'string' ? body.name : undefined,
              weightG: body.weight_g !== undefined ? String(num(body.weight_g as string | number)) : undefined,
              note: typeof body.note === 'string' ? body.note : undefined,
            })
            .where(and(whereOrgFilter(goldHistory, budgetScope), eq(goldHistory.id, id)))
          return ok(res, { success: true }, traceId)
        }
        if (action === 'deleteHistory') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(goldHistory).where(and(whereOrgFilter(goldHistory, budgetScope), eq(goldHistory.id, id)))
          return ok(res, { success: true }, traceId)
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
            endDate: typeof body.end_date === 'string' ? body.end_date : typeof body.endDate === 'string' ? body.endDate : null,
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
              endDate: typeof body.end_date === 'string' ? body.end_date : undefined,
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
          return ok(res, true, traceId)
        }
      }

      if (mod === 'vault') {
        if (action === 'addEntry') {
          const id = crypto.randomUUID()
          await db.insert(bankingRecords).values({
            orgId: scopeOrgId,
            id,
            holderName: typeof body.account_holder_name === 'string' ? body.account_holder_name : null,
            bankName: String(body.bank_name ?? ''),
            accountNo: typeof body.account_no === 'string' ? body.account_no : null,
            ifsc: typeof body.ifsc === 'string' ? body.ifsc : null,
            cif: typeof body.cif === 'string' ? body.cif : null,
            username: typeof body.username === 'string' ? body.username : null,
            password: typeof body.password === 'string' ? body.password : null,
            transactionPassword: typeof body.transaction_password === 'string' ? body.transaction_password : null,
            profilePassword: typeof body.profile_password === 'string' ? body.profile_password : null,
            mpin: typeof body.mpin === 'string' ? body.mpin : null,
            appUuid: typeof body.app_uuid === 'string' ? body.app_uuid : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .update(bankingRecords)
            .set({
              holderName: typeof body.account_holder_name === 'string' ? body.account_holder_name : undefined,
              bankName: typeof body.bank_name === 'string' ? body.bank_name : undefined,
              accountNo: typeof body.account_no === 'string' ? body.account_no : undefined,
              ifsc: typeof body.ifsc === 'string' ? body.ifsc : undefined,
              cif: typeof body.cif === 'string' ? body.cif : undefined,
              username: typeof body.username === 'string' ? body.username : undefined,
              password: typeof body.password === 'string' ? body.password : undefined,
              transactionPassword: typeof body.transaction_password === 'string' ? body.transaction_password : undefined,
              profilePassword: typeof body.profile_password === 'string' ? body.profile_password : undefined,
              mpin: typeof body.mpin === 'string' ? body.mpin : undefined,
              appUuid: typeof body.app_uuid === 'string' ? body.app_uuid : undefined,
              updatedAt: new Date(),
            })
            .where(and(whereOrgFilter(bankingRecords, budgetScope), eq(bankingRecords.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(bankingRecords).where(and(whereOrgFilter(bankingRecords, budgetScope), eq(bankingRecords.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'addApp') {
          const id = crypto.randomUUID()
          await db.insert(vaultApps).values({
            orgId: scopeOrgId,
            id,
            appName: String(body.app_name ?? ''),
            category: typeof body.category === 'string' ? body.category : null,
            logo: typeof body.logo === 'string' ? body.logo : null,
            appLink: typeof body.app_link === 'string' ? body.app_link : null,
            username: typeof body.username === 'string' ? body.username : null,
            password: typeof body.password === 'string' ? body.password : null,
            twoFactor: Boolean(body.two_factor_enabled),
            notes: typeof body.notes === 'string' ? body.notes : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateApp') {
          const app_uuid = typeof body.app_uuid === 'string' ? body.app_uuid : ''
          if (!app_uuid) return fail(res, 400, 'Missing app_uuid', traceId)
          await db
            .update(vaultApps)
            .set({
              appName: typeof body.app_name === 'string' ? body.app_name : undefined,
              category: typeof body.category === 'string' ? body.category : undefined,
              logo: typeof body.logo === 'string' ? body.logo : undefined,
              appLink: typeof body.app_link === 'string' ? body.app_link : undefined,
              username: typeof body.username === 'string' ? body.username : undefined,
              password: typeof body.password === 'string' ? body.password : undefined,
              twoFactor:
                body.two_factor_enabled !== undefined ? Boolean(body.two_factor_enabled) : undefined,
              notes: typeof body.notes === 'string' ? body.notes : undefined,
              updatedAt: new Date(),
            })
            .where(and(whereOrgFilter(vaultApps, budgetScope), eq(vaultApps.id, app_uuid)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteApp') {
          const app_uuid = typeof body.app_uuid === 'string' ? body.app_uuid : ''
          if (!app_uuid) return fail(res, 400, 'Missing app_uuid', traceId)
          await db.delete(vaultApps).where(and(whereOrgFilter(vaultApps, budgetScope), eq(vaultApps.id, app_uuid)))
          return ok(res, true, traceId)
        }
      }

      if (mod === 'insurance') {
        if (action === 'addEntry') {
          const id = crypto.randomUUID()
          await db.insert(insurance).values({
            orgId: scopeOrgId,
            id,
            policyType: typeof body.policy_type === 'string' ? body.policy_type : null,
            planName: String(body.plan_name ?? ''),
            insurer: typeof body.insurer === 'string' ? body.insurer : null,
            appId: typeof body.app_uuid === 'string' ? body.app_uuid : null,
            policyNo: typeof body.policy_number === 'string' ? body.policy_number : null,
            owner: typeof body.policy_owner === 'string' ? body.policy_owner : null,
            premium:
              body.premium_amount !== undefined && body.premium_amount !== ''
                ? String(num(body.premium_amount as string | number))
                : null,
            premiumMode: typeof body.premium_mode === 'string' ? body.premium_mode : null,
            paymentMethod: typeof body.payment_method === 'string' ? body.payment_method : null,
            issueDate: typeof body.issue_date === 'string' ? body.issue_date : null,
            maturityDate: typeof body.maturity_date === 'string' ? body.maturity_date : null,
            sumAssured:
              body.sum_assured !== undefined && body.sum_assured !== ''
                ? String(num(body.sum_assured as string | number))
                : null,
            cashValue:
              body.cash_value !== undefined && body.cash_value !== ''
                ? String(num(body.cash_value as string | number))
                : null,
            nominee: typeof body.nominee_name === 'string' ? body.nominee_name : null,
            notes: typeof body.notes === 'string' ? body.notes : null,
          })
          return ok(res, id, traceId)
        }
        if (action === 'updateEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db
            .update(insurance)
            .set({
              policyType: typeof body.policy_type === 'string' ? body.policy_type : undefined,
              planName: typeof body.plan_name === 'string' ? body.plan_name : undefined,
              insurer: typeof body.insurer === 'string' ? body.insurer : undefined,
              appId: typeof body.app_uuid === 'string' ? body.app_uuid : undefined,
              policyNo: typeof body.policy_number === 'string' ? body.policy_number : undefined,
              owner: typeof body.policy_owner === 'string' ? body.policy_owner : undefined,
              premium:
                body.premium_amount !== undefined ? String(num(body.premium_amount as string | number)) : undefined,
              premiumMode: typeof body.premium_mode === 'string' ? body.premium_mode : undefined,
              paymentMethod: typeof body.payment_method === 'string' ? body.payment_method : undefined,
              issueDate: typeof body.issue_date === 'string' ? body.issue_date : undefined,
              maturityDate: typeof body.maturity_date === 'string' ? body.maturity_date : undefined,
              sumAssured: body.sum_assured !== undefined ? String(num(body.sum_assured as string | number)) : undefined,
              cashValue: body.cash_value !== undefined ? String(num(body.cash_value as string | number)) : undefined,
              nominee: typeof body.nominee_name === 'string' ? body.nominee_name : undefined,
              notes: typeof body.notes === 'string' ? body.notes : undefined,
              updatedAt: new Date(),
            })
            .where(and(whereOrgFilter(insurance, budgetScope), eq(insurance.id, id)))
          return ok(res, true, traceId)
        }
        if (action === 'deleteEntry') {
          const id = typeof body.id === 'string' ? body.id : ''
          if (!id) return fail(res, 400, 'Missing id', traceId)
          await db.delete(insurance).where(and(whereOrgFilter(insurance, budgetScope), eq(insurance.id, id)))
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
            endDate: typeof body.end_date === 'string' ? body.end_date : null,
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
              endDate: typeof body.end_date === 'string' ? body.end_date : undefined,
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
        const budgets = body.budgets as { id?: string; name: string; amount: number }[] | undefined
        if (!Array.isArray(budgets)) return fail(res, 400, 'Invalid budgets', traceId)
        const mk = resolvePostedBudgetMonthYear(body)
        if (!mk.ok) return fail(res, 400, mk.error, traceId)
        await db.delete(budget).where(and(budgetRowsBaseWhere(budgetScope), eq(budget.monthYear, mk.key)))
        for (const e of budgets) {
          if (!e?.name?.trim()) continue
          await db.insert(budget).values({
            id: e.id && typeof e.id === 'string' ? e.id : crypto.randomUUID(),
            orgId: scopeOrgId,
            monthYear: mk.key,
            category: e.name.trim(),
            amount: String(num(e.amount)),
          })
        }
        return ok(res, true, traceId)
      }

      if (action === 'addBudgetEntry') {
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const amt = num(body.amt as string | number)
        if (!name) return fail(res, 400, 'Invalid budget entry', traceId)
        const mk = resolvePostedBudgetMonthYear(body)
        if (!mk.ok) return fail(res, 400, mk.error, traceId)
        const base = budgetRowsBaseWhere(budgetScope)
        const [existing] = await db
          .select()
          .from(budget)
          .where(and(base, eq(budget.monthYear, mk.key), eq(budget.category, name)))
          .limit(1)
        if (existing) {
          await db
            .update(budget)
            .set({ amount: String(amt) })
            .where(eq(budget.id, existing.id))
          return ok(res, { id: existing.id, name, amount: amt, monthYear: mk.key }, traceId)
        }
        const id = crypto.randomUUID()
        await db.insert(budget).values({
          id,
          orgId: scopeOrgId,
          monthYear: mk.key,
          category: name,
          amount: String(amt),
        })
        return ok(res, { id, name, amount: amt, monthYear: mk.key }, traceId)
      }

      if (action === 'updateBudgetEntry') {
        const id = typeof body.id === 'string' ? body.id : ''
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const amt = num(body.amt as string | number)
        if (!id || !name) return fail(res, 400, 'Invalid budget entry', traceId)
        const base = budgetRowsBaseWhere(budgetScope)
        const [existingRow] = await db.select().from(budget).where(and(eq(budget.id, id), base)).limit(1)
        if (!existingRow) return fail(res, 404, 'Budget entry not found', traceId)
        const mk = resolvePostedBudgetMonthYearOrDefault(body, existingRow.monthYear)
        if (!mk.ok) return fail(res, 400, mk.error, traceId)
        await db
          .delete(budget)
          .where(
            and(base, eq(budget.monthYear, mk.key), eq(budget.category, name), ne(budget.id, id)),
          )
        await db
          .update(budget)
          .set({ monthYear: mk.key, category: name, amount: String(amt) })
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
        await db.insert(transactions).values({
          id,
          orgId: scopeOrgId,
          date: iso,
          description: String(body.desc ?? ''),
          amount: String(num(body.a as string | number)),
          category: String(body.c ?? ''),
          type: typeStr,
          mode: String(body.m ?? ''),
          transferTo: xferTo,
          notes: typeof body.notes === 'string' ? body.notes : '',
          monthYear: my,
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
        await db
          .update(transactions)
          .set({
            date: iso,
            description: String(body.desc ?? ''),
            amount: String(num(body.a as string | number)),
            category: String(body.c ?? ''),
            type: typeStr,
            mode: String(body.m ?? ''),
            transferTo: xferTo,
            notes: typeof body.notes === 'string' ? body.notes : '',
            monthYear: my,
          })
          .where(and(whereOrgFilter(transactions, budgetScope), eq(transactions.id, id)))
        return ok(res, true, traceId)
      }

      if (action === 'deleteRow') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!id) return fail(res, 400, 'Missing id', traceId)
        await db.delete(transactions).where(and(whereOrgFilter(transactions, budgetScope), eq(transactions.id, id)))
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
