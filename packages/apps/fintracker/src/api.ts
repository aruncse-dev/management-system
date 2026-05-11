import { Budget, BudgetEntry, MonthRef, OpeningBal, Transaction } from './types';
import { API_URL } from './constants';

type ApiResponse<T> = { ok: true; data: T; traceId?: string; debug?: Record<string, unknown> } | { ok: false; error: string; traceId?: string };

// App API base comes from config.ts (default: same-origin /api)
const BASE = API_URL;
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

function generateTraceId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    const isLoginPage = text.includes('accounts.google.com');
    throw new Error(
      isLoginPage
        ? 'Received a sign-in page instead of API JSON — sign in to the app and ensure /api routes are reachable.'
        : 'Unexpected HTML from API — check NEXT_PUBLIC_API_URL, server logs, and DATABASE_URL.',
    );
  }
  const json: ApiResponse<T> = JSON.parse(text);
  if (!json.ok) {
    const err = new Error(json.error) as Error & { traceId?: string };
    err.traceId = json.traceId;
    throw err;
  }
  if (DEBUG) {
    const msg: any = { traceId: json.traceId };
    if (json.debug) msg.debug = json.debug;
    console.log('[API Trace]', msg);
  }
  return json.data;
}

function invalidateCache(matcher?: { action?: string; params?: Record<string, string> }) {
  void matcher;
}

function clearPersistentCache() {
  // No persistent cache in client anymore.
}

async function get<T>(
  action: string,
  params: Record<string, string> = {},
  options: { cache?: boolean } = {}
): Promise<T> {
  void options;
  const url = new URL(BASE, window.location.origin);
  const traceId = generateTraceId();
  url.searchParams.set('action', action);
  url.searchParams.set('traceId', traceId);
  if (DEBUG) url.searchParams.set('debug', 'true');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { credentials: 'same-origin', redirect: 'follow', cache: 'no-store' });
  return parseResponse<T>(res);
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const traceId = generateTraceId();
  const payload = {
    ...body,
    traceId,
    ...(DEBUG && { debug: true }),
  };
  const res = await fetch(BASE, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  const data = await parseResponse<T>(res);
  return data;
}

export interface InitData {
  months: MonthRef[];
  budget: Budget;
  openingBal: OpeningBal;
}

const _initInflightByKey = new Map<string, Promise<InitData>>();

/** Loads `init` for the calendar month (budget merges global + month-specific overrides). */
export function loadInitDataDeduped(month: string, year: string): Promise<InitData> {
  const key = `${month}\t${year}`;
  let p = _initInflightByKey.get(key);
  if (!p) {
    p = get<InitData>('init', { month, year }).finally(() => {
      _initInflightByKey.delete(key);
    });
    _initInflightByKey.set(key, p);
  }
  return p;
}

export interface RawLendingRow {
  id: string;
  date: string;
  name: string;
  amount: number | string;
  type: string;
  description: string;
}

export interface RawSavingsRow {
  id: string;
  date: string;
  account: string;
  amount: number | string;
  desc: string;
  type: string;
  toAccount?: string;
  category?: string;
}

export interface RawGoldRow {
  id: string;
  name: string;
  weight_g: number | string;
  pavan: number | string;
  person: string;
  location: string;
}

export interface RawGoldHistoryRow {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  name: string;
  weight_g: number | string;
  note?: string;
}

export interface RawEmiRow {
  id: string;
  name: string;
  bank: string;
  principal: number | string;
  rate: number | string;
  start_date: string;
  tenure_months: number | string;
  emi_amount: number | string;
  paid_emis: number | string;
  status: string;
}

export interface RawJewelLoanRow {
  id: string;
  name: string;
  bank: string;
  principal: number | string;
  rate: number | string;
  start_date: string;
  end_date: string;
  paid_amount: number | string;
  status: string;
}

export interface RawJewelLoanHistoryRow {
  id: string;
  loan_id: string;
  date: string;
  amount: number | string;
  note?: string;
}

export interface RawCashLoanRow {
  id: string;
  person_name: string;
  amount_received: number | string;
  start_date: string;
  paid_amount: number | string;
}

export interface RawCashLoanHistoryRow {
  id: string;
  loan_id: string;
  date: string;
  amount: number | string;
  note?: string;
}

export interface GoldSettings {
  goldRate: number;
  usdToInr?: number;
  loansSpreadsheetId?: string;
  emiSheetName?: string;
  expensesSheetId?: string;
  assetsSheetId?: string;
}

export interface ProfileData {
  email: string;
  displayName: string | null;
  activeOrgId: string | null;
  orgs: { id: string; name: string }[];
}

export type AccountUsedFor = 'savings' | 'monthly' | 'both';

export interface AccountRow {
  id: string;
  userEmail: string;
  orgId: string | null;
  name: string;
  description: string | null;
  usedFor: string;
  isActive: boolean;
  sortOrder: number;
}

export type CreditSourceCategory = 'credit_card' | 'informal';

export interface CreditSourceRow {
  id: string;
  userEmail: string;
  orgId: string | null;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  sortOrder: number;
}

export type AccountPayload = {
  id?: string;
  name: string;
  description?: string | null;
  usedFor: AccountUsedFor;
  isActive?: boolean;
  sortOrder?: number;
};

export type CreditSourcePayload = {
  id?: string;
  name: string;
  description?: string | null;
  category: CreditSourceCategory;
  isActive?: boolean;
  sortOrder?: number;
};

async function restJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, window.location.origin).toString();
  const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    throw new Error('Unexpected HTML from API');
  }
  const json = JSON.parse(text) as ApiResponse<T>;
  if (!json.ok) {
    throw new Error(json.error);
  }
  return json.data;
}

export interface VaultSettings {
  vaultSpreadsheetId?: string;
}

export interface RawBankingRow {
  id: string;
  account_holder_name: string;
  bank_name: string;
  app_uuid?: string;
  account_no: string;
  ifsc: string;
  cif: string;
  username: string;
  password: string;
  transaction_password: string;
  profile_password: string;
  mpin: string;
  updated_at?: string;
}

export interface RawVaultAppRow {
  app_uuid: string;
  app_name: string;
  category: string;
  logo: string;
  app_link: string;
  username: string;
  password: string;
  two_factor_enabled: boolean;
  notes: string;
  updated_at?: string;
}

export interface RawInsuranceRow {
  id: string;
  policy_type: string;
  plan_name: string;
  insurer: string;
  app_uuid?: string;
  policy_number: string;
  policy_owner: string;
  premium_amount: number | string;
  premium_mode: string;
  payment_method: string;
  policy_term: string;
  issue_date: string;
  maturity_date: string;
  sum_assured: number | string;
  cash_value: number | string;
  nominee_name: string;
  notes: string;
  updated_at?: string;
}

export interface RawSubscriptionRow {
  id: string;
  name: string;
  category: string;
  amount: number | string;
  currency: string;
  billing_cycle: string;
  start_date: string;
  end_date: string;
  autopay: boolean;
  status: string;
  payment_method: string;
  app_uuid?: string;
  notes: string;
  updated_at?: string;
}

export interface RawHolding {
  symbol: string;
  company: string;
  isin: string;
  qty: number;
  avgPrice: number;
  lastPrice: number;
  pnl: number;
  dayChangePct: number;
  synced: string;
}

export const api = {
  invalidateCache,
  clearPersistentCache,
  init:          (month: string, year: string)   => get<InitData>('init', { month, year }),
  getData:       (month: string, year: string)  => get<Transaction[]>('getData', { month, year }),
  addRow:        (p: Record<string, unknown>)   => post<string>({ action: 'addRow', ...p }),
  updateRow:     (p: Record<string, unknown>)   => post<boolean>({ action: 'updateRow', ...p }),
  deleteRow:     (month: string, year: string, id: string) => post<boolean>({ action: 'deleteRow', month, year, id }),
  saveBudget:        (budgets: Budget, opts?: { monthYear?: string; month?: string; year?: string }) =>
    post<boolean>({
      action: 'saveBudget',
      budgets,
      ...(opts?.monthYear !== undefined ? { monthYear: opts.monthYear } : {}),
      ...(opts?.month !== undefined ? { month: opts.month } : {}),
      ...(opts?.year !== undefined ? { year: opts.year } : {}),
    }),
  addBudgetEntry:    (name: string, amt: number, monthYear?: string) =>
    post<BudgetEntry>({
      action: 'addBudgetEntry',
      name,
      amt,
      ...(monthYear !== undefined ? { monthYear } : {}),
    }),
  updateBudgetEntry: (id: string, name: string, amt: number, monthYear?: string) =>
    post<boolean>({
      action: 'updateBudgetEntry',
      id,
      name,
      amt,
      ...(monthYear !== undefined ? { monthYear } : {}),
    }),
  deleteBudgetEntry: (id: string)                  => post<boolean>({ action: 'deleteBudgetEntry', id }),
  saveOpeningBal:(data: OpeningBal)             => post<boolean>({ action: 'saveOpeningBal', data }),
  getLending:    (sheetName?: string)          => get<RawLendingRow[]>('getEntries', { module: 'lending', ...(sheetName && sheetName !== 'Lending' && { sheetName }) }),
  addLending:    (p: Record<string, unknown>, sheetName?: string)  => post<string>({ module: 'lending', action: 'addEntry', ...(sheetName && sheetName !== 'Lending' && { sheetName }), ...p }),
  updateLending: (p: Record<string, unknown>, sheetName?: string)  => post<boolean>({ module: 'lending', action: 'updateEntry', ...(sheetName && sheetName !== 'Lending' && { sheetName }), ...p }),
  deleteLending: (id: string, sheetName?: string)                  => post<boolean>({ module: 'lending', action: 'deleteEntry', id, ...(sheetName && sheetName !== 'Lending' && { sheetName }) }),
  getSavings:    (sheetName?: string)          => get<RawSavingsRow[]>('getEntries', { module: 'savings', ...(sheetName && sheetName !== 'Savings' ? { sheetName } : {}) }),
  addSavings:    (p: Record<string, unknown>, sheetName?: string)  => post<string>({ module: 'savings', action: 'addEntry', ...(sheetName && sheetName !== 'Savings' ? { sheetName } : {}), ...p }),
  updateSavings: (p: Record<string, unknown>, sheetName?: string)  => post<boolean>({ module: 'savings', action: 'updateEntry', ...(sheetName && sheetName !== 'Savings' ? { sheetName } : {}), ...p }),
  deleteSavings: (id: string, sheetName?: string)                  => post<boolean>({ module: 'savings', action: 'deleteEntry', id, ...(sheetName && sheetName !== 'Savings' ? { sheetName } : {}) }),
  getGold:       ()                            => get<RawGoldRow[]>('getEntries', { module: 'gold' }),
  addGold:       (p: Record<string, unknown>)  => post<string>({ module: 'gold', action: 'addEntry', ...p }),
  updateGold:    (p: Record<string, unknown>)  => post<boolean>({ module: 'gold', action: 'updateEntry', ...p }),
  deleteGold:    (id: string)                  => post<boolean>({ module: 'gold', action: 'deleteEntry', id }),
  getGoldHistory:    ()                           => get<RawGoldHistoryRow[]>('getHistory', { module: 'gold' }),
  addGoldHistory:    (p: Record<string, unknown>) => post<string>({ module: 'gold', action: 'addHistory', ...p }),
  updateGoldHistory: (p: Record<string, unknown>) => post<{ success: boolean }>({ module: 'gold', action: 'updateHistory', ...p }),
  deleteGoldHistory: (id: string)                 => post<{ success: boolean }>({ module: 'gold', action: 'deleteHistory', id }),
  getEmi:    ()                            => get<RawEmiRow[]>('getEntries', { module: 'loans' }),
  addEmi:    (p: Record<string, unknown>) => post<string>({ module: 'loans', action: 'addEntry', ...p }),
  updateEmi: (p: Record<string, unknown>) => post<boolean>({ module: 'loans', action: 'updateEntry', ...p }),
  deleteEmi: (id: string)                 => post<boolean>({ module: 'loans', action: 'deleteEntry', id }),
  getJewelLoans:         ()                            => get<RawJewelLoanRow[]>('getEntries', { module: 'loans', type: 'jewel' }),
  addJewelLoan:          (p: Record<string, unknown>) => post<string>({ module: 'loans', action: 'addEntry', type: 'jewel', ...p }),
  updateJewelLoan:       (p: Record<string, unknown>) => post<boolean>({ module: 'loans', action: 'updateEntry', type: 'jewel', ...p }),
  deleteJewelLoan:       (id: string)                 => post<boolean>({ module: 'loans', action: 'deleteEntry', type: 'jewel', id }),
  getJewelLoanHistory:    ()                           => get<RawJewelLoanHistoryRow[]>('getHistory', { module: 'loans', type: 'jewel' }),
  addJewelLoanHistory:    (p: Record<string, unknown>) => post<string>({ module: 'loans', action: 'addHistory', type: 'jewel', ...p }),
  updateJewelLoanHistory: (p: Record<string, unknown>) => post<boolean>({ module: 'loans', action: 'updateHistory', type: 'jewel', ...p }),
  deleteJewelLoanHistory: (id: string)                 => post<boolean>({ module: 'loans', action: 'deleteHistory', type: 'jewel', id }),
  getCashLoans:          ()                            => get<RawCashLoanRow[]>('getEntries', { module: 'loans', type: 'cash' }),
  addCashLoan:           (p: Record<string, unknown>) => post<string>({ module: 'loans', action: 'addEntry', type: 'cash', ...p }),
  updateCashLoan:        (p: Record<string, unknown>) => post<boolean>({ module: 'loans', action: 'updateEntry', type: 'cash', ...p }),
  deleteCashLoan:        (id: string)                 => post<boolean>({ module: 'loans', action: 'deleteEntry', type: 'cash', id }),
  getCashLoanHistory:    ()                           => get<RawCashLoanHistoryRow[]>('getHistory', { module: 'loans', type: 'cash' }),
  addCashLoanHistory:    (p: Record<string, unknown>) => post<string>({ module: 'loans', action: 'addHistory', type: 'cash', ...p }),
  deleteCashLoanHistory: (id: string)                 => post<boolean>({ module: 'loans', action: 'deleteHistory', type: 'cash', id }),
  getProfile: async () => {
    const res = await fetch(`${new URL('/api/profile', window.location.origin)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const text = await res.text();
    const json = JSON.parse(text) as ApiResponse<ProfileData>;
    if (!json.ok) {
      const err = new Error((json as { error?: string }).error || 'Profile request failed');
      throw err;
    }
    return json.data;
  },

  getAccountsList: () => restJson<AccountRow[]>('/api/accounts-list'),

  saveAccount: async (data: AccountPayload) => {
    const { id, ...rest } = data;
    if (id) {
      await restJson<{ id: string }>('/api/accounts-list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...rest }),
      });
    } else {
      await restJson<{ id: string }>('/api/accounts-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
    }
  },

  deleteAccount: (id: string) =>
    restJson<boolean>(`/api/accounts-list?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getCreditSources: () => restJson<CreditSourceRow[]>('/api/credit-sources'),

  saveCreditSource: async (data: CreditSourcePayload) => {
    const { id, ...rest } = data;
    if (id) {
      await restJson<{ id: string }>('/api/credit-sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...rest }),
      });
    } else {
      await restJson<{ id: string }>('/api/credit-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
    }
  },

  deleteCreditSource: (id: string) =>
    restJson<boolean>(`/api/credit-sources?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getSettings:   ()                            => get<GoldSettings>('get', { module: 'settings' }),
  saveSettings:  (p: Record<string, unknown>) => post<boolean>({ module: 'settings', action: 'save', ...p }),
  getVaultSettings: ()                      => get<VaultSettings>('get', { module: 'vault' }),
  saveVaultSettings:(p: Record<string, unknown>) => post<boolean>({ module: 'vault', action: 'save', ...p }),
  getBankingEntries: ()                       => get<RawBankingRow[]>('getEntries', { module: 'vault' }),
  getBankingEntry: (id: string)               => get<RawBankingRow>('getEntry', { module: 'vault', id }),
  addBankingEntry: async (p: Record<string, unknown>) => {
    const result = await post<string>({ module: 'vault', action: 'addEntry', ...p })
    invalidateCache({ action: 'getEntries', params: { module: 'vault' } })
    return result
  },
  updateBankingEntry: async (p: Record<string, unknown>) => {
    const result = await post<boolean>({ module: 'vault', action: 'updateEntry', ...p })
    invalidateCache({ action: 'getEntries', params: { module: 'vault' } })
    if (typeof p.id === 'string') invalidateCache({ action: 'getEntry', params: { module: 'vault', id: p.id } })
    return result
  },
  deleteBankingEntry: async (id: string) => {
    const result = await post<boolean>({ module: 'vault', action: 'deleteEntry', id })
    invalidateCache({ action: 'getEntries', params: { module: 'vault' } })
    invalidateCache({ action: 'getEntry', params: { module: 'vault', id } })
    return result
  },
  getApps: ()                               => get<RawVaultAppRow[]>('getApps', { module: 'vault' }),
  getApp: (appUuid: string)                 => get<RawVaultAppRow>('getApp', { module: 'vault', app_uuid: appUuid }),
  addApp: async (p: Record<string, unknown>) => {
    const result = await post<string>({ module: 'vault', action: 'addApp', ...p })
    invalidateCache({ action: 'getApps', params: { module: 'vault' } })
    return result
  },
  updateApp: async (p: Record<string, unknown>) => {
    const result = await post<boolean>({ module: 'vault', action: 'updateApp', ...p })
    invalidateCache({ action: 'getApps', params: { module: 'vault' } })
    if (typeof p.app_uuid === 'string') invalidateCache({ action: 'getApp', params: { module: 'vault', app_uuid: p.app_uuid } })
    return result
  },
  deleteApp: async (appUuid: string) => {
    const result = await post<boolean>({ module: 'vault', action: 'deleteApp', app_uuid: appUuid })
    invalidateCache({ action: 'getApps', params: { module: 'vault' } })
    invalidateCache({ action: 'getApp', params: { module: 'vault', app_uuid: appUuid } })
    return result
  },
  getInsuranceEntries: ()                   => get<RawInsuranceRow[]>('getEntries', { module: 'insurance' }),
  addInsuranceEntry: async (p: Record<string, unknown>) => {
    const result = await post<string>({ module: 'insurance', action: 'addEntry', ...p })
    invalidateCache({ action: 'getEntries', params: { module: 'insurance' } })
    return result
  },
  updateInsuranceEntry: async (p: Record<string, unknown>) => {
    const result = await post<boolean>({ module: 'insurance', action: 'updateEntry', ...p })
    invalidateCache({ action: 'getEntries', params: { module: 'insurance' } })
    if (typeof p.id === 'string') invalidateCache({ action: 'getEntry', params: { module: 'insurance', id: p.id } })
    return result
  },
  deleteInsuranceEntry: async (id: string) => {
    const result = await post<boolean>({ module: 'insurance', action: 'deleteEntry', id })
    invalidateCache({ action: 'getEntries', params: { module: 'insurance' } })
    invalidateCache({ action: 'getEntry', params: { module: 'insurance', id } })
    return result
  },
  getSubscriptionEntries: ()                   => get<RawSubscriptionRow[]>('getEntries', { module: 'subscriptions' }),
  addSubscriptionEntry: async (p: Record<string, unknown>) => {
    const result = await post<string>({ module: 'subscriptions', action: 'addEntry', ...p })
    invalidateCache({ action: 'getEntries', params: { module: 'subscriptions' } })
    return result
  },
  updateSubscriptionEntry: async (p: Record<string, unknown>) => {
    const result = await post<boolean>({ module: 'subscriptions', action: 'updateEntry', ...p })
    invalidateCache({ action: 'getEntries', params: { module: 'subscriptions' } })
    return result
  },
  deleteSubscriptionEntry: async (id: string) => {
    const result = await post<boolean>({ module: 'subscriptions', action: 'deleteEntry', id })
    invalidateCache({ action: 'getEntries', params: { module: 'subscriptions' } })
    return result
  },
  getTokenStatus: ()                           => get<{ hasToken: boolean; tokenType?: string; hasAccessToken?: boolean; hasExtendedToken?: boolean; hasRefreshToken?: boolean; accessTokenExpiry?: string; extendedTokenExpiry?: string; expired?: boolean }>('getTokenStatus', { module: 'stocks' }, { cache: false }),
  getUpstoxAuthUrl: ()                         => get<{ authUrl: string }>('getAuthUrl', { module: 'stocks' }, { cache: false }),
  setUpstoxToken: (token: string)              => post<boolean>({ module: 'stocks', action: 'setToken', token }),
  clearUpstoxAuth: ()                          => post<boolean>({ module: 'stocks', action: 'resetAuth' }),
  getStocks:      ()                           => get<RawHolding[]>('getHoldings', { module: 'stocks' }),
  syncStocks:     ()                           => post<{ count: number }>({ module: 'stocks', action: 'sync' }),
  getMutualFunds: ()                           => get<RawHolding[]>('getHoldings', { module: 'mutualfunds' }),
  syncMutualFunds: ()                          => post<{ count: number }>({ module: 'mutualfunds', action: 'sync' }),
  configure:     (expensesSheetId: string, assetsSheetId?: string) => post<boolean>({ action: 'configure', expensesSheetId, assetsSheetId }),
  ensureMonth:   (month: string, year: string)  => post<boolean>({ action: 'ensureMonth', month, year }),
  resetBudget:   ()                             => post<Budget>({ action: 'resetBudget' }),
  gemini:        (system: string, prompt: string, forceTool?: boolean) => post<string>({ action: 'gemini', system, prompt, forceTool }),
};
