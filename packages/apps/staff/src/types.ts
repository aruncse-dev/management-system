export type MonthRef = { month: string; year: string }

export type SalaryBasis = 'daily' | 'monthly'

export type StaffMember = {
  id: string
  name: string
  active: boolean
  salaryType: SalaryBasis
  salaryAmount: number
}

export type AttendanceRow = {
  entryId: string
  date: string
  staffId: string
  worked: boolean
  overtime: boolean
}

export type StaffSettings = {
  staffAttendanceSpreadsheetId: string
}
