import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { AppState, Transaction, Budget, OpeningBal, MonthRef } from '../types';
import { dateKey, currentMonthYear } from './utils';
import { coerceBudget, transactionTransferDestination } from '../utils';
import { TXN_PAGE } from './constants';
import { loadInitDataDeduped } from '../api';
import { DEFAULT_FINTRACKER_PREFS } from '../expenseCycle';
import type { InitData } from '../api';
import { readSnapshot, writeSnapshot } from '../lib/snapshotCache';

const BUDGET_LS_KEY = 'ft_fintracker_budget_v1';

function persistBudgetToStorage(b: Budget) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BUDGET_LS_KEY, JSON.stringify(b));
  } catch {
    /* quota / private mode */
  }
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_MONTH'; payload: { month: string; year: string } }
  /**
   * Correct the opening month once the org's cycle prefs are known — only if
   * the user has not navigated yet. Keeps rows (the month did not really change
   * for a regular-cycle org on most days).
   */
  | { type: 'SETTLE_OPENING_MONTH'; payload: { month: string; year: string } }
  | { type: 'SET_ROWS'; payload: Transaction[] }
  /** Optimistic quick add: show the row before the server confirms it. */
  | { type: 'ADD_ROW'; payload: Transaction }
  | { type: 'REMOVE_ROW'; payload: string }
  | { type: 'REPLACE_ROW_ID'; payload: { from: string; to: string } }
  | { type: 'SET_MONTHS'; payload: MonthRef[] }
  | { type: 'SET_BUDGET'; payload: Budget }
  | { type: 'SET_OPENING_BAL'; payload: OpeningBal }
  | { type: 'SET_FILTER'; payload: string }
  | { type: 'SET_CAT_FILTER'; payload: string }
  | { type: 'SET_TXN_PAGE'; payload: number }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FINTRACKER'; payload: AppState['fintracker'] }
  | { type: 'SET_CURRENCY'; payload: AppState['currency'] }
  | { type: 'SET_ROUND_OFF'; payload: boolean };

const { month, year } = currentMonthYear();

const initial: AppState = {
  month, year, navigated: false, rows: [], budget: [], openingBal: {},
  months: [], fintracker: { ...DEFAULT_FINTRACKER_PREFS, expenseCycle: { ...DEFAULT_FINTRACKER_PREFS.expenseCycle } },
  currency: 'INR', roundOff: true,
  loading: true, txnPage: 1, filter: 'All', catFilter: '', search: '',
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':     return { ...state, loading: action.payload };
    case 'SETTLE_OPENING_MONTH': {
      if (state.navigated) return state;
      if (state.month === action.payload.month && state.year === action.payload.year) return state;
      return { ...state, ...action.payload, rows: [], loading: true, txnPage: 1 };
    }
    case 'SET_MONTH':
      return {
        ...state,
        navigated: true,
        ...action.payload,
        rows: [],
        loading: true,
        txnPage: 1,
        filter: 'All',
        catFilter: '',
        search: '',
      };
    case 'SET_ROWS':        return { ...state, rows: action.payload.map(r => ({ ...r, _k: dateKey(r.date) })).sort((a,b) => (b._k||0)-(a._k||0)) };
    case 'ADD_ROW': {
      const r = { ...action.payload, _k: dateKey(action.payload.date) };
      return { ...state, rows: [r, ...state.rows].sort((a, b) => (b._k || 0) - (a._k || 0)) };
    }
    case 'REMOVE_ROW':      return { ...state, rows: state.rows.filter(r => r.id !== action.payload) };
    case 'REPLACE_ROW_ID':
      return { ...state, rows: state.rows.map(r => (r.id === action.payload.from ? { ...r, id: action.payload.to } : r)) };
    case 'SET_MONTHS':      return { ...state, months: action.payload };
    case 'SET_BUDGET': {
      const budget = coerceBudget(action.payload);
      persistBudgetToStorage(budget);
      return { ...state, budget };
    }
    case 'SET_OPENING_BAL': return { ...state, openingBal: action.payload };
    case 'SET_FINTRACKER': return { ...state, fintracker: action.payload };
    case 'SET_CURRENCY': return { ...state, currency: action.payload };
    case 'SET_ROUND_OFF': return { ...state, roundOff: action.payload };
    case 'SET_FILTER':      return { ...state, filter: action.payload, catFilter: '', txnPage: 1 };
    case 'SET_CAT_FILTER':  return { ...state, catFilter: action.payload, filter: 'All', txnPage: 1 };
    case 'SET_TXN_PAGE':    return { ...state, txnPage: action.payload };
    case 'SET_SEARCH':      return { ...state, search: action.payload, txnPage: 1 };
    default:                return state;
  }
}

const Ctx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [prefsTick, setPrefsTick] = React.useState(0);

  React.useEffect(() => {
    const bump = () => setPrefsTick((n) => n + 1);
    window.addEventListener('fintracker:prefs', bump);
    window.addEventListener('currency:settings', bump);
    return () => {
      window.removeEventListener('fintracker:prefs', bump);
      window.removeEventListener('currency:settings', bump);
    };
  }, []);

  useEffect(() => {
    const apply = (init: InitData) => {
      dispatch({ type: 'SET_MONTHS', payload: init.months });
      dispatch({ type: 'SET_BUDGET', payload: init.budget });
      dispatch({ type: 'SET_OPENING_BAL', payload: init.openingBal });
      dispatch({ type: 'SET_FINTRACKER', payload: init.fintracker });
      // The opening month was guessed before the prefs arrived — assuming a
      // custom cycle anchored on the 19th. A regular-month org therefore opened
      // on NEXT month (empty) from the 19th to month end. Settle it now.
      dispatch({ type: 'SETTLE_OPENING_MONTH', payload: currentMonthYear(init.fintracker) });
      if (init.currency) dispatch({ type: 'SET_CURRENCY', payload: init.currency });
      if (init.roundOff !== undefined) dispatch({ type: 'SET_ROUND_OFF', payload: init.roundOff });
    };
    // Last-known settings first, so budgets and the cycle are right on the
    // first frame instead of after a round trip.
    const snapKey = `init:${state.month}-${state.year}`;
    const snap = readSnapshot<InitData>(snapKey);
    if (snap) apply(snap);
    void loadInitDataDeduped(state.month, state.year)
      .then((init) => {
        apply(init);
        writeSnapshot(snapKey, init);
      })
      .catch(() => {
        /* auth / network — pages may show their own errors */
      });
  }, [state.month, state.year, prefsTick]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

export function usePage() {
  const { state } = useStore();
  const { rows, filter, catFilter, search } = state;
  let all = filter === 'All' ? rows : rows.filter(r => {
    if (r.m === filter || r.t === filter) return true
    if (r.t === 'Transfer' && transactionTransferDestination(r) === filter) return true
    return false
  })
  if (catFilter) all = all.filter(r => r.c === catFilter);
  if (search) {
    const q = search.toLowerCase();
    all = all.filter(r => {
      const dest = r.t === 'Transfer' ? transactionTransferDestination(r) : ''
      return (
        r.desc.toLowerCase().includes(q) ||
        r.c.toLowerCase().includes(q) ||
        r.m.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        dest.toLowerCase().includes(q)
      )
    });
  }
  const total = all.length;
  const shown = Math.min(state.txnPage * TXN_PAGE, total);
  return { rows: all.slice(0, shown), total, shown };
}
