import { date, numeric, pgTable, text } from 'drizzle-orm/pg-core'
import { users } from './users'

export const savings = pgTable('savings', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull().references(() => users.email),
  date: date('date').notNull(),
  account: text('account').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  type: text('type').notNull(),
  toAccount: text('to_account'),
  category: text('category'),
})
