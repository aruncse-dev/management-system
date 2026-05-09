import { numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const stocks = pgTable('stocks', {
  id: serial('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  symbol: text('symbol').notNull(),
  company: text('company'),
  isin: text('isin'),
  qty: numeric('qty', { precision: 12, scale: 4 }).notNull(),
  avgPrice: numeric('avg_price', { precision: 12, scale: 4 }),
  lastPrice: numeric('last_price', { precision: 12, scale: 4 }),
  pnl: numeric('pnl', { precision: 14, scale: 2 }),
  dayChangePct: numeric('day_change_pct', { precision: 8, scale: 4 }),
  syncedAt: timestamp('synced_at'),
})

export const mutualFunds = pgTable('mutual_funds', {
  id: serial('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  fundName: text('fund_name').notNull(),
  folioNo: text('folio_no'),
  units: numeric('units', { precision: 14, scale: 4 }),
  purchased: numeric('purchased', { precision: 14, scale: 2 }),
  currentValue: numeric('current_value', { precision: 14, scale: 2 }),
  profitLoss: numeric('profit_loss', { precision: 14, scale: 2 }),
  schemeCode: text('scheme_code'),
})
