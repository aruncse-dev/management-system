import { date, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const savings = pgTable('savings', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  date: date('date').notNull(),
  /** payment_sources.id (legacy rows may hold name until backfill). */
  account: text('account').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  type: text('type').notNull(),
  /** payment_sources.id for transfer destination (legacy rows may hold name). */
  toAccount: text('to_account'),
  category: text('category'),
})
