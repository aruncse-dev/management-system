import { sql } from 'drizzle-orm'
import { boolean, date, index, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const goldResources = pgTable('gold_resources', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  type: text('type').notNull(), // 'person' | 'location'
  name: text('name').notNull(),
  skip: boolean('skip').default(false).notNull(),
}, (t) => [
  // Applied 2026-11-22: migrations/20261122100000_perf_indexes.sql
  index('gold_resources_org_idx').on(t.orgId),
])

export const goldItems = pgTable('gold_items', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  weightG: numeric('weight_g', { precision: 10, scale: 3 }).notNull(),
  personId: text('person_id'),
  locationId: text('location_id'),
  /**
   * At most one of these is set — the server clears the other on every write.
   * Both are soft references (no FK, like person/location). A link to a closed
   * loan or a returned lend is kept as the record of where the item went; only
   * an Ongoing loan or an open lend makes the pledge current.
   */
  jewelLoanId: text('jewel_loan_id'),
  lendId: text('lend_id'),
}, (t) => [
  // Applied 2026-11-22: migrations/20261122100000_perf_indexes.sql
  index('gold_items_org_lend_idx').on(t.orgId, t.lendId).where(sql`${t.lendId} IS NOT NULL`),
  index('gold_items_org_jewel_loan_idx').on(t.orgId, t.jewelLoanId).where(sql`${t.jewelLoanId} IS NOT NULL`),
])

/**
 * Jewels handed to someone else — typically for them to pledge against their
 * own loan. One row per hand-over; the items it covers point back via
 * `gold_items.lend_id`. Still our gold, but not in hand, so an open lend is
 * left out of Estimated value and net worth.
 */
export const goldLends = pgTable('gold_lends', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  /** Required by the API (it is the card title); nullable only for the column rename. */
  lentTo: text('lent_to'),
  /** Why they needed it — "Plot purchase". The person and items have their own fields. */
  purpose: text('purpose'),
  /** What they raised on our jewels, if known. */
  amount: numeric('amount', { precision: 12, scale: 2 }),
  lentOn: date('lent_on').notNull(),
  expectedOn: date('expected_on'),
  /** Null while the jewels are still with them. */
  returnedOn: date('returned_on'),
  /** No longer written or shown — person, purpose and amount cover it. Kept so old rows aren't lost. */
  note: text('note'),
}, (t) => [
  // Applied 2026-11-22: migrations/20261122100000_perf_indexes.sql
  index('gold_lends_org_idx').on(t.orgId),
])

export const goldHistory = pgTable('gold_history', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  date: date('date').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  weightG: numeric('weight_g', { precision: 10, scale: 3 }).notNull(),
  note: text('note'),
})
