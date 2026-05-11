import { date, integer, pgTable, text } from 'drizzle-orm/pg-core'

export const staffMembers = pgTable('staff_members', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  role: text('role'),
  joinedDate: date('joined_date'),
  status: text('status').default('active').notNull(),
})

export const attendance = pgTable('attendance', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  staffId: text('staff_id').notNull(),
  monthYear: text('month_year').notNull(),
  day: integer('day').notNull(),
  status: text('status').notNull(),
  notes: text('notes'),
})
