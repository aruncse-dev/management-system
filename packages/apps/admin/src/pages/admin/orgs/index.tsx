import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { LayoutGrid, Search } from 'lucide-react'
import {
  ConfirmDialog,
  DataPageHeader,
  FabButton,
  AdminDataListSearch,
  SectionChip,
  LoadingState,
} from '@fintracker-vault/ui'

type OrgRow = {
  id: string
  name: string
  slug: string | null
  status: string
  notes: string | null
  createdAt: string
}

type AppRow = {
  id: string
  slug: string
  name: string
}

type MenuRow = {
  id: string
  label: string
  path: string
  sectionLabel: string
  enabled?: boolean
}

type MenusByApp = Record<string, MenuRow[]>
type EnabledByApp = Record<string, string[]>
type SelectedApps = Record<string, boolean>

export default function AdminOrgsPage() {
  const [rows, setRows] = useState<OrgRow[]>([])
  const [apps, setApps] = useState<AppRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create modal state
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [savingCreate, setSavingCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSlug, setCreateSlug] = useState('')
  const [createSelectedApps, setCreateSelectedApps] = useState<SelectedApps>({})
  const [createAppTab, setCreateAppTab] = useState('fintracker')
  const [createMenusByApp, setCreateMenusByApp] = useState<MenusByApp>({})
  const [createEnabledByApp, setCreateEnabledByApp] = useState<EnabledByApp>({})

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editOrgId, setEditOrgId] = useState('')
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [editSelectedApps, setEditSelectedApps] = useState<SelectedApps>({})
  const [editAppTab, setEditAppTab] = useState('fintracker')
  const [editMenusByApp, setEditMenusByApp] = useState<MenusByApp>({})
  const [editEnabledByApp, setEditEnabledByApp] = useState<EnabledByApp>({})

  // Delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [oRes, aRes] = await Promise.all([
        fetch('/api/admin/orgs', { credentials: 'same-origin' }),
        fetch('/api/admin/apps', { credentials: 'same-origin' }),
      ])
      const oJson = await oRes.json()
      const aJson = await aRes.json()
      if (!oJson.ok) throw new Error(oJson.error || 'Failed to load organizations')
      if (!aJson.ok) throw new Error(aJson.error || 'Failed to load apps')
      setRows((oJson.data || []) as OrgRow[])
      setApps((aJson.data || []) as AppRow[])
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
      o =>
        o.name.toLowerCase().includes(term) ||
        (o.slug || '').toLowerCase().includes(term) ||
        (o.status || '').toLowerCase().includes(term),
    )
  }, [rows, q])

  const autoSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64)
  }

  async function loadCatalogMenusForApp(appSlug: string, isCreate: boolean) {
    const menusByApp = isCreate ? createMenusByApp : editMenusByApp
    if (!appSlug || menusByApp[appSlug]) return
    const r = await fetch(`/api/admin/menus?app=${encodeURIComponent(appSlug)}`, {
      credentials: 'same-origin',
    })
    const j = await r.json()
    if (!j.ok) throw new Error(j.error || `Failed to load ${appSlug} menus`)
    const mapped = ((j.data || []) as MenuRow[]).map(m => ({
      id: m.id,
      label: m.label,
      path: m.path,
      sectionLabel: m.sectionLabel,
    }))
    if (isCreate) {
      setCreateMenusByApp(prev => ({ ...prev, [appSlug]: mapped }))
      setCreateEnabledByApp(prev => ({ ...prev, [appSlug]: prev[appSlug] || [] }))
    } else {
      setEditMenusByApp(prev => ({ ...prev, [appSlug]: mapped }))
      setEditEnabledByApp(prev => ({ ...prev, [appSlug]: prev[appSlug] || [] }))
    }
  }

  useEffect(() => {
    if (!createOpen || createStep !== 3) return
    const selectedAppSlugs = apps.filter(a => createSelectedApps[a.slug]).map(a => a.slug)
    Promise.all(selectedAppSlugs.map(slug => loadCatalogMenusForApp(slug, true))).catch(e => {
      setError(e instanceof Error ? e.message : 'Failed to load menus')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, createStep])

  useEffect(() => {
    if (!editOpen) return
    const selectedAppSlugs = apps.filter(a => editSelectedApps[a.slug]).map(a => a.slug)
    Promise.all(selectedAppSlugs.map(slug => loadCatalogMenusForApp(slug, false))).catch(e => {
      setError(e instanceof Error ? e.message : 'Failed to load menus')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, editSelectedApps])

  function toggleCreateApp(appSlug: string) {
    setCreateSelectedApps(prev => ({ ...prev, [appSlug]: !prev[appSlug] }))
  }

  function toggleCreateMenu(appSlug: string, menuId: string) {
    setCreateEnabledByApp(prev => {
      const selected = new Set(prev[appSlug] || [])
      if (selected.has(menuId)) selected.delete(menuId)
      else selected.add(menuId)
      return { ...prev, [appSlug]: [...selected] }
    })
  }

  function toggleEditApp(appSlug: string) {
    setEditSelectedApps(prev => ({ ...prev, [appSlug]: !prev[appSlug] }))
  }

  function toggleEditMenu(appSlug: string, menuId: string) {
    setEditEnabledByApp(prev => {
      const selected = new Set(prev[appSlug] || [])
      if (selected.has(menuId)) selected.delete(menuId)
      else selected.add(menuId)
      return { ...prev, [appSlug]: [...selected] }
    })
  }

  function openCreateModal() {
    setCreateOpen(true)
    setCreateStep(1)
    setCreateName('')
    setCreateSlug('')
    setCreateSelectedApps({})
    setCreateMenusByApp({})
    setCreateEnabledByApp({})
    setCreateAppTab(apps[0]?.slug || 'fintracker')
    setError('')
  }

  async function createOrg() {
    if (!createName.trim()) {
      setError('Name is required')
      return
    }
    setSavingCreate(true)
    setError('')
    try {
      const r = await fetch('/api/admin/orgs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          slug: createSlug.trim() || null,
        }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Create failed')
      const id = j.data?.id as string | undefined
      if (!id) throw new Error('Create failed: missing organization id')

      const selectedAppSlugs = apps.filter(a => createSelectedApps[a.slug]).map(a => a.slug)
      for (const appSlug of selectedAppSlugs) {
        const enabledMenuIds = createEnabledByApp[appSlug] || []
        const menuRes = await fetch(`/api/admin/orgs/${encodeURIComponent(id)}/menu`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appSlug, enabledMenuIds }),
        })
        const menuJson = await menuRes.json()
        if (!menuJson.ok) throw new Error(menuJson.error || `Failed to assign menus for ${appSlug}`)
      }

      setCreateOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSavingCreate(false)
    }
  }

  async function openEditModal(orgId: string) {
    setEditOpen(true)
    setEditLoading(true)
    setError('')
    try {
      const orgRes = await fetch(`/api/admin/orgs/${encodeURIComponent(orgId)}`, {
        credentials: 'same-origin',
      })
      const orgJson = await orgRes.json()
      if (!orgJson.ok) throw new Error(orgJson.error || 'Failed to load organization')

      const selectedApps: SelectedApps = {}
      const menusByApp: MenusByApp = {}
      const enabledByApp: EnabledByApp = {}

      for (const app of apps) {
        const menuRes = await fetch(
          `/api/admin/orgs/${encodeURIComponent(orgId)}/menu?app=${encodeURIComponent(app.slug)}`,
          { credentials: 'same-origin' },
        )
        const menuJson = await menuRes.json()
        if (!menuJson.ok) throw new Error(menuJson.error || `Failed to load ${app.slug} menus`)
        const menuRows = (menuJson.data || []) as MenuRow[]
        if (menuRows.length > 0) {
          selectedApps[app.slug] = true
          menusByApp[app.slug] = menuRows
          enabledByApp[app.slug] = menuRows.filter(m => Boolean(m.enabled)).map(m => m.id)
        }
      }

      setEditOrgId(orgId)
      setEditName(orgJson.data.name || '')
      setEditSlug(orgJson.data.slug || '')
      setEditStatus(orgJson.data.status || 'active')
      setEditSelectedApps(selectedApps)
      setEditMenusByApp(menusByApp)
      setEditEnabledByApp(enabledByApp)
      setEditAppTab(apps[0]?.slug || 'fintracker')
    } catch (e) {
      setEditOpen(false)
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setEditLoading(false)
    }
  }

  async function saveEdit() {
    if (!editOrgId || !editName.trim()) {
      setError('Name is required')
      return
    }
    setSavingEdit(true)
    setError('')
    try {
      const r = await fetch(`/api/admin/orgs/${encodeURIComponent(editOrgId)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          slug: editSlug.trim() || null,
          status: editStatus,
        }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Save failed')

      const selectedAppSlugs = apps.filter(a => editSelectedApps[a.slug]).map(a => a.slug)
      for (const appSlug of selectedAppSlugs) {
        const enabledMenuIds = editEnabledByApp[appSlug] || []
        const menuRes = await fetch(`/api/admin/orgs/${encodeURIComponent(editOrgId)}/menu`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appSlug, enabledMenuIds }),
        })
        const menuJson = await menuRes.json()
        if (!menuJson.ok) throw new Error(menuJson.error || `Failed to save ${appSlug} menus`)
      }

      setEditOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteOrg() {
    if (!editOrgId) return
    setDeleting(true)
    setError('')
    try {
      const r = await fetch(`/api/admin/orgs/${encodeURIComponent(editOrgId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Delete failed')
      setConfirmDeleteOpen(false)
      setEditOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Organizations · Admin</title>
      </Head>
      <div className="admin-page">
        <DataPageHeader title="Organizations" right={<SectionChip>{rows.length}</SectionChip>} />

        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

        <section>
          {rows.length > 5 && (
            <AdminDataListSearch
              itemCount={rows.length}
              value={q}
              onChange={setQ}
              placeholder="Search organizations..."
              ariaLabel="Search organizations"
            />
          )}

          {loading && <LoadingState variant="page" />}

          {!loading && rows.length === 0 && (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem 0' }}>
              No organizations yet.
            </p>
          )}

          {!loading && filtered.length > 0 && (
            <div className="admin-card-list">
              {filtered.map(o => (
                <div key={o.id} className="admin-card-item">
                  <div className="admin-card-item__body">
                    <h3 className="admin-card-item__title">{o.name}</h3>
                    <p className="admin-card-item__meta">
                      {o.slug ? `Slug: ${o.slug}` : 'No slug'} • {o.status}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="admin-btn"
                      onClick={() => void openEditModal(o.id)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.85rem',
                        border: 'none',
                        borderRadius: '8px',
                        background: '#1e5cc7',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <FabButton label="Add organization" onClick={openCreateModal} />
      </div>

      {/* Create Modal */}
      {createOpen && (
        <div
          className="modal-bg open admin-modal-wrap"
          onClick={() => setCreateOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div className="modal-shell" onClick={e => e.stopPropagation()}>
            <div
              className="modal-hd modal-hd--blue"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                background: '#1e5cc7',
                color: '#fff',
                borderRadius: '8px 8px 0 0',
              }}
            >
              <span className="modal-title">
                {createStep === 1
                  ? 'Organization Details'
                  : createStep === 2
                    ? 'Select Apps'
                    : 'Choose Menus'}
              </span>
              <button
                className="modal-close"
                onClick={() => setCreateOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {createStep === 1 && (
                <form
                  className="admin-form"
                  onSubmit={e => {
                    e.preventDefault()
                    setCreateStep(2)
                  }}
                >
                  <label>
                    Organization Name *
                    <input
                      type="text"
                      value={createName}
                      onChange={e => setCreateName(e.target.value)}
                      placeholder="e.g., Acme Corp"
                      required
                      autoFocus
                    />
                  </label>
                  <label>
                    Slug (optional)
                    <input
                      type="text"
                      value={createSlug}
                      onChange={e => setCreateSlug(e.target.value)}
                      placeholder="auto-generated from name"
                    />
                  </label>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '-0.5rem' }}>
                    {createSlug.trim() ? `Slug: ${autoSlug(createSlug)}` : createName.trim() ? `Slug: ${autoSlug(createName)}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => setCreateOpen(false)}
                      style={{
                        background: '#e5e7eb',
                        color: '#0f172a',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="admin-btn">
                      Next
                    </button>
                  </div>
                </form>
              )}

              {createStep === 2 && (
                <form
                  className="admin-form"
                  onSubmit={e => {
                    e.preventDefault()
                    const hasSelection = apps.some(a => createSelectedApps[a.slug])
                    if (!hasSelection) {
                      setError('Select at least one app')
                      return
                    }
                    setCreateStep(3)
                  }}
                >
                  <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Select apps for this organization:</p>
                  {apps.map(a => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={createSelectedApps[a.slug] || false}
                        onChange={() => toggleCreateApp(a.slug)}
                      />
                      <span>{a.name}</span>
                    </label>
                  ))}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => setCreateStep(1)}
                      style={{
                        background: '#e5e7eb',
                        color: '#0f172a',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Back
                    </button>
                    <button type="submit" className="admin-btn">
                      Next
                    </button>
                  </div>
                </form>
              )}

              {createStep === 3 && (
                <div className="admin-form">
                  <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Choose menus per app:</p>

                  <div className="admin-internal-tabs" style={{ marginBottom: '1.5rem' }}>
                    {apps
                      .filter(a => createSelectedApps[a.slug])
                      .map(a => (
                        <button
                          key={a.id}
                          type="button"
                          className={createAppTab === a.slug ? 'active' : ''}
                          onClick={() => setCreateAppTab(a.slug)}
                          style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '8px',
                            background: createAppTab === a.slug ? '#1e5cc7' : '#e5e7eb',
                            color: createAppTab === a.slug ? '#fff' : '#0f172a',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            marginRight: '0.5rem',
                          }}
                        >
                          {a.name}
                        </button>
                      ))}
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                      {createAppTab} menus{' '}
                      <SectionChip>{(createEnabledByApp[createAppTab] || []).length}</SectionChip>
                    </p>
                    <div className="admin-menu-grid">
                      {(createMenusByApp[createAppTab] || []).map(m => (
                        <label key={m.id} className="admin-menu-item">
                          <input
                            type="checkbox"
                            checked={(createEnabledByApp[createAppTab] || []).includes(m.id)}
                            onChange={() => toggleCreateMenu(createAppTab, m.id)}
                          />
                          <span>
                            {m.label} <span className="admin-meta">({m.sectionLabel})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => setCreateStep(2)}
                      disabled={savingCreate}
                      style={{
                        background: '#e5e7eb',
                        color: '#0f172a',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => void createOrg()}
                      disabled={savingCreate}
                      style={{
                        background: '#1e5cc7',
                        color: '#fff',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      {savingCreate ? 'Creating…' : 'Create Organization'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div
          className="modal-bg open admin-modal-wrap"
          onClick={() => setEditOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div className="modal-shell" onClick={e => e.stopPropagation()}>
            <div
              className="modal-hd modal-hd--blue"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                background: '#1e5cc7',
                color: '#fff',
                borderRadius: '8px 8px 0 0',
              }}
            >
              <span className="modal-title">Edit Organization</span>
              <button
                className="modal-close"
                onClick={() => setEditOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {editLoading && <LoadingState variant="inline" />}

              {!editLoading && (
                <div className="admin-form">
                  <label>
                    Name
                    <input value={editName} onChange={e => setEditName(e.target.value)} required />
                  </label>
                  <label>
                    Slug
                    <input value={editSlug} onChange={e => setEditSlug(e.target.value)} placeholder="optional" />
                  </label>
                  <label>
                    Status
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </label>

                  <p style={{ marginTop: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>
                    Apps for this organization:
                  </p>

                  <div className="admin-internal-tabs" style={{ marginBottom: '1.5rem' }}>
                    {apps.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        className={editAppTab === a.slug ? 'active' : ''}
                        onClick={() => setEditAppTab(a.slug)}
                        style={{
                          padding: '0.5rem 1rem',
                          border: 'none',
                          borderRadius: '8px',
                          background: editAppTab === a.slug ? '#1e5cc7' : '#e5e7eb',
                          color: editAppTab === a.slug ? '#fff' : '#0f172a',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          marginRight: '0.5rem',
                        }}
                      >
                        {a.name}
                        {editSelectedApps[a.slug] ? ' ✓' : ''}
                      </button>
                    ))}
                  </div>

                  {editSelectedApps[editAppTab] && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                        Menus for {editAppTab}{' '}
                        <SectionChip>{(editEnabledByApp[editAppTab] || []).length}</SectionChip>
                      </p>
                      <div className="admin-menu-grid">
                        {(editMenusByApp[editAppTab] || []).map(m => (
                          <label key={m.id} className="admin-menu-item">
                            <input
                              type="checkbox"
                              checked={(editEnabledByApp[editAppTab] || []).includes(m.id)}
                              onChange={() => toggleEditMenu(editAppTab, m.id)}
                            />
                            <span>
                              {m.label} <span className="admin-meta">({m.sectionLabel})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button
                      type="button"
                      className="admin-btn-danger"
                      onClick={() => setConfirmDeleteOpen(true)}
                      disabled={deleting || savingEdit}
                      style={{
                        marginRight: 'auto',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '8px',
                        background: '#b91c1c',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => setEditOpen(false)}
                      disabled={savingEdit}
                      style={{
                        background: '#e5e7eb',
                        color: '#0f172a',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => void saveEdit()}
                      disabled={savingEdit}
                      style={{
                        background: '#1e5cc7',
                        color: '#fff',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete organization?"
        description="This will remove the organization and all its menu assignments. This cannot be undone."
        confirmText="Delete"
        tone="danger"
        busy={deleting}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void deleteOrg()}
      />
    </>
  )
}
