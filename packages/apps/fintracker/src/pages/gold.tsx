import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { localIsoDate } from '@fintracker-vault/utils'
import { Plus, SlidersHorizontal, LayoutDashboard, List, Clock, BarChart3, MapPin, Shield, Gem, Package, Users, Home, Building2, ArrowDownRight, ArrowUpRight, Handshake, Landmark } from 'lucide-react';
import { api, RawGoldRow, RawGoldHistoryRow, RawGoldLendRow, RawJewelLoanRow, GoldResource } from '../api';
import { useFormatMoney } from '../hooks/useFormatMoney';
import { THEME_COLORS } from '../config';
import { RightLegendDonut } from '../ui'
import { FormField, HoldingCard, ModalActions, ModalShell, InfoCallout, KpiCard, KpiGrid, LoadingState, ListStack, SearchField, SectionBlock, SectionChip, Spacer, UiCard } from '../ui';

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

type GoldTab = 'dashboard' | 'items' | 'lent' | 'history';
type GoldGroupBy = 'location' | 'person' | 'none';
/** What an item is tied up in right now. Only an Ongoing loan or an open lend counts. */
type GoldPledge = 'none' | 'loan' | 'lent';

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
  /** Raw links — may point at a closed loan or returned lend, kept as history. */
  jewel_loan_id: string | null;
  lend_id: string | null;
  pledge: GoldPledge;
  /** Name of the loan or lend behind `pledge`; '' when none. */
  pledgeName: string;
}

interface GoldLend {
  id: string;
  lent_to: string;
  purpose: string;
  amount: number | null;
  lent_on: string;
  expected_on: string | null;
  returned_on: string | null;
  note: string;
  open: boolean;
  /** "Person · purpose" — how the lend is named in pickers and on item cards. */
  label: string;
}

interface JewelLoanRef {
  id: string;
  name: string;
  bank: string;
  open: boolean;
}

interface GoldLendFormState {
  lent_to: string;
  purpose: string;
  amount: string;
  lent_on: string;
  expected_on: string;
  returned_on: string;
  note: string;
  item_ids: string[];
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
  pledge: GoldPledge;
  jewel_loan_id: string;
  lend_id: string;
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
/**
 * Where an actively lent item shows up instead of its usual location. The item
 * keeps `location_id`, so it goes straight back there once the lend is returned.
 */
const LENT_OUT_LABEL = 'Lent out';
const LENT_OUT_COLOR = 'var(--amber)';

const FAB_LABEL: Record<GoldTab, string> = {
  dashboard: '',
  items: 'Add gold item',
  lent: 'Lend items',
  history: 'Add gold movement',
};

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

/** Same reason as `withUnassigned`: lent grams are no location resource's, but still Total gold. */
function withLentOut(slices: Slice[], groups: Record<string, GoldItem[]>): Slice[] {
  const lent = (groups[LENT_OUT_LABEL] ?? []).reduce((s, i) => s + i.weight_g, 0);
  return lent > 0
    ? [...slices, { label: LENT_OUT_LABEL, value: lent, color: LENT_OUT_COLOR }]
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
    pledge: 'none',
    jewel_loan_id: '',
    lend_id: '',
  };
}

function emptyLendForm(): GoldLendFormState {
  return {
    lent_to: '',
    purpose: '',
    amount: '',
    lent_on: localIsoDate(),
    expected_on: '',
    returned_on: '',
    note: '',
    item_ids: [],
  };
}

/** The id the form's status points at, or '' — the one value worth comparing. */
function pledgeRef(f: Pick<GoldFormState, 'pledge' | 'jewel_loan_id' | 'lend_id'>): string {
  if (f.pledge === 'loan') return f.jewel_loan_id;
  if (f.pledge === 'lent') return f.lend_id;
  return '';
}

function parseLend(raw: RawGoldLendRow): GoldLend {
  const lent_to = String(raw.lent_to ?? '').trim();
  const purpose = String(raw.purpose ?? '').trim();
  const amount = raw.amount === null || raw.amount === undefined ? NaN : Number(raw.amount);
  return {
    id: raw.id,
    lent_to,
    purpose,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    lent_on: normalizeDate(String(raw.lent_on ?? '')),
    expected_on: raw.expected_on ? normalizeDate(String(raw.expected_on)) : null,
    returned_on: raw.returned_on ? normalizeDate(String(raw.returned_on)) : null,
    note: String(raw.note ?? '').trim(),
    open: !raw.returned_on,
    label: [lent_to, purpose].filter(Boolean).join(' · ') || 'Lend',
  };
}

/** Whole days from one ISO day to another, counted on the calendar (no timezone drift). */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** "12 Oct" — the year only when it isn't this one. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const sameYear = y === new Date().getFullYear();
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Same rule as the Loans page: anything that isn't explicitly Closed is Ongoing. */
function parseJewelLoan(raw: RawJewelLoanRow): JewelLoanRef {
  return {
    id: raw.id,
    name: String(raw.name ?? '').trim(),
    bank: String(raw.bank ?? '').trim(),
    open: String(raw.status ?? '').trim() !== 'Closed',
  };
}

function emptyHistoryForm(): GoldHistoryFormState {
  return {
    date: localIsoDate(),
    type: 'IN',
    name: '',
    weight_g: '',
    note: '',
  };
}

function parseRow(
  raw: RawGoldRow,
  map: Map<string, GoldResource>,
  loans: Map<string, JewelLoanRef>,
  lends: Map<string, GoldLend>,
): GoldItem | null {
  const weight_g = parseFloat(String(raw.weight_g))
  if (isNaN(weight_g)) return null
  const person_id = raw.person_id && String(raw.person_id).trim() ? String(raw.person_id).trim() : null
  const location_id = raw.location_id && String(raw.location_id).trim() ? String(raw.location_id).trim() : null
  const jewel_loan_id = raw.jewel_loan_id || null
  const lend_id = raw.lend_id || null
  const lend = lend_id ? lends.get(lend_id) : undefined
  const loan = jewel_loan_id ? loans.get(jewel_loan_id) : undefined
  const pledge: GoldPledge = lend?.open ? 'lent' : loan?.open ? 'loan' : 'none'
  const person = resourceName(map, person_id)
  return {
    id: raw.id,
    name: String(raw.name ?? '').trim(),
    weight_g,
    pavan: weight_g * PAVAN_CONVERSION,
    person_id,
    location_id,
    person,
    location: pledge === 'lent' ? LENT_OUT_LABEL : resourceName(map, location_id),
    locationSkip: locationSkipped(map, location_id),
    jewel_loan_id,
    lend_id,
    pledge,
    pledgeName: pledge === 'lent' ? lend?.label ?? '' : pledge === 'loan' ? loan?.name ?? '' : '',
  }
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return localIsoDate();

  // An ISO day is taken verbatim: parsing it through `Date` would treat it as
  // UTC midnight and, once formatted, could land on the neighbouring day.
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  // Anything else is parsed as local time and formatted as local time.
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return localIsoDate(date);
  }

  return localIsoDate();
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
  const lent = item.pledge === 'lent';
  const onLoan = item.pledge === 'loan';
  const tag = lent ? 'Lent' : onLoan ? 'Loan' : excluded ? EXCLUDED : '';
  const icon = lent
    ? <Handshake size={12} />
    : onLoan
      ? <Landmark size={12} />
      : excluded ? <Building2 size={12} /> : <Home size={12} />;
  // The loan or lend name is what makes the mapping visible from the list.
  const subtitle = [item.person, item.pledgeName].filter(Boolean).join(' · ');
  return (
    <HoldingCard
      className="txn-entry-card"
      title={item.name}
      subtitle={subtitle}
      icon={icon}
      iconBackground
      accentTone={excluded || lent ? 'amber' : 'navy'}
      rightTop={tag ? <span className="gold-tag">{tag}</span> : undefined}
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

const LendCard = memo(function LendCard({
  lend,
  items,
  goldRate,
  fmt,
  onClick,
}: {
  lend: GoldLend;
  items: GoldItem[];
  goldRate: number;
  fmt: (n: number) => string;
  onClick: () => void;
}) {
  const totalGrams = items.reduce((s, i) => s + i.weight_g, 0);
  const today = localIsoDate();
  const subtitle = [lend.purpose, items.map((i) => i.name).join(', ')].filter(Boolean).join(' · ');
  const daysOut = daysBetween(lend.lent_on, lend.returned_on ?? today);
  const dueIn = lend.open && lend.expected_on ? daysBetween(today, lend.expected_on) : null;
  const overdue = dueIn !== null && dueIn < 0;
  // The tag answers "do I need to chase this?" — so only overdue or done get one.
  const tag = !lend.open
    ? <span className="gold-tag gold-tag--done">Returned</span>
    : overdue
      ? <span className="gold-tag gold-tag--late">Overdue {-(dueIn as number)}d</span>
      : undefined;
  const backBy = lend.open
    ? lend.expected_on
      ? `${shortDate(lend.expected_on)}${dueIn !== null && dueIn >= 0 ? ` · ${dueIn}d` : ''}`
      : '—'
    : lend.returned_on ? shortDate(lend.returned_on) : '—';
  return (
    <HoldingCard
      className="txn-entry-card"
      title={lend.lent_to || 'Lend'}
      subtitle={subtitle}
      icon={<Handshake size={14} />}
      iconBackground
      accentTone={!lend.open ? 'green' : overdue ? 'red' : 'amber'}
      rightTop={tag}
      leftLabel="Weight"
      leftValue={grams(totalGrams)}
      centerLabel="Loan"
      centerValue={lend.amount !== null ? fmt(lend.amount) : '—'}
      rightLabel="Since"
      rightValue={shortDate(lend.lent_on)}
      secondaryGrid={{
        // Weight at today's rate, beside what they raised on it.
        leftLabel: 'Worth today',
        leftValue: goldRate > 0 ? fmt(totalGrams * goldRate) : '—',
        centerLabel: lend.open ? 'Days out' : 'Was out',
        centerValue: `${daysOut}d`,
        rightLabel: lend.open ? 'Back by' : 'Returned',
        rightValue: backBy,
      }}
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
  const [lends, setLends] = useState<GoldLend[]>([]);
  const [jewelLoans, setJewelLoans] = useState<JewelLoanRef[]>([]);
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
  const [lendSearch, setLendSearch] = useState('');

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

  // Lend modal
  const [lendModalOpen, setLendModalOpen] = useState(false);
  const [editLend, setEditLend] = useState<GoldLend | null>(null);
  const [lendForm, setLendForm] = useState<GoldLendFormState>(emptyLendForm());
  const [savingLend, setSavingLend] = useState(false);
  const [deletingLend, setDeletingLend] = useState(false);
  const [deleteLendConfirm, setDeleteLendConfirm] = useState(false);
  const [lendError, setLendError] = useState('');

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

  // Estimated value excludes locations marked `skip` on the resource (e.g. Bank)
  // and anything lent out — still ours, but not in hand until it comes back.
  // Net worth (getNetWorth) applies the same two rules.
  const lentGrams = useMemo(
    () => items.filter((i) => i.pledge === 'lent').reduce((s, i) => s + i.weight_g, 0),
    [items],
  );
  const personalGrams = useMemo(
    () => items.filter((i) => !i.locationSkip && i.pledge !== 'lent').reduce((s, i) => s + i.weight_g, 0),
    [items],
  );
  const estimatedValue = useMemo(() => personalGrams * goldRate, [personalGrams, goldRate]);
  /** Skipped-location grams only; a lent item is reported as lent even if its home location is skipped. */
  const excludedGrams = useMemo(() => totalGrams - personalGrams - lentGrams, [totalGrams, personalGrams, lentGrams]);
  const estimatedValueSubtitle = useMemo(() => {
    const rate = goldRate.toLocaleString('en-IN');
    if (excludedGrams <= 0 && lentGrams <= 0) return `${grams(totalGrams)} @ ${rate} INR/g`;
    return [
      `${grams(personalGrams)} counted`,
      lentGrams > 0 ? `${grams(lentGrams)} lent` : '',
      excludedGrams > 0 ? `${grams(excludedGrams)} excluded` : '',
      `${rate}/g`,
    ].filter(Boolean).join(' · ');
  }, [goldRate, excludedGrams, lentGrams, totalGrams, personalGrams]);

  const openLoans = useMemo(() => jewelLoans.filter((l) => l.open), [jewelLoans]);
  const openLends = useMemo(() => lends.filter((l) => l.open), [lends]);
  /** What borrowers raised on our jewels, across open lends that recorded it. */
  const lentAmount = useMemo(() => openLends.reduce((s, l) => s + (l.amount ?? 0), 0), [openLends]);
  const lentSubtitle = useMemo(() => {
    if (lentGrams <= 0) return undefined;
    return [
      `${grams(lentGrams)} lent`,
      goldRate > 0 ? `worth ${fmt(lentGrams * goldRate)}` : '',
      lentAmount > 0 ? `${fmt(lentAmount)} raised on it` : '',
    ].filter(Boolean).join(' · ');
  }, [lentGrams, goldRate, lentAmount, fmt]);
  /** By raw link, so a returned lend still lists what went out with it. */
  const itemsByLend = useMemo(() => {
    const m = new Map<string, GoldItem[]>();
    for (const i of items) {
      if (!i.lend_id) continue;
      const bucket = m.get(i.lend_id);
      if (bucket) bucket.push(i);
      else m.set(i.lend_id, [i]);
    }
    return m;
  }, [items]);
  /** Open first (newest out first), then returned (newest back first). Search spans the lend and its items. */
  const filteredLends = useMemo(() => {
    const q = lendSearch.trim().toLowerCase();
    const match = (l: GoldLend) =>
      !q || l.purpose.toLowerCase().includes(q)
        || l.lent_to.toLowerCase().includes(q)
        || l.note.toLowerCase().includes(q)
        || (itemsByLend.get(l.id) ?? []).some(i => i.name.toLowerCase().includes(q));
    const shown = lends.filter(match);
    return {
      open: shown.filter(l => l.open).sort((a, b) => b.lent_on.localeCompare(a.lent_on)),
      returned: shown.filter(l => !l.open).sort((a, b) => (b.returned_on ?? '').localeCompare(a.returned_on ?? '')),
    };
  }, [lends, lendSearch, itemsByLend]);

  /** What the lend sheet can offer: free items plus this lend's own. Items on a live loan or another open lend stay put. */
  const lendCandidates = useMemo(
    () =>
      items
        .filter((i) => i.pledge === 'none' || (editLend !== null && i.lend_id === editLend.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items, editLend],
  );
  const lendFormGrams = useMemo(() => {
    const picked = new Set(lendForm.item_ids);
    return items.filter((i) => picked.has(i.id)).reduce((s, i) => s + i.weight_g, 0);
  }, [items, lendForm.item_ids]);

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
        withLentOut(
          locationResources
            .map((location) => ({
              label: location.name,
              value: groupedByLocation[location.name]?.reduce((s, item) => s + item.weight_g, 0) ?? 0,
              color: LOCATION_COLORS[location.name] ?? THEME_COLORS[0],
            }))
            .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
          groupedByLocation,
        ),
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
          || i.location.toLowerCase().includes(q)
          || i.pledgeName.toLowerCase().includes(q);
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
        // Lent out sits just above Unassigned: it isn't a real place either.
        if (a.label === LENT_OUT_LABEL) return 1;
        if (b.label === LENT_OUT_LABEL) return -1;
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
    if (groupedByLocation[LENT_OUT_LABEL]?.length) names.push(LENT_OUT_LABEL);
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
      const [rows, resRows, settings, historyRows, lendRows, loanRows] = await Promise.all([
        api.getGold(),
        api.getGoldResources(),
        api.getSettings(),
        api.getGoldHistory(),
        api.getGoldLends(),
        api.getJewelLoans(),
      ]);
      setResources(resRows);
      const map = resourceMap(resRows)
      const parsedLends = lendRows.map(parseLend);
      const parsedLoans = loanRows.map(parseJewelLoan);
      setLends(parsedLends);
      setJewelLoans(parsedLoans);
      const lendMap = new Map(parsedLends.map((l) => [l.id, l]));
      const loanMap = new Map(parsedLoans.map((l) => [l.id, l]));
      setItems(rows.map((r) => parseRow(r, map, loanMap, lendMap)).filter((i): i is GoldItem => i !== null));
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
      // Only a current pledge is shown; a closed loan or returned lend reads as None.
      pledge: i.pledge,
      jewel_loan_id: i.pledge === 'loan' ? i.jewel_loan_id ?? '' : '',
      lend_id: i.pledge === 'lent' ? i.lend_id ?? '' : '',
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
    if (form.pledge === 'loan' && !form.jewel_loan_id) { setItemError('Pick the jewel loan this item is pledged under.'); return; }
    if (form.pledge === 'lent' && !form.lend_id) { setItemError('Pick the lend this item went out with.'); return; }
    // Status goes out only when it changed. An item whose loan closed opens as
    // None; re-saving it unchanged must not wipe that link, which is its history.
    const pledgeChanged = editItem
      ? form.pledge !== editItem.pledge || pledgeRef(form) !== pledgeRef({
          pledge: editItem.pledge,
          jewel_loan_id: editItem.jewel_loan_id ?? '',
          lend_id: editItem.lend_id ?? '',
        })
      : form.pledge !== 'none';
    setSavingItem(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      weight_g: parseFloat(form.weight_g),
      // null, not undefined: the server reads an absent key as "leave unchanged",
      // so clearing a link back to Unassigned has to be sent explicitly.
      person_id: form.person_id.trim() || null,
      location_id: form.location_id.trim() || null,
      ...(pledgeChanged && {
        pledge_kind: form.pledge,
        jewel_loan_id: form.pledge === 'loan' ? form.jewel_loan_id : null,
        lend_id: form.pledge === 'lent' ? form.lend_id : null,
      }),
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

  // Lend handlers
  function setLendField<K extends keyof GoldLendFormState>(k: K, v: GoldLendFormState[K]) {
    setLendForm(f => ({ ...f, [k]: v }));
  }

  function toggleLendItem(id: string) {
    setLendForm(f => ({
      ...f,
      item_ids: f.item_ids.includes(id) ? f.item_ids.filter(x => x !== id) : [...f.item_ids, id],
    }));
  }

  function openAddLend() {
    setEditLend(null);
    setLendForm(emptyLendForm());
    setSavingLend(false);
    setDeletingLend(false);
    setDeleteLendConfirm(false);
    setLendError('');
    setLendModalOpen(true);
  }

  function openEditLend(l: GoldLend) {
    setEditLend(l);
    setLendForm({
      lent_to: l.lent_to,
      purpose: l.purpose,
      amount: l.amount !== null ? String(l.amount) : '',
      lent_on: l.lent_on,
      expected_on: l.expected_on ?? '',
      returned_on: l.returned_on ?? '',
      note: l.note,
      item_ids: (itemsByLend.get(l.id) ?? []).map(i => i.id),
    });
    setSavingLend(false);
    setDeletingLend(false);
    setDeleteLendConfirm(false);
    setLendError('');
    setLendModalOpen(true);
  }

  function closeLendModal() {
    setLendModalOpen(false);
    setEditLend(null);
    setLendForm(emptyLendForm());
    setSavingLend(false);
    setDeletingLend(false);
    setDeleteLendConfirm(false);
    setLendError('');
  }

  async function saveLend() {
    if (savingLend || deletingLend) return;
    setLendError('');
    if (!lendForm.lent_to.trim()) { setLendError('Who has the jewels?'); return; }
    if (!lendForm.lent_on) { setLendError('Enter the date the jewels went out.'); return; }
    const amount = lendForm.amount.trim() ? parseFloat(lendForm.amount) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
      setLendError('Amount must be a number greater than 0, or left blank.');
      return;
    }
    if (lendForm.expected_on && lendForm.expected_on < lendForm.lent_on) {
      setLendError('Expected back cannot be before lent on.');
      return;
    }
    // An existing lend may be saved empty (its last item was deleted or moved),
    // so it can still be marked returned instead of only deleted.
    if (lendForm.item_ids.length === 0 && !editLend) { setLendError('Pick at least one item.'); return; }
    if (lendForm.returned_on && lendForm.returned_on < lendForm.lent_on) {
      setLendError('Returned on cannot be before lent on.');
      return;
    }
    setSavingLend(true);
    setError('');
    const payload = {
      lent_to: lendForm.lent_to.trim(),
      purpose: lendForm.purpose.trim(),
      amount,
      lent_on: lendForm.lent_on,
      expected_on: lendForm.expected_on || null,
      returned_on: lendForm.returned_on || null,
      note: lendForm.note.trim(),
      item_ids: lendForm.item_ids,
    };
    try {
      if (editLend) {
        await api.updateGoldLend({ ...payload, id: editLend.id });
      } else {
        await api.addGoldLend(payload);
      }
      closeLendModal();
      await loadData();
    } catch (e) {
      setLendError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingLend(false);
    }
  }

  async function deleteLend() {
    if (!editLend) return;
    if (savingLend || deletingLend) return;
    if (!deleteLendConfirm) {
      setDeleteLendConfirm(true);
      return;
    }
    setDeletingLend(true);
    setError('');
    try {
      await api.deleteGoldLend(editLend.id);
      closeLendModal();
      await loadData();
    } catch (e) {
      setDeleteLendConfirm(false);
      setLendError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingLend(false);
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
          className={`bottom-nav-item${activeTab === 'lent' ? ' active' : ''}`}
          onClick={() => setActiveTab('lent')}
        >
          <span className="bottom-nav-icon"><Handshake size={19} /></span>
          <span>Lent</span>
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
                  subtitle={estimatedValueSubtitle}
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
                {groupedByLocation[LENT_OUT_LABEL] ? (
                  <KpiCard
                    label={LENT_OUT_LABEL}
                    value={grams(lentGrams)}
                    subtitle={`${(lentGrams * PAVAN_CONVERSION).toFixed(2)} pavan · ${EXCLUDED.toLowerCase()}`}
                    tone="muted"
                    icon={<Handshake size={14} />}
                    onClick={() => setActiveTab('lent')}
                  />
                ) : null}
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

        {/* LENT TAB */}
        {activeTab === 'lent' && (
          <>
            <SectionBlock
              title="Lent out"
              icon={<Handshake size={14} />}
              subtitle={lentSubtitle}
              right={<SectionChip>{openLends.length}</SectionChip>}
            >
              {lends.length > 0 && (
                <SearchField value={lendSearch} placeholder="Search person, purpose, item…" onChange={setLendSearch} onClear={() => setLendSearch('')} />
              )}
            </SectionBlock>

            {loading && <LoadingState variant="section" />}

            {!loading && filteredLends.open.length === 0 && filteredLends.returned.length === 0 && (
              <div className="gold-empty">
                <Handshake size={28} />
                <p>
                  {lendSearch
                    ? 'No lends match that search.'
                    : 'Nothing lent out. When you hand jewels to someone, for their loan or otherwise, tap + to record it. One lend can cover several items.'}
                </p>
              </div>
            )}

            {!loading && (filteredLends.open.length > 0 || filteredLends.returned.length > 0) && (
              <div className="ui-stack">
                {filteredLends.open.length > 0 && (
                  <ListStack>
                    {filteredLends.open.map(l => (
                      <LendCard key={l.id} lend={l} items={itemsByLend.get(l.id) ?? []} goldRate={goldRate} fmt={fmt} onClick={() => openEditLend(l)} />
                    ))}
                  </ListStack>
                )}
                {filteredLends.returned.length > 0 && (
                  <div>
                    <div className="ui-kit-txn-daybar">
                      <span>Returned</span>
                      <strong>{filteredLends.returned.length}</strong>
                    </div>
                    <ListStack>
                      {filteredLends.returned.map(l => (
                        <LendCard key={l.id} lend={l} items={itemsByLend.get(l.id) ?? []} goldRate={goldRate} fmt={fmt} onClick={() => openEditLend(l)} />
                      ))}
                    </ListStack>
                  </div>
                )}
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
      {(activeTab === 'items' || activeTab === 'lent' || activeTab === 'history') && (
        <button
          onClick={() => {
            if (activeTab === 'items') openAddItem();
            else if (activeTab === 'lent') openAddLend();
            else openAddHistory();
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
          title={FAB_LABEL[activeTab]}
          aria-label={FAB_LABEL[activeTab]}
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
              <FormField label="Status">
                <select
                  className="form-sel"
                  value={form.pledge}
                  onChange={e => setField('pledge', e.target.value as GoldPledge)}
                >
                  <option value="none">None</option>
                  <option value="loan">Jewel loan</option>
                  <option value="lent">Lent</option>
                </select>
              </FormField>
              {form.pledge === 'loan' && (
                openLoans.length > 0 ? (
                  <FormField label="Jewel loan *">
                    <select className="form-sel" value={form.jewel_loan_id} onChange={e => setField('jewel_loan_id', e.target.value)}>
                      <option value="">Select a loan…</option>
                      {openLoans.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}{l.bank ? ` · ${l.bank}` : ''}</option>
                      ))}
                    </select>
                  </FormField>
                ) : (
                  <InfoCallout title="No ongoing jewel loans">
                    Add the loan under All Loans → Jewel first, then map this item to it.
                  </InfoCallout>
                )
              )}
              {form.pledge === 'lent' && (
                openLends.length > 0 ? (
                  <FormField label="Lend *">
                    <select className="form-sel" value={form.lend_id} onChange={e => setField('lend_id', e.target.value)}>
                      <option value="">Select a lend…</option>
                      {openLends.map((l) => (
                        <option key={l.id} value={l.id}>{l.label}</option>
                      ))}
                    </select>
                  </FormField>
                ) : (
                  <InfoCallout title="Nothing lent out yet">
                    Record it on the Lent tab first; one lend can cover several items.
                  </InfoCallout>
                )
              )}
              {form.pledge === 'lent' && (
                <p className="gold-lend-hint">Lent gold is left out of Estimated value and net worth until it&apos;s returned.</p>
              )}
            </div>
            {/* Lets Enter submit without duplicating the ModalActions button. */}
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
        </ModalShell>
      )}

      {/* LEND MODAL */}
      {lendModalOpen && (
        <ModalShell title={editLend ? 'Edit lend' : 'Lend items'} onClose={closeLendModal} footer={
          <ModalActions
            primaryLabel={savingLend ? 'Saving…' : editLend ? 'Save' : 'Lend'}
            onPrimary={() => void saveLend()}
            onSecondary={closeLendModal}
            disabled={savingLend || deletingLend}
            leading={editLend ? (
              <button
                type="button"
                className="ui-kit-btn ui-kit-btn--solid btn-red"
                onClick={() => void deleteLend()}
                disabled={savingLend || deletingLend}
              >
                {deletingLend ? 'Deleting…' : deleteLendConfirm ? `Delete "${editLend.label}"?` : 'Delete'}
              </button>
            ) : null}
          />
        }>
          <form onSubmit={e => { e.preventDefault(); void saveLend(); }}>
            <div className="ui-stack">
              {lendError ? <p className="gold-modal-error" role="alert">{lendError}</p> : null}
              <FormField label="Lent to *">
                <input className="form-inp" type="text" placeholder="Person" value={lendForm.lent_to} onChange={e => setLendField('lent_to', e.target.value)} />
              </FormField>
              <FormField label="Purpose">
                <input className="form-inp" type="text" placeholder="Plot purchase, emergency…" value={lendForm.purpose} onChange={e => setLendField('purpose', e.target.value)} />
              </FormField>
              <FormField label="Loan amount">
                <input className="form-inp" type="number" min="0" step="1" inputMode="numeric" placeholder="What they raised on it" value={lendForm.amount} onChange={e => setLendField('amount', e.target.value)} />
              </FormField>
              <div className="gold-lend-dates">
                <FormField label="Lent on *">
                  <input className="form-inp" type="date" value={lendForm.lent_on} onChange={e => setLendField('lent_on', e.target.value)} />
                </FormField>
                <FormField label="Expected back">
                  <input className="form-inp" type="date" value={lendForm.expected_on} min={lendForm.lent_on || undefined} onChange={e => setLendField('expected_on', e.target.value)} />
                </FormField>
              </div>
              <FormField label={`Items * ${lendForm.item_ids.length ? `(${lendForm.item_ids.length} · ${grams(lendFormGrams)})` : ''}`}>
                {lendCandidates.length === 0 ? (
                  <p className="gold-lend-hint">Every item is already on a jewel loan or lent out.</p>
                ) : (
                  <div className="gold-lend-items">
                    {lendCandidates.map(i => (
                      <label key={i.id} className="gold-lend-item">
                        <input
                          type="checkbox"
                          checked={lendForm.item_ids.includes(i.id)}
                          onChange={() => toggleLendItem(i.id)}
                        />
                        <span className="gold-lend-item-name">{i.name}</span>
                        <span className="gold-lend-item-meta">{grams(i.weight_g)}{i.person ? ` · ${i.person}` : ''}</span>
                      </label>
                    ))}
                  </div>
                )}
              </FormField>
              {editLend && (
                <FormField label="Returned on">
                  <input className="form-inp" type="date" value={lendForm.returned_on} onChange={e => setLendField('returned_on', e.target.value)} />
                </FormField>
              )}
              {editLend && (
                <p className="gold-lend-hint">
                  Leave blank while the jewels are still with them. Once set, the items count toward
                  Estimated value again and the lend stays here as a record.
                </p>
              )}
              <FormField label="Note">
                <input className="form-inp" type="text" placeholder="Bank, loan number…" value={lendForm.note} onChange={e => setLendField('note', e.target.value)} />
              </FormField>
            </div>
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
