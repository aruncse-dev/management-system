import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Search, LayoutGrid, Settings, X as XIcon } from 'lucide-react'
import { FabButton, FormField, LoadingState, SearchField, SectionChip, SectionBlock, Spacer } from '@fintracker-vault/ui'
import { APP_MENUS, APP_SLUGS } from '@fintracker-vault/config'

type OrgRow = {
  id: string
  name: string
  slug: string | null
  status: string
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

type MenuCatalog = Record<string, MenuRow[]>

// Build static menu catalog from APP_MENUS config
function buildMenuCatalog(): MenuCatalog {
  const catalog: MenuCatalog = {}
  for (const appSlug of APP_SLUGS) {
    const sections = APP_MENUS[appSlug]
    const menus: MenuRow[] = []
    for (const [sectionLabel, items] of Object.entries(sections)) {
      for (const item of items) {
        menus.push({
          id: item.slug,
          label: item.label,
          path: `/${item.slug}`,
          sectionLabel,
        })
      }
    }
    catalog[appSlug] = menus
  }
  return catalog
}

// Build static app list
function buildAppList(): AppRow[] {
  const staticAppNames: Record<string, string> = {
    fintracker: 'FinTracker',
    vault: 'Vault',
    staff: 'Staff',
  }
  return APP_SLUGS.map(slug => ({
    id: slug,
    slug,
    name: staticAppNames[slug] || slug,
  }))
}

let orgLookupCache: { apps: AppRow[]; menusByApp: MenuCatalog } | null = null

export default function AdminOrgsPage() {
  const [rows, setRows] = useState<OrgRow[]>([])
  const [apps, setApps] = useState<AppRow[]>([])
  const [menuCatalogByApp, setMenuCatalogByApp] = useState<MenuCatalog>({})
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<'add' | 'edit' | 'configure' | null>(null)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({ name: '' })
  const [appTab, setAppTab] = useState('')
  const [menusByApp, setMenusByApp] = useState<Record<string, MenuRow[]>>({})
  const [enabledByApp, setEnabledByApp] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const loadLookups = useCallback(() => {
    if (orgLookupCache) {
      setApps(orgLookupCache.apps)
      setMenuCatalogByApp(orgLookupCache.menusByApp)
      return
    }
    const appRows = buildAppList()
    const menusByApp = buildMenuCatalog()
    orgLookupCache = { apps: appRows, menusByApp }
    setApps(appRows)
    setMenuCatalogByApp(menusByApp)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const oRes = await fetch('/api/admin/orgs', { credentials: 'same-origin' })
      const oJson = await oRes.json()
      if (!oJson.ok) throw new Error(oJson.error || 'Failed to load organizations')
      setRows((oJson.data || []) as OrgRow[])
      loadLookups()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [loadLookups])

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

  function startAdd() {
    setMode('add')
    setEditingId('')
    setForm({ name: '' })
    setMenusByApp({})
    setEnabledByApp({})
    setAppTab(apps[0]?.slug || '')
    setDeleteConfirm(false)
  }

  function startEdit(orgId: string) {
    const org = rows.find(o => o.id === orgId)
    if (!org) return
    setMode('edit')
    setEditingId(orgId)
    setForm({ name: org.name })
    setDeleteConfirm(false)
  }

  async function startConfigure(orgId: string) {
    setMode('configure')
    setEditingId(orgId)
    setMenusByApp({})
    setEnabledByApp({})
    setAppTab(apps[0]?.slug || '')
    setDeleteConfirm(false)

    try {
      for (const app of apps) {
        const menuRes = await fetch(
          `/api/admin/orgs/${encodeURIComponent(orgId)}/menu?app=${encodeURIComponent(app.slug)}`,
          { credentials: 'same-origin' },
        )
        const menuJson = await menuRes.json()
        if (!menuJson.ok) throw new Error(menuJson.error || `Failed to load ${app.slug} menus`)
        const menuRows = (menuJson.data || []) as MenuRow[]
        const enabledIds = menuRows.filter(m => m.enabled).map(m => m.id)
        setMenusByApp(prev => ({ ...prev, [app.slug]: menuRows }))
        setEnabledByApp(prev => ({
          ...prev,
          [app.slug]: enabledIds,
        }))
        setMenuCatalogByApp(prev => ({ ...prev, [app.slug]: menuRows.map(({ enabled, ...rest }) => rest) }))
      }
      orgLookupCache = {
        apps,
        menusByApp: {
          ...(orgLookupCache?.menusByApp || {}),
          ...Object.fromEntries(
            apps.map(app => [app.slug, (menuCatalogByApp[app.slug] || []).slice()]),
          ),
        },
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    }
  }

  function closeForm() {
    setMode(null)
    setEditingId('')
    setForm({ name: '' })
    setMenusByApp({})
    setEnabledByApp({})
    setDeleteConfirm(false)
  }

  function toggleMenu(appSlug: string, menuId: string) {
    setEnabledByApp(prev => {
      const selected = new Set(prev[appSlug] || [])
      if (selected.has(menuId)) selected.delete(menuId)
      else selected.add(menuId)
      return { ...prev, [appSlug]: [...selected] }
    })
  }

  async function save() {
    if ((mode === 'add' || mode === 'edit') && !form.name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError('')
    let createdOrgId: string | null = null
    try {
      if (mode === 'add') {
        const r = await fetch('/api/admin/orgs', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim() }),
        })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error || 'Create failed')
        const id = j.data?.id as string | undefined
        if (!id) throw new Error('Create failed: missing organization id')
        createdOrgId = id
      } else if (mode === 'edit') {
        const r = await fetch(`/api/admin/orgs/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            status: 'active',
          }),
        })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error || 'Save failed')
      } else if (mode === 'configure') {
        for (const app of apps) {
          const enabledMenuIds = enabledByApp[app.slug] ?? []
          const menuRes = await fetch(`/api/admin/orgs/${encodeURIComponent(editingId)}/menu`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appSlug: app.slug, enabledMenuIds }),
          })
          const menuJson = await menuRes.json()
          if (!menuJson.ok) throw new Error(menuJson.error || `Failed to save ${app.slug} menus`)
          setMenuCatalogByApp(prev => ({ ...prev, [app.slug]: (menuJson.data || []) as MenuRow[] }))
        }
        orgLookupCache = {
          apps,
          menusByApp: {
            ...(orgLookupCache?.menusByApp || {}),
            ...Object.fromEntries(apps.map(app => [app.slug, (menuCatalogByApp[app.slug] || []).slice()])),
          },
        }
      }

      await load()
      if (mode === 'add') {
        if (createdOrgId) await startConfigure(createdOrgId)
        else closeForm()
      } else {
        closeForm()
      }
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
    void deleteOrg()
  }

  async function deleteOrg() {
    if (!editingId) return
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/admin/orgs/${encodeURIComponent(editingId)}`, {
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
        <title>Organizations · Admin</title>
      </Head>
      <div className="admin-page" style={{ paddingTop: 0 }}>
        <div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.9rem', marginTop: '1rem' }}>⚠ {error}</p>}

          <SectionBlock
            title="Organizations"
            icon={<LayoutGrid size={16} />}
            rightChip={<SectionChip>{rows.length}</SectionChip>}
          >
            <div>
              {rows.length > 5 && (
                <>
                  <SearchField
                    value={q}
                    placeholder="Search organizations..."
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
                  <p>No organizations yet. Create one with the button below.</p>
                </div>
              )}

              {!loading && rows.length > 0 && filtered.length === 0 && (
                <p className="admin-muted">No organizations match your search.</p>
              )}

              {!loading && filtered.length > 0 && (
                <div className="ui-stack">
                  {filtered.map(o => (
                    <div
                      key={o.id}
                      role="button"
                      tabIndex={0}
                      className="admin-card-item"
                      onClick={() => startEdit(o.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          startEdit(o.id)
                        }
                      }}
                    >
                      <div className="admin-card-item__body">
                        <p className="admin-card-item__title">{o.name}</p>
                        <p className="admin-card-item__meta">{o.slug ? `Slug: ${o.slug}` : 'No slug'} • {o.status}</p>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Open settings for ${o.name}`}
                        title={`Configure ${o.name}`}
                        onClick={e => {
                          e.stopPropagation()
                          void startConfigure(o.id)
                        }}
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionBlock>
        </div>
      </div>

      <FabButton label="Add organization" onClick={startAdd} />

      {mode && (
        <div className="modal-bg open" onClick={closeForm}>
          <div
            className={`admin-modal-wrap${mode === 'configure' ? ' admin-modal-wrap--config' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal modal-shell">
            <div
              className="modal-hd modal-hd--blue"
            >
              <span className="modal-title">
                {mode === 'add' ? 'Add Organization' : mode === 'edit' ? 'Edit Organization' : 'Configure Apps & Menus'}
              </span>
              <button className="modal-close" onClick={closeForm}><XIcon size={16} /></button>
            </div>
            <div className="modal-body">
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault()
                  void save()
                }}
                className="ui-stack"
              >
              {(mode === 'add' || mode === 'edit') && (
                <>
                  <FormField label="Name">
                    <input
                      className="form-inp"
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g., Acme Corp"
                      autoFocus
                    />
                  </FormField>
                </>
              )}

              {mode === 'configure' && (
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                      Select Apps & Menus
                    </h3>
                    <div className="admin-internal-tabs">
                      {apps.map(a => {
                        const total = (menusByApp[a.slug] || menuCatalogByApp[a.slug] || []).length
                        const enabled = (enabledByApp[a.slug] || []).length
                        const isEnabled = enabled > 0
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className={isEnabled ? 'active' : ''}
                            onClick={() => setAppTab(a.slug)}
                            aria-pressed={appTab === a.slug}
                          >
                            {a.name}
                            {total > 0 && (
                              <span style={{ marginLeft: '0.5rem', opacity: 0.9, fontSize: '0.8rem' }}>
                                ({enabled}/{total})
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {appTab && (menusByApp[appTab] || menuCatalogByApp[appTab] || []).length > 0 && (
                    <div>
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#6b7280' }}>
                        Menus for <strong>{apps.find(a => a.slug === appTab)?.name}</strong>
                      </p>
                      <div className="admin-menu-grid">
                        {(menusByApp[appTab] || menuCatalogByApp[appTab] || []).map(m => (
                          <label key={m.id} className="admin-menu-item">
                            <input
                              type="checkbox"
                              checked={(enabledByApp[appTab] || []).includes(m.id)}
                              onChange={() => toggleMenu(appTab, m.id)}
                            />
                            <span>
                              {m.label} <span className="admin-meta">({m.sectionLabel})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              </form>
            </div>
            <div
              className="modal-foot"
            >
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
        </div>
      )}
    </>
  )
}
