import { date, integer, pgTable, text } from 'drizzle-orm/pg-core'

export const staffMembers = pgTable('staff_members', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  name: text('name').notNull(),
  role: text('role'),
  joinedDate: date('joined_date'),
  status: text('status').default('active').notNull(),
})

export const attendance = pgTable('attendance', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  staffId: text('staff_id').notNull(),
  monthYear: text('month_year').notNull(),
  day: integer('day').notNull(),
  status: text('status').notNull(),
  notes: text('notes'),
})
