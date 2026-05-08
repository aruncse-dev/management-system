import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { organizations } from './orgs'

/** User profile with org membership and authentication. */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'set null' }),
  /** User role within org: `member`, `org_admin`, etc. */
  role: text('role').default('member').notNull(),
  status: text('status').default('active').notNull(),
  /** Auth token — track for session management (e.g., OAuth token, session ID). */
  token: text('token'),
  lastTokenAt: timestamp('last_token_at'),
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
