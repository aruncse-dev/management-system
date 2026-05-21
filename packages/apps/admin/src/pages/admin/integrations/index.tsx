import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plug, Plus, Search, Trash2, X as XIcon } from 'lucide-react'
import {
  FabButton,
  FormField,
  IntegrationIcon,
  LoadingState,
  SearchField,
  SectionBlock,
  SectionChip,
  Spacer,
} from '@fintracker-vault/ui'
import {
  APP_MENUS,
  APP_SLUGS,
  defaultAppMenusForName,
  defaultEndpointsForName,
  integrationOAuthEnvHint,
  slugFromIntegrationName,
} from '@fintracker-vault/config'

type ProviderRow = {
  slug: string
  name: string
  status: string
  actions?: { login: boolean; syncStocks: boolean; syncMutualFunds: boolean }
}

type MenuRow = {
  id: string
  label: string
  sectionLabel: string
}

type EndpointRow = { key: string; url: string }

type IntegrationForm = {
  name: string
  status: 'active' | 'disabled'
  clientId: string
  clientSecret: string
  endpointRows: EndpointRow[]
  appMenus: Record<string, string[]>
  appTab: string
}

const APP_LABELS: Record<string, string> = {
  fintracker: 'FinTracker',
  vault: 'Vault',
  staff: 'Staff',
}

function buildMenuCatalog(): Record<string, MenuRow[]> {
  const catalog: Record<string, MenuRow[]> = {}
  for (const appSlug of APP_SLUGS) {
    const sections = APP_MENUS[appSlug]
    const menus: MenuRow[] = []
    for (const [sectionLabel, items] of Object.entries(sections)) {
      for (const item of items) {
        menus.push({ id: item.slug, label: item.label, sectionLabel })
      }
    }
    catalog[appSlug] = menus
  }
  return catalog
}

const menuCatalog = buildMenuCatalog()

const EMPTY_FORM: IntegrationForm = {
  name: '',
  status: 'active',
  clientId: '',
  clientSecret: '',
  endpointRows: [{ key: '', url: '' }],
  appMenus: { fintracker: [], vault: [], staff: [] },
  appTab: APP_SLUGS[0] || 'fintracker',
}

function endpointsToRows(endpoints: Record<string, string>): EndpointRow[] {
  const rows = Object.entries(endpoints).map(([key, url]) => ({ key, url }))
  return rows.length > 0 ? rows : [{ key: '', url: '' }]
}

export default function AdminIntegrationsPage() {
  const [rows, setRows] = useState<ProviderRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [editingSlug, setEditingSlug] = useState('')
  const [form, setForm] = useState<IntegrationForm>(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/integrations', { credentials: 'same-origin' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to load integrations')
      setRows((json.data || []) as ProviderRow[])
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
    return rows.filter((r) => r.name.toLowerCase().includes(term) || r.status.toLowerCase().includes(term))
  }, [rows, q])

  function closeForm() {
    setMode(null)
    setEditingSlug('')
    setForm(EMPTY_FORM)
    setDeleteConfirm(false)
  }

  function startAdd() {
    setMode('add')
    setEditingSlug('')
    setForm({ ...EMPTY_FORM, appTab: APP_SLUGS[0] || 'fintracker' })
    setDeleteConfirm(false)
  }

  async function startEdit(slug: string) {
    setMode('edit')
    setEditingSlug(slug)
    setDeleteConfirm(false)
    setError('')
    try {
      const res = await fetch(`/api/admin/integrations/${encodeURIComponent(slug)}`, {
        credentials: 'same-origin',
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to load integration')
      const d = json.data as {
        name: string
        status: string
        endpointRows?: EndpointRow[]
        endpoints?: Record<string, string>
        appMenus?: Record<string, string[]>
      }
      const endpointRows = d.endpointRows?.length
        ? d.endpointRows
        : endpointsToRows(d.endpoints || {})
      const appMenus: Record<string, string[]> = { fintracker: [], vault: [], staff: [] }
      for (const app of APP_SLUGS) {
        appMenus[app] = [...(d.appMenus?.[app] ?? [])]
      }
      setForm({
        name: d.name,
        status: d.status === 'disabled' ? 'disabled' : 'active',
        clientId: '',
        clientSecret: '',
        endpointRows,
        appMenus,
        appTab: APP_SLUGS[0] || 'fintracker',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      closeForm()
    }
  }

  function applyNameDefaults(name: string) {
    if (mode !== 'add') return
    const endpoints = defaultEndpointsForName(name)
    const appMenus = defaultAppMenusForName(name)
    if (Object.keys(endpoints).length === 0) return
    setForm((f) => ({
      ...f,
      name,
      endpointRows: endpointsToRows(endpoints),
      appMenus: {
        fintracker: [...(appMenus.fintracker ?? f.appMenus.fintracker)],
        vault: [...(appMenus.vault ?? f.appMenus.vault)],
        staff: [...(appMenus.staff ?? f.appMenus.staff)],
      },
    }))
  }

  function toggleMenu(appSlug: string, menuId: string) {
    setForm((f) => {
      const selected = new Set(f.appMenus[appSlug] || [])
      if (selected.has(menuId)) selected.delete(menuId)
      else selected.add(menuId)
      return { ...f, appMenus: { ...f.appMenus, [appSlug]: [...selected] } }
    })
  }

  function addEndpointRow() {
    setForm((f) => ({ ...f, endpointRows: [...f.endpointRows, { key: '', url: '' }] }))
  }

  function removeEndpointRow(idx: number) {
    setForm((f) => ({
      ...f,
      endpointRows: f.endpointRows.filter((_, i) => i !== idx),
    }))
  }

  async function save(e?: FormEvent) {
    e?.preventDefault()
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    const endpoints = form.endpointRows.filter((r) => r.key.trim() && r.url.trim())
    if (endpoints.length === 0) {
      setError('At least one endpoint is required')
      return
    }
    if (mode === 'add' && (!form.clientId.trim() || !form.clientSecret.trim())) {
      setError('Client ID and client secret are required')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        status: form.status,
        clientId: form.clientId.trim() || undefined,
        clientSecret: form.clientSecret.trim() || undefined,
        endpoints,
        appMenus: form.appMenus,
      }
      const url =
        mode === 'add'
          ? '/api/admin/integrations'
          : `/api/admin/integrations/${encodeURIComponent(editingSlug)}`
      const method = mode === 'add' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Save failed')
      closeForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteIntegration() {
    if (!editingSlug) return
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/integrations/${encodeURIComponent(editingSlug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Delete failed')
      closeForm()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
      setDeleteConfirm(false)
    }
  }

  return (
    <>
      <Head>
        <title>Integrations · Admin</title>
      </Head>
      <div className="admin-page" style={{ paddingTop: 0 }}>
        <div>
          {error ? (
            <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.9rem', marginTop: '1rem' }}>
              ⚠ {error}
            </p>
          ) : null}

          <SectionBlock
            title="Integrations"
            icon={<Plug size={16} />}
            rightChip={<SectionChip>{rows.length}</SectionChip>}
          >
            <div>
              {rows.length > 5 ? (
                <>
                  <SearchField
                    value={q}
                    placeholder="Search integrations…"
                    onChange={setQ}
                    onClear={() => setQ('')}
                    prefix={<Search size={15} />}
                  />
                  <Spacer size={8} />
                </>
              ) : null}

              {loading ? <LoadingState variant="section" /> : null}

              {!loading && rows.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
                  <p>No integrations yet. Add one with the button below.</p>
                </div>
              ) : null}

              {!loading && rows.length > 0 && filtered.length === 0 ? (
                <p className="admin-muted">No integrations match your search.</p>
              ) : null}

              {!loading && filtered.length > 0 ? (
                <div className="ui-stack">
                  {filtered.map((r) => (
                    <div
                      key={r.slug}
                      role="button"
                      tabIndex={0}
                      className="admin-card-item"
                      onClick={() => void startEdit(r.slug)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          void startEdit(r.slug)
                        }
                      }}
                    >
                      <div className="admin-integration-row" style={{ flex: 1, minWidth: 0 }}>
                        <IntegrationIcon name={r.name} size={28} />
                        <div className="admin-card-item__body">
                          <p className="admin-card-item__title">{r.name}</p>
                          <p className="admin-card-item__meta">{r.status === 'active' ? 'Active' : 'Disabled'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </SectionBlock>
        </div>
      </div>

      <FabButton label="Add integration" onClick={startAdd} />

      {mode ? (
        <div className="modal-bg open" onClick={closeForm}>
          <div className="admin-modal-wrap admin-modal-wrap--config" onClick={(ev) => ev.stopPropagation()}>
            <div className="modal modal-shell">
              <div className="modal-hd modal-hd--blue">
                <span className="modal-title">
                  {mode === 'add' ? 'Add integration' : `Edit ${form.name}`}
                </span>
                <button type="button" className="modal-close" onClick={closeForm} aria-label="Close">
                  <XIcon size={16} />
                </button>
              </div>
              <div className="modal-body">
                <form id="admin-integration-form" onSubmit={(ev) => void save(ev)} className="admin-form-stack">
                  <FormField label="Name">
                    <input
                      className="form-inp"
                      value={form.name}
                      onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))}
                      onBlur={() => applyNameDefaults(form.name)}
                      required
                      autoFocus
                      placeholder="e.g. Upstox"
                    />
                  </FormField>

                  <div>
                    <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Endpoints</p>
                    <p className="admin-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }}>
                      API paths only (auth, token, apiBase, holdings). OAuth redirect is shared for all integrations and set on the server.
                    </p>
                    <div className="ui-stack" style={{ gap: '0.5rem' }}>
                      {form.endpointRows.map((row, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            className="form-inp"
                            placeholder="key (e.g. auth)"
                            value={row.key}
                            onChange={(ev) =>
                              setForm((f) => ({
                                ...f,
                                endpointRows: f.endpointRows.map((r, i) =>
                                  i === idx ? { ...r, key: ev.target.value } : r,
                                ),
                              }))
                            }
                            style={{ flex: '0 0 8rem' }}
                          />
                          <input
                            className="form-inp"
                            placeholder="URL or path"
                            value={row.url}
                            onChange={(ev) =>
                              setForm((f) => ({
                                ...f,
                                endpointRows: f.endpointRows.map((r, i) =>
                                  i === idx ? { ...r, url: ev.target.value } : r,
                                ),
                              }))
                            }
                            style={{ flex: 1 }}
                          />
                          {form.endpointRows.length > 1 ? (
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label="Remove endpoint"
                              onClick={() => removeEndpointRow(idx)}
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-cancel"
                      style={{ marginTop: '0.5rem' }}
                      onClick={addEndpointRow}
                    >
                      Add endpoint
                    </button>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 0.75rem', fontWeight: 600, fontSize: '0.9rem' }}>Apps & menus</p>
                    <div className="admin-internal-tabs">
                      {APP_SLUGS.map((appSlug) => (
                        <button
                          key={appSlug}
                          type="button"
                          className={form.appTab === appSlug ? 'active' : ''}
                          onClick={() => setForm((f) => ({ ...f, appTab: appSlug }))}
                          aria-pressed={form.appTab === appSlug}
                        >
                          {APP_LABELS[appSlug] || appSlug}
                          <span style={{ marginLeft: '0.5rem', opacity: 0.9, fontSize: '0.8rem' }}>
                            ({(form.appMenus[appSlug] || []).length})
                          </span>
                        </button>
                      ))}
                    </div>
                    {form.appTab ? (
                      <div className="admin-menu-grid" style={{ marginTop: '0.75rem' }}>
                        {(menuCatalog[form.appTab] || []).map((m) => (
                          <label key={m.id} className="admin-menu-item">
                            <input
                              type="checkbox"
                              checked={(form.appMenus[form.appTab] || []).includes(m.id)}
                              onChange={() => toggleMenu(form.appTab, m.id)}
                            />
                            <span>
                              {m.label} <span className="admin-meta">({m.sectionLabel})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <FormField label="Client ID (API key)">
                    <input
                      className="form-inp"
                      value={form.clientId}
                      onChange={(ev) => setForm((f) => ({ ...f, clientId: ev.target.value }))}
                      required={mode === 'add'}
                      placeholder={mode === 'edit' ? 'Leave blank to keep current' : ''}
                    />
                  </FormField>
                  <FormField label="Client secret">
                    <input
                      className="form-inp"
                      type="password"
                      value={form.clientSecret}
                      onChange={(ev) => setForm((f) => ({ ...f, clientSecret: ev.target.value }))}
                      required={mode === 'add'}
                      placeholder={mode === 'edit' ? 'Leave blank to keep current' : ''}
                      autoComplete="new-password"
                    />
                  </FormField>
                  <p className="admin-muted" style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.4 }}>
                    {integrationOAuthEnvHint(
                      mode === 'edit' && editingSlug ? editingSlug : slugFromIntegrationName(form.name || 'integration'),
                    )}
                  </p>
                  <FormField label="Active">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.status === 'active'}
                        className={`admin-switch${form.status === 'active' ? ' admin-switch--on' : ''}`}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            status: f.status === 'active' ? 'disabled' : 'active',
                          }))
                        }
                      />
                      <span className="admin-muted" style={{ fontSize: '0.875rem' }}>
                        {form.status === 'active' ? 'Enabled for organizations' : 'Disabled'}
                      </span>
                    </div>
                  </FormField>
                </form>
              </div>
              <div className="modal-foot">
                {mode === 'edit' ? (
                  <button type="button" className="btn btn-sm btn-red" onClick={() => void deleteIntegration()} disabled={saving}>
                    {saving ? 'Deleting…' : deleteConfirm ? 'Confirm delete?' : 'Delete'}
                  </button>
                ) : null}
                <div className="modal-foot-l" />
                <button type="button" className="btn btn-sm btn-cancel" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="submit"
                  form="admin-integration-form"
                  className="btn btn-sm btn-green"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : mode === 'add' ? 'Create' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
