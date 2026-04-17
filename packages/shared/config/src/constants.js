export const ACCOUNTS = ['Cash', 'HDFC Bank', 'Wallet'];
export const CC_MODES = ['ICICI', 'HDFC'];
export const OTHER_CR = ['Bommi', 'Ramya', 'Others'];
export const ALL_CR = [...CC_MODES, ...OTHER_CR];
export const MNS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const TXN_PAGE = 40;
export const CATEGORIES = [
    'Long Term Loan', 'Jewel Loan', 'Insurance', 'SIP/Savings', 'Emergency Fund',
    'Rent', 'Vijaya Amma', 'Staff Salary', 'Groceries', 'Milk', 'Vegetables',
    'Fruits', 'Food/Eating Out', 'Snacks', 'Meat', 'Education', 'Kids', 'Health & Medical', 'Amma',
    'Body Care', 'Dress', 'Entertainment', 'Travel', 'Gifts/Functions', 'Home Care',
    'Maintenance', 'Internet/Recharge', 'Electricity', 'Cylinder', 'Car', 'Daily Expenses',
    'NGO', 'Others',
];
export const INCOME_CATS = ['Salary', 'Cashback', 'Other Income'];
export const ALL_MODES = [...ACCOUNTS, ...CC_MODES, ...OTHER_CR];
export const THEME_COLORS = [
    '#009688', // green
    '#3F51B5', // blue
    '#FF5722', // orange
    '#FFC107', // yellow
    '#E91E63', // purple
    '#673AB7', // violet
    '#00BCD4', // cyan
    '#8BC34A', // lime
];
export const DECOR_COLORS = THEME_COLORS;
function hashKey(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash + key.charCodeAt(i)) >>> 0;
    }
    return hash;
}
export function decorColor(key, offset = 0) {
    const idx = (hashKey(key) + offset) % DECOR_COLORS.length;
    return DECOR_COLORS[idx];
}
export function withAlpha(hex, alpha) {
    const clean = hex.replace('#', '').trim();
    if (clean.length !== 6)
        return hex;
    const value = Math.max(0, Math.min(1, alpha));
    const a = Math.round(value * 255).toString(16).padStart(2, '0');
    return `#${clean}${a}`;
}
export const CR_COLORS = {
    ICICI: decorColor('ICICI'),
    HDFC: decorColor('HDFC', 1),
    Bommi: decorColor('Bommi', 2),
    Ramya: decorColor('Ramya', 3),
    Others: decorColor('Others', 4),
};
//# sourceMappingURL=constants.js.map