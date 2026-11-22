import { date, index, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const lending = pgTable('lending', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  /** Book within org: `lending` (default) vs `vijaya-amma`, etc. */
  sheetSlug: text('sheet_slug').notNull().default('lending'),
  date: date('date').notNull(),
  name: text('name').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type: text('type').notNull(),
  description: text('description'),
}, (t) => [
  // Applied 2026-11-22: migrations/20261122100000_perf_indexes.sql
  index('lending_org_sheet_date_idx').on(t.orgId, t.sheetSlug, t.date.desc()),
])
