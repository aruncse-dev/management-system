/**
 * Insurance policy + premium reads, shared by both apps.
 *
 * The vault app owns every policy write; fintracker only links transactions to
 * policies and mirrors premiums into the ledger. Both need the same derived
 * facts — what is due, what has been paid — so those live here once rather
 * than in two dispatchers that would drift, which is exactly what happened to
 * the subscription cycle math before it was unified.
 *
 * SELECT-only, like the rest of `queries/`. See `scope.ts` for why.
 */
import { and, desc, eq } from 'drizzle-orm'
import type { getDb } from '../neon'
import { insurance, insuranceMembers, insurancePremiums } from '../schema/vault'
import {
  type PremiumMode,
  daysUntil,
  monthlyPremiumCost,
  premiumProgress,
  premiumProgressLabel,
  nextPremiumDue,
  parsePremiumMode,
  premiumModeLabel,
} from '@fintracker-vault/utils'
import { num, scopeOf, toIsoDate } from './scope'

type Db = ReturnType<typeof getDb>

/** Policies still costing money. A paid-up policy is a record, not a commitment. */
export const ACTIVE_INSURANCE_STATUS = 'active'

export type InsurancePremiumRow = {
  id: string
  policyId: string
  date: string
  amount: number
  note: string
}

export type InsurancePolicyView = {
  id: string
  planName: string
  insurer: string
  policyType: string
  owner: string
  policyNo: string
  personUuid: string
  appId: string
  premium: number
  /** Parsed mode, or null when the stored text is unreadable. */
  premiumMode: PremiumMode | null
  premiumModeRaw: string
  premiumModeLabel: string
  paymentMethod: string
  status: string
  issueDate: string | null
  maturityDate: string | null
  sumAssured: number
  cashValue: number
  nominee: string
  notes: string
  /** ISO timestamp; the "as last entered" date for hand-kept figures like cash value. */
  updatedAt: string | null
  paidPremiumsOpening: number
  /** Years of premiums when it differs from the policy term; null = regular pay. */
  premiumPaymentTermYears: number | null
  /** The end date is a renewal, not an ending — health and motor cover roll over. */
  renews: boolean
  /** Premiums payable over the paying term; null when the policy renews forever. */
  premiumsTotal: number | null
  /** Left over the term, or left in the current year when it renews. */
  premiumsRemaining: number | null
  /** Progress as one string, e.g. `16 / 192`. */
  premiumsProgress: string
  /** When the final premium falls due; null when it renews. */
  lastPayableOn: string | null
  /** E-card or policy pack link. */
  ecardUrl: string
  /** Rows in the ledger only — excludes the opening count. */
  ledgerCount: number
  /** Opening count + ledger rows. Display only; the due date never uses it once a row exists. */
  paidCount: number
  /** Rupees recorded in the ledger. Never a spend figure — see `insurance_premiums`. */
  paidTotal: number
  lastPaidOn: string | null
  nextDue: string | null
  /** Negative when overdue. That signal is the point of the feature. */
  daysUntilDue: number | null
  /** Monthly-normalised premium. 0 for single-premium and unreadable modes. */
  monthlyCost: number
  /** `persons.uuid` of everyone this policy covers. Empty for a single-life policy. */
  memberUuids: string[]
  /** `persons.uuid` of the nominees — who gets paid, not who is covered. */
  nomineeUuids: string[]
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function mapPremium(r: typeof insurancePremiums.$inferSelect): InsurancePremiumRow {
  return {
    id: r.id,
    policyId: r.policyId,
    date: toStr(r.date),
    // A number, not the raw numeric string the driver hands back.
    amount: num(r.amount),
    note: toStr(r.note),
  }
}

/**
 * Every policy for the org, with its derived schedule folded in.
 *
 * Two queries and a JS fold, the same shape as `getLoanOutstanding` — a
 * per-policy ledger query would be one round trip per row.
 */
export async function getInsurancePolicies(
  db: Db,
  orgId: string | null,
  opts?: { now?: Date },
): Promise<InsurancePolicyView[]> {
  const now = opts?.now ?? new Date()
  const [policies, premiums, members] = await Promise.all([
    db.select().from(insurance).where(scopeOf(insurance, orgId)).orderBy(desc(insurance.updatedAt)),
    db.select().from(insurancePremiums).where(scopeOf(insurancePremiums, orgId)),
    db.select().from(insuranceMembers).where(scopeOf(insuranceMembers, orgId)),
  ])

  // Insured and nominee are both rows here; the role says which list a person
  // belongs to. They are different questions and must not be merged.
  const membersByPolicy = new Map<string, string[]>()
  const nomineesByPolicy = new Map<string, string[]>()
  for (const m of members) {
    const target = m.role === 'nominee' ? nomineesByPolicy : membersByPolicy
    const list = target.get(m.policyId)
    if (list) list.push(m.personUuid)
    else target.set(m.policyId, [m.personUuid])
  }

  const byPolicy = new Map<string, InsurancePremiumRow[]>()
  for (const row of premiums) {
    const list = byPolicy.get(row.policyId)
    if (list) list.push(mapPremium(row))
    else byPolicy.set(row.policyId, [mapPremium(row)])
  }

  return policies.map((p) => {
    const ledger = byPolicy.get(p.id) ?? []
    const dates = ledger.map((r) => r.date).filter(Boolean).sort()
    const lastPaidOn = dates.length ? dates[dates.length - 1] : null

    const premiumModeRaw = toStr(p.premiumMode)
    const issueDate = p.issueDate ? toStr(p.issueDate) : null
    const maturityDate = p.maturityDate ? toStr(p.maturityDate) : null
    const opening = Number(p.paidPremiumsOpening ?? 0)

    const due = nextPremiumDue({
      issueDate,
      maturityDate,
      premiumMode: premiumModeRaw,
      paidPremiumsOpening: opening,
      lastPaidOn,
      premiumPaymentTermYears: p.premiumPaymentTermYears ?? null,
      renews: Boolean(p.renews),
    })

    return {
      id: p.id,
      planName: p.planName,
      insurer: toStr(p.insurer),
      policyType: toStr(p.policyType),
      owner: toStr(p.owner),
      policyNo: toStr(p.policyNo),
      personUuid: toStr(p.personUuid),
      appId: toStr(p.appId),
      premium: num(p.premium),
      premiumMode: parsePremiumMode(premiumModeRaw),
      premiumModeRaw,
      premiumModeLabel: premiumModeLabel(premiumModeRaw),
      paymentMethod: toStr(p.paymentMethod),
      status: toStr(p.status) || ACTIVE_INSURANCE_STATUS,
      issueDate,
      maturityDate,
      sumAssured: num(p.sumAssured),
      cashValue: num(p.cashValue),
      nominee: toStr(p.nominee),
      notes: toStr(p.notes),
      updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
      paidPremiumsOpening: opening,
      premiumPaymentTermYears: p.premiumPaymentTermYears ?? null,
      renews: Boolean(p.renews),
      ecardUrl: toStr(p.ecardUrl),
      ...(() => {
        const g = premiumProgress({
          issueDate,
          maturityDate,
          premiumMode: premiumModeRaw,
          premiumPaymentTermYears: p.premiumPaymentTermYears ?? null,
          renews: Boolean(p.renews),
          paidCount: opening + ledger.length,
        })
        return {
          premiumsTotal: g.total,
          premiumsRemaining: g.remaining,
          premiumsProgress: premiumProgressLabel(g),
          lastPayableOn: g.lastPayableOn ? toIsoDate(g.lastPayableOn) : null,
        }
      })(),
      ledgerCount: ledger.length,
      paidCount: opening + ledger.length,
      paidTotal: ledger.reduce((s, r) => s + r.amount, 0),
      lastPaidOn,
      nextDue: due ? toIsoDate(due) : null,
      daysUntilDue: due ? daysUntil(due, now) : null,
      monthlyCost: monthlyPremiumCost(num(p.premium), premiumModeRaw),
      memberUuids: membersByPolicy.get(p.id) ?? [],
      nomineeUuids: nomineesByPolicy.get(p.id) ?? [],
    }
  })
}

/** Premium rows for the org, newest first; narrowed to one policy when given. */
export async function getInsurancePremiums(
  db: Db,
  orgId: string | null,
  policyId?: string,
): Promise<InsurancePremiumRow[]> {
  const where = policyId
    ? and(scopeOf(insurancePremiums, orgId), eq(insurancePremiums.policyId, policyId))
    : scopeOf(insurancePremiums, orgId)
  const rows = await db
    .select()
    .from(insurancePremiums)
    .where(where)
    .orderBy(desc(insurancePremiums.date))
  return rows.map(mapPremium)
}

export type InsuranceCommitment = {
  /** Monthly-normalised premium across active, priceable policies. */
  monthly: number
  /** Total hand-entered cash value. Reported separately — never folded into net worth. */
  cashValue: number
  due: { id: string; name: string; amount: number; dueDate: string; daysLeft: number }[]
}

/**
 * What insurance costs per month, and what is due soon or already overdue.
 *
 * Only `status = 'active'` policies count, matching how subscriptions are
 * priced. A single-premium or unreadable-mode policy contributes 0 rather than
 * being guessed at as monthly.
 *
 * Unlike subscription renewals, overdue premiums are kept and sorted first: a
 * subscription bills itself whether you look or not, but an unpaid premium is
 * a thing you have to go and do.
 */
export async function getInsuranceCommitment(
  db: Db,
  orgId: string | null,
  opts?: { now?: Date; horizonDays?: number },
): Promise<InsuranceCommitment> {
  const now = opts?.now ?? new Date()
  const horizon = opts?.horizonDays ?? 30
  const policies = await getInsurancePolicies(db, orgId, { now })

  let monthly = 0
  let cashValue = 0
  const due: InsuranceCommitment['due'] = []

  for (const p of policies) {
    cashValue += p.cashValue
    if (p.status !== ACTIVE_INSURANCE_STATUS) continue
    // A matured policy stops costing money even if nobody updated its status —
    // but a renewing one has no maturity, only a rollover date, so passing it
    // means the next year has started, not that the cover ended.
    if (!p.renews && p.maturityDate && p.maturityDate < toIsoDate(now)) continue
    monthly += p.monthlyCost

    if (p.nextDue && p.daysUntilDue !== null && p.daysUntilDue <= horizon) {
      due.push({
        id: p.id,
        name: p.planName,
        amount: p.premium,
        dueDate: p.nextDue,
        daysLeft: p.daysUntilDue,
      })
    }
  }

  due.sort((a, b) => a.daysLeft - b.daysLeft)
  return { monthly, cashValue, due }
}
