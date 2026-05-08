import { boolean, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { organizations } from './orgs'
import { apps } from './apps'
import { menuSections } from './sections'

/** Applied SQL migrations / schema iterations (app-visible history). */
export const schemaMigrations = pgTable('schema_migrations', {
  version: text('version').primaryKey(),
  name: text('name').notNull(),
  appliedAt: timestamp('applied_at').defaultNow().notNull(),
})

/**
 * Global menu catalog: stable ids; orgs enable subsets via `org_menu_assignments`.
 * `slug` is URL-friendly; `path` is in-app route for the owning app(s).
 */
export const menuCatalog = pgTable('menu_catalog', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  /** Lucide icon name (e.g. `LayoutDashboard`). */
  icon: text('icon'),
  path: text('path').notNull(),
  sectionId: text('section_id')
    .notNull()
    .references(() => menuSections.id, { onDelete: 'restrict' }),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/** Which apps surface each catalog entry (M:N). */
export const menuApps = pgTable(
  'menu_apps',
  {
    id: text('id').primaryKey(),
    menuId: text('menu_id')
      .notNull()
      .references(() => menuCatalog.id, { onDelete: 'cascade' }),
    appId: text('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
  },
  table => [uniqueIndex('menu_apps_menu_app_uq').on(table.menuId, table.appId)],
)

export const orgMenuAssignments = pgTable(
  'org_menu_assignments',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    menuId: text('menu_id')
      .notNull()
      .references(() => menuCatalog.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').default(0).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
  },
  table => [uniqueIndex('org_menu_org_menu_uq').on(table.orgId, table.menuId)],
)

export type MenuCatalogRow = typeof menuCatalog.$inferSelect
export type OrgMenuAssignment = typeof orgMenuAssignments.$inferSelect
export type MenuAppRow = typeof menuApps.$inferSelect
