import { useCallback, useEffect, useMemo, useState, memo, type ReactNode } from 'react';
import { localIsoDate } from '@fintracker-vault/utils';
import { ArrowDownLeft, ArrowUpRight, BarChart3, Briefcase, Coins, Layers, LandPlot, Package, Plus, Receipt, Shield, TrendingUp, Wallet } from 'lucide-react';
import {
  api,
  type InvestmentTxnKind,
  type OtherInvestmentType,
  type RawOtherInvestmentRow,
  type RawOtherInvestmentTxnRow,
} from '../api';
import { useFormatMoney, useMoneyFormatting } from '../hooks/useFormatMoney';
import { FormField, HoldingCard, InfoCallout, KpiCard, KpiGrid, ListStack, LoadingState, ModalActions, ModalShell, SectionBlock, SectionChip } from '../ui';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & MATH
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Investments tracked by hand: a holding (name + a few optional facts) and a
 * ledger, the same shape as Lending. Every figure on this page is derived from
 * the ledger; the optional facts only add value, balance-due and per-sqft lines.
 */

interface InvestmentTxn {
  id: string;
  investment_id: string;
  date: string;
  kind: InvestmentTxnKind;
  amount: number;
  description: string;
}

export interface InvestmentSummary {
  id: string;
  name: string;
  type: OtherInvestmentType;
  area_sqft: number | null;
  price: number | null;
  current_value: number | null;
  status: 'active' | 'sold';
  paid: number;
  expenses: number;
  received: number;
  /** Paid + expenses: everything that went in. */
  invested: number;
  /** Agreed price − paid, while held; null when no price is recorded. */
  balanceDue: number | null;
  /** What it counts for today: the estimate while held, nothing once sold. Null = not valued. */
  worth: number | null;
  /** Sold: received − invested. Held: worth + received − invested. Null while held and not valued. */
  gain: number | null;
  costPerSqft: number | null;
  txns: InvestmentTxn[];
}

const TYPE_META: Record<OtherInvestmentType, { label: string; icon: (size: number) => ReactNode }> = {
  land: { label: 'Land / Plot', icon: (n) => <LandPlot size={n} /> },
  shares: { label: 'Shares', icon: (n) => <TrendingUp size={n} /> },
  chit: { label: 'Chit fund', icon: (n) => <Coins size={n} /> },
  business: { label: 'Business', icon: (n) => <Briefcase size={n} /> },
  other: { label: 'Other', icon: (n) => <Package size={n} /> },
};
const TYPES = Object.keys(TYPE_META) as OtherInvestmentType[];

const KIND_LABEL: Record<InvestmentTxnKind, string> = { paid: 'Paid', expense: 'Expense', received: 'Received' };
const KIND_HINT: Record<InvestmentTxnKind, string> = {
  paid: 'Advance, installment 2…',
  expense: 'Broker commission, registration…',
  received: 'Sale amount, payout, refund…',
};

function parseTxn(raw: RawOtherInvestmentTxnRow): InvestmentTxn | null {
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount)) return null;
  if (raw.kind !== 'paid' && raw.kind !== 'expense' && raw.kind !== 'received') return null;
  return {
    id: raw.id,
    investment_id: raw.investment_id,
    date: String(raw.date ?? '').slice(0, 10),
    kind: raw.kind,
    amount,
    description: String(raw.description ?? '').trim(),
  };
}

function positiveOrNull(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

export function summarizeInvestments(rows: RawOtherInvestmentRow[], txnRows: RawOtherInvestmentTxnRow[]): InvestmentSummary[] {
  const txns = txnRows.map(parseTxn).filter((t): t is InvestmentTxn => t !== null);
  return rows.map((r) => {
    const own = txns.filter((t) => t.investment_id === r.id).sort((a, b) => b.date.localeCompare(a.date));
    const sum = (k: InvestmentTxnKind) => own.filter((t) => t.kind === k).reduce((s, t) => s + t.amount, 0);
    const paid = sum('paid');
    const expenses = sum('expense');
    const received = sum('received');
    const invested = paid + expenses;
    const type: OtherInvestmentType = r.type in TYPE_META ? r.type : 'other';
    // Area only means something for land; a stale value on another type is ignored.
    const area = type === 'land' ? positiveOrNull(r.area_sqft) : null;
    const price = positiveOrNull(r.price);
    const value = positiveOrNull(r.current_value);
    const sold = r.status === 'sold';
    return {
      id: r.id,
      name: String(r.name ?? '').trim(),
      type,
      area_sqft: area,
      price,
      current_value: value,
      status: sold ? 'sold' : 'active',
      paid,
      expenses,
      received,
      invested,
      // Expenses aren't part of the price, so only Paid reduces what's due.
      balanceDue: !sold && price !== null ? Math.max(price - paid, 0) : null,
      worth: sold ? 0 : value,
      gain: sold ? received - invested : value !== null ? value + received - invested : null,
      costPerSqft: area !== null && invested > 0 ? invested / area : null,
      txns: own,
    };
  });
}

/** Totals. Gain only adds holdings that have one, so an unvalued holding never reads as a loss. */
export function investmentTotals(rows: InvestmentSummary[]) {
  const held = rows.filter((r) => r.status === 'active');
  return {
    invested: held.reduce((s, r) => s + r.invested, 0),
    worth: held.reduce((s, r) => s + (r.worth ?? 0), 0),
    unvalued: held.filter((r) => r.worth === null).length,
    due: held.reduce((s, r) => s + (r.balanceDue ?? 0), 0),
    gain: rows.reduce((s, r) => s + (r.gain ?? 0), 0),
    hasGain: rows.some((r) => r.gain !== null),
    held: held.length,
    sold: rows.length - held.length,
  };
}

function signed(fmt: (n: number) => string, n: number): string {
  return `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────────────────────────────────────

const InvestmentCard = memo(function InvestmentCard({ inv, onClick }: { inv: InvestmentSummary; onClick: () => void }) {
  const fmt = useFormatMoney();
  const subtitle = [
    TYPE_META[inv.type].label,
    inv.area_sqft !== null ? `${inv.area_sqft.toLocaleString('en-IN')} sqft` : '',
    inv.balanceDue ? `${fmt(inv.balanceDue)} due` : '',
  ].filter(Boolean).join(' · ');
  const tone = inv.gain === null ? 'navy' : inv.gain >= 0 ? 'green' : 'red';
  const sold = inv.status === 'sold';
  return (
    <HoldingCard
      className="stock-entry-card"
      title={inv.name}
      subtitle={subtitle}
      icon={TYPE_META[inv.type].icon(14)}
      iconBackground
      accentTone={tone}
      rightTop={sold ? <SectionChip tone="muted">Sold</SectionChip> : undefined}
      leftLabel="Invested"
      leftValue={fmt(inv.invested)}
      centerLabel={sold ? 'Received' : 'Worth today'}
      centerValue={sold ? fmt(inv.received) : inv.worth !== null ? fmt(inv.worth) : '—'}
      rightLabel="Gain"
      rightValue={inv.gain !== null ? signed(fmt, inv.gain) : '—'}
      onClick={onClick}
    />
  );
});

const TxnCard = memo(function TxnCard({ txn, onClick }: { txn: InvestmentTxn; onClick: () => void }) {
  const fmt = useFormatMoney();
  const incoming = txn.kind === 'received';
  return (
    <HoldingCard
      className="stock-entry-card"
      title={txn.description || KIND_LABEL[txn.kind]}
      subtitle={txn.description ? KIND_LABEL[txn.kind] : undefined}
      icon={incoming ? <ArrowDownLeft size={14} /> : txn.kind === 'expense' ? <Receipt size={14} /> : <ArrowUpRight size={14} />}
      iconPosition="right"
      iconBackground
      accentTone={incoming ? 'green' : txn.kind === 'expense' ? 'amber' : 'red'}
      leftLabel="Amount"
      leftValue={fmt(txn.amount)}
      rightLabel="Date"
      rightValue={txn.date}
      onClick={onClick}
    />
  );
});

function TotalsGrid({ totals }: { totals: ReturnType<typeof investmentTotals> }) {
  const fmt = useFormatMoney();
  return (
    <KpiGrid>
      <KpiCard
        label="Invested"
        value={fmt(totals.invested)}
        icon={<Wallet size={14} />}
        tone="navy"
        subtitle={totals.due > 0 ? `${fmt(totals.due)} still due` : 'Paid + expenses'}
      />
      <KpiCard
        label="Worth today"
        value={fmt(totals.worth)}
        icon={<TrendingUp size={14} />}
        tone="muted"
        subtitle={totals.unvalued ? `${totals.unvalued} not valued yet` : undefined}
      />
      <KpiCard
        label="Gain"
        value={totals.hasGain ? signed(fmt, totals.gain) : '—'}
        subtitle={totals.sold ? 'Incl. sold' : undefined}
        icon={<Shield size={14} />}
        tone="muted"
        accentTone={totals.gain >= 0 ? 'green' : 'red'}
      />
      <KpiCard label="Holdings" value={totals.held} subtitle={totals.sold ? `${totals.sold} sold` : 'Held'} icon={<Layers size={14} />} tone="muted" />
    </KpiGrid>
  );
}

/** For the Investments dashboard; loads on its own so that tab stays independent. Hidden until something exists. */
export function OtherInvestmentsMetrics() {
  const [rows, setRows] = useState<InvestmentSummary[] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([api.getOtherInvestments(), api.getOtherInvestmentTxns()])
      .then(([r, t]) => { if (live) setRows(summarizeInvestments(r, t)); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, []);
  if (!rows || rows.length === 0) return null;
  return (
    <SectionBlock title="Other investments" icon={<Layers size={14} />}>
      <TotalsGrid totals={investmentTotals(rows)} />
    </SectionBlock>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

interface InvestmentForm {
  name: string;
  type: OtherInvestmentType;
  area_sqft: string;
  price: string;
  current_value: string;
  status: 'active' | 'sold';
}
interface TxnForm { investment_id: string; kind: InvestmentTxnKind; amount: string; date: string; description: string }

const emptyInvestmentForm = (): InvestmentForm => ({ name: '', type: 'land', area_sqft: '', price: '', current_value: '', status: 'active' });
const emptyTxnForm = (investment_id = ''): TxnForm => ({ investment_id, kind: 'paid', amount: '', date: localIsoDate(), description: '' });

/** '' → null (clear), otherwise a positive number or an error string. */
function optionalPositive(raw: string, label: string): number | null | string {
  if (!raw.trim()) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : `${label} must be a number greater than 0, or left blank.`;
}

export default function OtherInvestments() {
  const { format: fmt, currency, zeroPlaceholder } = useMoneyFormatting();
  const [rows, setRows] = useState<InvestmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [detailId, setDetailId] = useState<string | null>(null);

  const [invModalOpen, setInvModalOpen] = useState(false);
  const [editInvId, setEditInvId] = useState<string | null>(null);
  const [invForm, setInvForm] = useState<InvestmentForm>(emptyInvestmentForm());

  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<InvestmentTxn | null>(null);
  const [txnForm, setTxnForm] = useState<TxnForm>(emptyTxnForm());

  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  /** Modal-scoped: the page-level `error` renders behind an open modal. */
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, t] = await Promise.all([api.getOtherInvestments(), api.getOtherInvestmentTxns()]);
      setRows(summarizeInvestments(r, t));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load investments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const totals = useMemo(() => investmentTotals(rows), [rows]);
  // Held first, then sold; each by most invested.
  const ordered = useMemo(
    () => [...rows].sort((a, b) => (a.status === b.status ? b.invested - a.invested : a.status === 'active' ? -1 : 1)),
    [rows],
  );
  const detail = detailId ? rows.find((r) => r.id === detailId) ?? null : null;
  const editInv = editInvId ? rows.find((r) => r.id === editInvId) ?? null : null;

  function resetModalState() {
    setSaving(false);
    setDeleteConfirm(false);
    setFormError('');
  }

  // ── holding modal ──
  function openAddInvestment() {
    setEditInvId(null);
    setInvForm(emptyInvestmentForm());
    resetModalState();
    setInvModalOpen(true);
  }

  function openEditInvestment(inv: InvestmentSummary) {
    setEditInvId(inv.id);
    setInvForm({
      name: inv.name,
      type: inv.type,
      area_sqft: inv.area_sqft !== null ? String(inv.area_sqft) : '',
      price: inv.price !== null ? String(inv.price) : '',
      current_value: inv.current_value !== null ? String(inv.current_value) : '',
      status: inv.status,
    });
    resetModalState();
    setInvModalOpen(true);
  }

  function closeInvestmentModal() {
    setInvModalOpen(false);
    setEditInvId(null);
    resetModalState();
  }

  async function saveInvestment() {
    if (saving) return;
    if (!invForm.name.trim()) { setFormError('Enter a name.'); return; }
    const area = invForm.type === 'land' ? optionalPositive(invForm.area_sqft, 'Area') : null;
    if (typeof area === 'string') { setFormError(area); return; }
    const price = optionalPositive(invForm.price, 'Agreed price');
    if (typeof price === 'string') { setFormError(price); return; }
    const value = optionalPositive(invForm.current_value, 'Current value');
    if (typeof value === 'string') { setFormError(value); return; }
    setSaving(true);
    setFormError('');
    const payload = { name: invForm.name.trim(), type: invForm.type, area_sqft: area, price, current_value: value, status: invForm.status };
    try {
      if (editInvId) await api.updateOtherInvestment({ ...payload, id: editInvId });
      else setDetailId(await api.addOtherInvestment(payload));
      closeInvestmentModal();
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  async function deleteInvestment() {
    if (!editInvId || saving) return;
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setSaving(true);
    try {
      await api.deleteOtherInvestment(editInvId);
      setDetailId(null);
      closeInvestmentModal();
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Delete failed');
      setDeleteConfirm(false);
      setSaving(false);
    }
  }

  // ── transaction modal ──
  function openAddTxn(investmentId?: string) {
    setEditTxn(null);
    // One holding (or one already open) needs no picking.
    setTxnForm(emptyTxnForm(investmentId ?? (rows.length === 1 ? rows[0].id : '')));
    resetModalState();
    setTxnModalOpen(true);
  }

  function openEditTxn(t: InvestmentTxn) {
    setEditTxn(t);
    setTxnForm({ investment_id: t.investment_id, kind: t.kind, amount: String(t.amount), date: t.date, description: t.description });
    resetModalState();
    setTxnModalOpen(true);
  }

  function closeTxnModal() {
    setTxnModalOpen(false);
    setEditTxn(null);
    resetModalState();
  }

  async function saveTxn() {
    if (saving) return;
    if (!txnForm.investment_id) { setFormError('Pick an investment.'); return; }
    const amount = parseFloat(txnForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setFormError('Enter an amount greater than 0.'); return; }
    if (!txnForm.date) { setFormError('Enter a date.'); return; }
    setSaving(true);
    setFormError('');
    const payload = {
      investment_id: txnForm.investment_id,
      kind: txnForm.kind,
      amount,
      date: txnForm.date,
      description: txnForm.description.trim(),
    };
    try {
      if (editTxn) await api.updateOtherInvestmentTxn({ ...payload, id: editTxn.id });
      else await api.addOtherInvestmentTxn(payload);
      closeTxnModal();
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  async function deleteTxn() {
    if (!editTxn || saving) return;
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setSaving(true);
    try {
      await api.deleteOtherInvestmentTxn(editTxn.id);
      closeTxnModal();
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Delete failed');
      setDeleteConfirm(false);
      setSaving(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="ui-kit-page-shell">
      <SectionBlock title="Metrics" icon={<BarChart3 size={14} />} right={loading ? <LoadingState variant="inline" /> : null}>
        <TotalsGrid totals={totals} />
      </SectionBlock>

      <SectionBlock
        title="Holdings"
        icon={<Layers size={14} />}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="settings-action-btn" onClick={openAddInvestment}>
              <Plus size={14} /> Add
            </button>
            <SectionChip>{rows.length}</SectionChip>
          </div>
        }
      >
        {error ? (
          <p className="ui-kit-callout ui-tone-red" role="alert">{error}</p>
        ) : loading && rows.length === 0 ? (
          <LoadingState variant="section" />
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
            Nothing yet. Add a plot, land, shares or a chit, then record each payment,
            commission and sale against it.
          </p>
        ) : (
          <ListStack>
            {ordered.map((inv) => (
              <InvestmentCard key={inv.id} inv={inv} onClick={() => setDetailId(inv.id)} />
            ))}
          </ListStack>
        )}
      </SectionBlock>

      {rows.length > 0 && (
        <button
          type="button"
          onClick={() => openAddTxn(detail?.id)}
          style={{
            position: 'fixed', bottom: 24, right: 20,
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--navy-dark)', color: '#fff',
            border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.2)',
            cursor: 'pointer', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Add transaction"
          aria-label="Add transaction"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* DETAIL — one holding and its ledger */}
      {detail && !invModalOpen && !txnModalOpen && (
        <ModalShell
          title={detail.name}
          onClose={() => setDetailId(null)}
          footer={
            <ModalActions
              primaryLabel="Add transaction"
              onPrimary={() => openAddTxn(detail.id)}
              secondaryLabel="Close"
              onSecondary={() => setDetailId(null)}
              leading={
                <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={() => openEditInvestment(detail)}>
                  Edit
                </button>
              }
            />
          }
        >
          <div className="ui-stack">
            <KpiGrid>
              <KpiCard
                label="Paid"
                value={fmt(detail.paid)}
                tone="navy"
                icon={<ArrowUpRight size={14} />}
                subtitle={detail.price !== null ? `of ${fmt(detail.price)} agreed` : undefined}
              />
              <KpiCard label="Expenses" value={fmt(detail.expenses)} tone="amber" icon={<Receipt size={14} />} />
              <KpiCard label="Received" value={fmt(detail.received)} tone="green" icon={<ArrowDownLeft size={14} />} />
              <KpiCard
                label="Gain"
                value={detail.gain !== null ? signed(fmt, detail.gain) : '—'}
                tone="muted"
                accentTone={detail.gain !== null && detail.gain < 0 ? 'red' : 'green'}
                icon={<Shield size={14} />}
                subtitle={
                  detail.status === 'sold'
                    ? 'Received − invested'
                    : detail.worth !== null ? `Worth ${fmt(detail.worth)}` : 'Add a current value'
                }
              />
            </KpiGrid>
            {(detail.balanceDue !== null || detail.costPerSqft !== null) && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                {[
                  detail.balanceDue !== null
                    ? detail.balanceDue > 0 ? `${fmt(detail.balanceDue)} still to pay` : 'Fully paid'
                    : '',
                  detail.area_sqft !== null ? `${detail.area_sqft.toLocaleString('en-IN')} sqft` : '',
                  detail.costPerSqft !== null ? `cost ${fmt(Math.round(detail.costPerSqft))}/sqft` : '',
                  detail.area_sqft !== null && detail.current_value !== null
                    ? `worth ${fmt(Math.round(detail.current_value / detail.area_sqft))}/sqft`
                    : '',
                ].filter(Boolean).join(' · ')}
              </p>
            )}
            {detail.txns.length === 0 ? (
              <InfoCallout title="No transactions yet">
                Record the advance, each installment, broker commission and registration as they happen.
              </InfoCallout>
            ) : (
              <ListStack>
                {detail.txns.map((t) => (
                  <TxnCard key={t.id} txn={t} onClick={() => openEditTxn(t)} />
                ))}
              </ListStack>
            )}
          </div>
        </ModalShell>
      )}

      {/* HOLDING MODAL */}
      {invModalOpen && (
        <ModalShell
          title={editInv ? 'Edit investment' : 'Add investment'}
          onClose={closeInvestmentModal}
          footer={
            <ModalActions
              primaryLabel={saving ? 'Saving…' : editInv ? 'Save' : 'Add'}
              onPrimary={() => void saveInvestment()}
              onSecondary={closeInvestmentModal}
              disabled={saving}
              leading={editInv ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void deleteInvestment()} disabled={saving}>
                  {deleteConfirm
                    ? `Delete with ${editInv.txns.length} txn${editInv.txns.length === 1 ? '' : 's'}?`
                    : 'Delete'}
                </button>
              ) : null}
            />
          }
        >
          <form onSubmit={(e) => { e.preventDefault(); void saveInvestment(); }}>
            <div className="ui-stack">
              {formError && <p className="ui-kit-callout ui-tone-red" role="alert">{formError}</p>}
              <FormField label="Name *">
                <input className="form-inp" type="text" placeholder="Place / survey no, company, chit group…" value={invForm.name} onChange={(e) => setInvForm((f) => ({ ...f, name: e.target.value }))} />
              </FormField>
              <FormField label="Type">
                <select className="form-sel" value={invForm.type} onChange={(e) => setInvForm((f) => ({ ...f, type: e.target.value as OtherInvestmentType }))}>
                  {TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
                </select>
              </FormField>
              {invForm.type === 'land' && (
                <FormField label="Area (sqft)">
                  <input className="form-inp" type="number" min="0" step="any" inputMode="decimal" placeholder="Optional" value={invForm.area_sqft} onChange={(e) => setInvForm((f) => ({ ...f, area_sqft: e.target.value }))} />
                </FormField>
              )}
              <FormField label={`Agreed price (${currency})`}>
                <input className="form-inp" type="number" min="0" step="1" inputMode="numeric" placeholder="If paying in installments" value={invForm.price} onChange={(e) => setInvForm((f) => ({ ...f, price: e.target.value }))} />
              </FormField>
              <FormField label={`Current value (${currency})`}>
                <input className="form-inp" type="number" min="0" step="1" inputMode="numeric" placeholder="Today's estimate" value={invForm.current_value} onChange={(e) => setInvForm((f) => ({ ...f, current_value: e.target.value }))} />
              </FormField>
              <FormField label="Status">
                <select className="form-sel" value={invForm.status} onChange={(e) => setInvForm((f) => ({ ...f, status: e.target.value === 'sold' ? 'sold' : 'active' }))}>
                  <option value="active">Held</option>
                  <option value="sold">Sold</option>
                </select>
              </FormField>
            </div>
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
        </ModalShell>
      )}

      {/* TRANSACTION MODAL */}
      {txnModalOpen && (
        <ModalShell
          title={editTxn ? 'Edit transaction' : 'Add transaction'}
          onClose={closeTxnModal}
          footer={
            <ModalActions
              primaryLabel={saving ? 'Saving…' : editTxn ? 'Save' : 'Add'}
              onPrimary={() => void saveTxn()}
              onSecondary={closeTxnModal}
              disabled={saving}
              leading={editTxn ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void deleteTxn()} disabled={saving}>
                  {deleteConfirm ? 'Confirm delete?' : 'Delete'}
                </button>
              ) : null}
            />
          }
        >
          <form onSubmit={(e) => { e.preventDefault(); void saveTxn(); }}>
            <div className="ui-stack">
              {formError && <p className="ui-kit-callout ui-tone-red" role="alert">{formError}</p>}
              <FormField label="Investment *">
                <select className="form-sel" value={txnForm.investment_id} onChange={(e) => setTxnForm((f) => ({ ...f, investment_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </FormField>
              <FormField label="Type">
                <select className="form-sel" value={txnForm.kind} onChange={(e) => setTxnForm((f) => ({ ...f, kind: e.target.value as InvestmentTxnKind }))}>
                  <option value="paid">Paid (toward the investment)</option>
                  <option value="expense">Expense (commission, registration…)</option>
                  <option value="received">Received (sale, payout, refund)</option>
                </select>
              </FormField>
              <FormField label={`Amount (${currency}) *`}>
                <input className="form-inp" type="number" min="0" step="1" inputMode="numeric" placeholder={zeroPlaceholder} value={txnForm.amount} onChange={(e) => setTxnForm((f) => ({ ...f, amount: e.target.value }))} />
              </FormField>
              <FormField label="Date">
                <input className="form-inp" type="date" value={txnForm.date} onChange={(e) => setTxnForm((f) => ({ ...f, date: e.target.value }))} />
              </FormField>
              <FormField label="Description">
                <input className="form-inp" type="text" placeholder={KIND_HINT[txnForm.kind]} value={txnForm.description} onChange={(e) => setTxnForm((f) => ({ ...f, description: e.target.value }))} />
              </FormField>
            </div>
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
        </ModalShell>
      )}
    </div>
  );
}
