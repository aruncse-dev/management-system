import type { FintrackerPrefs } from './expenseCycle'
import type { SupportedCurrency } from '../../../shared/utils/src/formatters'

/**
 * Re-exported, not redeclared.
 *
 * This file used to carry its own copy of `Transaction`, which then drifted
 * behind the shared one — it was missing `refKind`/`refId` (and `cId`/`mId`),
 * so a linked row read as unlinked anywhere this type was used. The shared
 * definition is a strict superset with the same required fields, so there is
 * nothing here worth keeping separate.
 */
import type { Transaction } from '@fintracker-vault/types'
export type { Transaction }

export interface TransactionForm {
  date: string
  desc: string
  a: string
  c: string
  t: string
  m: string
  notes: string
  toAcct: string
}

export interface MonthRef {
  month: string
  year: string
}

export interface BudgetEntry {
  id: string
  name: string
  amount: number
  /** `__global__` or `YYYY-MM` — month-specific lines override global for that month in the UI. */
  monthYear: string
  /** `YYYY-MM` or null (from beginning). */
  startMonth: string | null
  /** `YYYY-MM` or null (never ends). */
  endMonth: string | null
}

export type Budget = BudgetEntry[]

export interface OpeningBal {
  [account: string]: number
}

export interface AppState {
  month: string
  year: string
  rows: Transaction[]
  budget: Budget
  openingBal: OpeningBal
  months: MonthRef[]
  /** From org or user settings `.fintracker` via init. */
  fintracker: FintrackerPrefs
  currency: SupportedCurrency
  roundOff: boolean
  loading: boolean
  txnPage: number
  filter: string
  catFilter: string
  search: string
}
