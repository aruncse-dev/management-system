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
  /** Payment source label (account/credit name). See `payment_sources` for configured accounts. */
  mode: text('mode'),
  /** Transfer destination (`mode` is source). Legacy rows may encode `→…` in `notes`. */
  transferTo: text('transfer_to'),
  notes: text('notes'),
  monthYear: text('month_year').notNull(),
})

/** `month_year`: `__global__` = default template; `YYYY-MM` overrides global for that month only (same category).
    `start_month`/`end_month`: null = no bound (from beginning or never ends); both set = pinned month. */
export const budget = pgTable('budget', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  monthYear: text('month_year').notNull(),
  category: text('category').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  startMonth: text('start_month'),
  endMonth: text('end_month'),
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
