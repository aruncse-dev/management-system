import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search, LayoutGrid } from 'lucide-react'
import { LoadingState, ModalShell, ModalActions, SearchField, SectionChip, SectionBlock, Spacer } from '@fintracker-vault/ui'

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

export default function AdminOrgsPage() {
  const [rows, setRows] = useState<OrgRow[]>([])
  const [apps, setApps] = useState<AppRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({ name: '', slug: '' })
  const [selectedApps, setSelectedApps] = useState<Record<string, boolean>>({})
  const [appTab, setAppTab] = useState('')
  const [menusByApp, setMenusByApp] = useState<Record<string, MenuRow[]>>({})
  const [enabledByApp, setEnabledByApp] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

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

  function startAdd() {
    setMode('add')
    setStep(1)
    setEditingId('')
    setForm({ name: '', slug: '' })
    setSelectedApps({})
    setMenusByApp({})
    setEnabledByApp({})
    setAppTab(apps[0]?.slug || '')
    setDeleteConfirm(false)
  }

  async function loadMenusForApp(appSlug: string) {
    if (!appSlug || menusByApp[appSlug]) return
    try {
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
      setMenusByApp(prev => ({ ...prev, [appSlug]: mapped }))
      setEnabledByApp(prev => ({ ...prev, [appSlug]: prev[appSlug] || [] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load menus')
    }
  }

  async function startEdit(orgId: string) {
    const org = rows.find(o => o.id === orgId)
    if (!org) return
    setMode('edit')
    setStep(1)
    setEditingId(orgId)
    setForm({ name: org.name, slug: org.slug || '' })
    setSelectedApps({})
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
        if (menuRows.length > 0) {
          setSelectedApps(prev => ({ ...prev, [app.slug]: true }))
          setMenusByApp(prev => ({ ...prev, [app.slug]: menuRows }))
          setEnabledByApp(prev => ({
            ...prev,
            [app.slug]: menuRows.filter(m => m.enabled).map(m => m.id),
          }))
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    }
  }

  function closeForm() {
    setMode(null)
    setStep(1)
    setEditingId('')
    setForm({ name: '', slug: '' })
    setSelectedApps({})
    setMenusByApp({})
    setEnabledByApp({})
    setDeleteConfirm(false)
  }

  function nextStep() {
    if (step === 1 && !form.name.trim()) {
      setError('Name is required')
      return
    }
    if (step === 2 && !Object.values(selectedApps).some(v => v)) {
      setError('Select at least one app')
      return
    }
    setError('')
    const selectedAppSlugs = apps.filter(a => selectedApps[a.slug]).map(a => a.slug)
    if (step === 2) {
      Promise.all(selectedAppSlugs.map(slug => loadMenusForApp(slug))).catch(e => {
        setError(e instanceof Error ? e.message : 'Failed to load menus')
      })
    }
    setStep((s) => (s === 1 ? 2 : 3) as 1 | 2 | 3)
  }

  function prevStep() {
    setError('')
    setStep((s) => (s === 3 ? 2 : 1) as 1 | 2 | 3)
  }

  function toggleApp(appSlug: string) {
    setSelectedApps(prev => ({ ...prev, [appSlug]: !prev[appSlug] }))
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
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (mode === 'add') {
        const r = await fetch('/api/admin/orgs', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim(), slug: form.slug.trim() || null }),
        })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error || 'Create failed')
        const id = j.data?.id as string | undefined
        if (!id) throw new Error('Create failed: missing organization id')

        const selectedAppSlugs = apps.filter(a => selectedApps[a.slug]).map(a => a.slug)
        for (const appSlug of selectedAppSlugs) {
          const enabledMenuIds = enabledByApp[appSlug] || []
          const menuRes = await fetch(`/api/admin/orgs/${encodeURIComponent(id)}/menu`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appSlug, enabledMenuIds }),
          })
          const menuJson = await menuRes.json()
          if (!menuJson.ok) throw new Error(menuJson.error || `Failed to assign menus for ${appSlug}`)
        }
      } else if (mode === 'edit') {
        const r = await fetch(`/api/admin/orgs/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            slug: form.slug.trim() || null,
            status: 'active',
          }),
        })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error || 'Save failed')

        const selectedAppSlugs = apps.filter(a => selectedApps[a.slug]).map(a => a.slug)
        for (const appSlug of selectedAppSlugs) {
          const enabledMenuIds = enabledByApp[appSlug] || []
          const menuRes = await fetch(`/api/admin/orgs/${encodeURIComponent(editingId)}/menu`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appSlug, enabledMenuIds }),
          })
          const menuJson = await menuRes.json()
          if (!menuJson.ok) throw new Error(menuJson.error || `Failed to save ${appSlug} menus`)
        }
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
      <div className="ui-kit-page-shell">
        <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '0 1rem' }}>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.9rem', marginTop: '1rem' }}>⚠ {error}</p>}

          <SectionBlock
            title="Organizations"
            icon={<LayoutGrid size={16} />}
            rightChip={<SectionChip>{rows.length}</SectionChip>}
            right={loading ? <LoadingState variant="inline" /> : null}
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

              {!loading && rows.length > 0 && (
                <div className="ui-stack">
                  {filtered.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => void startEdit(o.id)}
                      style={{
                        padding: '1rem',
                        border: '1px solid var(--border, #e5e7eb)',
                        borderRadius: '8px',
                        background: 'var(--card-bg, #fff)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'box-shadow 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 1px 6px rgba(62, 113, 202, 0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                        {o.name}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                        {o.slug ? `Slug: ${o.slug}` : 'No slug'} • {o.status}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </SectionBlock>
        </div>
      </div>

      <button
        type="button"
        onClick={startAdd}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '56px',
          height: '56px',
          borderRadius: '999px',
          background: '#1e5cc7',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 16px 32px rgba(30, 92, 199, 0.24)',
        }}
        title="Add organization"
      >
        <Plus size={24} />
      </button>

        {mode && (
          <ModalShell
            title={mode === 'add' ? `Add Organization - Step ${step}/3` : `Edit Organization`}
            onClose={closeForm}
            footer={
              <ModalActions
                secondaryLabel={step > 1 ? 'Back' : 'Cancel'}
                primaryLabel={step === 3 ? (mode === 'add' ? 'Create' : 'Save') : 'Next'}
                onSecondary={step > 1 ? prevStep : closeForm}
                onPrimary={step === 3 ? save : nextStep}
                leading={
                  mode === 'edit' ? (
                    <button
                      type="button"
                      onClick={confirmDelete}
                      disabled={saving}
                      style={{
                        background: '#b91c1c',
                        color: '#fff',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                      }}
                    >
                      {saving ? 'Deleting…' : deleteConfirm ? 'Confirm delete?' : 'Delete'}
                    </button>
                  ) : null
                }
                disabled={saving}
              />
            }
          >
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                if (step === 3) void save()
                else nextStep()
              }}
              style={{ display: 'grid', gap: '1rem' }}
            >
              {step === 1 && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g., Acme Corp"
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #ccc',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                      Slug (optional)
                    </label>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                      placeholder="auto-generated from name"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #ccc',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                      {form.slug.trim() ? `Slug: ${autoSlug(form.slug)}` : form.name.trim() ? `Slug: ${autoSlug(form.name)}` : ''}
                    </p>
                  </div>
                </>
              )}

              {step === 2 && (
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#0f172a' }}>
                    Select apps for this organization:
                  </p>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {apps.map(a => (
                      <label
                        key={a.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.75rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: '#f9fafb',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedApps[a.slug] || false}
                          onChange={() => toggleApp(a.slug)}
                          style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                        />
                        <span style={{ flex: 1, fontWeight: 600, color: '#0f172a' }}>{a.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#0f172a' }}>
                    Choose menus per app:
                  </p>

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {apps
                      .filter(a => selectedApps[a.slug])
                      .map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setAppTab(a.slug)}
                          style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '6px',
                            background: appTab === a.slug ? '#1e5cc7' : '#e5e7eb',
                            color: appTab === a.slug ? '#fff' : '#0f172a',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {a.name}
                        </button>
                      ))}
                  </div>

                  {appTab && (
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: '#6b7280' }}>
                        Menus for {apps.find(a => a.slug === appTab)?.name}{' '}
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          ({(enabledByApp[appTab] || []).length} / {(menusByApp[appTab] || []).length})
                        </span>
                      </p>
                      <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                        {(menusByApp[appTab] || []).map(m => (
                          <label
                            key={m.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.75rem',
                              padding: '0.75rem',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: '#f9fafb',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={(enabledByApp[appTab] || []).includes(m.id)}
                              onChange={() => toggleMenu(appTab, m.id)}
                              style={{ width: '1rem', height: '1rem', cursor: 'pointer', marginTop: '0.1rem', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{m.label}</div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                {m.sectionLabel} • {m.path}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
          </ModalShell>
        )}
    </>
  )
}
