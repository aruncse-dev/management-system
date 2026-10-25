import { date, numeric, pgTable, text } from 'drizzle-orm/pg-core'

/**
 * Land bought as an investment. Only `name` is required; the optional fields
 * turn the ledger into per-sqft and gain figures when they're filled in.
 */
export const plots = pgTable('plots', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  areaSqft: numeric('area_sqft', { precision: 12, scale: 2 }),
  /** Today's estimate for the whole plot; null = not valued yet. */
  currentValue: numeric('current_value', { precision: 12, scale: 2 }),
  /** 'active' | 'sold' */
  status: text('status').default('active').notNull(),
})

/**
 * The plot's ledger, like `lending`: every rupee in or out is one row.
 * kind: 'paid' (toward the price) | 'expense' (commission, registration…) | 'received' (sale, refund).
 */
export const plotTxns = pgTable('plot_txns', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  plotId: text('plot_id').notNull(),
  date: date('date').notNull(),
  kind: text('kind').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
})
