import { boolean, date, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const goldResources = pgTable('gold_resources', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  type: text('type').notNull(), // 'person' | 'location'
  name: text('name').notNull(),
  skip: boolean('skip').default(false).notNull(),
})

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
})

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
  note: text('note'),
})

export const goldHistory = pgTable('gold_history', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  date: date('date').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  weightG: numeric('weight_g', { precision: 10, scale: 3 }).notNull(),
  note: text('note'),
})
