import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Plus, Search, Target } from 'lucide-react'
import { api, type HabitLogRow, type HabitRow, type PersonRow } from '../api'
import { FormField, ModalActions, ModalShell, SearchField, SectionBlock, SectionChip } from '../ui'

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

export default function VaultHabitsPage() {
  const [persons, setPersons] = useState<PersonRow[]>([])
  const [habits, setHabits] = useState<HabitRow[]>([])
  const [logsByHabit, setLogsByHabit] = useState<Record<string, HabitLogRow[]>>({})
  const [personUuid, setPersonUuid] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [hName, setHName] = useState('')
  const [hCat, setHCat] = useState('')
  const [hTarget, setHTarget] = useState('')
  const [saving, setSaving] = useState(false)

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
      h.forEach((x, i) => { map[x.habit_uuid] = entries[i] })
      setLogsByHabit(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [personUuid])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return habits
    return habits.filter(x => [x.name, x.category].join(' ').toLowerCase().includes(q))
  }, [habits, search])

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    persons.forEach(p => m.set(p.person_uuid, p.name || p.person_uuid))
    return m
  }, [persons])

  const addHabit = async () => {
    if (!personUuid.trim() || !hName.trim()) {
      setError('Select person and enter habit name')
      return
    }
    setSaving(true)
    try {
      await api.addHabit({ person_uuid: personUuid, name: hName.trim(), category: hCat.trim(), target_frequency: hTarget.trim() })
      setModal(false)
      setHName('')
      setHCat('')
      setHTarget('')
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

  return (
    <div className="ui-kit-page-shell" style={{ paddingTop: 0 }}>
      <SectionBlock title="Habits" icon={<Target size={16} />} right={<SectionChip>{habits.length}</SectionChip>}>
        <div className="ui-stack">
          <FormField label="Person">
            <select className="form-inp" value={personUuid} onChange={e => setPersonUuid(e.target.value)}>
              <option value="">All</option>
              {persons.map(p => (
                <option key={p.person_uuid} value={p.person_uuid}>{p.name}</option>
              ))}
            </select>
          </FormField>
          <SearchField value={search} placeholder="Search…" onChange={setSearch} onClear={() => setSearch('')} prefix={<Search size={14} />} />
          {error && <div className="settings-alert">⚠ {error}</div>}
          {loading ? (
            <div className="muted">Loading…</div>
          ) : (
            <div className="ui-stack" style={{ gap: 8 }}>
              {filtered.map(h => {
                const logs = logsByHabit[h.habit_uuid] || []
                const st = streakFromLogs(logs, todayIso())
                const doneToday = logs.some(l => l.log_date === todayIso() && l.completed)
                return (
                  <div key={h.habit_uuid} className="card" style={{ padding: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600 }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{nameById.get(h.person_uuid)} · streak {st}d</div>
                    <button type="button" className={`ui-kit-btn ui-kit-btn--${doneToday ? 'solid' : 'soft'}`} style={{ marginTop: 8 }} onClick={() => void toggleToday(h)}>
                      <Check size={14} style={{ marginRight: 6 }} />
                      {doneToday ? 'Logged today' : 'Log today'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SectionBlock>

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

      {modal && (
        <ModalShell title="New habit" onClose={() => setModal(false)} footer={
          <ModalActions secondaryLabel="Cancel" primaryLabel="Add" onSecondary={() => setModal(false)} onPrimary={() => void addHabit()} disabled={saving} />
        }>
          <form style={{ display: 'grid', gap: 12 }} onSubmit={(e: FormEvent) => { e.preventDefault(); void addHabit() }}>
            <FormField label="Name"><input className="form-inp" value={hName} onChange={e => setHName(e.target.value)} /></FormField>
            <FormField label="Category"><input className="form-inp" value={hCat} onChange={e => setHCat(e.target.value)} /></FormField>
            <FormField label="Target frequency"><input className="form-inp" value={hTarget} onChange={e => setHTarget(e.target.value)} placeholder="daily" /></FormField>
          </form>
        </ModalShell>
      )}
    </div>
  )
}
