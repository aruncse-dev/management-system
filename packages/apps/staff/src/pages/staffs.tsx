import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { api } from '../api'
import { useStaffWorkspace } from '../StaffWorkspaceContext'
import type { SalaryBasis, StaffMember } from '../types'
import {
  FormField,
  LoadingState,
  ModalActions,
  ModalShell,
  SearchField,
  SectionBlock,
  Spacer,
  TransactionCard,
  UiPill,
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

export default function StaffsPage() {
  const { staffList: rows, staffLoading: loading, staffError, refreshStaff } = useStaffWorkspace()
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState<ModalMode | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [salaryType, setSalaryType] = useState<SalaryBasis>('daily')
  const [salaryAmount, setSalaryAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalErr, setModalErr] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(s => s.name.toLowerCase().includes(q))
  }, [rows, search])

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
    setSalaryType('daily')
    setSalaryAmount('')
  }

  function openEdit(s: StaffMember) {
    setModalErr('')
    setModalMode('edit')
    setEditId(s.id)
    setName(s.name)
    setSalaryType(s.salaryType)
    setSalaryAmount(String(s.salaryAmount ?? 0))
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
    setModalErr('')
    setSaving(true)
    let successMsg = ''
    let closedModal = false
    try {
      if (modalMode === 'add') {
        await api.addStaff({ name: n, salaryType, salaryAmount: amt })
        successMsg = '✓ Added'
      } else if (modalMode === 'edit' && editId) {
        await api.updateStaff({ id: editId, name: n, salaryType, salaryAmount: amt })
        successMsg = '✓ Saved'
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
      <SectionBlock title="Staff" icon={<Users size={16} />} right={<UiPill tone="navy">{rows.length}</UiPill>}>
        <div className="ui-stack">
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
                <span>{rows.length} total</span>
              </>
            ) : (
              <span>
                {rows.length} staff
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
            <span>{rows.length === 0 ? 'No staff yet.' : 'No matches for this search.'}</span>
            {rows.length > 0 ? (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>
                {rows.length} staff total
              </span>
            ) : null}
          </div>
        ) : (
          <div className="txn-cards">
            {filtered.map(s => (
              <TransactionCard
                key={s.id}
                title={s.name}
                amount={`₹${s.salaryAmount}`}
                type=""
                typeLabel=""
                date={s.salaryType === 'monthly' ? 'Monthly' : 'Per day'}
                dateLabel="Basis"
                tone="navy"
                icon={<Users size={14} />}
                onClick={() => openEdit(s)}
              />
            ))}
          </div>
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
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}
