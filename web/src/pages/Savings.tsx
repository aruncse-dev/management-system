import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Plus, LayoutDashboard, List, BarChart3, Wallet, Search, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Repeat2 } from 'lucide-react';
import { api, RawSavingsRow } from '../api';
import { THEME_COLORS } from '../constants';
import { INR } from '../utils';
import { BalanceRow, FilterChips, FormField, HoldingCard, KpiCard, LoadingState, ModalActions, ModalShell, SearchField, SectionBlock, Spacer, TabBar } from '../ui-kit';
import '../ui-kit/ui-kit.css';

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

function typeIcon(type: SavingsType) {
  if (type === 'Income') return <ArrowDownRight size={14} />;
  if (type === 'Expense') return <ArrowUpRight size={14} />;
  return <Repeat2 size={14} />;
}

const SavingsEntryCard = memo(function SavingsEntryCard({
  entry,
  onClick,
}: {
  entry: SavingsEntry;
  onClick: () => void;
}) {
  return (
    <HoldingCard
      title={entry.desc || entry.account}
      subtitle={entry.account}
      leftLabel="Amount"
      leftValue={`${entry.type === 'Income' ? '+' : entry.type === 'Transfer' ? '↔' : '−'}${INR(entry.amount)}`}
      centerLabel="Type"
      centerValue={entry.type}
      rightLabel="Date"
      rightValue={entry.date}
      accentTone={entry.type === 'Income' ? 'green' : entry.type === 'Transfer' ? 'amber' : 'red'}
      icon={typeIcon(entry.type)}
      iconPosition="right"
      iconBackground
      className="lending-entry-card"
      onClick={onClick}
    />
  );
});

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
  const [deleting, setDeleting] = useState(false);

  // Derivations
  const balances = useMemo(() => computeBalances(entries), [entries]);
  const totalBalance = useMemo(() => ACCOUNTS.reduce((s, a) => s + balances[a], 0), [balances]);
  const totalIncome = useMemo(() => entries.filter(e => e.type === 'Income').reduce((s, e) => s + e.amount, 0), [entries]);
  const totalExpenses = useMemo(() => entries.filter(e => e.type === 'Expense').reduce((s, e) => s + e.amount, 0), [entries]);
  const accountSummary = useMemo(
    () => ACCOUNTS.map(account => {
      const accountEntries = entries.filter(e => e.account === account);
      const income = accountEntries.filter(e => e.type === 'Income').reduce((s, e) => s + e.amount, 0);
      const expense = accountEntries.filter(e => e.type === 'Expense').reduce((s, e) => s + e.amount, 0);
      return {
        account,
        balance: balances[account],
        income,
        expense,
        net: income - expense,
      };
    }),
    [balances, entries],
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
  function resetModal() {
    setEditEntry(null);
    setForm(emptyForm());
  }

  function closeModal() {
    setError('');
    setModalOpen(false);
    resetModal();
    setSaving(false);
    setDeleting(false);
  }

  function openAdd() {
    resetModal();
    setError('');
    setModalOpen(true);
  }

  function openEdit(e: SavingsEntry) {
    setEditEntry(e);
    setError('');
    setForm({
      date: toDateInput(e.date),
      account: e.account,
      amount: String(e.amount),
      desc: e.desc,
      type: e.type,
      toAccount: e.toAccount ?? 'Amma IB',
    });
    setModalOpen(true);
  }

  function setField<K extends keyof SavingsFormState>(k: K, v: SavingsFormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    if (saving || deleting) return;
    setSaving(true);
    setError('');
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
      api.invalidateCache({ action: 'getEntries', params: { module: 'savings' } });
      closeModal();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!editEntry) return;
    if (deleting || saving) return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteSavings(editEntry.id);
      api.invalidateCache({ action: 'getEntries', params: { module: 'savings' } });
      closeModal();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="ui-kit-page-shell savings-page">
      {/* Nav bar */}
      <TabBar
        tabs={[
          { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={19} /> },
          { id: 'transactions', label: 'Transactions', icon: <List size={19} /> },
        ]}
        active={activeTab}
        onChange={id => setActiveTab(id as SavingsTab)}
      />

      <div className="pg savings-page">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <>
            <SectionBlock
              title="Metrics"
              icon={<BarChart3 size={14} />}
              right={loading ? <LoadingState variant="inline" /> : null}
            >
              <div className="dash-grid">
                <KpiCard label="Total Balance" value={INR(totalBalance)} tone="navy" icon={<Wallet size={14} />} />
                <KpiCard label="Total Income" value={INR(totalIncome)} tone="green" icon={<TrendingUp size={14} />} />
                <KpiCard label="Total Expenses" value={INR(totalExpenses)} tone="red" icon={<AlertTriangle size={14} />} />
              </div>
            </SectionBlock>

            <Spacer size={6} />
            <SectionBlock title="Accounts" icon={<Wallet size={14} />}>
              <div className="ui-stack">
                {accountSummary.map(({ account, balance, income, expense }) => (
                  <div key={account}>
                    <BalanceRow
                      title={account}
                      value={INR(balance)}
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

        {/* TRANSACTIONS TAB */}
        {activeTab === 'transactions' && (
          <>
            <SectionBlock
              title="Entries"
              icon={<LayoutDashboard size={14} />}
              right={<span className="ui-kit-section-chip ui-tone-muted">{filteredEntries.length}</span>}
            >
              <SearchField
                value={search}
                placeholder="Search desc, account, type…"
                onChange={setSearch}
                onClear={() => setSearch('')}
                prefix={<Search size={15} />}
              />
              <Spacer size={8} />
              <FilterChips items={[...TYPE_FILTERS]} active={typeFilter} onChange={setTypeFilter} />
              {loading && <LoadingState variant="section" />}

              {!loading && filteredEntries.length === 0 && (
                <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>No entries to display.</p>
              )}

              {!loading && filteredEntries.length > 0 && (
                <>
                  <div className="txn-cards">
                    {filteredEntries.map(e => (
                      <div key={e.id}>
                        <SavingsEntryCard
                          entry={e}
                          onClick={() => openEdit(e)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </SectionBlock>
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
        title="Add savings entry"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* MODAL */}
      {modalOpen && (
        <ModalShell
          title={editEntry ? 'Edit Transaction' : 'Add Transaction'}
          onClose={closeModal}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={saving ? 'Saving…' : editEntry ? 'Save' : 'Add'}
              destructive={false}
              leading={editEntry ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={del} disabled={saving || deleting}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              ) : null}
              disabled={saving || deleting}
              onSecondary={closeModal}
              onPrimary={save}
            />
          }
        >
          <div className="ui-stack">
            <FormField label="Date">
              <input className="form-inp" type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
            </FormField>
            <FormField label="Account">
              <select className="form-sel" value={form.account} onChange={e => {
                const newAccount = e.target.value as SavingsAccount;
                setField('account', newAccount);
                if (form.toAccount === newAccount) {
                  const newToAcct = ACCOUNTS.find(a => a !== newAccount);
                  if (newToAcct) setField('toAccount', newToAcct);
                }
              }}>
                {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
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
            {form.type === 'Transfer' && (
              <FormField label="To Account">
                <select className="form-sel" value={form.toAccount} onChange={e => setField('toAccount', e.target.value as SavingsAccount)}>
                  {ACCOUNTS.filter(a => a !== form.account).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </FormField>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
