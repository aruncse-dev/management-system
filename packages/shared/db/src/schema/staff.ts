import { date, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { users } from './users'

export const staffMembers = pgTable('staff_members', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull().references(() => users.email),
  name: text('name').notNull(),
  role: text('role'),
  joinedDate: date('joined_date'),
  status: text('status').default('active').notNull(),
})

export const attendance = pgTable('attendance', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull().references(() => users.email),
  staffId: text('staff_id').notNull().references(() => staffMembers.id),
  monthYear: text('month_year').notNull(),
  day: integer('day').notNull(),
  status: text('status').notNull(),
  notes: text('notes'),
})
