import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** User profile with org membership and authentication. */
export const users = pgTable('users', {
  email: text('email').primaryKey(),
  displayName: text('display_name'),
  orgId: text('org_id'),
  /** User role: `member` (within org), `org_admin` (manages org), `admin` (platform admin). */
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
