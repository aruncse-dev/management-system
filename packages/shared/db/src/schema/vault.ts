import { boolean, date, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const vaultApps = pgTable('vault_apps', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  appName: text('app_name').notNull(),
  category: text('category'),
  logo: text('logo'),
  appLink: text('app_link'),
  usernameEnc: text('username_enc'),
  passwordEnc: text('password_enc'),
  twoFactor: boolean('two_factor').default(false),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const bankingRecords = pgTable('banking_records', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  holderName: text('holder_name'),
  bankName: text('bank_name').notNull(),
  accountNoEnc: text('account_no_enc'),
  ifsc: text('ifsc'),
  cifEnc: text('cif_enc'),
  usernameEnc: text('username_enc'),
  passwordEnc: text('password_enc'),
  transactionPasswordEnc: text('transaction_password_enc'),
  profilePasswordEnc: text('profile_password_enc'),
  mpinEnc: text('mpin_enc'),
  appUuid: text('app_uuid'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const persons = pgTable('persons', {
  uuid: text('uuid').primaryKey(),
  orgId: text('org_id'),
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
  orgId: text('org_id'),
  policyType: text('policy_type'),
  planName: text('plan_name').notNull(),
  insurer: text('insurer'),
  appId: text('app_id'),
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
  personUuid: text('person_uuid'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const vaultDocuments = pgTable('vault_documents', {
  docUuid: text('doc_uuid').primaryKey(),
  orgId: text('org_id').notNull(),
  personUuid: text('person_uuid').notNull(),
  docType: text('doc_type').notNull(),
  docNumber: text('doc_number'),
  driveUrl: text('drive_url'),
  expiry: date('expiry'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const vaultHealthVitals = pgTable('vault_health_vitals', {
  vitalUuid: text('vital_uuid').primaryKey(),
  orgId: text('org_id').notNull(),
  personUuid: text('person_uuid').notNull(),
  recordedAt: timestamp('recorded_at').notNull(),
  heightCm: numeric('height_cm', { precision: 6, scale: 2 }),
  weightKg: numeric('weight_kg', { precision: 6, scale: 2 }),
  systolic: numeric('systolic', { precision: 5, scale: 1 }),
  diastolic: numeric('diastolic', { precision: 5, scale: 1 }),
  bloodSugar: numeric('blood_sugar', { precision: 6, scale: 2 }),
  notes: text('notes'),
})

export const vaultIllnesses = pgTable('vault_illnesses', {
  illnessUuid: text('illness_uuid').primaryKey(),
  orgId: text('org_id').notNull(),
  personUuid: text('person_uuid').notNull(),
  name: text('name').notNull(),
  diagnosedOn: date('diagnosed_on'),
  status: text('status'),
  notes: text('notes'),
})

export const vaultMedications = pgTable('vault_medications', {
  medUuid: text('med_uuid').primaryKey(),
  orgId: text('org_id').notNull(),
  personUuid: text('person_uuid').notNull(),
  illnessUuid: text('illness_uuid'),
  name: text('name').notNull(),
  dosage: text('dosage'),
  frequency: text('frequency'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  reminderTimes: text('reminder_times'),
  notes: text('notes'),
})

export const vaultHabits = pgTable('vault_habits', {
  habitUuid: text('habit_uuid').primaryKey(),
  orgId: text('org_id').notNull(),
  personUuid: text('person_uuid').notNull(),
  name: text('name').notNull(),
  category: text('category'),
  targetFrequency: text('target_frequency'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const vaultHabitLogs = pgTable('vault_habit_logs', {
  logUuid: text('log_uuid').primaryKey(),
  orgId: text('org_id').notNull(),
  habitUuid: text('habit_uuid').notNull(),
  personUuid: text('person_uuid').notNull(),
  logDate: date('log_date').notNull(),
  completed: boolean('completed').default(false).notNull(),
})
