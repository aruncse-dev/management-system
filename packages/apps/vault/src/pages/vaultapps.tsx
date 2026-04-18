import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, Copy, Globe, GraduationCap, Layers3, Lock, Plus, Search, AppWindow } from 'lucide-react'
import { api, type RawVaultAppRow } from '../api'
import { FormField, ModalActions, ModalShell, SearchField, SectionBlock, Spacer, UiPill } from '../ui'

type AppFormState = {
  app_uuid: string
  app_name: string
  category: string
  logo: string
  app_link: string
  username: string
  password: string
  two_factor_enabled: boolean
  notes: string
}

const EMPTY_FORM: AppFormState = {
  app_uuid: '',
  app_name: '',
  category: '',
  logo: '',
  app_link: '',
  username: '',
  password: '',
  two_factor_enabled: false,
  notes: '',
}

function toForm(row: RawVaultAppRow): AppFormState {
  return {
    app_uuid: row.app_uuid || '',
    app_name: row.app_name || '',
    category: row.category || '',
    logo: row.logo || '',
    app_link: row.app_link || '',
    username: row.username || '',
    password: row.password || '',
    two_factor_enabled: !!row.two_factor_enabled,
    notes: row.notes || '',
  }
}

function masked(text: string) {
  return text ? '••••••••' : '-'
}

function normalizeBoolean(value: boolean) {
  return value ? 'Yes' : 'No'
}

function categoryIcon(category: string) {
  const c = category.trim().toLowerCase()
  if (!c) return <AppWindow size={16} />
  if (c.includes('bank') || c.includes('finance')) return <Lock size={16} />
  if (c.includes('social') || c.includes('chat') || c.includes('messaging')) return <Globe size={16} />
  if (c.includes('learn') || c.includes('school') || c.includes('education')) return <GraduationCap size={16} />
  return <Layers3 size={16} />
}

function appIcon(row: RawVaultAppRow, size = 18) {
  return row.logo ? <img src={row.logo} alt="" style={{ width: '100%', height: '100%', maxWidth: size, maxHeight: size, objectFit: 'contain', display: 'block' }} /> : categoryIcon(row.category)
}

export default function VaultAppsPage() {
  const [rows, setRows] = useState<RawVaultAppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<AppFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingUuid, setEditingUuid] = useState('')
  const [detail, setDetail] = useState<RawVaultAppRow | null>(null)
  const [toast, setToast] = useState('')
  const [authCopy, setAuthCopy] = useState<{ label: string; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getApps()
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load apps')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row => [
      row.app_name,
      row.category,
      row.username,
      row.app_link,
      row.notes,
    ].join(' ').toLowerCase().includes(q))
  }, [rows, search])

  const startAdd = () => {
    setMode('add')
    setEditingUuid('')
    setForm(EMPTY_FORM)
  }

  const startEdit = (row: RawVaultAppRow) => {
    setMode('edit')
    setEditingUuid(row.app_uuid)
    setForm(toForm(row))
  }

  const closeForm = () => {
    setMode(null)
    setEditingUuid('')
    setForm(EMPTY_FORM)
  }

  const save = async () => {
    if (!form.app_name.trim()) {
      setError('app_name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        app_uuid: form.app_uuid || undefined,
        app_name: form.app_name.trim(),
        category: form.category.trim(),
        logo: form.logo.trim(),
        app_link: form.app_link.trim(),
        username: form.username.trim(),
        password: form.password,
        two_factor_enabled: form.two_factor_enabled,
        notes: form.notes.trim(),
      }
      if (mode === 'edit') {
        await api.updateApp({ ...payload, app_uuid: editingUuid })
      } else {
        await api.addApp(payload)
      }
      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (appUuid: string) => {
    if (!window.confirm('Delete this app?')) return
    setSaving(true)
    setError('')
    try {
      await api.deleteApp(appUuid)
      await load()
      if (detail?.app_uuid === appUuid) setDetail(null)
      setToast('App deleted')
      window.setTimeout(() => setToast(''), 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const copy = async (label: string, text: string) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setToast(`${label} copied`)
    window.setTimeout(() => setToast(''), 1400)
  }

  const copyWithAuth = async (label: string, text: string) => {
    setAuthCopy({ label, text })
  }

  return (
    <div className="ui-kit-page-shell" style={{ paddingTop: 0 }}>
      <SectionBlock
        title="Apps"
        icon={<AppWindow size={16} />}
        right={<UiPill tone="navy">{rows.length}</UiPill>}
      >
        <div className="ui-stack">
          <SearchField
            value={search}
            placeholder="Search apps..."
            onChange={setSearch}
            onClear={() => setSearch('')}
            prefix={<Search size={14} />}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {filteredRows.length} visible of {rows.length} apps
          </div>
        </div>
      </SectionBlock>
      <Spacer size={12} />

      {error && <div className="settings-alert">⚠ {error}</div>}
      {loading ? (
        <div className="ui-kit-loading ui-kit-loading--page">Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
          {filteredRows.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '18px 14px', color: 'var(--muted)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              No apps found. Add one with the plus button.
            </div>
          ) : (
            filteredRows.map(row => (
              <button
                key={row.app_uuid}
                type="button"
                onClick={() => setDetail(row)}
                style={{
                  textAlign: 'left',
                  border: '1px solid rgba(30, 92, 199, .12)',
                  borderRadius: 18,
                  background: 'linear-gradient(180deg, rgba(255,255,255,.96), rgba(243,248,255,.92))',
                  padding: 10,
                  aspectRatio: '1 / 1',
                  display: 'grid',
                  alignContent: 'center',
                  justifyItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  boxShadow: '0 10px 24px rgba(15, 23, 42, .05)',
                  transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
                }}
              >
                <div style={{ display: 'grid', placeItems: 'center', gap: 8, minWidth: 0, textAlign: 'center', width: '100%' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', padding: 0, margin: 0, color: '#1D4ED8', flexShrink: 0, lineHeight: 0, width: 52, height: 52 }}>
                    {appIcon(row, 52)}
                  </span>
                  <div style={{ minWidth: 0, width: '100%', paddingInline: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', lineHeight: 1.25, textAlign: 'center' }}>
                      {row.app_name || 'Untitled App'}
                    </div>
                  </div>
                </div>
              </button>
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
        aria-label="Add app"
        title="Add app"
      >
        <Plus size={20} />
      </button>

      {mode && (
        <ModalShell
          title={mode === 'add' ? 'Add App' : 'Edit App'}
          onClose={closeForm}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={mode === 'add' ? 'Add' : 'Save'}
              onSecondary={closeForm}
              onPrimary={save}
              leading={mode === 'edit' ? <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => remove(editingUuid)} disabled={saving}>Delete</button> : null}
              disabled={saving}
            />
          }
        >
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: 12 }}>
            <FormField label="App Name">
              <input className="form-inp" value={form.app_name} onChange={e => setForm(f => ({ ...f, app_name: e.target.value }))} />
            </FormField>
            <FormField label="Category">
              <input className="form-inp" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </FormField>
            <FormField label="Logo URL">
              <input className="form-inp" value={form.logo} onChange={e => setForm(f => ({ ...f, logo: e.target.value }))} />
            </FormField>
            <FormField label="App Link">
              <input className="form-inp" value={form.app_link} onChange={e => setForm(f => ({ ...f, app_link: e.target.value }))} />
            </FormField>
            <FormField label="Username">
              <input className="form-inp" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </FormField>
            <FormField label="Password">
              <input className="form-inp" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </FormField>
            <FormField label="Two Factor Enabled">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                <input type="checkbox" checked={form.two_factor_enabled} onChange={e => setForm(f => ({ ...f, two_factor_enabled: e.target.checked }))} />
                Enabled
              </label>
            </FormField>
            <FormField label="Notes">
              <textarea className="form-inp" rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
          </form>
        </ModalShell>
      )}

      {detail && (
        <ModalShell
          title={detail.app_name || 'Untitled App'}
          onClose={() => setDetail(null)}
          footer={
            <ModalActions
              secondaryLabel="Edit"
              primaryLabel="Open"
              onSecondary={() => {
                setDetail(null)
                startEdit(detail)
              }}
              onPrimary={() => {
                if (detail.app_link) window.open(detail.app_link, '_blank', 'noopener,noreferrer')
              }}
              leading={<button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={() => remove(detail.app_uuid)} disabled={saving}>Delete</button>}
            />
          }
        >
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              {detail.category && <RowDetail label="Category" value={detail.category} />}
              {detail.app_link && <RowDetail label="Launch URL" value={detail.app_link} action={<button type="button" className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline" onClick={() => copy('URL', detail.app_link)} title="Copy URL" aria-label="Copy URL"><Copy size={14} /></button>} />}
              {detail.username && <RowDetail label="Username" value={detail.username} action={<button type="button" className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline" onClick={() => copy('Username', detail.username)} title="Copy username" aria-label="Copy username"><Copy size={14} /></button>} />}
              {detail.password && <RowDetail label="Password" value={masked(detail.password)} action={<button type="button" className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline" onClick={() => copyWithAuth('Password', detail.password)} title="Copy password" aria-label="Copy password"><Copy size={14} /></button>} />}
              {detail.two_factor_enabled && <RowDetail label="2FA" value={normalizeBoolean(!!detail.two_factor_enabled)} />}
              {detail.notes && <RowDetail label="Notes" value={detail.notes} />}
            </div>
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
              const next = authCopy
              setAuthCopy(null)
              window.setTimeout(() => {
                void copy(next.label, next.text)
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

function RowDetail({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 5, padding: '0 2px', minWidth: 0 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.45, flex: 1 }}>{value}</div>
        {action}
      </div>
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
    const appPassword = (process.env.NEXT_PUBLIC_APP_PASSWORD as string | undefined)?.trim() || '1234'
    if (password.join('') !== appPassword) {
      setError('Incorrect password')
      setPassword(['', '', '', ''])
      focusBox(0)
      return
    }
    setError('')
    await onUnlock()
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
              if (next && index < 3) focusBox(index + 1)
            }}
            onKeyDown={e => {
              if (e.key === 'Backspace' && !password[index] && index > 0) {
                focusBox(index - 1)
              }
            }}
            className="form-inp"
            style={{ textAlign: 'center', fontSize: 18, padding: '10px 0' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="submit" className="ui-kit-btn ui-kit-btn--solid">Unlock & Copy</button>
      </div>
    </form>
  )
}
