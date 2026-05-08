import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Organization (household, team, business unit) — stores denormalized apps and menus config. */
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  status: text('status').default('active').notNull(),
  notes: text('notes'),
  /** List of enabled app slugs: ["fintracker", "vault", "staff"] */
  enabledApps: jsonb('enabled_apps').default('[]'),
  /** Map of app slug to enabled menu IDs: {"fintracker": ["dashboard", "budget"], "vault": [...]} */
  enabledMenus: jsonb('enabled_menus').default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Organization = typeof organizations.$inferSelect
