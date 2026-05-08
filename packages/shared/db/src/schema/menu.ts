import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Applied SQL migrations / schema iterations (app-visible history). */
export const schemaMigrations = pgTable('schema_migrations', {
  version: text('version').primaryKey(),
  name: text('name').notNull(),
  appliedAt: timestamp('applied_at').defaultNow().notNull(),
})

/**
 * Menu catalog, menu_apps, and org_menu_assignments tables have been removed (migration 0004).
 * All menus are now static in code (adminStaticData.ts).
 * Org menu configurations are now denormalized into organizations.enabled_menus (jsonb).
 */

// Legacy type definitions for compatibility
export type MenuCatalogRow = {
  id: string
  slug: string
  label: string
  icon: string | null
  path: string
  sectionId: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type OrgMenuAssignment = {
  id: string
  orgId: string
  menuId: string
  sortOrder: number
  enabled: boolean
}

export type MenuAppRow = {
  id: string
  menuId: string
  appId: string
}
