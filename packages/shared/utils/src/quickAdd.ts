import { MNS } from '@fintracker-vault/config';
import { moneyAmount } from './validators';

/**
 * One-line transaction entry.
 *
 *     <amount>  <description…>  <category>  <mode>
 *     500 Vegetables Cash
 *     100 Auto Travel Cash
 *     100 Temple VIsit Travel HDFC Bank
 *
 * Resolved from **both ends inward**, never by scanning loose tokens. Category
 * and mode are frequently several words — "HDFC Bank", "Food/Eating Out" — and
 * so are descriptions: "Temple VIsit Travel HDFC Bank" is four tokens that
 * split three ways, and only the fact that mode and category are drawn from
 * *known lists* tells you where the cuts go. Matching the longest suffix
 * against those lists is the whole trick; a bag-of-words scan cannot do it.
 *
 * Nothing is guessed. A word that matches no category leaves the category
 * empty for the form to ask about, rather than being filed under something
 * plausible — a wrong category is worse than a blank one, because it is
 * invisible afterwards.
 *
 * Pure and list-driven: the caller passes the *live* categories and payment
 * modes it already holds, so budget-derived categories and newly added
 * accounts work without this file knowing they exist.
 */

const MAX_PHRASE_WORDS = 4;

export type QuickAddLists = {
  /** Live expense + income categories, including budget-derived names. */
  categories: readonly string[];
  /** Live payment sources — accounts and credit names. */
  modes: readonly string[];
  /** Categories that make a row Income rather than Expense. */
  incomeCategories?: readonly string[];
  /** Defaults to now. Injected so the parse is testable. */
  today?: Date;
};

export type QuickAddResult = {
  /** Storable amount string, or null when absent or unusable. */
  amount: string | null;
  /** `yyyy-mm-dd`, or null when the line named no date (caller uses its own default). */
  date: string | null;
  /** Exact name from `categories`, or null when nothing matched. */
  category: string | null;
  /** Exact name from `modes`, or null when nothing matched. */
  mode: string | null;
  /** Free text, as typed. Falls back to the category when only a category was given. */
  desc: string | null;
  type: 'Expense' | 'Income';
  /** True once anything at all was recognised — lets the caller ignore noise. */
  matched: boolean;
};

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** `1,200` · `₹500` · `500rs` · `500/-` → a number, else NaN. */
function toNumber(word: string): number {
  const cleaned = word
    .replace(/[₹$,]/g, '')
    .replace(/\/-$/, '')
    .replace(/(?:rs|inr)\.?$/i, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return NaN;
  return parseFloat(cleaned);
}

/**
 * Longest suffix of `words` matching one of `options`, case-insensitively.
 *
 * Exact beats prefix deliberately. "hdfc" is both the whole name of the HDFC
 * card and the start of "HDFC Bank"; treating the prefix as a match would send
 * every `… hdfc` line to the bank account and silently misfile every card
 * spend. Typing the full "HDFC Bank" still reaches the bank, because that is a
 * longer suffix and longer wins.
 */
function matchSuffix(
  words: readonly string[],
  options: readonly string[],
): { value: string; used: number } | null {
  const max = Math.min(MAX_PHRASE_WORDS, words.length);
  for (let n = max; n >= 1; n--) {
    const phrase = words.slice(words.length - n).join(' ').toLowerCase();
    const exact = options.find((o) => o.trim().toLowerCase() === phrase);
    if (exact) return { value: exact, used: n };
  }
  for (let n = max; n >= 1; n--) {
    const phrase = words.slice(words.length - n).join(' ').toLowerCase();
    const starts = options.filter((o) => o.trim().toLowerCase().startsWith(phrase));
    // Only when it is unambiguous. Two candidates means the caller should ask,
    // and leaving the field blank is how it gets asked.
    if (starts.length === 1) return { value: starts[0], used: n };
  }
  return null;
}

const MONTH_INDEX = new Map(MNS.map((m, i) => [m.toLowerCase(), i]));

/**
 * Pull an explicit date out of `words`, returning the remaining words.
 *
 * Run before the amount, because every date form contains digits that would
 * otherwise be read as money. Only explicit forms count — a bare number is an
 * amount, so `100 Auto Travel Cash` is ₹100 and never the 100th.
 */
function extractDate(
  words: string[],
  today: Date,
): { date: string | null; rest: string[] } {
  const lower = words.map((w) => w.toLowerCase().replace(/[,]/g, ''));

  for (let i = 0; i < words.length; i++) {
    if (lower[i] === 'today') {
      return { date: isoOf(today), rest: words.filter((_, j) => j !== i) };
    }
    if (lower[i] === 'yesterday' || lower[i] === 'ytd') {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return { date: isoOf(d), rest: words.filter((_, j) => j !== i) };
    }
    // d/m or d-m, with an optional year.
    const slash = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/.exec(lower[i]);
    if (slash) {
      const day = parseInt(slash[1], 10);
      const mon = parseInt(slash[2], 10) - 1;
      const yr = slash[3]
        ? slash[3].length === 2
          ? 2000 + parseInt(slash[3], 10)
          : parseInt(slash[3], 10)
        : today.getFullYear();
      if (day >= 1 && day <= 31 && mon >= 0 && mon <= 11) {
        return { date: isoOf(new Date(yr, mon, day)), rest: words.filter((_, j) => j !== i) };
      }
    }
    // "18 sep" or "sep 18", either order, optional trailing year.
    const asDay = /^(\d{1,2})$/.test(lower[i]) ? parseInt(lower[i], 10) : NaN;
    const asMon = MONTH_INDEX.get(lower[i].slice(0, 3));
    if (Number.isFinite(asDay) && asDay >= 1 && asDay <= 31 && i + 1 < words.length) {
      const m = MONTH_INDEX.get(lower[i + 1].slice(0, 3));
      if (m !== undefined) {
        return {
          date: isoOf(new Date(today.getFullYear(), m, asDay)),
          rest: words.filter((_, j) => j !== i && j !== i + 1),
        };
      }
    }
    if (asMon !== undefined && i + 1 < words.length && /^\d{1,2}$/.test(lower[i + 1])) {
      const day = parseInt(lower[i + 1], 10);
      if (day >= 1 && day <= 31) {
        return {
          date: isoOf(new Date(today.getFullYear(), asMon, day)),
          rest: words.filter((_, j) => j !== i && j !== i + 1),
        };
      }
    }
  }
  return { date: null, rest: words };
}

const INCOME_PREFIXES = ['got', 'received', 'recd', '+'];

export function parseQuickAdd(text: string, lists: QuickAddLists): QuickAddResult {
  const today = lists.today ?? new Date();
  const empty: QuickAddResult = {
    amount: null,
    date: null,
    category: null,
    mode: null,
    desc: null,
    type: 'Expense',
    matched: false,
  };

  let words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return empty;

  // An explicit income marker, consumed so it never lands in the description.
  let incomeMarker = false;
  const first = words[0].toLowerCase();
  if (INCOME_PREFIXES.includes(first)) {
    incomeMarker = true;
    words = words.slice(1);
  } else if (first.startsWith('+') && Number.isFinite(toNumber(first.slice(1)))) {
    incomeMarker = true;
    words = [first.slice(1), ...words.slice(1)];
  }

  const { date, rest } = extractDate(words, today);
  words = rest;

  const modeHit = matchSuffix(words, lists.modes);
  if (modeHit) words = words.slice(0, words.length - modeHit.used);

  const catHit = matchSuffix(words, lists.categories);
  if (catHit) words = words.slice(0, words.length - catHit.used);

  // The amount leads. Taking only a leading number — rather than hunting for
  // one anywhere — keeps "Temple 2 Visit" a description instead of ₹2.
  let amount: string | null = null;
  if (words.length > 0) {
    const n = toNumber(words[0]);
    if (Number.isFinite(n)) {
      // Rejected rather than coerced: `moneyAmount` returns null for ≤ 0 and
      // for anything too large, so a typo leaves the field blank instead of
      // writing a ₹0 row that nothing downstream re-checks.
      amount = moneyAmount(n);
      words = words.slice(1);
    }
  }

  // Whatever survived is the description. When nothing did, the category is
  // the description — "500 Vegetables Cash" means a vegetables spend, and
  // repeating the word is exactly what a person would have typed.
  const descText = words.join(' ').trim();
  const desc = descText || catHit?.value || null;

  const incomeCats = (lists.incomeCategories ?? []).map((c) => c.trim().toLowerCase());
  const type: 'Expense' | 'Income' =
    incomeMarker || (catHit && incomeCats.includes(catHit.value.trim().toLowerCase()))
      ? 'Income'
      : 'Expense';

  return {
    amount,
    date,
    category: catHit?.value ?? null,
    mode: modeHit?.value ?? null,
    desc,
    type,
    matched: Boolean(amount || date || catHit || modeHit || descText),
  };
}

/** The split, for the preview line under the input. Empty when nothing parsed. */
export function quickAddSummary(r: QuickAddResult, currency = '₹'): string {
  return [
    r.amount ? `${currency}${r.amount}` : null,
    r.desc,
    r.category,
    r.mode,
    r.date,
  ]
    .filter(Boolean)
    .join(' · ');
}
