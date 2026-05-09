import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Users, Search, X as XIcon } from 'lucide-react'
import { FabButton, FormField, LoadingState, SearchField, SectionChip, SectionBlock, Spacer } from '@fintracker-vault/ui'

type UserRow = {
  email: string
  displayName: string | null
  role: string
  orgId: string | null
  status: string
  createdAt: string
}

type OrgRow = {
  id: string
  name: string
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [editingEmail, setEditingEmail] = useState('')
  const [form, setForm] = useState({ email: '', displayName: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const uRes = await fetch('/api/admin/users', { credentials: 'same-origin' })
      const uJson = await uRes.json()
      if (!uJson.ok) throw new Error(uJson.error || 'Failed to load users')
      setRows((uJson.data || []) as UserRow[])

      const oRes = await fetch('/api/admin/orgs', { credentials: 'same-origin' })
      const oJson = await oRes.json()
      if (!oJson.ok) throw new Error(oJson.error || 'Failed to load organizations')
      setOrgs((oJson.data || []) as OrgRow[])
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
        (u.role || '').toLowerCase().includes(term),
    )
  }, [rows, q])

  function startAdd() {
    setMode('add')
    setEditingEmail('')
    setForm({ email: '', displayName: '', role: 'member' })
    setDeleteConfirm(false)
  }

  function startEdit(email: string) {
    const user = rows.find(u => u.email === email)
    if (!user) return
    setMode('edit')
    setEditingEmail(email)
    setForm({ email: user.email, displayName: user.displayName || '', role: user.role })
    setDeleteConfirm(false)
  }

  function closeForm() {
    setMode(null)
    setEditingEmail('')
    setForm({ email: '', displayName: '', role: 'member' })
    setDeleteConfirm(false)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form.email.trim()) {
      setError('Email is required')
      return
    }

    setSaving(true)
    setError('')
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          displayName: form.displayName.trim() || form.email.split('@')[0],
          role: form.role,
        }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Save failed')
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
      if (!j.ok) throw new Error(j.error || 'Delete failed')
      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>Users · Admin</title>
      </Head>
      <div className="admin-page" style={{ paddingTop: 0 }}>
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.9rem', marginTop: '1rem' }}>⚠ {error}</p>}

          <SectionBlock
            title="Users"
            icon={<Users size={16} />}
            rightChip={<SectionChip>{rows.length}</SectionChip>}
          >
            <div>
              {rows.length > 5 && (
                <>
                  <SearchField
                    value={q}
                    placeholder="Search users..."
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
                  <p>No users yet. Create one with the button below.</p>
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
                      className="admin-card-item"
                      onClick={() => startEdit(u.email)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          startEdit(u.email)
                        }
                      }}
                    >
                      <div className="admin-card-item__body">
                        <p className="admin-card-item__title">{u.displayName || u.email}</p>
                        <p className="admin-card-item__meta">
                          {u.email} • {u.role} • {u.orgId ? orgs.find(o => o.id === u.orgId)?.name || 'Unknown org' : 'No org'}
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

      <FabButton label="Add user" onClick={startAdd} />

      {mode && (
        <div className="modal-bg open" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <span className="modal-title">
                {mode === 'add' ? 'Add User' : 'Edit User'}
              </span>
              <button
                type="button"
                onClick={closeForm}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <XIcon size={18} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={save} className="admin-form">
                <FormField label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com"
                    autoFocus
                    disabled={mode === 'edit'}
                  />
                </FormField>

                <FormField label="Display Name">
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                    placeholder="John Doe"
                  />
                </FormField>

                <FormField label="Role">
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  >
                    <option value="member">Member</option>
                    <option value="org_admin">Organization Admin</option>
                    <option value="admin">Platform Admin</option>
                  </select>
                </FormField>
              </form>
            </div>
            <div className="modal-foot">
              {mode === 'edit' ? (
                <button type="button" className="btn btn-sm btn-red" onClick={confirmDelete} disabled={saving}>
                  {saving ? 'Deleting...' : deleteConfirm ? 'Confirm delete?' : 'Delete'}
                </button>
              ) : null}
              <div className="modal-foot-l" />
              <button
                type="button"
                className="btn btn-sm btn-cancel"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-green"
                onClick={save}
                disabled={saving}
              >
                {mode === 'add' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
