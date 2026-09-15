import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Check, Copy, Search, ShieldPlus, Plus, HeartPulse, Shield, Sparkles,
  Car, ExternalLink, Home, Plane, ReceiptText, Wallet,
} from 'lucide-react'
import { api, type PersonRow, type RawInsuranceRow, type RawInsurancePremiumRow } from '../api'
import {
  FilterChips, FormField, HoldingCard, KpiCard, KpiGrid, LoadingState,
  ModalActions, ModalShell, SearchField, SectionBlock, SectionChip, Spacer,
} from '../ui'
import {
  POLICY_TYPES, POLICY_TYPE_LABELS, PREMIUM_MODES, PREMIUM_MODE_LABELS,
  policyTypeFields, policyTypeLabel as sharedPolicyTypeLabel,
} from '@fintracker-vault/utils'
import { INR } from '../utils'

const KPI_ICON = 16

type InsuranceTab = 'policies' | 'premiums'

/** Only these are offered; the server rejects anything else. */
const STATUSES = ['active', 'lapsed', 'paid_up', 'matured'] as const
const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  lapsed: 'Lapsed',
  paid_up: 'Paid-up',
  matured: 'Matured',
}

type InsuranceFormState = {
  id: string
  policy_type: string
  plan_name: string
  insurer: string
  app_uuid: string
  policy_number: string
  policy_owner: string
  premium_amount: string
  premium_mode: string
  payment_method: string
  policy_term: string
  issue_date: string
  maturity_date: string
  sum_assured: string
  cash_value: string
  nominee_name: string
  notes: string
  person_uuid: string
  status: string
  paid_premiums_opening: string
  premium_payment_term_years: string
  renews: boolean
  ecard_url: string
  member_uuids: string[]
  nominee_uuids: string[]
}

const EMPTY_FORM: InsuranceFormState = {
  id: '',
  policy_type: 'life',
  plan_name: '',
  insurer: '',
  app_uuid: '',
  policy_number: '',
  policy_owner: '',
  premium_amount: '',
  premium_mode: '',
  payment_method: '',
  policy_term: '',
  issue_date: '',
  maturity_date: '',
  sum_assured: '',
  cash_value: '',
  nominee_name: '',
  notes: '',
  person_uuid: '',
  status: 'active',
  paid_premiums_opening: '',
  premium_payment_term_years: '',
  renews: false,
  ecard_url: '',
  member_uuids: [],
  nominee_uuids: [],
}

function toForm(row: RawInsuranceRow): InsuranceFormState {
  return {
    id: row.id || '',
    policy_type: row.policy_type || 'life',
    plan_name: row.plan_name || '',
    insurer: row.insurer || '',
    app_uuid: row.app_uuid || '',
    policy_number: row.policy_number || '',
    policy_owner: row.policy_owner || '',
    premium_amount: row.premium_amount === undefined || row.premium_amount === null ? '' : String(row.premium_amount),
    premium_mode: row.premium_mode || '',
    payment_method: row.payment_method || '',
    policy_term: row.policy_term || '',
    issue_date: toDateInput(row.issue_date || ''),
    maturity_date: toDateInput(row.maturity_date || ''),
    sum_assured: row.sum_assured === undefined || row.sum_assured === null ? '' : String(row.sum_assured),
    cash_value: row.cash_value === undefined || row.cash_value === null ? '' : String(row.cash_value),
    nominee_name: row.nominee_name || '',
    notes: row.notes || '',
    person_uuid: row.person_uuid || '',
    status: row.status || 'active',
    paid_premiums_opening: row.paid_premiums_opening ? String(row.paid_premiums_opening) : '',
    premium_payment_term_years: row.premium_payment_term_years ? String(row.premium_payment_term_years) : '',
    renews: Boolean(row.renews),
    ecard_url: row.ecard_url || '',
    member_uuids: row.member_uuids || [],
    nominee_uuids: row.nominee_uuids || [],
  }
}

function INRInput(value: string) {
  if (!value.trim()) return '-'
  const num = Number(value)
  return Number.isFinite(num) ? INR(num) : value
}

function toDateInput(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const dmmy = raw.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/)
  if (dmmy) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthIndex = months.findIndex(m => m.toLowerCase() === dmmy[2].toLowerCase())
    if (monthIndex !== -1) return `20${dmmy[3]}-${String(monthIndex + 1).padStart(2, '0')}-${dmmy[1]}`
  }
  const dt = new Date(raw)
  if (!Number.isNaN(dt.getTime())) {
    const y = String(dt.getFullYear()).padStart(4, '0')
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return ''
}

function fmtDate(value: string) {
  const raw = value.trim()
  if (!raw) return '-'
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return raw
  const d = String(dt.getDate()).padStart(2, '0')
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()]
  const y = String(dt.getFullYear()).slice(-2)
  return `${d}-${m}-${y}`
}

function policyTypeLabel(value: string) {
  return sharedPolicyTypeLabel(value) || '-'
}

function policyTypeIcon(value: string) {
  switch (value.trim().toLowerCase()) {
    case 'health': return <HeartPulse size={14} />
    case 'life': return <Shield size={14} />
    case 'term': return <Sparkles size={14} />
    case 'accident': return <ShieldPlus size={14} />
    case 'motor': return <Car size={14} />
    case 'travel': return <Plane size={14} />
    case 'home': return <Home size={14} />
    default: return <ShieldPlus size={14} />
  }
}

/**
 * How a due date reads on the card.
 *
 * A negative `days_until_due` is the whole point of the feature — a premium you
 * did not pay is overdue, not quietly renewed — so it gets the loudest tone.
 */
function dueBadge(row: RawInsuranceRow): { text: string; tone: string } | null {
  const d = row.days_until_due
  if (!row.next_due || d === null || d === undefined) {
    if ((row.premium_mode || '').toLowerCase().startsWith('single')) {
      return { text: 'Single premium', tone: 'muted' }
    }
    if (!row.issue_date) return { text: 'Set an issue date to track dues', tone: 'muted' }
    return null
  }
  // Every badge names the date. The urgent ones used to read "Due in 6d" alone,
  // which told you to act but not when — and on a policy with no premiums
  // recorded yet that left the card with no date on it at all.
  if (d < 0) return { text: `Overdue ${fmtDate(row.next_due)} · ${Math.abs(d)}d`, tone: 'red' }
  if (d === 0) return { text: `Due today · ${fmtDate(row.next_due)}`, tone: 'red' }
  if (d <= 7) return { text: `Due ${fmtDate(row.next_due)} · ${d}d`, tone: 'red' }
  if (d <= 30) return { text: `Due ${fmtDate(row.next_due)}`, tone: 'amber' }
  // A renewing policy's next date is when it rolls over, not just the next
  // instalment — worth naming, because that is when the premium can change.
  if (row.renews && row.maturity_date && row.next_due > row.maturity_date) {
    return { text: `Renews ${fmtDate(row.next_due)}`, tone: 'muted' }
  }
  return { text: `Next ${fmtDate(row.next_due)}`, tone: 'muted' }
}

function sumLabel(policyType: string): string {
  return policyTypeFields(policyType).sumLabel
}

function calcPolicyTerm(issueDate: string, maturityDate: string): string {
  if (!issueDate.trim() || !maturityDate.trim()) return '-'
  try {
    const [issueY, issueM, issueD] = issueDate.split('-').map(Number)
    const [maturityY, maturityM, maturityD] = maturityDate.split('-').map(Number)
    if (!issueY || !issueM || !issueD || !maturityY || !maturityM || !maturityD) return '-'
    let years = maturityY - issueY
    if (maturityM < issueM || (maturityM === issueM && maturityD < issueD)) years--
    return `${years} Years`
  } catch {
    return '-'
  }
}

function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

type AppRow = { app_uuid: string; app_name: string; app_link?: string; logo?: string }

/**
 * One policy, at a glance.
 *
 * The card used to carry six stat values, three stacked elements in the corner
 * and the full list of covered people in the subtitle, which made every policy
 * look equally urgent and none of it readable. It now answers only the four
 * questions you actually scan for — what it is, who it covers, what it costs,
 * and whether it needs you — and everything else lives one tap away in the
 * detail sheet.
 */
function PolicyCard({
  row,
  covers,
  app,
  onOpen,
}: {
  row: RawInsuranceRow
  covers: string
  app?: AppRow
  onOpen: () => void
}) {
  const badge = dueBadge(row)
  const cadence = row.premium_mode_label || row.premium_mode
  const endLabel = row.renews ? 'Renews on' : 'Matures'
  const status = String(row.status || 'active')

  return (
    <HoldingCard
      className="policy-card"
      title={row.plan_name || 'Untitled Policy'}
      /* The policy number is the thing you quote to the insurer and the thing
         you search for, so it gets its own full-width line directly under the
         name rather than a cramped third of a stat grid. The insurer is not
         repeated here — it is already the logo, and usually the first words of
         the plan name too. */
      subtitle={row.policy_number || 'No policy number'}
      icon={
        app?.logo ? (
          <img src={app.logo} alt="" style={{ width: 20, height: 20, objectFit: 'contain', display: 'block' }} />
        ) : (
          policyTypeIcon(row.policy_type)
        )
      }
      iconBackground
      leftLabel={cadence ? `Premium · ${cadence}` : 'Premium'}
      leftValue={INRInput(String(row.premium_amount ?? ''))}
      centerLabel={sumLabel(row.policy_type)}
      centerValue={INRInput(String(row.sum_assured ?? ''))}
      rightLabel="Paid"
      rightValue={row.premiums_progress || String(row.paid_count ?? 0)}
      secondaryGrid={{
        leftLabel: 'Covers',
        leftValue: covers || '—',
        /* Falls back to the start date so the slot always holds a real date.
           Until premiums are linked, `last_paid_on` is null on every policy,
           and an em-dash in the middle of the row told you nothing. */
        centerLabel: row.last_paid_on ? 'Last paid' : 'Started',
        centerValue: row.last_paid_on
          ? fmtDate(row.last_paid_on)
          : row.issue_date
            ? fmtDate(row.issue_date)
            : '—',
        rightLabel: row.premiums_remaining === null ? endLabel : 'Remaining',
        rightValue:
          row.premiums_remaining === null
            ? row.maturity_date
              ? fmtDate(row.maturity_date)
              : '—'
            : row.renews
              ? `${row.premiums_remaining} this yr`
              : String(row.premiums_remaining),
      }}
      /* The due state gets its own line rather than a corner it has to share.
         It is the one thing on the card that can need action, so it reads as a
         sentence instead of competing with the icon for space. */
      chips={
        <>
          {badge && (
            <span className={`policy-chip policy-chip--${badge.tone}`}>{badge.text}</span>
          )}
          {status !== 'active' && (
            <span className="policy-chip policy-chip--muted">
              {STATUS_LABELS[status] || status}
            </span>
          )}
        </>
      }
      accentTone={badge?.tone === 'red' ? 'red' : 'navy'}
      onClick={onOpen}
    />
  )
}

export default function VaultInsurancePage() {
  const [tab, setTab] = useState<InsuranceTab>('policies')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [premiums, setPremiums] = useState<RawInsurancePremiumRow[]>([])
  const [premiumMode, setPremiumMode] = useState<'add' | null>(null)
  const [premiumForm, setPremiumForm] = useState({ policy_id: '', date: '', amount: '', note: '' })
  const [rows, setRows] = useState<RawInsuranceRow[]>([])
  const [persons, setPersons] = useState<PersonRow[]>([])
  const [apps, setApps] = useState<Array<{ app_uuid: string; app_name: string; app_link?: string; logo?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<InsuranceFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<RawInsuranceRow | null>(null)
  const [toast, setToast] = useState('')
  const [deleteId, setDeleteId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [insuranceRows, appRows, personRows, premiumRows] = await Promise.all([
        api.getInsuranceEntries(),
        api.getApps(),
        api.getPersons(),
        api.getInsurancePremiums(),
      ])
      setRows(insuranceRows)
      setPremiums(premiumRows)
      setPersons(personRows)
      setApps(appRows.map(app => ({ app_uuid: app.app_uuid, app_name: app.app_name, app_link: app.app_link, logo: app.logo })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insurance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const personName = useMemo(() => {
    const m = new Map<string, string>()
    persons.forEach(pr => m.set(pr.person_uuid, pr.name || ''))
    return m
  }, [persons])

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { All: rows.length }
    for (const st of STATUSES) c[STATUS_LABELS[st]] = rows.filter(r => (r.status || 'active') === st).length
    return c
  }, [rows])

  /**
   * Chips default to Active for the same reason loans and subscriptions do:
   * opening on everything buries the policies you are actually paying for
   * behind the ones you closed years ago.
   */
  const statusItems = useMemo(
    () => ['Active', 'All', ...STATUSES.filter(s => s !== 'active').map(s => STATUS_LABELS[s])]
      .map(l => `${l} (${statusCounts[l] ?? 0})`),
    [statusCounts],
  )
  const activeChip = useMemo(
    () => statusItems.find(i => i.startsWith(statusFilter)) ?? statusItems[0],
    [statusItems, statusFilter],
  )

  const statusRows = useMemo(() => {
    if (statusFilter === 'All') return rows
    const want = STATUSES.find(st => STATUS_LABELS[st] === statusFilter)
    return want ? rows.filter(r => (r.status || 'active') === want) : rows
  }, [rows, statusFilter])

  const kpis = useMemo(() => {
    const active = rows.filter(r => (r.status || 'active') === 'active')
    return {
      annualised: active.reduce((sum, r) => sum + (r.monthly_cost || 0) * 12, 0),
      dueSoon: active.filter(r => r.days_until_due !== null && r.days_until_due >= 0 && r.days_until_due <= 30).length,
      overdue: active.filter(r => r.days_until_due !== null && r.days_until_due < 0).length,
      activeCount: active.length,
    }
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return statusRows
    return statusRows.filter(row => [
      policyTypeLabel(row.policy_type),
      row.plan_name,
      row.insurer,
      row.app_uuid,
      row.policy_number,
      row.policy_owner,
      row.nominee_name,
      row.notes,
      row.person_uuid,
      personName.get(row.person_uuid || '') || '',
      ...(row.member_uuids || []).map(u => personName.get(u) || ''),
    ].join(' ').toLowerCase().includes(q))
  }, [statusRows, search, personName])

  const policyName = useMemo(() => {
    const m = new Map<string, string>()
    rows.forEach(r => m.set(r.id, r.plan_name || r.insurer || 'Policy'))
    return m
  }, [rows])

  /** Premiums newest-first, grouped by month — the shape the charges tab uses. */
  const premiumsByMonth = useMemo(() => {
    const groups = new Map<string, RawInsurancePremiumRow[]>()
    for (const row of [...premiums].sort((a, b) => (a.date < b.date ? 1 : -1))) {
      const key = (row.date || '').slice(0, 7)
      const list = groups.get(key)
      if (list) list.push(row)
      else groups.set(key, [row])
    }
    return [...groups.entries()]
  }, [premiums])

  const startAdd = () => {
    setMode('add')
    setEditingId('')
    setForm(EMPTY_FORM)
    setDeleteConfirm(false)
    setDeleteId('')
  }

  const startEdit = (row: RawInsuranceRow) => {
    setMode('edit')
    setEditingId(row.id)
    setForm(toForm(row))
    setDeleteConfirm(false)
    setDeleteId(row.id)
  }

  const closeForm = () => {
    setMode(null)
    setEditingId('')
    setForm(EMPTY_FORM)
    setDeleteConfirm(false)
    setDeleteId('')
  }

  const save = async () => {
    // Plan name and type are the only required fields. Real policies genuinely
    // lack the rest — the two LIC endowments have no nominee at all — and a form
    // that insists would force invented data into the vault, which is worse than
    // a blank. Every downstream calculation already handles absence: a missing
    // premium contributes 0 rather than being guessed, and a missing issue date
    // shows "set an issue date" rather than a wrong due date.
    if (!form.plan_name.trim()) {
      setError('Plan name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        id: form.id || undefined,
        policy_type: form.policy_type.trim().toLowerCase(),
        plan_name: form.plan_name.trim(),
        insurer: form.insurer.trim(),
        app_uuid: form.app_uuid.trim(),
        policy_number: form.policy_number.trim(),
        policy_owner: form.policy_owner.trim(),
        premium_amount: form.premium_amount ? Number(form.premium_amount) : 0,
        premium_mode: form.premium_mode.trim(),
        payment_method: form.payment_method.trim(),
        issue_date: form.issue_date.trim(),
        maturity_date: form.maturity_date.trim(),
        sum_assured: form.sum_assured ? Number(form.sum_assured) : 0,
        cash_value: form.cash_value ? Number(form.cash_value) : 0,
        nominee_name: form.nominee_name.trim(),
        notes: form.notes.trim(),
        person_uuid: form.person_uuid.trim(),
        status: form.status,
        paid_premiums_opening: form.paid_premiums_opening ? Number(form.paid_premiums_opening) : 0,
        premium_payment_term_years: form.premium_payment_term_years
          ? Number(form.premium_payment_term_years)
          : null,
        renews: form.renews,
        ecard_url: form.ecard_url.trim(),
        // The whole set every time — the server replaces rather than diffs.
        member_uuids: form.member_uuids,
        nominee_uuids: form.nominee_uuids,
      }
      if (mode === 'edit') {
        await api.updateInsuranceEntry({ ...payload, id: editingId })
      } else {
        await api.addInsuranceEntry(payload)
      }
      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async (targetId: string) => {
    if (!targetId) return
    setSaving(true)
    setError('')
    try {
      await api.deleteInsuranceEntry(targetId)
      await load()
      if (detail?.id === targetId) setDetail(null)
      setToast('Policy deleted')
      window.setTimeout(() => setToast(''), 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
      setDeleteConfirm(false)
      setDeleteId('')
    }
  }

  /**
   * Which fields this policy type actually has an answer to.
   *
   * Hiding a field never clears it — a hidden value stays in form state and is
   * still sent on save, so switching type to look at something cannot silently
   * destroy data the policy really has.
   */
  const typeFields = policyTypeFields(form.policy_type)

  const startAddPremium = (policyId = '') => {
    const policy = rows.find(r => r.id === policyId)
    setPremiumForm({
      policy_id: policyId,
      date: new Date().toISOString().slice(0, 10),
      // Pre-fill the contracted premium; the user can correct it.
      amount: policy?.premium_amount ? String(policy.premium_amount) : '',
      note: '',
    })
    setPremiumMode('add')
  }

  const savePremium = async () => {
    if (!premiumForm.policy_id) {
      setError('Choose a policy')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.addInsurancePremium({
        policy_id: premiumForm.policy_id,
        date: premiumForm.date,
        amount: Number(premiumForm.amount),
        note: premiumForm.note.trim(),
      })
      await load()
      setPremiumMode(null)
      setToast('Premium recorded')
      window.setTimeout(() => setToast(''), 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record premium')
    } finally {
      setSaving(false)
    }
  }

  const removePremium = async (id: string) => {
    setSaving(true)
    setError('')
    try {
      await api.deleteInsurancePremium(id)
      await load()
      setToast('Premium removed')
      window.setTimeout(() => setToast(''), 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove premium')
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = async (targetId: string) => {
    if (!targetId) return
    if (!deleteConfirm || deleteId !== targetId) {
      setDeleteId(targetId)
      setDeleteConfirm(true)
      return
    }
    await confirmDelete(targetId)
  }

  /**
   * The detail sheet, grouped rather than listed.
   *
   * It used to be 22 rows in the order they were written — status third,
   * insurer eleventh, the premium amount fifteenth — so finding anything meant
   * reading all of it. Now it runs identity, then people, then money, then
   * dates, which is the order the questions actually get asked in.
   *
   * The plan name and policy number are not here: they head the sheet.
   * Empty rows drop out, so a policy with no nominee simply has no nominee row.
   */
  const detailRows = detail
    ? ([
        // Identity
        ['Policy Type', policyTypeLabel(detail.policy_type)],
        ['Insurer', detail.insurer],
        ['Status', STATUS_LABELS[detail.status] || detail.status || ''],
        // People
        [
          'Policy Holder',
          (detail.person_uuid && personName.get(detail.person_uuid)) || detail.policy_owner || '',
        ],
        ['Covers', (detail.member_uuids || []).map(u => personName.get(u) || '').filter(Boolean).join(', ')],
        [
          'Nominees',
          // Linked people first; the free-text name is the fallback for someone
          // who is not in the registry.
          (detail.nominee_uuids || []).map(u => personName.get(u) || '').filter(Boolean).join(', ') ||
            detail.nominee_name ||
            '',
        ],
        // Money
        ['Premium', INRInput(String(detail.premium_amount ?? ''))],
        ['Premium Mode', detail.premium_mode_label || detail.premium_mode],
        ['Payment Method', detail.payment_method],
        [sumLabel(detail.policy_type), INRInput(String(detail.sum_assured ?? ''))],
        ['Cash Value', INRInput(String(detail.cash_value ?? ''))],
        // Dates and progress
        ['Issue Date', fmtDate(detail.issue_date)],
        [detail.renews ? 'Renews On' : 'Maturity Date', fmtDate(detail.maturity_date)],
        ['Policy Term', calcPolicyTerm(detail.issue_date, detail.maturity_date)],
        [
          'Premium Payment Term',
          detail.premium_payment_term_years ? `${detail.premium_payment_term_years} Years` : '',
        ],
        ['Premiums Paid', detail.premiums_progress || (detail.paid_count ? String(detail.paid_count) : '')],
        [
          detail.renews ? 'Remaining This Year' : 'Premiums Remaining',
          detail.premiums_remaining === null ? '' : String(detail.premiums_remaining),
        ],
        ['Last Premium Due', detail.last_payable_on ? fmtDate(detail.last_payable_on) : ''],
        ['Last Paid', detail.last_paid_on ? fmtDate(detail.last_paid_on) : ''],
        [detail.renews ? 'Next Due / Renewal' : 'Next Due', detail.next_due ? fmtDate(detail.next_due) : ''],
        // Everything else
        ['Linked App', apps.find(app => app.app_uuid === detail.app_uuid)?.app_name || ''],
        ['Notes', detail.notes],
      ].filter(([, value]) => String(value || '').trim().length > 0) as Array<[string, string]>)
    : []

  return (
    <div className="ui-kit-page-shell" style={{ paddingTop: 0 }}>
      <nav className="bottom-nav">
        <button type="button" className={`bottom-nav-item${tab === 'policies' ? ' active' : ''}`} onClick={() => setTab('policies')}>
          <span className="bottom-nav-icon"><Shield size={19} /></span>
          <span>Policies</span>
        </button>
        <button type="button" className={`bottom-nav-item${tab === 'premiums' ? ' active' : ''}`} onClick={() => setTab('premiums')}>
          <span className="bottom-nav-icon"><ReceiptText size={19} /></span>
          <span>Premiums</span>
        </button>
      </nav>

      {error && <div className="settings-alert">⚠ {error}</div>}

      {tab === 'policies' && (
        <>
          <SectionBlock
            title="Insurance"
            icon={<ShieldPlus size={16} />}
            right={<SectionChip>{rows.length}</SectionChip>}
          >
            <div className="ui-stack">
              <KpiGrid>
                <KpiCard label="Annualised premium" value={INR(kpis.annualised)} icon={<Wallet size={KPI_ICON} />} />
                <KpiCard label="Active policies" value={String(kpis.activeCount)} icon={<Shield size={KPI_ICON} />} />
                <KpiCard label="Due in 30 days" value={String(kpis.dueSoon)} tone={kpis.dueSoon ? 'amber' : 'muted'} />
                <KpiCard label="Overdue" value={String(kpis.overdue)} tone={kpis.overdue ? 'red' : 'muted'} />
              </KpiGrid>
              <FilterChips
                items={statusItems}
                active={activeChip}
                onChange={label => setStatusFilter(label.replace(/ \(\d+\)$/, ''))}
              />
              <SearchField
                value={search}
                placeholder="Search policies..."
                onChange={setSearch}
                onClear={() => setSearch('')}
                prefix={<Search size={14} />}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {filteredRows.length} visible of {rows.length} policies
              </div>
            </div>
          </SectionBlock>
          <Spacer size={12} />

          {loading ? (
            <LoadingState variant="section" />
          ) : (
            <div className="ui-stack">
              {filteredRows.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '18px 14px', color: 'var(--muted)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                  {rows.length === 0
                    ? 'No insurance policies yet. Add one with the plus button.'
                    : 'No policies match this filter.'}
                </div>
              ) : (
                filteredRows.map(row => {
                  const members = (row.member_uuids || []).map(u => personName.get(u) || '').filter(Boolean)
                  const names = members.length
                    ? members
                    : [(row.person_uuid && personName.get(row.person_uuid)) || row.policy_owner || ''].filter(Boolean)
                  // A family floater can cover six people; naming them all turns
                  // the subtitle into a paragraph. Two plus a count reads at a glance.
                  const covers =
                    names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
                  return (
                    <PolicyCard
                      key={row.id}
                      row={row}
                      covers={covers}
                      app={apps.find(item => item.app_uuid === row.app_uuid)}
                      onOpen={() => setDetail(row)}
                    />
                  )
                })
              )}
            </div>
          )}
        </>
      )}

      {tab === 'premiums' && (
        <>
          <SectionBlock
            title="Premiums paid"
            icon={<ReceiptText size={16} />}
            right={<SectionChip>{premiums.length}</SectionChip>}
          >
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Premiums recorded against a policy. Ones marked <em>From transaction</em> came from
              FinTracker and are edited there.
            </div>
          </SectionBlock>
          <Spacer size={12} />

          {loading ? (
            <LoadingState variant="section" />
          ) : premiums.length === 0 ? (
            <div style={{ padding: '18px 14px', color: 'var(--muted)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              No premiums recorded yet.
            </div>
          ) : (
            <div className="ui-stack">
              {premiumsByMonth.map(([month, list]) => (
                <div key={month}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 2px 8px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                      {month ? fmtDate(`${month}-01`).slice(3) : 'Undated'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {INR(list.reduce((sum, r) => sum + (r.amount || 0), 0))}
                    </div>
                  </div>
                  <div className="ui-stack">
                    {list.map(row => (
                      <HoldingCard
                        key={row.id}
                        title={policyName.get(row.policy_id) || 'Policy'}
                        subtitle={row.mirrored ? 'From transaction' : row.note || 'Recorded here'}
                        leftLabel="Amount"
                        leftValue={INR(row.amount || 0)}
                        centerLabel="Date"
                        centerValue={fmtDate(row.date)}
                        rightLabel="Source"
                        rightValue={row.mirrored ? 'FinTracker' : 'Manual'}
                        accentTone={row.mirrored ? 'amber' : 'navy'}
                        rightTop={
                          <button
                            type="button"
                            className="ui-kit-btn ui-kit-btn--soft"
                            onClick={() => void removePremium(row.id)}
                            disabled={saving}
                            style={{ fontSize: 11 }}
                          >
                            Remove
                          </button>
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button
        type="button"
        className="ui-kit-btn ui-kit-btn--solid"
        onClick={() => (tab === 'premiums' ? startAddPremium() : startAdd())}
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
        aria-label={tab === 'premiums' ? 'Record premium' : 'Add insurance policy'}
        title={tab === 'premiums' ? 'Record premium' : 'Add insurance policy'}
      >
        <Plus size={20} />
      </button>

      {mode && (
        <ModalShell
          title={mode === 'add' ? 'Add Insurance Policy' : 'Edit Insurance Policy'}
          onClose={closeForm}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={mode === 'add' ? 'Add' : 'Save'}
              onSecondary={closeForm}
              onPrimary={save}
              leading={mode === 'edit' ? <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void requestDelete(editingId)} disabled={saving}>{saving ? 'Deleting…' : deleteConfirm && deleteId === editingId ? 'Confirm delete?' : 'Delete'}</button> : null}
              disabled={saving}
            />
          }
        >
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: 12 }}>
            <FormField label="Plan Name">
              <input className="form-inp" value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))} />
            </FormField>
            <FormField label="Policy Type">
              <select
                className="form-inp"
                value={form.policy_type}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    policy_type: e.target.value,
                    // Seed the rollover behaviour from the type; still overridable below.
                    renews: policyTypeFields(e.target.value).defaultRenews,
                  }))
                }
              >
                {POLICY_TYPES.map(t => (
                  <option key={t} value={t}>{POLICY_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Insurer">
              <input className="form-inp" value={form.insurer} onChange={e => setForm(f => ({ ...f, insurer: e.target.value }))} />
            </FormField>
            <FormField label="App Entry">
              <select className="form-inp" value={form.app_uuid} onChange={e => setForm(f => ({ ...f, app_uuid: e.target.value }))}>
                <option value="">Select App</option>
                {apps.map(app => (
                  <option key={app.app_uuid} value={app.app_uuid}>{app.app_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Policy Number">
              <input className="form-inp" value={form.policy_number} onChange={e => setForm(f => ({ ...f, policy_number: e.target.value }))} />
            </FormField>
            <FormField label="Policy Owner">
              <input className="form-inp" value={form.policy_owner} onChange={e => setForm(f => ({ ...f, policy_owner: e.target.value }))} />
            </FormField>
            <FormField label="Person (registry)">
              <select className="form-inp" value={form.person_uuid} onChange={e => setForm(f => ({ ...f, person_uuid: e.target.value }))}>
                <option value="">None</option>
                {persons.map(pr => (
                  <option key={pr.person_uuid} value={pr.person_uuid}>{pr.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Status">
              <select className="form-inp" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(st => (
                  <option key={st} value={st}>{STATUS_LABELS[st]}</option>
                ))}
              </select>
            </FormField>
            {typeFields.paymentTerm && (
            <FormField label="Premium payment term (years)">
              <input
                className="form-inp"
                inputMode="numeric"
                placeholder="Same as policy term"
                value={form.premium_payment_term_years}
                onChange={e => setForm(f => ({ ...f, premium_payment_term_years: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Only when you stop paying before the policy ends — a limited-pay plan. Leave blank
                for regular pay.
              </div>
            </FormField>
            )}
            <FormField label="Covers">
              <div style={{ display: 'grid', gap: 6, maxHeight: 168, overflowY: 'auto', padding: 8, border: '1px solid var(--border)', borderRadius: 10 }}>
                {persons.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add people in Persons first.</div>
                ) : (
                  persons.map(pr => (
                    <label key={pr.person_uuid} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={form.member_uuids.includes(pr.person_uuid)}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            member_uuids: e.target.checked
                              ? [...f.member_uuids, pr.person_uuid]
                              : f.member_uuids.filter(u => u !== pr.person_uuid),
                          }))
                        }
                      />
                      <span>{pr.name}</span>
                    </label>
                  ))
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Everyone this policy covers. A group or family floater covers several.
              </div>
            </FormField>
            {typeFields.nominees && (
            <FormField label="Nominees">
              <div style={{ display: 'grid', gap: 6, maxHeight: 168, overflowY: 'auto', padding: 8, border: '1px solid var(--border)', borderRadius: 10 }}>
                {persons.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add people in Persons first.</div>
                ) : (
                  persons.map(pr => (
                    <label key={pr.person_uuid} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={form.nominee_uuids.includes(pr.person_uuid)}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            nominee_uuids: e.target.checked
                              ? [...f.nominee_uuids, pr.person_uuid]
                              : f.nominee_uuids.filter(u => u !== pr.person_uuid),
                          }))
                        }
                      />
                      <span>{pr.name}</span>
                    </label>
                  ))
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Who gets paid out — a different list from who is covered. Optional: a policy
                may genuinely have no nominee.
              </div>
            </FormField>
            )}
            <FormField label="Premium Amount">
              <input className="form-inp" inputMode="decimal" value={form.premium_amount} onChange={e => setForm(f => ({ ...f, premium_amount: e.target.value }))} />
            </FormField>
            <FormField label="Premium Mode">
              <select className="form-inp" value={form.premium_mode} onChange={e => setForm(f => ({ ...f, premium_mode: e.target.value }))}>
                <option value="">Select Mode</option>
                {PREMIUM_MODES.map(m => (
                  <option key={m} value={m}>{PREMIUM_MODE_LABELS[m]}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Premiums already paid">
              <input
                className="form-inp"
                inputMode="numeric"
                value={form.paid_premiums_opening}
                onChange={e => setForm(f => ({ ...f, paid_premiums_opening: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Premiums paid before you started recording them here. Rows in the Premiums tab are
                added to this number, not counted instead of it.
              </div>
            </FormField>
            <FormField label="Payment Method">
              <input className="form-inp" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} />
            </FormField>
            <FormField label="Issue Date">
              <input className="form-inp" type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </FormField>
            <FormField label={typeFields.endDateLabel}>
              <input className="form-inp" type="date" value={form.maturity_date} onChange={e => setForm(f => ({ ...f, maturity_date: e.target.value }))} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={form.renews}
                  onChange={e => setForm(f => ({ ...f, renews: e.target.checked }))}
                />
                <span>Renews on this date rather than ending</span>
              </label>
            </FormField>
            <FormField label={typeFields.sumLabel}>
              <input className="form-inp" inputMode="decimal" value={form.sum_assured} onChange={e => setForm(f => ({ ...f, sum_assured: e.target.value }))} />
            </FormField>
            {typeFields.cashValue && (
              <FormField label="Cash Value">
                <input className="form-inp" inputMode="decimal" value={form.cash_value} onChange={e => setForm(f => ({ ...f, cash_value: e.target.value }))} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  Surrender value or vested bonus as last stated. Reported separately from
                  net worth, never folded into it.
                </div>
              </FormField>
            )}
            {typeFields.nominees && (
              <FormField label="Nominee Name (if not in Persons)">
                <input className="form-inp" value={form.nominee_name} onChange={e => setForm(f => ({ ...f, nominee_name: e.target.value }))} />
              </FormField>
            )}
            <FormField label="E-card / policy pack link">
              <input
                className="form-inp"
                placeholder="https://…"
                value={form.ecard_url}
                onChange={e => setForm(f => ({ ...f, ecard_url: e.target.value }))}
              />
            </FormField>
            <FormField label="Notes">
              <textarea className="form-inp" rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
          </form>
        </ModalShell>
      )}

      {premiumMode && (
        <ModalShell
          title="Record premium"
          onClose={() => setPremiumMode(null)}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel="Save"
              onSecondary={() => setPremiumMode(null)}
              onPrimary={savePremium}
              disabled={saving}
            />
          }
        >
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void savePremium() }} style={{ display: 'grid', gap: 12 }}>
            <FormField label="Policy">
              <select
                className="form-inp"
                value={premiumForm.policy_id}
                onChange={e => {
                  const policy = rows.find(r => r.id === e.target.value)
                  setPremiumForm(f => ({
                    ...f,
                    policy_id: e.target.value,
                    amount: f.amount || (policy?.premium_amount ? String(policy.premium_amount) : ''),
                  }))
                }}
              >
                <option value="">Select policy</option>
                {rows.map(r => (
                  <option key={r.id} value={r.id}>{r.plan_name || r.insurer || 'Policy'}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Date">
              <input className="form-inp" type="date" value={premiumForm.date} onChange={e => setPremiumForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Amount">
              <input className="form-inp" inputMode="decimal" value={premiumForm.amount} onChange={e => setPremiumForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
            <FormField label="Note">
              <input className="form-inp" value={premiumForm.note} onChange={e => setPremiumForm(f => ({ ...f, note: e.target.value }))} />
            </FormField>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Recording a premium here is for money that did not go through FinTracker. If you paid
              it from an account you track, add it as a transaction there and link it to this policy
              instead — that keeps it one fact rather than two.
            </div>
          </form>
        </ModalShell>
      )}

      {detail && (
        <ModalShell
          title={detail.plan_name || detail.policy_owner || 'Insurance Policy'}
          onClose={() => setDetail(null)}
          footer={
            <ModalActions
              secondaryLabel="Edit"
              primaryLabel="Close"
              onSecondary={() => {
                setDetail(null)
                startEdit(detail)
              }}
              onPrimary={() => setDetail(null)}
              leading={<button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void requestDelete(detail.id)} disabled={saving}>{saving ? 'Deleting…' : deleteConfirm && deleteId === detail.id ? 'Confirm delete?' : 'Delete'}</button>}
            />
          }
        >
          <div style={{ display: 'grid', gap: 12 }}>
            {(() => {
              // The card no longer carries these buttons — it was three stacked
              // controls in one corner. They belong here, where there is room to
              // label them.
              const app = apps.find(item => item.app_uuid === detail.app_uuid)
              const links: Array<{ label: string; url: string }> = []
              if (app?.app_link) links.push({ label: `Open ${app.app_name}`, url: app.app_link })
              if (detail.ecard_url) links.push({ label: 'View e-card', url: detail.ecard_url })
              if (!links.length) return null
              return (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {links.map(l => (
                    <button
                      key={l.label}
                      type="button"
                      className="ui-kit-btn ui-kit-btn--soft"
                      onClick={() => openInNewTab(l.url)}
                    >
                      <ExternalLink size={14} />
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              )
            })()}
            {/* Identity heads the sheet: the plan you are looking at, and the
                number you quote to the insurer. The number is the one field
                anyone needs to copy, so the button lives with it. */}
            <div style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Plan Name</div>
              <div style={{ color: 'var(--text)', fontWeight: 600, wordBreak: 'break-word', minWidth: 0 }}>
                {detail.plan_name || 'Untitled Policy'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 4 }}>Policy Number</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ color: 'var(--text)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em', wordBreak: 'break-word', minWidth: 0 }}>
                  {detail.policy_number || '—'}
                </div>
                {detail.policy_number && (
                  <button
                    type="button"
                    className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline"
                    onClick={() => void navigator.clipboard.writeText(detail.policy_number)}
                    style={{ width: 32, height: 32, padding: 0, justifyContent: 'center', flexShrink: 0 }}
                    aria-label="Copy policy number"
                    title="Copy policy number"
                  >
                    <Copy size={14} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {detailRows.map(([label, value]) => {
                return (
                  <div key={label} style={{ display: 'grid', gap: 8, alignContent: 'start', padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ color: 'var(--text)', fontWeight: 600, wordBreak: 'break-word', minWidth: 0 }}>{value}</div>
                    </div>
                  </div>
                )
              })}
            </div>
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
  )
}
