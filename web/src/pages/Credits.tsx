import { useMemo } from 'react'
import { useStore } from '../store'
import { INR } from '../utils'
import { CC_MODES, OTHER_CR, ALL_CR, MNS } from '../constants'
import { CreditCard, Users, CircleDollarSign, Banknote, Layers3, Users2 } from 'lucide-react'
import { UiPill } from '../components/FinanceUI'
import { KpiCard, SectionBlock } from '../ui-kit'

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
    <div className="pg ui-kit-page-shell monthly-subpage">
      <SectionBlock
        title="Credit Summary"
        icon={<CircleDollarSign size={14} />}
        right={<UiPill tone="muted">{cycleLabel(month, year)}</UiPill>}
      >
        <div className="kpis">
          <KpiCard label="Overall" value={INR(overall)} tone="red" icon={<Banknote size={14} />} />
          <KpiCard label="Credit Cards" value={INR(ccNet)} tone="navy" icon={<CreditCard size={14} />} />
          <KpiCard label="Other Credits" value={INR(otherTotal)} tone="amber" icon={<Users2 size={14} />} />
          <KpiCard label="Sources" value={String(activeSources)} tone="green" icon={<Layers3 size={14} />} />
        </div>
      </SectionBlock>

      <SectionBlock title="Credit Cards" icon={<CreditCard size={14} />}>
        <div className="cc-g">
        {CC_MODES.map(m => (
          <KpiCard
            key={m}
            label={m}
            value={INR(totals[m])}
            tone="navy"
            accentTone="red"
            icon={<CreditCard size={14} />}
          />
        ))}
        </div>
      </SectionBlock>

      <SectionBlock title="Other Credits" icon={<Users size={14} />}>
        <div className="cr-g3">
        {OTHER_CR.map(m => (
          <KpiCard
            key={m}
            label={m}
            value={INR(Math.max(0, totals[m]))}
            tone="navy"
            accentTone="green"
            icon={<Users2 size={14} />}
          />
        ))}
        </div>
      </SectionBlock>

    </div>
  )
}
