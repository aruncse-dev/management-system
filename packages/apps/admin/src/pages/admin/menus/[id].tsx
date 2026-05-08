import Head from 'next/head'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '@fintracker-vault/ui'

type MenuRow = {
  id: string
  slug: string
  label: string
  icon: string | null
  path: string
  sectionId: string
  sectionSlug: string
  sectionLabel: string
  sortOrder: number
  appSlugs: string[]
}

type AppRow = { id: string; slug: string; name: string }

export default function AdminMenuDetail() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const [row, setRow] = useState<MenuRow | null>(null)
  const [apps, setApps] = useState<AppRow[]>([])
  const [sections, setSections] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [slug, setSlug] = useState('')
  const [label, setLabel] = useState('')
  const [path, setPath] = useState('')
  const [icon, setIcon] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [appSlugs, setAppSlugs] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const [mRes, aRes, sRes] = await Promise.all([
        fetch(`/api/admin/menus/${encodeURIComponent(id)}`, { credentials: 'same-origin' }),
        fetch('/api/admin/apps', { credentials: 'same-origin' }),
        fetch('/api/admin/sections', { credentials: 'same-origin' }),
      ])
      const mJson = await mRes.json()
      const aJson = await aRes.json()
      const sJson = await sRes.json()
      if (!mJson.ok) throw new Error(mJson.error || 'Not found')
      if (!aJson.ok || !sJson.ok) throw new Error('Failed to load lookups')
      setRow(mJson.data)
      setSlug(mJson.data.slug)
      setLabel(mJson.data.label)
      setPath(mJson.data.path)
      setIcon(mJson.data.icon || '')
      setSectionId(mJson.data.sectionId)
      setSortOrder(mJson.data.sortOrder ?? 0)
      const nextApps: Record<string, boolean> = {}
      for (const a of aJson.data as AppRow[]) nextApps[a.slug] = mJson.data.appSlugs.includes(a.slug)
      setAppSlugs(nextApps)
      setApps(aJson.data || [])
      setSections((sJson.data || []).map((x: { id: string; label: string }) => ({ id: x.id, label: x.label })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  function toggleApp(slug: string) {
    setAppSlugs(prev => ({ ...prev, [slug]: !prev[slug] }))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    const slugs = Object.entries(appSlugs)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (!slugs.length) {
      setError('Select at least one app')
      return
    }
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/admin/menus/${encodeURIComponent(id)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim(),
          label: label.trim(),
          path: path.trim(),
          sectionId,
          icon: icon.trim() || null,
          sortOrder,
          appSlugs: slugs,
        }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Save failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function actuallyDelete() {
    if (!id) return
    setError('')
    try {
      const r = await fetch(`/api/admin/menus/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Delete failed')
      setConfirmDel(false)
      void router.push('/admin/menus')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (!router.isReady) return null

  return (
    <>
      <Head>
        <title>{row ? `${row.label} · Menu` : 'Menu'} · Admin</title>
      </Head>
      <div className="admin-page">
        <header className="admin-header">
          <h1>{row?.label || 'Menu item'}</h1>
        </header>
        {error ? <p className="admin-error">{error}</p> : null}
        {loading ? <p>Loading…</p> : null}
        {!loading && row ? (
          <>
            <section className="admin-card">
              <h2>Edit menu item</h2>
              <p className="admin-hint">
                Id: <code>{row.id}</code>
              </p>
              <form onSubmit={save} className="admin-form">
                <label>
                  Label
                  <input value={label} onChange={e => setLabel(e.target.value)} required />
                </label>
                <label>
                  Slug
                  <input value={slug} onChange={e => setSlug(e.target.value)} required />
                </label>
                <label>
                  Path
                  <input value={path} onChange={e => setPath(e.target.value)} required />
                </label>
                <label>
                  Section
                  <select value={sectionId} onChange={e => setSectionId(e.target.value)} required>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Icon (lucide)
                  <input value={icon} onChange={e => setIcon(e.target.value)} />
                </label>
                <label>
                  Sort order
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={e => setSortOrder(Number(e.target.value) || 0)}
                  />
                </label>
                <div>
                  <span className="admin-filter-label">Apps</span>
                  <div className="admin-menu-grid">
                    {apps.map(a => (
                      <label key={a.id} className="admin-menu-item">
                        <input type="checkbox" checked={Boolean(appSlugs[a.slug])} onChange={() => toggleApp(a.slug)} />
                        <span>
                          {a.name} <span className="admin-meta">({a.slug})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </form>
            </section>

            <section className="admin-card">
              <h2>Danger zone</h2>
              <button type="button" className="admin-btn-danger" onClick={() => setConfirmDel(true)}>
                Delete menu item
              </button>
            </section>
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Delete menu item?"
        description={row ? `Permanently remove “${row.label}” (${row.id}).` : undefined}
        confirmText="Delete"
        tone="danger"
        onCancel={() => setConfirmDel(false)}
        onConfirm={actuallyDelete}
      />
    </>
  )
}
