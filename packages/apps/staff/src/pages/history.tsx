import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  RefreshCw,
  Search,
  UserX,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '../api'
import { MNS } from '../config'
import { WEEKLY_OFF_LABELS, type HistoryRow } from '../types'
import {
  HoldingCard,
  KpiCard,
  KpiGrid,
  LoadingState,
  SearchField,
  SectionBlock,
  SectionChip,
  Spacer,
} from '../ui'

/** Search only earns its space once a month has a few people in it. */
const STAFF_SEARCH_MIN_COUNT = 5

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

/** 'Sep 2026' from 'YYYY-MM'. */
function monthLabel(monthYear: string) {
  const [y, m] = monthYear.split('-')
  return `${MNS[parseInt(m, 10) - 1] ?? m} ${y}`
}

function shiftMonthKey(monthYear: string, by: number) {
  const [y, m] = monthYear.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** Terms first, then anything unusual about the month. */
function rowSubtitle(r: HistoryRow) {
  // Daily workers are paid strictly for days worked: weekly off, leave allowance
  // and absence have no bearing on their pay, so none of it is reported for them.
  if (r.salaryType === 'daily') return `Per day · ${inr(r.salaryAmount)}`

  const bits = [`Monthly · ${inr(r.salaryAmount)}`]
  if (r.weeklyOff !== 'none') bits.push(WEEKLY_OFF_LABELS[r.weeklyOff])
  if (r.otDays > 0) bits.push(plural(r.otDays, 'OT day', 'OT days'))
  // Absence still matters mid-month, it just cannot be the headline number.
  if (r.inProgress && r.absentDays > 0) bits.push(`${r.absentDays} absent so far`)
  return bits.join(' · ')
}

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  /** Set once, so landing on the page shows the newest month that actually has data. */
  const [monthPinned, setMonthPinned] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await api.getHistory())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Month keys are 'YYYY-MM', so lexical order is chronological.
  const latestMonthKey = useMemo(
    () => rows.reduce<string | null>((latest, r) => (!latest || r.monthYear > latest ? r.monthYear : latest), null),
    [rows],
  )

  useEffect(() => {
    if (monthPinned || loading || !latestMonthKey) return
    setMonthKey(latestMonthKey)
    setMonthPinned(true)
  }, [monthPinned, loading, latestMonthKey])

  const monthRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter(r => r.monthYear === monthKey)
      .filter(r => (q ? r.staffName.toLowerCase().includes(q) : true))
      .sort((a, b) => b.estimate - a.estimate || a.staffName.localeCompare(b.staffName))
  }, [rows, monthKey, search])

  const monthTotals = useMemo(
    () =>
      monthRows.reduce(
        (acc, r) => ({ people: acc.people + 1, estimate: acc.estimate + r.estimate }),
        { people: 0, estimate: 0 },
      ),
    [monthRows],
  )

  /** Partial figures: the month has not finished, so absence is not final. */
  const monthInProgress = useMemo(() => monthRows.some(r => r.inProgress), [monthRows])

  const monthHasData = useMemo(() => rows.some(r => r.monthYear === monthKey), [rows, monthKey])
  const peopleInMonth = useMemo(
    () => rows.filter(r => r.monthYear === monthKey).length,
    [rows, monthKey],
  )
  const showSearch = peopleInMonth >= STAFF_SEARCH_MIN_COUNT
  const searchActive = showSearch && search.trim().length > 0

  useEffect(() => {
    if (!showSearch && search) setSearch('')
  }, [showSearch, search])

  // Previous month against the same filter, so the delta is like-for-like.
  const prevEstimate = useMemo(() => {
    const prev = shiftMonthKey(monthKey, -1)
    return rows.filter(r => r.monthYear === prev).reduce((s, r) => s + r.estimate, 0)
  }, [rows, monthKey])

  const deltaLabel = useMemo(() => {
    if (!monthHasData || prevEstimate <= 0) return plural(monthTotals.people, 'person', 'people')
    const diff = monthTotals.estimate - prevEstimate
    if (Math.round(diff) === 0) return 'Same as last month'
    return `${diff > 0 ? '+' : '−'}${inr(Math.abs(diff))} vs last month`
  }, [monthHasData, prevEstimate, monthTotals])

  function changeMonth(dir: 1 | -1) {
    setMonthPinned(true)
    setMonthKey(k => shiftMonthKey(k, dir))
  }

  return (
    <div className="monthly-wrap">
      <nav className="nav-sub">
        <div className="nav-month" style={{ flex: 1, justifyContent: 'center' }}>
          <button type="button" className="nav-arrow" onClick={() => changeMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <div className="nav-ml">{monthLabel(monthKey)}</div>
          <button type="button" className="nav-arrow" onClick={() => changeMonth(1)} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          className="nav-sync"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh"
        >
          {loading ? '…' : <RefreshCw size={13} />}
        </button>
      </nav>

      <main className="attendance-main">
        {loading ? (
          <LoadingState variant="page" label="Loading history…" />
        ) : error ? (
          <div style={{ padding: 16 }}>
            <div className="settings-alert">⚠ {error}</div>
          </div>
        ) : (
          <>
            <SectionBlock
              title="Summary"
              icon={<History size={16} />}
              subtitle={monthHasData ? (monthInProgress ? `In progress · ${deltaLabel}` : deltaLabel) : undefined}
              right={<SectionChip>{monthLabel(monthKey)}</SectionChip>}
            >
              <div className="ui-stack">
                <KpiGrid variant="dash" style={{ marginBottom: 0 }}>
                  <KpiCard
                    full
                    label="Estimated payout"
                    value={inr(monthTotals.estimate)}
                    subtitle={plural(monthTotals.people, 'person', 'people')}
                    tone="navy"
                    icon={<Wallet size={14} />}
                  />
                </KpiGrid>
              </div>
            </SectionBlock>

            <SectionBlock
              title="Staff"
              icon={<Users size={16} />}
              right={<SectionChip>{monthRows.length}</SectionChip>}
            >
              {showSearch ? (
                <SearchField
                  value={search}
                  placeholder="Search staff…"
                  onChange={setSearch}
                  onClear={() => setSearch('')}
                  prefix={<Search size={14} />}
                />
              ) : null}
            </SectionBlock>

            {monthRows.length === 0 ? (
              <div
                style={{
                  padding: '18px 14px',
                  color: 'var(--muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'center',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <span style={{ display: 'flex', justifyContent: 'center' }}>
                  <History size={26} strokeWidth={1.6} />
                </span>
                <span>
                  {searchActive ? 'No matches for this search.' : `Nothing recorded in ${monthLabel(monthKey)}.`}
                </span>
                {!searchActive && rows.length === 0 ? (
                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                    Mark days on the Attendance calendar and they will show up here.
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="ui-stack">
                {monthRows.map(r => (
                  <HoldingCard
                    key={`${r.monthYear}-${r.staffId}`}
                    className="txn-entry-card"
                    title={r.staffName}
                    subtitle={rowSubtitle(r)}
                    accentTone={r.staffActive ? 'navy' : 'amber'}
                    icon={r.staffActive ? <Clock size={14} /> : <UserX size={14} />}
                    iconPosition="right"
                    iconBackground
                    rightTop={
                      r.staffActive ? undefined : (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>INACTIVE</span>
                      )
                    }
                    leftLabel="Days"
                    leftValue={r.salaryType === 'monthly' ? `${r.workedDays} / ${r.expectedDays}` : r.workedDays}
                    centerLabel={r.salaryType === 'daily' ? 'OT' : r.inProgress ? 'Left' : 'Absent'}
                    centerValue={
                      r.salaryType === 'daily' ? r.otDays : r.inProgress ? r.remainingDays : r.absentDays
                    }
                    rightLabel="Estimate"
                    rightValue={inr(r.estimate)}
                  />
                ))}
              </div>
            )}

            <Spacer size={16} />
          </>
        )}
      </main>
    </div>
  )
}
