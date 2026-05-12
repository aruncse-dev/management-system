import { boolean, date, integer, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  date: date('date').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: text('category'),
  type: text('type').notNull(),
  mode: text('mode'),
  /** Transfer destination account/credit label (`mode` is the source). Legacy rows may leave this null and encode `→…` in `notes`. */
  transferTo: text('transfer_to'),
  notes: text('notes'),
  monthYear: text('month_year').notNull(),
})

/** `month_year`: `__global__` = default template; `YYYY-MM` overrides global for that month only (same category). */
export const budget = pgTable('budget', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  monthYear: text('month_year').notNull(),
  category: text('category').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  description: text('description'),
  /** `savings` | `monthly` | `both` — which surfaces list this account */
  usedFor: text('used_for').notNull().default('both'),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
})

/** User-configurable credit card / informal credit labels (transaction `mode`). */
export const creditSources = pgTable('credit_sources', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  description: text('description'),
  /** `credit_card` | `informal` */
  category: text('category').notNull(),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
})
