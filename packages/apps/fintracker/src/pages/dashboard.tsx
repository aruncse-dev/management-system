import { TrendingUp, CalendarDays, Banknote, CreditCard, Package, AlertTriangle, Wallet, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useStore } from '../store'
import { sumType, sumCC, sumOtherCr, catMap, budgetSummary, acctFlows, INR } from '../utils'
import { ACCOUNTS, ALL_CR } from '../config'
import { RightLegendDonut } from '../ui'
import { BalanceRow, KpiCard, LoadingState, SectionBlock, UiCard } from '../ui'

export default function Dashboard() {
  const { state } = useStore()
  const { rows, budget, openingBal } = state

  if (state.loading) return <div className="pg"><LoadingState /></div>

  const inc = sumType(rows, 'Income')
  const exp = sumType(rows, 'Expense') + sumType(rows, 'Savings')
  const cc  = sumCC(rows)
  const ocr = sumOtherCr(rows)
  const flows = acctFlows(rows, openingBal)
  const totalSavings = ACCOUNTS.reduce((s,a) => s + (flows[a]?.current||0), 0)
  const surplus = inc - exp
  const totalOutstanding = rows.filter(r => (ALL_CR as readonly string[]).includes(r.m)).reduce((s,r) => s + r.a, 0)
  const cm = catMap(rows, budget)
  const { totalBudget, totalSpent, ovCount, totalOver, totalPct, tCol } = budgetSummary(budget, cm)
  const accountSnapshot = ACCOUNTS.map(acc => {
    const { current } = flows[acc] || { current: 0 }
    return { acc, current }
  })

  const overspent = budget
    .filter(e => e.name.trim() && (cm[e.name] || 0) > e.amount)
    .map(e => ({ c: e.name, b: e.amount, s: cm[e.name] || 0 }))
    .sort((a, b) => (b.s - b.b) - (a.s - a.b))

  const incExpData = [
    {label:'Income', v:inc, col:'#22C55E'},
    {label:'Expense',v:exp, col:'#EF4444'},
  ].filter(d=>d.v>0)

  return (
    <div className="pg dashboard-page ui-kit-page-shell">
      <SectionBlock title="Overview" icon={<CalendarDays size={14} />}>
        <div className="dash-overview">
          <BalanceRow
            title="Net Cash"
            value={`${totalSavings < 0 ? '−' : ''}${INR(Math.abs(totalSavings))}`}
            income={`+${INR(inc)}`}
            expense={`−${INR(exp)}`}
            incomeIcon={<ArrowDownRight size={11} strokeWidth={2.4} />}
            expenseIcon={<ArrowUpRight size={11} strokeWidth={2.4} />}
          />
          <BalanceRow
            title="Outstanding Credit"
            value={`−${INR(totalOutstanding)}`}
            income={`−${INR(cc)}`}
            expense={`−${INR(ocr)}`}
            incomeIcon={<CreditCard size={11} strokeWidth={2.4} />}
            expenseIcon={<Banknote size={11} strokeWidth={2.4} />}
            incomeLabel="Cards"
            expenseLabel="Other credits"
            incomeTone="red"
            expenseTone="red"
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Account Balances" icon={<Banknote size={14} />}>
        <div className="dash-account-grid">
          {accountSnapshot.map(({ acc, current }) => (
          <KpiCard
            key={acc}
            label={acc}
            value={`${current < 0 ? '−' : ''}${INR(Math.abs(current))}`}
            tone={current >= 0 ? 'green' : 'red'}
            icon={acc === 'Cash' ? <Wallet size={14} /> : acc === 'Wallet' ? <CreditCard size={14} /> : <Banknote size={14} />}
          />
        ))}
        </div>
      </SectionBlock>

      <SectionBlock title="Budget Progress" icon={<Package size={14} />}>
        <UiCard subtitle={`${ovCount} overspent categories`}>
          <div className="dash-budget-card">
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
        </UiCard>
      </SectionBlock>

      <SectionBlock title="Overspent Categories" icon={<AlertTriangle size={14} />}>
        <UiCard>
          <div className="dash-overspent-card dash-flat-card">
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
        </UiCard>
      </SectionBlock>

      {(inc > 0 || exp > 0) && (
        <SectionBlock title="Cash Flow" icon={<TrendingUp size={14} />}>
          <UiCard>
            <div className="dash-cashflow-card dash-flat-card">
              <RightLegendDonut
                items={incExpData.map(d => ({ label: d.label, value: d.v, color: d.col }))}
                showCenter
                centerLabel="NET"
                centerValue={surplus >= 0 ? `+${INR(surplus)}` : `−${INR(Math.abs(surplus))}`}
                legendPosition="bottom"
              />
            </div>
          </UiCard>
        </SectionBlock>
      )}

    </div>
  )
}
