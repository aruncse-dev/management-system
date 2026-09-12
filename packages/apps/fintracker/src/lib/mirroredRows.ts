/**
 * Rows the transaction register created in another module's ledger.
 *
 * A linked transaction writes a row into the module it points at, with an id
 * derived from the transaction's own (`txn:<id>`). That derived id is the only
 * thing joining the pair — there is no foreign key — so it is also the only way
 * a module page can tell that a row is not its own.
 *
 * Kept here rather than in each page: the check was previously inlined in
 * `loans.tsx` alone, which is why Savings, Lending and Subscriptions happily
 * offered to edit rows whose changes the next transaction save would discard.
 */
const MIRROR_ID_PREFIX = 'txn:'

/** True when this row was mirrored from a transaction rather than typed here. */
export function isMirroredRow(id: unknown): boolean {
  return String(id ?? '').startsWith(MIRROR_ID_PREFIX)
}

/**
 * Why a mirrored row cannot be edited in place, for the inline warning.
 *
 * Deleting one *is* allowed and is not a destructive act on the register: the
 * server unlinks the transaction and keeps it, so the spend stays recorded and
 * only stops feeding this module.
 */
export const MIRRORED_ROW_NOTE =
  'Created from a transaction. Amount and date follow the transaction — edit it in Monthly → Transactions. Deleting here just unlinks the two; the transaction stays.'

/** Short badge for a mirrored row in a list. */
export const MIRRORED_ROW_BADGE = 'From transaction'
