import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** User profile with authentication. Org membership is via org_members table. */
export const users = pgTable('users', {
  email: text('email').primaryKey(),
  displayName: text('display_name'),
  /** Platform role: `admin` = Admin app only; `member` = default. Org-scoped roles live on `org_members.role`, not here. */
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
