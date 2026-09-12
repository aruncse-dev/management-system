import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { goldItems, goldResources, type getDb } from '@fintracker-vault/db'

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
