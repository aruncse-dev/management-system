import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { FolderTree, Search } from 'lucide-react'
import { useRouter } from 'next/router'
import { FabButton, SearchField, TransactionCard } from '@fintracker-vault/ui'

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

export default function AdminMenusList() {
  const router = useRouter()
  const [appFilter, setAppFilter] = useState('fintracker')
  const [rows, setRows] = useState<MenuRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [id, setId] = useState('')
  const [slug, setSlug] = useState('')
  const [label, setLabel] = useState('')
  const [path, setPath] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [icon, setIcon] = useState('')
  const [sections, setSections] = useState<{ id: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [mRes, sRes] = await Promise.all([
        fetch(`/api/admin/menus?app=${encodeURIComponent(appFilter)}`, { credentials: 'same-origin' }),
        fetch('/api/admin/sections', { credentials: 'same-origin' }),
      ])
      const mJson = await mRes.json()
      const sJson = await sRes.json()
      if (!mJson.ok) throw new Error(mJson.error || 'Failed to load menus')
      if (!sJson.ok) throw new Error(sJson.error || 'Failed to load sections')
      setRows(mJson.data || [])
      const sec = (sJson.data || []).map((x: { id: string; label: string }) => ({ id: x.id, label: x.label }))
      setSections(sec)
      setSectionId(prev => {
        if (prev && sec.some((s: { id: string }) => s.id === prev)) return prev
        return sec[0]?.id ?? ''
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [appFilter])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      r =>
        r.label.toLowerCase().includes(term) ||
        r.slug.toLowerCase().includes(term) ||
        r.path.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term),
    )
  }, [rows, q])

  async function createMenu(e: FormEvent) {
    e.preventDefault()
    if (!id.trim() || !slug.trim() || !label.trim() || !path.trim() || !sectionId) return
    setSaving(true)
    setError('')
    try {
      const r = await fetch('/api/admin/menus', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id.trim(),
          slug: slug.trim(),
          label: label.trim(),
          path: path.trim(),
          sectionId,
          icon: icon.trim() || null,
          appSlugs: [appFilter],
        }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Create failed')
      setId('')
      setSlug('')
      setLabel('')
      setPath('')
      setIcon('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>Menus · Admin</title>
      </Head>
      <div className="admin-page">
        <header className="admin-header">
          <h1>Menu catalog</h1>
          <div className="admin-header__right admin-header__right--wrap">
            <label className="admin-filter-label">
              App
              <select value={appFilter} onChange={e => setAppFilter(e.target.value)}>
                <option value="fintracker">fintracker</option>
                <option value="vault">vault</option>
                <option value="staff">staff</option>
              </select>
            </label>
          </div>
        </header>

        {error ? <p className="admin-error">{error}</p> : null}

        <section className="admin-card">
          {rows.length > 5 ? (
            <SearchField
              value={q}
              placeholder="Search menus..."
              onChange={setQ}
              onClear={() => setQ('')}
              prefix={<Search size={15} />}
            />
          ) : null}
          {loading ? <p>Loading…</p> : null}
          <div className="admin-card-list">
            {filtered.map(m => (
              <TransactionCard
                key={m.id}
                title={m.label}
                amount={m.slug}
                type={m.sectionLabel}
                date={m.path}
                tone="navy"
                icon={<FolderTree size={14} />}
                amountLabel="Slug"
                typeLabel="Section"
                dateLabel="Path"
                onClick={() => void router.push(`/admin/menus/${encodeURIComponent(m.id)}`)}
              />
            ))}
          </div>
        </section>

        <FabButton label="New menu item" onClick={() => setCreateOpen(true)} />
      </div>

      {createOpen ? (
        <div className="modal-bg open admin-modal-wrap" onClick={() => setCreateOpen(false)}>
          <div className="modal-shell" onClick={e => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <div><span className="modal-title">Add menu item ({appFilter})</span></div>
              <button className="modal-close" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={createMenu} className="admin-form">
                <label>
                  Id (stable key)
                  <input value={id} onChange={e => setId(e.target.value)} required placeholder="e.g. my-page" />
                </label>
                <label>
                  Slug
                  <input value={slug} onChange={e => setSlug(e.target.value)} required />
                </label>
                <label>
                  Label
                  <input value={label} onChange={e => setLabel(e.target.value)} required />
                </label>
                <label>
                  Path
                  <input value={path} onChange={e => setPath(e.target.value)} required placeholder="/my-route" />
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
                <button type="submit" disabled={saving}>
                  {saving ? 'Creating…' : 'Create menu'}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
