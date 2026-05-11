/**
 * Fintracker app config: re-use shared catalog; keep app-only keys here.
 */
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
