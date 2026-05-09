import Head from 'next/head'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { LoadingState } from '@fintracker-vault/ui'
import { APP_SLUGS } from '@fintracker-vault/config'

type OrgRow = {
  id: string
  name: string
  slug: string | null
  status: string
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

export default function AdminOrgDetailPage() {
  const router = useRouter()
  const { id } = router.query as { id?: string }

  const [org, setOrg] = useState<OrgRow | null>(null)
  const [apps, setApps] = useState<AppRow[]>([])
  const [menusByApp, setMenusByApp] = useState<Record<string, MenuRow[]>>({})
  const [selectedAppTab, setSelectedAppTab] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingMenus, setSavingMenus] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const orgRes = await fetch(`/api/admin/orgs/${encodeURIComponent(id)}`, { credentials: 'same-origin' })
      const orgJson = await orgRes.json()
      if (!orgJson.ok) throw new Error(orgJson.error || 'Failed to load organization')

      const appRows = buildAppList()
      setOrg(orgJson.data)
      setApps(appRows)

      const menusByApp: Record<string, MenuRow[]> = {}
      for (const app of appRows) {
        const menuRes = await fetch(
          `/api/admin/orgs/${encodeURIComponent(id)}/menu?app=${encodeURIComponent(app.slug)}`,
          { credentials: 'same-origin' },
        )
        const menuJson = await menuRes.json()
        if (!menuJson.ok) throw new Error(menuJson.error || `Failed to load ${app.slug} menus`)
        menusByApp[app.slug] = (menuJson.data || []) as MenuRow[]
      }
      setMenusByApp(menusByApp)
      setSelectedAppTab(appRows[0]?.slug || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleMenu(appSlug: string, menuId: string) {
    setSavingMenus(true)
    setError('')
    try {
      const currentMenus = menusByApp[appSlug] || []
      const enabledMenuIds = currentMenus.filter(m => m.enabled).map(m => m.id)
      const idx = enabledMenuIds.indexOf(menuId)
      if (idx >= 0) enabledMenuIds.splice(idx, 1)
      else enabledMenuIds.push(menuId)

      const res = await fetch(`/api/admin/orgs/${encodeURIComponent(id || '')}/menu`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appSlug, enabledMenuIds }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to save menus')

      setMenusByApp(prev => ({
        ...prev,
        [appSlug]: (prev[appSlug] || []).map(m => ({
          ...m,
          enabled: enabledMenuIds.includes(m.id),
        })),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingMenus(false)
    }
  }

  const enabledMenuCount = (appSlug: string) => {
    return (menusByApp[appSlug] || []).filter(m => m.enabled).length
  }

  return (
    <>
      <Head>
        <title>{org?.name || 'Organization'} · Admin</title>
      </Head>
      <div className="admin-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => void router.back()}
            style={{
              background: 'none',
              border: 'none',
              color: '#1e5cc7',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          {org && (
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{org.name}</h1>
              <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                {org.slug ? `Slug: ${org.slug}` : 'No slug'} • {org.status}
              </p>
            </div>
          )}
        </div>

        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

        {loading && <LoadingState variant="page" />}

        {!loading && org && (
          <>
            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                Menus by App
              </h2>

              <div className="admin-internal-tabs" style={{ marginBottom: '1.5rem' }}>
                {apps.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={selectedAppTab === a.slug ? 'active' : ''}
                    onClick={() => setSelectedAppTab(a.slug)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '8px',
                      background: selectedAppTab === a.slug ? '#1e5cc7' : '#e5e7eb',
                      color: selectedAppTab === a.slug ? '#fff' : '#0f172a',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      marginRight: '0.5rem',
                    }}
                  >
                    {a.name}
                    <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>
                      {enabledMenuCount(a.slug)} / {(menusByApp[a.slug] || []).length}
                    </span>
                  </button>
                ))}
              </div>

              {selectedAppTab && (
                <div>
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                      Menus for {apps.find(a => a.slug === selectedAppTab)?.name}
                    </p>
                    <div className="admin-card-list">
                      {(menusByApp[selectedAppTab] || []).length === 0 ? (
                        <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>
                          No menus available.
                        </p>
                      ) : (
                        (menusByApp[selectedAppTab] || []).map(m => (
                          <label
                            key={m.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.75rem',
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={m.enabled || false}
                              onChange={() => void toggleMenu(selectedAppTab, m.id)}
                              disabled={savingMenus}
                              style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>
                                {m.label}
                              </p>
                              <p
                                style={{
                                  margin: '0.25rem 0 0 0',
                                  color: '#6b7280',
                                  fontSize: '0.8rem',
                                }}
                              >
                                {m.sectionLabel} • {m.path}
                              </p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
