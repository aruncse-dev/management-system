import type { SalaryBasis, WeeklyOff } from '../types'

/** Days in the month named by a 'YYYY-MM' key. */
export function daysInMonth(monthYear: string): number {
  const [y, m] = monthYear.split('-').map(Number)
  if (!y || !m) return 0
  // Day 0 of the next month is the last day of this one.
  return new Date(y, m, 0).getDate()
}

function isWeeklyOff(y: number, m: number, day: number, weeklyOff: WeeklyOff): boolean {
  if (weeklyOff === 'none') return false
  const dow = new Date(y, m - 1, day).getDay() // 0 = Sun, 6 = Sat
  return dow === 0 || (weeklyOff === 'sat_sun' && dow === 6)
}

/**
 * Working days in the month, optionally only up to `throughDay`.
 *
 * The cap is what makes an in-progress month readable: on the 14th of a 26-day
 * month, 12 of those days have not happened yet and counting them as absence
 * would be wrong on the screen and wrong in the deduction.
 */
export function expectedWorkingDays(monthYear: string, weeklyOff: WeeklyOff, throughDay?: number): number {
  const [y, m] = monthYear.split('-').map(Number)
  if (!y || !m) return 0
  const last = Math.min(throughDay ?? daysInMonth(monthYear), daysInMonth(monthYear))
  let count = 0
  for (let d = 1; d <= last; d += 1) {
    if (!isWeeklyOff(y, m, d, weeklyOff)) count += 1
  }
  return count
}

export type MonthPayInput = {
  monthYear: string
  salaryType: SalaryBasis
  salaryAmount: number
  weeklyOff: WeeklyOff
  paidLeaves: number
  workedDays: number
  /** Defaults to now. Injectable so the elapsed-day logic is testable. */
  today?: Date
}

export type MonthPay = {
  /** Working days in the whole month. Also the divisor for a monthly salary. */
  expectedDays: number
  /** Working days that have actually elapsed. Equals `expectedDays` once the month is over. */
  elapsedExpectedDays: number
  /** Working days still to come. Zero for any month that has finished. */
  remainingDays: number
  /** True while the month is still running, so the figures are partial. */
  inProgress: boolean
  workedDays: number
  /**
   * Elapsed working days not worked. Counted against days that have passed, never
   * against the rest of the month, and never negative — working a day off does
   * not create credit.
   */
  absentDays: number
  /** Absence covered by the monthly allowance. */
  paidLeaveUsed: number
  /** Absence beyond the allowance. Only this costs money. */
  unpaidDays: number
  /** What one day is worth: the rate itself for daily staff, salary ÷ expected days for monthly. */
  perDayValue: number
  deduction: number
  estimate: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Daily staff are paid strictly for days worked — weekly off and leave allowance
 * describe their attendance but never their pay. Monthly staff draw the full
 * salary, less a per-day deduction for absence beyond their allowance, where the
 * per-day value is the salary spread over the days they were expected in.
 */
export function computeMonthPay(input: MonthPayInput): MonthPay {
  const { monthYear, salaryType, salaryAmount, weeklyOff, paidLeaves, workedDays } = input
  const today = input.today ?? new Date()

  const expectedDays = expectedWorkingDays(monthYear, weeklyOff)

  // How far into this month we are: the whole of it for a month that has passed,
  // nothing for one that has not started, today's date for the one we are in.
  const nowKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const throughDay = monthYear < nowKey ? daysInMonth(monthYear) : monthYear > nowKey ? 0 : today.getDate()
  const elapsedExpectedDays = throughDay === 0 ? 0 : expectedWorkingDays(monthYear, weeklyOff, throughDay)
  const inProgress = monthYear >= nowKey && elapsedExpectedDays < expectedDays
  const remainingDays = Math.max(0, expectedDays - elapsedExpectedDays)

  const absentDays = Math.max(0, elapsedExpectedDays - workedDays)
  const allowance = Math.max(0, Math.floor(paidLeaves))
  const paidLeaveUsed = Math.min(absentDays, allowance)
  const unpaidDays = absentDays - paidLeaveUsed

  if (salaryType === 'daily') {
    return {
      expectedDays,
      elapsedExpectedDays,
      remainingDays,
      inProgress,
      workedDays,
      absentDays,
      paidLeaveUsed,
      unpaidDays,
      perDayValue: round2(salaryAmount),
      deduction: 0,
      estimate: round2(salaryAmount * workedDays),
    }
  }

  const perDayValue = expectedDays > 0 ? salaryAmount / expectedDays : 0
  const deduction = Math.min(salaryAmount, unpaidDays * perDayValue)
  return {
    expectedDays,
    elapsedExpectedDays,
    remainingDays,
    inProgress,
    workedDays,
    absentDays,
    paidLeaveUsed,
    unpaidDays,
    perDayValue: round2(perDayValue),
    deduction: round2(deduction),
    estimate: round2(Math.max(0, salaryAmount - deduction)),
  }
}
