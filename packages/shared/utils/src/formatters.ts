import { MNS } from '@fintracker-vault/config';

export type SupportedCurrency = 'INR' | 'USD' | 'AED';

const CURRENCY_SYMBOL: Record<SupportedCurrency, string> = {
  INR: '₹',
  USD: '$',
  AED: 'د.إ',
};

export function currencySymbol(currency: SupportedCurrency = 'INR'): string {
  return CURRENCY_SYMBOL[currency] ?? CURRENCY_SYMBOL.INR;
}

export function formatCurrency(
  amount: number,
  currency: SupportedCurrency = 'INR',
  roundOff = true,
): string {
  const abs = Math.abs(amount);
  const symbol = CURRENCY_SYMBOL[currency];
  const fractionDigits = roundOff ? 0 : 2;
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${symbol}${formatted}`;
}

export function INR(n: number): string {
  return formatCurrency(n, 'INR', true);
}

export function fd(s: string): string {
  if (!s) return '—';
  const m = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})/);
  return m ? parseInt(m[1]) + ' ' + m[2] : s;
}

export function isoDate(s: string): string {
  if (!s) return '';
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return '';
  const mo = MNS.indexOf(m[2] as typeof MNS[number]);
  if (mo < 0) return '';
  return `20${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function dateKey(s: string): number {
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return 0;
  const mo = MNS.indexOf(m[2] as typeof MNS[number]);
  return parseInt('20' + m[3]) * 10000 + (mo + 1) * 100 + parseInt(m[1]);
}

