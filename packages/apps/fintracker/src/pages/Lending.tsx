import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Search, LayoutDashboard, Handshake, ArrowDownLeft, BarChart3, Shield, User, ArrowUpRight } from 'lucide-react'
import { api, RawLendingRow } from '../api'
import { INR } from '../utils'
import { FormField, HoldingCard, KpiCard, LoadingState, ModalActions, ModalShell, SearchField, SectionBlock, SectionChip, TabBar } from '../ui'

type LendType = 'LEND' | 'RECEIVED'
type LendTab = 'dashboard' | 'lended' | 'received'

interface LendingProps {
  sheetName: string
  onTabChange?: (tab: 'dashboard' | 'lended' | 'received') => void
}

interface LendingEntry {
  id: string
  date: string
  name: string
  amount: number
  type: LendType
  description: string
}

interface FormState {
  type: LendType
  name: string
  amount: string
  date: string
  description: string
}

interface PersonDetails {
  name: string
  totalLent: number
  totalRepaid: number
  outstanding: number
}

function todayISO() { return new Date().toISOString().split('T')[0] }
function toDateInput(dateStr: string): string {
  const clean = String(dateStr ?? '').trim()
  if (!clean) return todayISO()
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  const parsed = new Date(clean)
  if (!isNaN(parsed.getTime())) {
    const y = String(parsed.getFullYear()).padStart(4, '0')
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return todayISO()
}
function emptyForm(): FormState { return { type: 'LEND', name: '', amount: '', date: todayISO(), description: '' } }

function parseRow(raw: RawLendingRow): LendingEntry | null {
  let type = String(raw.type ?? '').trim().toUpperCase()
  if (type !== 'LEND' && type !== 'REPAY' && type !== 'RECEIVED') return null
  // Map backend REPAY to frontend RECEIVED
  if (type === 'REPAY') type = 'RECEIVED'
  const amount = parseFloat(String(raw.amount))
  if (isNaN(amount)) return null
  return {
    id: raw.id,
    date: String(raw.date ?? '').trim(),
    name: String(raw.name ?? '').trim(),
    amount,
    type: type as LendType,
    description: String(raw.description ?? '').trim(),
  }
}

function aggregateByPerson(entries: LendingEntry[]): PersonDetails[] {
  const grouped = new Map<string, { lend: number; repay: number }>()

  entries.forEach(e => {
    const existing = grouped.get(e.name) || { lend: 0, repay: 0 }
    if (e.type === 'LEND') existing.lend += e.amount
    else existing.repay += e.amount
    grouped.set(e.name, existing)
  })

  return Array.from(grouped.entries())
    .map(([name, { lend, repay }]) => ({
      name,
      totalLent: lend,
      totalRepaid: repay,
      outstanding: lend - repay,
    }))
    .sort((a, b) => Math.abs(b.outstanding) - Math.abs(a.outstanding))
}

interface PersonCardProps {
  person: PersonDetails
  onClick: () => void
}

const PersonCard = memo(function PersonCard({ person, onClick }: PersonCardProps) {
  const tone = person.outstanding > 0 ? 'red' : person.outstanding < 0 ? 'green' : 'navy'
  return (
    <HoldingCard
      title={person.name}
      leftLabel="Lent"
      leftValue={INR(person.totalLent)}
      rightLabel="Received"
      rightValue={INR(person.totalRepaid)}
      centerLabel="Status"
      centerValue={person.outstanding > 0 ? 'GIVEN' : person.outstanding < 0 ? 'CLEAR' : 'SETTLED'}
      pnlLabel="Outstanding"
      pnlValue={INR(Math.abs(person.outstanding))}
      accentTone={tone}
      icon={person.outstanding > 0 ? <ArrowUpRight size={14} /> : person.outstanding < 0 ? <ArrowDownLeft size={14} /> : <Shield size={14} />}
      iconPosition="right"
      iconBackground
      className="stock-entry-card"
      onClick={onClick}
    />
  )
})

const EntryCard = memo(function EntryCard({
  entry,
  label,
  useDescriptionAsTitle = false,
  onClick,
}: {
  entry: LendingEntry
  label: 'Given' | 'Received'
  useDescriptionAsTitle?: boolean
  onClick: () => void
}) {
  const title = useDescriptionAsTitle ? (entry.description || entry.name) : entry.name
  const tone = label === 'Given' ? 'red' : 'green'
  return (
    <HoldingCard
      title={title}
      subtitle={useDescriptionAsTitle ? undefined : entry.description}
      compactTitle={useDescriptionAsTitle}
      leftLabel="Amount"
      leftValue={INR(entry.amount)}
      centerLabel=" "
      centerValue=" "
      rightLabel="Date"
      rightValue={entry.date}
      accentTone={tone}
      icon={label === 'Given' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
      iconPosition="right"
      iconBackground
      className="stock-entry-card"
      onClick={onClick}
    />
  )
})

export default function Lending({ sheetName, onTabChange }: LendingProps) {
  const [entries, setEntries] = useState<LendingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<LendingEntry | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<LendTab>('dashboard')
  const [search, setSearch] = useState('')
  const [personModalOpen, setPersonModalOpen] = useState(false)
  const [personModalName, setPersonModalName] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await api.getLending(sheetName)
      setEntries(rows.map(parseRow).filter((e): e is LendingEntry => e !== null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [sheetName])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => { onTabChange?.(activeTab) }, [activeTab, onTabChange])

  // Memoize aggregated data to prevent unnecessary recalculations
  const people = useMemo(() => aggregateByPerson(entries), [entries])
  const totalPeople = people.length

  const totalLent = useMemo(() =>
    entries.filter(e => e.type === 'LEND').reduce((s, e) => s + e.amount, 0),
    [entries]
  )

  const totalRepaid = useMemo(() =>
    entries.filter(e => e.type === 'RECEIVED').reduce((s, e) => s + e.amount, 0),
    [entries]
  )

  function set(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function openAdd() {
    setEditEntry(null)
    setForm(emptyForm())
    setDelConfirm(false)
    setModalOpen(true)
  }

  function openEdit(e: LendingEntry) {
    setEditEntry(e)
    setForm({ type: e.type, name: e.name, amount: String(e.amount), date: toDateInput(e.date), description: e.description })
    setDelConfirm(false)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditEntry(null)
    setForm(emptyForm())
    setDelConfirm(false)
    setSaving(false)
  }

  async function save() {
    if (!form.name.trim() || !form.amount) return
    setSaving(true)
    // Convert RECEIVED back to REPAY for API
    const apiType = form.type === 'RECEIVED' ? 'REPAY' : form.type
    const p = { date: form.date, name: form.name.trim(), amount: parseFloat(form.amount), type: apiType, description: form.description.trim() }
    try {
      if (editEntry) await api.updateLending({ ...p, id: editEntry.id }, sheetName)
      else await api.addLending(p, sheetName)
      api.invalidateCache({ action: 'getEntries', params: { module: 'lending', ...(sheetName && sheetName !== 'Lending' ? { sheetName } : {}) } })
      setModalOpen(false)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    if (!delConfirm) { setDelConfirm(true); return }
    if (!editEntry) return
    setSaving(true)
    try {
      await api.deleteLending(editEntry.id, sheetName)
      api.invalidateCache({ action: 'getEntries', params: { module: 'lending', ...(sheetName && sheetName !== 'Lending' ? { sheetName } : {}) } })
      setModalOpen(false)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const outstanding = totalLent - totalRepaid

  // Filter people based on search
  const searchQuery = search.trim().toLowerCase()
  const filteredPeople = useMemo(() => {
    return people.filter(p => p.name.toLowerCase().includes(searchQuery))
  }, [people, searchQuery])

  // Flat transaction lists for lended/received tabs
  const lendedEntries = useMemo(() =>
    entries.filter(e => e.type === 'LEND')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries]
  )

  const receivedEntries = useMemo(() =>
    entries.filter(e => e.type === 'RECEIVED')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries]
  )

  const filteredLendedEntries = useMemo(() => {
    return lendedEntries.filter(e => !searchQuery || e.name.toLowerCase().includes(searchQuery) || e.description.toLowerCase().includes(searchQuery))
  }, [lendedEntries, searchQuery])

  const filteredReceivedEntries = useMemo(() => {
    return receivedEntries.filter(e => !searchQuery || e.name.toLowerCase().includes(searchQuery) || e.description.toLowerCase().includes(searchQuery))
  }, [receivedEntries, searchQuery])

  // Get person details for the bottom sheet
  const personDetails = personModalName ? people.find(p => p.name === personModalName) : null
  const personModalEntries = useMemo(() => {
    if (!personModalName) return []
    return entries.filter(e => e.name === personModalName).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [entries, personModalName])

  const TAB_CONFIG = [
    { id: 'dashboard' as const, icon: <LayoutDashboard size={19} />, label: 'Dashboard' },
    { id: 'lended' as const, icon: <Handshake size={19} />, label: 'Given' },
    { id: 'received' as const, icon: <ArrowDownLeft size={19} />, label: 'Received' },
  ]

  const shouldUseDescriptionAsTitle = (entry: LendingEntry) =>
    !entry.name.trim() || entry.name.trim().toLowerCase() === 'vijaya amma'

  const isVijayaAmma = sheetName.trim().toLowerCase() === 'vijaya amma'
  const sheetTone = isVijayaAmma ? 'amber' : 'navy'

  return (
    <div className="ui-kit-page-shell">
      <TabBar
        tabs={TAB_CONFIG}
        active={activeTab}
        onChange={id => setActiveTab(id as LendTab)}
      />

    <div className="pg" style={{ padding: 0 }}>
        {activeTab === 'dashboard' ? (
          <>
            <SectionBlock
              title="Metrics"
              icon={<BarChart3 size={14} />}
              right={<SectionChip tone={sheetTone}>{sheetName}</SectionChip>}
            >
              <div className="dash-grid">
                <KpiCard label="Given" value={INR(totalLent)} tone="navy" icon={<ArrowUpRight size={14} />} />
                <KpiCard label="Received" value={INR(totalRepaid)} tone="green" icon={<ArrowDownLeft size={14} />} />
                <KpiCard label="Outstanding" value={INR(Math.abs(outstanding))} tone="amber" icon={<Shield size={14} />} />
                <KpiCard label="People" value={totalPeople} tone="muted" icon={<User size={14} />} />
              </div>
            </SectionBlock>

            <SectionBlock
              title="People"
              icon={<Handshake size={14} />}
              right={<SectionChip tone={sheetTone}>{filteredPeople.length}</SectionChip>}
            >
              <div className="ui-stack">
                <SearchField
                  value={search}
                  placeholder="Search people..."
                  onChange={setSearch}
                  onClear={() => setSearch('')}
                  prefix={<Search size={15} />}
                />
                {loading ? (
                  <LoadingState variant="section" />
                ) : error ? (
                  <p style={{ color: '#EF4444', fontSize: 13, padding: '0.5rem 0' }}>⚠ {error}</p>
                ) : filteredPeople.length === 0 ? (
                  <p style={{ color: 'var(--muted)', padding: '0.5rem 0', fontSize: 14 }}>
                    {search ? 'No matches found.' : 'No data to display.'}
                  </p>
                ) : (
                  <div style={{ display: 'grid', rowGap: 8, columnGap: 0 }}>
                    {filteredPeople.map(person => (
                      <PersonCard
                        key={person.name}
                        person={person}
                        onClick={() => {
                          setPersonModalName(person.name)
                          setPersonModalOpen(true)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </SectionBlock>
          </>
        ) : (
          <>
            <SectionBlock
              title="Entries"
              icon={<Search size={14} />}
              right={<SectionChip tone={sheetTone}>{activeTab === 'lended' ? filteredLendedEntries.length : filteredReceivedEntries.length}</SectionChip>}
            >
              <SearchField
                value={search}
                placeholder="Search people..."
                onChange={setSearch}
                onClear={() => setSearch('')}
                prefix={<Search size={15} />}
              />
              <div style={{ height: 8 }} />
              {loading ? (
                <LoadingState variant="section" />
              ) : error ? (
                <p style={{ color: '#EF4444', fontSize: 13, padding: '0.5rem 0' }}>⚠ {error}</p>
              ) : activeTab === 'lended' ? (
                filteredLendedEntries.length === 0 ? (
                  <p style={{ color: 'var(--muted)', padding: '0.5rem 0', fontSize: 14 }}>No transactions yet.</p>
                ) : (
                  <div style={{ display: 'grid', rowGap: 8, columnGap: 0 }}>
                    {filteredLendedEntries.map(e => (
                      <EntryCard
                        key={e.id}
                        entry={e}
                        label="Given"
                        useDescriptionAsTitle={shouldUseDescriptionAsTitle(e)}
                        onClick={() => openEdit(e)}
                      />
                    ))}
                  </div>
                )
              ) : (
                filteredReceivedEntries.length === 0 ? (
                  <p style={{ color: 'var(--muted)', padding: '0.5rem 0', fontSize: 14 }}>No transactions yet.</p>
                ) : (
                  <div style={{ display: 'grid', rowGap: 8, columnGap: 0 }}>
                    {filteredReceivedEntries.map(e => (
                      <EntryCard
                        key={e.id}
                        entry={e}
                        label="Received"
                        useDescriptionAsTitle={shouldUseDescriptionAsTitle(e)}
                        onClick={() => openEdit(e)}
                      />
                    ))}
                  </div>
                )
              )}
            </SectionBlock>
          </>
        )}
      </div>

      {modalOpen && (
        <ModalShell
          title={editEntry ? 'Edit Entry' : 'Add Entry'}
          onClose={closeModal}
          footer={
            <ModalActions
              primaryLabel={saving ? 'Saving…' : editEntry ? 'Save' : 'Add'}
              secondaryLabel="Cancel"
              onPrimary={save}
              onSecondary={closeModal}
              leading={editEntry ? (
                <button className="btn btn-red btn-sm" onClick={del} disabled={saving}>
                  {delConfirm ? 'Confirm delete?' : 'Delete'}
                </button>
              ) : null}
              disabled={saving}
            />
          }
        >
          <div style={{ display: 'grid', rowGap: 8, columnGap: 0 }}>
            <FormField label="Type">
              <select className="form-sel" value={form.type} onChange={e => set('type', e.target.value as LendType)}>
                <option value="LEND">LEND</option>
                <option value="RECEIVED">RECEIVED</option>
              </select>
            </FormField>
            <FormField label="Name">
              <input className="form-inp" type="text" placeholder="Who?" value={form.name} onChange={e => set('name', e.target.value)} />
            </FormField>
            <FormField label="Amount (₹)">
              <input className="form-inp" type="number" min="0" step="1" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </FormField>
            <FormField label="Date">
              <input className="form-inp" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </FormField>
            <FormField label="Description">
              <input className="form-inp" type="text" placeholder="Optional" value={form.description} onChange={e => set('description', e.target.value)} />
            </FormField>
          </div>
        </ModalShell>
      )}

      {personModalOpen && personModalName && personDetails && (
        <ModalShell
          title={personModalName}
          onClose={() => setPersonModalOpen(false)}
        >
          <div style={{ display: 'grid', rowGap: 8, columnGap: 0 }}>
            <div className="dash-grid">
              <KpiCard label="Lent" value={INR(personDetails.totalLent)} tone="red" icon={<Handshake size={14} />} />
              <KpiCard label="Received" value={INR(personDetails.totalRepaid)} tone="green" icon={<ArrowDownLeft size={14} />} />
              <KpiCard label="Outstanding" value={INR(Math.abs(personDetails.outstanding))} tone="muted" icon={<Shield size={14} />} />
            </div>
            {personModalEntries.length === 0 ? (
              <p style={{ color: 'var(--muted)', padding: '0.5rem 0', fontSize: 14, textAlign: 'center' }}>
                No entries for this person.
              </p>
            ) : (
              <div style={{ display: 'grid', rowGap: 8, columnGap: 0 }}>
                {personModalEntries.map(e => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    label={e.type === 'LEND' ? 'Given' : 'Received'}
                    useDescriptionAsTitle={shouldUseDescriptionAsTitle(e)}
                    onClick={() => {
                      openEdit(e)
                      setPersonModalOpen(false)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </ModalShell>
      )}

      <button
        onClick={openAdd}
        style={{ position:'fixed', bottom:24, right:20, width:52, height:52, borderRadius:'50%', background:'var(--navy-dark)', color:'#fff', fontSize:24, border:'none', boxShadow:'0 4px 16px rgba(0,0,0,.2)', cursor:'pointer', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}
        title="Add entry"
      >+</button>
    </div>
  )
}
