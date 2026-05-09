import { date, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  date: date('date').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: text('category'),
  type: text('type').notNull(),
  mode: text('mode'),
  notes: text('notes'),
  monthYear: text('month_year').notNull(),
})

/** `month_year`: `__global__` = default template; `YYYY-MM` overrides global for that month only (same category). */
export const budget = pgTable('budget', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  orgId: text('org_id'),
  monthYear: text('month_year').notNull(),
  category: text('category').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  name: text('name').notNull(),
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0'),
  type: text('type'),
})
