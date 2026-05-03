import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import {
  Baby,
  Car,
  Copy,
  Download,
  ExternalLink,
  FileText,
  IdCard,
  Link2Off,
  Plane,
  Plus,
  Search,
  Vote,
  Wallet,
} from 'lucide-react'
import { api, type DocumentRow, type PersonRow } from '../api'
import { FormField, ModalActions, ModalShell, SearchField, SectionBlock, SectionChip, Spacer, TransactionCard } from '../ui'

const DOC_TYPES = ['Aadhaar', 'PAN', 'Passport', 'DL', 'Voter ID', 'Birth Certificate', 'Other'] as const

const DOC_ICON_SIZE = 16

/** Card header icon by document type (matches `DOC_TYPES` + common variants). */
function documentTypeIcon(docType: string): ReactNode {
  const key = docType.trim().toLowerCase()
  const s = DOC_ICON_SIZE
  switch (key) {
    case 'aadhaar':
      return <IdCard size={s} />
    case 'pan':
      return <Wallet size={s} />
    case 'passport':
      return <Plane size={s} />
    case 'dl':
    case 'driving license':
    case 'driver license':
      return <Car size={s} />
    case 'voter id':
      return <Vote size={s} />
    case 'birth certificate':
      return <Baby size={s} />
    default:
      return <FileText size={s} />
  }
}

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

function DocumentDrivePreview({ url }: { url: string }) {
  const t = url.trim()
  if (!t) {
    return (
      <span className="vault-doc-preview-empty" aria-label="No document link">
        <Link2Off size={15} aria-hidden />
      </span>
    )
  }
  const open = (e: MouseEvent) => {
    e.stopPropagation()
    window.open(t, '_blank', 'noopener,noreferrer')
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      window.open(t, '_blank', 'noopener,noreferrer')
    }
  }
  return (
    <span
      role="link"
      tabIndex={0}
      className="vault-doc-preview-cell vault-doc-preview-cell--icon-only"
      onClick={open}
      onKeyDown={onKey}
      title={t}
      aria-label="Open document link in new tab"
    >
      <ExternalLink size={16} aria-hidden />
    </span>
  )
}

function expiryTone(expiry: string): 'red' | 'amber' | 'navy' {
  if (!expiry.trim()) return 'navy'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const raw = expiry.trim()
  const exp = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw)
  if (Number.isNaN(exp.getTime())) return 'navy'
  exp.setHours(0, 0, 0, 0)
  const diff = Math.floor((exp.getTime() - today.getTime()) / 86400000)
  if (diff < 30) return 'red'
  if (diff < 90) return 'amber'
  return 'navy'
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
  const [copied, setCopied] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [p, d] = await Promise.all([api.getPersons(), api.getDocuments()])
      setPersons(p)
      setRows(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    persons.forEach(p => m.set(p.person_uuid, p.name || p.person_uuid))
    return m
  }, [persons])

  const rowsAfterPerson = useMemo(() => {
    if (!filterPerson) return rows
    return rows.filter(r => r.person_uuid === filterPerson)
  }, [rows, filterPerson])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rowsAfterPerson
    return rowsAfterPerson.filter(r =>
      [r.doc_type, r.doc_number, r.drive_url, r.notes, nameById.get(r.person_uuid)].join(' ').toLowerCase().includes(q),
    )
  }, [rowsAfterPerson, search, nameById])

  const closeForm = () => {
    setMode(null)
    setForm(EMPTY)
    setCopied(null)
    setDeleteConfirm(false)
  }

  const copyDocNumber = (text: string, uuid: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(uuid)
      window.setTimeout(() => setCopied(null), 1500)
    })
  }

  const save = async () => {
    setDeleteConfirm(false)
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

  const confirmDeleteDocument = async () => {
    if (mode !== 'edit' || !form.doc_uuid) return
    setSaving(true)
    setError('')
    try {
      await api.deleteDocument(form.doc_uuid)
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
    if (mode !== 'edit' || !form.doc_uuid) return
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    await confirmDeleteDocument()
  }

  const copyKey = mode === 'add' ? '_new' : form.doc_uuid

  return (
    <div className="ui-kit-page-shell monthly-subpage" style={{ paddingTop: 0 }}>
      <SectionBlock title="Documents" icon={<FileText size={16} />} right={<SectionChip>{filtered.length}</SectionChip>}>
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
            <div className="txn-cards">
              {filtered.map(r => (
                <TransactionCard
                  key={r.doc_uuid}
                  title={nameById.get(r.person_uuid) || '—'}
                  amount={r.doc_number || '—'}
                  amountLabel="Doc No"
                  type={<DocumentDrivePreview url={r.drive_url || ''} />}
                  typeLabel="Preview"
                  date={r.doc_type || '—'}
                  dateLabel="Document type"
                  tone={expiryTone(r.expiry || '')}
                  icon={documentTypeIcon(r.doc_type)}
                  onClick={() => { setMode('edit'); setForm(toForm(r)); setError(''); setCopied(null); setDeleteConfirm(false) }}
                />
              ))}
            </div>
          )}
        </div>
      </SectionBlock>

      <button
        type="button"
        className="ui-kit-btn ui-kit-btn--solid"
        onClick={() => { setMode('add'); setForm({ ...EMPTY, person_uuid: filterPerson }); setError(''); setCopied(null); setDeleteConfirm(false) }}
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
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void requestDelete()} disabled={saving}>
                  {saving ? 'Deleting…' : deleteConfirm ? 'Confirm delete?' : 'Delete'}
                </button>
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
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input className="form-inp" style={{ flex: 1 }} value={form.doc_number} onChange={e => setForm(f => ({ ...f, doc_number: e.target.value }))} />
                {form.doc_number.trim() ? (
                  <button type="button" className="ui-kit-btn ui-kit-btn--soft" title="Copy" onClick={() => copyDocNumber(form.doc_number.trim(), copyKey)}>
                    <Copy size={14} />
                    {copied === copyKey ? <span style={{ marginLeft: 4, fontSize: 11 }}>Copied</span> : null}
                  </button>
                ) : null}
              </div>
            </FormField>
            <FormField label="Drive URL">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input className="form-inp" style={{ flex: 1 }} value={form.drive_url} onChange={e => setForm(f => ({ ...f, drive_url: e.target.value }))} placeholder="https://…" />
                {form.drive_url.trim() ? (
                  <a
                    href={form.drive_url.trim()}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ui-kit-btn ui-kit-btn--soft"
                    style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                    title="Open / download"
                  >
                    <Download size={14} />
                  </a>
                ) : null}
              </div>
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
