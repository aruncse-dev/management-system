import { Transaction, Budget, OpeningBal } from '@fintracker-vault/types';
import { ACCOUNTS, CC_MODES, OTHER_CR } from '@fintracker-vault/config';

export function catMap(rows: Transaction[], _budget?: Budget): Record<string, number> {
  const cm: Record<string, number> = {};
  rows.filter(r => r.t === 'Expense').forEach(r => {
    cm[r.c] = (cm[r.c] || 0) + r.a;
  });
  return cm;
}

export function sumType(rows: Transaction[], type: string): number {
  return rows.filter(r => r.t === type).reduce((s, r) => s + r.a, 0);
}

export function sumCC(rows: Transaction[]): number {
  return rows.filter(r => (CC_MODES as readonly string[]).includes(r.m)).reduce((s, r) => s + r.a, 0);
}

export function sumOtherCr(rows: Transaction[]): number {
  return rows.filter(r => (OTHER_CR as readonly string[]).includes(r.m)).reduce((s, r) => s + r.a, 0);
}

export function budgetSummary(budget: Budget, cm: Record<string, number>) {
  const active = Object.entries(budget).filter(([, b]) => b > 0);
  const totalBudget = active.reduce((s, [, b]) => s + b, 0);
  const totalSpent  = active.reduce((s, [c]) => s + (cm[c] || 0), 0);
  const ovCount     = active.filter(([c, b]) => (cm[c] || 0) > b).length;
  const totalOver   = totalSpent > totalBudget;
  const totalPct    = totalBudget ? Math.min(totalSpent / totalBudget * 100, 100) : 0;
  const tCol        = totalOver ? 'var(--rm)' : 'var(--gm)';
  return { totalBudget, totalSpent, ovCount, totalOver, totalPct, tCol };
}

export function acctFlows(rows: Transaction[], openingBal: OpeningBal) {
  const result: Record<string, { inflow: number; outflow: number; current: number }> = {};
  ACCOUNTS.forEach(acc => {
    let inflow = 0, outflow = 0;
    rows.forEach(r => {
      if (r.m === acc) {
        if (r.t === 'Income') inflow += r.a;
        else if (r.t === 'Expense') outflow += r.a;
        else if (r.t === 'Transfer') outflow += r.a;
      }
      if (r.t === 'Transfer' && r.notes?.startsWith('→' + acc)) inflow += r.a;
    });
    const opening = openingBal[acc] || 0;
    result[acc] = { inflow, outflow, current: opening + inflow - outflow };
  });
  return result;
}
