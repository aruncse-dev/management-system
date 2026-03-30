import { useMemo } from 'react'
import { useStore } from '../store'
import { INR } from '../utils'
import { CC_MODES, OTHER_CR, ALL_CR, CR_COLORS, MNS } from '../constants'
import { CreditCard, Users, CircleDollarSign } from 'lucide-react'
import { UiPill, UiSection } from '../components/FinanceUI'

const CC_CYCLE_DAY = 19 // billing cycle: 19th → 18th next month

function cycleLabel(month: string, year: string): string {
  const mi = MNS.indexOf(month as typeof MNS[number])
  const prevMi = mi === 0 ? 11 : mi - 1
  return `${CC_CYCLE_DAY} ${MNS[prevMi]} – ${CC_CYCLE_DAY - 1} ${month} ${year}`
}

export default function Credits() {
  const { state } = useStore()
  const { rows, month, year } = state

  // Totals per credit source — all transactions add to outstanding (spending + cash advances)
  const totals: Record<string, number> = {}
  ;[...CC_MODES, ...OTHER_CR].forEach(m => totals[m] = 0)
  rows.forEach(r => {
    if ((ALL_CR as readonly string[]).includes(r.m)) {
      totals[r.m] += r.a
    }
  })

  const ccNet      = CC_MODES.reduce((s, m) => s + totals[m], 0)
  const otherTotal = OTHER_CR.reduce((s, m) => s + totals[m], 0)
  const overall    = ccNet + otherTotal
  const activeSources = useMemo(
    () => [...CC_MODES, ...OTHER_CR].filter(m => totals[m] > 0).length,
    [totals]
  )

  return (
    <div className="pg">
      <UiSection
        title="Credit Summary"
        icon={<CircleDollarSign size={14} />}
        right={<UiPill tone="muted">{cycleLabel(month, year)}</UiPill>}
      />

      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi-card kpi-card--red">
          <div className="kpi-card-l">Overall</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>{INR(overall)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-l">Credit Cards</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>{INR(ccNet)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-l">Other Credits</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>{INR(otherTotal)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-l">Sources</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>{activeSources}</div>
        </div>
      </div>

      <UiSection title="Credit Cards" icon={<CreditCard size={14} />} />
      <div className="cc-g" style={{ marginBottom: 14 }}>
        {CC_MODES.map(m => (
          <div key={m} className="card cp" style={{ borderTop: `3px solid ${CR_COLORS[m]}` }}>
            <div className="cc-n">{m}</div>
            <div className="cc-a" style={{ fontSize: 16, fontWeight: 700, color: CR_COLORS[m] }}>{INR(totals[m])}</div>
          </div>
        ))}
      </div>

      <UiSection title="Other Credits" icon={<Users size={14} />} />
      <div className="cr-g3" style={{ marginBottom: 14 }}>
        {OTHER_CR.map(m => (
          <div key={m} className="card cp" style={{ borderTop: `3px solid ${CR_COLORS[m]}` }}>
            <div className="cc-n">{m}</div>
            <div className="cc-a" style={{ fontSize: 16, fontWeight: 700, color: CR_COLORS[m] }}>{INR(Math.max(0, totals[m]))}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
