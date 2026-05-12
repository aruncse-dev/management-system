export interface Transaction {
  id: string;
  date: string;
  desc: string;
  a: number;
  c: string;
  cId?: string;
  t: 'Expense' | 'Income' | 'Transfer' | 'Savings';
  m: string;
  mId?: string;
  /** Optional memo; for transfers prefer `transferTo` + short memo instead of encoding `→` in notes. */
  notes: string;
  /** When `t === 'Transfer'`, destination side (`m` is source). Legacy rows may omit this and use `notes` `→…` only. */
  transferTo?: string;
  transferToId?: string;
  _k?: number;
}

export interface MonthRef {
  month: string;
  year: string;
}

export interface PaymentSource {
  id: string;
  name: string;
  sourceType: 'account' | 'credit_card' | 'informal';
  usedFor?: 'savings' | 'monthly' | 'both';
  isActive?: boolean;
}

export interface BudgetEntry {
  id: string;
  name: string;
  amount: number;
}

export type Budget = BudgetEntry[];

export interface OpeningBal {
  [account: string]: number;
}

export interface AppState {
  month: string;
  year: string;
  rows: Transaction[];
  budget: Budget;
  openingBal: OpeningBal;
  months: MonthRef[];
  loading: boolean;
  txnPage: number;
  filter: string;
  catFilter: string;
  search: string;
}

export interface TransactionForm {
  date: string;
  desc: string;
  a: string;
  c: string;
  cId?: string;
  t: string;
  m: string;
  mId?: string;
  notes: string;
  toAcct?: string;
  toAcctId?: string;
}
