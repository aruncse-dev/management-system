import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { goldItems, goldLends, goldResources, jewelLoans, type getDb } from '@fintracker-vault/db'

export const GOLD_RESOURCE_TYPES = ['person', 'location'] as const
export type GoldResourceType = (typeof GOLD_RESOURCE_TYPES)[number]

export type GoldResourceRef = { id: string; name: string; type: string; skip: boolean }

/** Keyed by gold_resources.id only — gold items always store ids, never names. */
export type GoldResourceLookup = Map<string, GoldResourceRef>

export function isGoldResourceType(v: unknown): v is GoldResourceType {
  return typeof v === 'string' && (GOLD_RESOURCE_TYPES as readonly string[]).includes(v)
}

export async function loadGoldResourceLookup(
  db: ReturnType<typeof getDb>,
  orgId: string | null,
): Promise<GoldResourceLookup> {
  const rows = await db
    .select({
      id: goldResources.id,
      name: goldResources.name,
      type: goldResources.type,
      skip: goldResources.skip,
    })
    .from(goldResources)
    .where(orgId ? eq(goldResources.orgId, orgId) : isNull(goldResources.orgId))

  const lookup: GoldResourceLookup = new Map()
  for (const r of rows) lookup.set(r.id, { id: r.id, name: r.name, type: r.type, skip: r.skip })
  return lookup
}

/**
 * Null when the id is absent, belongs to another org, or is the wrong kind.
 * The type check is what stops a person id being written into `location_id`.
 */
export function resolveGoldResourceId(
  lookup: GoldResourceLookup,
  raw: unknown,
  expect: GoldResourceType,
): string | null {
  const key = typeof raw === 'string' ? raw.trim() : ''
  if (!key) return null
  const ref = lookup.get(key)
  if (!ref || ref.type !== expect) return null
  return ref.id
}

/** How many gold items in scope still point at this resource, as person or location. */
export async function countGoldItemsUsingResource(
  db: ReturnType<typeof getDb>,
  orgId: string | null,
  resourceId: string,
): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(goldItems)
    .where(
      and(
        orgId ? eq(goldItems.orgId, orgId) : isNull(goldItems.orgId),
        or(eq(goldItems.personId, resourceId), eq(goldItems.locationId, resourceId)),
      ),
    )
  return rows[0]?.n ?? 0
}

/**
 * What an item is currently tied up in. `none` is the default; `loan` maps it
 * to one of our own jewel loans; `lent` puts it in a hand-over to someone else.
 */
export const GOLD_PLEDGE_KINDS = ['none', 'loan', 'lent'] as const
export type GoldPledgeKind = (typeof GOLD_PLEDGE_KINDS)[number]

export function isGoldPledgeKind(v: unknown): v is GoldPledgeKind {
  return typeof v === 'string' && (GOLD_PLEDGE_KINDS as readonly string[]).includes(v)
}

/** How a lend is named in messages: the person, plus the purpose when there is one. */
export function lendLabel(lentTo: string | null, purpose: string | null): string {
  return [lentTo?.trim(), purpose?.trim()].filter(Boolean).join(' · ') || 'Lend'
}

/** `open` = an Ongoing jewel loan or an unreturned lend — the only kind that holds an item. */
export type GoldPledgeTarget = { id: string; name: string; open: boolean }

export type GoldPledgeTargets = {
  loans: Map<string, GoldPledgeTarget>
  lends: Map<string, GoldPledgeTarget>
}

/** Every jewel loan and lend in scope, so a write can check both existence and state. */
export async function loadGoldPledgeTargets(
  db: ReturnType<typeof getDb>,
  orgId: string | null,
): Promise<GoldPledgeTargets> {
  const [loanRows, lendRows] = await Promise.all([
    db
      .select({ id: jewelLoans.id, name: jewelLoans.name, status: jewelLoans.status })
      .from(jewelLoans)
      .where(orgId ? eq(jewelLoans.orgId, orgId) : isNull(jewelLoans.orgId)),
    db
      .select({ id: goldLends.id, lentTo: goldLends.lentTo, purpose: goldLends.purpose, returnedOn: goldLends.returnedOn })
      .from(goldLends)
      .where(orgId ? eq(goldLends.orgId, orgId) : isNull(goldLends.orgId)),
  ])
  return {
    // Same rule as the Loans page: anything that isn't explicitly Closed is Ongoing.
    loans: new Map(
      loanRows.map((r) => [r.id, { id: r.id, name: r.name, open: String(r.status ?? '').trim() !== 'Closed' }]),
    ),
    lends: new Map(
      lendRows.map((r) => [
        r.id,
        { id: r.id, name: lendLabel(r.lentTo, r.purpose), open: r.returnedOn === null },
      ]),
    ),
  }
}

/**
 * Why this item can't join `lendId`, or null when it can. Only a *current*
 * pledge blocks: a link to a closed loan or returned lend is history, and
 * re-pledging the item is exactly how that history gets superseded.
 */
export function goldPledgeConflict(
  item: { name: string; jewelLoanId: string | null; lendId: string | null },
  targets: GoldPledgeTargets,
  lendId: string,
): string | null {
  const loan = item.jewelLoanId ? targets.loans.get(item.jewelLoanId) : undefined
  if (loan?.open) return `${item.name} is pledged under jewel loan "${loan.name}".`
  const lend = item.lendId && item.lendId !== lendId ? targets.lends.get(item.lendId) : undefined
  if (lend?.open) return `${item.name} is already lent under "${lend.name}".`
  return null
}
