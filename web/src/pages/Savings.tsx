import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, X, Check, Trash2, AlertTriangle, Loader2, Search, LayoutDashboard, List, Pencil, BarChart3, Wallet, type LucideIcon } from 'lucide-react';
import { api, RawSavingsRow } from '../api';
import { THEME_COLORS } from '../constants';
import { INR } from '../utils';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

type SavingsAccount = 'Amma IB' | 'Ramya IB' | 'Arun IB' | 'Amma SBI' | 'Cash';
type SavingsType = 'Income' | 'Expense' | 'Transfer';
type SavingsTab = 'dashboard' | 'transactions';

interface SavingsEntry {
  id: string;
  date: string; // ISO "YYYY-MM-DD"
  account: SavingsAccount;
  amount: number;
  desc: string;
  type: SavingsType;
  toAccount?: SavingsAccount;
}

interface SavingsFormState {
  date: string;
  account: SavingsAccount;
  amount: string;
  desc: string;
  type: SavingsType;
  toAccount: SavingsAccount;
}

const ACCOUNTS: SavingsAccount[] = ['Amma IB', 'Ramya IB', 'Arun IB', 'Amma SBI', 'Cash'];

const ACCOUNT_COLORS: Record<SavingsAccount, string> = {
  'Amma IB': THEME_COLORS[1],
  'Ramya IB': THEME_COLORS[0],
  'Arun IB': THEME_COLORS[2],
  'Amma SBI': THEME_COLORS[3],
  'Cash': THEME_COLORS[5],
};

const ACCOUNT_VALUE_COLOR = '#111827';

const TYPE_FILTERS = ['All', 'Income', 'Expense', 'Transfer'] as const;

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function toDateInput(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return todayISO();
  }
}

function emptyForm(): SavingsFormState {
  return {
    date: todayISO(),
    account: 'Arun IB',
    amount: '',
    desc: '',
    type: 'Income',
    toAccount: 'Amma IB',
  };
}

function parseRow(raw: RawSavingsRow): SavingsEntry | null {
  const type = String(raw.type ?? '').trim().toUpperCase();
  if (type !== 'INCOME' && type !== 'EXPENSE' && type !== 'TRANSFER') return null;
  const amount = parseFloat(String(raw.amount));
  if (isNaN(amount) || amount <= 0) return null;
  const account = String(raw.account ?? '').trim() as SavingsAccount;
  if (!ACCOUNTS.includes(account)) return null;
  const entry: SavingsEntry = {
    id: raw.id,
    date: String(raw.date ?? '').trim(),
    account,
    amount,
    desc: String(raw.desc ?? '').trim(),
    type: (type === 'INCOME' ? 'Income' : type === 'EXPENSE' ? 'Expense' : 'Transfer') as SavingsType,
  };
  if (type === 'TRANSFER') {
    const to = String(raw.toAccount ?? '').trim() as SavingsAccount;
    if (ACCOUNTS.includes(to)) entry.toAccount = to;
  }
  return entry;
}

function computeBalances(entries: SavingsEntry[]): Record<SavingsAccount, number> {
  const balances = Object.fromEntries(ACCOUNTS.map(a => [a, 0])) as Record<SavingsAccount, number>;
  for (const e of entries) {
    if (e.type === 'Income') balances[e.account] += e.amount;
    if (e.type === 'Expense') balances[e.account] -= e.amount;
    if (e.type === 'Transfer') {
      balances[e.account] -= e.amount;
      if (e.toAccount) balances[e.toAccount] += e.amount;
    }
  }
  return balances;
}

// ──────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <Icon size={16} style={{ color: 'var(--text)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text)' }}>{children}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: SavingsType }) {
  const bgColor = type === 'Income' ? THEME_COLORS[0] : type === 'Expense' ? THEME_COLORS[2] : THEME_COLORS[5];
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      background: bgColor,
      color: '#fff',
      padding: '4px 8px',
      borderRadius: 4,
      whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  );
}

function typeColor(type: SavingsType): string {
  if (type === 'Income') return THEME_COLORS[0];
  if (type === 'Expense') return THEME_COLORS[2];
  return THEME_COLORS[5];
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export default function Savings() {
  // Data
  const [entries, setEntries] = useState<SavingsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tab / filter
  const [activeTab, setActiveTab] = useState<SavingsTab>('dashboard');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<SavingsEntry | null>(null);
  const [form, setForm] = useState<SavingsFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  // Derivations
  const balances = useMemo(() => computeBalances(entries), [entries]);
  const totalBalance = useMemo(() => ACCOUNTS.reduce((s, a) => s + balances[a], 0), [balances]);
  const totalIncome = useMemo(() => entries.filter(e => e.type === 'Income').reduce((s, e) => s + e.amount, 0), [entries]);
  const totalExpenses = useMemo(() => entries.filter(e => e.type === 'Expense').reduce((s, e) => s + e.amount, 0), [entries]);
  const accountSummary = useMemo(
    () => ACCOUNTS.map(account => ({
      account,
      balance: balances[account],
      color: ACCOUNT_COLORS[account],
    })),
    [balances],
  );

  const filteredEntries = useMemo(() => {
    return entries
      .filter(e => typeFilter === 'All' || e.type === typeFilter)
      .filter(e => {
        const q = search.toLowerCase();
        return !q || e.desc.toLowerCase().includes(q)
          || e.account.toLowerCase().includes(q)
          || e.type.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, typeFilter, search]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api.getSavings();
      setEntries(rows.map(parseRow).filter((e): e is SavingsEntry => e !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  function openEdit(e: SavingsEntry) {
    setEditEntry(e);
    setForm({
      date: toDateInput(e.date),
      account: e.account,
      amount: String(e.amount),
      desc: e.desc,
      type: e.type,
      toAccount: e.toAccount ?? 'Amma IB',
    });
    setDelConfirm(false);
    setModalOpen(true);
  }

  function setField<K extends keyof SavingsFormState>(k: K, v: SavingsFormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      date: form.date,
      account: form.account,
      amount: parseFloat(form.amount),
      desc: form.desc.trim(),
      type: form.type === 'Income' ? 'INCOME' : form.type === 'Expense' ? 'EXPENSE' : 'TRANSFER',
    };
    if (form.type === 'Transfer') payload.toAccount = form.toAccount;
    try {
      if (editEntry) {
        await api.updateSavings({ ...payload, id: editEntry.id });
      } else {
        await api.addSavings(payload);
      }
      setModalOpen(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!delConfirm) {
      setDelConfirm(true);
      return;
    }
    if (!editEntry) return;
    setSaving(true);
    try {
      await api.deleteSavings(editEntry.id);
      setModalOpen(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Tab bar */}
      <nav className="tab-bar">
        <button className={`tab-item${activeTab === 'dashboard' ? ' active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <span className="tab-icon"><LayoutDashboard size={19} /></span>
          <span>Dashboard</span>
        </button>
        <button className={`tab-item${activeTab === 'transactions' ? ' active' : ''}`} onClick={() => setActiveTab('transactions')}>
          <span className="tab-icon"><List size={19} /></span>
          <span>Transactions</span>
        </button>
      </nav>

      <div className="pg">

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <>
            {/* Metrics Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <BarChart3 size={20} style={{ color: 'var(--text)' }} />
              <div style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text)' }}>Metrics</div>
              {loading && <Loader2 size={15} className="spin-icon" style={{ color: 'var(--muted)' }} />}
            </div>

            {/* KPI row */}
            <div className="kpis" style={{ marginBottom: 20 }}>
              <div className="kpi-card kpi-card--blue">
                <div className="kpi-card-l">Total Balance</div>
                <div className="kpi-card-v kpi-card-v-soft">{INR(totalBalance)}</div>
              </div>
              <div className="kpi-card kpi-card--green" style={{ borderLeftColor: 'rgb(34, 197, 94)', borderColor: 'rgb(34, 197, 94)' }}>
                <div className="kpi-card-l">Total Income</div>
                <div className="kpi-card-v kpi-card-v-soft">{INR(totalIncome)}</div>
              </div>
              <div className="kpi-card kpi-card--red">
                <div className="kpi-card-l">Total Expenses</div>
                <div className="kpi-card-v kpi-card-v-soft">{INR(totalExpenses)}</div>
              </div>
            </div>

            {/* Account balance cards */}
            <div className="sec" style={{ margin: '10px 0 4px' }}>
              <SectionTitle icon={Wallet}>Accounts</SectionTitle>
              <div style={{ display: 'grid', gap: 8 }}>
                {accountSummary.map(({ account, balance, color }) => (
                  <div key={account} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderLeft: `4px solid ${color}` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{account}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Simple balance summary</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: ACCOUNT_VALUE_COLOR, whiteSpace: 'nowrap' }}>
                      {INR(balance)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
          <>
            {/* Search bar */}
            <div style={{position:'relative',marginBottom:16}}>
              <input className="form-inp" type="text" placeholder="Search desc, account, type…" value={search} onChange={e => setSearch(e.target.value)} style={{paddingLeft:36,paddingRight:32,fontSize:14}} />
              <Search size={15} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--muted)',pointerEvents:'none'}} />
              {search && (
                <button className="icon-btn" style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)'}} onClick={() => setSearch('')}><X size={14} /></button>
              )}
            </div>

            {/* Filter pills */}
            <div className="pills" style={{marginBottom:16}}>
              {TYPE_FILTERS.map(f => (
                <button key={f} className={`pill ${typeFilter===f?'active':''}`} onClick={() => setTypeFilter(f)}>{f}</button>
              ))}
            </div>

            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 0', color: 'var(--muted)', fontSize: 14 }}>
                <Loader2 size={16} className="spin-icon" /> Loading…
              </div>
            )}

            {/* Empty state */}
            {!loading && filteredEntries.length === 0 && (
              <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14 }}>No entries to display.</p>
            )}

            {/* Mobile cards */}
            {!loading && filteredEntries.length > 0 && (
              <div className="txn-cards">
                {filteredEntries.map(e => (
                  <div
                    key={e.id}
                    className="txn-card"
                    style={{
                      cursor: 'pointer',
                      borderLeft: `4px solid ${typeColor(e.type)}`,
                    }}
                    onClick={() => openEdit(e)}
                  >
                    <div className="txn-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text)' }}>{e.desc || e.account}</span>
                      <span style={{ color: typeColor(e.type), fontWeight: 700 }}>
                        {e.type === 'Income' ? '+' : '−'}{INR(e.amount)}
                      </span>
                    </div>
                    <div className="txn-card-bot" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{e.date}</span>
                      <span style={{ fontSize: 11, color: ACCOUNT_COLORS[e.account], fontWeight: 600 }}>{e.account}</span>
                      <TypeBadge type={e.type} />
                      {e.type === 'Transfer' && e.toAccount && (
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>→ {e.toAccount}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Desktop table */}
            {!loading && filteredEntries.length > 0 && (
              <div className="tw txn-table">
                <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Date</th>
                        <th>Account</th>
                        <th>Amount</th>
                        <th>Desc</th>
                        <th>Type</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map(e => (
                        <tr key={e.id}>
                          <td style={{ color: 'var(--muted)', fontSize: 11 }}>{e.id.slice(0, 8)}</td>
                          <td>{e.date}</td>
                          <td>
                            <span style={{ color: ACCOUNT_COLORS[e.account], fontWeight: 500 }}>{e.account}</span>
                          </td>
                          <td style={{ color: typeColor(e.type), fontWeight: 700 }}>
                            {INR(e.amount)}
                          </td>
                          <td>{e.desc}</td>
                          <td>
                            <TypeBadge type={e.type} />
                          </td>
                          <td>
                            <button
                              className="icon-btn"
                              onClick={() => openEdit(e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                            >
                              <Pencil size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        {/* Error message */}
        {error && (
          <p style={{ color: THEME_COLORS[5], fontSize: 13, padding: '12px 10px', marginTop: 12 }}>
            ⚠ {error}
          </p>
        )}
      </div>

      {/* FAB — Add Savings Entry */}
      <button
        onClick={() => setModalOpen(true)}
        style={{
          position: 'fixed', bottom: 24, right: 20,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--navy-dark)', color: '#fff',
          border: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,.2)',
          cursor: 'pointer', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Add savings entry"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* MODAL */}
      {modalOpen && (
        <div className="modal-bg open" onClick={ev => { if (ev.target === ev.currentTarget) setModalOpen(false); }}>
          <div className="modal">
            <div className="modal-hd">
              <span className="modal-title">{editEntry ? 'Edit Transaction' : 'Add Transaction'}</span>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-lbl">Date</label>
                <input
                  className="form-inp"
                  type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Account</label>
                <select
                  className="form-sel"
                  value={form.account}
                  onChange={e => {
                    const newAccount = e.target.value as SavingsAccount;
                    setField('account', newAccount);
                    // Auto-reset toAccount if it matches the new account
                    if (form.toAccount === newAccount) {
                      const newToAcct = ACCOUNTS.find(a => a !== newAccount);
                      if (newToAcct) setField('toAccount', newToAcct);
                    }
                  }}
                >
                  {ACCOUNTS.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="form-lbl">Amount (₹)</label>
                <input
                  className="form-inp"
                  type="number"
                  min="0"
                  step="1"
                  value={form.amount}
                  onChange={e => setField('amount', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Description</label>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="Optional"
                  value={form.desc}
                  onChange={e => setField('desc', e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-lbl">Type</label>
                <select
                  className="form-sel"
                  value={form.type}
                  onChange={e => setField('type', e.target.value as SavingsType)}
                >
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                  <option value="Transfer">Transfer</option>
                </select>
              </div>
              {form.type === 'Transfer' && (
                <div className="form-row">
                  <label className="form-lbl">To Account</label>
                  <select
                    className="form-sel"
                    value={form.toAccount}
                    onChange={e => setField('toAccount', e.target.value as SavingsAccount)}
                  >
                    {ACCOUNTS.filter(a => a !== form.account).map(a => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <div className="modal-foot-l">
                {editEntry && (
                  <button
                    className="btn btn-red btn-sm"
                    onClick={del}
                    disabled={saving}
                  >
                    {delConfirm ? (
                      <>
                        <AlertTriangle size={14} /> Confirm?
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} /> Delete
                      </>
                    )}
                  </button>
                )}
              </div>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--border)', color: 'var(--text)' }}
                onClick={() => setModalOpen(false)}
              >
                <X size={14} /> Cancel
              </button>
              <button
                className="btn btn-sm btn-green"
                onClick={save}
                disabled={saving || !form.amount || parseFloat(form.amount) <= 0}
              >
                {saving ? (
                  <Loader2 size={14} className="spin-icon" />
                ) : editEntry ? (
                  <>
                    <Check size={14} /> Save
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Add
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
