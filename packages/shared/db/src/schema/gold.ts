import { boolean, date, numeric, pgTable, text } from 'drizzle-orm/pg-core'

export const goldResources = pgTable('gold_resources', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  type: text('type').notNull(), // 'person' | 'location'
  name: text('name').notNull(),
  skip: boolean('skip').default(false).notNull(),
})

export const goldItems = pgTable('gold_items', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  weightG: numeric('weight_g', { precision: 10, scale: 3 }).notNull(),
  personId: text('person_id'),
  locationId: text('location_id'),
})

export const goldHistory = pgTable('gold_history', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  date: date('date').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  weightG: numeric('weight_g', { precision: 10, scale: 3 }).notNull(),
  note: text('note'),
})
