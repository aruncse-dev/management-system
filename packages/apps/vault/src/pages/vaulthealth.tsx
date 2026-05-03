import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, HeartPulse, Pill, Plus, Search } from 'lucide-react'
import {
  api,
  type HealthVitalRow,
  type IllnessRow,
  type MedicationRow,
  type PersonRow,
} from '../api'
import { FormField, KpiCard, KpiGrid, ModalActions, ModalShell, SearchField, SectionBlock, SectionChip, Spacer } from '../ui'

type Tab = 'vitals' | 'illness' | 'meds'

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function medDueLines(meds: MedicationRow[], today: string): string[] {
  const out: string[] = []
  for (const m of meds) {
    const times = (m.reminder_times || '').trim()
    if (!times) continue
    const start = (m.start_date || '').trim()
    const end = (m.end_date || '').trim()
    if (start && today < start) continue
    if (end && today > end) continue
    out.push(`${m.name}: ${times}`)
  }
  return out
}

export default function VaultHealthPage() {
  const [tab, setTab] = useState<Tab>('vitals')
  const [persons, setPersons] = useState<PersonRow[]>([])
  const [personUuid, setPersonUuid] = useState('')
  const [vitals, setVitals] = useState<HealthVitalRow[]>([])
  const [illnesses, setIllnesses] = useState<IllnessRow[]>([])
  const [meds, setMeds] = useState<MedicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [vitalOpen, setVitalOpen] = useState(false)
  const [vRecorded, setVRecorded] = useState('')
  const [vH, setVH] = useState('')
  const [vW, setVW] = useState('')
  const [vSys, setVSys] = useState('')
  const [vDia, setVDia] = useState('')
  const [vSugar, setVSugar] = useState('')
  const [vNotes, setVNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [illOpen, setIllOpen] = useState(false)
  const [illForm, setIllForm] = useState<IllnessRow | null>(null)

  const [medOpen, setMedOpen] = useState(false)
  const [medForm, setMedForm] = useState<MedicationRow | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [p, v, i, m] = await Promise.all([
        api.getPersons(),
        api.getHealthVitals(personUuid || undefined),
        api.getIllnesses(personUuid || undefined),
        api.getMedications(personUuid || undefined),
      ])
      setPersons(p)
      setVitals(v)
      setIllnesses(i)
      setMeds(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [personUuid])

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    persons.forEach(p => m.set(p.person_uuid, p.name || p.person_uuid))
    return m
  }, [persons])

  const latest = vitals[0]
  const dueToday = useMemo(() => medDueLines(meds, todayIso()), [meds])

  const filteredIll = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return illnesses
    return illnesses.filter(r => [r.name, r.status, r.notes].join(' ').toLowerCase().includes(q))
  }, [illnesses, search])

  const filteredMeds = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return meds
    return meds.filter(r => [r.name, r.dosage, r.frequency, r.notes].join(' ').toLowerCase().includes(q))
  }, [meds, search])

  const addVital = async () => {
    if (!personUuid.trim()) {
      setError('Select a person for vitals')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.addHealthVital({
        person_uuid: personUuid,
        recorded_at: vRecorded.trim() || new Date().toISOString(),
        height_cm: vH ? Number(vH) : 0,
        weight_kg: vW ? Number(vW) : 0,
        systolic: vSys ? Number(vSys) : 0,
        diastolic: vDia ? Number(vDia) : 0,
        blood_sugar: vSugar ? Number(vSugar) : 0,
        notes: vNotes.trim(),
      })
      setVitalOpen(false)
      setVRecorded('')
      setVH('')
      setVW('')
      setVSys('')
      setVDia('')
      setVSugar('')
      setVNotes('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveIllness = async () => {
    if (!illForm || !illForm.name.trim() || !illForm.person_uuid.trim()) return
    setSaving(true)
    try {
      if (illForm.illness_uuid) {
        await api.updateIllness({
          illness_uuid: illForm.illness_uuid,
          person_uuid: illForm.person_uuid,
          name: illForm.name.trim(),
          diagnosed_on: illForm.diagnosed_on.trim(),
          status: illForm.status.trim(),
          notes: illForm.notes.trim(),
        })
      } else {
        await api.addIllness({
          person_uuid: illForm.person_uuid,
          name: illForm.name.trim(),
          diagnosed_on: illForm.diagnosed_on.trim(),
          status: illForm.status.trim(),
          notes: illForm.notes.trim(),
        })
      }
      setIllOpen(false)
      setIllForm(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveMed = async () => {
    if (!medForm || !medForm.name.trim() || !medForm.person_uuid.trim()) return
    setSaving(true)
    try {
      if (medForm.med_uuid) {
        await api.updateMedication({
          med_uuid: medForm.med_uuid,
          person_uuid: medForm.person_uuid,
          illness_uuid: medForm.illness_uuid.trim(),
          name: medForm.name.trim(),
          dosage: medForm.dosage.trim(),
          frequency: medForm.frequency.trim(),
          start_date: medForm.start_date.trim(),
          end_date: medForm.end_date.trim(),
          reminder_times: medForm.reminder_times.trim(),
          notes: medForm.notes.trim(),
        })
      } else {
        await api.addMedication({
          person_uuid: medForm.person_uuid,
          illness_uuid: medForm.illness_uuid.trim(),
          name: medForm.name.trim(),
          dosage: medForm.dosage.trim(),
          frequency: medForm.frequency.trim(),
          start_date: medForm.start_date.trim(),
          end_date: medForm.end_date.trim(),
          reminder_times: medForm.reminder_times.trim(),
          notes: medForm.notes.trim(),
        })
      }
      setMedOpen(false)
      setMedForm(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const healthFabAction = () => {
    setError('')
    if (tab === 'vitals') {
      setVitalOpen(true)
      return
    }
    if (tab === 'illness') {
      if (!personUuid) {
        setError('Select a person to add illness')
        return
      }
      setIllForm({ illness_uuid: '', person_uuid: personUuid, name: '', diagnosed_on: '', status: 'active', notes: '' })
      setIllOpen(true)
      return
    }
    if (tab === 'meds') {
      if (!personUuid) {
        setError('Select a person to add medication')
        return
      }
      setMedForm({
        med_uuid: '',
        person_uuid: personUuid,
        illness_uuid: '',
        name: '',
        dosage: '',
        frequency: '',
        start_date: '',
        end_date: '',
        reminder_times: '',
        notes: '',
      })
      setMedOpen(true)
    }
  }

  const healthFabLabel =
    tab === 'vitals' ? 'Add vital reading' : tab === 'illness' ? 'Add illness' : 'Add medication'


  return (
    <div className="ui-kit-page-shell" style={{ paddingTop: 0 }}>
      <nav className="bottom-nav">
        <button type="button" className={`bottom-nav-item${tab === 'vitals' ? ' active' : ''}`} onClick={() => setTab('vitals')}>
          <span className="bottom-nav-icon"><Activity size={19} /></span>
          <span>Vitals</span>
        </button>
        <button type="button" className={`bottom-nav-item${tab === 'illness' ? ' active' : ''}`} onClick={() => setTab('illness')}>
          <span className="bottom-nav-icon"><HeartPulse size={19} /></span>
          <span>Illness</span>
        </button>
        <button type="button" className={`bottom-nav-item${tab === 'meds' ? ' active' : ''}`} onClick={() => setTab('meds')}>
          <span className="bottom-nav-icon"><Pill size={19} /></span>
          <span>Meds</span>
        </button>
      </nav>

      <SectionBlock title="Health" icon={<HeartPulse size={16} />} right={loading ? <SectionChip>…</SectionChip> : <SectionChip>{personUuid ? '1 person' : 'All'}</SectionChip>}>
        <div className="ui-stack">
          <FormField label="Person">
            <select className="form-inp" value={personUuid} onChange={e => setPersonUuid(e.target.value)}>
              <option value="">All people</option>
              {persons.map(p => (
                <option key={p.person_uuid} value={p.person_uuid}>{p.name}</option>
              ))}
            </select>
          </FormField>
          {error && <div className="settings-alert">⚠ {error}</div>}
        </div>
      </SectionBlock>

      {dueToday.length > 0 && (
        <div className="card" style={{ margin: '0 16px 12px', padding: 12, background: 'rgba(30,92,199,.08)', border: '1px solid rgba(30,92,199,.2)' }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Reminder times today</div>
          {dueToday.map(line => (
            <div key={line} style={{ fontSize: 13 }}>{line}</div>
          ))}
        </div>
      )}

      {tab === 'vitals' && (
        <div className="pg" style={{ paddingTop: 8 }}>
          {latest && personUuid && (
            <KpiGrid>
              <KpiCard label="Latest weight" value={latest.weight_kg ? `${latest.weight_kg} kg` : '—'} />
              <KpiCard label="BP" value={latest.systolic && latest.diastolic ? `${latest.systolic}/${latest.diastolic}` : '—'} />
              <KpiCard label="Sugar" value={latest.blood_sugar ? String(latest.blood_sugar) : '—'} />
            </KpiGrid>
          )}
          <div style={{ padding: '0 16px' }}>
            {vitals.map(v => (
              <div key={v.vital_uuid} className="card" style={{ padding: 12, marginBottom: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{v.recorded_at} · {nameById.get(v.person_uuid) || v.person_uuid}</div>
                <div style={{ fontWeight: 600 }}>
                  W {v.weight_kg || '—'} kg · H {v.height_cm || '—'} · BP {v.systolic || '—'}/{v.diastolic || '—'} · Sugar {v.blood_sugar || '—'}
                </div>
                <button type="button" className="ui-kit-btn ui-kit-btn--soft" style={{ marginTop: 8 }} onClick={async () => {
                  if (!window.confirm('Delete reading?')) return
                  try {
                    await api.deleteHealthVital(v.vital_uuid)
                    await load()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Delete failed')
                  }
                }}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'illness' && (
        <div className="pg" style={{ paddingTop: 8 }}>
          <div style={{ padding: '0 16px' }}>
            <SearchField value={search} placeholder="Search…" onChange={setSearch} onClear={() => setSearch('')} prefix={<Search size={14} />} />
            {filteredIll.map(r => (
              <div key={r.illness_uuid} className="card" style={{ padding: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.status} · {r.diagnosed_on}</div>
                <button type="button" className="ui-kit-btn ui-kit-btn--soft" style={{ marginTop: 8 }} onClick={() => { setIllForm({ ...r }); setIllOpen(true) }}>Edit</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'meds' && (
        <div className="pg" style={{ paddingTop: 8 }}>
          <div style={{ padding: '0 16px' }}>
            <SearchField value={search} placeholder="Search…" onChange={setSearch} onClear={() => setSearch('')} prefix={<Search size={14} />} />
            {filteredMeds.map(r => (
              <div key={r.med_uuid} className="card" style={{ padding: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.dosage} · {r.frequency}</div>
                <div style={{ fontSize: 12 }}>Reminders: {r.reminder_times || '—'}</div>
                <button type="button" className="ui-kit-btn ui-kit-btn--soft" style={{ marginTop: 8 }} onClick={() => { setMedForm({ ...r }); setMedOpen(true) }}>Edit</button>
              </div>
            ))}
          </div>
        </div>
      )}


      <button
        type="button"
        className="ui-kit-btn ui-kit-btn--solid"
        onClick={() => healthFabAction()}
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
        aria-label={healthFabLabel}
        title={healthFabLabel}
      >
        <Plus size={20} />
      </button>

      {vitalOpen && (
        <ModalShell title="Add vital" onClose={() => setVitalOpen(false)} footer={
          <ModalActions secondaryLabel="Cancel" primaryLabel="Save" onSecondary={() => setVitalOpen(false)} onPrimary={() => void addVital()} disabled={saving} />
        }>
          <form style={{ display: 'grid', gap: 12 }} onSubmit={(e: FormEvent) => { e.preventDefault(); void addVital() }}>
            <FormField label="Recorded at (ISO)">
              <input className="form-inp" value={vRecorded} onChange={e => setVRecorded(e.target.value)} placeholder={new Date().toISOString()} />
            </FormField>
            <FormField label="Height cm"><input className="form-inp" inputMode="decimal" value={vH} onChange={e => setVH(e.target.value)} /></FormField>
            <FormField label="Weight kg"><input className="form-inp" inputMode="decimal" value={vW} onChange={e => setVW(e.target.value)} /></FormField>
            <FormField label="Systolic"><input className="form-inp" inputMode="numeric" value={vSys} onChange={e => setVSys(e.target.value)} /></FormField>
            <FormField label="Diastolic"><input className="form-inp" inputMode="numeric" value={vDia} onChange={e => setVDia(e.target.value)} /></FormField>
            <FormField label="Blood sugar"><input className="form-inp" inputMode="decimal" value={vSugar} onChange={e => setVSugar(e.target.value)} /></FormField>
            <FormField label="Notes"><textarea className="form-inp" rows={2} value={vNotes} onChange={e => setVNotes(e.target.value)} /></FormField>
          </form>
        </ModalShell>
      )}

      {illOpen && illForm && (
        <ModalShell title={illForm.illness_uuid ? 'Edit illness' : 'Add illness'} onClose={() => { setIllOpen(false); setIllForm(null) }} footer={
          <ModalActions
            secondaryLabel="Cancel"
            primaryLabel="Save"
            onSecondary={() => { setIllOpen(false); setIllForm(null) }}
            onPrimary={() => void saveIllness()}
            leading={illForm.illness_uuid ? (
              <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={async () => {
                if (!window.confirm('Delete?')) return
                try {
                  await api.deleteIllness(illForm.illness_uuid)
                  setIllOpen(false)
                  setIllForm(null)
                  await load()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Delete failed')
                }
              }}>Delete</button>
            ) : null}
            disabled={saving}
          />
        }>
          <div style={{ display: 'grid', gap: 12 }}>
            <FormField label="Name"><input className="form-inp" value={illForm.name} onChange={e => setIllForm(f => f ? { ...f, name: e.target.value } : f)} /></FormField>
            <FormField label="Diagnosed on"><input className="form-inp" value={illForm.diagnosed_on} onChange={e => setIllForm(f => f ? { ...f, diagnosed_on: e.target.value } : f)} /></FormField>
            <FormField label="Status">
              <select className="form-inp" value={illForm.status} onChange={e => setIllForm(f => f ? { ...f, status: e.target.value } : f)}>
                <option value="active">active</option>
                <option value="resolved">resolved</option>
              </select>
            </FormField>
            <FormField label="Notes"><textarea className="form-inp" rows={2} value={illForm.notes} onChange={e => setIllForm(f => f ? { ...f, notes: e.target.value } : f)} /></FormField>
          </div>
        </ModalShell>
      )}

      {medOpen && medForm && (
        <ModalShell title={medForm.med_uuid ? 'Edit medication' : 'Add medication'} onClose={() => { setMedOpen(false); setMedForm(null) }} footer={
          <ModalActions
            secondaryLabel="Cancel"
            primaryLabel="Save"
            onSecondary={() => { setMedOpen(false); setMedForm(null) }}
            onPrimary={() => void saveMed()}
            leading={medForm.med_uuid ? (
              <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={async () => {
                if (!window.confirm('Delete?')) return
                try {
                  await api.deleteMedication(medForm.med_uuid)
                  setMedOpen(false)
                  setMedForm(null)
                  await load()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Delete failed')
                }
              }}>Delete</button>
            ) : null}
            disabled={saving}
          />
        }>
          <div style={{ display: 'grid', gap: 12 }}>
            <FormField label="Name"><input className="form-inp" value={medForm.name} onChange={e => setMedForm(f => f ? { ...f, name: e.target.value } : f)} /></FormField>
            <FormField label="Dosage"><input className="form-inp" value={medForm.dosage} onChange={e => setMedForm(f => f ? { ...f, dosage: e.target.value } : f)} /></FormField>
            <FormField label="Frequency"><input className="form-inp" value={medForm.frequency} onChange={e => setMedForm(f => f ? { ...f, frequency: e.target.value } : f)} /></FormField>
            <FormField label="Start date"><input className="form-inp" value={medForm.start_date} onChange={e => setMedForm(f => f ? { ...f, start_date: e.target.value } : f)} /></FormField>
            <FormField label="End date"><input className="form-inp" value={medForm.end_date} onChange={e => setMedForm(f => f ? { ...f, end_date: e.target.value } : f)} /></FormField>
            <FormField label="Reminder times"><input className="form-inp" value={medForm.reminder_times} onChange={e => setMedForm(f => f ? { ...f, reminder_times: e.target.value } : f)} placeholder="08:00,20:00" /></FormField>
            <FormField label="Notes"><textarea className="form-inp" rows={2} value={medForm.notes} onChange={e => setMedForm(f => f ? { ...f, notes: e.target.value } : f)} /></FormField>
          </div>
        </ModalShell>
      )}
    </div>
  )
}
