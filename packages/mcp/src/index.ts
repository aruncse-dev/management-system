#!/usr/bin/env node
/**
 * Read-only MCP server over fintracker data.
 *
 * READ-ONLY BY CONSTRUCTION: every tool here routes through
 * `@fintracker-vault/db`'s `queries/analytics` module plus plain SELECTs.
 * Nothing in this file performs INSERT, UPDATE or DELETE, and no tool should
 * ever be added that does — entries are made in the app UI, deliberately.
 *
 * Connection details come from the same gitignored env files the apps use.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { and, between, desc, eq, isNull } from 'drizzle-orm'
import {
  getDb,
  getCommittedMonthlyOutflow,
  getDerivedMonthlyIncome,
  getIncomeExpenseTrend,
  getLoanOutstanding,
  getNetWorth,
  organizations,
  subscriptions,
  transactions,
} from '@fintracker-vault/db'
import {
  buildCycleRanges,
  closeAllWithin,
  parseFintrackerPrefs,
  planPayoff,
  monthsToPayoff,
} from '@fintracker-vault/utils'


/**
 * Load the same gitignored env files the apps use, so `.mcp.json` never has to
 * carry a database credential. Shell values already set always win.
 */
function loadEnvFiles(): void {
  const here = dirname(fileURLToPath(import.meta.url))
  const root = resolve(here, '../../..') // packages/mcp/dist -> repo root
  const candidates = [
    resolve(root, '.env'),
    resolve(root, '.env.local'),
    resolve(root, 'packages/apps/fintracker/.env.local'),
  ]
  for (const file of candidates) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
      if (!m) continue
      const key = m[1]
      let value = m[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!value) continue
      if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value
    }
  }
}

const MNS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function currentMonthYear(): { month: string; year: string } {
  const d = new Date()
  return { month: MNS[d.getMonth()], year: String(d.getFullYear()) }
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

const inr = (n: number) => Math.round(n).toLocaleString('en-IN')

/**
 * Which org to report on.
 *
 * `FINTRACKER_ORG_ID` pins it. Otherwise pick the single active org, so a
 * one-org setup needs no configuration. Ambiguity is an error rather than a
 * guess — reporting the wrong org's finances silently would be worse.
 */
let cachedOrgId: string | null | undefined
async function resolveOrgId(): Promise<string | null> {
  if (cachedOrgId !== undefined) return cachedOrgId
  const pinned = process.env.FINTRACKER_ORG_ID?.trim()
  if (pinned) {
    cachedOrgId = pinned
    return cachedOrgId
  }
  const db = getDb()
  const rows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.status, 'active'))
  if (rows.length === 1) {
    cachedOrgId = rows[0].id
    return cachedOrgId
  }
  if (rows.length === 0) {
    cachedOrgId = null
    return cachedOrgId
  }
  throw new Error(
    `Multiple active organizations found (${rows
      .map((r) => `${r.name}=${r.id}`)
      .join(', ')}). Set FINTRACKER_ORG_ID to choose one.`,
  )
}

async function loadPrefsAndSettings(orgId: string | null) {
  const db = getDb()
  if (!orgId) return { prefs: parseFintrackerPrefs({}), goldRate: 0, usdToInr: 83 }
  const [row] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  const blob = (row?.settings && typeof row.settings === 'object' ? row.settings : {}) as Record<
    string,
    unknown
  >
  return {
    prefs: parseFintrackerPrefs(blob),
    goldRate: num(blob.goldRate),
    usdToInr: num(blob.usdToInr) || 83,
  }
}

async function rangesFor(months: number) {
  const orgId = await resolveOrgId()
  const { prefs, goldRate, usdToInr } = await loadPrefsAndSettings(orgId)
  const { month, year } = currentMonthYear()
  return { orgId, goldRate, usdToInr, ranges: buildCycleRanges(month, year, prefs, months) }
}

const text = (s: string) => ({ content: [{ type: 'text' as const, text: s }] })

const server = new McpServer({ name: 'fintracker', version: '1.0.0' })

server.tool(
  'get_net_worth',
  'Total assets (savings, gold, stocks, mutual funds) minus liabilities (EMI, jewel and cash loans).',
  {},
  async () => {
    const { orgId, goldRate } = await rangesFor(1)
    const nw = await getNetWorth(getDb(), orgId, { goldRatePerGram: goldRate })
    return text(
      [
        `Net worth: ${inr(nw.net)}`,
        '',
        'Assets:',
        `  savings       ${inr(nw.assets.savings)}`,
        `  gold          ${inr(nw.assets.gold)}  (at ${goldRate}/g)`,
        `  stocks        ${inr(nw.assets.stocks)}`,
        `  mutual funds  ${inr(nw.assets.mutualFunds)}`,
        `  total         ${inr(nw.assets.total)}`,
        '',
        'Liabilities:',
        `  emi loans     ${inr(nw.liabilities.emi)}`,
        `  jewel loans   ${inr(nw.liabilities.jewel)}`,
        `  cash loans    ${inr(nw.liabilities.cash)}`,
        `  total         ${inr(nw.liabilities.total)}`,
        '',
        'Note: EMI outstanding is total-payable minus paid, so it includes future interest.',
      ].join('\n'),
    )
  },
)

server.tool(
  'get_income_expense_trend',
  'Income, expense and net per billing cycle for the last N months. Cycle-aware (respects the org anchor day).',
  { months: z.number().int().min(2).max(24).default(6) },
  async ({ months }) => {
    const { orgId, ranges } = await rangesFor(months)
    const trend = await getIncomeExpenseTrend(getDb(), orgId, ranges)
    const lines = trend.map(
      (t) =>
        `${t.key}  income ${inr(t.income).padStart(12)}  expense ${inr(t.expense).padStart(12)}  net ${inr(t.net).padStart(12)}`,
    )
    return text([`Last ${months} cycles:`, ...lines].join('\n'))
  },
)

server.tool(
  'get_cash_position',
  'Trailing average income, average expense and monthly surplus derived from actual transactions, plus fixed monthly commitments.',
  { months: z.number().int().min(2).max(24).default(6) },
  async ({ months }) => {
    const { orgId, usdToInr, ranges } = await rangesFor(months)
    const db = getDb()
    // Exclude the current, incomplete cycle from the averages.
    const [income, committed] = await Promise.all([
      getDerivedMonthlyIncome(db, orgId, ranges.slice(0, -1)),
      getCommittedMonthlyOutflow(db, orgId, { usdToInr }),
    ])
    return text(
      [
        `Average monthly income   ${inr(income.avgIncome)}   (over ${income.sampleMonths} cycles with income)`,
        `Average monthly expense  ${inr(income.avgExpense)}`,
        `Monthly surplus          ${inr(income.surplus)}${income.surplus < 0 ? '   *** DEFICIT ***' : ''}`,
        '',
        `Committed each month:`,
        `  loan EMIs      ${inr(committed.emi)}`,
        `  subscriptions  ${inr(committed.subscriptions)}  (active only)`,
        `  total          ${inr(committed.total)}`,
        '',
        `Renewals in the next 30 days: ${committed.upcomingRenewals.length}`,
        ...committed.upcomingRenewals.map(
          (r) => `  ${r.name}  ${inr(r.amount)}  in ${r.daysLeft}d (${r.dueDate})`,
        ),
      ].join('\n'),
    )
  },
)

server.tool(
  'get_loans',
  'All open loans with outstanding balance, interest rate and contractual monthly payment.',
  {},
  async () => {
    const { orgId } = await rangesFor(1)
    const loans = await getLoanOutstanding(getDb(), orgId)
    if (!loans.length) return text('No open loans.')
    const lines = loans.map(
      (l) =>
        `${l.name}  [${l.kind}]  outstanding ${inr(l.outstanding)}  rate ${l.annualRate}%  monthly ${inr(l.monthlyPayment)}`,
    )
    const total = loans.reduce((s, l) => s + l.outstanding, 0)
    return text([...lines, '', `Total outstanding: ${inr(total)}`].join('\n'))
  },
)

server.tool(
  'suggest_loan_payoff',
  'Payoff analysis: avalanche vs snowball ordering with projected close dates, plus what it would take to close everything within a target window.',
  {
    targetMonths: z.number().int().min(1).max(120).default(12),
    extraPerMonth: z
      .number()
      .min(0)
      .default(0)
      .describe('Additional amount available each month beyond the derived surplus.'),
    months: z.number().int().min(2).max(24).default(6),
  },
  async ({ targetMonths, extraPerMonth, months }) => {
    const { orgId, ranges } = await rangesFor(months)
    const db = getDb()
    const [loans, income] = await Promise.all([
      getLoanOutstanding(db, orgId),
      getDerivedMonthlyIncome(db, orgId, ranges.slice(0, -1)),
    ])
    if (!loans.length) return text('No open loans — nothing to plan.')

    const surplus = income.surplus + extraPerMonth
    const usable = Math.max(surplus, 0)
    const avalanche = planPayoff(loans, usable, 'avalanche')
    const snowball = planPayoff(loans, usable, 'snowball')
    const target = closeAllWithin(loans, targetMonths, usable)

    const fmtPlan = (plan: typeof avalanche) =>
      plan.map(
        (p) =>
          `  ${p.order}. ${p.name} [${p.kind}] rate ${p.annualRate}% outstanding ${inr(p.outstanding)} — closes in ${
            Number.isFinite(p.closesInMonths) ? `${p.closesInMonths} months` : 'never at this payment'
          }`,
      )

    const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0)
    const contractual = loans.reduce((s, l) => s + l.monthlyPayment, 0)

    return text(
      [
        `Total outstanding: ${inr(totalOutstanding)} across ${loans.length} loans`,
        `Derived monthly surplus: ${inr(income.surplus)}${extraPerMonth ? ` (+${inr(extraPerMonth)} extra = ${inr(surplus)})` : ''}`,
        `Contractual payments already committed: ${inr(contractual)}/month`,
        '',
        surplus < 0
          ? `WARNING: surplus is negative. Spending exceeds income by ${inr(Math.abs(surplus))}/month, so nothing is free for accelerated payoff. The projections below assume 0 extra and only the contractual payments.`
          : `Available to attack debt: ${inr(usable)}/month on top of contractual payments.`,
        '',
        'Avalanche (highest rate first — least total interest):',
        ...fmtPlan(avalanche),
        '',
        'Snowball (smallest balance first — fastest first win):',
        ...fmtPlan(snowball),
        '',
        `To close everything within ${targetMonths} months:`,
        `  required   ${inr(target.requiredMonthly)}/month`,
        `  available  ${inr(target.availableMonthly)}/month`,
        target.feasible
          ? '  FEASIBLE at current capacity.'
          : `  SHORT by ${inr(target.shortfall)}/month. Either extend the window or cut expenses by that much.`,
        '',
        'Single-loan sensitivity (months to clear at contractual payment alone):',
        ...loans.map((l) => {
          const m = monthsToPayoff(l.outstanding, l.monthlyPayment, l.annualRate)
          return `  ${l.name}: ${Number.isFinite(m) ? `${m} months` : 'never — no scheduled payment'}`
        }),
      ].join('\n'),
    )
  },
)

server.tool(
  'get_transactions',
  'Raw transactions in a date range (ISO yyyy-mm-dd), newest first.',
  {
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    limit: z.number().int().min(1).max(500).default(100),
  },
  async ({ start, end, limit }) => {
    const orgId = await resolveOrgId()
    const rows = await getDb()
      .select()
      .from(transactions)
      .where(
        and(
          orgId ? eq(transactions.orgId, orgId) : isNull(transactions.orgId),
          between(transactions.date, start, end),
        ),
      )
      .orderBy(desc(transactions.date))
      .limit(limit)
    if (!rows.length) return text(`No transactions between ${start} and ${end}.`)
    const lines = rows.map(
      (r) =>
        `${r.date}  ${String(r.type).padEnd(8)} ${inr(num(r.amount)).padStart(10)}  ${r.category ?? '-'}  via ${r.mode ?? '-'}  ${r.description}`,
    )
    return text([`${rows.length} transactions ${start} → ${end}:`, ...lines].join('\n'))
  },
)

server.tool(
  'get_subscriptions',
  'Active recurring subscriptions with billing cycle and monthly-equivalent cost.',
  {},
  async () => {
    const orgId = await resolveOrgId()
    const rows = await getDb()
      .select()
      .from(subscriptions)
      .where(
        and(
          orgId ? eq(subscriptions.orgId, orgId) : isNull(subscriptions.orgId),
          eq(subscriptions.status, 'active'),
        ),
      )
    if (!rows.length) return text('No active subscriptions.')
    const lines = rows.map(
      (s) =>
        `${s.name}  ${inr(num(s.amount))} ${s.currency}/${s.billingCycle}  ${s.autopay ? 'autopay' : 'manual'}  ${s.paymentMethod ?? '-'}`,
    )
    return text([`${rows.length} active subscriptions:`, ...lines].join('\n'))
  },
)

async function main() {
  loadEnvFiles()
  if (!process.env.DATABASE_URL) {
    console.error('[fintracker-mcp] DATABASE_URL is not set. See packages/apps/fintracker/.env.local')
    process.exit(1)
  }
  await server.connect(new StdioServerTransport())
}

main().catch((e) => {
  console.error('[fintracker-mcp]', e instanceof Error ? e.message : e)
  process.exit(1)
})
