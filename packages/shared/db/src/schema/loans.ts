import { date, integer, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const emiLoans = pgTable('emi_loans', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  bank: text('bank'),
  principal: numeric('principal', { precision: 12, scale: 2 }).notNull(),
  rate: numeric('rate', { precision: 6, scale: 3 }).notNull(),
  startDate: date('start_date').notNull(),
  tenureMonths: integer('tenure_months').notNull(),
  emiAmount: numeric('emi_amount', { precision: 12, scale: 2 }).notNull(),
  paidEmis: integer('paid_emis').default(0).notNull(),
  status: text('status').default('Ongoing').notNull(),
})

export const jewelLoans = pgTable('jewel_loans', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  bank: text('bank'),
  principal: numeric('principal', { precision: 12, scale: 2 }).notNull(),
  rate: numeric('rate', { precision: 6, scale: 3 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  status: text('status').default('Ongoing').notNull(),
})

export const jewelLoanRepayments = pgTable('jewel_loan_repayments', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  loanId: text('loan_id').notNull(),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
})

export const cashLoans = pgTable('cash_loans', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  personName: text('person_name').notNull(),
  amountReceived: numeric('amount_received', { precision: 12, scale: 2 }).notNull(),
  startDate: date('start_date').notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
})

export const cashLoanRepayments = pgTable('cash_loan_repayments', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  loanId: text('loan_id').notNull(),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
})
