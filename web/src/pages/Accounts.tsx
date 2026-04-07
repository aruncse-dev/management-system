import { useMemo } from 'react'
import { useStore } from '../store'
import { acctFlows, INR } from '../utils'
import { ACCOUNTS, CC_MODES } from '../constants'
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react'
import { BalanceRow, KpiCard, SectionBlock } from '../ui-kit'

interface Props { showStatus: (msg: string) => void }

export default function Accounts({ showStatus: _showStatus }: Props) {
  const { state } = useStore()
  const { rows, openingBal } = state
  const flows = acctFlows(rows, openingBal)
  const accountLabel: Record<string, string> = {
    Cash: 'Cash',
    'HDFC Bank': 'HDFC',
    Wallet: 'Wallet',
  }

  const ccCatMap: Record<string,{ICICI:number;HDFC:number}> = {}
  rows.filter(r => (CC_MODES as readonly string[]).includes(r.m)).forEach(r => {
    if (!ccCatMap[r.c]) ccCatMap[r.c] = { ICICI:0, HDFC:0 }
    if (r.m === 'ICICI') ccCatMap[r.c].ICICI += r.a
    else ccCatMap[r.c].HDFC += r.a
  })
  const overview = useMemo(() => {
    const currentTotal = ACCOUNTS.reduce((s, acc) => s + (flows[acc]?.current || 0), 0)
    const inflowTotal = ACCOUNTS.reduce((s, acc) => s + (flows[acc]?.inflow || 0), 0)
    const outflowTotal = ACCOUNTS.reduce((s, acc) => s + (flows[acc]?.outflow || 0), 0)
    const activeAccounts = ACCOUNTS.filter(acc => (flows[acc]?.current || 0) !== 0).length
    return { currentTotal, inflowTotal, outflowTotal, activeAccounts }
  }, [flows])
  return (
    <div className="pg ui-kit-page-shell monthly-subpage">
      <SectionBlock title="Overview" icon={<Wallet size={14} />}>
        <div className="kpis">
          <KpiCard label="Current Balance" value={`${overview.currentTotal < 0 ? '−' : ''}${INR(Math.abs(overview.currentTotal))}`} tone={overview.currentTotal < 0 ? 'red' : 'green'} icon={<Wallet size={14} />} />
          <KpiCard label="Inflow" value={INR(overview.inflowTotal)} tone="green" icon={<ArrowDownRight size={14} />} />
          <KpiCard label="Outflow" value={INR(overview.outflowTotal)} tone="red" icon={<ArrowUpRight size={14} />} />
          <KpiCard label="Accounts" value={String(overview.activeAccounts)} tone="navy" icon={<Wallet size={14} />} />
        </div>
      </SectionBlock>

      <SectionBlock title="Account Balances" icon={<Wallet size={14} />}>
        <div className="acct-g2">
        {ACCOUNTS.map((acc, i) => {
          const { inflow, outflow, current } = flows[acc] || { inflow:0, outflow:0, current:0 }
          return (
            <BalanceRow
              key={acc}
              title={accountLabel[acc] ?? acc}
              value={`${current < 0 ? '−' : ''}${INR(Math.abs(current))}`}
              subtitle={i === 0 ? 'Primary balance view' : undefined}
              income={INR(inflow)}
              expense={INR(outflow)}
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
