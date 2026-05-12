import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { UserCog, Search, X as XIcon } from 'lucide-react'
import { FabButton, FormField, LoadingState, SearchField, SectionChip, SectionBlock, Spacer } from '@fintracker-vault/ui'

type UserRow = {
  email: string
  displayName: string | null
  status: string
  createdAt: string
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [editingEmail, setEditingEmail] = useState('')
  const [form, setForm] = useState({ email: '', displayName: '', status: 'active' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const uRes = await fetch('/api/admin/users', { credentials: 'same-origin' })
      const uJson = await uRes.json()
      if (!uJson.ok) throw new Error(uJson.error || 'Failed to load users')
      const raw = (uJson.data || []) as Record<string, unknown>[]
      setRows(
        raw.map(r => ({
          email: String(r.email),
          displayName: r.displayName != null ? String(r.displayName) : null,
          status: String(r.status ?? 'active'),
          createdAt: String(r.createdAt ?? ''),
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      u =>
        u.email.toLowerCase().includes(term) ||
        (u.displayName || '').toLowerCase().includes(term) ||
        u.status.toLowerCase().includes(term),
    )
  }, [rows, q])

  function startAdd() {
    setMode('add')
    setEditingEmail('')
    setForm({ email: '', displayName: '', status: 'active' })
    setDeleteConfirm(false)
  }

  function startEdit(email: string) {
    const user = rows.find(u => u.email === email)
    if (!user) return
    setMode('edit')
    setEditingEmail(email)
    setForm({
      email: user.email,
      displayName: user.displayName || '',
      status: user.status || 'active',
    })
    setDeleteConfirm(false)
  }

  function closeForm() {
    setMode(null)
    setEditingEmail('')
    setForm({ email: '', displayName: '', status: 'active' })
    setDeleteConfirm(false)
  }

  async function submitUser(e?: FormEvent) {
    e?.preventDefault()
    if (!form.email.trim()) {
      setError('Email is required')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (mode === 'add') {
        const r = await fetch('/api/admin/users', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email.trim().toLowerCase(),
            displayName: form.displayName.trim() || form.email.split('@')[0],
            status: form.status,
          }),
        })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error || 'Save failed')
      } else {
        const r = await fetch(`/api/admin/users/${encodeURIComponent(editingEmail)}`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: form.displayName.trim() || form.email.split('@')[0],
            status: form.status,
          }),
        })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error || 'Save failed')
      }
      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    void deleteUser()
  }

  async function deleteUser() {
    if (!editingEmail) return
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(editingEmail)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Revoke failed')
      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>Admin users · Admin</title>
      </Head>
      <div className="admin-page" style={{ paddingTop: 0 }}>
        <div>
          {error ? <p className="admin-error">⚠ {error}</p> : null}

          <SectionBlock title="Admin users" icon={<UserCog size={16} />} rightChip={<SectionChip>{rows.length}</SectionChip>}>
            <div>
              {rows.length > 0 && (
                <>
                  <SearchField
                    value={q}
                    placeholder="Search by email, name, or status…"
                    onChange={setQ}
                    onClear={() => setQ('')}
                    prefix={<Search size={15} />}
                  />
                  <Spacer size={8} />
                </>
              )}

              {loading && <LoadingState variant="section" />}

              {!loading && rows.length === 0 && (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
                  <p>No admin users yet. Add one with the button below.</p>
                </div>
              )}

              {!loading && rows.length > 0 && filtered.length === 0 && (
                <p className="admin-muted">No users match your search.</p>
              )}

              {!loading && filtered.length > 0 && (
                <div className="ui-stack">
                  {filtered.map(u => (
                    <div
                      key={u.email}
                      role="button"
                      tabIndex={0}
                      className="admin-card-item admin-menu-item-card"
                      onClick={() => startEdit(u.email)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          startEdit(u.email)
                        }
                      }}
                    >
                      <div className="admin-card-item__body">
                        <p className="admin-card-item__title">{u.displayName?.trim() || u.email}</p>
                        <p className="admin-card-item__meta">
                          {u.email}
                          <span className="admin-muted"> · </span>
                          <span>{u.status}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionBlock>
        </div>
      </div>

      <FabButton label="Add admin user" onClick={startAdd} />

      {mode && (
        <div className="modal-bg open" onClick={closeForm}>
          <div className="admin-modal-wrap" onClick={e => e.stopPropagation()}>
            <div className="modal modal-shell">
              <div className="modal-hd modal-hd--blue">
                <span className="modal-title">{mode === 'add' ? 'Add admin user' : 'Edit admin user'}</span>
                <button type="button" className="modal-close" onClick={closeForm} aria-label="Close">
                  <XIcon size={18} />
                </button>
              </div>
              <div className="modal-body">
                <form id="admin-user-form" onSubmit={submitUser} className="admin-form">
                  <FormField label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="user@example.com"
                      autoFocus={mode === 'add'}
                      disabled={mode === 'edit'}
                      autoComplete="email"
                    />
                  </FormField>

                  <FormField label="Display name">
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                      placeholder="John Doe"
                      autoComplete="name"
                    />
                  </FormField>

                  <FormField label="Status">
                    <select
                      className="form-sel"
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </FormField>
                </form>
              </div>
              <div className="modal-foot">
                {mode === 'edit' ? (
                  <button type="button" className="btn btn-sm btn-red" onClick={confirmDelete} disabled={saving}>
                    {saving ? 'Saving…' : deleteConfirm ? 'Tap again to confirm' : 'Revoke admin access'}
                  </button>
                ) : null}
                <div className="modal-foot-l" />
                <button type="button" className="btn btn-sm btn-cancel" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" form="admin-user-form" className="btn btn-sm btn-green" disabled={saving}>
                  {saving ? 'Saving…' : mode === 'add' ? 'Create' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
