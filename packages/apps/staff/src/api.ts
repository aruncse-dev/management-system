import { API_URL } from './constants'
import type { AttendanceRow, MonthRef, SalaryBasis, StaffMember } from './types'

type ApiResponse<T> =
  | { ok: true; data: T; traceId?: string; debug?: Record<string, unknown> }
  | { ok: false; error: string; traceId?: string }

const BASE = API_URL // default same-origin /api from config.ts
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true'
const MODULE = 'staff'


function generateTraceId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (text.trim().startsWith('<')) {
    const isLoginPage = text.includes('accounts.google.com')
    throw new Error(
      isLoginPage
        ? 'Received a sign-in page instead of API JSON — sign in to the app and ensure /api routes are reachable.'
        : 'Unexpected HTML from API — check NEXT_PUBLIC_API_URL, server logs, and DATABASE_URL.',
    )
  }
  const json: ApiResponse<T> = JSON.parse(text)
  if (!json.ok) {
    const err = new Error(json.error) as Error & { traceId?: string }
    err.traceId = json.traceId
    throw err
  }
  if (DEBUG && json.traceId) console.log('[Staff API]', json.traceId)
  return json.data
}

export function invalidateCache(matcher?: { action?: string; params?: Record<string, string> }) {
  void matcher
}

export function clearPersistentCache() {
  // No persistent cache in client anymore.
}

async function get<T>(
  action: string,
  params: Record<string, string> = {},
  options: { cache?: boolean } = {},
): Promise<T> {
  void options
  const url = new URL(BASE, window.location.origin)
  const traceId = generateTraceId()
  url.searchParams.set('module', MODULE)
  url.searchParams.set('action', action)
  url.searchParams.set('traceId', traceId)
  if (DEBUG) url.searchParams.set('debug', 'true')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { credentials: 'same-origin', redirect: 'follow', cache: 'no-store' })
  return parseResponse<T>(res)
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const traceId = generateTraceId()
  const payload = {
    module: MODULE,
    ...body,
    traceId,
    ...(DEBUG && { debug: true }),
  }
  const res = await fetch(BASE, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  })
  return parseResponse<T>(res)
}

export const api = {
  invalidateCache,
  clearPersistentCache,

  listStaff: () => get<StaffMember[]>('listStaff', {}),

  addStaff: async (payload: { name: string; gender?: string; salaryType?: SalaryBasis; salaryAmount?: number }) => {
    const result = await post<StaffMember>({ action: 'addStaff', ...payload })
    invalidateCache({ action: 'listStaff', params: {} })
    return result
  },

  updateStaff: async (payload: {
    id: string
    name: string
    active?: boolean
    gender?: string
    salaryType: SalaryBasis
    salaryAmount: number
  }) => {
    const result = await post<StaffMember>({ action: 'updateStaff', ...payload })
    invalidateCache({ action: 'listStaff', params: {} })
    return result
  },

  getMonths: () => get<MonthRef[]>('getMonths', {}),

  getAttendance: (month: string, year: string) => get<AttendanceRow[]>('getAttendance', { month, year }),

  ensureMonth: async (month: string, year: string) => {
    const result = await post<boolean>({ action: 'ensureMonth', month, year })
    invalidateCache({ action: 'getMonths', params: {} })
    invalidateCache({ action: 'getAttendance', params: { month, year } })
    return result
  },

  setAttendance: async (payload: {
    month: string
    year: string
    date: string
    staffId: string
    worked: boolean
    overtime: boolean
    notes?: string
  }) => {
    const { month, year } = payload
    const result = await post<AttendanceRow>({ action: 'setAttendance', ...payload })
    invalidateCache({ action: 'getAttendance', params: { month, year } })
    return result
  },
}
