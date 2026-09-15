import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Banknote, CalendarClock, CalendarDays, HandCoins, Lightbulb, LineChart, Package, Scale, Shield, TrendingUp, Wallet } from 'lucide-react'
import { useFormatMoney } from '../hooks/useFormatMoney'
import {
  BalanceRow,
  KpiCard,
  KpiGrid,
  LoadingState,
  MiniBarChart,
  SectionBlock,
  SectionChip,
  UiCard,
} from '../ui'
import { api, type DashboardSummary } from '../api'

/**
 * Whole-portfolio view: what you are worth, what you owe, what is committed.
 *
 * Deliberately separate from the Dashboard tab, which is scoped to the single
 * month selected in the header. Nothing here responds to the month stepper —
 * these figures are point-in-time or trailing, so `/monthly` hides the month
 * nav while this tab is active.
 *
 * Every section answers a different question. Liabilities used to appear twice
 * — once as the Net Worth row's expense leg and again as its own section — so
 * the two now share one section, and the long per-account roster moved behind
 * a sheet rather than being the tallest thing on a net-worth page.
 */
/**
 * Sub-heading inside a section, with its own total.
 *
 * Assets and Liabilities are two groups of one section rather than two
 * sections, so they need a lighter heading than `SectionBlock` gives. Spacing
 * comes from the enclosing `.ui-stack`, never from inline margins — mixing the
 * two is what made the grids sit at different distances from their headings.
 */
function GroupHeading({ label, total, tone }: { label: string; total: string; tone: 'green' | 'red' }) {
  return (
    <div className="ui-kit-section">
      <div className="ui-kit-section-left">
        <span className="ui-kit-section-title" style={{ fontSize: 12 }}>{label}</span>
      </div>
      <div className="ui-kit-section-right">
        <SectionChip tone={tone}>{total}</SectionChip>
      </div>
    </div>
  )
}

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

  /** Six cycles of income vs expense — already in the payload, never drawn until now. */
  const trendPoints = useMemo(
    () =>
      (summary?.trend ?? []).map((t) => ({
        label: t.key.slice(5),
        primary: t.income,
        secondary: t.expense,
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
  const lending = summary.lending

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

      {/* 1 — The headline, and the categories that make it up. */}
      <SectionBlock
        title="Net Worth"
        icon={<Scale size={14} />}
        subtitle="Savings, gold and investments less all loans"
      >
        <div className="ui-stack">
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

        <GroupHeading label="Assets" total={fmt(nw.assets.total)} tone="green" />
        <KpiGrid variant="compact">
          <KpiCard label="Savings" value={fmt(nw.assets.savings)} tone="muted" icon={<Banknote size={14} />} />
          <KpiCard label="Gold" value={fmt(nw.assets.gold)} tone="muted" icon={<Package size={14} />} />
          <KpiCard label="Stocks" value={fmt(nw.assets.stocks)} tone="muted" icon={<TrendingUp size={14} />} />
          <KpiCard label="Mutual Funds" value={fmt(nw.assets.mutualFunds)} tone="muted" icon={<TrendingUp size={14} />} />
        </KpiGrid>

        <GroupHeading label="Liabilities" total={fmt(nw.liabilities.total)} tone="red" />
        <KpiGrid variant="compact">
          <KpiCard label="EMI loans" value={fmt(nw.liabilities.emi)} tone="muted" accentTone="red" icon={<Banknote size={14} />} />
          <KpiCard label="Jewel loans" value={fmt(nw.liabilities.jewel)} tone="muted" accentTone="red" icon={<Package size={14} />} />
          <KpiCard label="Cash loans" value={fmt(nw.liabilities.cash)} tone="muted" accentTone="red" icon={<Wallet size={14} />} />
          <KpiCard
            label="Open loans"
            value={summary.loans.length}
            tone="muted"
            icon={<Scale size={14} />}
            subtitle={summary.loans.length === 1 ? 'account' : 'accounts'}
          />
        </KpiGrid>
        </div>
      </SectionBlock>

      {/* 2 — Receivables sit beside net worth, not inside it: money owed to you
          is a softer asset than a balance, and folding it in would silently
          move the figure the analysis MCP reports. */}
      {lending.lent > 0 ? (
        <SectionBlock
          title="Receivables"
          icon={<HandCoins size={14} />}
          subtitle="Lent out and not yet repaid — counted separately from net worth"
        >
          <div className="ui-stack">
          <KpiCard
            full
            label="Outstanding"
            value={fmt(lending.outstanding)}
            tone={lending.outstanding > 0 ? 'amber' : 'muted'}
            icon={<HandCoins size={14} />}
            subtitle={`${fmt(lending.lent)} lent · ${fmt(lending.repaid)} back`}
          />
          {lending.books.length > 1 ? (
            <KpiGrid variant="compact">
              {lending.books.map((b) => (
                <KpiCard
                  key={b.slug}
                  label={b.slug === 'lending' ? 'Lending' : b.slug.replace(/-/g, ' ')}
                  value={fmt(b.outstanding)}
                  tone="muted"
                  icon={<HandCoins size={14} />}
                />
              ))}
            </KpiGrid>
          ) : null}
          </div>
        </SectionBlock>
      ) : null}

      {/* 3 — What leaves every month regardless of behaviour. */}
      <SectionBlock title="Monthly Commitments" icon={<CalendarClock size={14} />}>
        <div className="ui-stack">
        <KpiGrid variant="compact">
          <KpiCard
            label="Loan EMIs"
            value={fmt(committed.emi)}
            tone="muted"
            icon={<Banknote size={14} />}
            subtitle="Scheduled EMI loans only"
          />
          <KpiCard
            label="Subscriptions"
            value={fmt(committed.subscriptions)}
            tone="muted"
            icon={<CalendarDays size={14} />}
            subtitle="Active plans, per month"
          />
          <KpiCard
            label="Insurance"
            value={fmt(committed.insurance)}
            tone="muted"
            icon={<Shield size={14} />}
            subtitle="Active policies, per month"
          />
          <KpiCard
            label="Total committed"
            value={fmt(committed.total)}
            tone="muted"
            accentTone={committed.total > income.avgIncome * 0.5 ? 'red' : 'green'}
            icon={<Scale size={14} />}
            subtitle={
              income.avgIncome > 0
                ? `${Math.round((committed.total / income.avgIncome) * 100)}% of avg income`
                : undefined
            }
          />
        </KpiGrid>
        {committed.upcomingRenewals.length ? (
          <UiCard
            subtitle={(() => {
              // Overdue premiums are counted separately: a subscription bills
              // itself whether you look or not, but an unpaid premium is a
              // thing you have to go and do.
              const overdue = committed.upcomingRenewals.filter((r) => r.daysLeft < 0).length
              const soon = committed.upcomingRenewals.length - overdue
              return [
                overdue ? `${overdue} overdue` : '',
                soon ? `${soon} due in the next 30 days` : '',
              ]
                .filter(Boolean)
                .join(' · ')
            })()}
          >
            <div className="dash-overflow-list">
              {committed.upcomingRenewals.slice(0, 8).map((r) => (
                <div
                  key={`${r.kind}-${r.name}-${r.dueDate}`}
                  className="dash-tag"
                  style={r.daysLeft < 0 ? { color: 'var(--red, #B91C1C)' } : undefined}
                >
                  <span>{r.name}</span>
                  <span>
                    {fmt(r.amount)} · {r.daysLeft < 0 ? `${Math.abs(r.daysLeft)}d overdue` : `${r.daysLeft}d`}
                  </span>
                </div>
              ))}
            </div>
          </UiCard>
        ) : null}
        </div>
      </SectionBlock>

      {/* 4 — Six cycles of direction. The data was always fetched; nothing drew it. */}
      {trendPoints.length > 1 ? (
        <SectionBlock
          title="Trend"
          icon={<LineChart size={14} />}
          subtitle={`Last ${trendPoints.length} cycles · income vs expense`}
          right={
            income.sampleMonths > 0 ? (
              <SectionChip tone={income.surplus >= 0 ? 'green' : 'red'}>
                {income.surplus >= 0 ? '+' : '−'}{fmt(Math.abs(income.surplus))}/mo
              </SectionChip>
            ) : null
          }
        >
          <UiCard>
            <MiniBarChart points={trendPoints} valueFormatter={fmt} />
          </UiCard>
        </SectionBlock>
      ) : null}

      </div>
    </div>
  )
}
