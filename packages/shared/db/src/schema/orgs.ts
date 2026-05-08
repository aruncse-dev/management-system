import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'

/** Organization (household, team, business unit) — separate from platform-wide admin. */
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  status: text('status').default('active').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const orgMembers = pgTable(
  'org_members',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userEmail: text('user_email')
      .notNull()
      .references(() => users.email, { onDelete: 'cascade' }),
    /** `org_admin` can manage membership for this org (future org-scoped UI); `member` is a participant. */
    role: text('role').default('member').notNull(),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => [uniqueIndex('org_members_org_user_uq').on(table.orgId, table.userEmail)],
)

export type Organization = typeof organizations.$inferSelect
export type OrgMember = typeof orgMembers.$inferSelect
