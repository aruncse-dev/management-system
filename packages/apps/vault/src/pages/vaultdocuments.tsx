import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ExternalLink, FileText, Plus, Search } from 'lucide-react'
import { api, type DocumentRow, type PersonRow } from '../api'
import { FormField, ModalActions, ModalShell, SearchField, SectionBlock, SectionChip, Spacer } from '../ui'

const DOC_TYPES = ['Aadhaar', 'PAN', 'Passport', 'DL', 'Voter ID', 'Birth Certificate', 'Other'] as const

type FormState = {
  doc_uuid: string
  person_uuid: string
  doc_type: string
  doc_number: string
  drive_url: string
  expiry: string
  notes: string
}

const EMPTY: FormState = {
  doc_uuid: '',
  person_uuid: '',
  doc_type: 'Other',
  doc_number: '',
  drive_url: '',
  expiry: '',
  notes: '',
}

function toForm(row: DocumentRow): FormState {
  return {
    doc_uuid: row.doc_uuid || '',
    person_uuid: row.person_uuid || '',
    doc_type: row.doc_type || 'Other',
    doc_number: row.doc_number || '',
    drive_url: row.drive_url || '',
    expiry: row.expiry || '',
    notes: row.notes || '',
  }
}

export default function VaultDocumentsPage() {
  const [persons, setPersons] = useState<PersonRow[]>([])
  const [rows, setRows] = useState<DocumentRow[]>([])
  const [filterPerson, setFilterPerson] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [p, d] = await Promise.all([
        api.getPersons(),
        api.getDocuments(filterPerson || undefined),
      ])
      setPersons(p)
      setRows(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [filterPerson])

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    persons.forEach(p => m.set(p.person_uuid, p.name || p.person_uuid))
    return m
  }, [persons])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      [r.doc_type, r.doc_number, r.drive_url, r.notes, nameById.get(r.person_uuid)].join(' ').toLowerCase().includes(q),
    )
  }, [rows, search, nameById])

  const closeForm = () => {
    setMode(null)
    setForm(EMPTY)
  }

  const save = async () => {
    if (!form.person_uuid.trim()) {
      setError('Person is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (mode === 'edit' && form.doc_uuid) {
        await api.updateDocument({
          doc_uuid: form.doc_uuid,
          person_uuid: form.person_uuid.trim(),
          doc_type: form.doc_type,
          doc_number: form.doc_number.trim(),
          drive_url: form.drive_url.trim(),
          expiry: form.expiry.trim(),
          notes: form.notes.trim(),
        })
      } else {
        await api.addDocument({
          person_uuid: form.person_uuid.trim(),
          doc_type: form.doc_type,
          doc_number: form.doc_number.trim(),
          drive_url: form.drive_url.trim(),
          expiry: form.expiry.trim(),
          notes: form.notes.trim(),
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

  const requestDelete = async () => {
    if (mode !== 'edit' || !form.doc_uuid) return
    if (!window.confirm('Delete this document row?')) return
    setSaving(true)
    try {
      await api.deleteDocument(form.doc_uuid)
      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ui-kit-page-shell" style={{ paddingTop: 0 }}>
      <SectionBlock title="Documents" icon={<FileText size={16} />} right={<SectionChip>{rows.length}</SectionChip>}>
        <div className="ui-stack">
          <FormField label="Filter by person">
            <select className="form-inp" value={filterPerson} onChange={e => setFilterPerson(e.target.value)}>
              <option value="">All</option>
              {persons.map(p => (
                <option key={p.person_uuid} value={p.person_uuid}>{p.name}</option>
              ))}
            </select>
          </FormField>
          <SearchField value={search} placeholder="Search…" onChange={setSearch} onClear={() => setSearch('')} prefix={<Search size={14} />} />
          {error && <div className="settings-alert">⚠ {error}</div>}
          {loading ? (
            <div className="muted" style={{ fontSize: 13 }}>Loading…</div>
          ) : (
            <div className="ui-stack" style={{ gap: 8 }}>
              {filtered.map(r => (
                <div key={r.doc_uuid} className="card" style={{ padding: 12, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.doc_type} · {r.doc_number || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{nameById.get(r.person_uuid) || r.person_uuid}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.drive_url.trim() && (
                        <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={() => window.open(r.drive_url, '_blank', 'noopener,noreferrer')}>
                          <ExternalLink size={14} />
                        </button>
                      )}
                      <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={() => { setMode('edit'); setForm(toForm(r)); setError('') }}>Edit</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionBlock>

      <button
        type="button"
        className="ui-kit-btn ui-kit-btn--solid"
        onClick={() => { setMode('add'); setForm({ ...EMPTY, person_uuid: filterPerson }); setError('') }}
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
        aria-label="Add document"
        title="Add document"
      >
        <Plus size={20} />
      </button>

      {mode && (
        <ModalShell
          title={mode === 'add' ? 'Add document' : 'Edit document'}
          onClose={closeForm}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={mode === 'add' ? 'Add' : 'Save'}
              onSecondary={closeForm}
              onPrimary={() => void save()}
              leading={mode === 'edit' ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void requestDelete()} disabled={saving}>Delete</button>
              ) : null}
              disabled={saving}
            />
          }
        >
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: 12 }}>
            <FormField label="Person">
              <select className="form-inp" value={form.person_uuid} onChange={e => setForm(f => ({ ...f, person_uuid: e.target.value }))}>
                <option value="">Select…</option>
                {persons.map(p => (
                  <option key={p.person_uuid} value={p.person_uuid}>{p.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Document type">
              <select className="form-inp" value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>
                {DOC_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Document number">
              <input className="form-inp" value={form.doc_number} onChange={e => setForm(f => ({ ...f, doc_number: e.target.value }))} />
            </FormField>
            <FormField label="Drive URL">
              <input className="form-inp" value={form.drive_url} onChange={e => setForm(f => ({ ...f, drive_url: e.target.value }))} placeholder="https://…" />
            </FormField>
            <FormField label="Expiry (YYYY-MM-DD)">
              <input className="form-inp" value={form.expiry} onChange={e => setForm(f => ({ ...f, expiry: e.target.value }))} />
            </FormField>
            <FormField label="Notes">
              <textarea className="form-inp" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
            <Spacer size={4} />
          </form>
        </ModalShell>
      )}
    </div>
  )
}
