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

type IntegrationRow = {
  slug: string
  name: string
  enabled?: boolean
}

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
  const [apps] = useState<AppRow[]>(() => buildAppList())
  const [menusByApp, setMenusByApp] = useState<Record<string, MenuRow[]>>({})
  const [integrationsByApp, setIntegrationsByApp] = useState<Record<string, IntegrationRow[]>>({})
  const [selectedAppTab, setSelectedAppTab] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingMenus, setSavingMenus] = useState(false)
  const [savingIntegrations, setSavingIntegrations] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const orgRes = await fetch(`/api/admin/orgs/${encodeURIComponent(id)}`, { credentials: 'same-origin' })
      const orgJson = await orgRes.json()
      if (!orgJson.ok) throw new Error(orgJson.error || 'Failed to load organization')

      setOrg(orgJson.data)
      setSelectedAppTab(apps[0]?.slug || '')

      const menusByApp: Record<string, MenuRow[]> = {}
      const integrationsByApp: Record<string, IntegrationRow[]> = {}
      for (const app of apps) {
        const menuRes = await fetch(
          `/api/admin/orgs/${encodeURIComponent(id)}/menu?app=${encodeURIComponent(app.slug)}`,
          { credentials: 'same-origin' },
        )
        const menuJson = await menuRes.json()
        if (!menuJson.ok) throw new Error(menuJson.error || `Failed to load ${app.slug} menus`)
        menusByApp[app.slug] = (menuJson.data || []) as MenuRow[]

        const intRes = await fetch(
          `/api/admin/orgs/${encodeURIComponent(id)}/integrations?app=${encodeURIComponent(app.slug)}`,
          { credentials: 'same-origin' },
        )
        const intJson = await intRes.json()
        if (!intJson.ok) throw new Error(intJson.error || `Failed to load ${app.slug} integrations`)
        integrationsByApp[app.slug] = (intJson.data || []).map((r: IntegrationRow) => ({
          slug: r.slug,
          name: r.name,
          enabled: r.enabled,
        }))
      }
      setMenusByApp(menusByApp)
      setIntegrationsByApp(integrationsByApp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id, apps])

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

  async function toggleIntegration(appSlug: string, slug: string) {
    setSavingIntegrations(true)
    setError('')
    try {
      const current = integrationsByApp[appSlug] || []
      const enabledIds = current.filter((i) => i.enabled).map((i) => i.slug)
      const idx = enabledIds.indexOf(slug)
      if (idx >= 0) enabledIds.splice(idx, 1)
      else enabledIds.push(slug)

      const res = await fetch(`/api/admin/orgs/${encodeURIComponent(id || '')}/integrations`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appSlug, enabledIntegrationIds: enabledIds }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to save integrations')

      setIntegrationsByApp((prev) => ({
        ...prev,
        [appSlug]: (prev[appSlug] || []).map((i) => ({
          ...i,
          enabled: enabledIds.includes(i.slug),
        })),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingIntegrations(false)
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
            <section className="admin-org-config" style={{ marginBottom: '1rem' }}>
              <h2 className="admin-org-config__title" style={{ fontSize: '1rem' }}>
                Menus by app
              </h2>

              <div className="admin-internal-tabs">
                {apps.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={selectedAppTab === a.slug ? 'active' : ''}
                    onClick={() => setSelectedAppTab(a.slug)}
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
                  <div>
                    <p className="admin-org-config__subtitle">
                      Menus for <strong>{apps.find(a => a.slug === selectedAppTab)?.name}</strong>
                    </p>
                    {(menusByApp[selectedAppTab] || []).length === 0 ? (
                      <p className="admin-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                        No menus available.
                      </p>
                    ) : (
                      <div className="admin-menu-grid">
                        {(menusByApp[selectedAppTab] || []).map(m => (
                          <label key={m.id} className="admin-menu-item">
                            <input
                              type="checkbox"
                              checked={m.enabled || false}
                              onChange={() => void toggleMenu(selectedAppTab, m.id)}
                              disabled={savingMenus}
                            />
                            <span>
                              {m.label} <span className="admin-meta">({m.sectionLabel})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {(integrationsByApp[selectedAppTab] || []).length > 0 ? (
                    <div>
                      <p className="admin-org-config__subtitle">
                        Integrations for <strong>{apps.find(a => a.slug === selectedAppTab)?.name}</strong>
                      </p>
                      <div className="admin-menu-grid">
                        {(integrationsByApp[selectedAppTab] || []).map((i) => (
                          <label key={i.slug} className="admin-menu-item">
                            <input
                              type="checkbox"
                              checked={i.enabled || false}
                              onChange={() => void toggleIntegration(selectedAppTab, i.slug)}
                              disabled={savingIntegrations}
                            />
                            <span>{i.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
