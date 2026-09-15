import { boolean, date, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

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
  /**
   * `active` | `lapsed` | `paid_up` | `matured`.
   *
   * Only `active` is offered for linking in the register and only `active` is
   * summed into the committed monthly outflow — a paid-up policy is still a
   * record worth keeping, but it is not money you owe every month.
   */
  status: text('status').default('active').notNull(),
  /**
   * Premiums paid before row-level tracking existed — an OPENING count, added
   * to `insurance_premiums` rows rather than replaced by them (the same
   * contract as `emiLoans.paidEmis`).
   *
   * Keeps the paid count honest without inventing payment rows whose dates
   * nobody could vouch for, and stays hand-editable afterwards.
   */
  paidPremiumsOpening: integer('paid_premiums_opening').default(0).notNull(),
  /**
   * Years of premiums, when that differs from the policy term.
   *
   * Regular-pay plans pay until maturity and leave this null. A limited-pay
   * plan ("pay 10, covered 30") stops billing long before maturity, and without
   * this the schedule would keep inventing premiums for the remaining years.
   */
  premiumPaymentTermYears: integer('premium_payment_term_years'),
  /**
   * The end date is a renewal, not a maturity.
   *
   * Health and motor cover run a year at a time and roll over, so the schedule
   * must not stop at `maturityDate`. False for life and term, which really do
   * end.
   */
  renews: boolean('renews').default(false).notNull(),
  /** E-card or policy pack link. Same shape as `vaultDocuments.driveUrl`. */
  ecardUrl: text('ecard_url'),
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

/**
 * Premiums actually paid for a policy — mirrors `subscriptionCharges` and the
 * three loan repayment tables.
 *
 * A premium posted from a linked transaction gets the derived id
 * `txn:<txnId>`, so the register entry and the premium stay one fact rather
 * than two.
 *
 * This is a MIRROR, not a second expense. Anything computing spend reads
 * `transactions` and nothing else — summing both double-counts every premium.
 */
export const insurancePremiums = pgTable('insurance_premiums', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  policyId: text('policy_id').notNull(),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
})

/**
 * People covered by a policy.
 *
 * `insurance.personUuid` stays the policy HOLDER — who owns the contract —
 * which is a different question from who it covers. A group or family-floater
 * policy covers several people, so that side is its own table.
 */
export const insuranceMembers = pgTable('insurance_members', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  policyId: text('policy_id').notNull(),
  personUuid: text('person_uuid').notNull(),
  /**
   * `insured` | `nominee` — the capacity this person appears in.
   *
   * A policy names people for two different reasons and they are not the same
   * list: the insured is who it covers, the nominee is who it pays.
   */
  role: text('role').default('insured').notNull(),
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
