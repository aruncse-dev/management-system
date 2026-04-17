import { ACCOUNTS, ALL_CR, MNS } from '@fintracker-vault/config';

export function isAccountMode(m: string): m is typeof ACCOUNTS[number] {
  return (ACCOUNTS as readonly string[]).includes(m);
}

export function isCrMode(m: string): boolean {
  return (ALL_CR as readonly string[]).includes(m);
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
