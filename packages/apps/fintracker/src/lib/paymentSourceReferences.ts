import { and, eq, isNull, ne, or, sql } from 'drizzle-orm'
import { getDb, paymentSources, savings, transactions } from '@fintracker-vault/db'

type Db = ReturnType<typeof getDb>

/**
 * Transactions reference their payment source **by name**, not by id
 * (`transactions.mode` / `transactions.transfer_to` are plain text). That is the
 * house style and works fine — until the source is renamed or deleted, at which
 * point every row naming it stops matching any configured account and quietly
 * disappears from balances. With 954 transactions and no cascade, a single typo
 * fix in Settings could orphan a couple of hundred rows without a word.
 *
 * `savings` already stores ids, so only its pre-backfill rows (which still hold
 * a name) need the same treatment.
 */

function orgWhere<T extends { orgId: unknown }>(table: T, orgId: string | null) {
  return orgId ? eq(table.orgId as never, orgId) : isNull(table.orgId as never)
}

/** How many rows would break if this payment source name went away. */
export async function countPaymentSourceReferences(
  db: Db,
  orgId: string | null,
  name: string,
): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) return 0
  const [txn] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        orgWhere(transactions, orgId),
        or(eq(transactions.mode, trimmed), eq(transactions.transferTo, trimmed)),
      ),
    )
  const [sav] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(savings)
    .where(
      and(orgWhere(savings, orgId), or(eq(savings.account, trimmed), eq(savings.toAccount, trimmed))),
    )
  return (txn?.n ?? 0) + (sav?.n ?? 0)
}

/**
 * Carry a rename through to every row that names the old value.
 *
 * Returns the number of rows moved so the caller can report it — a rename that
 * silently rewrites 198 transactions should say so.
 */
export async function cascadePaymentSourceRename(
  db: Db,
  orgId: string | null,
  oldName: string,
  newName: string,
): Promise<number> {
  const from = oldName.trim()
  const to = newName.trim()
  if (!from || !to || from === to) return 0

  let moved = 0
  const bump = (rows: { rowCount?: number | null } | unknown) => {
    const n = (rows as { rowCount?: number | null })?.rowCount
    if (typeof n === 'number') moved += n
  }

  bump(
    await db
      .update(transactions)
      .set({ mode: to })
      .where(and(orgWhere(transactions, orgId), eq(transactions.mode, from))),
  )
  bump(
    await db
      .update(transactions)
      .set({ transferTo: to })
      .where(and(orgWhere(transactions, orgId), eq(transactions.transferTo, from))),
  )
  // Legacy savings rows only — id-backfilled rows never match a name.
  bump(
    await db
      .update(savings)
      .set({ account: to })
      .where(and(orgWhere(savings, orgId), eq(savings.account, from))),
  )
  bump(
    await db
      .update(savings)
      .set({ toAccount: to })
      .where(and(orgWhere(savings, orgId), eq(savings.toAccount, from))),
  )
  return moved
}

/**
 * Whether another payment source in this org already answers to this name.
 *
 * Because transactions match their source *by name*, two sources sharing one
 * name are indistinguishable to every balance in the app — and a rename cannot
 * be carried through unambiguously, since the rows naming "Cash" could belong to
 * either. Refusing the duplicate at the point of entry is the only place this
 * can be caught cleanly. (This org already has two accounts named "Cash"; the
 * check does not disturb them until one is next edited.)
 */
export async function paymentSourceNameTaken(
  db: Db,
  orgId: string | null,
  name: string,
  exceptId: string,
): Promise<boolean> {
  const trimmed = name.trim()
  if (!trimmed) return false
  const rows = await db
    .select({ id: paymentSources.id })
    .from(paymentSources)
    .where(
      and(
        orgWhere(paymentSources, orgId),
        eq(paymentSources.name, trimmed),
        exceptId ? ne(paymentSources.id, exceptId) : undefined,
      ),
    )
    .limit(1)
  return rows.length > 0
}
