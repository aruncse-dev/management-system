/**
 * Fintracker app config: re-use shared catalog; keep app-only keys here.
 */
import { Banknote, Landmark, Lock, PiggyBank, Repeat2 } from 'lucide-react'

export {
  MNS,
  TXN_PAGE,
  CATEGORIES,
  INCOME_CATS,
  THEME_COLORS,
  DECOR_COLORS,
  decorColor,
  withAlpha,
} from '@fintracker-vault/config'

/** `budget.month_year` value for defaults shared across months (month-specific rows override per `YYYY-MM`). */
export const BUDGET_GLOBAL_MONTH_KEY = '__global__' as const

export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

/**
 * Account kinds, in display order.
 *
 * One catalog behind the chips in Settings → Accounts and on the Savings
 * dashboard, plus the icon on each account card. Purely presentational: the
 * kind labels an account, it never feeds a balance or a total, so a wrong one
 * is a cosmetic fix rather than a reconciliation problem.
 *
 * `savings_bank` is first because it is the default every existing account was
 * backfilled to.
 */
export const ACCOUNT_KINDS = [
  { value: 'savings_bank', label: 'Savings Bank', icon: Landmark },
  { value: 'rd', label: 'RD', icon: Repeat2 },
  { value: 'fd', label: 'FD', icon: Lock },
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'other', label: 'Other', icon: PiggyBank },
] as const

export type AccountKindValue = (typeof ACCOUNT_KINDS)[number]['value']

const ACCOUNT_KIND_FALLBACK = ACCOUNT_KINDS[0]

/** Catalog entry for a stored kind, falling back to Savings Bank for anything unknown. */
export function accountKindMeta(kind: string | null | undefined) {
  return ACCOUNT_KINDS.find(k => k.value === kind) ?? ACCOUNT_KIND_FALLBACK
}
