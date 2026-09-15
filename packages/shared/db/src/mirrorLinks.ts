/**
 * Teardown for the transaction ↔ module-row link.
 *
 * Deliberately NOT under `queries/`: these functions UPDATE `transactions`, and
 * the MCP server's read-only guarantee comes from it importing only from that
 * directory.
 *
 * This lives in the shared package because the link now spans two apps — vault
 * owns insurance policies, fintracker owns the register — and a second copy of
 * this logic in the vault dispatcher is precisely how a mirrored row would come
 * back from the dead after being deleted.
 */
import { and, eq } from 'drizzle-orm'
import type { getDb } from './neon'
import { transactions } from './schema/transactions'
import { scopeOf } from './queries/scope'

type Db = ReturnType<typeof getDb>

/**
 * Prefix marking a module row that was created from a transaction.
 *
 * The mirrored row's id is derived from the transaction id (`txn:<id>`), so the
 * pair is addressable from either side without a join table or a foreign key.
 */
export const MIRROR_ID_PREFIX = 'txn:'

/** The transaction id inside a mirrored row's derived id, or null if not mirrored. */
export function transactionIdFromMirrorId(id: unknown): string | null {
  const s = String(id ?? '')
  return s.startsWith(MIRROR_ID_PREFIX) ? s.slice(MIRROR_ID_PREFIX.length) : null
}

/**
 * Unlink the transaction that produced a mirrored row.
 *
 * Called when a mirrored row is deleted from the module page it appears on.
 * Clearing `ref_kind`/`ref_id` is the part that makes the deletion stick: the
 * mirror is derived state, so while the transaction still points here, the next
 * save of that transaction re-creates the row and the deletion silently undoes
 * itself.
 *
 * The transaction itself is deliberately kept. The money did leave the account
 * — that is a fact about the register — the user is only saying it should stop
 * feeding this module. Deleting spend from a screen that is not the register
 * would be far too easy to do by accident.
 *
 * A no-op for an id that is not a mirror, so callers can pass any row id.
 */
export async function unlinkTransactionMirror(
  db: Db,
  orgId: string | null,
  rowId: unknown,
): Promise<void> {
  const txnId = transactionIdFromMirrorId(rowId)
  if (!txnId) return
  await db
    .update(transactions)
    .set({ refKind: null, refId: null })
    .where(and(scopeOf(transactions, orgId), eq(transactions.id, txnId)))
}

/**
 * Clear every link pointing at a module row that is being deleted.
 *
 * Must run before the module's own ledger rows are removed. There is no foreign
 * key and nothing cascades, so a transaction left pointing at a deleted target
 * will re-create its mirror on the next save — a ledger row belonging to a
 * policy that no longer exists, invisible in the UI but still counted.
 *
 * The transactions themselves survive, unlinked, for the same reason as above.
 */
export async function clearTransactionRefs(
  db: Db,
  orgId: string | null,
  kind: string,
  refId: string,
): Promise<void> {
  await db
    .update(transactions)
    .set({ refKind: null, refId: null })
    .where(
      and(
        scopeOf(transactions, orgId),
        eq(transactions.refKind, kind),
        eq(transactions.refId, refId),
      ),
    )
}
