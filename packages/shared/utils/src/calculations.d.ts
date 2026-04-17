import { Transaction, Budget, OpeningBal } from '@fintracker-vault/types';
export declare function catMap(rows: Transaction[], _budget?: Budget): Record<string, number>;
export declare function sumType(rows: Transaction[], type: string): number;
export declare function sumCC(rows: Transaction[]): number;
export declare function sumOtherCr(rows: Transaction[]): number;
export declare function budgetSummary(budget: Budget, cm: Record<string, number>): {
    totalBudget: number;
    totalSpent: number;
    ovCount: number;
    totalOver: boolean;
    totalPct: number;
    tCol: string;
};
export declare function acctFlows(rows: Transaction[], openingBal: OpeningBal): Record<string, {
    inflow: number;
    outflow: number;
    current: number;
}>;
//# sourceMappingURL=calculations.d.ts.map