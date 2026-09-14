export type MonthRef = { month: string; year: string }

export type SalaryBasis = 'daily' | 'monthly'

/** Days of the week this person is not expected in. */
export type WeeklyOff = 'none' | 'sunday' | 'sat_sun'

export const WEEKLY_OFF_LABELS: Record<WeeklyOff, string> = {
  none: 'No weekly off',
  sunday: 'Sundays off',
  sat_sun: 'Sat + Sun off',
}

export type StaffMember = {
  id: string
  name: string
  active: boolean
  gender?: string
  salaryType: SalaryBasis
  salaryAmount: number
  weeklyOff: WeeklyOff
  /** Days of absence per month that cost nothing. */
  paidLeavesPerMonth: number
}

export type AttendanceRow = {
  entryId: string
  date: string
  staffId: string
  worked: boolean
  overtime: boolean
  notes?: string
}

/** One staff member's month, as returned by `getHistory`. */
export type HistoryRow = {
  /** 'YYYY-MM' */
  monthYear: string
  staffId: string
  staffName: string
  /** False when the staff member has since been marked inactive. */
  staffActive: boolean

  /** Distinct days with any attendance row. */
  workedDays: number
  /** Distinct days marked overtime. Informational — it does not change `estimate`. */
  otDays: number

  salaryType: SalaryBasis
  salaryAmount: number
  weeklyOff: WeeklyOff
  paidLeaves: number

  /** Working days in the whole month. */
  expectedDays: number
  /** Working days elapsed so far; equals `expectedDays` once the month is over. */
  elapsedExpectedDays: number
  /** Working days still to come. Zero for a finished month. */
  remainingDays: number
  /** True while the month is still running, so these figures are partial. */
  inProgress: boolean
  /** Elapsed working days not worked — never counts days that have not happened. */
  absentDays: number
  paidLeaveUsed: number
  /** Absence beyond the allowance — the only absence that costs money. */
  unpaidDays: number
  perDayValue: number
  deduction: number
  /** daily: worked days x rate. monthly: salary less the unpaid-leave deduction. */
  estimate: number
}
