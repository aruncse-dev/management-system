import { boolean, date, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
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

/**
 * Charges actually taken for a subscription — mirrors the loan repayment tables.
 *
 * A charge posted from a linked transaction gets the derived id `txn:<txnId>`,
 * so the register entry and the charge stay one fact rather than two.
 */
export const subscriptionCharges = pgTable('subscription_charges', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  subscriptionId: text('subscription_id').notNull(),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
})
