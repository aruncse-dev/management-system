import { date, numeric, pgTable, text } from 'drizzle-orm/pg-core'

/**
 * Investments tracked by hand — land, a plot, unlisted shares, a chit, a
 * business stake. Synced market holdings live in `stocks` / `mutual_funds`.
 * Only `name` is required; the optional fields turn the ledger into value,
 * gain and (for land) per-sqft figures once they're filled in.
 */
export const otherInvestments = pgTable('other_investments', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  /** 'land' | 'shares' | 'chit' | 'business' | 'other' */
  type: text('type').default('land').notNull(),
  /** Land / plot only. */
  areaSqft: numeric('area_sqft', { precision: 12, scale: 2 }),
  /** Agreed purchase price, for things bought in installments — gives "balance due". */
  price: numeric('price', { precision: 12, scale: 2 }),
  /** Today's estimate for the whole holding; null = not valued yet. */
  currentValue: numeric('current_value', { precision: 12, scale: 2 }),
  /** 'active' | 'sold' */
  status: text('status').default('active').notNull(),
})

/**
 * The investment's ledger, like `lending`: every rupee in or out is one row.
 * kind: 'paid' (toward the asset) | 'expense' (commission, registration…) | 'received' (sale, payout, refund).
 */
export const otherInvestmentTxns = pgTable('other_investment_txns', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  investmentId: text('investment_id').notNull(),
  date: date('date').notNull(),
  kind: text('kind').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
})
