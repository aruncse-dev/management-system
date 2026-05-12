import { boolean, date, integer, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  date: date('date').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: text('category'),
  categoryId: text('category_id'),
  type: text('type').notNull(),
  mode: text('mode'),
  paymentSourceId: text('payment_source_id'),
  /** Transfer destination account/credit label (`mode` is the source). Legacy rows may leave this null and encode `→…` in `notes`. */
  transferTo: text('transfer_to'),
  transferToId: text('transfer_to_id'),
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

/** Unified table: accounts, credit cards, and informal credits. */
export const paymentSources = pgTable('payment_sources', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  description: text('description'),
  /** `account` | `credit_card` | `informal` */
  sourceType: text('source_type').notNull(),
  /** `savings` | `monthly` | `both` — which surfaces list this (primarily for accounts) */
  usedFor: text('used_for').notNull().default('both'),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
})
