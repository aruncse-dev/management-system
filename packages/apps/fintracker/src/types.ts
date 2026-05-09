export interface Transaction {
  id: string
  date: string
  desc: string
  a: number
  c: string
  t: 'Expense' | 'Income' | 'Transfer' | 'Savings'
  m: string
  notes: string
  _k?: number
}

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
  loading: boolean
  txnPage: number
  filter: string
  catFilter: string
  search: string
}
