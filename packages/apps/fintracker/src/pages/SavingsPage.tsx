import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Plus, LayoutDashboard, List, BarChart3, Wallet, Search, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Repeat2 } from 'lucide-react';
import { api, RawSavingsRow } from '../api';
import { THEME_COLORS } from '@fintracker-vault/config';
import { INR } from '@fintracker-vault/utils';
import { BalanceRow, FilterChips, FormField, HoldingCard, KpiCard, LoadingState, ModalActions, ModalShell, SearchField, SectionBlock, Spacer, TabBar } from '@fintracker-vault/ui';
import '../ui-kit/ui-kit.css';

type SavingsType = 'Income' | 'Expense' | 'Transfer';
type SavingsTab = 'dashboard' | 'transactions';

export interface SavingsPageConfig {
  sheetName: string;
  accounts: readonly string[];
  title: string;
  addButtonTitle?: string;
}

interface SavingsEntry {
  id: string;
  date: string;
  account: string;
  amount: number;
  desc: string;
  type: SavingsType;
  toAccount?: string;
}

interface SavingsFormState {
  date: string;
  account: string;
  amount: string;
  desc: string;
  type: SavingsType;
  toAccount: string;
}

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

function makeEmptyForm(accounts: readonly string[]): SavingsFormState {
  return {
    date: todayISO(),
    account: accounts[0] ?? '',
    amount: '',
    desc: '',
    type: 'Income',
    toAccount: accounts[1] ?? accounts[0] ?? '',
  };
}

function parseRow(raw: RawSavingsRow, accounts: readonly string[]): SavingsEntry | null {
  const type = String(raw.type ?? '').trim().toUpperCase();
  if (type !== 'INCOME' && type !== 'EXPENSE' && type !== 'TRANSFER') return null;
  const amount = parseFloat(String(raw.amount));
  if (isNaN(amount) || amount <= 0) return null;
  const account = String(raw.account ?? '').trim();
  if (!accounts.includes(account)) return null;
  const entry: SavingsEntry = {
    id: raw.id,
    date: String(raw.date ?? '').trim(),
    account,
    amount,
    desc: String(raw.desc ?? '').trim(),
    type: (type === 'INCOME' ? 'Income' : type === 'EXPENSE' ? 'Expense' : 'Transfer') as SavingsType,
  };
  if (type === 'TRANSFER') {
    const to = String(raw.toAccount ?? '').trim();
    if (accounts.includes(to)) entry.toAccount = to;
  }
  return entry;
}

function computeBalances(entries: SavingsEntry[], accounts: readonly string[]): Record<string, number> {
  const balances = Object.fromEntries(accounts.map(a => [a, 0])) as Record<string, number>;
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

function signedINR(n: number): string {
  const value = INR(n);
  return n < 0 ? `-${value}` : value;
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

export default function SavingsPage({ sheetName, accounts, title, addButtonTitle }: SavingsPageConfig) {
  const [entries, setEntries] = useState<SavingsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<SavingsTab>('dashboard');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<SavingsEntry | null>(null);
  const [form, setForm] = useState<SavingsFormState>(makeEmptyForm(accounts));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api.getSavings(sheetName);
      setEntries(rows.map(row => parseRow(row, accounts)).filter((e): e is SavingsEntry => e !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [accounts, sheetName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const balances = useMemo(() => computeBalances(entries, accounts), [accounts, entries]);
  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + (balances[a] || 0), 0), [accounts, balances]);
  const totalIncome = useMemo(() => entries
    .filter(e => e.type === 'Income' || e.type === 'Transfer')
    .reduce((s, e) => s + e.amount, 0), [entries]);
  const totalExpenses = useMemo(() => entries
    .filter(e => e.type === 'Expense' || e.type === 'Transfer')
    .reduce((s, e) => s + e.amount, 0), [entries]);
  const accountSummary = useMemo(
    () => accounts.map(account => {
      const accountEntries = entries.filter(e => e.account === account);
      const transferOut = accountEntries.filter(e => e.type === 'Transfer').reduce((s, e) => s + e.amount, 0);
      const transferIn = entries.filter(e => e.type === 'Transfer' && e.toAccount === account).reduce((s, e) => s + e.amount, 0);
      const income = accountEntries.filter(e => e.type === 'Income').reduce((s, e) => s + e.amount, 0) + transferIn;
      const expense = accountEntries.filter(e => e.type === 'Expense').reduce((s, e) => s + e.amount, 0) + transferOut;
      return {
        account,
        balance: balances[account] || 0,
        income,
        expense,
        net: income - expense,
      };
    }),
    [accounts, balances, entries],
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

  function resetModal() {
    setEditEntry(null);
    setForm(makeEmptyForm(accounts));
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
      toAccount: e.toAccount ?? accounts.find(a => a !== e.account) ?? accounts[0] ?? '',
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
        await api.updateSavings({ ...payload, id: editEntry.id }, sheetName);
      } else {
        await api.addSavings(payload, sheetName);
      }
      api.invalidateCache({ action: 'getEntries', params: { module: 'savings', ...(sheetName !== 'Savings' ? { sheetName } : {}) } });
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
      await api.deleteSavings(editEntry.id, sheetName);
      api.invalidateCache({ action: 'getEntries', params: { module: 'savings', ...(sheetName !== 'Savings' ? { sheetName } : {}) } });
      closeModal();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="ui-kit-page-shell savings-page">
      <TabBar
        tabs={[
          { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={19} /> },
          { id: 'transactions', label: 'Transactions', icon: <List size={19} /> },
        ]}
        active={activeTab}
        onChange={id => setActiveTab(id as SavingsTab)}
      />

      <div className="pg savings-page">
        {activeTab === 'dashboard' && (
          <>
            <SectionBlock
              title={`${title} Metrics`}
              icon={<BarChart3 size={14} />}
              right={loading ? <LoadingState variant="inline" /> : null}
            >
              <div className="dash-grid">
                <KpiCard label="Total Balance" value={signedINR(totalBalance)} tone="navy" icon={<Wallet size={14} />} />
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
              <FilterChips items={['All', 'Income', 'Expense', 'Transfer']} active={typeFilter} onChange={setTypeFilter} />
              {loading && <LoadingState variant="section" />}

              {!loading && filteredEntries.length === 0 && (
                <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>No entries to display.</p>
              )}

              {!loading && filteredEntries.length > 0 && (
                <div className="txn-cards">
                  {filteredEntries.map(e => (
                    <div key={e.id}>
                      <SavingsEntryCard entry={e} onClick={() => openEdit(e)} />
                    </div>
                  ))}
                </div>
              )}
            </SectionBlock>
          </>
        )}

        {error && (
          <p style={{ color: THEME_COLORS[5], fontSize: 13, padding: '12px 10px', marginTop: 12 }}>
            ⚠ {error}
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
        <ModalShell
          title={editEntry ? `Edit ${title} Transaction` : `Add ${title} Transaction`}
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
                const newAccount = e.target.value;
                setField('account', newAccount);
                if (form.toAccount === newAccount) {
                  const newToAcct = accounts.find(a => a !== newAccount);
                  if (newToAcct) setField('toAccount', newToAcct);
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
            {form.type === 'Transfer' && (
              <FormField label="To Account">
                <select className="form-sel" value={form.toAccount} onChange={e => setField('toAccount', e.target.value)}>
                  {accounts.filter(a => a !== form.account).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </FormField>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
