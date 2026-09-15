/**
 * Shared primitives for the read-only query modules.
 *
 * These lived inside `analytics.ts` until `insurance.ts` needed them too.
 * Importing them from there would have made the two modules circular —
 * `analytics.ts` folds the insurance commitment into the committed outflow —
 * so they sit in their own leaf module instead.
 *
 * Like `analytics.ts`, this file is SELECT-side only: it must never gain an
 * INSERT/UPDATE/DELETE, because the MCP server's read-only guarantee comes
 * from what the query modules are allowed to contain.
 */
import { eq, isNull } from 'drizzle-orm'

/** Org scope, matching the dispatcher's legacy fallback: null org ⇒ the `org_id IS NULL` bucket. */
export function scopeOf(table: { orgId: unknown }, orgId: string | null) {
  const col = table.orgId as Parameters<typeof eq>[0]
  return orgId ? eq(col, orgId) : isNull(col)
}

/** Numeric columns arrive as strings from the driver; a null or unparseable one is 0. */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/** Local-time ISO date, matching how `parseLocalDate` reads one back. */
export function toIsoDate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
