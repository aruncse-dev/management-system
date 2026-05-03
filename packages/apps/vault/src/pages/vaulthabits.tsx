import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Edit2, Plus, Search, Target } from 'lucide-react'
import { api, type HabitLogRow, type HabitRow, type PersonRow } from '../api'
import { FormField, KpiCard, KpiGrid, ModalActions, ModalShell, SearchField, SectionBlock, SectionChip } from '../ui'

const LS_DEFAULT_PERSON = 'vault_habits_default_person'
const LS_REMINDER_TIMES = 'vault_habits_reminder_times'

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(iso: string, delta: number) {
  const [y, mo, da] = iso.split('-').map(Number)
  const d = new Date(y, mo - 1, da)
  d.setDate(d.getDate() + delta)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function streakFromLogs(logs: HabitLogRow[], today: string): number {
  const doneDays = new Set(logs.filter(l => l.completed).map(l => l.log_date))
  let s = 0
  for (let i = 0; i < 120; i++) {
    const day = addDays(today, -i)
    if (doneDays.has(day)) s++
    else break
  }
  return s
}

function daysInMonth(year: number, month: number): string[] {
  const count = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: count }, (_, i) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
  )
}

function firstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

type Tab = 'dashboard' | 'habits'

const WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function VaultHabitsPage() {
  const [persons, setPersons] = useState<PersonRow[]>([])
  const [habits, setHabits] = useState<HabitRow[]>([])
  const [logsByHabit, setLogsByHabit] = useState<Record<string, HabitLogRow[]>>({})
  const [personUuid, setPersonUuid] = useState<string>(() => {
    try {
      return localStorage.getItem(LS_DEFAULT_PERSON) || ''
    } catch {
      return ''
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('dashboard')
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [editHabit, setEditHabit] = useState<HabitRow | null>(null)
  const [hName, setHName] = useState('')
  const [hCat, setHCat] = useState('')
  const [hTarget, setHTarget] = useState('')
  const [hReminder, setHReminder] = useState('')
  const [eHName, setEHName] = useState('')
  const [eHCat, setEHCat] = useState('')
  const [eHTarget, setEHTarget] = useState('')
  const [eHReminder, setEHReminder] = useState('')
  const [saving, setSaving] = useState(false)
  const [reminderTimes, setReminderTimes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_REMINDER_TIMES) || '{}') as Record<string, string>
    } catch {
      return {}
    }
  })
  const habitsRef = useRef<HabitRow[]>([])
  /** Browser timer id (avoid NodeJS.Timeout vs number mismatch under @types/node). */
  const intervalRef = useRef<number | null>(null)

  const setReminder = (habitUuid: string, time: string) => {
    setReminderTimes(prev => {
      const next = { ...prev }
      if (time) next[habitUuid] = time
      else delete next[habitUuid]
      try {
        localStorage.setItem(LS_REMINDER_TIMES, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [p, h] = await Promise.all([api.getPersons(), api.getHabits(personUuid || undefined)])
      setPersons(p)
      setHabits(h)
      const from = addDays(todayIso(), -120)
      const to = todayIso()
      const entries = await Promise.all(
        h.map(x => api.getHabitLogs({ habit_uuid: x.habit_uuid, from, to })),
      )
      const map: Record<string, HabitLogRow[]> = {}
      h.forEach((x, i) => {
        map[x.habit_uuid] = entries[i]
      })
      setLogsByHabit(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [personUuid])

  useEffect(() => {
    if (personUuid || persons.length === 0) return
    const arun = persons.find(p => p.name === 'Arunkumar')
    if (arun) {
      setPersonUuid(arun.person_uuid)
      try {
        localStorage.setItem(LS_DEFAULT_PERSON, arun.person_uuid)
      } catch {
        /* ignore */
      }
    }
  }, [persons, personUuid])

  useEffect(() => {
    habitsRef.current = habits
  }, [habits])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
    intervalRef.current = window.setInterval(() => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const now = new Date()
      const cur = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      let times: Record<string, string> = {}
      try {
        times = JSON.parse(localStorage.getItem(LS_REMINDER_TIMES) || '{}') as Record<string, string>
      } catch {
        times = {}
      }
      Object.entries(times).forEach(([uuid, t]) => {
        if (t !== cur) return
        const name = habitsRef.current.find(h => h.habit_uuid === uuid)?.name ?? 'Habit'
        new Notification('Habit Reminder', { body: name })
      })
    }, 60000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return habits
    return habits.filter(x => [x.name, x.category].join(' ').toLowerCase().includes(q))
  }, [habits, search])

  const completionMap = useMemo(() => {
    const m = new Map<string, Set<string>>()
    Object.entries(logsByHabit).forEach(([uuid, logs]) => {
      logs.filter(l => l.completed).forEach(l => {
        if (!m.has(l.log_date)) m.set(l.log_date, new Set())
        m.get(l.log_date)!.add(uuid)
      })
    })
    return m
  }, [logsByHabit])

  const calDays = useMemo(() => daysInMonth(calYear, calMonth), [calYear, calMonth])
  const calPadding = useMemo(() => firstWeekday(calYear, calMonth), [calYear, calMonth])

  const dashStreak = useMemo(() => {
    const doneDays = new Set(
      Object.values(logsByHabit)
        .flat()
        .filter(l => l.completed)
        .map(l => l.log_date),
    )
    const t = todayIso()
    let s = 0
    for (let i = 0; i < 120; i++) {
      if (doneDays.has(addDays(t, -i))) s++
      else break
    }
    return s
  }, [logsByHabit])

  const todayCount = useMemo(() => {
    const t = todayIso()
    return habits.filter(h => (logsByHabit[h.habit_uuid] || []).some(l => l.log_date === t && l.completed)).length
  }, [habits, logsByHabit])

  const weekCount = useMemo(() => {
    const t = todayIso()
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(t, -i))
    return Object.values(logsByHabit)
      .flat()
      .filter(l => l.completed && weekDays.includes(l.log_date)).length
  }, [logsByHabit])

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalYear(y => y - 1)
      setCalMonth(11)
    } else setCalMonth(m => m - 1)
    setSelectedDay(null)
  }

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalYear(y => y + 1)
      setCalMonth(0)
    } else setCalMonth(m => m + 1)
    setSelectedDay(null)
  }

  const monthName = new Date(calYear, calMonth, 1).toLocaleString('default', { month: 'long' })

  const addHabit = async () => {
    if (!personUuid.trim() || !hName.trim()) {
      setError('Select person and enter habit name')
      return
    }
    setSaving(true)
    try {
      const newUuid = await api.addHabit({
        person_uuid: personUuid,
        name: hName.trim(),
        category: hCat.trim(),
        target_frequency: hTarget.trim(),
      })
      if (hReminder.trim() && typeof newUuid === 'string' && newUuid) setReminder(newUuid, hReminder.trim())
      setModal(false)
      setHName('')
      setHCat('')
      setHTarget('')
      setHReminder('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveEditHabit = async () => {
    if (!editHabit) return
    setSaving(true)
    try {
      await api.updateHabit({
        habit_uuid: editHabit.habit_uuid,
        person_uuid: editHabit.person_uuid,
        name: eHName.trim(),
        category: eHCat.trim(),
        target_frequency: eHTarget.trim(),
      })
      setReminder(editHabit.habit_uuid, eHReminder.trim())
      setEditHabit(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleToday = async (h: HabitRow) => {
    const t = todayIso()
    const cur = logsByHabit[h.habit_uuid] || []
    const existing = cur.find(l => l.log_date === t)
    const next = !(existing?.completed)
    try {
      await api.logHabit({ habit_uuid: h.habit_uuid, person_uuid: h.person_uuid, log_date: t, completed: next })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Log failed')
    }
  }

  const openEdit = (h: HabitRow) => {
    setEditHabit(h)
    setEHName(h.name)
    setEHCat(h.category)
    setEHTarget(h.target_frequency)
    setEHReminder(reminderTimes[h.habit_uuid] || '')
  }

  const tIso = todayIso()
  const selectedNames =
    selectedDay && completionMap.has(selectedDay)
      ? [...completionMap.get(selectedDay)!]
        .map(id => habits.find(h => h.habit_uuid === id)?.name)
        .filter(Boolean) as string[]
      : []

  return (
    <div className="ui-kit-page-shell" style={{ paddingTop: 0 }}>
      <nav className="bottom-nav">
        <button type="button" className={`bottom-nav-item${tab === 'dashboard' ? ' active' : ''}`} onClick={() => setTab('dashboard')}>
          <span className="bottom-nav-icon"><Calendar size={19} /></span>
          <span>Dashboard</span>
        </button>
        <button type="button" className={`bottom-nav-item${tab === 'habits' ? ' active' : ''}`} onClick={() => setTab('habits')}>
          <span className="bottom-nav-icon"><Target size={19} /></span>
          <span>Habits</span>
        </button>
      </nav>

      <SectionBlock title="Habits" icon={<Target size={16} />} right={<SectionChip>{habits.length}</SectionChip>}>
        <div className="ui-stack">
          <FormField label="Person">
            <select
              className="form-inp"
              value={personUuid}
              onChange={e => {
                const v = e.target.value
                setPersonUuid(v)
                try {
                  if (v) localStorage.setItem(LS_DEFAULT_PERSON, v)
                  else localStorage.removeItem(LS_DEFAULT_PERSON)
                } catch {
                  /* ignore */
                }
              }}
            >
              <option value="">All</option>
              {persons.map(p => (
                <option key={p.person_uuid} value={p.person_uuid}>{p.name}</option>
              ))}
            </select>
          </FormField>
          {error && <div className="settings-alert">⚠ {error}</div>}
        </div>
      </SectionBlock>

      {tab === 'dashboard' && (
        <div className="pg" style={{ paddingTop: 8, paddingLeft: 16, paddingRight: 16 }}>
          {loading ? (
            <div className="muted">Loading…</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={prevMonth} aria-label="Previous month">
                  <ChevronLeft size={18} />
                </button>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{monthName} {calYear}</div>
                <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={nextMonth} aria-label="Next month">
                  <ChevronRight size={18} />
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 4,
                  fontSize: 11,
                  color: 'var(--muted)',
                  marginBottom: 4,
                  textAlign: 'center',
                }}
              >
                {WEEK_LABELS.map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {Array.from({ length: calPadding }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {calDays.map(day => {
                  const set = completionMap.get(day) || new Set<string>()
                  const n = set.size
                  const isToday = day === tIso
                  const isSel = day === selectedDay
                  const dots = Math.min(n, 3)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      style={{
                        minHeight: 44,
                        borderRadius: 8,
                        border: isToday ? '2px solid var(--navy)' : `1px solid ${isSel ? 'var(--navy)' : 'var(--border)'}`,
                        background: isSel ? 'rgba(30, 92, 199, 0.08)' : 'var(--card)',
                        padding: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <div>{Number(day.slice(-2))}</div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', marginTop: 4 }}>
                        {Array.from({ length: dots }, (_, j) => (
                          <span key={j} style={{ width: 4, height: 4, borderRadius: 99, background: 'var(--green)' }} />
                        ))}
                        {n > 3 ? <span style={{ fontSize: 9, color: 'var(--muted)' }}>+{n - 3}</span> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
              {selectedDay && (
                <div style={{ marginTop: 12, padding: 10, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{selectedDay}</div>
                  {selectedNames.length ? (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {selectedNames.map(n => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="muted">No completions logged.</div>
                  )}
                </div>
              )}
              <KpiGrid variant="dash" style={{ marginTop: 16 }}>
                <KpiCard label="Streak" value={`${dashStreak}d`} tone="navy" />
                <KpiCard label="Today" value={habits.length ? `${todayCount}/${habits.length}` : '—'} tone="green" />
                <KpiCard label="This week" value={String(weekCount)} tone="amber" full />
              </KpiGrid>
            </>
          )}
        </div>
      )}

      {tab === 'habits' && (
        <div className="pg" style={{ paddingTop: 8 }}>
          <div style={{ padding: '0 16px' }}>
            <SearchField value={search} placeholder="Search…" onChange={setSearch} onClear={() => setSearch('')} prefix={<Search size={14} />} />
            {loading ? (
              <div className="muted" style={{ marginTop: 12 }}>Loading…</div>
            ) : (
              <div className="ui-stack" style={{ gap: 8, marginTop: 12 }}>
                {filtered.map(h => {
                  const logs = logsByHabit[h.habit_uuid] || []
                  const st = streakFromLogs(logs, tIso)
                  const doneToday = logs.some(l => l.log_date === tIso && l.completed)
                  const rt = reminderTimes[h.habit_uuid]?.trim()
                  return (
                    <div key={h.habit_uuid} className="card" style={{ padding: 12, border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600 }}>{h.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {h.category || '—'} · streak {st}d
                        {rt ? (
                          <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} />
                            {rt}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={() => openEdit(h)}>
                          <Edit2 size={14} style={{ marginRight: 6 }} />
                          Edit
                        </button>
                        <button type="button" className={`ui-kit-btn ui-kit-btn--${doneToday ? 'solid' : 'soft'}`} onClick={() => void toggleToday(h)}>
                          <Check size={14} style={{ marginRight: 6 }} />
                          {doneToday ? 'Logged today' : 'Log today'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'habits' && (
        <button
          type="button"
          className="ui-kit-btn ui-kit-btn--solid"
          onClick={() => {
            if (!personUuid) {
              setError('Select a person first')
              return
            }
            setModal(true)
            setError('')
          }}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            zIndex: 120,
            borderRadius: 999,
            minWidth: 0,
            width: 56,
            height: 56,
            padding: 0,
            boxShadow: '0 16px 32px rgba(30, 92, 199, .24)',
          }}
          aria-label="New habit"
          title="New habit"
        >
          <Plus size={20} />
        </button>
      )}

      {modal && (
        <ModalShell
          title="New habit"
          onClose={() => setModal(false)}
          footer={<ModalActions secondaryLabel="Cancel" primaryLabel="Add" onSecondary={() => setModal(false)} onPrimary={() => void addHabit()} disabled={saving} />}
        >
          <form style={{ display: 'grid', gap: 12 }} onSubmit={(e: FormEvent) => { e.preventDefault(); void addHabit() }}>
            <FormField label="Name"><input className="form-inp" value={hName} onChange={e => setHName(e.target.value)} /></FormField>
            <FormField label="Category"><input className="form-inp" value={hCat} onChange={e => setHCat(e.target.value)} /></FormField>
            <FormField label="Target frequency"><input className="form-inp" value={hTarget} onChange={e => setHTarget(e.target.value)} placeholder="daily" /></FormField>
            <FormField label="Reminder time">
              <input className="form-inp" type="time" value={hReminder} onChange={e => setHReminder(e.target.value)} />
            </FormField>
          </form>
        </ModalShell>
      )}

      {editHabit && (
        <ModalShell
          title="Edit habit"
          onClose={() => setEditHabit(null)}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel="Save"
              onSecondary={() => setEditHabit(null)}
              onPrimary={() => void saveEditHabit()}
              disabled={saving}
            />
          }
        >
          <form style={{ display: 'grid', gap: 12 }} onSubmit={(e: FormEvent) => { e.preventDefault(); void saveEditHabit() }}>
            <FormField label="Name"><input className="form-inp" value={eHName} onChange={e => setEHName(e.target.value)} /></FormField>
            <FormField label="Category"><input className="form-inp" value={eHCat} onChange={e => setEHCat(e.target.value)} /></FormField>
            <FormField label="Target frequency"><input className="form-inp" value={eHTarget} onChange={e => setEHTarget(e.target.value)} /></FormField>
            <FormField label="Reminder time">
              <input className="form-inp" type="time" value={eHReminder} onChange={e => setEHReminder(e.target.value)} />
            </FormField>
          </form>
        </ModalShell>
      )}
    </div>
  )
}
