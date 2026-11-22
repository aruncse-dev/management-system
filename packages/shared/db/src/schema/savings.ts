import { sql } from 'drizzle-orm'
import { date, index, numeric, pgTable, text } from 'drizzle-orm/pg-core'

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
}, (t) => [
  // Applied 2026-11-22: migrations/20261122100000_perf_indexes.sql
  index('savings_org_date_idx').on(t.orgId, t.date.desc()),
  index('savings_org_account_idx').on(t.orgId, t.account),
  index('savings_org_to_account_idx').on(t.orgId, t.toAccount).where(sql`${t.toAccount} IS NOT NULL`),
])
