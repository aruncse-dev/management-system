import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Baby,
  CircleUser,
  CircleUserRound,
  PersonStanding,
  Plus,
  Search,
  User,
  UserCircle,
  UserRound,
  Users,
} from 'lucide-react'
import { api, type PersonRow } from '../api'
import { FormField, ModalActions, ModalShell, SearchField, SectionBlock, SectionChip, Spacer, TransactionCard } from '../ui'

/** Preset relations; stored value matches label. "Other" uses free-text in `relation_other`. */
const RELATION_OPTIONS = [
  'Myself',
  'Sister',
  'Mother',
  'Wife',
  'Son',
  'Nephew',
  'Mother in law',
  'Father in law',
  'Brother in law',
  'Grandma',
  'Other',
] as const

const RELATION_PRESET_SET = new Set<string>(RELATION_OPTIONS.filter(o => o !== 'Other'))

const GENDER_OPTIONS = ['Male', 'Female'] as const
const GENDER_PRESET_SET = new Set<string>(GENDER_OPTIONS)

type FormState = {
  person_uuid: string
  name: string
  relation_pick: string
  relation_other: string
  dob: string
  gender_pick: string
  gender_other: string
}

const EMPTY: FormState = {
  person_uuid: '',
  name: '',
  relation_pick: '',
  relation_other: '',
  dob: '',
  gender_pick: '',
  gender_other: '',
}

function relationToStore(form: FormState): string {
  if (form.relation_pick === 'Other') return form.relation_other.trim()
  return form.relation_pick.trim()
}

function genderToStore(form: FormState): string {
  if (form.gender_pick === 'Male' || form.gender_pick === 'Female') return form.gender_pick
  return form.gender_other.trim()
}

/** Normalize sheet / API DOB strings to `yyyy-mm-dd` for `<input type="date">` and age. */
function dobForDateInput(raw: string): string {
  const t = raw.trim()
  if (!t) return ''

  const isoHead = t.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoHead) return isoHead[1]

  const dmmy = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/)
  if (dmmy) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const mon = dmmy[2].charAt(0).toUpperCase() + dmmy[2].slice(1).toLowerCase()
    const monthIndex = months.indexOf(mon)
    if (monthIndex === -1) return ''
    let year = parseInt(dmmy[3], 10)
    if (dmmy[3].length <= 2) year += year >= 70 ? 1900 : 2000
    const day = dmmy[1].padStart(2, '0')
    const month = String(monthIndex + 1).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const slash = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (slash) {
    const p1 = parseInt(slash[1], 10)
    const p2 = parseInt(slash[2], 10)
    let year = parseInt(slash[3], 10)
    if (slash[3].length === 2) year += year >= 70 ? 1900 : 2000
    let day: number
    let month: number
    if (p1 > 12) {
      day = p1
      month = p2
    } else if (p2 > 12) {
      month = p1
      day = p2
    } else {
      day = p1
      month = p2
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return ''
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const monWord = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/)
  if (monWord) {
    const monthsShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const w = monWord[2].toLowerCase()
    const mi = monthsShort.indexOf(w.slice(0, 3))
    if (mi === -1) return ''
    const day = parseInt(monWord[1], 10)
    const year = parseInt(monWord[3], 10)
    return `${year}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return ''
}

function isYyyyMmDd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim())
}

function dobForForm(row: PersonRow): string {
  const raw = (row.dob || '').trim()
  return dobForDateInput(raw) || raw
}

function genderPickFromRow(row: PersonRow): Pick<FormState, 'gender_pick' | 'gender_other'> {
  const g = (row.gender || '').trim()
  if (g && GENDER_PRESET_SET.has(g)) return { gender_pick: g, gender_other: '' }
  if (g) return { gender_pick: '', gender_other: g }
  return { gender_pick: '', gender_other: '' }
}

/** Age in full years using local calendar (birthday not yet reached this year → subtract one). */
function ageFromIsoYmd(iso: string, now = new Date()): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--
  return age
}

function formatDobDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = parseInt(m[3], 10)
  const monthIx = parseInt(m[2], 10) - 1
  const year = parseInt(m[1], 10)
  if (monthIx < 0 || monthIx > 11) return iso
  return `${String(day).padStart(2, '0')}-${months[monthIx]}-${String(year).slice(-2)}`
}

type AgeCategory = 'Child' | 'Teen' | 'Adult' | 'Senior'

function ageCategory(age: number): AgeCategory {
  const a = Math.max(0, age)
  if (a <= 12) return 'Child'
  if (a <= 17) return 'Teen'
  if (a <= 59) return 'Adult'
  return 'Senior'
}

type PersonCardTone = 'green' | 'red' | 'amber' | 'navy' | 'muted'

function toneForAgeCategory(cat: AgeCategory | null): PersonCardTone {
  if (!cat) return 'muted'
  switch (cat) {
    case 'Child':
      return 'amber'
    case 'Teen':
      return 'green'
    case 'Adult':
      return 'navy'
    case 'Senior':
      return 'muted'
  }
}

type GenderKey = 'male' | 'female' | 'other'

function genderKey(gender: string | undefined): GenderKey {
  const g = (gender || '').trim().toLowerCase()
  if (g === 'male' || g === 'm') return 'male'
  if (g === 'female' || g === 'f') return 'female'
  return 'other'
}

/** Lucide person icons by age band + gender (neutral fallbacks when unknown). */
function personHeadIcon(gender: string | undefined, cat: AgeCategory | null) {
  const g = genderKey(gender)
  const sz = 14
  if (!cat) {
    if (g === 'male') return <PersonStanding size={sz} aria-hidden />
    if (g === 'female') return <UserRound size={sz} aria-hidden />
    return <User size={sz} aria-hidden />
  }
  switch (cat) {
    case 'Child':
      return <Baby size={sz} aria-hidden />
    case 'Teen':
      if (g === 'male') return <User size={sz} aria-hidden />
      if (g === 'female') return <UserRound size={sz} aria-hidden />
      return <UserRound size={sz} aria-hidden />
    case 'Adult':
      if (g === 'male') return <PersonStanding size={sz} aria-hidden />
      if (g === 'female') return <UserRound size={sz} aria-hidden />
      return <PersonStanding size={sz} aria-hidden />
    case 'Senior':
      if (g === 'male') return <CircleUser size={sz} aria-hidden />
      if (g === 'female') return <CircleUserRound size={sz} aria-hidden />
      return <UserCircle size={sz} aria-hidden />
  }
}

function toForm(row: PersonRow): FormState {
  const rel = (row.relation || '').trim()
  const g = genderPickFromRow(row)
  const base = {
    person_uuid: row.person_uuid || '',
    name: row.name || '',
    dob: dobForForm(row),
    gender_pick: g.gender_pick,
    gender_other: g.gender_other,
  }
  if (rel && RELATION_PRESET_SET.has(rel)) {
    return { ...base, relation_pick: rel, relation_other: '' }
  }
  if (rel) {
    return { ...base, relation_pick: 'Other', relation_other: rel }
  }
  return { ...base, relation_pick: '', relation_other: '' }
}

export default function VaultPersonsPage() {
  const [rows, setRows] = useState<PersonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await api.getPersons())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => [r.name, r.relation].join(' ').toLowerCase().includes(q))
  }, [rows, search])

  const closeForm = () => {
    setMode(null)
    setForm(EMPTY)
    setDeleteConfirm(false)
  }

  const save = async () => {
    setDeleteConfirm(false)
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    if (form.relation_pick === 'Other' && !form.relation_other.trim()) {
      setError('Enter a relation or choose a preset')
      return
    }
    const relation = relationToStore(form)
    const gender = genderToStore(form)
    setSaving(true)
    setError('')
    try {
      if (mode === 'edit' && form.person_uuid) {
        const prevNotes = rows.find(r => r.person_uuid === form.person_uuid)?.notes ?? ''
        await api.updatePerson({
          person_uuid: form.person_uuid,
          name: form.name.trim(),
          relation,
          dob: form.dob.trim(),
          gender,
          notes: String(prevNotes).trim(),
        })
      } else {
        await api.addPerson({
          name: form.name.trim(),
          relation,
          dob: form.dob.trim(),
          gender,
          notes: '',
        })
      }
      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDeletePerson = async () => {
    if (mode !== 'edit' || !form.person_uuid) return
    setSaving(true)
    setError('')
    try {
      await api.deletePerson(form.person_uuid)
      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
      setDeleteConfirm(false)
    }
  }

  const requestDelete = async () => {
    if (mode !== 'edit' || !form.person_uuid) return
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    await confirmDeletePerson()
  }

  const dobUseNativeDate = form.dob === '' || isYyyyMmDd(form.dob)

  return (
    <div className="ui-kit-page-shell monthly-subpage" style={{ paddingTop: 0 }}>
      <SectionBlock title="Persons" icon={<Users size={16} />} right={<SectionChip>{rows.length}</SectionChip>}>
        <div className="ui-stack">
          <SearchField
            value={search}
            placeholder="Search…"
            onChange={setSearch}
            onClear={() => setSearch('')}
            prefix={<Search size={14} />}
          />
          {error && <div className="settings-alert">⚠ {error}</div>}
          {loading ? (
            <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>{rows.length === 0 ? 'No persons yet.' : 'No persons match.'}</div>
          ) : (
            <div className="txn-cards">
              {filtered.map(r => {
                const iso = dobForDateInput(r.dob || '')
                const age = iso !== '' ? ageFromIsoYmd(iso) : null
                const ageSafe = age !== null && !Number.isNaN(age) ? Math.max(0, age) : null
                const cat = ageSafe !== null ? ageCategory(ageSafe) : null
                const tone = toneForAgeCategory(cat)
                return (
                  <TransactionCard
                    key={r.person_uuid}
                    title={r.name || '—'}
                    amount={ageSafe !== null ? `${ageSafe} yrs` : '—'}
                    amountLabel={cat ?? 'Age'}
                    type={r.relation || '—'}
                    typeLabel="Relation"
                    date={iso ? formatDobDisplay(iso) : (r.dob?.trim() || '—')}
                    dateLabel="DOB"
                    tone={tone}
                    icon={personHeadIcon(r.gender, cat)}
                    onClick={() => { setMode('edit'); setForm(toForm(r)); setError(''); setDeleteConfirm(false) }}
                  />
                )
              })}
            </div>
          )}
        </div>
      </SectionBlock>

      <button
        type="button"
        className="ui-kit-btn ui-kit-btn--solid"
        onClick={() => { setMode('add'); setForm(EMPTY); setError(''); setDeleteConfirm(false) }}
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
        aria-label="Add person"
        title="Add person"
      >
        <Plus size={20} />
      </button>

      {mode && (
        <ModalShell
          title={mode === 'add' ? 'Add person' : 'Edit person'}
          onClose={closeForm}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={mode === 'add' ? 'Add' : 'Save'}
              onSecondary={closeForm}
              onPrimary={() => void save()}
              leading={mode === 'edit' ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void requestDelete()} disabled={saving}>
                  {saving ? 'Deleting…' : deleteConfirm ? 'Confirm delete?' : 'Delete'}
                </button>
              ) : null}
              disabled={saving}
            />
          }
        >
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: 12 }}>
            <FormField label="Name">
              <input className="form-inp" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </FormField>
            <FormField label="Relation to me">
              <select
                className="form-inp"
                value={form.relation_pick}
                onChange={e => setForm(f => ({
                  ...f,
                  relation_pick: e.target.value,
                  relation_other: e.target.value === 'Other' ? f.relation_other : '',
                }))}
              >
                <option value="">Select…</option>
                {RELATION_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </FormField>
            {form.relation_pick === 'Other' && (
              <FormField label="Describe relation">
                <input
                  className="form-inp"
                  value={form.relation_other}
                  onChange={e => setForm(f => ({ ...f, relation_other: e.target.value }))}
                  placeholder="e.g. Cousin, Friend"
                />
              </FormField>
            )}
            <FormField label="Date of birth">
              {dobUseNativeDate ? (
                <input
                  type="date"
                  className="form-inp"
                  value={isYyyyMmDd(form.dob) ? form.dob : ''}
                  onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                />
              ) : (
                <input
                  className="form-inp"
                  value={form.dob}
                  onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                  placeholder="Legacy format — edit to YYYY-MM-DD for calendar"
                />
              )}
            </FormField>
            <FormField label="Gender">
              <select
                className="form-inp"
                value={form.gender_pick}
                onChange={e => setForm(f => ({
                  ...f,
                  gender_pick: e.target.value,
                  gender_other: e.target.value ? '' : f.gender_other,
                }))}
              >
                <option value="">Select…</option>
                {GENDER_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </FormField>
            {form.gender_other.trim() !== '' && form.gender_pick === '' && (
              <FormField label="Gender (custom, from sheet)">
                <input
                  className="form-inp"
                  value={form.gender_other}
                  onChange={e => setForm(f => ({ ...f, gender_other: e.target.value }))}
                  placeholder="Edit or clear, or choose Male/Female above"
                />
              </FormField>
            )}
            <Spacer size={4} />
          </form>
        </ModalShell>
      )}
    </div>
  )
}
