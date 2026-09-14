import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, UserCheck, Users, UserX } from 'lucide-react'
import { api } from '../api'
import { useStaffWorkspace } from '../StaffWorkspaceContext'
import { WEEKLY_OFF_LABELS, type SalaryBasis, type StaffMember, type WeeklyOff } from '../types'
import {
  FormField,
  ListStack,
  LoadingState,
  ModalActions,
  ModalShell,
  SearchField,
  SectionBlock,
  SectionChip,
  Spacer,
  TransactionCard,
} from '../ui'

const fabStyle = {
  position: 'fixed' as const,
  bottom: 24,
  right: 20,
  width: 56,
  height: 56,
  borderRadius: '50%',
  border: 'none',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 110,
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
}

type ModalMode = 'add' | 'edit'

/** Search is only useful once the list is a bit long; threshold is exclusive of 4 (i.e. show at 5+). */
const STAFF_SEARCH_MIN_COUNT = 5

const WEEKLY_OFF_OPTIONS: WeeklyOff[] = ['none', 'sunday', 'sat_sun']

/** The single sub-line on a staff row: only what differs between people. */
function staffMeta(s: StaffMember) {
  const bits: string[] = []
  if (!s.active) bits.push('Inactive')
  // Weekly off and leave only affect monthly pay; showing them on a daily worker
  // implies a rule that is not applied to them.
  if (s.salaryType === 'monthly') {
    bits.push(s.weeklyOff === 'none' ? 'No weekly off' : s.weeklyOff === 'sunday' ? 'Sun off' : 'Sat+Sun off')
    if (s.paidLeavesPerMonth > 0) bits.push(`${s.paidLeavesPerMonth} paid leave`)
  } else {
    bits.push('Paid per day worked')
  }
  return bits.join(' · ')
}

const STATUS_FILTERS = ['Active', 'Inactive', 'All'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

export default function StaffsPage() {
  const { staffList: rows, staffLoading: loading, staffError, refreshStaff } = useStaffWorkspace()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Active')
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState<ModalMode | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [salaryType, setSalaryType] = useState<SalaryBasis>('daily')
  const [salaryAmount, setSalaryAmount] = useState('')
  const [weeklyOff, setWeeklyOff] = useState<WeeklyOff>('none')
  const [paidLeaves, setPaidLeaves] = useState('0')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalErr, setModalErr] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }, [])

  const activeCount = useMemo(() => rows.filter(s => s.active).length, [rows])
  const inactiveCount = rows.length - activeCount

  const scoped = useMemo(() => {
    if (statusFilter === 'All') return rows
    const wantActive = statusFilter === 'Active'
    return rows.filter(s => s.active === wantActive)
  }, [rows, statusFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scoped
    return scoped.filter(s => s.name.toLowerCase().includes(q))
  }, [scoped, search])

  const showSearch = rows.length >= STAFF_SEARCH_MIN_COUNT
  const searchActive = showSearch && search.trim().length > 0

  useEffect(() => {
    if (!showSearch && search) setSearch('')
  }, [showSearch, search])

  function openAdd() {
    setModalErr('')
    setModalMode('add')
    setEditId(null)
    setName('')
    setGender('')
    setSalaryType('daily')
    setSalaryAmount('')
    setWeeklyOff('none')
    setPaidLeaves('0')
    setActive(true)
  }

  function openEdit(s: StaffMember) {
    setModalErr('')
    setModalMode('edit')
    setEditId(s.id)
    setName(s.name)
    setGender(s.gender ?? '')
    setSalaryType(s.salaryType)
    setSalaryAmount(String(s.salaryAmount ?? 0))
    setWeeklyOff(s.weeklyOff ?? 'none')
    setPaidLeaves(String(s.paidLeavesPerMonth ?? 0))
    setActive(s.active)
  }

  function dismissModal() {
    if (saving) return
    setModalErr('')
    setModalMode(null)
    setEditId(null)
  }

  async function submitModal() {
    const n = name.trim()
    if (!n) {
      setModalErr('Name is required.')
      return
    }
    const amt = parseFloat(salaryAmount)
    if (Number.isNaN(amt) || amt < 0) {
      setModalErr('Enter a valid amount.')
      return
    }
    const leaves = parseInt(paidLeaves, 10)
    if (Number.isNaN(leaves) || leaves < 0 || leaves > 31) {
      setModalErr('Paid leaves must be between 0 and 31.')
      return
    }
    setModalErr('')
    setSaving(true)
    let successMsg = ''
    let closedModal = false
    try {
      if (modalMode === 'add') {
        await api.addStaff({
          name: n,
          gender: gender || undefined,
          salaryType,
          salaryAmount: amt,
          weeklyOff,
          paidLeavesPerMonth: leaves,
        })
        successMsg = '✓ Added'
      } else if (modalMode === 'edit' && editId) {
        // Always send `active` — the API only touches status when it is present.
        await api.updateStaff({
          id: editId,
          name: n,
          active,
          gender: gender || undefined,
          salaryType,
          salaryAmount: amt,
          weeklyOff,
          paidLeavesPerMonth: leaves,
        })
        successMsg = active ? '✓ Saved' : '✓ Saved as inactive'
      }
      setModalMode(null)
      setEditId(null)
      closedModal = true
      await refreshStaff({ soft: true })
      if (successMsg) showToast(successMsg)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      if (closedModal) showToast('⚠ ' + msg)
      else setModalErr(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ui-kit-page-shell" style={{ paddingTop: 0 }}>
      <SectionBlock title="Staff" icon={<Users size={16} />} right={<SectionChip>{rows.length}</SectionChip>}>
        <div className="ui-stack">
          {inactiveCount > 0 ? (
            <div className="ui-kit-filter-chips" role="radiogroup" aria-label="Staff status">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={statusFilter === f}
                  className={`ui-kit-filter-chip${statusFilter === f ? ' active' : ''}`}
                  onClick={() => setStatusFilter(f)}
                >
                  {f === 'Active' ? `Active (${activeCount})` : f === 'Inactive' ? `Inactive (${inactiveCount})` : `All (${rows.length})`}
                </button>
              ))}
            </div>
          ) : null}
          {showSearch ? (
            <SearchField
              value={search}
              placeholder="Search staff…"
              onChange={setSearch}
              onClear={() => setSearch('')}
              prefix={<Search size={14} />}
            />
          ) : null}
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {searchActive ? (
              <>
                <span>{filtered.length} matching</span>
                <span aria-hidden> · </span>
                <span>{scoped.length} {statusFilter.toLowerCase()}</span>
              </>
            ) : (
              <span>
                {scoped.length} {statusFilter === 'All' ? 'staff' : `${statusFilter.toLowerCase()} staff`}
              </span>
            )}
          </div>
          {staffError ? <div className="settings-alert">⚠ {staffError}</div> : null}
          {toast ? (
            <div className={`settings-alert${toast.startsWith('✓') ? ' settings-alert--success' : ''}`}>{toast}</div>
          ) : null}
        </div>
      </SectionBlock>
      <Spacer size={12} />

      <main className="staffs-page-main">
        {loading ? (
          <LoadingState variant="page" label="Loading staff…" />
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: '18px 14px',
              color: 'var(--muted)',
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center',
              display: 'grid',
              gap: 6,
            }}
          >
            <span>
              {rows.length === 0
                ? 'No staff yet.'
                : searchActive
                  ? 'No matches for this search.'
                  : `No ${statusFilter.toLowerCase()} staff.`}
            </span>
            {rows.length > 0 ? (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>
                {rows.length} staff total
              </span>
            ) : null}
          </div>
        ) : (
          <ListStack>
            {filtered.map(s => (
              <TransactionCard
                key={s.id}
                variant="row"
                title={s.name}
                meta={staffMeta(s)}
                amount={`₹${s.salaryAmount.toLocaleString('en-IN')}${s.salaryType === 'monthly' ? '/mo' : '/day'}`}
                tone={s.active ? 'navy' : 'muted'}
                icon={s.active ? <Users size={14} /> : <UserX size={14} />}
                onClick={() => openEdit(s)}
              />
            ))}
          </ListStack>
        )}
      </main>

      <button type="button" style={{ ...fabStyle, background: 'var(--navy-dark)' }} onClick={openAdd} aria-label="Add staff">
        <Plus size={26} strokeWidth={2.2} />
      </button>

      {modalMode ? (
        <ModalShell
          title={modalMode === 'add' ? 'Add staff' : 'Edit staff'}
          onClose={dismissModal}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={saving ? 'Saving…' : 'Save'}
              disabled={saving}
              onSecondary={dismissModal}
              onPrimary={() => void submitModal()}
            />
          }
        >
          <div style={{ display: 'grid', gap: 14 }}>
            {modalErr ? <div className="staff-modal-alert staff-modal-alert--error">{modalErr}</div> : null}
            <FormField label="Name">
              <input className="form-inp" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            </FormField>
            <FormField label="Gender">
              <select className="form-sel" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">—</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </FormField>
            <FormField label="Salary basis">
              <div className="ui-kit-filter-chips" role="radiogroup" aria-label="Salary basis">
                <button
                  type="button"
                  role="radio"
                  aria-checked={salaryType === 'daily'}
                  className={`ui-kit-filter-chip${salaryType === 'daily' ? ' active' : ''}`}
                  onClick={() => setSalaryType('daily')}
                >
                  Per day
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={salaryType === 'monthly'}
                  className={`ui-kit-filter-chip${salaryType === 'monthly' ? ' active' : ''}`}
                  onClick={() => setSalaryType('monthly')}
                >
                  Monthly
                </button>
              </div>
            </FormField>
            <FormField label={salaryType === 'monthly' ? 'Monthly salary' : 'Daily rate'}>
              <input
                className="form-inp"
                inputMode="decimal"
                value={salaryAmount}
                onChange={e => setSalaryAmount(e.target.value)}
                placeholder="0"
              />
            </FormField>
            {salaryType === 'monthly' ? (
              <>
            <FormField label="Weekly off" hint="Days they are not expected in. Sets the month's expected working days.">
              <div className="ui-kit-filter-chips" role="radiogroup" aria-label="Weekly off">
                {WEEKLY_OFF_OPTIONS.map(w => (
                  <button
                    key={w}
                    type="button"
                    role="radio"
                    aria-checked={weeklyOff === w}
                    className={`ui-kit-filter-chip${weeklyOff === w ? ' active' : ''}`}
                    onClick={() => setWeeklyOff(w)}
                  >
                    {w === 'none' ? 'None' : w === 'sunday' ? 'Sunday' : 'Sat + Sun'}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Paid leaves per month" hint="Absences beyond this are deducted from the monthly salary.">
              <input
                className="form-inp"
                inputMode="numeric"
                value={paidLeaves}
                onChange={e => setPaidLeaves(e.target.value)}
                placeholder="0"
              />
            </FormField>
              </>
            ) : null}
            {modalMode === 'edit' ? (
              <FormField
                label="Status"
                hint={
                  active
                    ? 'Can be marked on the attendance calendar.'
                    : 'Hidden from the attendance calendar. Past attendance and history are kept.'
                }
              >
                <div className="ui-kit-filter-chips" role="radiogroup" aria-label="Status">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`ui-kit-filter-chip${active ? ' active' : ''}`}
                    onClick={() => setActive(true)}
                  >
                    <UserCheck size={13} /> Active
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!active}
                    className={`ui-kit-filter-chip${!active ? ' active' : ''}`}
                    onClick={() => setActive(false)}
                  >
                    <UserX size={13} /> Inactive
                  </button>
                </div>
              </FormField>
            ) : null}
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}
