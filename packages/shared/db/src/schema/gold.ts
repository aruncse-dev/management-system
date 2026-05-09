import { date, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const goldItems = pgTable('gold_items', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  name: text('name').notNull(),
  weightG: numeric('weight_g', { precision: 10, scale: 3 }).notNull(),
  person: text('person'),
  location: text('location'),
})

export const goldHistory = pgTable('gold_history', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  date: date('date').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  weightG: numeric('weight_g', { precision: 10, scale: 3 }).notNull(),
  note: text('note'),
})
