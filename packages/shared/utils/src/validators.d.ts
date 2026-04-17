import { ACCOUNTS } from '@fintracker-vault/config';
export declare function isAccountMode(m: string): m is typeof ACCOUNTS[number];
export declare function isCrMode(m: string): boolean;
export declare function currentMonthYear(): {
    month: string;
    year: string;
};
//# sourceMappingURL=validators.d.ts.map