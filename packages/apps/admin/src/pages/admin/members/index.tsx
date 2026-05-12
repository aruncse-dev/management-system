import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Users, Search, X as XIcon } from 'lucide-react'
import { FabButton, FormField, LoadingState, SearchField, SectionChip, SectionBlock, Spacer } from '@fintracker-vault/ui'

type OrgMemberRole = 'member' | 'org_admin'

type MemberRow = {
  id: string
  orgId: string
  orgName: string
  userEmail: string
  displayName: string | null
  /** Stored as `member` or `admin` in `org_members.role`. */
  role: string | null
  createdAt: string
}

type OrgRow = { id: string; name: string }

export default function AdminMembersPage() {
  const [rows, setRows] = useState<MemberRow[]>([])
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [orgFilter, setOrgFilter] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<'add' | 'detail' | null>(null)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState<{ orgId: string; userEmail: string; displayName: string; orgRole: OrgMemberRole }>({
    orgId: '',
    userEmail: '',
    displayName: '',
    orgRole: 'member',
  })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qParam = orgFilter ? `?orgId=${encodeURIComponent(orgFilter)}` : ''
      const mRes = await fetch(`/api/admin/org-members${qParam}`, { credentials: 'same-origin' })
      const mJson = await mRes.json()
      if (!mJson.ok) throw new Error(mJson.error || 'Failed to load members')

      const oRes = await fetch('/api/admin/orgs', { credentials: 'same-origin' })
      const oJson = await oRes.json()
      if (!oJson.ok) throw new Error(oJson.error || 'Failed to load organizations')

      setRows((mJson.data || []) as MemberRow[])
      setOrgs((oJson.data || []) as OrgRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [orgFilter])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      r =>
        r.userEmail.toLowerCase().includes(term) ||
        r.orgName.toLowerCase().includes(term) ||
        (r.displayName || '').toLowerCase().includes(term),
    )
  }, [rows, q])

  function startAdd() {
    setMode('add')
    setEditingId('')
    setForm({ orgId: orgFilter || orgs[0]?.id || '', userEmail: '', displayName: '', orgRole: 'member' })
    setDeleteConfirm(false)
  }

  function openDetail(row: MemberRow) {
    setMode('detail')
    setEditingId(row.id)
    setForm({
      orgId: row.orgId,
      userEmail: row.userEmail,
      displayName: row.displayName || '',
      orgRole: row.role === 'admin' ? 'org_admin' : 'member',
    })
    setDeleteConfirm(false)
  }

  function closeForm() {
    setMode(null)
    setEditingId('')
    setForm({ orgId: '', userEmail: '', displayName: '', orgRole: 'member' })
    setDeleteConfirm(false)
  }

  async function submitAdd(e?: FormEvent) {
    e?.preventDefault()
    if (!form.orgId) {
      setError('Organization is required')
      return
    }
    if (!form.userEmail.trim() || !form.userEmail.includes('@')) {
      setError('Valid email is required')
      return
    }

    setSaving(true)
    setError('')
    try {
      const r = await fetch('/api/admin/org-members', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: form.orgId,
          userEmail: form.userEmail.trim().toLowerCase(),
          displayName: form.displayName.trim() || undefined,
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

  async function submitEdit(e?: FormEvent) {
    e?.preventDefault()
    if (!editingId) return

    setSaving(true)
    setError('')
    try {
      const r = await fetch('/api/admin/org-members', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          displayName: form.displayName.trim(),
          role: form.orgRole,
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
    void deleteMember()
  }

  async function deleteMember() {
    if (!editingId) return
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/admin/org-members?id=${encodeURIComponent(editingId)}`, {
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

  const orgNameDetail = orgs.find(o => o.id === form.orgId)?.name || form.orgId

  return (
    <>
      <Head>
        <title>Org members · Admin</title>
      </Head>
      <div className="admin-page" style={{ paddingTop: 0 }}>
        <div>
          {error ? <p className="admin-error">⚠ {error}</p> : null}

          <SectionBlock title="Org members" icon={<Users size={16} />} rightChip={<SectionChip>{rows.length}</SectionChip>}>
            <div>
              <div className="admin-header" style={{ marginBottom: '0.75rem' }}>
                <div style={{ flex: '1 1 14rem', maxWidth: 'min(100%, 22rem)', minWidth: 0 }}>
                  <FormField label="Filter by organization">
                    <select
                      className="form-sel"
                      value={orgFilter}
                      onChange={e => setOrgFilter(e.target.value)}
                      aria-label="Filter members by organization"
                    >
                      <option value="">All organizations</option>
                      {orgs.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </div>

              {rows.length > 0 && (
                <>
                  <SearchField
                    value={q}
                    placeholder="Search by org, name, or email…"
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
                  <p>No org members yet. Add one with the button below.</p>
                </div>
              )}

              {!loading && rows.length > 0 && filtered.length === 0 && (
                <p className="admin-muted">No members match your search.</p>
              )}

              {!loading && filtered.length > 0 && (
                <div className="ui-stack">
                  {filtered.map(r => {
                    const name = r.displayName?.trim() || ''
                    const title = name || r.userEmail
                    return (
                      <div
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        className="admin-card-item admin-menu-item-card"
                        onClick={() => openDetail(r)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openDetail(r)
                          }
                        }}
                      >
                        <div className="admin-card-item__body">
                          <p className={`admin-card-item__title${name ? '' : ' admin-muted'}`}>{title}</p>
                          <p className="admin-card-item__meta">
                            <span>{r.orgName}</span>
                            {name ? (
                              <>
                                <span className="admin-muted"> · </span>
                                <span>{r.userEmail}</span>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </SectionBlock>
        </div>
      </div>

      <FabButton label="Add org member" onClick={startAdd} />

      {mode === 'add' && (
        <div className="modal-bg open" onClick={closeForm}>
          <div className="admin-modal-wrap" onClick={e => e.stopPropagation()}>
            <div className="modal modal-shell">
              <div className="modal-hd modal-hd--blue">
                <span className="modal-title">Add org member</span>
                <button type="button" className="modal-close" onClick={closeForm} aria-label="Close">
                  <XIcon size={18} />
                </button>
              </div>
              <div className="modal-body">
                <form id="admin-member-add" onSubmit={submitAdd} className="admin-form">
                  <FormField label="Organization">
                    <select
                      className="form-sel"
                      value={form.orgId}
                      onChange={e => setForm(f => ({ ...f, orgId: e.target.value }))}
                      required
                    >
                      <option value="" disabled>
                        Select organization…
                      </option>
                      {orgs.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Name">
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                      placeholder="Display name"
                      autoComplete="name"
                    />
                  </FormField>
                  <FormField label="Email">
                    <input
                      type="email"
                      value={form.userEmail}
                      onChange={e => setForm(f => ({ ...f, userEmail: e.target.value }))}
                      placeholder="user@example.com"
                      autoComplete="email"
                    />
                  </FormField>
                </form>
              </div>
              <div className="modal-foot">
                <div className="modal-foot-l" />
                <button type="button" className="btn btn-sm btn-cancel" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" form="admin-member-add" className="btn btn-sm btn-green" disabled={saving}>
                  {saving ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'detail' && (
        <div className="modal-bg open" onClick={closeForm}>
          <div className="admin-modal-wrap" onClick={e => e.stopPropagation()}>
            <div className="modal modal-shell">
              <div className="modal-hd modal-hd--blue">
                <span className="modal-title">Org member</span>
                <button type="button" className="modal-close" onClick={closeForm} aria-label="Close">
                  <XIcon size={18} />
                </button>
              </div>
              <div className="modal-body">
                <form id="admin-member-edit" onSubmit={submitEdit} className="admin-form">
                  <FormField label="Organization">
                    <input type="text" readOnly value={orgNameDetail} />
                  </FormField>
                  <FormField label="Name">
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                      placeholder="Display name"
                      autoComplete="name"
                    />
                  </FormField>
                  <FormField label="Email">
                    <input type="text" readOnly value={form.userEmail} />
                  </FormField>
                  <FormField label="Role in organization">
                    <select
                      className="form-sel"
                      value={form.orgRole}
                      onChange={e => setForm(f => ({ ...f, orgRole: e.target.value as OrgMemberRole }))}
                      aria-label="Role in organization"
                    >
                      <option value="member">Member</option>
                      <option value="org_admin">Org admin</option>
                    </select>
                  </FormField>
                </form>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-sm btn-red" onClick={confirmDelete} disabled={saving}>
                  {saving ? 'Working…' : deleteConfirm ? 'Tap again to confirm' : 'Remove from organization'}
                </button>
                <div className="modal-foot-l" />
                <button type="button" className="btn btn-sm btn-cancel" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" form="admin-member-edit" className="btn btn-sm btn-green" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
