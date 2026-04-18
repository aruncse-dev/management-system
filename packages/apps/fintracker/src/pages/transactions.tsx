import { Pencil, X } from 'lucide-react'
import { useStore, usePage } from '../store'
import { Transaction } from '../types'
import { fd, INR } from '../utils'
import { TXN_PAGE } from '../config'
import { LoadingState, SectionBlock, TransactionCard } from '../ui'
import { CatIcon } from '../ui'

const FILTERS = ['All','Expense','Income','Transfer','Savings','ICICI','HDFC','Bommi','Ramya']

interface Props { onEdit: (r: Transaction) => void }

function toneForKey(key: string) {
  const tones = ['green', 'amber', 'navy', 'red'] as const
  let sum = 0
  for (const ch of key) sum += ch.charCodeAt(0)
  return tones[sum % tones.length]
}

function toneForTransaction(row: Transaction) {
  if (row.t === 'Income' || row.t === 'Savings') return 'green'
  if (row.t === 'Transfer') return 'amber'
  if (row.t === 'Expense') return 'red'
  return toneForKey(row.c)
}

export default function Transactions({ onEdit }: Props) {
  const { state, dispatch } = useStore()
  const { rows, total, shown } = usePage()
  const rem = total - shown

  return (
    <div className="pg ui-kit-page-shell monthly-subpage">
      <SectionBlock title="Transactions" icon={<Pencil size={14} />} right={<span className="ui-kit-section-chip ui-tone-muted">{shown} / {total}</span>}>
        <div className="ui-stack">
          <div style={{ position: 'relative' }}>
            <input
              className="form-inp"
              style={{paddingRight:32,fontSize:14}}
              placeholder="Search transactions..."
              value={state.search}
              onChange={e => dispatch({ type:'SET_SEARCH', payload:e.target.value })}
            />
            {state.search && (
              <button className="icon-btn" style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)'}}
              onClick={() => dispatch({ type:'SET_SEARCH', payload:'' })}><X size={14} /></button>
            )}
          </div>

          <div className="pills">
            {state.catFilter && (
              <button className="pill active" style={{background:'var(--amber)',borderColor:'var(--amber)'}}
                onClick={() => dispatch({ type:'SET_CAT_FILTER', payload:'' })}>
                {state.catFilter} ✕
              </button>
            )}
            {FILTERS.map(f => (
              <button key={f} className={`pill ${!state.catFilter&&state.filter===f?'active':''}`}
                onClick={() => dispatch({ type:'SET_FILTER', payload:f })}>
                {f}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {shown} visible of {total} transactions
          </div>
        </div>
      </SectionBlock>

      {state.loading ? (
        <LoadingState variant="section" />
      ) : rows.length === 0 ? (
        <div className="lb">No entries</div>
      ) : (
        <div className="txn-cards">
          {rows.map(r => {
            const isI = r.t==='Income', isS=r.t==='Savings'
            const tone = toneForTransaction(r)
            return (
              <TransactionCard
                key={r.id}
                title={r.desc || r.c}
                amount={`${(isI || isS) ? '+' : '-'}${INR(r.a)}`}
                type={r.t}
                date={fd(r.date)}
                tone={tone}
                icon={<CatIcon cat={r.c} size={14} />}
                onClick={() => onEdit(r)}
              />
            )
          })}
        </div>
      )}

      {rem > 0 && (
        <button className="btn" style={{width:'100%',marginTop:0,background:'var(--navy-lt)',color:'var(--navy)'}}
          onClick={() => dispatch({ type:'SET_TXN_PAGE', payload: state.txnPage+1 })}>
          + Show {Math.min(rem, TXN_PAGE)} more ({rem} remaining)
        </button>
      )}
    </div>
  )
}
