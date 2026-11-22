import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Calendar, CalendarCheck, ChevronLeft, ChevronRight, RefreshCw, Users } from 'lucide-react'
import { MNS } from '../config'
import { api } from '../api'
import { useStaffWorkspace } from '../StaffWorkspaceContext'
import { expectedWorkingDays, isWeeklyOff } from '../lib/payroll'
import type { AttendanceRow, StaffMember } from '../types'
import { InfoCallout, KpiCard, KpiGrid, LoadingState, ModalShell, SectionBlock, SectionChip, Spacer } from '../ui'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

/** Keeps last-fetched rows per month for this browser session (avoids full-page loader on return). */
const attendanceByMonth = new Map<string, AttendanceRow[]>()

function attendanceMonthKey(month: string, year: string) {
  return `${month}|${year}`
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function ymdParts(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split('-').map(Number)
  return [y, m, d]
}

function formatDayTitle(ymd: string) {
  const [y, m, d] = ymdParts(ymd)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback
}

/** One row per (staff, date) that counts as worked. */
type DayMap = Map<string, AttendanceRow[]>

function buildDayMap(rows: AttendanceRow[]): DayMap {
  const map: DayMap = new Map()
  for (const r of rows) {
    if (!r.worked) continue
    const list = map.get(r.date)
    if (list) list.push(r)
    else map.set(r.date, [r])
  }
  return map
}

function entryKey(staffId: string, date: string) {
  return `${staffId}|${date}`
}

type Change = { staffId: string; date: string; worked: boolean; overtime: boolean; notes?: string }

/**
 * Tap-to-mark list for one day: every active staff member with a present
 * toggle, an OT toggle and an optional note. Replaces the old flow of picking
 * one person from a select, pressing Add and waiting for a full refetch.
 */
function DayChecklist({
  date,
  staff,
  entries,
  pending,
  onChange,
  onMarkAll,
}: {
  date: string
  staff: StaffMember[]
  entries: AttendanceRow[]
  pending: Set<string>
  onChange: (c: Change) => void
  onMarkAll: (staffIds: string[]) => void
}) {
  const [y, m, d] = ymdParts(date)
  const byStaff = useMemo(() => new Map(entries.map(e => [e.staffId, e])), [entries])
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const absentIds = staff.filter(s => !byStaff.has(s.id) && !isWeeklyOff(y, m, d, s.weeklyOff)).map(s => s.id)
  const presentCount = staff.filter(s => byStaff.has(s.id)).length

  if (!staff.length) {
    return (
      <div className="att-empty">No active staff. Mark someone active on the Staffs page to record attendance.</div>
    )
  }

  const saveNote = (s: StaffMember) => {
    const e = byStaff.get(s.id)
    setNoteFor(null)
    if (!e) return
    const next = noteDraft.trim()
    if (next === (e.notes ?? '')) return
    onChange({ staffId: s.id, date, worked: true, overtime: e.overtime, notes: next || undefined })
  }

  return (
    <div className="att-checklist">
      <div className="att-checklist-head">
        <span className="att-checklist-count">
          {presentCount} of {staff.length} present
        </span>
        {absentIds.length > 0 && (
          <button
            type="button"
            className="ui-kit-btn ui-kit-btn--soft att-markall"
            onClick={() => onMarkAll(absentIds)}
            disabled={absentIds.some(id => pending.has(entryKey(id, date)))}
          >
            <CalendarCheck size={15} /> Mark all present
          </button>
        )}
      </div>
      <ul className="att-list">
        {staff.map(s => {
          const e = byStaff.get(s.id)
          const present = Boolean(e)
          const busy = pending.has(entryKey(s.id, date))
          const off = isWeeklyOff(y, m, d, s.weeklyOff)
          return (
            <li key={s.id} className={`att-row${present ? ' is-present' : ''}${busy ? ' is-busy' : ''}`}>
              <button
                type="button"
                className="att-toggle"
                role="switch"
                aria-checked={present}
                aria-label={`${s.name}: ${present ? 'present' : 'absent'}`}
                disabled={busy}
                onClick={() =>
                  onChange({ staffId: s.id, date, worked: !present, overtime: false, notes: e?.notes ?? undefined })
                }
              >
                <span className="att-check" aria-hidden>
                  {present ? '✓' : ''}
                </span>
                <span className="att-name">
                  <span className="att-name-main">{s.name}</span>
                  <span className="att-name-sub">
                    {present ? (e?.overtime ? 'Present · OT' : 'Present') : off ? 'Weekly off' : 'Absent'}
                    {e?.notes ? ` · ${e.notes}` : ''}
                  </span>
                </span>
              </button>
              {present && (
                <div className="att-row-actions">
                  <button
                    type="button"
                    className={`att-chip${e?.overtime ? ' is-on' : ''}`}
                    aria-pressed={Boolean(e?.overtime)}
                    disabled={busy}
                    onClick={() =>
                      onChange({ staffId: s.id, date, worked: true, overtime: !e?.overtime, notes: e?.notes ?? undefined })
                    }
                  >
                    OT
                  </button>
                  <button
                    type="button"
                    className="att-chip"
                    disabled={busy}
                    onClick={() => {
                      setNoteFor(s.id)
                      setNoteDraft(e?.notes ?? '')
                    }}
                  >
                    Note
                  </button>
                </div>
              )}
              {noteFor === s.id && (
                <input
                  className="form-inp att-note"
                  autoFocus
                  value={noteDraft}
                  placeholder="Add a note…"
                  onChange={ev => setNoteDraft(ev.target.value)}
                  onBlur={() => saveNote(s)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter') saveNote(s)
                    if (ev.key === 'Escape') setNoteFor(null)
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function AttendancePage() {
  const { staffList, activeStaff, staffLoading, staffError, refreshStaff } = useStaffWorkspace()
  const now = new Date()
  const [month, setMonth] = useState<string>(() => MNS[now.getMonth()])
  const [year, setYear] = useState<string>(() => String(now.getFullYear()))
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>(
    () => attendanceByMonth.get(attendanceMonthKey(MNS[now.getMonth()], String(now.getFullYear()))) ?? [],
  )
  const [loading, setLoading] = useState(
    () => !attendanceByMonth.has(attendanceMonthKey(MNS[now.getMonth()], String(now.getFullYear()))),
  )
  /** Persistent load error — shown with Retry instead of a 3-second toast over an empty month. */
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null)
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  const [pending, setPending] = useState<Set<string>>(() => new Set())
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const monthRef = useRef(month)
  const yearRef = useRef(year)
  monthRef.current = month
  yearRef.current = year

  const showToast = useCallback((msg: string, bad = false) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, bad })
    toastTimer.current = setTimeout(() => setToast(null), bad ? 5000 : 2200)
  }, [])

  const loadMonth = useCallback(async (m: string, y: string) => {
    const key = attendanceMonthKey(m, y)
    const cached = attendanceByMonth.get(key)
    if (cached) {
      setAttendanceRows(cached)
      setLoading(false)
    } else {
      setAttendanceRows([])
      setLoading(true)
    }
    try {
      const rows = await api.getAttendance(m, y)
      if (monthRef.current !== m || yearRef.current !== y) return
      attendanceByMonth.set(key, rows)
      setAttendanceRows(rows)
      setLoadError(null)
    } catch (e) {
      if (monthRef.current !== m || yearRef.current !== y) return
      // Keep whatever was on screen: clearing it made a failed load look like
      // an empty month, inviting the whole month to be marked again.
      setLoadError(errMsg(e, 'Could not load attendance'))
    } finally {
      if (monthRef.current === m && yearRef.current === y) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMonth(month, year)
    setDayModalDate(null)
  }, [month, year, loadMonth])

  const monthIndex = MNS.indexOf(month as (typeof MNS)[number])
  const monthYear = `${year}-${pad2(monthIndex + 1)}`
  const todayYmd = toYmd(now)
  const isCurrentMonth = todayYmd.startsWith(monthYear)

  const dayMap = useMemo(() => buildDayMap(attendanceRows), [attendanceRows])

  // Everyone who can still be marked, plus anyone deactivated who already has
  // days in this month — deactivating someone must not erase their month.
  const dashboardRows = useMemo(() => {
    const withRows = new Set(attendanceRows.filter(r => r.worked).map(r => r.staffId))
    const [ty, tm, td] = ymdParts(todayYmd)
    const throughDay = isCurrentMonth ? td : monthYear < `${ty}-${pad2(tm)}` ? undefined : 0
    return staffList
      .filter(s => s.active || withRows.has(s.id))
      .map(s => {
        const mine = attendanceRows.filter(r => r.staffId === s.id && r.worked)
        return {
          staff: s,
          workedDays: new Set(mine.map(r => r.date)).size,
          otDays: mine.filter(r => r.overtime).length,
          expected: expectedWorkingDays(monthYear, s.weeklyOff, throughDay),
        }
      })
  }, [staffList, attendanceRows, monthYear, todayYmd, isCurrentMonth])

  /** Apply a change to local rows immediately; the server call confirms it. */
  const applyLocal = useCallback((changes: Change[]) => {
    setAttendanceRows(prev => {
      const drop = new Set(changes.map(c => entryKey(c.staffId, c.date)))
      const next = prev.filter(r => !drop.has(entryKey(r.staffId, r.date)))
      for (const c of changes) {
        if (c.worked) {
          next.push({ entryId: '', date: c.date, staffId: c.staffId, worked: true, overtime: c.overtime, notes: c.notes })
        }
      }
      next.sort((a, b) => a.date.localeCompare(b.date) || a.staffId.localeCompare(b.staffId))
      attendanceByMonth.set(attendanceMonthKey(monthRef.current, yearRef.current), next)
      return next
    })
  }, [])

  const commit = useCallback(
    async (changes: Change[]) => {
      if (!changes.length) return
      const m = month
      const y = year
      const keys = changes.map(c => entryKey(c.staffId, c.date))
      const keySet = new Set(keys)
      // Only these entries are rolled back on failure, so a save that fails
      // cannot undo another one that is still in flight.
      const previous = attendanceRows.filter(r => keySet.has(entryKey(r.staffId, r.date)))
      setPending(p => new Set([...p, ...keys]))
      applyLocal(changes)
      try {
        if (changes.length === 1) {
          await api.setAttendance({ month: m, year: y, ...changes[0] })
        } else {
          await api.setAttendanceBulk({ month: m, year: y, entries: changes })
        }
        if (changes.length > 1) showToast(`✓ Marked ${changes.length} present`)
      } catch (e) {
        if (monthRef.current === m && yearRef.current === y) {
          setAttendanceRows(cur => {
            const next = [...cur.filter(r => !keySet.has(entryKey(r.staffId, r.date))), ...previous].sort(
              (a, b) => a.date.localeCompare(b.date) || a.staffId.localeCompare(b.staffId),
            )
            attendanceByMonth.set(attendanceMonthKey(m, y), next)
            return next
          })
        }
        showToast('⚠ ' + errMsg(e, 'Save failed'), true)
      } finally {
        setPending(p => {
          const n = new Set(p)
          for (const k of keys) n.delete(k)
          return n
        })
      }
    },
    [month, year, attendanceRows, applyLocal, showToast],
  )

  const markAll = useCallback(
    (date: string, staffIds: string[]) =>
      void commit(staffIds.map(staffId => ({ staffId, date, worked: true, overtime: false }))),
    [commit],
  )

  const changeMonth = (dir: 1 | -1) => {
    let idx = monthIndex + dir
    let y = parseInt(year, 10)
    if (idx < 0) {
      idx = 11
      y--
    }
    if (idx > 11) {
      idx = 0
      y++
    }
    setMonth(MNS[idx])
    setYear(String(y))
  }

  const goToday = () => {
    setMonth(MNS[now.getMonth()])
    setYear(String(now.getFullYear()))
  }

  const grid = useMemo(() => {
    const y = parseInt(year, 10)
    const pad = new Date(y, monthIndex, 1).getDay()
    const days = new Date(y, monthIndex + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < pad; i++) cells.push(null)
    for (let d = 1; d <= days; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [monthIndex, year])

  /** Who the day sheet lists: active staff, plus anyone inactive already marked that day. */
  const checklistStaff = useCallback(
    (date: string) => {
      const marked = new Set((dayMap.get(date) ?? []).map(e => e.staffId))
      return staffList.filter(s => s.active || marked.has(s.id))
    },
    [staffList, dayMap],
  )

  const showLoader = (staffLoading || loading) && !attendanceRows.length && !loadError

  return (
    <div className="monthly-wrap">
      <nav className="nav-sub att-nav">
        <div className="nav-month">
          <button type="button" className="nav-arrow" onClick={() => changeMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <div className="nav-ml" aria-live="polite">
            {month} {year}
          </div>
          <button type="button" className="nav-arrow" onClick={() => changeMonth(1)} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="nav-r">
          {!isCurrentMonth && (
            <button type="button" className="nav-sync" onClick={goToday}>
              Today
            </button>
          )}
          <button
            type="button"
            className="nav-sync nav-sync--icon"
            onClick={() => {
              void refreshStaff({ soft: true })
              void loadMonth(month, year)
            }}
            disabled={loading}
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'att-spin' : undefined} />
          </button>
        </div>
      </nav>

      {toast && (
        <div className={`att-toast${toast.bad ? ' is-bad' : ''}`} role="status">
          {toast.msg}
        </div>
      )}

      <main className="attendance-main">
        {loadError && (
          <>
            <InfoCallout title="Couldn't load this month" tone="red">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span>{loadError}</span>
                <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={() => void loadMonth(month, year)}>
                  Retry
                </button>
              </div>
            </InfoCallout>
            <Spacer size={12} />
          </>
        )}

        {showLoader ? (
          <LoadingState variant="page" label="Loading…" />
        ) : !staffList.length ? (
          <div className="att-empty">
            <Users size={28} aria-hidden />
            <div>{staffError ? `Couldn't load staff: ${staffError}` : 'No staff yet.'}</div>
            {!staffError && (
              <Link className="ui-kit-btn ui-kit-btn--solid" href="/staffs">
                Add staff
              </Link>
            )}
          </div>
        ) : (
          <>
            {isCurrentMonth && (
              <>
                <SectionBlock
                  title="Today"
                  icon={<CalendarCheck size={16} />}
                  right={<SectionChip>{formatDayTitle(todayYmd)}</SectionChip>}
                >
                  <DayChecklist
                    date={todayYmd}
                    staff={checklistStaff(todayYmd)}
                    entries={dayMap.get(todayYmd) ?? []}
                    pending={pending}
                    onChange={c => void commit([c])}
                    onMarkAll={ids => markAll(todayYmd, ids)}
                  />
                </SectionBlock>
                <Spacer size={12} />
              </>
            )}

            <SectionBlock title="Calendar" icon={<Calendar size={16} />} right={<SectionChip>{month}</SectionChip>}>
              <div className="att-cal att-cal-head" aria-hidden>
                {WEEKDAYS.map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>
              <div className="att-cal">
                {grid.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />
                  const dateStr = `${monthYear}-${pad2(day)}`
                  const entries = dayMap.get(dateStr) ?? []
                  const n = entries.length
                  const ot = entries.some(r => r.overtime)
                  const future = dateStr > todayYmd
                  const cls = [
                    'att-day',
                    n ? (ot ? 'is-ot' : 'is-work') : '',
                    dateStr === todayYmd ? 'is-today' : '',
                    future ? 'is-future' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      className={cls}
                      onClick={() => setDayModalDate(dateStr)}
                      disabled={future}
                      aria-label={`${formatDayTitle(dateStr)}: ${n} present${ot ? ', overtime' : ''}`}
                    >
                      <span className="att-day-num">{day}</span>
                      {n > 0 && <span className="att-day-count">{n}</span>}
                    </button>
                  )
                })}
              </div>
              <div className="att-legend" aria-hidden>
                <span><i className="att-dot is-work" /> Present</span>
                <span><i className="att-dot is-ot" /> Overtime</span>
                <span className="att-legend-hint">Number = people present</span>
              </div>
            </SectionBlock>

            <Spacer size={12} />
            <div className="dashboard-page">
              <KpiGrid style={{ marginBottom: 0 }}>
                {dashboardRows.map(({ staff, workedDays, otDays, expected }) => (
                  <KpiCard
                    key={staff.id}
                    label={staff.name}
                    value={expected ? `${workedDays}/${expected}` : workedDays}
                    subtitle={
                      (staff.active ? '' : 'Inactive · ') +
                      (expected ? 'days worked' : 'days') +
                      (otDays ? ` · ${otDays} OT` : '')
                    }
                    tone={staff.active ? 'navy' : 'muted'}
                    icon={<Users size={14} />}
                  />
                ))}
              </KpiGrid>
            </div>
          </>
        )}
      </main>

      {dayModalDate ? (
        <ModalShell
          title={formatDayTitle(dayModalDate)}
          onClose={() => setDayModalDate(null)}
          footer={
            <div className="ui-kit-modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="ui-kit-btn ui-kit-btn--solid" onClick={() => setDayModalDate(null)}>
                Done
              </button>
            </div>
          }
        >
          <DayChecklist
            date={dayModalDate}
            staff={checklistStaff(dayModalDate)}
            entries={dayMap.get(dayModalDate) ?? []}
            pending={pending}
            onChange={c => void commit([c])}
            onMarkAll={ids => markAll(dayModalDate, ids)}
          />
        </ModalShell>
      ) : null}
    </div>
  )
}
