import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Plus, Repeat2, Search, BarChart3, Bell, CalendarClock, Clock, DollarSign, IndianRupee, Landmark } from 'lucide-react'
import { api, type RawSubscriptionChargeRow, type RawSubscriptionRow, type RawVaultAppRow, type GoldSettings } from '../api'
import { CatIcon, FilterChips, FormField, HoldingCard, InfoCallout, LoadingState, ModalActions, ModalShell, SearchField, SectionBlock, SectionChip, Spacer, KpiCard, KpiGrid } from '../ui'
import { mergeCategoriesWithBudgetNames } from '../utils'
import { isMirroredRow, MIRRORED_ROW_NOTE } from '../lib/mirroredRows'
import { useMoneyFormatting } from '../hooks/useFormatMoney'
import {
  currencySymbol,
  type SupportedCurrency,
  BILLING_CYCLES,
  DEFAULT_USD_TO_INR,
  daysUntil,
  nextRenewal,
  normalizeToMonthly,
} from '@fintracker-vault/utils'
import { CATEGORIES } from '../constants'
import { useStore } from '../store'
import { useFintrackerModes } from '../context/FintrackerModesContext'

type SubscriptionFormState = {
  name: string
  category: string
  amount: string
  currency: string
  billing_cycle: string
  start_date: string
  end_date: string
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
  end_date: '',
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

/**
 * Next billing date for a row.
 *
 * The math lives in `@fintracker-vault/utils` so this page, the `/overview`
 * summary and the MCP server cannot drift apart again.
 */
function resolveNextRenewal(row: SubscriptionEntry, now = new Date()) {
  return nextRenewal({
    startDate: row.start_date,
    endDate: row.end_date || null,
    cycle: row.billing_cycle,
    autopay: row.autopay,
    now,
  })
}

function toIsoDate(date: Date) {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toShortDate(date: Date) {
  const d = String(date.getDate()).padStart(2, '0')
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()]
  return `${d} ${mon}`
}

/** Autopay alert card: ≤7d red, 8–14d amber, else green. */
function autopayAlertTone(daysLeft: number): 'red' | 'amber' | 'green' {
  if (daysLeft <= 7) return 'red'
  if (daysLeft <= 14) return 'amber'
  return 'green'
}

function amountLabel(amount: number, currency: string, roundOff = true) {
  const c = (currency || 'INR').trim().toUpperCase()
  const abs = Math.abs(amount)
  const symbol =
    c === 'INR' || c === 'USD' || c === 'AED' ? currencySymbol(c as SupportedCurrency) : currencySymbol('INR')
  const fractionDigits = roundOff ? 0 : 2
  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
  return `${symbol}${formatted}`
}

function currencyKpiIcon(code: SupportedCurrency) {
  if (code === 'USD') return <DollarSign size={16} aria-hidden />
  if (code === 'AED') return <Landmark size={16} aria-hidden />
  return <IndianRupee size={16} aria-hidden />
}

/**
 * Row amount in rupees.
 *
 * Only USD has a stored rate (`settings.usdToInr`), so only USD is converted
 * and the currency select offers only the two it can price. Any other currency
 * already on a row is taken at 1:1 rather than dropped.
 */
function rowAmountInr(row: SubscriptionEntry, usdToInr: number): number {
  const amt = Number(row.amount) || 0
  return (row.currency || 'INR').trim().toUpperCase() === 'USD' ? amt * usdToInr : amt
}

const AUTOPAY_ALERT_DAYS = 30

/** `yyyy-mm`, so lexical order is chronological. */
function monthGroupKey(dateStr: string): string {
  const d = parseDate(dateStr)
  if (!d) return '0000-00'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthGroupLabel(dateStr: string): string {
  const d = parseDate(dateStr)
  if (!d) return 'Undated'
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]
  return `${m} ${d.getFullYear()}`
}

const SUBSCRIPTION_STATUSES = ['active', 'cancelled'] as const

type SubscriptionTab = 'dashboard' | 'subscriptions' | 'charges'

type SubscriptionStatusFilter = 'active' | 'all' | 'cancelled'

/**
 * Status chips, mirroring `LoanListFilterBar` on the loans page.
 *
 * Defaults to Active for the same reason loans does: opening on All buries the
 * plans you are actually paying for under the ones you have cancelled.
 */
function SubscriptionStatusFilterBar({
  value,
  onChange,
  activeCount,
  cancelledCount,
  totalCount,
}: {
  value: SubscriptionStatusFilter
  onChange: (next: SubscriptionStatusFilter) => void
  activeCount: number
  cancelledCount: number
  totalCount: number
}) {
  const options: { id: SubscriptionStatusFilter; label: string }[] = [
    { id: 'active', label: `Active (${activeCount})` },
    { id: 'all', label: `All (${totalCount})` },
    { id: 'cancelled', label: `Cancelled (${cancelledCount})` },
  ]
  const activeLabel = options.find(o => o.id === value)?.label ?? options[0].label
  return (
    <FilterChips
      items={options.map(o => o.label)}
      active={activeLabel}
      onChange={label => {
        const next = options.find(o => o.label === label)?.id
        if (next) onChange(next)
      }}
    />
  )
}

/** The one definition of "active", matching the `status = 'active'` filter the summary endpoint uses. */
function isActive(row: SubscriptionEntry): boolean {
  return row.status.trim().toLowerCase() === 'active'
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
  const { state: appState } = useStore()
  const { format: fmt, currency: displayCurrency } = useMoneyFormatting()
  const { paymentModeOptions } = useFintrackerModes()
  const subscriptionCategories = useMemo(
    () => mergeCategoriesWithBudgetNames(CATEGORIES, appState.budget),
    [appState.budget],
  )
  const [rows, setRows] = useState<SubscriptionEntry[]>([])
  const [apps, setApps] = useState<RawVaultAppRow[]>([])
  const [usdToInr, setUsdToInr] = useState(DEFAULT_USD_TO_INR)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatusFilter>('active')
  const [tab, setTab] = useState<SubscriptionTab>('dashboard')
  const [chargeSearch, setChargeSearch] = useState('')
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState<SubscriptionFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  /** Modal-scoped: the page-level `error` renders behind an open modal. */
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')
  const [charges, setCharges] = useState<RawSubscriptionChargeRow[]>([])
  /** Non-fatal: the rest of the page still renders without charges. */
  const [chargesError, setChargesError] = useState('')

  /**
   * Most recent charge per subscription.
   *
   * Until now a renewal left no trace here at all — it was typed into the
   * register and this page kept showing the same start date forever, so there
   * was no way to tell a live subscription from one that quietly stopped
   * charging. Rows arrive newest-first, so the first hit per id wins.
   */
  const lastChargeBySub = useMemo(() => {
    const map = new Map<string, RawSubscriptionChargeRow>()
    for (const c of charges) if (!map.has(c.subscription_id)) map.set(c.subscription_id, c)
    return map
  }, [charges])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [subscriptionRows, appRows, settings, chargeRows] = await Promise.all([
        api.getSubscriptionEntries(),
        api.getApps().catch(() => [] as RawVaultAppRow[]),
        api.getSettings().catch(() => ({} as GoldSettings)),
        // Tolerated so a charge-read failure cannot blank the whole page, but
        // recorded: silently showing an empty list would read as "never
        // charged" when it actually means the read failed.
        api
          .getSubscriptionCharges()
          .then(r => ({ rows: r, failed: false }))
          .catch((e: unknown) => ({
            rows: [] as RawSubscriptionChargeRow[],
            failed: true,
            message: e instanceof Error ? e.message : 'Could not load charges',
          })),
      ])
      setRows(subscriptionRows.map(normalizeRow))
      setCharges(chargeRows.rows)
      setChargesError(
        chargeRows.failed ? ('message' in chargeRows ? String(chargeRows.message) : 'Could not load charges') : '',
      )
      setApps(appRows)
      setUsdToInr(settings.usdToInr || DEFAULT_USD_TO_INR)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const statusScopedRows = useMemo(() => {
    if (statusFilter === 'all') return rows
    if (statusFilter === 'cancelled') return rows.filter(r => !isActive(r))
    return rows.filter(isActive)
  }, [rows, statusFilter])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return statusScopedRows
    return statusScopedRows.filter(row => [
      row.name,
      row.category,
      row.billing_cycle,
      row.status,
      row.payment_method,
      row.notes,
      apps.find(app => app.app_uuid === row.app_uuid)?.app_name || '',
    ].join(' ').toLowerCase().includes(q))
  }, [statusScopedRows, search, apps])

  const activeRows = useMemo(() => rows.filter(isActive), [rows])
  const cancelledCount = rows.length - activeRows.length

  /**
   * What the active plans actually cost per month.
   *
   * Every cycle is normalised, so a yearly plan contributes a twelfth rather
   * than nothing, and cancelled plans are excluded. This is the same figure
   * `/overview` shows under "Subscriptions" — before, the two disagreed on
   * both counts.
   */
  const monthlyRunRateINR = useMemo(
    () =>
      activeRows.reduce(
        (sum, r) => sum + normalizeToMonthly(rowAmountInr(r, usdToInr), r.billing_cycle),
        0,
      ),
    [activeRows, usdToInr],
  )

  const annualOutlookINR = useMemo(() => monthlyRunRateINR * 12, [monthlyRunRateINR])

  /** Monthly-equivalent split by cycle, so the run-rate can be read back. */
  const runRateByCycle = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const r of activeRows) {
      const key = r.billing_cycle.trim().toLowerCase()
      acc[key] = (acc[key] || 0) + normalizeToMonthly(rowAmountInr(r, usdToInr), r.billing_cycle)
    }
    return acc
  }, [activeRows, usdToInr])

  /**
   * Plans whose cycle nothing can price.
   *
   * `normalizeToMonthly` returns 0 for an unrecognised cycle rather than
   * guessing monthly, so these would silently vanish from the totals. Surface
   * them instead of quietly under-reporting.
   */
  const unpricedRows = useMemo(
    () => activeRows.filter(r => !(BILLING_CYCLES as readonly string[]).includes(r.billing_cycle.trim().toLowerCase())),
    [activeRows],
  )

  /** Charges joined to their subscription so the list can show a name, not an id. */
  const chargeRows = useMemo(() => {
    const nameById = new Map(rows.map(r => [r.id, r.name]))
    return charges
      .map(c => ({
        id: String(c.id),
        subscriptionId: String(c.subscription_id),
        name: nameById.get(String(c.subscription_id)) || 'Unknown subscription',
        date: String(c.date || ''),
        amount: Number(c.amount) || 0,
        note: String(c.note || ''),
        mirrored: isMirroredRow(String(c.id)),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [charges, rows])

  const filteredCharges = useMemo(() => {
    const q = chargeSearch.trim().toLowerCase()
    if (!q) return chargeRows
    return chargeRows.filter(c =>
      [c.name, c.note, c.date, String(c.amount)].join(' ').toLowerCase().includes(q),
    )
  }, [chargeRows, chargeSearch])

  /** Charges bucketed by month, newest first, with the per-month total. */
  const chargesByMonth = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; rows: typeof filteredCharges; total: number }>()
    for (const row of filteredCharges) {
      const key = monthGroupKey(row.date)
      let group = groups.get(key)
      if (!group) {
        group = { key, label: monthGroupLabel(row.date), rows: [], total: 0 }
        groups.set(key, group)
      }
      group.rows.push(row)
      group.total += row.amount
    }
    return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key))
  }, [filteredCharges])

  /**
   * The next charge for every active plan, soonest first.
   *
   * One list feeds both the autopay alerts and the dashboard figures, so the
   * "next renewal" card and the alert row below it can never name different
   * dates for the same plan.
   */
  const upcomingCharges = useMemo(() => {
    const now = new Date()
    type ChargeItem = { row: SubscriptionEntry; date: Date; daysLeft: number; amountInr: number }
    return activeRows
      .map((row): ChargeItem | null => {
        const date = resolveNextRenewal(row, now)
        if (!date) return null
        const daysLeft = daysUntil(date, now)
        if (daysLeft < 0) return null
        return { row, date, daysLeft, amountInr: rowAmountInr(row, usdToInr) }
      })
      .filter((item): item is ChargeItem => item !== null)
      .sort(
        (a, b) => a.date.getTime() - b.date.getTime() || a.row.name.localeCompare(b.row.name),
      )
  }, [activeRows, usdToInr])

  /**
   * Cash actually leaving in the next 30 days.
   *
   * Distinct from the run-rate above, which is smoothed: a yearly plan renewing
   * next week costs its whole price then, not a twelfth of it.
   */
  const dueSoonTotal = useMemo(
    () =>
      upcomingCharges
        .filter(c => c.daysLeft <= AUTOPAY_ALERT_DAYS)
        .reduce((sum, c) => sum + c.amountInr, 0),
    [upcomingCharges],
  )

  const nextCharge = upcomingCharges[0] ?? null

  /** Charges that a delete would take with it — deleting a plan is not reversible. */
  const editingChargeCount = useMemo(
    () => (editingId ? charges.filter(c => String(c.subscription_id) === editingId).length : 0),
    [charges, editingId],
  )

  const autopayRenewalAlerts = useMemo(
    () => upcomingCharges.filter(c => c.row.autopay && c.daysLeft <= AUTOPAY_ALERT_DAYS),
    [upcomingCharges],
  )

  const startAdd = () => {
    setMode('add')
    setEditingId('')
    setForm(EMPTY_FORM)
    setDeleteConfirm(false)
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
      end_date: row.end_date || '',
      autopay: row.autopay,
      status: row.status || 'active',
      payment_method: row.payment_method,
      app_uuid: row.app_uuid,
      notes: row.notes,
    })
    setDeleteConfirm(false)
    setFormError('')
  }

  const closeForm = () => {
    setMode(null)
    setEditingId('')
    setForm(EMPTY_FORM)
    setDeleteConfirm(false)
    setFormError('')
  }

  const save = async () => {
    if (saving) return
    setFormError('')
    if (!form.name.trim()) {
      setFormError('Enter a subscription name.')
      return
    }
    const amount = Number(form.amount)
    if (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter an amount greater than 0.')
      return
    }
    if (!form.start_date.trim()) {
      setFormError('Pick a start date.')
      return
    }
    if (form.end_date.trim() && form.end_date.trim() < form.start_date.trim()) {
      setFormError('End date cannot be before the start date.')
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
        end_date: form.end_date.trim(),
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
      setFormError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    if (!editingId) return
    setSaving(true)
    setError('')
    const deletingId = editingId
    try {
      await api.deleteSubscriptionEntry(deletingId)
      setRows(prev => prev.filter(row => row.id !== deletingId))
      await load()
      setToast('Subscription deleted')
      window.setTimeout(() => setToast(''), 1400)
      closeForm()
    } catch (e) {
      // Reset the confirm so a failed delete does not leave the button armed.
      setDeleteConfirm(false)
      setFormError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ui-kit-page-shell">
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
        <button
          type="button"
          className={`bottom-nav-item${tab === 'charges' ? ' active' : ''}`}
          onClick={() => setTab('charges')}
        >
          <span className="bottom-nav-icon"><Clock size={19} /></span>
          <span>Charges</span>
        </button>
      </nav>

      <div className="pg subscriptions-page">

      {error && <div className="settings-alert">⚠ {error}</div>}

      {tab === 'dashboard' && (
        <>
          <SectionBlock
            title="Summary"
            icon={<BarChart3 size={16} />}
            right={loading ? <LoadingState variant="inline" /> : null}
          >
            <KpiCard
              full
              label="Monthly run-rate"
              value={loading ? '—' : fmt(monthlyRunRateINR)}
              tone="navy"
              icon={currencyKpiIcon(displayCurrency)}
              subtitle={
                loading
                  ? undefined
                  : `${activeRows.length} active plan${activeRows.length === 1 ? '' : 's'}${
                      cancelledCount ? ` · ${cancelledCount} cancelled` : ''
                    }`
              }
            />
            <Spacer size={10} />
            <KpiGrid variant="dash">
              <KpiCard
                label="Annual outlook"
                value={loading ? '—' : fmt(annualOutlookINR)}
                tone="navy"
                icon={currencyKpiIcon(displayCurrency)}
                subtitle="Run-rate × 12"
              />
              <KpiCard
                label="Active plans"
                value={loading ? '—' : activeRows.length}
                tone="muted"
                icon={<Repeat2 size={16} />}
                subtitle={cancelledCount ? `${cancelledCount} cancelled` : 'None cancelled'}
              />
              <KpiCard
                label="Due in 30 days"
                value={loading ? '—' : fmt(dueSoonTotal)}
                tone="muted"
                accentTone={dueSoonTotal > monthlyRunRateINR ? 'red' : undefined}
                icon={currencyKpiIcon(displayCurrency)}
                subtitle={
                  loading
                    ? undefined
                    : `${autopayRenewalAlerts.length || upcomingCharges.filter(c => c.daysLeft <= AUTOPAY_ALERT_DAYS).length} charge${
                        upcomingCharges.filter(c => c.daysLeft <= AUTOPAY_ALERT_DAYS).length === 1 ? '' : 's'
                      } coming`
                }
              />
              <KpiCard
                label="Next renewal"
                value={loading ? '—' : nextCharge ? toShortDate(nextCharge.date) : '—'}
                tone="muted"
                icon={<CalendarClock size={16} />}
                subtitle={
                  loading
                    ? undefined
                    : nextCharge
                      ? `${nextCharge.row.name} · ${nextCharge.daysLeft === 0 ? 'today' : `${nextCharge.daysLeft}d`}`
                      : 'Nothing scheduled'
                }
              />
            </KpiGrid>
            {!loading && unpricedRows.length > 0 ? (
              <>
                <Spacer size={10} />
                <InfoCallout title="Not counted in the run-rate" tone="amber">
                  {unpricedRows.length} plan{unpricedRows.length === 1 ? ' has' : 's have'} an
                  unrecognised billing cycle ({unpricedRows.map(r => r.billing_cycle).filter(Boolean).join(', ') || '—'}).
                  Edit {unpricedRows.length === 1 ? 'it' : 'them'} to a supported cycle to include{' '}
                  {unpricedRows.length === 1 ? 'it' : 'them'}.
                </InfoCallout>
              </>
            ) : null}
          </SectionBlock>
          <Spacer size={12} />

          {!loading && autopayRenewalAlerts.length > 0 && (
            <>
              <SectionBlock
                title="Autopay alerts"
                icon={<Bell size={16} />}
                right={<SectionChip>{autopayRenewalAlerts.length}</SectionChip>}
              >
                <div className="ui-stack">
                  {autopayRenewalAlerts.map(({ row, date, daysLeft }) => {
                    const tone = autopayAlertTone(daysLeft)
                    const pillTone = tone === 'amber' ? 'ui-tone-amber' : tone === 'red' ? 'ui-tone-red' : 'ui-tone-green'
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className="ui-kit-holding-card ui-kit-holding-card--btn"
                        onClick={() => startEdit(row)}
                        style={{ textAlign: 'left', padding: '10px 12px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--text)',
                              minWidth: 0,
                              flex: 1,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {row.name || 'Untitled'} · {toShortDate(date)} · {amountLabel(row.amount || 0, row.currency, appState.roundOff)}
                          </span>
                          <span className={`ui-pill ${pillTone}`}>{daysLeft}d</span>
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

      {tab === 'subscriptions' && (
        <>
          <SectionBlock
            title="All Subscriptions"
            icon={<Repeat2 size={16} />}
            right={loading ? <LoadingState variant="inline" /> : <SectionChip>{filteredRows.length}</SectionChip>}
          >
            <div className="ui-stack">
              <SearchField
                value={search}
                placeholder="Search subscriptions…"
                onChange={setSearch}
                onClear={() => setSearch('')}
                prefix={<Search size={14} />}
              />
              <SubscriptionStatusFilterBar
                value={statusFilter}
                onChange={setStatusFilter}
                activeCount={activeRows.length}
                cancelledCount={cancelledCount}
                totalCount={rows.length}
              />
            </div>
          </SectionBlock>
          <Spacer size={12} />

          {loading && <LoadingState variant="section" />}

          {!loading && filteredRows.length === 0 && (
            <div className="gold-empty">
              <Repeat2 size={28} />
              <p>
                {search || statusFilter !== 'all'
                  ? 'No subscriptions match those filters.'
                  : 'No subscriptions yet. Tap + to add one.'}
              </p>
            </div>
          )}

          {!loading && filteredRows.length > 0 && (
            <div className="ui-stack">
              {filteredRows.map(row => {
                const linkedApp = apps.find(app => app.app_uuid === row.app_uuid)
                const nextRenewalDate = resolveNextRenewal(row)
                return (
                  <button
                    key={row.id}
                    type="button"
                    className="ui-kit-holding-card ui-kit-holding-card--btn"
                    onClick={() => startEdit(row)}
                    style={{ textAlign: 'left' }}
                  >
                    <div className="ui-kit-holding-card-head">
                      <div>
                        <div className="ui-kit-holding-card-title">
                          <span>{row.name || 'Untitled Subscription'}</span>
                        </div>
                        {linkedApp ? (
                          <div className="ui-kit-holding-card-subtitle">{linkedApp.app_name}</div>
                        ) : null}
                        {lastChargeBySub.get(row.id) ? (
                          <div className="ui-kit-holding-card-subtitle">
                            Last charged {lastChargeBySub.get(row.id)?.date}
                          </div>
                        ) : null}
                      </div>
                      <div className="ui-kit-holding-card-head-right">
                        {!isActive(row) ? (
                          <span className="ui-pill ui-tone-muted">Cancelled</span>
                        ) : null}
                        <div className="ui-kit-holding-icon ui-kit-holding-icon--bg ui-tone-navy">
                          <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted)', flexShrink: 0 }}>
                            <CatIcon cat={row.category || 'Others'} size={14} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ui-kit-holding-card-grid">
                      <div className="ui-kit-holding-stat">
                        <span>Amount</span>
                        <strong>{amountLabel(row.amount || 0, row.currency, appState.roundOff)}</strong>
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
              })}
            </div>
          )}
        </>
      )}

      {tab === 'charges' && (
        <>
          <SectionBlock
            title="Charges"
            icon={<Clock size={16} />}
            subtitle="What these plans have actually taken"
            right={loading ? <LoadingState variant="inline" /> : <SectionChip tone="muted">{filteredCharges.length}</SectionChip>}
          >
            {chargeRows.length > 0 ? (
              <SearchField
                value={chargeSearch}
                placeholder="Search plan, note, amount…"
                onChange={setChargeSearch}
                onClear={() => setChargeSearch('')}
                prefix={<Search size={14} />}
              />
            ) : null}
          </SectionBlock>
          <Spacer size={12} />

          {loading && <LoadingState variant="section" />}

          {!loading && chargesError ? (
            <InfoCallout title="Charges could not be loaded" tone="red">
              {chargesError}. This list is incomplete — it is not proof that nothing was charged.
            </InfoCallout>
          ) : null}

          {!loading && !chargesError && filteredCharges.length === 0 && (
            <div className="gold-empty">
              <Clock size={28} />
              <p>
                {chargeSearch
                  ? 'No charges match that search.'
                  : 'No charges recorded yet. They appear here when a transaction is linked to a subscription.'}
              </p>
            </div>
          )}

          {!loading && filteredCharges.length > 0 && (
            <div className="ui-stack">
              {chargesByMonth.map(group => (
                <section key={group.key} className="repay-month">
                  <header className="repay-month-head">
                    <span className="repay-month-label">{group.label}</span>
                    <span className="repay-month-total">
                      {fmt(group.total)}
                      <span className="repay-month-count">
                        {` · ${group.rows.length} charge${group.rows.length === 1 ? '' : 's'}`}
                      </span>
                    </span>
                  </header>
                  <div className="repay-month-rows">
                    {group.rows.map(row => (
                      <HoldingCard
                        key={row.id}
                        title={row.name}
                        subtitle={row.note || (row.mirrored ? MIRRORED_ROW_NOTE : 'Charge')}
                        leftLabel="Amount"
                        leftValue={fmt(row.amount)}
                        centerLabel="Date"
                        centerValue={row.date || '-'}
                        rightLabel="Source"
                        rightValue={row.mirrored ? 'Transaction' : 'Manual'}
                        accentTone={row.mirrored ? 'amber' : 'navy'}
                        icon={<Clock size={14} />}
                        iconPosition="right"
                        iconBackground
                        className="stock-entry-card"
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}


      {tab !== 'charges' ? (
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
      ) : null}

      {mode && (
        <ModalShell
          title={mode === 'add' ? 'Add Subscription' : 'Edit Subscription'}
          onClose={closeForm}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={saving ? 'Saving…' : mode === 'add' ? 'Add' : 'Save'}
              onSecondary={closeForm}
              onPrimary={save}
              leading={mode === 'edit' ? <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={confirmDelete} disabled={saving}>{saving
                    ? 'Deleting…'
                    : deleteConfirm
                      ? `Delete "${form.name.trim() || 'this plan'}"${editingChargeCount ? ` and ${editingChargeCount} charge${editingChargeCount === 1 ? '' : 's'}` : ''}?`
                      : 'Delete'}</button> : null}
              disabled={saving}
            />
          }
        >
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: 12 }}>
            {formError ? (
              <p className="ui-kit-callout ui-tone-red" role="alert" style={{ margin: 0 }}>{formError}</p>
            ) : null}
            {mode === 'edit' && editingChargeCount > 0 ? (
              <InfoCallout title="This plan has charge history" tone="amber">
                {editingChargeCount} recorded charge{editingChargeCount === 1 ? '' : 's'} would be deleted with it,
                and any linked register entries unlinked. To stop billing without losing the history, set Status to
                Cancelled instead.
              </InfoCallout>
            ) : null}
            <FormField label="Name">
              <input className="form-inp" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </FormField>
            <FormField label="Category">
              <select className="form-inp" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Select</option>
                {subscriptionCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Amount">
              <input className="form-inp" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
            <FormField label="Currency">
              <select className="form-inp" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </FormField>
            <FormField label="Billing Cycle">
              <select className="form-inp" value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}>
                {BILLING_CYCLES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Start Date *">
              <input className="form-inp" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </FormField>
            <FormField label="End Date" hint="Leave blank while the plan is open-ended. A past date stops renewals.">
              <input className="form-inp" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </FormField>
            <FormField label="Status" hint="Cancelled plans stay on record but leave the run-rate.">
              <select className="form-inp" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {SUBSCRIPTION_STATUSES.map(st => (
                  <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Payment Method">
              <select className="form-inp" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                <option value="">Select</option>
                {form.payment_method && !paymentModeOptions.includes(form.payment_method) ? (
                  <option value={form.payment_method}>{form.payment_method} (legacy)</option>
                ) : null}
                {paymentModeOptions.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
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
            {/* Lets Enter submit without duplicating the ModalActions button. */}
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
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
