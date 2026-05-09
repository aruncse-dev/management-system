import { date, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const lending = pgTable('lending', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  date: date('date').notNull(),
  name: text('name').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type: text('type').notNull(),
  description: text('description'),
})
