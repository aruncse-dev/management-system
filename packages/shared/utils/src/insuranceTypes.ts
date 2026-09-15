/**
 * Policy types, shared by both apps.
 *
 * Vault writes them and fintracker reads them, so the dropdown and the
 * validator have to agree — a free-text column behind a hardcoded `<select>`
 * is how `premium_mode` ended up carrying five spellings of one fact.
 */

export type PolicyType = 'life' | 'term' | 'health' | 'accident' | 'motor' | 'travel' | 'home' | 'other'

export const POLICY_TYPES: readonly PolicyType[] = [
  'life',
  'term',
  'health',
  'accident',
  'motor',
  'travel',
  'home',
  'other',
]

export const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  life: 'Life',
  term: 'Term',
  health: 'Health',
  accident: 'Accident',
  motor: 'Motor',
  travel: 'Travel',
  home: 'Home',
  other: 'Other',
}

/** Strict parse — returns `null` rather than guessing, like the other parsers here. */
export function parsePolicyType(raw: string): PolicyType | null {
  const k = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return (POLICY_TYPES as readonly string[]).includes(k) ? (k as PolicyType) : null
}

/** Display label for a raw stored value, falling back to the raw text. */
export function policyTypeLabel(raw: string): string {
  const t = parsePolicyType(raw)
  return t ? POLICY_TYPE_LABELS[t] : String(raw ?? '').trim()
}

/* ------------------------------------------------------- fields by type */

/**
 * Which questions a policy type actually has an answer to.
 *
 * The form asked all ~18 fields of every policy, so a health policy was asked
 * for a cash value it can never have and a motor policy for a nominee it does
 * not name. Driving the form from this map means adding a type is one new row
 * here rather than a hunt through JSX.
 *
 * The rule behind the split: **cash value or loan facility means `life`; pure
 * protection means `term`.** An endowment builds a surrender value, so it keeps
 * the cash-value field; a term plan never does. And cover that runs a year at a
 * time renews rather than maturing.
 */
export type PolicyTypeFields = {
  /** "Sum assured" for a payout on death; "Sum insured" for reimbursement cover. */
  sumLabel: string
  /** "Maturity date" when the policy ends; "Renewal date" when it rolls over. */
  endDateLabel: string
  /** Seeds `insurance.renews` when the type is chosen. Still overridable. */
  defaultRenews: boolean
  cashValue: boolean
  /** Limited pay — only plans that can stop paying before they end. */
  paymentTerm: boolean
  nominees: boolean
}

const RENEWING: PolicyTypeFields = {
  sumLabel: 'Sum insured',
  endDateLabel: 'Renewal date',
  defaultRenews: true,
  cashValue: false,
  paymentTerm: false,
  nominees: false,
}

export const POLICY_TYPE_FIELDS: Record<PolicyType, PolicyTypeFields> = {
  // Endowment and whole-life: builds a surrender value, and can be limited pay.
  life: {
    sumLabel: 'Sum assured',
    endDateLabel: 'Maturity date',
    defaultRenews: false,
    cashValue: true,
    paymentTerm: true,
    nominees: true,
  },
  // Pure protection: no cash value ever, but often limited pay.
  term: {
    sumLabel: 'Sum assured',
    endDateLabel: 'Maturity date',
    defaultRenews: false,
    cashValue: false,
    paymentTerm: true,
    nominees: true,
  },
  health: { ...RENEWING, nominees: true },
  accident: { ...RENEWING, nominees: true },
  motor: RENEWING,
  travel: RENEWING,
  home: RENEWING,
  // Unknown shape: show the common fields and assume nothing.
  other: {
    sumLabel: 'Sum insured',
    endDateLabel: 'Maturity date',
    defaultRenews: false,
    cashValue: false,
    paymentTerm: false,
    nominees: true,
  },
}

/** Field set for a raw stored type, falling back to `other` when unreadable. */
export function policyTypeFields(raw: string): PolicyTypeFields {
  return POLICY_TYPE_FIELDS[parsePolicyType(raw) ?? 'other']
}
