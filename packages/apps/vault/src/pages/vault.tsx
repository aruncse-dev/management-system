import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, Copy, ExternalLink, Landmark, Plus, Search } from 'lucide-react'
import { api, type RawBankingRow } from '../api'
import { FormField, HoldingCard, ModalActions, ModalShell, SearchField, SectionBlock, SectionChip, Spacer } from '../ui'

type BankingFormState = {
  account_holder_name: string
  bank_name: string
  app_uuid: string
  account_no: string
  ifsc: string
  cif: string
  username: string
  password: string
  transaction_password: string
  profile_password: string
  mpin: string
}

const EMPTY_FORM: BankingFormState = {
  account_holder_name: '',
  bank_name: '',
  app_uuid: '',
  account_no: '',
  ifsc: '',
  cif: '',
  username: '',
  password: '',
  transaction_password: '',
  profile_password: '',
  mpin: '',
}

function toForm(row: RawBankingRow): BankingFormState {
  return {
    account_holder_name: row.account_holder_name || '',
    bank_name: row.bank_name || '',
    app_uuid: row.app_uuid || '',
    account_no: row.account_no || '',
    ifsc: row.ifsc || '',
    cif: row.cif || '',
    username: row.username || '',
    password: row.password || '',
    transaction_password: row.transaction_password || '',
    profile_password: row.profile_password || '',
    mpin: row.mpin || '',
  }
}

async function copyText(text: string) {
  if (!text) return
  await navigator.clipboard.writeText(text)
}

function isSensitiveLabel(label: string) {
  return ['Password', 'Transaction Password', 'Profile Password', 'MPIN'].includes(label)
}

function maskedValue(label: string, value: string) {
  if (!isSensitiveLabel(label)) return value
  return value ? '••••••••' : '-'
}

function summaryText(row: RawBankingRow) {
  return [
    `Account Holder Name:${row.account_holder_name || ''}`,
    `Account Number:${row.account_no || ''}`,
    `Bank Name:${row.bank_name || ''}`,
    `IFSC Code:${row.ifsc || ''}`,
  ].join('\n')
}

function openBankingUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function VaultBankingPage() {
  const [rows, setRows] = useState<RawBankingRow[]>([])
  const [apps, setApps] = useState<Array<{ app_uuid: string; app_name: string; app_link?: string; logo?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [detail, setDetail] = useState<RawBankingRow | null>(null)
  const [form, setForm] = useState<BankingFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [authCopy, setAuthCopy] = useState<{ label: string; text: string } | null>(null)
  const [deleteId, setDeleteId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [bankRows, appRows] = await Promise.all([api.getBankingEntries(), api.getApps()])
      setRows(bankRows)
      setApps(appRows.map(app => ({ app_uuid: app.app_uuid, app_name: app.app_name, app_link: app.app_link, logo: app.logo })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Banking Details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const summary = useMemo(() => rows.length, [rows])
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return rows
    return rows.filter(row => {
      const text = [
        row.account_holder_name,
      row.bank_name,
      row.app_uuid,
      row.account_no,
      row.ifsc,
      row.cif,
      row.username,
    ].join(' ').toLowerCase()
      return text.includes(q)
    })
  }, [rows, search])

  const startAdd = () => {
    setMode('add')
    setEditingId('')
    setForm(EMPTY_FORM)
    setDeleteConfirm(false)
    setDeleteId('')
  }

  const startEdit = (row: RawBankingRow) => {
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

  const saveForm = async () => {
    setSaving(true)
    setError('')
    try {
      if (mode === 'edit') {
        await api.updateBankingEntry({ id: editingId, ...form })
      } else {
        await api.addBankingEntry(form)
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
    try {
      await api.deleteBankingEntry(targetId)
      await load()
      if (detail?.id === targetId) setDetail(null)
      setToast('Entry deleted')
      window.setTimeout(() => setToast(''), 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
      setDeleteConfirm(false)
      setDeleteId('')
    }
  }

  const remove = async (id: string) => {
    if (!id) return
    if (!deleteConfirm || deleteId !== id) {
      setDeleteId(id)
      setDeleteConfirm(true)
      return
    }
    await confirmDelete(id)
  }

  const copy = async (label: string, text: string) => {
    await copyText(text)
    const next = `${label} copied`
    setToast(next)
    window.setTimeout(() => setToast(''), 1400)
  }

  const copyWithAuth = async (label: string, text: string) => {
    setAuthCopy({ label, text })
  }

  const detailRows = [
    ['Account Holder Name', detail?.account_holder_name],
    ['Bank Name', detail?.bank_name],
    ['Account No.', detail?.account_no],
    ['IFSC', detail?.ifsc],
    ['CIF', detail?.cif],
    ['Username', detail?.username],
    ['Password', detail?.password],
    ['Transaction Password', detail?.transaction_password],
    ['Profile Password', detail?.profile_password],
    ['MPIN', detail?.mpin],
  ].filter(([, value]) => String(value || '').trim().length > 0) as Array<[string, string]>

  const copyableLabels = new Set(['Username', 'Password', 'Transaction Password', 'Profile Password', 'MPIN'])

  return (
    <div className="ui-kit-page-shell" style={{ paddingTop: 0 }}>
      <SectionBlock title="Banking" icon={<Landmark size={16} />} right={<SectionChip>{summary}</SectionChip>}>
        <div className="ui-stack">
          <SearchField
            value={search}
            placeholder="Search banking details..."
            onChange={setSearch}
            onClear={() => setSearch('')}
            prefix={<Search size={14} />}
          />
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {filteredRows.length} visible of {rows.length} banking entries
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
            <div className="lb">No entries</div>
          ) : (
            filteredRows.map(row => {
              const app = apps.find(item => item.app_uuid === row.app_uuid)
              return (
                <div key={row.id} style={{ display: 'grid', gap: 6 }}>
                  <HoldingCard
                    title={row.account_holder_name || 'Untitled'}
                    subtitle={row.bank_name || 'Bank'}
                    leftLabel="Account No."
                    leftValue={row.account_no || '-'}
                    centerLabel=" "
                    centerValue=" "
                    rightLabel="IFSC"
                    rightValue={row.ifsc || '-'}
                    rightTop={app ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          if (app.app_link) openBankingUrl(app.app_link)
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: 0,
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        aria-label="Open linked app"
                        title="Open linked app"
                      >
                        {app.logo ? (
                          <img src={app.logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', display: 'block' }} />
                        ) : (
                          <ExternalLink size={18} />
                        )}
                      </button>
                    ) : null}
                    accentTone="navy"
                    className="lending-entry-card"
                    onClick={() => setDetail(row)}
                  />
                </div>
              )
            })
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
        aria-label="Add entry"
        title="Add entry"
      >
        <Plus size={20} />
      </button>

      {mode && (
        <ModalShell
          title={mode === 'add' ? 'Add Banking Entry' : 'Edit Banking Entry'}
          onClose={closeForm}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={mode === 'add' ? 'Add' : 'Save'}
              onSecondary={closeForm}
              onPrimary={saveForm}
              leading={mode === 'edit' ? <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void remove(editingId)} disabled={saving}>{saving ? 'Deleting…' : deleteConfirm && deleteId === editingId ? 'Confirm delete?' : 'Delete'}</button> : null}
              disabled={saving}
            />
          }
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <FormField label="Account Holder Name"><input className="form-inp" value={form.account_holder_name} onChange={e => setForm(f => ({ ...f, account_holder_name: e.target.value }))} /></FormField>
            <FormField label="Bank Name"><input className="form-inp" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} /></FormField>
            <FormField label="App Entry">
              <select className="form-inp" value={form.app_uuid} onChange={e => setForm(f => ({ ...f, app_uuid: e.target.value }))}>
                <option value="">Select App</option>
                {apps.map(app => (
                  <option key={app.app_uuid} value={app.app_uuid}>{app.app_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Account No."><input className="form-inp" value={form.account_no} onChange={e => setForm(f => ({ ...f, account_no: e.target.value }))} /></FormField>
            <FormField label="IFSC"><input className="form-inp" value={form.ifsc} onChange={e => setForm(f => ({ ...f, ifsc: e.target.value }))} /></FormField>
            <FormField label="CIF"><input className="form-inp" value={form.cif} onChange={e => setForm(f => ({ ...f, cif: e.target.value }))} /></FormField>
            <FormField label="Username"><input className="form-inp" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></FormField>
            <FormField label="Password"><input className="form-inp" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></FormField>
            <FormField label="Transaction Password"><input className="form-inp" type="password" value={form.transaction_password} onChange={e => setForm(f => ({ ...f, transaction_password: e.target.value }))} /></FormField>
            <FormField label="Profile Password"><input className="form-inp" type="password" value={form.profile_password} onChange={e => setForm(f => ({ ...f, profile_password: e.target.value }))} /></FormField>
            <FormField label="MPIN"><input className="form-inp" type="password" value={form.mpin} onChange={e => setForm(f => ({ ...f, mpin: e.target.value }))} /></FormField>
          </div>
        </ModalShell>
      )}

      {detail && (
        <ModalShell
          title="Banking Details"
          onClose={() => setDetail(null)}
          footer={
            <ModalActions
              secondaryLabel="Copy"
              primaryLabel="Edit"
              onSecondary={() => copy('Bank details', summaryText(detail))}
              onPrimary={() => {
                setDetail(null)
                startEdit(detail)
              }}
              leading={<button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void remove(detail.id)} disabled={saving}>{saving ? 'Deleting…' : deleteConfirm && deleteId === detail.id ? 'Confirm delete?' : 'Delete'}</button>}
            />
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {detailRows.map(([label, value]) => {
              const canCopy = copyableLabels.has(label)
              return (
                <div key={label} style={{ display: 'grid', gap: 8, alignContent: 'start', padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ color: 'var(--text)', fontWeight: 600, wordBreak: 'break-word', minWidth: 0 }}>{maskedValue(label, value)}</div>
                    {canCopy && (
                      <button type="button" className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline" onClick={() => (isSensitiveLabel(label) ? copyWithAuth(label, value) : copy(label, value))} style={{ width: 32, height: 32, padding: 0, justifyContent: 'center', flexShrink: 0 }} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
                        <Copy size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ModalShell>
      )}

      {authCopy && (
        <ModalShell
          title={`Copy ${authCopy.label}`}
          onClose={() => setAuthCopy(null)}
        >
          <PasswordCopyLock
            onUnlock={async () => {
              setAuthCopy(null)
              window.setTimeout(() => {
                void copy(authCopy.label, authCopy.text)
              }, 0)
            }}
          />
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

function PasswordCopyLock({
  onUnlock,
}: {
  onUnlock: () => Promise<void> | void
}) {
  const [password, setPassword] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const focusBox = (index: number) => {
    inputRefs.current[index]?.focus()
    inputRefs.current[index]?.select()
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const pin = password.join('')
    setError('')
    try {
      const r = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ pin }),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setError(data.error || 'Incorrect password')
        setPassword(['', '', '', ''])
        focusBox(0)
        return
      }
      await onUnlock()
    } catch {
      setError('Request failed')
      setPassword(['', '', '', ''])
      focusBox(0)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', display: 'grid', gap: 16 }}>
      {error && <div style={{ width: '100%', maxWidth: 320, padding: '6px 2px', color: 'var(--rm)', fontSize: 13, fontWeight: 600, lineHeight: 1.4, textAlign: 'left' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 48px)', gap: 8, justifyContent: 'center' }}>
        {password.map((digit, index) => (
          <input
            key={index}
            ref={el => { inputRefs.current[index] = el }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            pattern="[0-9]*"
            onChange={e => {
              const next = e.target.value.replace(/\D/g, '').slice(-1)
              const updated = [...password]
              updated[index] = next
              setPassword(updated)
              if (error) setError('')
              if (next && index < 3) focusBox(index + 1)
            }}
            onKeyDown={e => { if (e.key === 'Backspace' && !password[index] && index > 0) focusBox(index - 1) }}
            className="form-inp"
            style={{ width: '100%', aspectRatio: '1 / 1', minHeight: 48, textAlign: 'center', fontSize: 16, fontWeight: 700, background: '#fff', borderColor: 'rgba(191, 219, 254, .85)', color: 'var(--text)', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)' }}
            autoComplete={index === 0 ? 'current-password' : 'off'}
            aria-label={`Password digit ${index + 1}`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, width: '100%' }}>
        <button className="ui-kit-btn" type="submit" style={{ width: 'fit-content', minWidth: 180, justifyContent: 'center', background: 'rgba(255,255,255,.92)', color: 'var(--navy)', border: '1px solid rgba(255,255,255,.45)', borderRadius: 999, boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)' }}>Unlock</button>
      </div>
    </form>
  )
}

export default VaultBankingPage
