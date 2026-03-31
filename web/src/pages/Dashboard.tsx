import { useState } from 'react'
import { TrendingUp, CalendarDays, Banknote, CreditCard, Package, AlertTriangle } from 'lucide-react'
import { useStore } from '../store'
import { sumType, sumCC, sumOtherCr, catMap, budgetSummary, acctFlows, INR } from '../utils'
import { ACCOUNTS, CC_MODES, OTHER_CR, CR_COLORS, ALL_CR } from '../constants'
import { RightLegendDonut } from '../components/RightLegendDonut'
import { UiPill, UiSection, UiSheet } from '../components/FinanceUI'

export default function Dashboard() {
  const { state } = useStore()
  const { rows, budget, openingBal, month, year } = state
  const [creditOpen, setCreditOpen] = useState(false)

  if (state.loading) return <div className="pg"><div className="lb"><div className="spin" /><span>Loading…</span></div></div>

  const inc = sumType(rows, 'Income')
  const exp = sumType(rows, 'Expense')
  const cc  = sumCC(rows)
  const ocr = sumOtherCr(rows)
  const flows = acctFlows(rows, openingBal)
  const totalSavings = ACCOUNTS.reduce((s,a) => s + (flows[a]?.current||0), 0)
  const surplus = inc - exp
  const totalOutstanding = rows.filter(r => (ALL_CR as readonly string[]).includes(r.m)).reduce((s,r) => s + r.a, 0)
  const cm = catMap(rows, budget)
  const { totalBudget, totalSpent, ovCount, totalOver, totalPct, tCol } = budgetSummary(budget, cm)
  const accountSnapshot = ACCOUNTS.map((acc, i) => {
    const { current } = flows[acc] || { current: 0 }
    return { acc, current, color: ['var(--gm)', 'var(--navy)', 'var(--amber)'][i] }
  })

  const overspent = Object.entries(budget)
    .filter(([c,b]) => b>0 && (cm[c]||0)>b)
    .map(([c,b]) => ({ c, b, s: cm[c]||0 }))
    .sort((a,b) => (b.s-b.b)-(a.s-a.b))

  const incExpData = [
    {label:'Income', v:inc, col:'#22C55E'},
    {label:'Expense',v:exp, col:'#EF4444'},
  ].filter(d=>d.v>0)
  const crTotals: Record<string,number> = {}
  ;[...CC_MODES, ...OTHER_CR].forEach(m => {
    crTotals[m] = rows.filter(r => r.m === m).reduce((s,r) => s + r.a, 0)
  })

  return (
    <div className="pg dashboard-page">
      <UiSection
        title="Overview"
        icon={<CalendarDays size={14} />}
        right={<UiPill tone="navy"><CalendarDays size={12} /> {month} {year}</UiPill>}
      />
      <div className="kpi-card kpi-card--blue dash-overview-card">
        <div className="dash-overview">
          <div className="dash-overview-top">
            <div>
              <div className="kpi-card-l">Net Balance</div>
              <div className="kpi-card-v kpi-card-v-soft dash-net-balance" style={{ color: totalSavings >= 0 ? 'var(--gm)' : 'var(--rm)' }}>
                {totalSavings < 0 ? '−' : ''}{INR(Math.abs(totalSavings))}
              </div>
            </div>
          </div>
          <div className="dash-overview-flow">
            <div className="dash-flow-top">
              <div className="dash-flow-label">Net Cashflow</div>
            </div>
            <div className={`dash-flow-value dash-net-cashflow-value ${surplus >= 0 ? 'positive' : 'negative'}`}>
              {surplus >= 0 ? '+' : '−'}{INR(Math.abs(surplus))}
            </div>
            <div className="dash-flow-chips">
              <div className="dash-flow-chip">
                <span className="dash-flow-chip-lbl">Income</span>
                <span className="dash-flow-chip-val">+{INR(inc)}</span>
              </div>
              <div className="dash-flow-chip">
                <span className="dash-flow-chip-lbl">Expenses</span>
                <span className="dash-flow-chip-val">−{INR(exp)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UiSection
        title="Account Balances"
        icon={<Banknote size={14} />}
      />
      <div className="dash-account-grid">
        {accountSnapshot.map(({ acc, current, color }) => (
          <div key={acc} className="kpi-card kpi-card--gray dash-account-card" style={{ borderLeftColor: color }}>
            <div className="kpi-card-l">{acc}</div>
            <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>
              {current < 0 ? '−' : ''}{INR(Math.abs(current))}
            </div>
          </div>
        ))}
      </div>

      <UiSection
        title="Credit Outstanding"
        icon={<CreditCard size={14} />}
      />
      <button
        type="button"
        className="kpi-card kpi-card--red dash-credit-overall-card dash-credit-overall-btn"
        onClick={() => setCreditOpen(true)}
      >
        <div className="kpi-card-l">Overall Credit</div>
        <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>
          −{INR(totalOutstanding)}
        </div>
        <div className="dash-credit-summary-sub">
          Cards {INR(cc)} · Other credits {INR(ocr)}
        </div>
      </button>

      <UiSection
        title="Budget Progress"
        icon={<Package size={14} />}
      />
      <div className="kpi-card kpi-card--amber dash-budget-card">
        <div className="dash-budget-top">
          <div className="dash-budget-figure">{INR(totalSpent)} / {INR(totalBudget)}</div>
          <div className={`dash-budget-state ${totalOver ? 'over' : 'ok'}`}>
            {totalOver ? `Over by ${INR(totalSpent - totalBudget)}` : `${INR(totalBudget - totalSpent)} left`} · {ovCount} categories
          </div>
        </div>
        <div className="bar-bg dash-budget-bar">
          <div className="bar-f" style={{ width: `${totalPct}%`, background: tCol }} />
        </div>
      </div>

      <UiSection
        title="Overspent Categories"
        icon={<AlertTriangle size={14} />}
      />
      <div className="kpi-card kpi-card--red dash-overspent-card dash-flat-card">
        {overspent.length > 0 ? (
          <div className="dash-overflow-list">
            {overspent.map(item => (
              <div
                key={item.c}
                className="dash-tag dash-tag-danger"
              >
                <span>{item.c}</span>
                <span>−{INR(item.s - item.b)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="lb" style={{ padding: '12px 0 4px' }}>No overspent categories this month.</div>
        )}
      </div>

      {(inc > 0 || exp > 0) && (
        <>
          <UiSection
            title="Cash Flow"
            icon={<TrendingUp size={14} />}
          />
          <div className="kpi-card kpi-card--blue dash-cashflow-card dash-flat-card">
            <RightLegendDonut
              items={incExpData.map(d => ({ label: d.label, value: d.v, color: d.col }))}
              showCenter
              centerLabel="NET"
              centerValue={surplus >= 0 ? `+${INR(surplus)}` : `−${INR(Math.abs(surplus))}`}
              legendPosition="bottom"
            />
          </div>
        </>
      )}

      {creditOpen && (
        <div className="modal-bg open" onClick={() => setCreditOpen(false)} style={{ alignItems: 'flex-end' }}>
          <UiSheet
            title="Credit Details"
            icon={<CreditCard size={14} />}
            onClose={() => setCreditOpen(false)}
          >
              <div className="dash-credit-out-grid">
                {[...CC_MODES, ...OTHER_CR].filter(m => crTotals[m] > 0).map(m => (
                  <div key={m} className="kpi-card kpi-card--gray dash-credit-out-card" style={{ borderLeftColor: CR_COLORS[m] }}>
                    <div className="kpi-card-l">{m}</div>
                    <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>−{INR(crTotals[m])}</div>
                  </div>
                ))}
              </div>
          </UiSheet>
        </div>
      )}

    </div>
  )
}
