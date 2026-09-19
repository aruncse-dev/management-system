import { ACCOUNTS, ALL_CR, MNS } from '@fintracker-vault/config';

export function isAccountMode(m: string): m is typeof ACCOUNTS[number] {
  return (ACCOUNTS as readonly string[]).includes(m);
}

export function isCrMode(m: string): boolean {
  return (ALL_CR as readonly string[]).includes(m);
}

/** Trimmed non-empty string, or null. */
export function reqText(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

/** Largest value `numeric(12,2)` can hold: 12 digits total, 2 after the point. */
export const MAX_MONEY = 9_999_999_999.99;

/**
 * A money amount as a storable string, or null when unusable.
 *
 * `num()` turns unparseable input into 0 and lets negatives through, so "abc"
 * booked a ₹0 row and a negative booked a debt that ran the wrong way — both
 * silently, since nothing downstream re-checks.
 *
 * Shared rather than app-private because the quick-add parser has to make the
 * same judgement before it puts a number in the form, and a second copy would
 * be a second place for the rule to drift.
 */
export function moneyAmount(v: unknown): string | null {
  if (typeof v === 'boolean' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_MONEY) return null;
  return String(Math.round(n * 100) / 100);
}

/**
 * Strict `yyyy-mm-dd`, or null.
 *
 * `date` columns reject anything else with a driver error that surfaces as a
 * bare 500, so the shape is checked before it reaches Postgres. Distinct from
 * `isoDate`, which converts the legacy `dd-MMM-yy` display format.
 */
export function strictIsoDate(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) ? null : s;
}

export function currentMonthYear(): { month: string; year: string } {
  const now = new Date();
  const cycleDay = 19;
  let mi = now.getMonth();
  let yr = now.getFullYear();
  if (now.getDate() >= cycleDay) {
    mi = (mi + 1) % 12;
    if (mi === 0) yr++;
  }
  return { month: MNS[mi], year: String(yr) };
}
