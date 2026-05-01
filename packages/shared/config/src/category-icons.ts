/**
 * Single source for matching user-entered category / budget labels to a canonical
 * icon key (same strings as lucide + emoji maps in UI / utils).
 */
export interface CategoryIconRule {
  /** Canonical label — must match keys in `CatIcon` (`@fintracker-vault/ui`) */
  key: string;
  /** Extra phrases to treat as this category (any casing; normalized on use) */
  alsoMatch?: readonly string[];
}

export const CATEGORY_ICON_RULES: readonly CategoryIconRule[] = [
  { key: 'Long Term Loan', alsoMatch: ['home loan', 'mortgage', 'housing loan', 'housing'] },
  { key: 'Jewel Loan', alsoMatch: ['gold loan', 'jewellery loan', 'jewelry loan', 'pawn loan', 'jewel'] },
  { key: 'Insurance', alsoMatch: ['mediclaim', 'life insurance', 'vehicle insurance'] },
  { key: 'SIP/Savings', alsoMatch: ['sip', 'mutual fund', 'mutual funds', 'mf', 'investment savings', 'equity sip'] },
  { key: 'Emergency Fund', alsoMatch: ['emergency', 'rainy day', 'contingency'] },
  { key: 'Rent', alsoMatch: ['house rent', 'accommodation'] },
  { key: 'Vijaya Amma', alsoMatch: ['vijaya', 'amma vijaya'] },
  { key: 'Staff Salary', alsoMatch: ['staff pay', 'employee salary', 'payroll staff'] },
  { key: 'Groceries', alsoMatch: ['grocery', 'provisions', 'supermarket', 'kirana'] },
  { key: 'Rice', alsoMatch: ['rice bag', 'ponni', 'basmati'] },
  { key: 'Milk', alsoMatch: ['dairy', 'milk subscription'] },
  { key: 'Vegetables', alsoMatch: ['veggies', 'veg', 'greens'] },
  { key: 'Fruits', alsoMatch: ['fruit'] },
  { key: 'Food/Eating Out', alsoMatch: ['restaurant', 'dining', 'eating out', 'food out', 'zomato', 'swiggy', 'takeout'] },
  { key: 'Snacks', alsoMatch: ['junk food', 'chips'] },
  { key: 'Meat', alsoMatch: ['chicken', 'mutton', 'fish', 'non veg'] },
  { key: 'Education', alsoMatch: ['school', 'tuition', 'books', 'course'] },
  { key: 'Kids', alsoMatch: ['children', 'child'] },
  { key: 'Health & Medical', alsoMatch: ['medical', 'hospital', 'doctor', 'pharmacy', 'medicine', 'healthcare', 'dental'] },
  { key: 'Amma', alsoMatch: ['mother', 'mom allowance'] },
  { key: 'Body Care', alsoMatch: ['cosmetics', 'personal care', 'skincare'] },
  { key: 'Dress', alsoMatch: ['clothes', 'clothing', 'apparel'] },
  { key: 'Entertainment', alsoMatch: ['movies', 'ott', 'netflix', 'streaming'] },
  { key: 'Travel', alsoMatch: ['trip', 'vacation', 'flight', 'train ticket'] },
  { key: 'Gifts/Functions', alsoMatch: ['gifts', 'wedding gift', 'function', 'festival gifts'] },
  { key: 'Home Care', alsoMatch: ['household', 'cleaning supplies'] },
  { key: 'Maintenance', alsoMatch: ['repairs', 'plumber', 'carpenter'] },
  { key: 'Internet/Recharge', alsoMatch: ['mobile recharge', 'broadband', 'wifi', 'data pack', 'prepaid'] },
  { key: 'Electricity', alsoMatch: ['power bill', 'eb', 'utility electric'] },
  { key: 'Cylinder', alsoMatch: ['lpg', 'gas cylinder', 'cooking gas'] },
  { key: 'Car', alsoMatch: ['vehicle', 'auto', 'fuel', 'petrol', 'diesel', 'car service'] },
  { key: 'Daily Expenses', alsoMatch: ['misc', 'miscellaneous', 'pocket money', 'small expenses'] },
  { key: 'NGO', alsoMatch: ['charity', 'donation', 'donations'] },
  { key: 'Others', alsoMatch: ['other', 'general'] },
  { key: 'Salary', alsoMatch: ['wages', 'pay', 'monthly salary', 'income salary'] },
  { key: 'Cashback', alsoMatch: ['cash back', 'reward'] },
  { key: 'Other Income', alsoMatch: ['side income', 'extra income'] },
  { key: 'Cash', alsoMatch: ['physical cash'] },
  { key: 'HDFC Bank', alsoMatch: ['hdfc savings', 'hdfc account'] },
  { key: 'Wallet', alsoMatch: ['digital wallet', 'paytm', 'phonepe', 'gpay'] },
  { key: 'ICICI', alsoMatch: ['icici card', 'icici credit'] },
  { key: 'HDFC', alsoMatch: ['hdfc card', 'hdfc credit'] },
  { key: 'Bommi', alsoMatch: ['bommi credit'] },
  { key: 'Ramya', alsoMatch: ['ramya credit'] },
] as const;

export function normalizeCategoryLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[/&,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type FlatEntry = { key: string; norm: string };

let flatRulesCache: FlatEntry[] | null = null;

function buildFlatRules(): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const r of CATEGORY_ICON_RULES) {
    out.push({ key: r.key, norm: normalizeCategoryLabel(r.key) });
    for (const a of r.alsoMatch ?? []) {
      out.push({ key: r.key, norm: normalizeCategoryLabel(a) });
    }
  }
  return out.sort((a, b) => b.norm.length - a.norm.length);
}

function flatRules(): FlatEntry[] {
  if (!flatRulesCache) flatRulesCache = buildFlatRules();
  return flatRulesCache;
}

/**
 * Map free-text category or budget name to the canonical icon key, or `undefined` if none.
 */
export function resolveCategoryIconKey(input: string): string | undefined {
  const n = normalizeCategoryLabel(input);
  if (!n) return undefined;
  const flat = flatRules();

  for (const { key, norm } of flat) {
    if (n === norm) return key;
  }
  for (const { key, norm } of flat) {
    if (norm.length >= 2 && n.includes(norm)) return key;
  }
  if (n.length >= 4) {
    for (const { key, norm } of flat) {
      if (norm.length >= 4 && norm.includes(n)) return key;
    }
  }
  return undefined;
}
