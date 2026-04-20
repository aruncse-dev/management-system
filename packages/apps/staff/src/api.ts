import { API_URL } from './constants'
import type { AttendanceRow, MonthRef, SalaryBasis, StaffMember, StaffSettings } from './types'

type ApiResponse<T> =
  | { ok: true; data: T; traceId?: string; debug?: Record<string, unknown> }
  | { ok: false; error: string; traceId?: string }

const BASE = API_URL
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true'
const MODULE = 'staff'

type CacheEntry = { action: string; params: Record<string, string>; data: unknown; savedAt: number }
const GET_CACHE = new Map<string, CacheEntry>()
const PERSIST_KEY = `staff:get-cache:${BASE}`

function clearPersistedStorage() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PERSIST_KEY)
  } catch {
    /* ignore */
  }
}

function loadPersistedCache() {
  if (typeof window === 'undefined') return
  const navEntry = window.performance?.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined
  if (navEntry?.type === 'reload') {
    clearPersistedStorage()
    return
  }
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>
    Object.entries(parsed).forEach(([key, entry]) => {
      if (entry && typeof entry.savedAt === 'number') GET_CACHE.set(key, entry)
    })
  } catch {
    /* ignore */
  }
}

function persistCache() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(Object.fromEntries(GET_CACHE.entries())))
  } catch {
    /* ignore */
  }
}

loadPersistedCache()

function generateTraceId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (text.trim().startsWith('<')) {
    const isLoginPage = text.includes('accounts.google.com')
    throw new Error(
      isLoginPage
        ? 'GAS access restricted — set deployment to Anyone with the link'
        : 'GAS not deployed or misconfigured',
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

function makeCacheKey(action: string, params: Record<string, string>) {
  const query = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')
  return `${BASE}|${action}|${query}`
}

function isSameParams(a: Record<string, string>, b: Record<string, string>) {
  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(k => a[k] === b[k])
}

export function invalidateCache(matcher?: { action?: string; params?: Record<string, string> }) {
  if (!matcher) {
    GET_CACHE.clear()
    persistCache()
    return
  }
  for (const [key, entry] of GET_CACHE.entries()) {
    if (matcher.action && entry.action !== matcher.action) continue
    if (matcher.params && !isSameParams(entry.params, matcher.params)) continue
    GET_CACHE.delete(key)
  }
  persistCache()
}

export function clearPersistentCache() {
  GET_CACHE.clear()
  clearPersistedStorage()
}

async function get<T>(
  action: string,
  params: Record<string, string> = {},
  options: { cache?: boolean } = {},
): Promise<T> {
  const shouldCache = options.cache !== false
  const cacheKey = makeCacheKey(action, params)
  if (shouldCache && GET_CACHE.has(cacheKey)) {
    return GET_CACHE.get(cacheKey)?.data as T
  }
  const url = new URL(BASE, window.location.origin)
  const traceId = generateTraceId()
  url.searchParams.set('module', MODULE)
  url.searchParams.set('action', action)
  url.searchParams.set('traceId', traceId)
  if (DEBUG) url.searchParams.set('debug', 'true')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { credentials: 'same-origin', redirect: 'follow' })
  const data = await parseResponse<T>(res)
  if (shouldCache) {
    GET_CACHE.set(cacheKey, { action, params, data, savedAt: Date.now() })
    persistCache()
  }
  return data
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

  getSettings: () => get<StaffSettings>('getSettings', {}),

  saveSettings: async (staffAttendanceSpreadsheetId: string) => {
    const result = await post<boolean>({ action: 'saveSettings', staffAttendanceSpreadsheetId })
    invalidateCache({ action: 'getSettings', params: {} })
    return result
  },

  listStaff: () => get<StaffMember[]>('listStaff', {}),

  addStaff: async (payload: { name: string; salaryType?: SalaryBasis; salaryAmount?: number }) => {
    const result = await post<StaffMember>({ action: 'addStaff', ...payload })
    invalidateCache({ action: 'listStaff', params: {} })
    return result
  },

  updateStaff: async (payload: {
    id: string
    name: string
    active?: boolean
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
  }) => {
    const { month, year } = payload
    const result = await post<AttendanceRow>({ action: 'setAttendance', ...payload })
    invalidateCache({ action: 'getAttendance', params: { month, year } })
    return result
  },
}
