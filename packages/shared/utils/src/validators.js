import { ACCOUNTS, ALL_CR, MNS } from '@fintracker-vault/config';
export function isAccountMode(m) {
    return ACCOUNTS.includes(m);
}
export function isCrMode(m) {
    return ALL_CR.includes(m);
}
export function currentMonthYear() {
    const now = new Date();
    const cycleDay = 19;
    let mi = now.getMonth();
    let yr = now.getFullYear();
    if (now.getDate() >= cycleDay) {
        mi = (mi + 1) % 12;
        if (mi === 0)
            yr++;
    }
    return { month: MNS[mi], year: String(yr) };
}
//# sourceMappingURL=validators.js.map