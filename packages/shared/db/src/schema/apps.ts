import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Deployed product surface (FinTracker, Vault, Staff, …). */
export const apps = pgTable('apps', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  /** Optional lucide icon name for admin lists. */
  icon: text('icon'),
  sortOrder: integer('sort_order').default(0).notNull(),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type AppRow = typeof apps.$inferSelect
export type NewAppRow = typeof apps.$inferInsert
