import { useEffect, useMemo, useState } from 'react'
import { localIsoDate } from '@fintracker-vault/utils'
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Gauge,
  Layers,
  PieChart,
  Users2,
  Wallet,
} from 'lucide-react'
import { useStore } from '../store'
import { acctFlows, catMap, budgetSummary, monthYearApiKey, sumType } from '../utils'
import { budgetAppliesToLabelMonth, cycleDateRange } from '../expenseCycle'
import { useFormatMoney } from '../hooks/useFormatMoney'
import { useFintrackerModes } from '../context/FintrackerModesContext'
import {
  BalanceRow,
  HoldingCard,
  KpiCard,
  KpiGrid,
  ListStack,
  LoadingState,
  ModalShell,
  RightLegendDonut,
  SectionBlock,
  SectionChip,
  UiCard,
} from '../ui'
import { api, type DashboardSummary } from '../api'
import { readSnapshot, writeSnapshot } from '../lib/snapshotCache'
import { buildReminders } from '../lib/reminders'
import { forecastCycle } from '../lib/forecast'
import { RemindersCard } from '../components/RemindersCard'
import { ForecastCard } from '../components/ForecastCard'
import { accountKindMeta } from '../config'
import { AccountKindPills, kindsPresent } from '../components/AccountKindPills'

const DAY_MS = 86_400_000
/**
 * Cycles of history to ask for. Only the previous one is used, for the
 * `▲N% vs Sep` delta on the Income KPI — the six-cycle trend chart this once
 * fed now lives only on `/overview`, so there is no reason to fetch six.
 */
const TREND_MONTHS = 2
type CategoryStatus = 'over' | 'critical' | 'near' | 'ok' | 'none'

/** Inclusive day count between two ISO dates. */
function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso + 'T00:00:00').getTime()
  const b = new Date(endIso + 'T00:00:00').getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / DAY_MS) + 1
}

/** `2026-09` → `Sep`, for chart axis labels. */
function shortMonth(key: string): string {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return Number.isFinite(d.getTime()) ? d.toLocaleString('en-US', { month: 'short' }) : key
}


type Props = {
  onCategoryClick?: (category: string) => void
}

/**
 * Monthly Expenses dashboard.
 *
 * Four sections and nothing else: the cycle's cash flow, one line on what is
 * available against what was borrowed, the categories worth acting on, and a
 * six-cycle trend that no tab shows.
 *
 * Deliberately absent: per-account rows and per-card totals. Those are the
 * Accounts and Credits tabs, and repeating them here made the dashboard a
 * second copy of both. `Sources` gives each one figure and links out.
 */
export default function Dashboard({ onCategoryClick }: Props) {
  const { state } = useStore()
  const fmt = useFormatMoney()
  const { rows, budget, month, year, fintracker, openingBal } = state
  const {
    accounts: dbAccounts,
    monthlyAccountNames,
    paymentModeOptions,
    creditCardNames,
    informalCreditNames,
  } = useFintrackerModes()

  // Optional garnish: supplies the trend chart and the vs-previous delta. If it
  // fails the page still renders entirely from the store.
  /** Which source breakdown is open, if any. Detail lives here rather than in a
      row per source, which made the section seven cards tall. */
  const [sheet, setSheet] = useState<'accounts' | 'credit' | null>(null)
  /** Account-kind filter inside the accounts sheet; `''` shows every kind. */
  const [sheetKind, setSheetKind] = useState('')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  /**
   * False while `summary` is the device snapshot. Due dates and balances in a
   * snapshot can be days old, so reminders and notifications wait for a fresh one.
   */
  const [summaryFresh, setSummaryFresh] = useState(false)
  useEffect(() => {
    let cancelled = false
    const snapKey = `summary:${month}-${year}`
    // Last copy at once; the fresh summary replaces it when it lands.
    setSummary(readSnapshot<DashboardSummary>(snapKey))
    setSummaryFresh(false)
    void api
      .getDashboardSummary(month, year, TREND_MONTHS)
      .then((d) => {
        if (cancelled) return
        setSummary(d)
        setSummaryFresh(true)
        writeSnapshot(snapKey, d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [month, year])

  const viewKey = useMemo(() => {
    try {
      return monthYearApiKey(month, year)
    } catch {
      return ''
    }
  }, [month, year])

  /** Budget rows that apply to the displayed month — `budget.tsx` filters the same way. */
  const applicableBudget = useMemo(
    () => (viewKey ? budget.filter((e) => budgetAppliesToLabelMonth(e, viewKey)) : budget),
    [budget, viewKey],
  )

  const cycle = useMemo(() => {
    try {
      return cycleDateRange(month, year, fintracker)
    } catch {
      return null
    }
  }, [month, year, fintracker])

  const flows = useMemo(
    () => acctFlows(rows, openingBal, monthlyAccountNames, paymentModeOptions),
    [rows, openingBal, monthlyAccountNames, paymentModeOptions],
  )

  const creditTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    const counts: Record<string, number> = {}
    for (const name of [...creditCardNames, ...informalCreditNames]) {
      totals[name] = 0
      counts[name] = 0
    }
    for (const r of rows) {
      if (r.m in totals) {
        totals[r.m] += r.a
        counts[r.m] += 1
      }
    }
    const charged = Object.values(totals).reduce((s, v) => s + v, 0)
    const active = Object.values(totals).filter((v) => v > 0).length
    const sources = [...creditCardNames, ...informalCreditNames]
      .map((name) => ({
        name,
        amount: totals[name] || 0,
        count: counts[name] || 0,
        card: creditCardNames.includes(name),
      }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    return { charged, active, sources }
  }, [rows, creditCardNames, informalCreditNames])

  const reminders = useMemo(
    () => buildReminders(summaryFresh ? summary : null, [...creditCardNames, ...informalCreditNames]),
    [summary, summaryFresh, creditCardNames, informalCreditNames],
  )

  if (state.loading) return <div className="pg"><LoadingState /></div>

  const inc = sumType(rows, 'Income')
  // Expense only. Folding `Savings` in here made `Net` stop being
  // `Income − Expense`, which is the one thing the three KPIs must agree on.
  // Legacy `Savings` rows are still counted as an outflow by the trend endpoint;
  // this page reports the cycle, not the ledger.
  const exp = sumType(rows, 'Expense')
  const net = inc - exp
  const cm = catMap(rows, budget)
  const { totalBudget } = budgetSummary(applicableBudget, cm)

  // ---- Cycle position -------------------------------------------------------
  const totalDays = cycle ? daysBetween(cycle.start, cycle.end) : 0
  const todayIso = localIsoDate()
  let elapsedDays = totalDays
  if (cycle && totalDays > 0) {
    if (todayIso < cycle.start) elapsedDays = 0
    else if (todayIso <= cycle.end) elapsedDays = daysBetween(cycle.start, todayIso)
  }
  const isCurrent = Boolean(cycle && todayIso >= cycle.start && todayIso <= cycle.end)
  const overBudget = totalBudget > 0 && exp > totalBudget
  const budgetNote =
    totalBudget <= 0
      ? undefined
      : overBudget
        ? `${fmt(exp - totalBudget)} over budget`
        : `${fmt(totalBudget - exp)} left`

  // ---- vs previous cycle ----------------------------------------------------
  const trend = summary?.trend ?? []
  const prev = trend.length > 1 ? trend[trend.length - 2] : null
  const pct = (now: number, before: number) =>
    before > 0 ? Math.round(((now - before) / before) * 100) : null
  const incPct = prev ? pct(inc, prev.income) : null
  const prevLabel = prev ? shortMonth(prev.key) : ''
  const incNote =
    prev && incPct !== null
      ? `${incPct > 0 ? '▲' : incPct < 0 ? '▼' : ''}${Math.abs(incPct)}% vs ${prevLabel}`
      : undefined

  // ---- Sources ---------------------------------------------------------------
  // The Accounts and Credits tabs are gone; Settings only names sources, it holds
  // no amounts. So this section is now the only place per-source figures exist.
  const availableTotal = monthlyAccountNames.reduce((s, n) => s + (flows[n]?.current || 0), 0)
  const creditShare = exp > 0 ? Math.round((creditTotals.charged / exp) * 100) : 0
  // `flows` is keyed by account NAME (transactions name their source), while the
  // kind lives on the account row — so the two are joined by name here too.
  const kindByAccountName = new Map(dbAccounts.map((a) => [a.name, a.accountKind || 'savings_bank']))
  const accountRows = monthlyAccountNames
    .map((name) => ({
      name,
      kind: kindByAccountName.get(name) || 'savings_bank',
      ...(flows[name] || { inflow: 0, outflow: 0, current: 0 }),
    }))
    .sort((a, b) => b.current - a.current)
  const accountKindsPresent = kindsPresent(accountRows.map((a) => ({ accountKind: a.kind })))
  const visibleAccountRows = sheetKind ? accountRows.filter((a) => a.kind === sheetKind) : accountRows
  const sheetIsEmpty =
    sheet === 'accounts' ? accountRows.length === 0 : creditTotals.sources.length === 0
  const sheetTotalTone =
    sheet === 'accounts' ? (availableTotal >= 0 ? 'green' : 'red') : 'red'

  // ---- Categories -----------------------------------------------------------
  const budgetByName = new Map(
    applicableBudget.filter((b) => b.name.trim()).map((b) => [b.name, b.amount]),
  )
  const allCategories = Object.entries(cm)
    .filter(([, amount]) => amount > 0)
    .map(([name, spent]) => {
      const cap = budgetByName.get(name) ?? 0
      const hasCap = cap > 0
      const pct = hasCap ? (spent / cap) * 100 : 0
      const status: CategoryStatus = !hasCap
        ? 'none'
        : spent > cap
          ? 'over'
          : pct >= 90
            ? 'critical'
            : pct >= 75
              ? 'near'
              : 'ok'
      return { name, spent, cap, hasCap, pct, status, over: status === 'over' }
    })

  /**
   * Only the categories that broke their budget, worst overage first.
   *
   * The section is an exception report, not a spend leaderboard: a full ranked
   * list with a "show more" toggle restated what the Budget tab already shows
   * in full. When nothing is over, the section does not render at all.
   */
  const overCategories = allCategories
    .filter((c) => c.status === 'over')
    .sort((a, b) => b.pct - a.pct || b.spent - a.spent)
  const totalOverBy = overCategories.reduce((sum, c) => sum + (c.spent - c.cap), 0)

  // ---- Forecast (current cycle only) ------------------------------------------
  const forecast =
    isCurrent && cycle
      ? forecastCycle(
          {
            expense: exp,
            income: inc,
            totalBudget,
            elapsedDays,
            totalDays,
            categories: allCategories.filter((c) => c.hasCap).map(({ name, spent, cap }) => ({ name, spent, cap })),
            avgIncome: summary?.income.avgIncome ?? 0,
            duesBeforeCycleEnd: (summaryFresh ? summary?.committed.upcomingRenewals ?? [] : [])
              .filter((r) => r.daysLeft >= 0 && r.dueDate <= cycle.end)
              .reduce((t, r) => t + r.amount, 0),
          },
          fmt,
        )
      : null

  return (
    <div className="pg dashboard-page ui-kit-page-shell monthly-subpage">
      {/* 1 — The cycle's cash flow. */}
      <SectionBlock
        title="This cycle"
        icon={<Gauge size={14} />}
        right={
          <SectionChip>
            {isCurrent ? `Day ${elapsedDays} of ${totalDays}` : `${totalDays} days · closed`}
          </SectionChip>
        }
      >
        <KpiGrid variant="compact">
          <KpiCard
            label="Income"
            value={fmt(inc)}
            tone="green"
            icon={<ArrowDownRight size={14} />}
            subtitle={incNote}
          />
          <KpiCard
            label="Spend"
            value={fmt(exp)}
            tone="red"
            icon={<ArrowUpRight size={14} />}
            subtitle={budgetNote}
          />
            <KpiCard
              label="Available"
              value={`${availableTotal < 0 ? '−' : ''}${fmt(Math.abs(availableTotal))}`}
              tone={availableTotal >= 0 ? 'green' : 'red'}
              icon={<Wallet size={14} />}
              subtitle={`${monthlyAccountNames.length} accounts`}
              onClick={() => setSheet('accounts')}
            />
            <KpiCard
              label="Spent on credit"
              value={fmt(creditTotals.charged)}
              tone="red"
              icon={<CreditCard size={14} />}
              subtitle={`${creditShare}% of spend`}
              onClick={() => setSheet('credit')}
            />
        </KpiGrid>
      </SectionBlock>

      {/* The KPIs above stay first. Then what is about to be debited (and
          whether the paying account can cover it), and where the cycle is
          heading — both compact, expandable. */}
      {isCurrent && <RemindersCard reminders={reminders} fmt={fmt} />}
      {forecast && <ForecastCard forecast={forecast} fmt={fmt} />}

      {/* 3 — The cycle as a shape, below the figures it summarises.

          Net lives in the donut centre and nowhere else. It used to also be a
          full-width KPI directly above, so the cycle's headline figure appeared
          twice in one column; and the centre used to show a *different* number
          (income minus credit) under the same "NET" label. */}
      <SectionBlock title="Cash flow" icon={<PieChart size={14} />}>
        {inc > 0 || exp > 0 || creditTotals.charged > 0 ? (
          <div className="dash-chart-row dash-chart-row--single">
            <UiCard title="Income vs expense">
              <RightLegendDonut
                compact
                items={[
                  { label: 'Income', value: inc, color: '#22C55E' },
                  { label: 'Expense', value: exp, color: '#EF4444' },
                ].filter((d) => d.value > 0)}
                showCenter
                centerLabel="NET"
                centerValue={`${net < 0 ? '−' : '+'}${fmt(Math.abs(net))}`}
                legendPosition="bottom"
                valueFormatter={fmt}
              />
              <p className={`dash-net-note ui-tone-${net >= 0 ? 'green' : 'red'}`}>
                {net >= 0 ? 'Saved this cycle' : 'Drawn from balances'}
              </p>
            </UiCard>

          </div>
        ) : (
          <UiCard>
            <p className="ui-kit-sheet-empty">No income or spending in this cycle yet.</p>
          </UiCard>
        )}
      </SectionBlock>

      {/* 4 — Budgets that broke this cycle. An exception report: no rows means
          nothing is over, and the Budget tab holds the full list. */}
      {overCategories.length ? (
        <SectionBlock
          title="Over budget"
          icon={<Layers size={14} />}
          right={<SectionChip tone="red">+{fmt(totalOverBy)}</SectionChip>}
        >
          <UiCard>
            <div className="dash-cat-list">
              {overCategories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="dash-cat-row"
                  onClick={onCategoryClick ? () => onCategoryClick(c.name) : undefined}
                  title={`${fmt(c.spent)} of ${fmt(c.cap)}`}
                >
                  <span className="dash-cat-name">{c.name}</span>
                  <span className="dash-cat-status is-over">+{fmt(c.spent - c.cap)}</span>
                  <span className="dash-cat-amt">{fmt(c.spent)}</span>
                </button>
              ))}
            </div>
          </UiCard>
        </SectionBlock>
      ) : null}

      {/* Per-source detail, on demand. Seven rows inline made the section a
          wall; behind the card that summarises them it costs nothing.

          Each row carries a share bar so the list reads as a proportion at a
          glance rather than as a column of numbers to compare by eye. */}
      {sheet ? (
        <ModalShell
          className="dash-source-sheet"
          title={sheet === 'accounts' ? 'Account balances' : 'Credit sources'}
          onClose={() => setSheet(null)}
        >
          {/* Same P&L treatment the holding cards use, so the sheet's headline
              figure is styled like every other headline figure in the app. */}
          <div className={`ui-kit-holding-pnl ui-tone-${sheetTotalTone}`}>
            <div className="ui-kit-holding-pnl-row">
              <span className="ui-kit-holding-pnl-label">
                {sheet === 'accounts' ? 'Total available' : 'Total charged'}
              </span>
              <span className={`ui-kit-holding-pnl-value ui-tone-${sheetTotalTone}`}>
                {sheet === 'accounts'
                  ? `${availableTotal < 0 ? '−' : ''}${fmt(Math.abs(availableTotal))}`
                  : fmt(creditTotals.charged)}
              </span>
            </div>
            <div className="ui-kit-holding-pnl-row">
              <span className="ui-kit-holding-pnl-label">
                {sheet === 'accounts'
                  ? `${accountRows.length} account${accountRows.length === 1 ? '' : 's'}`
                  : `${creditTotals.sources.length} source${creditTotals.sources.length === 1 ? '' : 's'}`}
              </span>
              <span className="ui-kit-holding-pnl-label">
                {sheet === 'accounts'
                  ? availableTotal >= 0 ? 'In hand' : 'Overdrawn'
                  : `${creditShare}% of spend`}
              </span>
            </div>
          </div>

          {sheetIsEmpty ? (
            <p className="ui-kit-sheet-empty">
              {sheet === 'accounts'
                ? 'No accounts configured yet. Add them in Settings.'
                : 'Nothing was charged to a credit source this cycle.'}
            </p>
          ) : (
          <ListStack>
            {sheet === 'accounts' ? (
              <AccountKindPills kinds={accountKindsPresent} active={sheetKind} onChange={setSheetKind} />
            ) : null}
            {sheet === 'accounts'
              ? visibleAccountRows.map((a) => {
                  const meta = accountKindMeta(a.kind)
                  return (
                    <BalanceRow
                      key={a.name}
                      title={a.name}
                      subtitle={meta.label}
                      icon={<meta.icon size={14} aria-hidden />}
                      iconTone={a.current < 0 ? 'red' : 'navy'}
                      value={`${a.current < 0 ? '−' : ''}${fmt(Math.abs(a.current))}`}
                      valueTone={a.current < 0 ? 'red' : undefined}
                      income={fmt(a.inflow)}
                      expense={fmt(a.outflow)}
                      incomeIcon={<ArrowDownRight size={11} strokeWidth={2.4} />}
                      expenseIcon={<ArrowUpRight size={11} strokeWidth={2.4} />}
                    />
                  )
                })
              : creditTotals.sources.map((c) => (
                  <HoldingCard
                    key={c.name}
                    title={c.name}
                    compactTitle
                    icon={c.card ? <CreditCard size={13} /> : <Users2 size={13} />}
                    iconBackground
                    accentTone="red"
                    leftLabel="Charged"
                    leftValue={fmt(c.amount)}
                    centerLabel="Entries"
                    centerValue={String(c.count)}
                    rightLabel="Share"
                    rightValue={`${
                      creditTotals.charged > 0
                        ? Math.round((c.amount / creditTotals.charged) * 100)
                        : 0
                    }%`}
                    // The bar is the `Share` figure in the column above it and
                    // nothing else: this source's part of everything charged
                    // this cycle. The accounts sheet has no bar because there
                    // was no honest thing for one to measure there.
                    chips={
                      <div className="bar-bg dash-cat-bar" title="Share of total charged">
                        <div
                          className="bar-f"
                          style={{
                            width: `${
                              creditTotals.charged > 0
                                ? (c.amount / creditTotals.charged) * 100
                                : 0
                            }%`,
                            background: 'var(--rm)',
                          }}
                        />
                      </div>
                    }
                  />
                ))}
          </ListStack>
          )}
        </ModalShell>
      ) : null}

      {/* The six-cycle trend used to live here. It is the same chart `/overview`
          already renders from the same endpoint, so Monthly was showing a second
          copy of it; the summary fetch stays only for the vs-previous delta. */}
    </div>
  )
}
