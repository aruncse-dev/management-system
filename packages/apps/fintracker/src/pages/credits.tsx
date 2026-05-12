import { useMemo } from 'react'
import { useStore } from '../store'
import { INR } from '../utils'
import { MNS } from '../config'
import { useFintrackerModes } from '../context/FintrackerModesContext'
import { CreditCard, Users, CircleDollarSign, Banknote, Layers3, Users2 } from 'lucide-react'
import { KpiCard, KpiGrid, LoadingState, SectionBlock, SectionChip } from '../ui'

const CC_CYCLE_DAY = 19

function cycleLabel(month: string, year: string): string {
  const mi = MNS.indexOf(month as (typeof MNS)[number])
  const prevMi = mi === 0 ? 11 : mi - 1
  return `${CC_CYCLE_DAY} ${MNS[prevMi]} – ${CC_CYCLE_DAY - 1} ${month} ${year}`
}

export default function Credits() {
  const { state } = useStore()
  const { rows, month, year } = state
  const { creditCardNames, informalCreditNames, loading: modesLoading } = useFintrackerModes()

  const totals: Record<string, number> = useMemo(() => {
    const t: Record<string, number> = {}
    for (const m of [...creditCardNames, ...informalCreditNames]) t[m] = 0
    rows.forEach(r => {
      if (r.m in t) t[r.m] += r.a
    })
    return t
  }, [rows, creditCardNames, informalCreditNames])

  const ccNet = useMemo(() => creditCardNames.reduce((s, m) => s + (totals[m] || 0), 0), [creditCardNames, totals])
  const otherTotal = useMemo(
    () => informalCreditNames.reduce((s, m) => s + (totals[m] || 0), 0),
    [informalCreditNames, totals],
  )
  const overall = ccNet + otherTotal
  const activeSources = useMemo(
    () => [...creditCardNames, ...informalCreditNames].filter(m => (totals[m] || 0) > 0).length,
    [creditCardNames, informalCreditNames, totals],
  )

  if (modesLoading) {
    return (
      <div className="pg ui-kit-page-shell monthly-subpage">
        <LoadingState variant="section" />
      </div>
    )
  }

  return (
    <div className="pg ui-kit-page-shell monthly-subpage">
      <SectionBlock
        title="Credit Summary"
        icon={<CircleDollarSign size={14} />}
        right={<SectionChip>{cycleLabel(month, year)}</SectionChip>}
      >
        <KpiGrid variant="compact">
          <KpiCard label="Overall" value={INR(overall)} tone="red" icon={<Banknote size={14} />} />
          <KpiCard label="Credit Cards" value={INR(ccNet)} tone="navy" icon={<CreditCard size={14} />} />
          <KpiCard label="Other Credits" value={INR(otherTotal)} tone="amber" icon={<Users2 size={14} />} />
          <KpiCard label="Sources" value={String(activeSources)} tone="green" icon={<Layers3 size={14} />} />
        </KpiGrid>
      </SectionBlock>

      <SectionBlock title="Credit Cards" icon={<CreditCard size={14} />}>
        <div className="cc-g">
          {creditCardNames.map(m => (
            <KpiCard
              key={m}
              label={m}
              value={INR(totals[m] || 0)}
              tone="navy"
              accentTone="red"
              icon={<CreditCard size={14} />}
            />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock title="Other Credits" icon={<Users size={14} />}>
        <div className="cr-g3">
          {informalCreditNames.map(m => (
            <KpiCard
              key={m}
              label={m}
              value={INR(Math.max(0, totals[m] || 0))}
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
