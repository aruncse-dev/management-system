import { useMemo } from 'react'
import { useStore } from '../store'
import { acctFlows, INR } from '../utils'
import { ACCOUNTS, CC_MODES } from '../constants'
import { Wallet } from 'lucide-react'
import { decorColor } from '../constants'

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
    <div className="pg">
      <div className="acct-section-head">
        <div className="acct-section-title">
          <Wallet size={14} />
          <span>Overview</span>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi-card kpi-card--green">
          <div className="kpi-card-l">Current Balance</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>
            {overview.currentTotal < 0 ? '−' : ''}{INR(Math.abs(overview.currentTotal))}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-l">Inflow</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>{INR(overview.inflowTotal)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-l">Outflow</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>{INR(overview.outflowTotal)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-l">Accounts</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>{overview.activeAccounts}</div>
        </div>
      </div>

      <div className="acct-section-head">
        <div className="acct-section-title">
          <Wallet size={14} />
          <span>Account Balances</span>
        </div>
      </div>

      <div className="acct-g2" style={{marginBottom:14}}>
        {ACCOUNTS.map((acc, i) => {
          const { inflow, outflow, current } = flows[acc] || { inflow:0, outflow:0, current:0 }
          const curCol = current > 0 ? 'var(--green)' : current < 0 ? 'var(--red)' : '#6B7280'
          const borderColors = [decorColor('Cash'), decorColor('HDFC Bank', 1), decorColor('Wallet', 2)]
          return (
            <div key={acc} className="acct-card" style={{borderLeftColor: borderColors[i], borderLeftWidth: 0}}>
              <div className="acct-card-top">
                <div className="acct-bank">{accountLabel[acc] ?? acc}</div>
                <div className="acct-balance-pill" style={{ color: curCol, borderColor: 'transparent' }}>
                  {current < 0 ? '−' : ''}{INR(Math.abs(current))}
                </div>
              </div>
              <div className="acct-main">
                <div className="acct-flow-summary">
                  <div className="acct-flow-summary-item">
                    <span className="acct-flow-summary-label">In</span>
                    <span className="acct-flow-summary-value acct-flow-summary-value-in">+{INR(inflow)}</span>
                  </div>
                  <div className="acct-flow-summary-item">
                    <span className="acct-flow-summary-label">Out</span>
                    <span className="acct-flow-summary-value acct-flow-summary-value-out">−{INR(outflow)}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
