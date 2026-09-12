import { boolean, date, integer, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  date: date('date').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: text('category'),
  categoryId: text('category_id'),
  type: text('type').notNull(),
  /** Payment source label (account/credit name). See `payment_sources` for configured accounts. */
  mode: text('mode'),
  /** Transfer destination (`mode` is source). Legacy rows may encode `→…` in `notes`. */
  transferTo: text('transfer_to'),
  notes: text('notes'),
  monthYear: text('month_year').notNull(),
  /**
   * Soft reference to the module row this transaction represents
   * (`jewel_loan` | `cash_loan` | `emi_loan` | `savings` | `lending` | `subscription`).
   * Deliberately not a foreign key — see the 2026-09-08-fintracker-spine migration.
   */
  refKind: text('ref_kind'),
  /** Target row id for `refKind`. Unconstrained: may dangle if the target is deleted. */
  refId: text('ref_id'),
})

/** `month_year`: `__global__` = default template; `YYYY-MM` overrides global for that month only (same category).
    `start_month`/`end_month`: null = no bound (from beginning or never ends); both set = pinned month. */
export const budget = pgTable('budget', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  monthYear: text('month_year').notNull(),
  category: text('category').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  startMonth: text('start_month'),
  endMonth: text('end_month'),
})

/** Unified table: accounts, credit cards, and informal credits. */
export const paymentSources = pgTable('payment_sources', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  description: text('description'),
  /** `account` | `credit_card` | `informal` */
  sourceType: text('source_type').notNull(),
  /** `savings` | `monthly` | `both` — which surfaces list this (primarily for accounts) */
  usedFor: text('used_for').notNull().default('both'),
  /**
   * `savings_bank` | `rd` | `fd` | `cash` | `other` — what kind of account this
   * is, for grouping and filtering. Read only for `sourceType = 'account'`;
   * credit sources share the table and take the default without meaning it.
   *
   * Deliberately does not drive behaviour: RD mechanics still key off
   * `rdInstalment`, so this stays a label and cannot silently change a total.
   */
  accountKind: text('account_kind').notNull().default('savings_bank'),
  isActive: boolean('is_active').default(true),
  /**
   * When the account was closed; null while it is open. A matured FD keeps its
   * history and its balance — `isActive = false` would hide both — it just
   * stops being offered as a destination for new money.
   */
  closedOn: date('closed_on'),
  sortOrder: integer('sort_order').default(0),
  /**
   * Recurring-deposit terms. An account is an RD exactly when `rdInstalment` is
   * set; all of these are null for an ordinary account or credit source.
   * Maturity date is derived (`rdStartDate` + `rdMonths`), never stored.
   */
  rdInstalment: numeric('rd_instalment', { precision: 12, scale: 2 }),
  rdDay: integer('rd_day'),
  rdMonths: integer('rd_months'),
  rdStartDate: date('rd_start_date'),
  rdMaturityAmount: numeric('rd_maturity_amount', { precision: 12, scale: 2 }),
})
