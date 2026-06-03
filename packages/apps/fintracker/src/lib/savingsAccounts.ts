import { and, eq, isNull } from 'drizzle-orm'
import { paymentSources, type getDb } from '@fintracker-vault/db'

export type SavingsAccountRef = { id: string; name: string }

const SAVINGS_USED_FOR = new Set(['savings', 'both'])

/** Map keyed by payment_sources.id and by trimmed name (legacy rows). */
export type SavingsAccountLookup = Map<string, SavingsAccountRef>

export async function loadSavingsAccountLookup(
  db: ReturnType<typeof getDb>,
  orgId: string | null,
): Promise<SavingsAccountLookup> {
  const rows = await db
    .select({
      id: paymentSources.id,
      name: paymentSources.name,
      usedFor: paymentSources.usedFor,
    })
    .from(paymentSources)
    .where(
      and(
        orgId ? eq(paymentSources.orgId, orgId) : isNull(paymentSources.orgId),
        eq(paymentSources.sourceType, 'account'),
      ),
    )

  const lookup: SavingsAccountLookup = new Map()
  for (const r of rows) {
    if (!SAVINGS_USED_FOR.has(r.usedFor)) continue
    const ref = { id: r.id, name: r.name }
    lookup.set(r.id, ref)
    lookup.set(r.name.trim(), ref)
  }
  return lookup
}

export function resolveSavingsAccountId(lookup: SavingsAccountLookup, raw: string): string | null {
  const key = String(raw ?? '').trim()
  if (!key) return null
  return lookup.get(key)?.id ?? null
}

export function savingsAccountDisplayName(lookup: SavingsAccountLookup, stored: string): string {
  const key = String(stored ?? '').trim()
  if (!key) return ''
  return lookup.get(key)?.name ?? key
}
