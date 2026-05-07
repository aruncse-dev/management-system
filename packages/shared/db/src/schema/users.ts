import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  email: text('email').primaryKey(),
  displayName: text('display_name'),
  role: text('role').default('user').notNull(),
  status: text('status').default('active').notNull(),
  modules: text('modules').array().default([]).notNull(),
  menuConfig: jsonb('menu_config'),
  settings: jsonb('settings'),
  useDb: boolean('use_db').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const ALL_MODULE_IDS = [
  'dashboard',
  'budget',
  'transactions',
  'credits',
  'accounts',
  'savings',
  'lending',
  'gold',
  'loans',
  'subscriptions',
  'stocks',
  'mutualfunds',
  'investments',
  'vault',
  'insurance',
  'persons',
  'health',
  'habits',
  'documents',
  'staff',
] as const

export type ModuleId = typeof ALL_MODULE_IDS[number]

export type MenuEntry = {
  id: ModuleId
  label: string
  order: number
  enabled: boolean
}
