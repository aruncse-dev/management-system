import { date, index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'

export const staffMembers = pgTable('staff_members', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  name: text('name').notNull(),
  role: text('role'),
  gender: text('gender'),
  joinedDate: date('joined_date'),
  /** 'active' | 'inactive'. Inactive staff are hidden from new attendance entry but kept in history. */
  status: text('status').default('active').notNull(),
  /** 'daily' | 'monthly' */
  salaryType: text('salary_type'),
  /**
   * Which days of the week this person is not expected in:
   * 'none' | 'sunday' | 'sat_sun'. Drives `expected days` for a month, which is
   * both the attendance baseline and the per-day divisor for monthly salaries.
   */
  weeklyOff: text('weekly_off').default('none').notNull(),
  /** Days of absence per month that cost nothing. Absence beyond this is deducted. */
  paidLeavesPerMonth: integer('paid_leaves_per_month').default(0).notNull(),
  /**
   * Kept as text: it is written and read as a string across the staff client, and
   * changing the column type would ripple through every caller for no gain here.
   * The month-rate snapshot below stores numeric(12,2), which is what the history
   * estimates are actually computed from.
   */
  salaryAmount: text('salary_amount'),
})

export type StaffMemberRow = typeof staffMembers.$inferSelect

export const attendance = pgTable('attendance', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  staffId: text('staff_id').notNull(),
  /** 'YYYY-MM' */
  monthYear: text('month_year').notNull(),
  day: integer('day').notNull(),
  /** 'worked' | 'overtime'. Absence is the lack of a row, not a status. */
  status: text('status').notNull(),
  notes: text('notes'),
}, (t) => ({
  // Makes the existing onConflictDoNothing() in setAttendance real: one row per
  // staff member per day. Without it, duplicate taps inflate day counts.
  uniqueStaffDay: uniqueIndex('attendance_org_staff_month_day_unique').on(t.orgId, t.staffId, t.monthYear, t.day),
  orgMonth: index('attendance_org_month_idx').on(t.orgId, t.monthYear),
}))

export type AttendanceEntryRow = typeof attendance.$inferSelect
