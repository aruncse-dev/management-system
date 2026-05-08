import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Global drawer / nav section headers (grouping for menu_catalog). */
export const menuSections = pgTable('menu_sections', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type MenuSectionRow = typeof menuSections.$inferSelect
export type NewMenuSectionRow = typeof menuSections.$inferInsert
