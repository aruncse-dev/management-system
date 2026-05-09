export const ACCOUNTS = ['Cash', 'HDFC Bank', 'Wallet']
export const CC_MODES = ['ICICI', 'HDFC']
export const OTHER_CR = ['Bommi', 'Ramya', 'Others']
export const ALL_CR = [...CC_MODES, ...OTHER_CR]
export const MNS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `budget.month_year` value for defaults shared across months (month-specific rows override per `YYYY-MM`). */
export const BUDGET_GLOBAL_MONTH_KEY = '__global__' as const
export const TXN_PAGE = 40

export const CATEGORIES = [
  'Long Term Loan', 'Jewel Loan', 'Insurance', 'SIP/Savings', 'Emergency Fund',
  'Rent', 'Vijaya Amma', 'Staff Salary', 'Groceries', 'Milk', 'Vegetables',
  'Fruits', 'Food/Eating Out', 'Snacks', 'Meat', 'Education', 'Kids', 'Health & Medical', 'Amma',
  'Body Care', 'Dress', 'Entertainment', 'Travel', 'Gifts/Functions', 'Home Care',
  'Maintenance', 'Internet/Recharge', 'Electricity', 'Cylinder', 'Car', 'Daily Expenses',
  'NGO', 'Others',
]

export const INCOME_CATS = ['Salary', 'Cashback', 'Other Income']
export const ALL_MODES = [...ACCOUNTS, ...CC_MODES, ...OTHER_CR]

export const THEME_COLORS = [
  '#009688',
  '#3F51B5',
  '#FF5722',
  '#FFC107',
  '#E91E63',
  '#673AB7',
  '#00BCD4',
  '#8BC34A',
]

export const DECOR_COLORS = THEME_COLORS

function hashKey(key: string) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) >>> 0
  return hash
}

export function decorColor(key: string, offset = 0) {
  const idx = (hashKey(key) + offset) % DECOR_COLORS.length
  return DECOR_COLORS[idx]
}

export function withAlpha(hex: string, alpha: number) {
  const clean = hex.replace('#', '').trim()
  if (clean.length !== 6) return hex
  const value = Math.max(0, Math.min(1, alpha))
  const a = Math.round(value * 255).toString(16).padStart(2, '0')
  return `#${clean}${a}`
}

export const CR_COLORS = {
  ICICI: decorColor('ICICI'),
  HDFC: decorColor('HDFC', 1),
  Bommi: decorColor('Bommi', 2),
  Ramya: decorColor('Ramya', 3),
  Others: decorColor('Others', 4),
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'
