import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Plus, SlidersHorizontal, LayoutDashboard, List, Clock, BarChart3, MapPin, Shield, Gem, Package, Users, Home, Building2, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { api, RawGoldRow, RawGoldHistoryRow, GoldResource } from '../api';
import { useFormatMoney } from '../hooks/useFormatMoney';
import { THEME_COLORS } from '../config';
import { RightLegendDonut } from '../ui'
import { FormField, HoldingCard, ModalActions, ModalShell, InfoCallout, KpiCard, KpiGrid, LoadingState, ListStack, SearchField, SectionBlock, SectionChip, Spacer, UiCard } from '../ui';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

type GoldTab = 'dashboard' | 'items' | 'history';
type GoldGroupBy = 'location' | 'person' | 'none';

interface GoldItem {
  id: string;
  name: string;
  weight_g: number;
  pavan: number;
  person_id: string | null;
  location_id: string | null;
  person: string;
  location: string;
  /** True when the linked location resource has `skip` (e.g. Bank) — excluded from estimated personal value. */
  locationSkip: boolean;
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
  person_id: string;
  location_id: string;
}

interface GoldHistoryFormState {
  date: string;
  type: 'IN' | 'OUT';
  name: string;
  weight_g: string;
  note: string;
}

const PAVAN_CONVERSION = 1 / 8; // 1 pavan = 8 grams

const UNASSIGNED_LABEL = 'Unassigned';
/** One short word for the `skip` flag on cards and tiles. The full explanation
    lives once, on the Settings checkbox — repeating it on every row was noise. */
const EXCLUDED = 'Excluded';
/** Neutral grey, deliberately not from THEME_COLORS so a new resource can't collide with it. */
const UNASSIGNED_COLOR = 'var(--other)';

type Slice = { label: string; value: number; color: string };

/**
 * Items with no person/location — or pointing at a deleted resource, which
 * `resourceName` also resolves to '' — land in the `''` bucket. Without this
 * they count toward the Total Gold KPI but vanish from the donut, so the
 * donut centre disagrees with the KPI above it. Appended after the sort so
 * the grey slice stays last instead of jumping position as data changes.
 */
function withUnassigned(slices: Slice[], groups: Record<string, GoldItem[]>): Slice[] {
  const orphan = (groups[''] ?? []).reduce((s, i) => s + i.weight_g, 0);
  return orphan > 0
    ? [...slices, { label: UNASSIGNED_LABEL, value: orphan, color: UNASSIGNED_COLOR }]
    : slices;
}

/** Grams at 1dp, trailing zeros stripped — `numeric(10,3)` deserves better than Math.round. */
function grams(n: number): string {
  return `${Number(n.toFixed(1))}g`;
}

function resourceMap(resources: GoldResource[]): Map<string, GoldResource> {
  return new Map(resources.map((r) => [r.id, r]))
}

function resourceName(map: Map<string, GoldResource>, id: string | null): string {
  if (!id) return ''
  return map.get(id)?.name?.trim() ?? ''
}

function locationSkipped(map: Map<string, GoldResource>, id: string | null): boolean {
  if (!id) return false
  return map.get(id)?.skip === true
}

function createEmptyGoldForm(person_id = '', location_id = ''): GoldFormState {
  return {
    name: '',
    weight_g: '',
    pavan: '',
    person_id,
    location_id,
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

function parseRow(raw: RawGoldRow, map: Map<string, GoldResource>): GoldItem | null {
  const weight_g = parseFloat(String(raw.weight_g))
  if (isNaN(weight_g)) return null
  const person_id = raw.person_id && String(raw.person_id).trim() ? String(raw.person_id).trim() : null
  const location_id = raw.location_id && String(raw.location_id).trim() ? String(raw.location_id).trim() : null
  const person = resourceName(map, person_id)
  const location = resourceName(map, location_id)
  return {
    id: raw.id,
    name: String(raw.name ?? '').trim(),
    weight_g,
    pavan: weight_g * PAVAN_CONVERSION,
    person_id,
    location_id,
    person,
    location,
    locationSkip: locationSkipped(map, location_id),
  }
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
  onClick,
}: {
  person: string;
  items: GoldItem[];
  onClick: () => void;
}) {
  const totalGrams = items.reduce((s, i) => s + i.weight_g, 0);
  const totalPavan = items.reduce((s, i) => s + i.pavan, 0);
  return (
    <KpiCard
      label={person}
      value={grams(totalGrams)}
      subtitle={`${totalPavan.toFixed(2)} pavan`}
      tone="muted"
      icon={<Users size={14} />}
      onClick={onClick}
    />
  );
});

const LocationCard = memo(function LocationCard({
  location,
  items,
  skip,
  onClick,
}: {
  location: string;
  items: GoldItem[];
  skip: boolean;
  onClick: () => void;
}) {
  const totalGrams = items.reduce((s, i) => s + i.weight_g, 0);
  const totalPavan = items.reduce((s, i) => s + i.pavan, 0);
  return (
    <KpiCard
      label={location}
      value={grams(totalGrams)}
      subtitle={skip ? `${totalPavan.toFixed(2)} pavan · ${EXCLUDED.toLowerCase()}` : `${totalPavan.toFixed(2)} pavan`}
      tone="muted"
      icon={skip ? <Building2 size={14} /> : <Home size={14} />}
      onClick={onClick}
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
  // Keyed off `skip` rather than the location's name: locations are user-created
  // rows, so name matching silently fell back to Home for anything but the
  // three hardcoded strings — and `skip` is what actually changes valuation.
  const excluded = item.locationSkip;
  return (
    <HoldingCard
      className="txn-entry-card"
      title={item.name}
      subtitle={item.person}
      icon={excluded ? <Building2 size={12} /> : <Home size={12} />}
      iconBackground
      accentTone={excluded ? 'amber' : 'navy'}
      rightTop={excluded ? <span className="gold-tag">{EXCLUDED}</span> : undefined}
      leftLabel="Weight"
      leftValue={grams(item.weight_g)}
      centerLabel="Location"
      centerValue={item.location || UNASSIGNED_LABEL}
      rightLabel="Pavan"
      rightValue={item.pavan.toFixed(2)}
      onClick={onClick}
    />
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
  return (
    <HoldingCard
      className="txn-entry-card"
      title={item.name}
      subtitle={item.note}
      icon={isIn ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
      iconBackground
      accentTone={isIn ? 'green' : 'red'}
      leftLabel="Weight"
      leftValue={`${isIn ? '+' : '\u2212'}${grams(item.weight_g)}`}
      centerLabel="Type"
      centerValue={item.type}
      rightLabel="Date"
      rightValue={item.date}
      onClick={onClick}
    />
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export default function Gold() {
  const fmt = useFormatMoney();
  // Tab navigation
  const [activeTab, setActiveTab] = useState<GoldTab>('dashboard');

  // Data
  const [items, setItems] = useState<GoldItem[]>([]);
  const [history, setHistory] = useState<GoldHistoryItem[]>([]);
  const [resources, setResources] = useState<GoldResource[]>([]);
  const [goldRate, setGoldRate] = useState(0);
  /** Until settings resolve, show '—' rather than a plausible-but-invented value. */
  const [rateLoaded, setRateLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Items filter
  const [itemsSearch, setItemsSearch] = useState('');
  /** '' = no filter. Matched on resource name, which is what the item rows carry. */
  const [personFilter, setPersonFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [groupBy, setGroupBy] = useState<GoldGroupBy>('location');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  /** Sheet edits a draft so Cancel really cancels. */
  const [draftPerson, setDraftPerson] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftGroupBy, setDraftGroupBy] = useState<GoldGroupBy>('location');
  const [historySearch, setHistorySearch] = useState('');

  // Items modal
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<GoldItem | null>(null);
  const [form, setForm] = useState<GoldFormState>(createEmptyGoldForm());
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState(false);
  /** Modal-scoped: the page-level `error` renders behind an open modal. */
  const [itemError, setItemError] = useState('');

  // History modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyForm, setHistoryForm] = useState<GoldHistoryFormState>(emptyHistoryForm());
  const [editHistory, setEditHistory] = useState<GoldHistoryItem | null>(null);
  const [savingHistory, setSavingHistory] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [deleteHistoryConfirm, setDeleteHistoryConfirm] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const personResources = useMemo(() => resources.filter((r) => r.type === 'person'), [resources]);
  const locationResources = useMemo(() => resources.filter((r) => r.type === 'location'), [resources]);
  const hasGoldResources = personResources.length > 0 || locationResources.length > 0;

  const PERSON_COLORS = useMemo(
    () =>
      Object.fromEntries(
        personResources.map((r, index) => [r.name, THEME_COLORS[index % THEME_COLORS.length]]),
      ) as Record<string, string>,
    [personResources],
  );

  const LOCATION_COLORS = useMemo(
    () =>
      Object.fromEntries(
        locationResources.map((r, index) => [
          r.name,
          THEME_COLORS[(personResources.length + index) % THEME_COLORS.length],
        ]),
      ) as Record<string, string>,
    [locationResources, personResources.length],
  );

  // Derivations
  const totalItems = items.length;
  const totalPeople = useMemo(() => new Set(items.map(item => item.person).filter(Boolean)).size, [items]);
  const totalGrams = useMemo(() => items.reduce((s, i) => s + i.weight_g, 0), [items]);
  const totalPavan = useMemo(() => items.reduce((s, i) => s + i.pavan, 0), [items]);

  // Estimated value excludes locations marked `skip` on the resource (e.g. Bank).
  const personalGrams = useMemo(
    () => items.filter((i) => !i.locationSkip).reduce((s, i) => s + i.weight_g, 0),
    [items],
  );
  const estimatedValue = useMemo(() => personalGrams * goldRate, [personalGrams, goldRate]);
  const excludedGrams = useMemo(() => totalGrams - personalGrams, [totalGrams, personalGrams]);

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

  const personBreakdown = useMemo(
    () =>
      withUnassigned(
        personResources
          .map((person) => ({
            label: person.name,
            value: groupedByPerson[person.name]?.reduce((s, item) => s + item.weight_g, 0) ?? 0,
            color: PERSON_COLORS[person.name] ?? THEME_COLORS[0],
          }))
          .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
        groupedByPerson,
      ),
    [groupedByPerson, personResources, PERSON_COLORS],
  );

  const locationBreakdown = useMemo(
    () =>
      withUnassigned(
        locationResources
          .map((location) => ({
            label: location.name,
            value: groupedByLocation[location.name]?.reduce((s, item) => s + item.weight_g, 0) ?? 0,
            color: LOCATION_COLORS[location.name] ?? THEME_COLORS[0],
          }))
          .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
        groupedByLocation,
      ),
    [groupedByLocation, locationResources, LOCATION_COLORS],
  );

  // Both equal `totalGrams` because `withUnassigned` keeps the unbucketed grams.
  // Drop that and the donut centre silently stops matching the Total Gold KPI.
  const personTotal = useMemo(() => personBreakdown.reduce((s, item) => s + item.value, 0), [personBreakdown]);
  const locationTotal = useMemo(() => locationBreakdown.reduce((s, item) => s + item.value, 0), [locationBreakdown]);

  const matchesFilter = useCallback(
    (value: string, filter: string) =>
      !filter || (filter === UNASSIGNED_LABEL ? !value : value === filter),
    [],
  );

  const filteredItems = useMemo(() => {
    return items
      .filter(i => matchesFilter(i.person, personFilter) && matchesFilter(i.location, locationFilter))
      .filter(i => {
        const q = itemsSearch.toLowerCase();
        return !q || i.name.toLowerCase().includes(q)
          || i.person.toLowerCase().includes(q)
          || i.location.toLowerCase().includes(q);
      })
      .sort((a, b) => b.weight_g - a.weight_g);
  }, [items, itemsSearch, personFilter, locationFilter, matchesFilter]);

  /** Grams shown by the current filter — the list header would otherwise only say how many rows. */
  const filteredGrams = useMemo(
    () => filteredItems.reduce((s, i) => s + i.weight_g, 0),
    [filteredItems],
  );

  /**
   * Sections for the items grid. `filteredItems` is already sorted by weight, so
   * each section inherits that order; sections themselves go heaviest first with
   * Unassigned pinned last so it never separates two real groups.
   */
  const itemSections = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', items: filteredItems, grams: filteredGrams }];
    }
    const buckets = new Map<string, GoldItem[]>();
    for (const i of filteredItems) {
      const key = (groupBy === 'location' ? i.location : i.person) || UNASSIGNED_LABEL;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(i);
      else buckets.set(key, [i]);
    }
    return [...buckets.entries()]
      .map(([label, rows]) => ({
        key: label,
        label,
        items: rows,
        grams: rows.reduce((sum, i) => sum + i.weight_g, 0),
      }))
      .sort((a, b) => {
        if (a.label === UNASSIGNED_LABEL) return 1;
        if (b.label === UNASSIGNED_LABEL) return -1;
        return b.grams - a.grams || a.label.localeCompare(b.label);
      });
  }, [filteredItems, filteredGrams, groupBy]);

  const hasUnassignedPerson = useMemo(() => items.some(i => !i.person), [items]);
  const hasUnassignedLocation = useMemo(() => items.some(i => !i.location), [items]);

  // Only offer a pill for a resource that actually holds items — a filter that
  // can only ever return nothing is noise.
  const personFilterOptions = useMemo(() => {
    const names = personResources.filter(r => groupedByPerson[r.name]?.length).map(r => r.name);
    return hasUnassignedPerson ? [...names, UNASSIGNED_LABEL] : names;
  }, [personResources, groupedByPerson, hasUnassignedPerson]);

  const locationFilterOptions = useMemo(() => {
    const names = locationResources.filter(r => groupedByLocation[r.name]?.length).map(r => r.name);
    return hasUnassignedLocation ? [...names, UNASSIGNED_LABEL] : names;
  }, [locationResources, groupedByLocation, hasUnassignedLocation]);

  const filtersActive = Boolean(personFilter || locationFilter);
  /** Grouping is a view choice, not a filter — it doesn't count toward the badge. */
  const activeFilterCount = (personFilter ? 1 : 0) + (locationFilter ? 1 : 0);
  const canFilterItems = locationFilterOptions.length > 1 || personFilterOptions.length > 1;

  const openFilterModal = useCallback(() => {
    setDraftPerson(personFilter);
    setDraftLocation(locationFilter);
    setDraftGroupBy(groupBy);
    setFilterModalOpen(true);
  }, [personFilter, locationFilter, groupBy]);

  const applyFilters = useCallback(() => {
    setPersonFilter(draftPerson);
    setLocationFilter(draftLocation);
    setGroupBy(draftGroupBy);
    setFilterModalOpen(false);
  }, [draftPerson, draftLocation, draftGroupBy]);

  /** Jump from a dashboard tile straight to the matching list. */
  const showItemsFor = useCallback((opts: { person?: string; location?: string }) => {
    setPersonFilter(opts.person ?? '');
    setLocationFilter(opts.location ?? '');
    setItemsSearch('');
    setActiveTab('items');
  }, []);

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
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, resRows, settings, historyRows] = await Promise.all([
        api.getGold(),
        api.getGoldResources(),
        api.getSettings(),
        api.getGoldHistory(),
      ]);
      setResources(resRows);
      const map = resourceMap(resRows)
      setItems(rows.map((r) => parseRow(r, map)).filter((i): i is GoldItem => i !== null));
      setGoldRate(settings.goldRate);
      setRateLoaded(true);
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
      pavan: String(i.pavan.toFixed(2)),
      person_id: i.person_id ?? '',
      location_id: i.location_id ?? '',
    });
    setItemsModalOpen(true);
    setDeleteItemConfirm(false);
  }

  function openAddItem() {
    setEditItem(null);
    const firstPerson = personResources[0]?.id ?? '';
    const firstLoc =
      locationResources.find((l) => !l.skip)?.id ?? locationResources[0]?.id ?? '';
    setForm(createEmptyGoldForm(firstPerson, firstLoc));
    setSavingItem(false);
    setDeletingItem(false);
    setDeleteItemConfirm(false);
    setItemsModalOpen(true);
  }

  function closeItemModal() {
    setItemsModalOpen(false);
    setEditItem(null);
    setForm(createEmptyGoldForm());
    setSavingItem(false);
    setDeletingItem(false);
    setDeleteItemConfirm(false);
    setItemError('');
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
    if (savingItem || deletingItem) return;
    setItemError('');
    if (!form.name.trim()) { setItemError('Enter an item name.'); return; }
    const weight = parseFloat(form.weight_g);
    if (!Number.isFinite(weight) || weight <= 0) {
      setItemError('Enter a weight in grams greater than 0.');
      return;
    }
    setSavingItem(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      weight_g: parseFloat(form.weight_g),
      // null, not undefined: the server reads an absent key as "leave unchanged",
      // so clearing a link back to Unassigned has to be sent explicitly.
      person_id: form.person_id.trim() || null,
      location_id: form.location_id.trim() || null,
    };
    try {
      if (editItem) {
        await api.updateGold({ ...payload, id: editItem.id });
      } else {
        await api.addGold(payload);
      }
      closeItemModal();
      await loadData();
    } catch (e) {
      setItemError(e instanceof Error ? e.message : 'Save failed');
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
      await loadData();
    } catch (e) {
      setDeleteItemConfirm(false);
      setItemError(e instanceof Error ? e.message : 'Delete failed');
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
    setHistoryError('');
  }

  async function saveHistory() {
    if (savingHistory || deletingHistory) return;
    setHistoryError('');
    if (!historyForm.name.trim()) { setHistoryError('Enter an item name.'); return; }
    const weight = parseFloat(historyForm.weight_g);
    if (!Number.isFinite(weight) || weight <= 0) {
      setHistoryError('Enter a weight in grams greater than 0.');
      return;
    }
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
      await loadData();
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Save failed');
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
      await loadData();
    } catch (e) {
      setDeleteHistoryConfirm(false);
      setHistoryError(e instanceof Error ? e.message : 'Delete failed');
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
                <KpiCard label="Total gold" value={grams(totalGrams)} tone="navy" icon={<Gem size={14} />} subtitle={`${totalPavan.toFixed(2)} pavan`} />
                <KpiCard
                  label="Estimated value"
                  value={rateLoaded ? fmt(estimatedValue) : '—'}
                  tone="amber"
                  icon={<Shield size={14} />}
                  subtitle={
                    excludedGrams > 0
                      ? `${grams(personalGrams)} counted · ${grams(excludedGrams)} excluded · ${goldRate.toLocaleString('en-IN')}/g`
                      : `${grams(totalGrams)} @ ${goldRate.toLocaleString('en-IN')} INR/g`
                  }
                />
                <KpiCard label="Items" value={totalItems} tone="muted" icon={<Package size={14} />} subtitle="Tracked pieces" />
                <KpiCard label="People" value={totalPeople} tone="muted" icon={<Users size={14} />} subtitle="Ownership groups" />
              </KpiGrid>
            </SectionBlock>

            <SectionBlock title="By location" icon={<MapPin size={14} />}>
              <UiCard>
                <RightLegendDonut
                  items={locationBreakdown}
                  compact
                  showPct={false}
                  showCenter
                  centerLabel="TOTAL"
                  centerValue={grams(locationTotal)}
                  valueFormatter={grams}
                  showLegend={false}
                />
              </UiCard>
              <Spacer size={8} />
              <div className="gold-breakdown-grid">
                {locationResources.map((r) =>
                  groupedByLocation[r.name] ? (
                    <LocationCard
                      key={r.id}
                      location={r.name}
                      items={groupedByLocation[r.name]}
                      skip={r.skip}
                      onClick={() => showItemsFor({ location: r.name })}
                    />
                  ) : null,
                )}
              </div>
            </SectionBlock>

            <SectionBlock title="By person" icon={<Users size={14} />}>
              <UiCard>
                <RightLegendDonut
                  items={personBreakdown}
                  compact
                  showPct={false}
                  showCenter
                  centerLabel="TOTAL"
                  centerValue={grams(personTotal)}
                  valueFormatter={grams}
                  showLegend={false}
                />
              </UiCard>
              <Spacer size={8} />
              <div className="gold-breakdown-grid">
                {personResources.map((r) =>
                  groupedByPerson[r.name] ? (
                    <PersonCard
                      key={r.id}
                      person={r.name}
                      items={groupedByPerson[r.name]}
                      onClick={() => showItemsFor({ person: r.name })}
                    />
                  ) : null,
                )}
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
              subtitle={filtersActive || itemsSearch ? `${grams(filteredGrams)} shown` : undefined}
              right={
                <div className="gold-section-right">
                  {canFilterItems && (
                    <button
                      type="button"
                      className="gold-filter-btn"
                      onClick={openFilterModal}
                      aria-label={activeFilterCount ? `Filters, ${activeFilterCount} active` : 'Filters'}
                    >
                      <SlidersHorizontal size={13} />
                      Filter
                      {activeFilterCount > 0 && <span className="gold-filter-count">{activeFilterCount}</span>}
                    </button>
                  )}
                  <SectionChip>{filteredItems.length}</SectionChip>
                </div>
              }
            >
              <SearchField value={itemsSearch} placeholder="Search name, person, location…" onChange={setItemsSearch} onClear={() => setItemsSearch('')} />
            </SectionBlock>

            {loading && <LoadingState variant="section" />}

            {!loading && filteredItems.length === 0 && (
              <div className="gold-empty">
                <Gem size={28} />
                <p>
                  {itemsSearch || filtersActive
                    ? 'No items match those filters.'
                    : 'No gold items yet. Tap + to add one.'}
                </p>
              </div>
            )}

            {!loading && filteredItems.length > 0 && (
              <div className="ui-stack">
                {itemSections.map(section => (
                  <div key={section.key}>
                    {section.label && (
                      <div className="ui-kit-txn-daybar">
                        <span>{section.label}</span>
                        <strong>{grams(section.grams)} · {section.items.length}</strong>
                      </div>
                    )}
                    <ListStack>
                      {section.items.map(i => (
                        <ItemCard key={i.id} item={i} onClick={() => openEditItem(i)} />
                      ))}
                    </ListStack>
                  </div>
                ))}
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
              right={<SectionChip>{filteredHistory.length}</SectionChip>}
            >
              <SearchField value={historySearch} placeholder="Search name, type, note…" onChange={setHistorySearch} onClear={() => setHistorySearch('')} />
            </SectionBlock>

            {/* Loading */}
            {loading && <LoadingState variant="section" />}

            {/* Empty state */}
            {!loading && filteredHistory.length === 0 && (
              <div className="gold-empty">
                <Clock size={28} />
                <p>{historySearch ? 'No movements match that search.' : 'No movements recorded yet. Tap + to add one.'}</p>
              </div>
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
          <p style={{ color: THEME_COLORS[5], fontSize: 13, padding: '12px 10px', marginTop: 12 }} role="alert">
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
          title={activeTab === 'items' ? 'Add gold item' : 'Add gold movement'}
          aria-label={activeTab === 'items' ? 'Add gold item' : 'Add gold movement'}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* FILTER SHEET */}
      {filterModalOpen && (
        <ModalShell
          title="Filter items"
          onClose={() => setFilterModalOpen(false)}
          footer={
            <ModalActions
              primaryLabel="Apply"
              onPrimary={applyFilters}
              onSecondary={() => setFilterModalOpen(false)}
              leading={
                draftPerson || draftLocation ? (
                  <button
                    type="button"
                    className="ui-kit-btn ui-kit-btn--soft"
                    onClick={() => { setDraftPerson(''); setDraftLocation(''); }}
                  >
                    Reset
                  </button>
                ) : null
              }
            />
          }
        >
          <form onSubmit={e => { e.preventDefault(); applyFilters(); }}>
            <div className="ui-stack">
              {locationFilterOptions.length > 1 && (
                <FormField label="Location">
                  <select
                    className="form-sel"
                    value={draftLocation}
                    onChange={e => setDraftLocation(e.target.value)}
                  >
                    <option value="">All locations</option>
                    {locationFilterOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </FormField>
              )}
              {personFilterOptions.length > 1 && (
                <FormField label="Person">
                  <select
                    className="form-sel"
                    value={draftPerson}
                    onChange={e => setDraftPerson(e.target.value)}
                  >
                    <option value="">All people</option>
                    {personFilterOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </FormField>
              )}
              <FormField label="Group by">
                <select
                  className="form-sel"
                  value={draftGroupBy}
                  onChange={e => setDraftGroupBy(e.target.value as GoldGroupBy)}
                >
                  <option value="location">Location</option>
                  <option value="person">Person</option>
                  <option value="none">No grouping</option>
                </select>
              </FormField>
            </div>
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
        </ModalShell>
      )}

      {/* ITEMS MODAL */}
      {itemsModalOpen && (
        <ModalShell title={editItem ? 'Edit gold item' : 'Add gold item'} onClose={closeItemModal} footer={
          <ModalActions
            primaryLabel={savingItem ? 'Saving…' : editItem ? 'Save' : 'Add'}
            onPrimary={() => void saveItem()}
            onSecondary={closeItemModal}
            disabled={savingItem || deletingItem}
            leading={editItem ? (
              <button
                type="button"
                className="ui-kit-btn ui-kit-btn--solid btn-red"
                onClick={() => void deleteItem()}
                disabled={savingItem || deletingItem}
              >
                {deletingItem ? 'Deleting…' : deleteItemConfirm ? `Delete "${editItem.name}"?` : 'Delete'}
              </button>
            ) : null}
          />
        }>
          <form onSubmit={e => { e.preventDefault(); void saveItem(); }}>
            <div className="ui-stack">
              {itemError ? <p className="gold-modal-error" role="alert">{itemError}</p> : null}
              {!hasGoldResources ? (
                <InfoCallout title="No people or locations yet">
                  Add them in Settings → Gold so items can be assigned an owner and a location.
                </InfoCallout>
              ) : null}
              <FormField label="Item name *">
                <input className="form-inp" type="text" placeholder="Necklace, Bangles…" value={form.name} onChange={e => setField('name', e.target.value)} />
              </FormField>
              <FormField label="Weight (g) *">
                <input className="form-inp" type="number" min="0" step="0.001" placeholder="0" value={form.weight_g} onChange={e => setField('weight_g', e.target.value)} />
              </FormField>
              <FormField label="Pavan">
                <input className="form-inp" type="number" step="0.001" placeholder="0.000" value={form.pavan} disabled />
              </FormField>
              <FormField label="Person">
                <select className="form-sel" value={form.person_id} onChange={e => setField('person_id', e.target.value)}>
                  <option value="">{UNASSIGNED_LABEL}</option>
                  {personResources.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Location">
                <select className="form-sel" value={form.location_id} onChange={e => setField('location_id', e.target.value)}>
                  <option value="">{UNASSIGNED_LABEL}</option>
                  {locationResources.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}{l.skip ? ' (excluded)' : ''}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            {/* Lets Enter submit without duplicating the ModalActions button. */}
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
        </ModalShell>
      )}

      {/* HISTORY MODAL */}
      {historyModalOpen && (
        <ModalShell title={editHistory ? 'Edit gold movement' : 'Add gold movement'} onClose={closeHistoryModal} footer={
          <ModalActions
            primaryLabel={savingHistory ? 'Saving…' : editHistory ? 'Save' : 'Add'}
            onPrimary={() => void saveHistory()}
            onSecondary={closeHistoryModal}
            disabled={savingHistory || deletingHistory}
            leading={editHistory ? (
              <button
                type="button"
                className="ui-kit-btn ui-kit-btn--solid btn-red"
                onClick={() => void deleteHistory()}
                disabled={savingHistory || deletingHistory}
              >
                {deletingHistory ? 'Deleting…' : deleteHistoryConfirm ? `Delete "${editHistory.name}"?` : 'Delete'}
              </button>
            ) : null}
          />
        }>
          <form onSubmit={e => { e.preventDefault(); void saveHistory(); }}>
            <div className="ui-stack">
              {historyError ? <p className="gold-modal-error" role="alert">{historyError}</p> : null}
              <FormField label="Date">
                <input className="form-inp" type="date" value={historyForm.date} onChange={e => setHistoryField('date', e.target.value)} />
              </FormField>
              <FormField label="Type">
                <select className="form-sel" value={historyForm.type} onChange={e => setHistoryField('type', e.target.value as 'IN' | 'OUT')}>
                  <option value="IN">In</option>
                  <option value="OUT">Out</option>
                </select>
              </FormField>
              <FormField label="Item name *">
                <input className="form-inp" type="text" placeholder="Gold received from…" value={historyForm.name} onChange={e => setHistoryField('name', e.target.value)} />
              </FormField>
              <FormField label="Weight (g) *">
                <input className="form-inp" type="number" min="0" step="0.001" placeholder="0" value={historyForm.weight_g} onChange={e => setHistoryField('weight_g', e.target.value)} />
              </FormField>
              <FormField label="Note">
                <input className="form-inp" type="text" placeholder="Wedding gift, resale…" value={historyForm.note} onChange={e => setHistoryField('note', e.target.value)} />
              </FormField>
            </div>
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
        </ModalShell>
      )}
    </div>
  );
}
