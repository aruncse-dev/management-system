import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Plus, Loader2, Pencil, LayoutDashboard, List, Clock, BarChart3, Shield, Gem, Package, Users, Home, Building2, Lock, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { api, RawGoldRow, RawGoldHistoryRow } from '../api';
import { INR } from '../utils';
import { THEME_COLORS } from '../config';
import { RightLegendDonut } from '../ui'
import { FormField, KpiCard, KpiGrid, LoadingState, ListStack, SearchField, SectionBlock } from '../ui';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

type GoldTab = 'dashboard' | 'items' | 'history';

interface GoldItem {
  id: string;
  name: string;
  weight_g: number;
  pavan: number;
  person: string;
  location: string;
}

interface GoldHistoryItem {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  name: string;
  weight_g: number;
  note?: string;
}

interface GoldFormState {
  name: string;
  weight_g: string;
  pavan: string;
  person: string;
  location: string;
}

interface GoldHistoryFormState {
  date: string;
  type: 'IN' | 'OUT';
  name: string;
  weight_g: string;
  note: string;
}

const PEOPLE = ['Ramya', 'Arun', 'Nithran', 'Dhuruvan', 'Amma'];
const LOCATIONS = ['Home', 'Bank', 'Locker'];
const PAVAN_CONVERSION = 1 / 8; // 1 pavan = 8 grams
const PERSON_COLORS: Record<string, string> = Object.fromEntries(
  PEOPLE.map((person, index) => [person, THEME_COLORS[index]])
) as Record<string, string>;
const LOCATION_COLORS: Record<string, string> = Object.fromEntries(
  LOCATIONS.map((location, index) => [location, THEME_COLORS[PEOPLE.length + index]])
) as Record<string, string>;
const LOCATION_ICONS: Record<string, React.ReactNode> = {
  Home: <Home size={12} />,
  Bank: <Building2 size={12} />,
  Locker: <Lock size={12} />,
};
function emptyForm(): GoldFormState {
  return {
    name: '',
    weight_g: '',
    pavan: '',
    person: 'Ramya',
    location: 'Home',
  };
}

function emptyHistoryForm(): GoldHistoryFormState {
  return {
    date: new Date().toISOString().split('T')[0],
    type: 'IN',
    name: '',
    weight_g: '',
    note: '',
  };
}

function parseRow(raw: RawGoldRow): GoldItem | null {
  const weight_g = parseFloat(String(raw.weight_g));
  const pavan = parseFloat(String(raw.pavan));
  if (isNaN(weight_g) || isNaN(pavan)) return null;
  return {
    id: raw.id,
    name: String(raw.name ?? '').trim(),
    weight_g,
    pavan,
    person: String(raw.person ?? '').trim(),
    location: String(raw.location ?? '').trim(),
  };
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // Try to parse and normalize to YYYY-MM-DD
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  // If parsing fails, try to extract YYYY-MM-DD pattern
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  // Fallback to today's date
  return new Date().toISOString().split('T')[0];
}

function parseHistoryRow(raw: RawGoldHistoryRow): GoldHistoryItem | null {
  const weight_g = parseFloat(String(raw.weight_g));
  if (isNaN(weight_g)) return null;
  const type = String(raw.type ?? '').trim().toUpperCase() as 'IN' | 'OUT';
  if (type !== 'IN' && type !== 'OUT') return null;
  return {
    id: raw.id,
    date: normalizeDate(String(raw.date ?? '')),
    type,
    name: String(raw.name ?? '').trim(),
    weight_g,
    note: raw.note ? String(raw.note).trim() : undefined,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────────────────────────────────────

const PersonCard = memo(function PersonCard({
  person,
  items,
}: {
  person: string;
  items: GoldItem[];
}) {
  const totalGrams = items.reduce((s, i) => s + i.weight_g, 0);
  const totalPavan = items.reduce((s, i) => s + i.pavan, 0);
  return (
    <KpiCard
      label={person}
      value={`${Math.round(totalGrams)}g`}
      subtitle={`${totalPavan.toFixed(3)} pavan`}
      tone="muted"
      icon={<Users size={14} />}
    />
  );
});

const LocationCard = memo(function LocationCard({
  location,
  items,
}: {
  location: string;
  items: GoldItem[];
}) {
  const totalGrams = items.reduce((s, i) => s + i.weight_g, 0);
  const totalPavan = items.reduce((s, i) => s + i.pavan, 0);
  return (
    <KpiCard
      label={location}
      value={`${Math.round(totalGrams)}g`}
      subtitle={`${totalPavan.toFixed(3)} pavan`}
      tone="muted"
      icon={LOCATION_ICONS[location] ?? <Home size={14} />}
    />
  );
});

const ItemCard = memo(function ItemCard({
  item,
  onClick,
}: {
  item: GoldItem;
  onClick: () => void;
}) {
  const accentTone = item.location === 'Bank' ? 'red' : item.location === 'Locker' ? 'green' : 'navy';
  const icon = LOCATION_ICONS[item.location] ?? <Home size={12} />;
  return (
    <button
      type="button"
      className={`ui-kit-holding-card ui-kit-holding-card--accent-${accentTone} ui-kit-holding-card--btn txn-entry-card`}
      onClick={onClick}
    >
      <div className="ui-kit-holding-card-head">
        <div>
          <div className="ui-kit-holding-card-title"><span>{item.name}</span></div>
          <div className="ui-kit-holding-card-subtitle">{item.person}</div>
        </div>
        <div className="ui-kit-holding-card-head-right">
          <div className={`ui-kit-holding-icon ui-kit-holding-icon--bg ui-tone-${accentTone}`}>
            <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted)', flexShrink: 0 }}>
              {icon}
            </span>
          </div>
        </div>
      </div>
      <div className="ui-kit-holding-card-grid">
        <div className="ui-kit-holding-stat"><span>Weight</span><strong>{Math.round(item.weight_g)}g</strong></div>
        <div className="ui-kit-holding-stat ui-kit-holding-stat--center"><span>Location</span><strong>{item.location}</strong></div>
        <div className="ui-kit-holding-stat ui-kit-holding-stat--right"><span>Pavan</span><strong>{item.pavan.toFixed(2)}</strong></div>
      </div>
    </button>
  );
});

const HistoryCard = memo(function HistoryCard({
  item,
  onClick,
}: {
  item: GoldHistoryItem;
  onClick: () => void;
}) {
  const isIn = item.type === 'IN';
  const icon = isIn ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />;
  return (
    <button
      type="button"
      className={`ui-kit-holding-card ui-kit-holding-card--accent-${isIn ? 'green' : 'red'} ui-kit-holding-card--btn txn-entry-card`}
      onClick={onClick}
    >
      <div className="ui-kit-holding-card-head">
        <div>
          <div className="ui-kit-holding-card-title"><span>{item.name}</span></div>
          <div className="ui-kit-holding-card-subtitle">{item.note}</div>
        </div>
        <div className="ui-kit-holding-card-head-right">
          <div className={`ui-kit-holding-icon ui-kit-holding-icon--bg ui-tone-${isIn ? 'green' : 'red'}`}>
            <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted)', flexShrink: 0 }}>
              {icon}
            </span>
          </div>
        </div>
      </div>
      <div className="ui-kit-holding-card-grid">
        <div className="ui-kit-holding-stat"><span>Weight</span><strong>{isIn ? '+' : '-'}{Math.round(item.weight_g)}g</strong></div>
        <div className="ui-kit-holding-stat ui-kit-holding-stat--center"><span>Type</span><strong>{item.type}</strong></div>
        <div className="ui-kit-holding-stat ui-kit-holding-stat--right"><span>Date</span><strong>{item.date}</strong></div>
      </div>
    </button>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export default function Gold() {
  // Tab navigation
  const [activeTab, setActiveTab] = useState<GoldTab>('dashboard');

  // Data
  const [items, setItems] = useState<GoldItem[]>([]);
  const [history, setHistory] = useState<GoldHistoryItem[]>([]);
  const [goldRate, setGoldRate] = useState(7500);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Items filter
  const [itemsSearch, setItemsSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // Items modal
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<GoldItem | null>(null);
  const [form, setForm] = useState<GoldFormState>(emptyForm());
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState(false);

  // History modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyForm, setHistoryForm] = useState<GoldHistoryFormState>(emptyHistoryForm());
  const [editHistory, setEditHistory] = useState<GoldHistoryItem | null>(null);
  const [savingHistory, setSavingHistory] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [deleteHistoryConfirm, setDeleteHistoryConfirm] = useState(false);

  // Derivations
  const totalItems = items.length;
  const totalPeople = useMemo(() => new Set(items.map(item => item.person).filter(Boolean)).size, [items]);
  const totalGrams = useMemo(() => items.reduce((s, i) => s + i.weight_g, 0), [items]);
  const totalPavan = useMemo(() => items.reduce((s, i) => s + i.pavan, 0), [items]);

  // Estimated value only for Home & Locker (excludes Bank)
  const personalGrams = useMemo(() =>
    items
      .filter(i => i.location === 'Home' || i.location === 'Locker')
      .reduce((s, i) => s + i.weight_g, 0)
  , [items]);
  const estimatedValue = useMemo(() => personalGrams * goldRate, [personalGrams, goldRate]);

  const groupedByPerson = useMemo(() => {
    const groups: Record<string, GoldItem[]> = {};
    items.forEach(i => {
      if (!groups[i.person]) groups[i.person] = [];
      groups[i.person].push(i);
    });
    return groups;
  }, [items]);

  const groupedByLocation = useMemo(() => {
    const groups: Record<string, GoldItem[]> = {};
    items.forEach(i => {
      if (!groups[i.location]) groups[i.location] = [];
      groups[i.location].push(i);
    });
    return groups;
  }, [items]);

  const personBreakdown = useMemo(() => PEOPLE.map((person) => ({
    label: person,
    value: groupedByPerson[person]?.reduce((s, item) => s + item.weight_g, 0) ?? 0,
    color: PERSON_COLORS[person],
  })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)), [groupedByPerson]);

  const locationBreakdown = useMemo(() => LOCATIONS.map((location) => ({
    label: location,
    value: groupedByLocation[location]?.reduce((s, item) => s + item.weight_g, 0) ?? 0,
    color: LOCATION_COLORS[location],
  })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)), [groupedByLocation]);

  const personTotal = useMemo(() => personBreakdown.reduce((s, item) => s + item.value, 0), [personBreakdown]);
  const locationTotal = useMemo(() => locationBreakdown.reduce((s, item) => s + item.value, 0), [locationBreakdown]);

  const filteredItems = useMemo(() => {
    return items
      .filter(i => {
        const q = itemsSearch.toLowerCase();
        return !q || i.name.toLowerCase().includes(q)
          || i.person.toLowerCase().includes(q)
          || i.location.toLowerCase().includes(q);
      })
      .sort((a, b) => b.weight_g - a.weight_g);
  }, [items, itemsSearch]);

  const filteredHistory = useMemo(() => {
    return history
      .filter(h => {
        const q = historySearch.toLowerCase();
        return !q || h.name.toLowerCase().includes(q)
          || h.type.toLowerCase().includes(q)
          || h.note?.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [history, historySearch]);

  // Load all data
  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      if (forceRefresh) {
        api.invalidateCache({ action: 'getEntries', params: { module: 'gold' } });
        api.invalidateCache({ action: 'getHistory', params: { module: 'gold' } });
        api.invalidateCache({ action: 'get', params: { module: 'settings' } });
      }
      const [rows, settings, historyRows] = await Promise.all([
        api.getGold(),
        api.getSettings(),
        api.getGoldHistory(),
      ]);
      setItems(rows.map(parseRow).filter((i): i is GoldItem => i !== null));
      setGoldRate(settings.goldRate);
      setHistory(historyRows.map(parseHistoryRow).filter((h): h is GoldHistoryItem => h !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Items handlers
  function openEditItem(i: GoldItem) {
    setEditItem(i);
    setForm({
      name: i.name,
      weight_g: String(i.weight_g),
      pavan: String(i.pavan),
      person: i.person,
      location: i.location,
    });
    setItemsModalOpen(true);
    setDeleteItemConfirm(false);
  }

  function openAddItem() {
    setEditItem(null);
    setForm(emptyForm());
    setSavingItem(false);
    setDeletingItem(false);
    setDeleteItemConfirm(false);
    setItemsModalOpen(true);
  }

  function closeItemModal() {
    setItemsModalOpen(false);
    setEditItem(null);
    setForm(emptyForm());
    setSavingItem(false);
    setDeletingItem(false);
    setDeleteItemConfirm(false);
  }

  function setField<K extends keyof GoldFormState>(k: K, v: GoldFormState[K]) {
    setForm(f => {
      const updated = { ...f, [k]: v };
      // Auto-calculate pavan from weight_g
      if (k === 'weight_g') {
        const wg = parseFloat(String(v));
        updated.pavan = isNaN(wg) ? '' : String((wg * PAVAN_CONVERSION).toFixed(2));
      }
      return updated;
    });
  }

  async function saveItem() {
    if (!form.name.trim() || !form.weight_g) return;
    if (savingItem || deletingItem) return;
    setSavingItem(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      weight_g: parseFloat(form.weight_g),
      pavan: parseFloat(form.pavan),
      person: form.person,
      location: form.location,
    };
    try {
      if (editItem) {
        await api.updateGold({ ...payload, id: editItem.id });
      } else {
        await api.addGold(payload);
      }
      closeItemModal();
      await loadData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingItem(false);
    }
  }

  async function deleteItem() {
    if (!editItem) return;
    if (savingItem || deletingItem) return;
    if (!deleteItemConfirm) {
      setDeleteItemConfirm(true);
      return;
    }
    setDeletingItem(true);
    setError('');
    const deletingId = editItem.id;
    try {
      await api.deleteGold(deletingId);
      setItems(prev => prev.filter(item => item.id !== deletingId));
      closeItemModal();
      await loadData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingItem(false);
    }
  }

  // History handlers
  function setHistoryField<K extends keyof GoldHistoryFormState>(k: K, v: GoldHistoryFormState[K]) {
    setHistoryForm(f => ({ ...f, [k]: v }));
  }

  function closeHistoryModal() {
    setHistoryModalOpen(false);
    setEditHistory(null);
    setHistoryForm(emptyHistoryForm());
    setSavingHistory(false);
    setDeletingHistory(false);
    setDeleteHistoryConfirm(false);
  }

  async function saveHistory() {
    if (!historyForm.name.trim() || !historyForm.weight_g) return;
    if (savingHistory || deletingHistory) return;
    setSavingHistory(true);
    setError('');
    const payload = {
      date: historyForm.date,
      type: historyForm.type,
      name: historyForm.name.trim(),
      weight_g: parseFloat(historyForm.weight_g),
      note: historyForm.note.trim(),
    };
    try {
      if (editHistory) {
        await api.updateGoldHistory({ ...payload, id: editHistory.id });
      } else {
        await api.addGoldHistory(payload);
      }
      closeHistoryModal();
      await loadData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingHistory(false);
    }
  }

  function openEditHistory(h: GoldHistoryItem) {
    setEditHistory(h);
    setHistoryForm({
      date: h.date,
      type: h.type,
      name: h.name,
      weight_g: String(h.weight_g),
      note: h.note || '',
    });
    setHistoryModalOpen(true);
    setDeleteHistoryConfirm(false);
  }

  function openAddHistory() {
    setEditHistory(null);
    setHistoryForm(emptyHistoryForm());
    setSavingHistory(false);
    setDeletingHistory(false);
    setDeleteHistoryConfirm(false);
    setHistoryModalOpen(true);
  }

  async function deleteHistory() {
    if (!editHistory) return;
    if (savingHistory || deletingHistory) return;
    if (!deleteHistoryConfirm) {
      setDeleteHistoryConfirm(true);
      return;
    }
    setDeletingHistory(true);
    setError('');
    const deletingId = editHistory.id;
    try {
      await api.deleteGoldHistory(deletingId);
      setHistory(prev => prev.filter(item => item.id !== deletingId));
      closeHistoryModal();
      await loadData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingHistory(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="ui-kit-page-shell gold-page">
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
          className={`bottom-nav-item${activeTab === 'items' ? ' active' : ''}`}
          onClick={() => setActiveTab('items')}
        >
          <span className="bottom-nav-icon"><List size={19} /></span>
          <span>Items</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item${activeTab === 'history' ? ' active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="bottom-nav-icon"><Clock size={19} /></span>
          <span>History</span>
        </button>
      </nav>

      <div className="pg">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <>
            <SectionBlock
              title="Metrics"
              icon={<BarChart3 size={14} />}
              right={loading ? <LoadingState variant="inline" /> : null}
            >
              <KpiGrid>
                <KpiCard label="Total Gold" value={`${Math.round(totalGrams)}g`} tone="navy" icon={<Gem size={14} />} subtitle={`${Math.round(totalPavan)} pavan`} />
                <KpiCard label="Estimated Value" value={INR(estimatedValue)} tone="amber" icon={<Shield size={14} />} subtitle={`${Math.round(personalGrams)}g @ ₹${goldRate}/g`} />
                <KpiCard label="Items" value={totalItems} tone="muted" icon={<Package size={14} />} subtitle="Tracked pieces" />
                <KpiCard label="People" value={totalPeople} tone="muted" icon={<Users size={14} />} subtitle="Ownership groups" />
              </KpiGrid>
            </SectionBlock>

            <SectionBlock title="By Location" icon={<BarChart3 size={14} />}>
              <div className="ui-kit-card" style={{ padding: 12 }}>
                <RightLegendDonut
                  items={locationBreakdown}
                  compact
                  showPct={false}
                  showCenter
                  centerLabel="TOTAL"
                  centerValue={`${Math.round(locationTotal)}g`}
                  valueFormatter={value => `${Math.round(value)}g`}
                  showLegend={false}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                {LOCATIONS.map(l => (groupedByLocation[l] ? (
                  <LocationCard key={l} location={l} items={groupedByLocation[l]} />
                ) : null))}
              </div>
            </SectionBlock>

            <SectionBlock title="By Person" icon={<BarChart3 size={14} />}>
              <div className="ui-kit-card" style={{ padding: 12 }}>
                <RightLegendDonut
                  items={personBreakdown}
                  compact
                  showPct={false}
                  showCenter
                  centerLabel="TOTAL"
                  centerValue={`${Math.round(personTotal)}g`}
                  valueFormatter={value => `${Math.round(value)}g`}
                  showLegend={false}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                {PEOPLE.map(p => (groupedByPerson[p] ? (
                  <PersonCard key={p} person={p} items={groupedByPerson[p]} />
                ) : null))}
              </div>
            </SectionBlock>
          </>
        )}

        {/* ITEMS TAB */}
        {activeTab === 'items' && (
          <>
            <SectionBlock
              title="Entries"
              icon={<List size={14} />}
              right={<span className="ui-kit-section-chip ui-tone-muted">{filteredItems.length}</span>}
            >
              <SearchField value={itemsSearch} placeholder="Search name, person, location…" onChange={setItemsSearch} onClear={() => setItemsSearch('')} />
            </SectionBlock>

            {/* Search bar */}
            {/* Loading */}
            {loading && <LoadingState variant="section" />}

            {/* Empty state */}
            {!loading && filteredItems.length === 0 && (
              <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14 }}>No items to display.</p>
            )}

            {/* Mobile cards */}
            {!loading && filteredItems.length > 0 && (
              <ListStack>
                {filteredItems.map(i => {
                  return (
                    <ItemCard
                      key={i.id}
                      item={i}
                      onClick={() => openEditItem(i)}
                    />
                  );
                })}
              </ListStack>
            )}

            {/* Desktop table */}
            {!loading && filteredItems.length > 0 && (
              <div className="tw txn-table">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Weight (g)</th>
                      <th>Pavan</th>
                      <th>Person</th>
                      <th>Location</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(i => (
                      <tr key={i.id}>
                        <td style={{ color: 'var(--muted)', fontSize: 11 }}>{i.id.slice(0, 8)}</td>
                        <td>{i.name}</td>
                        <td style={{ fontWeight: 700 }}>
                          {Math.round(i.weight_g)}
                        </td>
                        <td>
                          {i.pavan.toFixed(3)}
                        </td>
                        <td>{i.person}</td>
                        <td>{i.location}</td>
                        <td>
                          <button
                            className="icon-btn"
                            onClick={() => openEditItem(i)}
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

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <>
            <SectionBlock
              title="Entries"
              icon={<Clock size={14} />}
              right={<span className="ui-kit-section-chip ui-tone-muted">{filteredHistory.length}</span>}
            >
              <SearchField value={historySearch} placeholder="Search name, type, note…" onChange={setHistorySearch} onClear={() => setHistorySearch('')} />
            </SectionBlock>

            {/* Loading */}
            {loading && <LoadingState variant="section" />}

            {/* Empty state */}
            {!loading && filteredHistory.length === 0 && (
              <p style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: 14 }}>No history entries yet.</p>
            )}

            {/* History cards */}
            {!loading && filteredHistory.length > 0 && (
              <ListStack>
                {filteredHistory.map(h => {
                  return (
                    <HistoryCard
                      key={h.id}
                      item={h}
                      onClick={() => openEditHistory(h)}
                    />
                  );
                })}
              </ListStack>
            )}
          </>
        )}

        {/* Error message */}
        {error && (
          <p style={{ color: '#EF4444', fontSize: 13, padding: '12px 10px', marginTop: 12 }}>
            ⚠ {error}
          </p>
        )}
      </div>

      {/* FAB — context-sensitive */}
      {(activeTab === 'items' || activeTab === 'history') && (
        <button
          onClick={() => {
            if (activeTab === 'items') {
              openAddItem();
            } else {
              openAddHistory();
            }
          }}
          style={{
            position: 'fixed', bottom: 24, right: 20,
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--navy-dark)', color: '#fff',
            border: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,.2)',
            cursor: 'pointer', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title={activeTab === 'items' ? 'Add gold item' : 'Add history entry'}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* ITEMS MODAL */}
      {itemsModalOpen && (
        <div className="modal-bg open" onClick={closeItemModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <span className="modal-title">{editItem ? 'Edit Gold Item' : 'Add Gold Item'}</span>
              <button className="modal-close" onClick={closeItemModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="ui-stack">
                <FormField label="Item Name">
                  <input className="form-inp" type="text" placeholder="Necklace, Bangles…" value={form.name} onChange={e => setField('name', e.target.value)} />
                </FormField>
                <FormField label="Weight (g)">
                  <input className="form-inp" type="number" min="0" step="0.01" placeholder="0" value={form.weight_g} onChange={e => setField('weight_g', e.target.value)} />
                </FormField>
                <FormField label="Pavan">
                  <input className="form-inp" type="number" min="0" step="0.001" placeholder="0.000" value={form.pavan} disabled />
                </FormField>
                <FormField label="Person">
                  <select className="form-sel" value={form.person} onChange={e => setField('person', e.target.value)}>
                    {PEOPLE.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </FormField>
                <FormField label="Location">
                  <select className="form-sel" value={form.location} onChange={e => setField('location', e.target.value)}>
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </FormField>
              </div>
            </div>
            <div className="modal-foot">
              {editItem && (
                <button type="button" className="btn btn-sm btn-red" onClick={deleteItem} disabled={savingItem || deletingItem}>
                  {deletingItem ? 'Deleting...' : deleteItemConfirm ? 'Confirm delete?' : 'Delete'}
                </button>
              )}
              <div className="modal-foot-l" />
              <button type="button" className="btn btn-sm btn-cancel" onClick={closeItemModal} disabled={savingItem || deletingItem}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-green" onClick={saveItem} disabled={savingItem || deletingItem}>
                {savingItem ? 'Saving...' : editItem ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyModalOpen && (
        <div className="modal-bg open" onClick={closeHistoryModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <span className="modal-title">{editHistory ? 'Edit Gold Movement' : 'Add Gold Movement'}</span>
              <button className="modal-close" onClick={closeHistoryModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="ui-stack">
                <FormField label="Date">
                  <input className="form-inp" type="date" value={historyForm.date} onChange={e => setHistoryField('date', e.target.value)} />
                </FormField>
                <FormField label="Type">
                  <select className="form-sel" value={historyForm.type} onChange={e => setHistoryField('type', e.target.value as 'IN' | 'OUT')}>
                    <option value="IN">In</option>
                    <option value="OUT">Out</option>
                  </select>
                </FormField>
                <FormField label="Item Name">
                  <input className="form-inp" type="text" placeholder="Gold received from…" value={historyForm.name} onChange={e => setHistoryField('name', e.target.value)} />
                </FormField>
                <FormField label="Weight (g)">
                  <input className="form-inp" type="number" min="0" step="0.01" placeholder="0" value={historyForm.weight_g} onChange={e => setHistoryField('weight_g', e.target.value)} />
                </FormField>
                <FormField label="Note">
                  <input className="form-inp" type="text" placeholder="Wedding gift, resale…" value={historyForm.note} onChange={e => setHistoryField('note', e.target.value)} />
                </FormField>
              </div>
            </div>
            <div className="modal-foot">
              {editHistory && (
                <button type="button" className="btn btn-sm btn-red" onClick={deleteHistory} disabled={savingHistory || deletingHistory}>
                  {deletingHistory ? 'Deleting...' : deleteHistoryConfirm ? 'Confirm delete?' : 'Delete'}
                </button>
              )}
              <div className="modal-foot-l" />
              <button type="button" className="btn btn-sm btn-cancel" onClick={closeHistoryModal} disabled={savingHistory || deletingHistory}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-green" onClick={saveHistory} disabled={savingHistory || deletingHistory}>
                {savingHistory ? 'Saving...' : editHistory ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
