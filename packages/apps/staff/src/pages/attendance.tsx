import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, Users } from 'lucide-react'
import { MNS } from '../config'
import { api, invalidateCache } from '../api'
import type { AttendanceRow, StaffMember } from '../types'
import { FormField, KpiCard, KpiGrid, ModalShell, SectionBlock, Spacer, UiPill } from '../ui'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatDayModalTitle(ymd: string) {
  const p = ymd.split('-').map(Number)
  if (p.length !== 3 || p.some(n => Number.isNaN(n))) return ymd
  const dt = new Date(p[0], p[1] - 1, p[2])
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
}

/** Distinct worked dates + OT row count for the selected month. */
function staffMonthStats(rows: AttendanceRow[], staffId: string) {
  const mine = rows.filter(r => r.staffId === staffId && r.worked)
  const workedDays = new Set(mine.map(r => r.date)).size
  const otDays = mine.filter(r => r.overtime).length
  return { workedDays, otDays }
}

type DayCellVisual = 'empty' | 'work' | 'ot'

function dayCellVisual(rows: AttendanceRow[], dateStr: string): DayCellVisual {
  const onDay = rows.filter(r => r.date === dateStr && r.worked)
  if (onDay.length === 0) return 'empty'
  if (onDay.some(r => r.overtime)) return 'ot'
  return 'work'
}

export default function AttendancePage() {
  const now = useMemo(() => new Date(), [])
  const [month, setMonth] = useState<string>(MNS[now.getMonth()])
  const [year, setYear] = useState<string>(String(now.getFullYear()))
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  const [addStaffId, setAddStaffId] = useState('')
  const [addOt, setAddOt] = useState(false)
  const [modalBusy, setModalBusy] = useState(false)

  const showStatus = useCallback((msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 3000)
  }, [])

  const loadStaff = useCallback(async () => {
    const list = await api.listStaff()
    setStaffList(list.filter(s => s.active))
  }, [])

  const loadMonth = useCallback(
    async (m: string, y: string) => {
      setLoading(true)
      try {
        await api.ensureMonth(m, y)
        invalidateCache({ action: 'getAttendance', params: { month: m, year: y } })
        const rows = await api.getAttendance(m, y)
        setAttendanceRows(rows)
        showStatus(`✓ ${m} ${y}`)
      } catch (e) {
        showStatus('⚠ ' + (e instanceof Error ? e.message : 'Load failed'))
        setAttendanceRows([])
      } finally {
        setLoading(false)
      }
    },
    [showStatus],
  )

  const refreshAttendance = useCallback(async () => {
    invalidateCache({ action: 'getAttendance', params: { month, year } })
    const rows = await api.getAttendance(month, year)
    setAttendanceRows(rows)
  }, [month, year])

  useEffect(() => {
    ;(async () => {
      try {
        await loadStaff()
      } catch (e) {
        showStatus('⚠ ' + (e instanceof Error ? e.message : 'Staff list failed'))
      }
    })()
  }, [loadStaff, showStatus])

  useEffect(() => {
    void loadMonth(month, year)
  }, [month, year, loadMonth])

  useEffect(() => {
    setDayModalDate(null)
  }, [month, year])

  const monthIndex = MNS.indexOf(month as (typeof MNS)[number])

  const dashboardRows = useMemo(() => {
    return staffList.map(s => ({
      staff: s,
      ...staffMonthStats(attendanceRows, s.id),
    }))
  }, [staffList, attendanceRows])

  const staffById = useMemo(() => {
    const m: Record<string, StaffMember> = {}
    for (const s of staffList) m[s.id] = s
    return m
  }, [staffList])

  const dayModalEntries = useMemo(() => {
    if (!dayModalDate) return []
    return attendanceRows.filter(r => r.date === dayModalDate && r.worked)
  }, [attendanceRows, dayModalDate])

  const staffAvailableForAdd = useMemo(() => {
    const taken = new Set(dayModalEntries.map(e => e.staffId))
    return staffList.filter(s => !taken.has(s.id))
  }, [staffList, dayModalEntries])

  useEffect(() => {
    if (!dayModalDate) return
    setAddOt(false)
    setAddStaffId(staffAvailableForAdd[0]?.id ?? '')
  }, [dayModalDate, staffAvailableForAdd])

  const changeMonth = async (dir: 1 | -1) => {
    const idx = MNS.indexOf(month as (typeof MNS)[number])
    let newIdx = idx + dir
    let y = parseInt(year, 10)
    if (newIdx < 0) {
      newIdx = 11
      y--
    }
    if (newIdx > 11) {
      newIdx = 0
      y++
    }
    setMonth(MNS[newIdx])
    setYear(String(y))
  }

  const grid = useMemo(() => {
    const y = parseInt(year, 10)
    const first = new Date(y, monthIndex, 1)
    const pad = first.getDay()
    const daysInMonth = new Date(y, monthIndex + 1, 0).getDate()
    const cells: { day: number | null }[] = []
    for (let i = 0; i < pad; i++) cells.push({ day: null })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d })
    while (cells.length % 7 !== 0) cells.push({ day: null })
    return cells
  }, [monthIndex, year])

  const todayYmd = toYmd(new Date())

  async function deleteEntry(staffId: string) {
    if (!dayModalDate || modalBusy) return
    setModalBusy(true)
    try {
      await api.setAttendance({ month, year, date: dayModalDate, staffId, worked: false, overtime: false })
      await refreshAttendance()
      showStatus('✓ Removed')
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Delete failed'))
    } finally {
      setModalBusy(false)
    }
  }

  async function addEntry() {
    if (!dayModalDate || !addStaffId || modalBusy) return
    setModalBusy(true)
    try {
      await api.setAttendance({
        month,
        year,
        date: dayModalDate,
        staffId: addStaffId,
        worked: true,
        overtime: addOt,
      })
      await refreshAttendance()
      setAddOt(false)
      showStatus('✓ Added')
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Add failed'))
    } finally {
      setModalBusy(false)
    }
  }

  function closeDayModal() {
    if (modalBusy) return
    setDayModalDate(null)
  }

  return (
    <div className="monthly-wrap">
      <nav className="nav-sub">
        {status && <span className="nav-status show">{status}</span>}
        <div className="nav-month" style={{ flex: 1, justifyContent: 'center' }}>
          <button type="button" className="nav-arrow" onClick={() => void changeMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <div className="nav-ml">
            {month} {year}
          </div>
          <button type="button" className="nav-arrow" onClick={() => void changeMonth(1)} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          className="nav-sync"
          onClick={() => void loadMonth(month, year)}
          disabled={loading}
          aria-label="Refresh"
        >
          {loading ? '…' : <RefreshCw size={13} />}
        </button>
      </nav>

      <main className="attendance-main">
        {!staffList.length ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>Add staff first.</div>
        ) : (
          <>
            <div className="dashboard-page">
              <KpiGrid style={{ marginBottom: 0 }}>
                {dashboardRows.map(({ staff, workedDays, otDays }) => (
                  <KpiCard
                    key={staff.id}
                    label={staff.name}
                    value={workedDays}
                    subtitle={otDays === 1 ? '1 OT day' : `${otDays} OT days`}
                    tone="navy"
                    icon={<Users size={14} />}
                  />
                ))}
              </KpiGrid>
            </div>
            <Spacer size={12} />
            <SectionBlock title="Calendar" icon={<Calendar size={16} />} right={<UiPill tone="muted">{month}</UiPill>}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 6,
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--muted)',
                  marginBottom: 6,
                }}
              >
                {WEEKDAYS.map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 6,
                }}
              >
                {grid.map((cell, i) => {
                  if (cell.day === null) {
                    return <div key={`e-${i}`} style={{ aspectRatio: '1', minHeight: 44 }} />
                  }
                  const d = cell.day
                  const dateStr = `${year}-${pad2(monthIndex + 1)}-${pad2(d)}`
                  const vis = dayCellVisual(attendanceRows, dateStr)
                  const isToday = dateStr === todayYmd
                  const entries = attendanceRows.filter(r => r.date === dateStr && r.worked)
                  const n = entries.length
                  const hasOt = entries.some(r => r.overtime)
                  let bg = 'var(--card)'
                  let border = '1px solid var(--border)'
                  if (vis === 'ot') {
                    bg = 'rgba(245, 158, 11, 0.2)'
                    border = '2px solid #D97706'
                  } else if (vis === 'work') {
                    bg = 'rgba(16, 185, 129, 0.18)'
                    border = '2px solid #059669'
                  }
                  let cellLabel: string
                  if (n === 0) cellLabel = String(d)
                  else if (n === 1 && hasOt) cellLabel = `${d} OT`
                  else if (n === 1) cellLabel = String(d)
                  else cellLabel = `${d} (${n})`
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setDayModalDate(dateStr)}
                      disabled={loading}
                      aria-label={`Open ${dateStr}`}
                      style={{
                        aspectRatio: '1',
                        minHeight: 44,
                        borderRadius: 10,
                        background: bg,
                        border,
                        fontWeight: 600,
                        fontSize: 13,
                        color: 'var(--text)',
                        cursor: loading ? 'wait' : 'pointer',
                        boxShadow: isToday ? '0 0 0 2px var(--navy)' : undefined,
                      }}
                    >
                      {cellLabel}
                    </button>
                  )
                })}
              </div>
            </SectionBlock>
          </>
        )}
      </main>

      {dayModalDate ? (
        <ModalShell
          title={formatDayModalTitle(dayModalDate)}
          onClose={closeDayModal}
          footer={
            <div className="ui-kit-modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={closeDayModal} disabled={modalBusy}>
                Close
              </button>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Marked for this day
              </div>
              {dayModalEntries.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>No entries yet.</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                  {dayModalEntries.map(e => {
                    const name = staffById[e.staffId]?.name ?? e.staffId
                    return (
                      <li
                        key={e.entryId || `${e.staffId}-${e.date}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 12px',
                          background: 'var(--bg)',
                          borderRadius: 12,
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{e.overtime ? 'Worked · OT' : 'Worked'}</div>
                        </div>
                        <button
                          type="button"
                          className="ui-kit-btn ui-kit-btn--soft"
                          style={{ color: 'var(--rm)', fontWeight: 600 }}
                          disabled={modalBusy}
                          onClick={() => void deleteEntry(e.staffId)}
                        >
                          Delete
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                Add staff
              </div>
              {staffAvailableForAdd.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Everyone is already marked for this day.</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  <FormField label="Staff">
                    <select
                      className="form-sel"
                      value={addStaffId}
                      onChange={e => setAddStaffId(e.target.value)}
                      disabled={modalBusy}
                    >
                      {staffAvailableForAdd.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: modalBusy ? 'default' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={addOt}
                      disabled={modalBusy}
                      onChange={e => setAddOt(e.target.checked)}
                    />
                    Overtime (OT)
                  </label>
                  <button
                    type="button"
                    className="ui-kit-btn ui-kit-btn--solid"
                    disabled={modalBusy || !addStaffId}
                    onClick={() => void addEntry()}
                  >
                    {modalBusy ? 'Saving…' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}
