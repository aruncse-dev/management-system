import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Tracks applied SQL migration files (`schema_migrations` table). */
export const schemaMigrations = pgTable('schema_migrations', {
  version: text('version').primaryKey(),
  name: text('name').notNull(),
  appliedAt: timestamp('applied_at').defaultNow().notNull(),
})
