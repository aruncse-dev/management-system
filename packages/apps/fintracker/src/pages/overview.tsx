import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp,
  Banknote,
  Package,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  Lightbulb,
  CalendarClock,
  CalendarDays,
} from 'lucide-react'
import { useFormatMoney } from '../hooks/useFormatMoney'
import { MiniBarChart } from '../ui'
import { BalanceRow, KpiCard, KpiGrid, LoadingState, SectionBlock, UiCard } from '../ui'
import { api, type DashboardSummary } from '../api'
import { MNS } from '../config'

/** `2026-07` → `Jul`. Falls back to the raw key so a bad value is visible, not blank. */
function shortMonthLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return key
  const i = parseInt(m[2], 10) - 1
  return MNS[i] ?? key
}

/**
 * Whole-portfolio view: net worth, multi-month trend, fixed commitments and
 * suggestions.
 *
 * Deliberately separate from the Dashboard tab, which is scoped to the single
 * month selected in the header. Nothing here responds to the month stepper —
 * these figures are point-in-time or trailing, so `/monthly` hides the month
 * nav while this tab is active.
 */
export default function Overview() {
  const fmt = useFormatMoney()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void api
      .getDashboardSummary('', '', 6)
      .then((d) => {
        if (!cancelled) setSummary(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load overview')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const trendPoints = useMemo(
    () =>
      (summary?.trend ?? []).map((t) => ({
        label: shortMonthLabel(t.key),
        primary: t.income,
        secondary: t.expense + t.savings,
      })),
    [summary],
  )

  // Shell and page must be SEPARATE elements: the gutter rule is
  // `.ui-kit-page-shell > .pg` (a child combinator), so collapsing both classes
  // onto one element silently drops the side padding.
  if (loading) {
    return (
      <div className="ui-kit-page-shell overview-page">
        <div className="pg"><LoadingState /></div>
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="ui-kit-page-shell overview-page">
        <div className="pg">
        <UiCard>
          <div className="lb" style={{ padding: '16px 4px', color: 'var(--muted)' }}>
            Could not load overview{error ? `: ${error}` : ''}.
          </div>
        </UiCard>
        </div>
      </div>
    )
  }

  const nw = summary.netWorth
  const committed = summary.committed
  const income = summary.income

  return (
    <div className="ui-kit-page-shell overview-page">
      <div className="pg dashboard-page">
      {summary.suggestions.length ? (
        <SectionBlock title="Suggestions" icon={<Lightbulb size={14} />}>
          <div className="dash-suggestions">
            {summary.suggestions.map((s, i) => (
              <div key={`${s.title}-${i}`} className="dash-suggestion" data-tone={s.tone}>
                <div className="dash-suggestion__title">{s.title}</div>
                <div className="dash-suggestion__detail">{s.detail}</div>
              </div>
            ))}
          </div>
        </SectionBlock>
      ) : null}

      <SectionBlock
        title="Net Worth"
        icon={<Scale size={14} />}
        subtitle="Savings, gold and investments less all loans"
      >
        <BalanceRow
          title="Net Worth"
          value={`${nw.net < 0 ? '−' : ''}${fmt(Math.abs(nw.net))}`}
          income={`+${fmt(nw.assets.total)}`}
          expense={`−${fmt(nw.liabilities.total)}`}
          incomeLabel="Assets"
          expenseLabel="Liabilities"
          incomeIcon={<ArrowDownRight size={11} strokeWidth={2.4} />}
          expenseIcon={<ArrowUpRight size={11} strokeWidth={2.4} />}
        />
        <KpiGrid variant="compact">
          <KpiCard label="Savings" value={fmt(nw.assets.savings)} tone="muted" icon={<Banknote size={14} />} />
          <KpiCard label="Gold" value={fmt(nw.assets.gold)} tone="muted" icon={<Package size={14} />} />
          <KpiCard label="Stocks" value={fmt(nw.assets.stocks)} tone="muted" icon={<TrendingUp size={14} />} />
          <KpiCard label="Mutual Funds" value={fmt(nw.assets.mutualFunds)} tone="muted" icon={<TrendingUp size={14} />} />
        </KpiGrid>
      </SectionBlock>

      <SectionBlock title="Liabilities" icon={<Banknote size={14} />}>
        <KpiGrid variant="compact">
          <KpiCard label="EMI loans" value={fmt(nw.liabilities.emi)} tone="muted" accentTone="red" icon={<Banknote size={14} />} />
          <KpiCard label="Jewel loans" value={fmt(nw.liabilities.jewel)} tone="muted" accentTone="red" icon={<Package size={14} />} />
          <KpiCard label="Cash loans" value={fmt(nw.liabilities.cash)} tone="muted" accentTone="red" icon={<Wallet size={14} />} />
          <KpiCard label="Open loans" value={summary.loans.length} tone="muted" icon={<Scale size={14} />} />
        </KpiGrid>
      </SectionBlock>

      {trendPoints.length > 1 ? (
        <SectionBlock
          title="6-Month Trend"
          icon={<TrendingUp size={14} />}
          subtitle={
            income.sampleMonths > 0
              ? `Avg income ${fmt(income.avgIncome)} · avg spend ${fmt(income.avgExpense)}`
              : undefined
          }
        >
          <UiCard>
            <MiniBarChart points={trendPoints} primaryLabel="Income" secondaryLabel="Spend" />
          </UiCard>
        </SectionBlock>
      ) : null}

      <SectionBlock title="Monthly Commitments" icon={<CalendarClock size={14} />}>
        <KpiGrid variant="compact">
          <KpiCard label="Loan EMIs" value={fmt(committed.emi)} tone="muted" icon={<Banknote size={14} />} />
          <KpiCard label="Subscriptions" value={fmt(committed.subscriptions)} tone="muted" icon={<CalendarDays size={14} />} />
          <KpiCard
            label="Total committed"
            value={fmt(committed.total)}
            tone="muted"
            accentTone={committed.total > income.avgIncome * 0.5 ? 'red' : 'green'}
            icon={<Scale size={14} />}
          />
          <KpiCard
            label="Avg surplus"
            value={`${income.surplus < 0 ? '−' : ''}${fmt(Math.abs(income.surplus))}`}
            tone="muted"
            accentTone={income.surplus >= 0 ? 'green' : 'red'}
            icon={<Wallet size={14} />}
          />
        </KpiGrid>
        {committed.upcomingRenewals.length ? (
          <UiCard subtitle={`${committed.upcomingRenewals.length} renewal(s) in the next 30 days`}>
            <div className="dash-overflow-list">
              {committed.upcomingRenewals.slice(0, 8).map((r) => (
                <div key={`${r.name}-${r.dueDate}`} className="dash-tag">
                  <span>{r.name}</span>
                  <span>{fmt(r.amount)} · {r.daysLeft}d</span>
                </div>
              ))}
            </div>
          </UiCard>
        ) : null}
      </SectionBlock>
      </div>
    </div>
  )
}
