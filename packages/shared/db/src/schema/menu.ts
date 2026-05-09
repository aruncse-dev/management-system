import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Applied SQL migrations / schema iterations (app-visible history). */
export const schemaMigrations = pgTable('schema_migrations', {
  version: text('version').primaryKey(),
  name: text('name').notNull(),
  appliedAt: timestamp('applied_at').defaultNow().notNull(),
})

/**
 * Menu catalog, menu_apps, and org_menu_assignments tables have been removed (migration 0004).
 * All menus are now static in code (@fintracker-vault/config/appMenus).
 * Org menu configurations are denormalized into organizations.enabled_menus (jsonb).
 */
