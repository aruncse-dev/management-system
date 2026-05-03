import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Copy, Search, ShieldPlus, Plus, HeartPulse, Shield, Sparkles } from 'lucide-react'
import { api, type PersonRow, type RawInsuranceRow } from '../api'
import { FormField, HoldingCard, ModalActions, ModalShell, SearchField, SectionBlock, SectionChip, Spacer } from '../ui'
import { INR } from '../utils'

type InsuranceFormState = {
  id: string
  policy_type: string
  plan_name: string
  insurer: string
  app_uuid: string
  policy_number: string
  policy_owner: string
  premium_amount: string
  premium_mode: string
  payment_method: string
  policy_term: string
  issue_date: string
  maturity_date: string
  sum_assured: string
  cash_value: string
  nominee_name: string
  notes: string
  person_uuid: string
}

const EMPTY_FORM: InsuranceFormState = {
  id: '',
  policy_type: 'life',
  plan_name: '',
  insurer: '',
  app_uuid: '',
  policy_number: '',
  policy_owner: '',
  premium_amount: '',
  premium_mode: '',
  payment_method: '',
  policy_term: '',
  issue_date: '',
  maturity_date: '',
  sum_assured: '',
  cash_value: '',
  nominee_name: '',
  notes: '',
  person_uuid: '',
}

function toForm(row: RawInsuranceRow): InsuranceFormState {
  return {
    id: row.id || '',
    policy_type: row.policy_type || 'life',
    plan_name: row.plan_name || '',
    insurer: row.insurer || '',
    app_uuid: row.app_uuid || '',
    policy_number: row.policy_number || '',
    policy_owner: row.policy_owner || '',
    premium_amount: row.premium_amount === undefined || row.premium_amount === null ? '' : String(row.premium_amount),
    premium_mode: row.premium_mode || '',
    payment_method: row.payment_method || '',
    policy_term: row.policy_term || '',
    issue_date: toDateInput(row.issue_date || ''),
    maturity_date: toDateInput(row.maturity_date || ''),
    sum_assured: row.sum_assured === undefined || row.sum_assured === null ? '' : String(row.sum_assured),
    cash_value: row.cash_value === undefined || row.cash_value === null ? '' : String(row.cash_value),
    nominee_name: row.nominee_name || '',
    notes: row.notes || '',
    person_uuid: row.person_uuid || '',
  }
}

function INRInput(value: string) {
  if (!value.trim()) return '-'
  const num = Number(value)
  return Number.isFinite(num) ? INR(num) : value
}

function toDateInput(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const dmmy = raw.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/)
  if (dmmy) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthIndex = months.findIndex(m => m.toLowerCase() === dmmy[2].toLowerCase())
    if (monthIndex !== -1) return `20${dmmy[3]}-${String(monthIndex + 1).padStart(2, '0')}-${dmmy[1]}`
  }
  const dt = new Date(raw)
  if (!Number.isNaN(dt.getTime())) {
    const y = String(dt.getFullYear()).padStart(4, '0')
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return ''
}

function fmtDate(value: string) {
  const raw = value.trim()
  if (!raw) return '-'
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return raw
  const d = String(dt.getDate()).padStart(2, '0')
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()]
  const y = String(dt.getFullYear()).slice(-2)
  return `${d}-${m}-${y}`
}

function policyTypeLabel(value: string) {
  const v = value.trim().toLowerCase()
  if (v === 'health') return 'Health Insurance'
  if (v === 'life') return 'Life Insurance'
  if (v === 'term') return 'Term Insurance'
  return value || '-'
}

function policyTypeIcon(value: string) {
  const v = value.trim().toLowerCase()
  if (v === 'health') return <HeartPulse size={14} />
  if (v === 'life') return <Shield size={14} />
  if (v === 'term') return <Sparkles size={14} />
  return <ShieldPlus size={14} />
}

function sumLabel(policyType: string): string {
  const v = policyType.trim().toLowerCase()
  return v === 'health' ? 'Sum Insured' : 'Sum Assured'
}

function calcPolicyTerm(issueDate: string, maturityDate: string): string {
  if (!issueDate.trim() || !maturityDate.trim()) return '-'
  try {
    const [issueY, issueM, issueD] = issueDate.split('-').map(Number)
    const [maturityY, maturityM, maturityD] = maturityDate.split('-').map(Number)
    if (!issueY || !issueM || !issueD || !maturityY || !maturityM || !maturityD) return '-'
    let years = maturityY - issueY
    if (maturityM < issueM || (maturityM === issueM && maturityD < issueD)) years--
    return `${years} Years`
  } catch {
    return '-'
  }
}

function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export default function VaultInsurancePage() {
  const [rows, setRows] = useState<RawInsuranceRow[]>([])
  const [persons, setPersons] = useState<PersonRow[]>([])
  const [apps, setApps] = useState<Array<{ app_uuid: string; app_name: string; app_link?: string; logo?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<InsuranceFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<RawInsuranceRow | null>(null)
  const [toast, setToast] = useState('')
  const [deleteId, setDeleteId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [insuranceRows, appRows, personRows] = await Promise.all([api.getInsuranceEntries(), api.getApps(), api.getPersons()])
      setRows(insuranceRows)
      setPersons(personRows)
      setApps(appRows.map(app => ({ app_uuid: app.app_uuid, app_name: app.app_name, app_link: app.app_link, logo: app.logo })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insurance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const personName = useMemo(() => {
    const m = new Map<string, string>()
    persons.forEach(pr => m.set(pr.person_uuid, pr.name || ''))
    return m
  }, [persons])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row => [
      policyTypeLabel(row.policy_type),
      row.plan_name,
      row.insurer,
      row.app_uuid,
      row.policy_number,
      row.policy_owner,
      row.nominee_name,
      row.notes,
      row.person_uuid,
      personName.get(row.person_uuid || '') || '',
    ].join(' ').toLowerCase().includes(q))
  }, [rows, search, personName])

  const startAdd = () => {
    setMode('add')
    setEditingId('')
    setForm(EMPTY_FORM)
    setDeleteConfirm(false)
    setDeleteId('')
  }

  const startEdit = (row: RawInsuranceRow) => {
    setMode('edit')
    setEditingId(row.id)
    setForm(toForm(row))
    setDeleteConfirm(false)
    setDeleteId(row.id)
  }

  const closeForm = () => {
    setMode(null)
    setEditingId('')
    setForm(EMPTY_FORM)
    setDeleteConfirm(false)
    setDeleteId('')
  }

  const save = async () => {
    if (!form.plan_name.trim()) {
      setError('plan_name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        id: form.id || undefined,
        policy_type: form.policy_type.trim().toLowerCase(),
        plan_name: form.plan_name.trim(),
        insurer: form.insurer.trim(),
        app_uuid: form.app_uuid.trim(),
        policy_number: form.policy_number.trim(),
        policy_owner: form.policy_owner.trim(),
        premium_amount: form.premium_amount ? Number(form.premium_amount) : 0,
        premium_mode: form.premium_mode.trim(),
        payment_method: form.payment_method.trim(),
        issue_date: form.issue_date.trim(),
        maturity_date: form.maturity_date.trim(),
        sum_assured: form.sum_assured ? Number(form.sum_assured) : 0,
        cash_value: form.cash_value ? Number(form.cash_value) : 0,
        nominee_name: form.nominee_name.trim(),
        notes: form.notes.trim(),
        person_uuid: form.person_uuid.trim(),
      }
      if (mode === 'edit') {
        await api.updateInsuranceEntry({ ...payload, id: editingId })
      } else {
        await api.addInsuranceEntry(payload)
      }
      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async (targetId: string) => {
    if (!targetId) return
    setSaving(true)
    setError('')
    try {
      await api.deleteInsuranceEntry(targetId)
      await load()
      if (detail?.id === targetId) setDetail(null)
      setToast('Policy deleted')
      window.setTimeout(() => setToast(''), 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
      setDeleteConfirm(false)
      setDeleteId('')
    }
  }

  const requestDelete = async (targetId: string) => {
    if (!targetId) return
    if (!deleteConfirm || deleteId !== targetId) {
      setDeleteId(targetId)
      setDeleteConfirm(true)
      return
    }
    await confirmDelete(targetId)
  }

  const detailRows = detail ? [
    ['Plan Name', detail.plan_name],
    ['Policy Type', policyTypeLabel(detail.policy_type)],
    ['Policy Owner', detail.policy_owner],
    ['Person', (detail.person_uuid && personName.get(detail.person_uuid)) || detail.person_uuid || ''],
    ['Insurer', detail.insurer],
    ['App Entry', apps.find(app => app.app_uuid === detail.app_uuid)?.app_name || detail.app_uuid || ''],
    ['Policy Number', detail.policy_number],
    ['Policy Term', calcPolicyTerm(detail.issue_date, detail.maturity_date)],
    ['Premium Amount', INRInput(String(detail.premium_amount ?? ''))],
    ['Premium Mode', detail.premium_mode],
    ['Payment Method', detail.payment_method],
    ['Issue Date', fmtDate(detail.issue_date)],
    ['Maturity Date', fmtDate(detail.maturity_date)],
    [sumLabel(detail.policy_type), INRInput(String(detail.sum_assured ?? ''))],
    ['Cash Value', INRInput(String(detail.cash_value ?? ''))],
    ['Nominee Name', detail.nominee_name],
    ['Notes', detail.notes],
  ].filter(([, value]) => String(value || '').trim().length > 0) as Array<[string, string]> : []

  return (
    <div className="ui-kit-page-shell" style={{ paddingTop: 0 }}>
      <SectionBlock
        title="Insurance"
        icon={<ShieldPlus size={16} />}
        right={<SectionChip>{rows.length}</SectionChip>}
      >
        <div className="ui-stack">
          <SearchField
            value={search}
            placeholder="Search policies..."
            onChange={setSearch}
            onClear={() => setSearch('')}
            prefix={<Search size={14} />}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {filteredRows.length} visible of {rows.length} policies
          </div>
        </div>
      </SectionBlock>
      <Spacer size={12} />

      {error && <div className="settings-alert">⚠ {error}</div>}
      {loading ? (
        <div className="ui-kit-loading ui-kit-loading--page">Loading…</div>
      ) : (
        <div className="ui-stack">
          {filteredRows.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '18px 14px', color: 'var(--muted)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              No insurance policies found. Add one with the plus button.
            </div>
          ) : (
            filteredRows.map(row => (
              <HoldingCard
                key={row.id}
                title={(row.person_uuid && personName.get(row.person_uuid)) || row.policy_owner || 'Untitled Policy'}
                subtitle={row.insurer || 'Insurance'}
                leftLabel="Premium"
                leftValue={INRInput(String(row.premium_amount ?? ''))}
                centerLabel="Issue Date"
                centerValue={fmtDate(row.issue_date)}
                rightLabel="Maturity"
                rightValue={fmtDate(row.maturity_date)}
                rightTop={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {row.app_uuid ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          const app = apps.find(item => item.app_uuid === row.app_uuid)
                          if (app?.app_link) openInNewTab(app.app_link)
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          border: 0,
                          borderRadius: 999,
                          background: '#EFF6FF',
                          cursor: 'pointer',
                          padding: 0,
                          overflow: 'hidden',
                        }}
                        aria-label="Open linked app"
                        title="Open linked app"
                      >
                        {apps.find(item => item.app_uuid === row.app_uuid)?.logo ? (
                          <img
                            src={apps.find(item => item.app_uuid === row.app_uuid)?.logo}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                          />
                        ) : (
                          <ShieldPlus size={14} />
                        )}
                      </button>
                    ) : null}
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0, fontSize: 11, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF' }}>
                      {policyTypeIcon(row.policy_type)}
                    </span>
                  </div>
                }
                secondaryGrid={{
                  leftLabel: 'Policy Number',
                  leftValue: row.policy_number || '-',
                  centerLabel: sumLabel(row.policy_type),
                  centerValue: INRInput(String(row.sum_assured ?? '')),
                  rightLabel: 'Mode',
                  rightValue: row.premium_mode || '-',
                }}
                accentTone="navy"
                className="lending-entry-card"
                onClick={() => setDetail(row)}
              />
            ))
          )}
        </div>
      )}

      <button
        type="button"
        className="ui-kit-btn ui-kit-btn--solid"
        onClick={startAdd}
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
        aria-label="Add insurance policy"
        title="Add insurance policy"
      >
        <Plus size={20} />
      </button>

      {mode && (
        <ModalShell
          title={mode === 'add' ? 'Add Insurance Policy' : 'Edit Insurance Policy'}
          onClose={closeForm}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={mode === 'add' ? 'Add' : 'Save'}
              onSecondary={closeForm}
              onPrimary={save}
              leading={mode === 'edit' ? <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void requestDelete(editingId)} disabled={saving}>{saving ? 'Deleting…' : deleteConfirm && deleteId === editingId ? 'Confirm delete?' : 'Delete'}</button> : null}
              disabled={saving}
            />
          }
        >
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: 12 }}>
            <FormField label="Plan Name">
              <input className="form-inp" value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))} />
            </FormField>
            <FormField label="Policy Type">
              <select className="form-inp" value={form.policy_type} onChange={e => setForm(f => ({ ...f, policy_type: e.target.value }))}>
                <option value="life">Life Insurance</option>
                <option value="health">Health Insurance</option>
                <option value="term">Term Insurance</option>
              </select>
            </FormField>
            <FormField label="Insurer">
              <input className="form-inp" value={form.insurer} onChange={e => setForm(f => ({ ...f, insurer: e.target.value }))} />
            </FormField>
            <FormField label="App Entry">
              <select className="form-inp" value={form.app_uuid} onChange={e => setForm(f => ({ ...f, app_uuid: e.target.value }))}>
                <option value="">Select App</option>
                {apps.map(app => (
                  <option key={app.app_uuid} value={app.app_uuid}>{app.app_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Policy Number">
              <input className="form-inp" value={form.policy_number} onChange={e => setForm(f => ({ ...f, policy_number: e.target.value }))} />
            </FormField>
            <FormField label="Policy Owner">
              <input className="form-inp" value={form.policy_owner} onChange={e => setForm(f => ({ ...f, policy_owner: e.target.value }))} />
            </FormField>
            <FormField label="Person (registry)">
              <select className="form-inp" value={form.person_uuid} onChange={e => setForm(f => ({ ...f, person_uuid: e.target.value }))}>
                <option value="">None</option>
                {persons.map(pr => (
                  <option key={pr.person_uuid} value={pr.person_uuid}>{pr.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Premium Amount">
              <input className="form-inp" inputMode="decimal" value={form.premium_amount} onChange={e => setForm(f => ({ ...f, premium_amount: e.target.value }))} />
            </FormField>
            <FormField label="Premium Mode">
              <select className="form-inp" value={form.premium_mode} onChange={e => setForm(f => ({ ...f, premium_mode: e.target.value }))}>
                <option value="">Select Mode</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Half-Yearly">Half-Yearly</option>
                <option value="Yearly">Yearly</option>
                <option value="Single Premium">Single Premium</option>
              </select>
            </FormField>
            <FormField label="Payment Method">
              <input className="form-inp" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} />
            </FormField>
            <FormField label="Issue Date">
              <input className="form-inp" type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </FormField>
            <FormField label="Maturity Date">
              <input className="form-inp" type="date" value={form.maturity_date} onChange={e => setForm(f => ({ ...f, maturity_date: e.target.value }))} />
            </FormField>
            <FormField label={sumLabel(form.policy_type)}>
              <input className="form-inp" inputMode="decimal" value={form.sum_assured} onChange={e => setForm(f => ({ ...f, sum_assured: e.target.value }))} />
            </FormField>
            <FormField label="Cash Value">
              <input className="form-inp" inputMode="decimal" value={form.cash_value} onChange={e => setForm(f => ({ ...f, cash_value: e.target.value }))} />
            </FormField>
            <FormField label="Nominee Name">
              <input className="form-inp" value={form.nominee_name} onChange={e => setForm(f => ({ ...f, nominee_name: e.target.value }))} />
            </FormField>
            <FormField label="Notes">
              <textarea className="form-inp" rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
          </form>
        </ModalShell>
      )}

      {detail && (
        <ModalShell
          title={detail.policy_owner || 'Insurance Policy'}
          onClose={() => setDetail(null)}
          footer={
            <ModalActions
              secondaryLabel="Edit"
              primaryLabel="Close"
              onSecondary={() => {
                setDetail(null)
                startEdit(detail)
              }}
              onPrimary={() => setDetail(null)}
              leading={<button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void requestDelete(detail.id)} disabled={saving}>{saving ? 'Deleting…' : deleteConfirm && deleteId === detail.id ? 'Confirm delete?' : 'Delete'}</button>}
            />
          }
        >
          <div style={{ display: 'grid', gap: 12 }}>
            {detailRows.length > 0 && (
              <div style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Plan Name</div>
                <div style={{ color: 'var(--text)', fontWeight: 600, wordBreak: 'break-word', minWidth: 0 }}>{detailRows[0][1]}</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {detailRows.slice(1).map(([label, value]) => {
                const canCopy = ['Policy Number'].includes(label)
                return (
                  <div key={label} style={{ display: 'grid', gap: 8, alignContent: 'start', padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ color: 'var(--text)', fontWeight: 600, wordBreak: 'break-word', minWidth: 0 }}>{value}</div>
                      {canCopy && (
                        <button type="button" className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline" onClick={() => void navigator.clipboard.writeText(value)} style={{ width: 32, height: 32, padding: 0, justifyContent: 'center', flexShrink: 0 }} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </ModalShell>
      )}

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 500, background: '#ECFDF5', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 999, padding: '10px 14px', fontSize: 12, fontWeight: 700, boxShadow: '0 12px 28px rgba(22, 101, 52, .14)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} />
          <span>{toast}</span>
        </div>
      )}

    </div>
  )
}
