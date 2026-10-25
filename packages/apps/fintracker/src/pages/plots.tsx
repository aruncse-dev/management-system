import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { localIsoDate } from '@fintracker-vault/utils';
import { ArrowDownLeft, ArrowUpRight, BarChart3, LandPlot, Plus, Receipt, Shield, TrendingUp, Wallet } from 'lucide-react';
import { api, type PlotTxnKind, type RawPlotRow, type RawPlotTxnRow } from '../api';
import { useFormatMoney, useMoneyFormatting } from '../hooks/useFormatMoney';
import { FormField, HoldingCard, InfoCallout, KpiCard, KpiGrid, ListStack, LoadingState, ModalActions, ModalShell, SectionBlock, SectionChip } from '../ui';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & MATH
// ──────────────────────────────────────────────────────────────────────────────

interface PlotTxn {
  id: string;
  plot_id: string;
  date: string;
  kind: PlotTxnKind;
  amount: number;
  description: string;
}

export interface PlotSummary {
  id: string;
  name: string;
  area_sqft: number | null;
  current_value: number | null;
  status: 'active' | 'sold';
  paid: number;
  expenses: number;
  received: number;
  /** Paid + expenses: everything that went in. */
  invested: number;
  /** What it counts for today: the estimate while held, nothing once sold. Null = not valued. */
  worth: number | null;
  /** Sold: received − invested. Held: worth + received − invested. Null while held and not valued. */
  gain: number | null;
  costPerSqft: number | null;
  txns: PlotTxn[];
}

const KIND_LABEL: Record<PlotTxnKind, string> = { paid: 'Paid', expense: 'Expense', received: 'Received' };
const KIND_HINT: Record<PlotTxnKind, string> = {
  paid: 'Advance, installment 2…',
  expense: 'Broker commission, registration…',
  received: 'Sale advance, refund…',
};

function parseTxn(raw: RawPlotTxnRow): PlotTxn | null {
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount)) return null;
  if (raw.kind !== 'paid' && raw.kind !== 'expense' && raw.kind !== 'received') return null;
  return {
    id: raw.id,
    plot_id: raw.plot_id,
    date: String(raw.date ?? '').slice(0, 10),
    kind: raw.kind,
    amount,
    description: String(raw.description ?? '').trim(),
  };
}

function positiveOrNull(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

export function summarizePlots(plotRows: RawPlotRow[], txnRows: RawPlotTxnRow[]): PlotSummary[] {
  const txns = txnRows.map(parseTxn).filter((t): t is PlotTxn => t !== null);
  return plotRows.map((p) => {
    const own = txns.filter((t) => t.plot_id === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const sum = (k: PlotTxnKind) => own.filter((t) => t.kind === k).reduce((s, t) => s + t.amount, 0);
    const paid = sum('paid');
    const expenses = sum('expense');
    const received = sum('received');
    const invested = paid + expenses;
    const area = positiveOrNull(p.area_sqft);
    const value = positiveOrNull(p.current_value);
    const sold = p.status === 'sold';
    const worth = sold ? 0 : value;
    const gain = sold ? received - invested : value !== null ? value + received - invested : null;
    return {
      id: p.id,
      name: String(p.name ?? '').trim(),
      area_sqft: area,
      current_value: value,
      status: sold ? 'sold' : 'active',
      paid,
      expenses,
      received,
      invested,
      worth,
      gain,
      costPerSqft: area !== null && invested > 0 ? invested / area : null,
      txns: own,
    };
  });
}

/** Portfolio totals. Gain only adds up plots that have one, so an unvalued plot never reads as a loss. */
export function plotTotals(rows: PlotSummary[]) {
  const held = rows.filter((r) => r.status === 'active');
  return {
    invested: held.reduce((s, r) => s + r.invested, 0),
    worth: held.reduce((s, r) => s + (r.worth ?? 0), 0),
    unvalued: held.filter((r) => r.worth === null).length,
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

const PlotCard = memo(function PlotCard({ plot, onClick }: { plot: PlotSummary; onClick: () => void }) {
  const fmt = useFormatMoney();
  const subtitle = [
    plot.area_sqft !== null ? `${plot.area_sqft.toLocaleString('en-IN')} sqft` : '',
    plot.costPerSqft !== null ? `${fmt(Math.round(plot.costPerSqft))}/sqft cost` : '',
    `${plot.txns.length} txn${plot.txns.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');
  const tone = plot.gain === null ? 'navy' : plot.gain >= 0 ? 'green' : 'red';
  return (
    <HoldingCard
      className="stock-entry-card"
      title={plot.name}
      subtitle={subtitle}
      icon={<LandPlot size={14} />}
      iconBackground
      accentTone={tone}
      rightTop={plot.status === 'sold' ? <SectionChip tone="muted">Sold</SectionChip> : undefined}
      leftLabel="Invested"
      leftValue={fmt(plot.invested)}
      centerLabel={plot.status === 'sold' ? 'Received' : 'Worth today'}
      centerValue={plot.status === 'sold' ? fmt(plot.received) : plot.worth !== null ? fmt(plot.worth) : '—'}
      rightLabel="Gain"
      rightValue={plot.gain !== null ? signed(fmt, plot.gain) : '—'}
      onClick={onClick}
    />
  );
});

const TxnCard = memo(function TxnCard({ txn, onClick }: { txn: PlotTxn; onClick: () => void }) {
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

/** Plot KPIs for the Investments dashboard; loads on its own so that tab stays independent. */
export function PlotsMetrics() {
  const fmt = useFormatMoney();
  const [rows, setRows] = useState<PlotSummary[] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([api.getPlots(), api.getPlotTxns()])
      .then(([p, t]) => { if (live) setRows(summarizePlots(p, t)); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, []);
  if (!rows || rows.length === 0) return null;
  const t = plotTotals(rows);
  return (
    <SectionBlock title="Plots" icon={<LandPlot size={14} />}>
      <KpiGrid>
        <KpiCard label="Invested" value={fmt(t.invested)} icon={<Wallet size={14} />} tone="muted" />
        <KpiCard
          label="Worth today"
          value={fmt(t.worth)}
          subtitle={t.unvalued ? `${t.unvalued} not valued` : undefined}
          icon={<TrendingUp size={14} />}
          tone="muted"
        />
        <KpiCard
          label="Gain"
          value={t.hasGain ? signed(fmt, t.gain) : '—'}
          subtitle={t.sold ? 'Incl. sold plots' : undefined}
          icon={<Shield size={14} />}
          tone="muted"
          accentTone={t.gain >= 0 ? 'green' : 'red'}
        />
        <KpiCard label="Plots" value={t.held} subtitle={t.sold ? `${t.sold} sold` : undefined} icon={<LandPlot size={14} />} tone="muted" />
      </KpiGrid>
    </SectionBlock>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

interface PlotForm { name: string; area_sqft: string; current_value: string; status: 'active' | 'sold' }
interface TxnForm { plot_id: string; kind: PlotTxnKind; amount: string; date: string; description: string }

const emptyPlotForm = (): PlotForm => ({ name: '', area_sqft: '', current_value: '', status: 'active' });
const emptyTxnForm = (plot_id = ''): TxnForm => ({ plot_id, kind: 'paid', amount: '', date: localIsoDate(), description: '' });

/** '' → null (clear), otherwise a positive number or an error string. */
function optionalPositive(raw: string, label: string): number | null | string {
  if (!raw.trim()) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : `${label} must be a number greater than 0, or left blank.`;
}

export default function Plots() {
  const { format: fmt, currency, zeroPlaceholder } = useMoneyFormatting();
  const [rows, setRows] = useState<PlotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [detailId, setDetailId] = useState<string | null>(null);

  const [plotModalOpen, setPlotModalOpen] = useState(false);
  const [editPlotId, setEditPlotId] = useState<string | null>(null);
  const [plotForm, setPlotForm] = useState<PlotForm>(emptyPlotForm());

  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<PlotTxn | null>(null);
  const [txnForm, setTxnForm] = useState<TxnForm>(emptyTxnForm());

  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  /** Modal-scoped: the page-level `error` renders behind an open modal. */
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, t] = await Promise.all([api.getPlots(), api.getPlotTxns()]);
      setRows(summarizePlots(p, t));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const totals = useMemo(() => plotTotals(rows), [rows]);
  // Held plots first, then sold; each by most invested.
  const ordered = useMemo(
    () => [...rows].sort((a, b) => (a.status === b.status ? b.invested - a.invested : a.status === 'active' ? -1 : 1)),
    [rows],
  );
  const detail = detailId ? rows.find((r) => r.id === detailId) ?? null : null;
  const editPlot = editPlotId ? rows.find((r) => r.id === editPlotId) ?? null : null;

  function resetModalState() {
    setSaving(false);
    setDeleteConfirm(false);
    setFormError('');
  }

  // ── plot modal ──
  function openAddPlot() {
    setEditPlotId(null);
    setPlotForm(emptyPlotForm());
    resetModalState();
    setPlotModalOpen(true);
  }

  function openEditPlot(p: PlotSummary) {
    setEditPlotId(p.id);
    setPlotForm({
      name: p.name,
      area_sqft: p.area_sqft !== null ? String(p.area_sqft) : '',
      current_value: p.current_value !== null ? String(p.current_value) : '',
      status: p.status,
    });
    resetModalState();
    setPlotModalOpen(true);
  }

  function closePlotModal() {
    setPlotModalOpen(false);
    setEditPlotId(null);
    resetModalState();
  }

  async function savePlot() {
    if (saving) return;
    if (!plotForm.name.trim()) { setFormError('Enter a plot name.'); return; }
    const area = optionalPositive(plotForm.area_sqft, 'Area');
    if (typeof area === 'string') { setFormError(area); return; }
    const value = optionalPositive(plotForm.current_value, 'Current value');
    if (typeof value === 'string') { setFormError(value); return; }
    setSaving(true);
    setFormError('');
    const payload = { name: plotForm.name.trim(), area_sqft: area, current_value: value, status: plotForm.status };
    try {
      if (editPlotId) await api.updatePlot({ ...payload, id: editPlotId });
      else {
        const id = await api.addPlot(payload);
        setDetailId(id);
      }
      closePlotModal();
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  async function deletePlot() {
    if (!editPlotId || saving) return;
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setSaving(true);
    try {
      await api.deletePlot(editPlotId);
      setDetailId(null);
      closePlotModal();
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Delete failed');
      setDeleteConfirm(false);
      setSaving(false);
    }
  }

  // ── transaction modal ──
  function openAddTxn(plotId?: string) {
    setEditTxn(null);
    // One plot (or a plot already open) needs no picking.
    setTxnForm(emptyTxnForm(plotId ?? (rows.length === 1 ? rows[0].id : '')));
    resetModalState();
    setTxnModalOpen(true);
  }

  function openEditTxn(t: PlotTxn) {
    setEditTxn(t);
    setTxnForm({ plot_id: t.plot_id, kind: t.kind, amount: String(t.amount), date: t.date, description: t.description });
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
    if (!txnForm.plot_id) { setFormError('Pick a plot.'); return; }
    const amount = parseFloat(txnForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setFormError('Enter an amount greater than 0.'); return; }
    if (!txnForm.date) { setFormError('Enter a date.'); return; }
    setSaving(true);
    setFormError('');
    const payload = {
      plot_id: txnForm.plot_id,
      kind: txnForm.kind,
      amount,
      date: txnForm.date,
      description: txnForm.description.trim(),
    };
    try {
      if (editTxn) await api.updatePlotTxn({ ...payload, id: editTxn.id });
      else await api.addPlotTxn(payload);
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
      await api.deletePlotTxn(editTxn.id);
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
        <KpiGrid>
          <KpiCard label="Invested" value={fmt(totals.invested)} icon={<Wallet size={14} />} tone="navy" subtitle="Paid + expenses, held plots" />
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
            subtitle={totals.sold ? 'Incl. sold plots' : undefined}
            icon={<Shield size={14} />}
            tone="muted"
            accentTone={totals.gain >= 0 ? 'green' : 'red'}
          />
          <KpiCard label="Plots" value={totals.held} subtitle={totals.sold ? `${totals.sold} sold` : 'Held'} icon={<LandPlot size={14} />} tone="muted" />
        </KpiGrid>
      </SectionBlock>

      <SectionBlock
        title="Plots"
        icon={<LandPlot size={14} />}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="settings-action-btn" onClick={openAddPlot}>
              <Plus size={14} /> Add plot
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
            No plots yet. Add one, then record each payment, commission and sale against it.
          </p>
        ) : (
          <ListStack>
            {ordered.map((p) => (
              <PlotCard key={p.id} plot={p} onClick={() => setDetailId(p.id)} />
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
          title="Add plot transaction"
          aria-label="Add plot transaction"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* PLOT DETAIL */}
      {detail && !plotModalOpen && !txnModalOpen && (
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
                <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={() => openEditPlot(detail)}>
                  Edit plot
                </button>
              }
            />
          }
        >
          <div className="ui-stack">
            <KpiGrid>
              <KpiCard label="Paid" value={fmt(detail.paid)} tone="navy" icon={<ArrowUpRight size={14} />} />
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
            {detail.costPerSqft !== null && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                {detail.area_sqft!.toLocaleString('en-IN')} sqft · cost {fmt(Math.round(detail.costPerSqft))}/sqft
                {detail.current_value !== null && detail.area_sqft
                  ? ` · worth ${fmt(Math.round(detail.current_value / detail.area_sqft))}/sqft`
                  : ''}
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

      {/* PLOT MODAL */}
      {plotModalOpen && (
        <ModalShell
          title={editPlot ? 'Edit plot' : 'Add plot'}
          onClose={closePlotModal}
          footer={
            <ModalActions
              primaryLabel={saving ? 'Saving…' : editPlot ? 'Save' : 'Add'}
              onPrimary={() => void savePlot()}
              onSecondary={closePlotModal}
              disabled={saving}
              leading={editPlot ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => void deletePlot()} disabled={saving}>
                  {deleteConfirm
                    ? `Delete with ${editPlot.txns.length} txn${editPlot.txns.length === 1 ? '' : 's'}?`
                    : 'Delete'}
                </button>
              ) : null}
            />
          }
        >
          <form onSubmit={(e) => { e.preventDefault(); void savePlot(); }}>
            <div className="ui-stack">
              {formError && <p className="ui-kit-callout ui-tone-red" role="alert">{formError}</p>}
              <FormField label="Plot name *">
                <input className="form-inp" type="text" placeholder="Place, survey no…" value={plotForm.name} onChange={(e) => setPlotForm((f) => ({ ...f, name: e.target.value }))} />
              </FormField>
              <FormField label="Area (sqft)">
                <input className="form-inp" type="number" min="0" step="any" inputMode="decimal" placeholder="Optional" value={plotForm.area_sqft} onChange={(e) => setPlotForm((f) => ({ ...f, area_sqft: e.target.value }))} />
              </FormField>
              <FormField label={`Current value (${currency})`}>
                <input className="form-inp" type="number" min="0" step="1" inputMode="numeric" placeholder="Today's estimate for the whole plot" value={plotForm.current_value} onChange={(e) => setPlotForm((f) => ({ ...f, current_value: e.target.value }))} />
              </FormField>
              <FormField label="Status">
                <select className="form-sel" value={plotForm.status} onChange={(e) => setPlotForm((f) => ({ ...f, status: e.target.value === 'sold' ? 'sold' : 'active' }))}>
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
              <FormField label="Plot *">
                <select className="form-sel" value={txnForm.plot_id} onChange={(e) => setTxnForm((f) => ({ ...f, plot_id: e.target.value }))}>
                  <option value="">Select a plot…</option>
                  {rows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FormField>
              <FormField label="Type">
                <select className="form-sel" value={txnForm.kind} onChange={(e) => setTxnForm((f) => ({ ...f, kind: e.target.value as PlotTxnKind }))}>
                  <option value="paid">Paid (toward the plot)</option>
                  <option value="expense">Expense (commission, registration…)</option>
                  <option value="received">Received (sale, refund)</option>
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
