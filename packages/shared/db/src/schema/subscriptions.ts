import { boolean, date, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull().references(() => users.email),
  name: text('name').notNull(),
  category: text('category'),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('INR').notNull(),
  billingCycle: text('billing_cycle').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  autopay: boolean('autopay').default(false),
  status: text('status').default('active').notNull(),
  paymentMethod: text('payment_method'),
  appUuid: text('app_uuid'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
