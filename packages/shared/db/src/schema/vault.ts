import { boolean, date, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const vaultApps = pgTable('vault_apps', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull().references(() => users.email),
  appName: text('app_name').notNull(),
  category: text('category'),
  logo: text('logo'),
  appLink: text('app_link'),
  username: text('username'),
  password: text('password'),
  twoFactor: boolean('two_factor').default(false),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const bankingRecords = pgTable('banking_records', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull().references(() => users.email),
  holderName: text('holder_name'),
  bankName: text('bank_name').notNull(),
  accountNo: text('account_no'),
  ifsc: text('ifsc'),
  cif: text('cif'),
  username: text('username'),
  password: text('password'),
  transactionPassword: text('transaction_password'),
  profilePassword: text('profile_password'),
  mpin: text('mpin'),
  appUuid: text('app_uuid').references(() => vaultApps.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const persons = pgTable('persons', {
  uuid: text('uuid').primaryKey(),
  userEmail: text('user_email').notNull().references(() => users.email),
  name: text('name').notNull(),
  relation: text('relation'),
  dob: date('dob'),
  gender: text('gender'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const insurance = pgTable('insurance', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull().references(() => users.email),
  policyType: text('policy_type'),
  planName: text('plan_name').notNull(),
  insurer: text('insurer'),
  appId: text('app_id').references(() => vaultApps.id),
  policyNo: text('policy_no'),
  owner: text('owner'),
  premium: numeric('premium', { precision: 12, scale: 2 }),
  premiumMode: text('premium_mode'),
  paymentMethod: text('payment_method'),
  issueDate: date('issue_date'),
  maturityDate: date('maturity_date'),
  sumAssured: numeric('sum_assured', { precision: 14, scale: 2 }),
  cashValue: numeric('cash_value', { precision: 14, scale: 2 }),
  nominee: text('nominee'),
  notes: text('notes'),
  personUuid: text('person_uuid').references(() => persons.uuid),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
