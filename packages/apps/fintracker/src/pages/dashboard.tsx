import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowRight,
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

const DAY_MS = 86_400_000
/**
 * Cycles of history to ask for. Only the previous one is used, for the
 * `▲N% vs Sep` delta on the Income KPI — the six-cycle trend chart this once
 * fed now lives only on `/overview`, so there is no reason to fetch six.
 */
const TREND_MONTHS = 2
const MAX_CATEGORY_ROWS = 5

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

/** `2026-09-18` → `18 Sep`. */
function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (!Number.isFinite(d.getTime())) return iso
  return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`
}

type Props = {
  onCategoryClick?: (category: string) => void
  onGoTab?: (tab: 'txns' | 'bud') => void
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
export default function Dashboard({ onCategoryClick, onGoTab }: Props) {
  const { state } = useStore()
  const fmt = useFormatMoney()
  const { rows, budget, month, year, fintracker, openingBal } = state
  const {
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
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  useEffect(() => {
    let cancelled = false
    setSummary(null)
    void api
      .getDashboardSummary(month, year, TREND_MONTHS)
      .then((d) => {
        if (!cancelled) setSummary(d)
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

  if (state.loading) return <div className="pg"><LoadingState /></div>

  const inc = sumType(rows, 'Income')
  // Expense only. Folding `Savings` in here made `Net` stop being
  // `Income − Expense`, which is the one thing the three KPIs must agree on.
  // Legacy `Savings` rows are still counted as an outflow by the trend endpoint;
  // this page reports the cycle, not the ledger.
  const exp = sumType(rows, 'Expense')
  const net = inc - exp
  const cm = catMap(rows, budget)
  const { totalBudget, ovCount } = budgetSummary(applicableBudget, cm)

  // ---- Cycle position -------------------------------------------------------
  const totalDays = cycle ? daysBetween(cycle.start, cycle.end) : 0
  const todayIso = new Date().toISOString().slice(0, 10)
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
        ? `of ${fmt(totalBudget)} · over ${fmt(exp - totalBudget)}`
        : `of ${fmt(totalBudget)} · ${fmt(totalBudget - exp)} left`

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
  const accountRows = monthlyAccountNames
    .map((name) => ({ name, ...(flows[name] || { inflow: 0, outflow: 0, current: 0 }) }))
    .sort((a, b) => b.current - a.current)
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
      return { name, spent, cap, hasCap: cap > 0, over: cap > 0 && spent > cap }
    })
  const maxCat = allCategories.reduce((m, c) => Math.max(m, c.spent), 0)
  // Biggest first. Ranking overspend first hid Credit Repayment — the second
  // largest category — because its ₹0 cap means `over` is false.
  const categoryRows = [...allCategories]
    .sort((a, b) => b.spent - a.spent)
    .slice(0, MAX_CATEGORY_ROWS)

  return (
    <div className="pg dashboard-page ui-kit-page-shell monthly-subpage">
      {/* 1 — The cycle's cash flow. */}
      <SectionBlock
        title="This Cycle"
        icon={<Gauge size={14} />}
        subtitle={cycle ? `${shortDate(cycle.start)} – ${shortDate(cycle.end)}` : undefined}
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
        </KpiGrid>
      </SectionBlock>

      {/* 2 — Two figures: what is left in the accounts, and how much of this
          cycle went on borrowed money. Per-source detail is not repeated here;
          sources are configured in Settings. */}
      <SectionBlock
        title="Sources"
        icon={<Wallet size={14} />}
        subtitle="Manage sources in Settings"
      >
        <div className="ui-stack">
          <KpiGrid variant="compact">
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
              subtitle={`${creditShare}% of spend · ${creditTotals.active} sources`}
              onClick={() => setSheet('credit')}
            />
          </KpiGrid>
        </div>
      </SectionBlock>

      {/* 3 — The cycle as a shape, below the figures it summarises.

          Net lives in the donut centre and nowhere else. It used to also be a
          full-width KPI directly above, so the cycle's headline figure appeared
          twice in one column; and the centre used to show a *different* number
          (income minus credit) under the same "NET" label. */}
      <SectionBlock
        title="Cash flow"
        icon={<PieChart size={14} />}
        subtitle="What came in, what went out, and how much was borrowed"
      >
        {inc > 0 || exp > 0 || creditTotals.charged > 0 ? (
          <div className="dash-chart-row">
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

            {/* Own money against borrowed money. The centre names the borrowed
                figure outright rather than showing a second "NET" — that label
                already belongs to the donut beside it. */}
            <UiCard title="Income vs credit">
              <RightLegendDonut
                compact
                items={[
                  { label: 'Income', value: inc, color: '#22C55E' },
                  { label: 'On credit', value: creditTotals.charged, color: '#EF4444' },
                ].filter((d) => d.value > 0)}
                showCenter
                centerLabel="ON CREDIT"
                centerValue={fmt(creditTotals.charged)}
                legendPosition="bottom"
                valueFormatter={fmt}
              />
              <p className="dash-net-note ui-tone-muted">
                {inc > 0
                  ? `${Math.round((creditTotals.charged / inc) * 100)}% of income`
                  : 'No income this cycle'}
              </p>
            </UiCard>
          </div>
        ) : (
          <UiCard>
            <p className="ui-kit-sheet-empty">No income or spending in this cycle yet.</p>
          </UiCard>
        )}
      </SectionBlock>

      {/* 4 — Where the money went, and what broke its budget. */}
      {categoryRows.length ? (
        <SectionBlock
          title="Categories"
          icon={<Layers size={14} />}
          subtitle={ovCount > 0 ? `${ovCount} over budget` : 'All within budget'}
          right={<SectionChip>{allCategories.length}</SectionChip>}
        >
          <div className="ui-stack">
            <ListStack>
              {categoryRows.map((c) => {
                const barPct = c.hasCap
                  ? Math.min((c.spent / c.cap) * 100, 100)
                  : maxCat > 0
                    ? (c.spent / maxCat) * 100
                    : 0
                return (
                  <HoldingCard
                    key={c.name}
                    title={c.name}
                    accentTone={c.over ? 'red' : 'navy'}
                    compactTitle
                    leftLabel="Spent"
                    leftValue={fmt(c.spent)}
                    centerLabel="Budget"
                    centerValue={c.hasCap ? fmt(c.cap) : '—'}
                    rightLabel={c.over ? 'Over by' : c.hasCap ? 'Left' : 'Share'}
                    rightValue={
                      c.over
                        ? fmt(c.spent - c.cap)
                        : c.hasCap
                          ? fmt(c.cap - c.spent)
                          : `${Math.round(barPct)}%`
                    }
                    onClick={onCategoryClick ? () => onCategoryClick(c.name) : undefined}
                    chips={
                      <div className="bar-bg dash-cat-bar">
                        <div
                          className="bar-f"
                          style={{
                            width: `${barPct}%`,
                            background: c.over ? 'var(--rm)' : c.hasCap ? 'var(--gm)' : 'var(--teal)',
                          }}
                        />
                      </div>
                    }
                  />
                )
              })}
            </ListStack>
            {onGoTab ? (
              <button type="button" className="dash-more" onClick={() => onGoTab('bud')}>
                All {allCategories.length} categories
                <ArrowRight size={13} />
              </button>
            ) : null}
          </div>
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
            {sheet === 'accounts'
              ? accountRows.map((a) => (
                  <HoldingCard
                    key={a.name}
                    title={a.name}
                    compactTitle
                    icon={<Wallet size={13} />}
                    iconBackground
                    accentTone={a.current < 0 ? 'red' : 'green'}
                    leftLabel="In"
                    leftValue={fmt(a.inflow)}
                    centerLabel="Out"
                    centerValue={fmt(a.outflow)}
                    rightLabel="Balance"
                    rightValue={`${a.current < 0 ? '−' : ''}${fmt(Math.abs(a.current))}`}
                  />
                ))
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
