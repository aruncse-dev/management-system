import { useEffect, useMemo, useState } from 'react'
import { Copy, Search } from 'lucide-react'
import { ModalShell, ModalActions, InfoCallout, LoadingState, FilterPills } from '../ui'
import { api } from '../api'
import { MNS } from '../config'
import { fd } from '../utils'
import type { Transaction } from '../types'

/** Step a labelled month back by `n`, wrapping the year. */
function monthsBack(month: string, year: string, n: number): { month: string; year: string } | null {
  const i = MNS.indexOf(month as (typeof MNS)[number])
  const y = parseInt(year, 10)
  if (i < 0 || !Number.isFinite(y)) return null
  const total = i - n
  const yearShift = Math.floor(total / 12)
  const idx = ((total % 12) + 12) % 12
  return { month: MNS[idx], year: String(y + yearShift) }
}

/**
 * Move a `DD-MMM-YY` date onto the same day-of-month in the target month,
 * clamping to the target's length so a 31st becomes the 30th (or 28th/29th).
 */
export function remapToMonth(gasDate: string, month: string, year: string): string {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(gasDate.trim())
  const targetIdx = MNS.indexOf(month as (typeof MNS)[number])
  const y = parseInt(year, 10)
  if (!m || targetIdx < 0 || !Number.isFinite(y)) return gasDate
  const lastDay = new Date(y, targetIdx + 1, 0).getDate()
  const day = Math.min(Math.max(parseInt(m[1], 10), 1), lastDay)
  return `${String(day).padStart(2, '0')}-${MNS[targetIdx]}-${String(y).slice(2)}`
}

/** Identity of a repeating entry: what it is called and what it is for. */
function recurrenceKey(r: Transaction): string {
  return `${(r.desc || '').trim().toLowerCase()}|${(r.c || '').trim().toLowerCase()}`
}

/** Day-of-month from `DD-MMM-YY`, or 0 when unparseable. */
function dayOfMonth(gasDate: string): number {
  const m = /^(\d{1,2})-[A-Za-z]{3}-\d{2}$/.exec((gasDate || '').trim())
  return m ? parseInt(m[1], 10) : 0
}

/**
 * How far apart two days-of-month may be and still count as "the same date".
 * A bill paid on the 1st and the 3rd is the same bill; one paid on the 2nd and
 * the 27th is not. Three days also absorbs weekends shifting a debit.
 */
const DAY_TOLERANCE = 3

/**
 * Entries that look genuinely recurring: the same name and category, the same
 * amount, and the same day of month (±3), present in *both* previous cycles.
 *
 * All three tests are needed. Across six cycles of real data, 92 groups repeat
 * but only ~21 keep a fixed amount, and of those several — a cut of mutton, a
 * milk top-up — merely happened to cost the same twice, on unrelated days.
 * Requiring the date as well leaves the standing commitments: rent, EMIs, fees,
 * insurance premiums. Groceries and petrol recur too, at a different price every
 * time; those are habits, not repeatable entries.
 */
export function findRecurring(prev: Transaction[], before: Transaction[]): Transaction[] {
  const earlier = new Map<string, { a: number; day: number }[]>()
  for (const r of before) {
    const k = recurrenceKey(r)
    if (!earlier.has(k)) earlier.set(k, [])
    earlier.get(k)!.push({ a: r.a, day: dayOfMonth(r.date) })
  }
  const seen = new Set<string>()
  const out: Transaction[] = []
  for (const r of prev) {
    const k = recurrenceKey(r)
    if (seen.has(k)) continue
    const day = dayOfMonth(r.date)
    const match = earlier.get(k)?.some(
      (e) => e.a === r.a && e.day > 0 && day > 0 && Math.abs(e.day - day) <= DAY_TOLERANCE,
    )
    if (match) {
      seen.add(k)
      out.push(r)
    }
  }
  return out.sort((a, b) => b.a - a.a)
}

type Props = {
  /** Target month/year — the cycle currently being viewed. */
  month: string
  year: string
  onClose: () => void
  /** Called after a successful copy so the caller can refresh and notify. */
  onCopied: (count: number) => void
}

const VIEWS = ['Recurring', 'All from last cycle'] as const

/**
 * Copy transactions from the previous cycle into the current one.
 *
 * Defaults to the recurring set — fixed commitments like rent, EMIs and school
 * fees — with everything else one tap away. No recurring-rule schema: it reads
 * two cycles with the existing `getData` and replays the selection through the
 * existing `addRow`, which at a couple of dozen rows a month is adequate.
 */
export default function RepeatSheet({ month, year, onClose, onCopied }: Props) {
  const prev = useMemo(() => monthsBack(month, year, 1), [month, year])
  const before = useMemo(() => monthsBack(month, year, 2), [month, year])
  const [rows, setRows] = useState<Transaction[] | null>(null)
  const [recurring, setRecurring] = useState<Transaction[]>([])
  const [view, setView] = useState<(typeof VIEWS)[number]>('Recurring')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!prev || !before) {
      setError('Could not resolve the previous cycles.')
      setRows([])
      return
    }
    let cancelled = false
    // Local state only — dispatching SET_ROWS would clobber the visible month.
    void Promise.all([
      api.getData(prev.month, prev.year),
      // The cycle before last is only used to decide what repeats; if it fails we
      // still show the full list rather than nothing.
      api.getData(before.month, before.year).catch(() => [] as Transaction[]),
    ])
      .then(([last, earlier]) => {
        if (cancelled) return
        setRows(last)
        const rec = findRecurring(last, earlier)
        setRecurring(rec)
        // Pre-select the recurring set: it is the reason the sheet was opened.
        setSelected(new Set(rec.map((r) => r.id)))
        if (rec.length === 0) setView('All from last cycle')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not load last cycle')
        setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [prev, before])

  const visible = useMemo(() => {
    const list = view === 'Recurring' ? recurring : (rows ?? [])
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (r) =>
        r.desc.toLowerCase().includes(q) ||
        r.c.toLowerCase().includes(q) ||
        r.m.toLowerCase().includes(q),
    )
  }, [rows, recurring, view, search])

  const toggle = (id: string) =>
    setSelected((prevSel) => {
      const next = new Set(prevSel)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id))
  const toggleAll = () =>
    setSelected((prevSel) => {
      const next = new Set(prevSel)
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.id))
      else visible.forEach((r) => next.add(r.id))
      return next
    })

  const copy = async () => {
    const picked = (rows ?? []).filter((r) => selected.has(r.id))
    if (!picked.length) return
    setSaving(true)
    setError('')
    let done = 0
    try {
      for (const r of picked) {
        await api.addRow({
          month,
          year,
          date: remapToMonth(r.date, month, year),
          desc: r.desc,
          a: r.a,
          c: r.c,
          t: r.t,
          m: r.m,
          notes: r.notes ?? '',
          ...(r.transferTo ? { transferTo: r.transferTo } : {}),
        })
        done++
      }
      onCopied(done)
      onClose()
    } catch (e) {
      // Partial success is possible: report how many landed so nothing is silently lost.
      setError(
        `${done} of ${picked.length} copied. ${e instanceof Error ? e.message : 'Copy failed'}`,
      )
      if (done > 0) onCopied(done)
    } finally {
      setSaving(false)
    }
  }

  const prevLabel = prev ? `${prev.month} ${prev.year}` : 'last cycle'
  const recurringTotal = recurring
    .filter((r) => selected.has(r.id))
    .reduce((sum, r) => sum + r.a, 0)

  return (
    <ModalShell
      title={`Repeat from ${prevLabel}`}
      onClose={onClose}
      footer={
        <ModalActions
          primaryLabel={saving ? 'Copying…' : `Copy to ${month}`}
          secondaryLabel="Cancel"
          onPrimary={copy}
          onSecondary={onClose}
          disabled={saving || selected.size === 0}
          primaryPrefix={<Copy size={14} />}
          leading={
            <span className="repeat-count">
              {selected.size
                ? `${selected.size} selected · ${Math.round(recurringTotal).toLocaleString('en-IN')}`
                : 'Nothing selected'}
            </span>
          }
        />
      }
    >
      <InfoCallout title="Same day, this month">
        {view === 'Recurring'
          ? 'Entries with the same name and amount in both of the last two cycles — rent, EMIs, fees. Each keeps its day-of-month, clamped if this month is shorter.'
          : 'Everything from last cycle. Amounts and dates are copied as-is — edit them afterwards like any transaction.'}
      </InfoCallout>

      {rows === null ? (
        <LoadingState variant="section" />
      ) : (
        <>
          <div className="ui-stack">
            <FilterPills
              items={[...VIEWS]}
              active={view}
              onChange={(v) => setView(v as (typeof VIEWS)[number])}
            />
            <div className="repeat-toolbar">
              <div className="repeat-search">
                <Search size={14} />
                <input
                  className="form-inp"
                  type="text"
                  placeholder="Search last cycle"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {visible.length ? (
                <button type="button" className="btn btn-sm btn-cancel" onClick={toggleAll}>
                  {allVisibleSelected ? 'Clear' : 'Select all'}
                </button>
              ) : null}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="lb" style={{ padding: '18px 4px', color: 'var(--muted)' }}>
              {view === 'Recurring'
                ? `Nothing repeated identically across ${prevLabel} and the cycle before it.`
                : rows.length === 0
                  ? `No transactions in ${prevLabel}.`
                  : 'Nothing matches that search.'}
            </div>
          ) : (
            <div className="repeat-list">
              {visible.map((r) => {
                const on = selected.has(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`repeat-row${on ? ' is-selected' : ''}`}
                    onClick={() => toggle(r.id)}
                    aria-pressed={on}
                  >
                    <span className="repeat-check" aria-hidden="true">
                      {on ? '✓' : ''}
                    </span>
                    <span className="repeat-body">
                      <span className="repeat-desc">{r.desc || r.c || 'Untitled'}</span>
                      <span className="repeat-meta">
                        {fd(r.date)} · {r.c || '—'} · {r.m || '—'}
                      </span>
                    </span>
                    <span className={`repeat-amt${r.t === 'Income' ? ' is-income' : ''}`}>
                      {r.t === 'Income' ? '+' : '−'}
                      {Math.round(r.a).toLocaleString('en-IN')}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {error ? <div className="repeat-error">{error}</div> : null}
    </ModalShell>
  )
}
