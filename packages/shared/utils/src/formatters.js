import { MNS } from '@fintracker-vault/config';
export function INR(n) {
    const abs = Math.abs(n);
    const hasDecimals = abs % 1 !== 0;
    if (hasDecimals) {
        const formatted = abs.toLocaleString('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
        return '₹' + formatted;
    }
    return '₹' + Math.round(abs).toLocaleString('en-IN');
}
export function fd(s) {
    if (!s)
        return '—';
    const m = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})/);
    return m ? parseInt(m[1]) + ' ' + m[2] : s;
}
export function isoDate(s) {
    if (!s)
        return '';
    const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
    if (!m)
        return '';
    const mo = MNS.indexOf(m[2]);
    if (mo < 0)
        return '';
    return `20${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
export function dateKey(s) {
    const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
    if (!m)
        return 0;
    const mo = MNS.indexOf(m[2]);
    return parseInt('20' + m[3]) * 10000 + (mo + 1) * 100 + parseInt(m[1]);
}
export function catIcon(cat) {
    const icons = {
        'Long Term Loan': '🏠', 'Jewel Loan': '💍', 'Insurance': '🛡️', 'SIP/Savings': '📈',
        'Emergency Fund': '🚨', 'Rent': '🏘️', 'Vijaya Amma': '👵', 'Staff Salary': '👷',
        'Groceries': '🛒', 'Rice': '🍚', 'Milk': '🥛', 'Vegetables': '🥦', 'Fruits': '🍎',
        'Food/Eating Out': '🍽️', 'Snacks': '🍿', 'Meat': '🥩', 'Education': '🎓', 'Kids': '👶',
        'Health & Medical': '💊', 'Amma': '🙏', 'Body Care': '🧴', 'Dress': '👗',
        'Entertainment': '🎬', 'Travel': '✈️', 'Gifts/Functions': '🎁', 'Home Care': '🏡',
        'Maintenance': '🔧', 'Internet/Recharge': '📱', 'Electricity': '⚡', 'Cylinder': '🔥',
        'Car': '🚗', 'Daily Expenses': '💰', 'NGO': '❤️', 'Others': '📦',
        'Salary': '💵', 'Cashback': '💳', 'Other Income': '💸',
        'Cash': '💵', 'HDFC Bank': '🏦', 'Wallet': '👛',
        'ICICI': '💳', 'HDFC': '💳', 'Bommi': '🤝', 'Ramya': '🤝',
    };
    return icons[cat] || '📌';
}
//# sourceMappingURL=formatters.js.map