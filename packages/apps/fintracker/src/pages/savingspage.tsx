import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, LayoutDashboard, List, BarChart3, Wallet, Search, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Repeat2 } from 'lucide-react'
import { api, RawSavingsRow } from '../api'
import { CATEGORIES, THEME_COLORS } from '../config'
import { INR } from '../utils'
import { BalanceRow, CatIcon, FormField, KpiCard, KpiGrid, LoadingState, SearchField, SectionBlock, Spacer, TransactionCard } from '../ui'

type SavingsType = 'Income' | 'Expense' | 'Transfer'
type SavingsTab = 'dashboard' | 'transactions'

export interface SavingsPageConfig {
  sheetName: string
  accounts: readonly string[]
  title: string
  addButtonTitle?: string
}

const DEFAULT_ACCOUNTS = ['Amma IB', 'Ramya IB', 'Arun IB', 'Amma SBI', 'Cash'] as const

interface SavingsEntry {
  id: string
  date: string
  account: string
  amount: number
  desc: string
  type: SavingsType
  toAccount?: string
  category?: string
}

interface SavingsFormState {
  date: string
  account: string
  amount: string
  desc: string
  type: SavingsType
  toAccount: string
  category: string
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function toDateInput(dateStr: string): string {
  const clean = String(dateStr ?? '').trim().split('T')[0]
  const ymd = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`

  const dmmy = clean.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/)
  if (dmmy) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const monthIndex = months.indexOf(dmmy[2].toLowerCase())
    if (monthIndex !== -1) {
      return `${String(2000 + parseInt(dmmy[3], 10)).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${dmmy[1]}`
    }
  }

  const parsed = new Date(clean)
  if (!isNaN(parsed.getTime())) {
    const y = String(parsed.getUTCFullYear()).padStart(4, '0')
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    const d = String(parsed.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return todayISO()
}

function makeEmptyForm(accounts: readonly string[]): SavingsFormState {
  return {
    date: todayISO(),
    account: accounts[0] ?? '',
    amount: '',
    desc: '',
    type: 'Income',
    toAccount: accounts[1] ?? accounts[0] ?? '',
    category: 'Others',
  }
}

function parseRow(raw: RawSavingsRow, accounts: readonly string[]): SavingsEntry | null {
  const type = String(raw.type ?? '').trim().toUpperCase()
  if (type !== 'INCOME' && type !== 'EXPENSE' && type !== 'TRANSFER') return null
  const amount = parseFloat(String(raw.amount))
  if (isNaN(amount) || amount <= 0) return null
  const account = String(raw.account ?? '').trim()
  if (!accounts.includes(account)) return null

  const entry: SavingsEntry = {
    id: raw.id,
    date: String(raw.date ?? '').trim(),
    account,
    amount,
    desc: String(raw.desc ?? '').trim(),
    type: (type === 'INCOME' ? 'Income' : type === 'EXPENSE' ? 'Expense' : 'Transfer') as SavingsType,
    category: type === 'EXPENSE' ? (String(raw.category ?? '').trim() || 'Others') : undefined,
  }
  if (type === 'TRANSFER') {
    const to = String(raw.toAccount ?? '').trim()
    if (accounts.includes(to)) entry.toAccount = to
  }
  return entry
}

function computeBalances(entries: SavingsEntry[], accounts: readonly string[]): Record<string, number> {
  const balances = Object.fromEntries(accounts.map(a => [a, 0])) as Record<string, number>
  for (const e of entries) {
    if (e.type === 'Income') balances[e.account] += e.amount
    if (e.type === 'Expense') balances[e.account] -= e.amount
    if (e.type === 'Transfer') {
      balances[e.account] -= e.amount
      if (e.toAccount) balances[e.toAccount] += e.amount
    }
  }
  return balances
}

function signedINR(n: number): string {
  const value = INR(n)
  return n < 0 ? `-${value}` : value
}

function typeTone(type: SavingsType) {
  if (type === 'Income') return 'green'
  if (type === 'Transfer') return 'amber'
  return 'red'
}

export default function SavingsPage({
  sheetName = 'Savings',
  accounts = DEFAULT_ACCOUNTS,
  title = 'Savings',
  addButtonTitle,
}: SavingsPageConfig) {
  const [entries, setEntries] = useState<SavingsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<SavingsTab>('dashboard')
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<SavingsEntry | null>(null)
  const [form, setForm] = useState<SavingsFormState>(makeEmptyForm(accounts))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await api.getSavings(sheetName)
      setEntries(rows.map(row => parseRow(row, accounts)).filter((e): e is SavingsEntry => e !== null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [accounts, sheetName])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const balances = useMemo(() => computeBalances(entries, accounts), [accounts, entries])
  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + (balances[a] || 0), 0), [accounts, balances])
  const totalIncome = useMemo(() => entries.filter(e => e.type === 'Income' || e.type === 'Transfer').reduce((s, e) => s + e.amount, 0), [entries])
  const totalExpenses = useMemo(() => entries.filter(e => e.type === 'Expense' || e.type === 'Transfer').reduce((s, e) => s + e.amount, 0), [entries])

  const accountSummary = useMemo(
    () => accounts.map(account => {
      const accountEntries = entries.filter(e => e.account === account)
      const transferOut = accountEntries.filter(e => e.type === 'Transfer').reduce((s, e) => s + e.amount, 0)
      const transferIn = entries.filter(e => e.type === 'Transfer' && e.toAccount === account).reduce((s, e) => s + e.amount, 0)
      const income = accountEntries.filter(e => e.type === 'Income').reduce((s, e) => s + e.amount, 0) + transferIn
      const expense = accountEntries.filter(e => e.type === 'Expense').reduce((s, e) => s + e.amount, 0) + transferOut
      return { account, balance: balances[account] || 0, income, expense }
    }),
    [accounts, balances, entries],
  )

  const filteredEntries = useMemo(() => {
    return entries
      .filter(e => typeFilter === 'All' || e.type === typeFilter)
      .filter(e => {
        const q = search.toLowerCase()
        return !q || e.desc.toLowerCase().includes(q) || e.account.toLowerCase().includes(q) || e.type.toLowerCase().includes(q) || (e.category?.toLowerCase().includes(q) ?? false)
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [entries, typeFilter, search])

  function resetModal() {
    setEditEntry(null)
    setForm(makeEmptyForm(accounts))
  }

  function closeModal() {
    setError('')
    setModalOpen(false)
    resetModal()
    setSaving(false)
    setDeleting(false)
  }

  function openAdd() {
    resetModal()
    setError('')
    setModalOpen(true)
  }

  function openEdit(e: SavingsEntry) {
    setEditEntry(e)
    setError('')
    setForm({
      date: toDateInput(e.date),
      account: e.account,
      amount: String(e.amount),
      desc: e.desc,
      type: e.type,
      toAccount: e.toAccount ?? accounts.find(a => a !== e.account) ?? accounts[0] ?? '',
      category: e.category ?? 'Others',
    })
    setModalOpen(true)
  }

  function setField<K extends keyof SavingsFormState>(k: K, v: SavingsFormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    if (!form.amount || parseFloat(form.amount) <= 0 || saving || deleting) return
    setSaving(true)
    setError('')
    const payload: Record<string, unknown> = {
      date: form.date,
      account: form.account,
      amount: parseFloat(form.amount),
      desc: form.desc.trim(),
      type: form.type === 'Income' ? 'INCOME' : form.type === 'Expense' ? 'EXPENSE' : 'TRANSFER',
    }
    if (form.type === 'Transfer') payload.toAccount = form.toAccount
    if (form.type === 'Expense') payload.category = form.category
    try {
      if (editEntry) await api.updateSavings({ ...payload, id: editEntry.id }, sheetName)
      else await api.addSavings(payload, sheetName)
      api.invalidateCache({ action: 'getEntries', params: { module: 'savings', ...(sheetName !== 'Savings' ? { sheetName } : {}) } })
      closeModal()
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    if (!editEntry || deleting || saving) return
    setDeleting(true)
    setError('')
    const deletingId = editEntry.id
    try {
      await api.deleteSavings(deletingId, sheetName)
      setEntries(prev => prev.filter(entry => entry.id !== deletingId))
      api.invalidateCache({ action: 'getEntries', params: { module: 'savings', ...(sheetName !== 'Savings' ? { sheetName } : {}) } })
      closeModal()
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="ui-kit-page-shell savings-page">
      <nav className="bottom-nav">
        <button
          type="button"
          className={`bottom-nav-item${activeTab === 'dashboard' ? ' active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="bottom-nav-icon"><LayoutDashboard size={19} /></span>
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item${activeTab === 'transactions' ? ' active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <span className="bottom-nav-icon"><List size={19} /></span>
          <span>Transactions</span>
        </button>
      </nav>

      <div className="pg savings-page">
        {activeTab === 'dashboard' && (
          <>
            <SectionBlock title={`${title} Metrics`} icon={<BarChart3 size={14} />} right={loading ? <LoadingState variant="inline" /> : null}>
              <KpiGrid>
                <KpiCard label="Total Balance" value={signedINR(totalBalance)} tone="navy" icon={<Wallet size={14} />} />
                <KpiCard label="Total Income" value={INR(totalIncome)} tone="green" icon={<TrendingUp size={14} />} />
                <KpiCard label="Total Expenses" value={INR(totalExpenses)} tone="red" icon={<AlertTriangle size={14} />} />
              </KpiGrid>
            </SectionBlock>

            <Spacer size={6} />
            <SectionBlock title="Accounts" icon={<Wallet size={14} />}>
              <div className="ui-stack">
                {accountSummary.map(({ account, balance, income, expense }) => (
                  <div key={account}>
                    <BalanceRow
                      title={account}
                      value={signedINR(balance)}
                      income={INR(income)}
                      expense={INR(expense)}
                      incomeIcon={<ArrowDownRight size={11} strokeWidth={2.4} />}
                      expenseIcon={<ArrowUpRight size={11} strokeWidth={2.4} />}
                    />
                  </div>
                ))}
              </div>
            </SectionBlock>
          </>
        )}

        {activeTab === 'transactions' && (
          <SectionBlock title="Entries" icon={<LayoutDashboard size={14} />} right={<span className="ui-kit-section-chip ui-tone-muted">{filteredEntries.length}</span>}>
            <SearchField
              value={search}
              placeholder="Search desc, account, type..."
              onChange={setSearch}
              onClear={() => setSearch('')}
              prefix={<Search size={15} />}
            />
            <Spacer size={8} />
            <div className="pills">
              {['All', 'Income', 'Expense', 'Transfer'].map(item => (
                <button
                  key={item}
                  type="button"
                  className={`pill ${typeFilter === item ? 'active' : ''}`}
                  onClick={() => setTypeFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            {loading && <LoadingState variant="section" />}

            {!loading && filteredEntries.length === 0 && (
              <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>No entries to display.</p>
            )}

            {!loading && filteredEntries.length > 0 && (
              <div className="txn-cards">
                {filteredEntries.map(e => {
                  let titleText = ''
                  if (e.type === 'Transfer' && e.toAccount) {
                    titleText = e.desc?.trim() ? `${e.desc} · ${e.account} → ${e.toAccount}` : `${e.account} → ${e.toAccount}`
                  } else {
                    titleText = e.desc || e.account
                  }
                  return (
                    <TransactionCard
                      key={e.id}
                      title={
                        e.type === 'Expense' && e.category
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CatIcon cat={e.category} size={14} />{titleText}</span>
                          : titleText
                      }
                      amount={`${e.type === 'Income' ? '+' : e.type === 'Transfer' ? '↔' : '−'}${INR(e.amount)}`}
                      type={e.type}
                      date={e.date}
                      tone={typeTone(e.type)}
                      icon={e.type === 'Income' ? <ArrowDownRight size={14} /> : e.type === 'Transfer' ? <Repeat2 size={14} /> : <ArrowUpRight size={14} />}
                      onClick={() => openEdit(e)}
                    />
                  )
                })}
              </div>
            )}
          </SectionBlock>
        )}

        {error && (
          <p style={{ color: THEME_COLORS[5], fontSize: 13, padding: '12px 10px', marginTop: 12 }}>
            {'⚠ '}{error}
          </p>
        )}
      </div>

      <button
        onClick={openAdd}
        style={{
          position: 'fixed', bottom: 24, right: 20,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--navy-dark)', color: '#fff',
          border: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,.2)',
          cursor: 'pointer', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title={addButtonTitle ?? `Add ${title.toLowerCase()} entry`}
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {modalOpen && (
        <div className="modal-bg open" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <span className="modal-title">{editEntry ? `Edit ${title} Transaction` : `Add ${title} Transaction`}</span>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="ui-stack">
                <FormField label="Date">
                  <input className="form-inp" type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
                </FormField>
                <FormField label="Account">
                  <select className="form-sel" value={form.account} onChange={e => {
                    const newAccount = e.target.value
                    setField('account', newAccount)
                    if (form.toAccount === newAccount) {
                      const newToAcct = accounts.find(a => a !== newAccount)
                      if (newToAcct) setField('toAccount', newToAcct)
                    }
                  }}>
                    {accounts.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </FormField>
                <FormField label="Amount">
                  <input className="form-inp" type="number" min="0" step="1" placeholder="₹0" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                </FormField>
                <FormField label="Description">
                  <input className="form-inp" type="text" placeholder="Add note" value={form.desc} onChange={e => setField('desc', e.target.value)} />
                </FormField>
                <FormField label="Type">
                  <select className="form-sel" value={form.type} onChange={e => setField('type', e.target.value as SavingsType)}>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                </FormField>
                {form.type === 'Expense' && (
                  <FormField label="Category">
                    <select className="form-sel" value={form.category} onChange={e => setField('category', e.target.value)}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FormField>
                )}
                {form.type === 'Transfer' && (
                  <FormField label="To Account">
                    <select className="form-sel" value={form.toAccount} onChange={e => setField('toAccount', e.target.value)}>
                      {accounts.filter(a => a !== form.account).map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </FormField>
                )}
              </div>
            </div>

            <div className="modal-foot">
              {editEntry && (
                <button type="button" className="btn btn-sm btn-red" onClick={del} disabled={saving || deleting}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              <div className="modal-foot-l" />
              <button type="button" className="btn btn-sm btn-cancel" onClick={closeModal} disabled={saving || deleting}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-green" onClick={save} disabled={saving || deleting}>
                {saving ? 'Saving...' : editEntry ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
