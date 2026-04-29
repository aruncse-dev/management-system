import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Plus, Repeat2, Search, BarChart3, Bell, IndianRupee } from 'lucide-react'
import { api, type RawSubscriptionRow, type RawVaultAppRow, type GoldSettings } from '../api'
import { FormField, ModalActions, ModalShell, SearchField, SectionBlock, Spacer, UiPill, KpiCard, KpiGrid } from '../ui'
import { INR } from '../utils'
import { CATEGORIES, ALL_MODES } from '../constants'

type SubscriptionFormState = {
  name: string
  category: string
  amount: string
  currency: string
  billing_cycle: string
  start_date: string
  autopay: boolean
  status: string
  payment_method: string
  app_uuid: string
  notes: string
}

type SubscriptionEntry = {
  id: string
  name: string
  category: string
  amount: number
  currency: string
  billing_cycle: string
  start_date: string
  end_date: string
  autopay: boolean
  status: string
  payment_method: string
  app_uuid: string
  notes: string
  updated_at: string
}

const EMPTY_FORM: SubscriptionFormState = {
  name: '',
  category: '',
  amount: '',
  currency: 'INR',
  billing_cycle: 'monthly',
  start_date: '',
  autopay: true,
  status: 'active',
  payment_method: '',
  app_uuid: '',
  notes: '',
}

function toDateInput(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const dt = new Date(raw)
  if (!Number.isNaN(dt.getTime())) {
    const y = String(dt.getFullYear()).padStart(4, '0')
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return ''
}

function parseDate(value: string) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const dt = new Date(raw)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function addCycle(date: Date, cycle: string) {
  const next = new Date(date.getTime())
  if (cycle === 'yearly') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1)
  return next
}

function toIsoDate(date: Date) {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function resolveNextRenewal(row: SubscriptionEntry, now = new Date()) {
  const cycle = row.billing_cycle.trim().toLowerCase()
  const start = parseDate(row.start_date)
  if (!start) return null
  let next = parseDate(row.end_date) || addCycle(start, cycle)
  while (next < now) {
    next = addCycle(next, cycle)
  }
  return next
}

function daysUntil(date: Date, now = new Date()) {
  const ms = date.getTime() - now.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function amountLabel(amount: number, currency: string) {
  const c = currency.trim().toUpperCase()
  if (c === 'USD') return `$${amount.toFixed(2)}`
  return INR(amount)
}

function normalizeRow(row: RawSubscriptionRow): SubscriptionEntry {
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    category: String(row.category || ''),
    amount: Number(row.amount) || 0,
    currency: String(row.currency || '') || 'INR',
    billing_cycle: String(row.billing_cycle || '') || 'monthly',
    start_date: toDateInput(String(row.start_date || '')),
    end_date: toDateInput(String(row.end_date || '')),
    autopay: row.autopay === true || String(row.autopay || '').toLowerCase() === 'true',
    status: String(row.status || '') || 'active',
    payment_method: String(row.payment_method || ''),
    app_uuid: String(row.app_uuid || ''),
    notes: String(row.notes || ''),
    updated_at: String(row.updated_at || ''),
  }
}

export default function SubscriptionsPage() {
  const [rows, setRows] = useState<SubscriptionEntry[]>([])
  const [apps, setApps] = useState<RawVaultAppRow[]>([])
  const [usdToInr, setUsdToInr] = useState(85)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'subscriptions'>('dashboard')
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState<SubscriptionFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState('')
  const [deleteName, setDeleteName] = useState('')
  const [toast, setToast] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [subscriptionRows, appRows, settings] = await Promise.all([
        api.getSubscriptionEntries(),
        api.getApps().catch(() => [] as RawVaultAppRow[]),
        api.getSettings().catch(() => ({} as GoldSettings)),
      ])
      setRows(subscriptionRows.map(normalizeRow))
      setApps(appRows)
      setUsdToInr(settings.usdToInr || 85)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row => [
      row.name,
      row.category,
      row.billing_cycle,
      row.status,
      row.payment_method,
      row.notes,
      apps.find(app => app.app_uuid === row.app_uuid)?.app_name || '',
    ].join(' ').toLowerCase().includes(q))
  }, [rows, search, apps])

  const monthlyINR = useMemo(() =>
    rows.reduce((sum, row) => {
      const cycle = row.billing_cycle.trim().toLowerCase()
      const monthly = cycle === 'yearly' ? row.amount / 12 : row.amount
      const inr = (row.currency || 'INR').toUpperCase() === 'USD' ? monthly * usdToInr : monthly
      return sum + inr
    }, 0), [rows, usdToInr])

  const yearlyINR = useMemo(() =>
    rows.reduce((sum, row) => {
      const cycle = row.billing_cycle.trim().toLowerCase()
      const yearly = cycle === 'yearly' ? row.amount : row.amount * 12
      const inr = (row.currency || 'INR').toUpperCase() === 'USD' ? yearly * usdToInr : yearly
      return sum + inr
    }, 0), [rows, usdToInr])

  const dueSoonRows = useMemo(() => {
    const now = new Date()
    return rows
      .filter(row => row.status.trim().toLowerCase() === 'active')
      .map(row => ({ row, date: resolveNextRenewal(row, now) }))
      .filter(item => item.date !== null && daysUntil(item.date as Date, now) >= 0 && daysUntil(item.date as Date, now) <= 5)
      .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime()) as Array<{ row: SubscriptionEntry; date: Date }>
  }, [rows])

  const startAdd = () => {
    setMode('add')
    setEditingId('')
    setForm(EMPTY_FORM)
  }

  const startEdit = (row: SubscriptionEntry) => {
    setMode('edit')
    setEditingId(row.id)
    setForm({
      name: row.name,
      category: row.category,
      amount: String(row.amount || ''),
      currency: row.currency || 'INR',
      billing_cycle: row.billing_cycle || 'monthly',
      start_date: row.start_date || '',
      autopay: row.autopay,
      status: row.status || 'active',
      payment_method: row.payment_method,
      app_uuid: row.app_uuid,
      notes: row.notes,
    })
  }

  const closeForm = () => {
    setMode(null)
    setEditingId('')
    setForm(EMPTY_FORM)
  }

  const save = async () => {
    if (!form.name.trim()) {
      setError('name is required')
      return
    }
    if (!form.amount.trim() || Number(form.amount) <= 0) {
      setError('amount must be greater than 0')
      return
    }
    if (!form.start_date.trim()) {
      setError('start_date is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        amount: Number(form.amount),
        currency: form.currency.trim() || 'INR',
        billing_cycle: form.billing_cycle.trim().toLowerCase() || 'monthly',
        start_date: form.start_date.trim(),
        autopay: form.autopay,
        status: form.status.trim().toLowerCase() || 'active',
        payment_method: form.payment_method.trim(),
        app_uuid: form.app_uuid.trim(),
        notes: form.notes.trim(),
      }
      if (mode === 'edit') {
        await api.updateSubscriptionEntry({ ...payload, id: editingId })
      } else {
        await api.addSubscriptionEntry(payload)
      }
      await load()
      closeForm()
      setToast('Subscription saved')
      window.setTimeout(() => setToast(''), 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const openDeleteModal = (id: string, name: string) => {
    setDeleteId(id)
    setDeleteName(name)
    setDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setDeleteId('')
    setDeleteName('')
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setSaving(true)
    setError('')
    const deletingId = deleteId
    try {
      await api.deleteSubscriptionEntry(deletingId)
      setRows(prev => prev.filter(row => row.id !== deletingId))
      await load()
      setToast('Subscription deleted')
      window.setTimeout(() => setToast(''), 1400)
      closeDeleteModal()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ui-kit-page-shell subscriptions-page">
      <nav className="bottom-nav">
        <button
          type="button"
          className={`bottom-nav-item${tab === 'dashboard' ? ' active' : ''}`}
          onClick={() => setTab('dashboard')}
        >
          <span className="bottom-nav-icon"><BarChart3 size={19} /></span>
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item${tab === 'subscriptions' ? ' active' : ''}`}
          onClick={() => setTab('subscriptions')}
        >
          <span className="bottom-nav-icon"><Repeat2 size={19} /></span>
          <span>Subscriptions</span>
        </button>
      </nav>

      <div className="pg subscriptions-page">

      {error && <div className="settings-alert">⚠ {error}</div>}

      {tab === 'dashboard' && (
        <>
          {loading ? (
            <div className="ui-kit-loading ui-kit-loading--page">Loading…</div>
          ) : (
            <>
              <SectionBlock title="Overview" icon={<BarChart3 size={16} />}>
                <KpiGrid variant="dash">
                  <KpiCard label="Total Subscriptions" value={rows.length} tone="navy" icon={<Repeat2 size={16} />} />
                  <KpiCard label="Monthly (INR)" value={INR(monthlyINR)} tone="blue" icon={<IndianRupee size={16} />} subtitle={`1 USD = ₹${usdToInr.toFixed(0)}`} />
                  <KpiCard label="Yearly (INR)" value={INR(yearlyINR)} tone="navy" icon={<IndianRupee size={16} />} />
                  <KpiCard label="Due in 5 Days" value={dueSoonRows.length} tone={dueSoonRows.length > 0 ? 'red' : 'green'} icon={<Bell size={16} />} />
                </KpiGrid>
              </SectionBlock>
              <Spacer size={12} />

              {dueSoonRows.length > 0 && (
                <>
                  <SectionBlock title="Due Soon" icon={<Bell size={16} />}>
                    <div className="ui-stack">
                      {dueSoonRows.map(({ row, date }) => {
                        const linkedApp = apps.find(app => app.app_uuid === row.app_uuid)
                        const daysLeft = daysUntil(date, new Date())
                        return (
                          <button
                            key={row.id}
                            type="button"
                            className="ui-kit-holding-card ui-kit-holding-card--btn ui-kit-holding-card--accent-red"
                            onClick={() => startEdit(row)}
                            style={{ textAlign: 'left' }}
                          >
                            <div className="ui-kit-holding-card-head">
                              <div>
                                <div className="ui-kit-holding-card-title">
                                  <span>{row.name || 'Untitled Subscription'}</span>
                                </div>
                                <div className="ui-kit-holding-card-subtitle">
                                  {row.category || 'Subscription'} {linkedApp ? `· ${linkedApp.app_name}` : ''}
                                </div>
                              </div>
                              <div className="ui-kit-holding-card-head-right">
                                <span className="ui-pill ui-tone-red">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            <div className="ui-kit-holding-card-grid">
                              <div className="ui-kit-holding-stat">
                                <span>Amount</span>
                                <strong>{amountLabel(row.amount || 0, row.currency)}</strong>
                              </div>
                              <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
                                <span>Due Date</span>
                                <strong>{toIsoDate(date)}</strong>
                              </div>
                              <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
                                <span>Cycle</span>
                                <strong>{row.billing_cycle || '-'}</strong>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </SectionBlock>
                  <Spacer size={12} />
                </>
              )}
            </>
          )}
        </>
      )}

      {tab === 'subscriptions' && (
        <>
          {loading ? (
            <div className="ui-kit-loading ui-kit-loading--page">Loading…</div>
          ) : (
            <>
              <SectionBlock
                title="All Subscriptions"
                icon={<Repeat2 size={16} />}
                right={<UiPill tone="navy">{rows.length}</UiPill>}
              >
                <div className="ui-stack">
                  <SearchField
                    value={search}
                    placeholder="Search subscriptions..."
                    onChange={setSearch}
                    onClear={() => setSearch('')}
                    prefix={<Search size={14} />}
                  />
                </div>
              </SectionBlock>
              <Spacer size={12} />

              <div className="ui-stack">
                {filteredRows.length === 0 ? (
                  <div style={{ padding: '18px 14px', color: 'var(--muted)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                    No subscriptions found. Add one with the plus button.
                  </div>
                ) : (
                  filteredRows.map(row => {
                    const linkedApp = apps.find(app => app.app_uuid === row.app_uuid)
                    const nextRenewalDate = resolveNextRenewal(row)
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className="ui-kit-holding-card ui-kit-holding-card--btn ui-kit-holding-card--accent-navy"
                        onClick={() => startEdit(row)}
                        style={{ textAlign: 'left' }}
                      >
                        <div className="ui-kit-holding-card-head">
                          <div>
                            <div className="ui-kit-holding-card-title">
                              <span>{row.name || 'Untitled Subscription'}</span>
                            </div>
                            <div className="ui-kit-holding-card-subtitle">
                              {row.category || 'Subscription'} {linkedApp ? `· ${linkedApp.app_name}` : ''}
                            </div>
                          </div>
                          <div className="ui-kit-holding-card-head-right">
                            <span className="ui-pill ui-tone-green">Active</span>
                          </div>
                        </div>
                        <div className="ui-kit-holding-card-grid">
                          <div className="ui-kit-holding-stat">
                            <span>Amount</span>
                            <strong>{amountLabel(row.amount || 0, row.currency)}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
                            <span>Start</span>
                            <strong>{row.start_date || '-'}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
                            <span>Renewal</span>
                            <strong>{nextRenewalDate ? toIsoDate(nextRenewalDate) : '-'}</strong>
                          </div>
                        </div>
                        <div className="ui-kit-holding-card-grid">
                          <div className="ui-kit-holding-stat">
                            <span>Cycle</span>
                            <strong>{row.billing_cycle || '-'}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
                            <span>End Date</span>
                            <strong>{row.end_date || '-'}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
                            <span>Auto Renew</span>
                            <strong>{row.autopay ? 'Yes' : 'No'}</strong>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </>
          )}
        </>
      )}

      <button
        type="button"
        className="ui-kit-btn ui-kit-btn--solid"
        onClick={startAdd}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 120,
          borderRadius: 999,
          minWidth: 0,
          width: 56,
          height: 56,
          padding: 0,
          boxShadow: '0 16px 32px rgba(30, 92, 199, .24)',
        }}
        aria-label="Add subscription"
        title="Add subscription"
      >
        <Plus size={20} />
      </button>

      {mode && (
        <ModalShell
          title={mode === 'add' ? 'Add Subscription' : 'Edit Subscription'}
          onClose={closeForm}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={mode === 'add' ? 'Add' : 'Save'}
              onSecondary={closeForm}
              onPrimary={save}
              leading={mode === 'edit' ? <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => openDeleteModal(editingId, form.name)} disabled={saving}>Delete</button> : null}
              disabled={saving}
            />
          }
        >
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: 12 }}>
            <FormField label="Name">
              <input className="form-inp" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </FormField>
            <FormField label="Category">
              <select className="form-inp" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">— Select —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Amount">
              <input className="form-inp" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
            <FormField label="Currency">
              <select className="form-inp" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="INR">INR — Indian Rupee</option>
                <option value="USD">USD — US Dollar</option>
              </select>
            </FormField>
            <FormField label="Billing Cycle">
              <select className="form-inp" value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
              </select>
            </FormField>
            <FormField label="Start Date">
              <input className="form-inp" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </FormField>
            <FormField label="Payment Method">
              <select className="form-inp" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                <option value="">— Select —</option>
                {ALL_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </FormField>
            <FormField label="Linked App">
              <select className="form-inp" value={form.app_uuid} onChange={e => setForm(f => ({ ...f, app_uuid: e.target.value }))}>
                <option value="">None</option>
                {apps.map(app => (
                  <option key={app.app_uuid} value={app.app_uuid}>{app.app_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Notes">
              <textarea className="form-inp" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
            <FormField label="AutoPay">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                <input type="checkbox" checked={form.autopay} onChange={e => setForm(f => ({ ...f, autopay: e.target.checked }))} />
                Enabled
              </label>
            </FormField>
          </form>
        </ModalShell>
      )}

      {deleteModalOpen && (
        <ModalShell
          title="Delete Subscription"
          onClose={closeDeleteModal}
          footer={
            <ModalActions
              primaryLabel="Delete"
              secondaryLabel="Cancel"
              destructive
              onPrimary={confirmDelete}
              onSecondary={closeDeleteModal}
              disabled={saving}
            />
          }
        >
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
            Delete <strong>{deleteName}</strong>?
          </div>
        </ModalShell>
      )}

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 500, background: '#ECFDF5', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 999, padding: '10px 14px', fontSize: 12, fontWeight: 700, boxShadow: '0 12px 28px rgba(22, 101, 52, .14)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} />
          <span>{toast}</span>
        </div>
      )}
      </div>
    </div>
  )
}
