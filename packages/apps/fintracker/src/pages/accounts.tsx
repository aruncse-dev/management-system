import { useMemo } from 'react'
import { useStore } from '../store'
import { acctFlows } from '../utils'
import { useFormatMoney } from '../hooks/useFormatMoney'
import { useFintrackerModes } from '../context/FintrackerModesContext'
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react'
import { BalanceRow, KpiCard, KpiGrid, LoadingState, SectionBlock } from '../ui'

interface Props {
  showStatus: (msg: string) => void
}

export default function Accounts({ showStatus: _showStatus }: Props) {
  const { state } = useStore()
  const fmt = useFormatMoney()
  const { rows, openingBal } = state
  const { monthlyAccountNames, paymentModeOptions, loading: modesLoading } = useFintrackerModes()

  const flows = useMemo(
    () => acctFlows(rows, openingBal, monthlyAccountNames, paymentModeOptions),
    [rows, openingBal, monthlyAccountNames, paymentModeOptions],
  )

  const overview = useMemo(() => {
    const currentTotal = monthlyAccountNames.reduce((s, acc) => s + (flows[acc]?.current || 0), 0)
    const inflowTotal = monthlyAccountNames.reduce((s, acc) => s + (flows[acc]?.inflow || 0), 0)
    const outflowTotal = monthlyAccountNames.reduce((s, acc) => s + (flows[acc]?.outflow || 0), 0)
    const activeAccounts = monthlyAccountNames.filter(acc => (flows[acc]?.current || 0) !== 0).length
    return { currentTotal, inflowTotal, outflowTotal, activeAccounts }
  }, [flows, monthlyAccountNames])

  if (modesLoading) {
    return (
      <div className="pg ui-kit-page-shell monthly-subpage">
        <LoadingState variant="section" />
      </div>
    )
  }

  return (
    <div className="pg ui-kit-page-shell monthly-subpage">
      <SectionBlock title="Overview" icon={<Wallet size={14} />}>
        <KpiGrid variant="compact">
          <KpiCard
            label="Current Balance"
            value={`${overview.currentTotal < 0 ? '−' : ''}${fmt(Math.abs(overview.currentTotal))}`}
            tone={overview.currentTotal < 0 ? 'red' : 'green'}
            icon={<Wallet size={14} />}
          />
          <KpiCard label="Inflow" value={fmt(overview.inflowTotal)} tone="green" icon={<ArrowDownRight size={14} />} />
          <KpiCard label="Outflow" value={fmt(overview.outflowTotal)} tone="red" icon={<ArrowUpRight size={14} />} />
          <KpiCard label="Accounts" value={String(overview.activeAccounts)} tone="navy" icon={<Wallet size={14} />} />
        </KpiGrid>
      </SectionBlock>

      <SectionBlock title="Account Balances" icon={<Wallet size={14} />}>
        <div className="acct-g2">
          {monthlyAccountNames.map((acc, i) => {
            const { inflow, outflow, current } = flows[acc] || { inflow: 0, outflow: 0, current: 0 }
            return (
              <BalanceRow
                key={acc}
                title={acc}
                value={`${current < 0 ? '−' : ''}${fmt(Math.abs(current))}`}
                subtitle={i === 0 ? 'Primary balance view' : undefined}
                income={fmt(inflow)}
                expense={fmt(outflow)}
                incomeIcon={<ArrowDownRight size={11} strokeWidth={2.4} />}
                expenseIcon={<ArrowUpRight size={11} strokeWidth={2.4} />}
              />
            )
          })}
        </div>
      </SectionBlock>
    </div>
  )
}
