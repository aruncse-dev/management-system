import { useMemo } from 'react'
import { useRouter } from 'next/router'
import { Copy, Pencil } from 'lucide-react'
import { useStore, usePage } from '../store'
import { Transaction } from '../types'
import { dateKey, fd, isoDate, transactionTransferDestination } from '../utils'
import { useFormatMoney } from '../hooks/useFormatMoney'
import { useFintrackerModes } from '../context/FintrackerModesContext'
import { transactionRefHref, transactionRefKindLabel } from '../hooks/useTransactionRefOptions'
import { TXN_PAGE } from '../config'
import {
  FilterPills,
  ListStack,
  LoadingState,
  SearchField,
  SectionBlock,
  SectionChip,
  TransactionCard,
} from '../ui'
import { CatIcon } from '../ui'

/**
 * Type filters are fixed; payment modes come from the org's own sources.
 *
 * `Savings` is deliberately absent: the modal cannot create one and no row in
 * the database has that type, so the chip could only ever return nothing while
 * taking up room in a row that already scrolls. The type itself is still
 * understood everywhere it is read, for legacy rows.
 */
const TYPE_FILTERS = ['All', 'Expense', 'Income', 'Transfer'] as const

interface Props {
  onEdit: (r: Transaction) => void
  onDuplicate?: (r: Transaction) => void
  onRepeat?: () => void
}

function toneForTransaction(row: Transaction): 'green' | 'red' | 'amber' | 'navy' {
  if (row.t === 'Income') return 'green'
  // A legacy `Savings` row is money moved into a pot, which analytics subtracts
  // from net exactly like an outflow. Rendering it green said the opposite.
  if (row.t === 'Transfer' || row.t === 'Savings') return 'amber'
  if (row.t === 'Expense') return 'red'
  return 'navy'
}

/** `DD-MMM-YY` → `Sun 6 Sep`, falling back to the raw string. */
function dayLabel(gasDate: string): string {
  const iso = isoDate(gasDate)
  if (!iso) return fd(gasDate)
  const d = new Date(iso + 'T00:00:00')
  if (!Number.isFinite(d.getTime())) return fd(gasDate)
  return `${d.toLocaleString('en-US', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`
}

/**
 * Transaction list.
 *
 * Rows use `TransactionCard variant="row"` rather than the three-stat grid: in a
 * list of a hundred entries the Amount / Type / Date headers are identical on
 * every row, so they are noise. Type is carried by the tone and the sign, date
 * by the day header — which also earns its place by showing the day's net.
 */
export default function Transactions({ onEdit, onDuplicate, onRepeat }: Props) {
  const router = useRouter()
  const { state, dispatch } = useStore()
  const fmt = useFormatMoney()
  const { rows, total, shown } = usePage()
  const { paymentModeOptions } = useFintrackerModes()
  const rem = total - shown

  // Real modes, not a hardcoded list that drifts every time a source is added.
  const filters = useMemo(
    () => [...TYPE_FILTERS, ...paymentModeOptions],
    [paymentModeOptions],
  )

  /** Rows grouped into days, newest first, each with its own signed total. */
  const days = useMemo(() => {
    const buckets = new Map<string, Transaction[]>()
    for (const r of rows) {
      const list = buckets.get(r.date)
      if (list) list.push(r)
      else buckets.set(r.date, [r])
    }
    return [...buckets.entries()]
      .sort((a, b) => dateKey(b[0]) - dateKey(a[0]))
      .map(([date, items]) => ({
        date,
        items,
        // Transfers move money without changing the day's position, so they
        // are left out of the total rather than counted twice.
        net: items.reduce(
          (sum, r) => (r.t === 'Transfer' ? sum : r.t === 'Income' ? sum + r.a : sum - r.a),
          0,
        ),
      }))
  }, [rows])

  return (
    <div className="pg ui-kit-page-shell monthly-subpage">
      <SectionBlock
        title="Transactions"
        icon={<Pencil size={14} />}
        subtitle={state.catFilter ? `Filtered to ${state.catFilter}` : undefined}
        right={
          <span className="txn-head-actions">
            {onRepeat ? (
              <button type="button" className="btn btn-sm btn-cancel" onClick={onRepeat}>
                <Copy size={13} /> Repeat
              </button>
            ) : null}
            <SectionChip>
              {shown} / {total}
            </SectionChip>
          </span>
        }
      >
        <div className="ui-stack">
          <SearchField
            value={state.search}
            placeholder="Search description, category or mode"
            onChange={(v) => dispatch({ type: 'SET_SEARCH', payload: v })}
            onClear={() => dispatch({ type: 'SET_SEARCH', payload: '' })}
          />
          <FilterPills
            items={filters}
            active={state.catFilter || state.filter}
            onChange={(id) => {
              if (state.catFilter) dispatch({ type: 'SET_CAT_FILTER', payload: '' })
              dispatch({ type: 'SET_FILTER', payload: id })
            }}
            onClear={state.catFilter ? () => dispatch({ type: 'SET_CAT_FILTER', payload: '' }) : undefined}
          />
        </div>
      </SectionBlock>

      {state.loading ? (
        <LoadingState variant="section" />
      ) : rows.length === 0 ? (
        <div className="lb">No entries</div>
      ) : (
        <div className="ui-stack">
          {days.map((day) => (
            <div key={day.date}>
              <div className="ui-kit-txn-daybar">
                <span>{dayLabel(day.date)}</span>
                <strong>
                  {day.net < 0 ? '−' : '+'}
                  {fmt(Math.abs(day.net))}
                </strong>
              </div>
              <ListStack>
                {day.items.map((r) => {
                  const isIn = r.t === 'Income' || r.t === 'Savings'
                  const isTransfer = r.t === 'Transfer'
                  const dest = isTransfer ? transactionTransferDestination(r) : ''
                  // A linked row can jump to the module it was mirrored into.
                  const refHref =
                    r.refKind && r.refId
                      ? transactionRefHref({ kind: r.refKind, id: r.refId })
                      : undefined
                  return (
                    <TransactionCard
                      key={r.id}
                      title={
                        isTransfer && dest ? `${r.m} → ${dest}` : r.desc?.trim() || r.c || 'Untitled'
                      }
                      amount={`${isTransfer ? '↔ ' : isIn ? '+' : '−'}${fmt(r.a)}`}
                      // The grid's three columns are generic; their labels are
                      // overridden here. Date is deliberately not one of them —
                      // the day header above already carries it, and repeating
                      // it on every row is what made the card feel like filler.
                      // Category and mode are the two facts the row was missing.
                      typeLabel="Category"
                      type={isTransfer ? 'Transfer' : r.c || '—'}
                      dateLabel="Mode"
                      date={isTransfer && dest ? dest : r.m || '—'}
                      tone={toneForTransaction(r)}
                      icon={<CatIcon cat={r.c} size={14} />}
                      onClick={() => onEdit(r)}
                      refHref={refHref}
                      refLabel={
                        r.refKind ? `Open in ${transactionRefKindLabel(r.refKind)}` : undefined
                      }
                      onRefOpen={refHref ? () => void router.push(refHref) : undefined}
                      onDuplicate={
                        onDuplicate
                          ? (e) => {
                              e.stopPropagation()
                              onDuplicate(r)
                            }
                          : undefined
                      }
                    />
                  )
                })}
              </ListStack>
            </div>
          ))}
        </div>
      )}

      {rem > 0 && (
        <button
          className="btn"
          style={{ width: '100%', marginTop: 0, background: 'var(--navy-lt)', color: 'var(--navy)' }}
          onClick={() => dispatch({ type: 'SET_TXN_PAGE', payload: state.txnPage + 1 })}
        >
          + Show {Math.min(rem, TXN_PAGE)} more ({rem} remaining)
        </button>
      )}
    </div>
  )
}
