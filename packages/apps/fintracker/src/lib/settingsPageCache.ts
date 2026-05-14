import type { AccountRow, CreditSourceRow, GoldResource, ProfileData } from '../api'
import type { FintrackerPrefs } from '../expenseCycle'
import { DEFAULT_FINTRACKER_PREFS } from '../expenseCycle'

export const FINTRACKER_SETTINGS_PAGE_CACHE_KEY = 'ft_fintracker_settings_page_cache_v1'

export type SettingsPageUpstoxStatus = {
  hasToken: boolean
  hasAccessToken?: boolean
  hasExtendedToken?: boolean
  hasRefreshToken?: boolean
  accessTokenExpiry?: string
  extendedTokenExpiry?: string
  expired?: boolean
}

export type SettingsPageUpstoxState = 'checking' | 'connected' | 'missing' | 'expired'

export type SettingsPageCachePayload = {
  fetchedAt: number
  settingsFields: Record<string, string>
  fintrackerDraft: FintrackerPrefs
  settingsDraft: { currency?: 'INR' | 'USD' | 'AED'; roundOff?: boolean }
  profile: ProfileData | null
  upstoxStatus: SettingsPageUpstoxStatus
  upstoxStatusState: SettingsPageUpstoxState
  accounts: AccountRow[]
  creditSources: CreditSourceRow[]
  goldResources?: GoldResource[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function parsePayload(raw: unknown): SettingsPageCachePayload | null {
  if (!isRecord(raw)) return null
  if (typeof raw.fetchedAt !== 'number') return null
  const settingsFields = raw.settingsFields
  if (!isRecord(settingsFields)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(settingsFields)) {
    if (typeof v === 'string') out[k] = v
  }
  const fintrackerDraft = isRecord(raw.fintrackerDraft)
    ? (raw.fintrackerDraft as unknown as FintrackerPrefs)
    : { ...DEFAULT_FINTRACKER_PREFS, expenseCycle: { ...DEFAULT_FINTRACKER_PREFS.expenseCycle } }
  const sd = raw.settingsDraft
  const settingsDraft =
    isRecord(sd) && (sd.currency === 'INR' || sd.currency === 'USD' || sd.currency === 'AED' || sd.currency === undefined)
      ? {
          currency: sd.currency as 'INR' | 'USD' | 'AED' | undefined,
          roundOff: sd.roundOff !== false,
        }
      : { currency: 'INR' as const, roundOff: true }

  const profile = raw.profile === null ? null : isRecord(raw.profile) ? (raw.profile as unknown as ProfileData) : null

  const us = raw.upstoxStatus
  const upstoxStatus: SettingsPageUpstoxStatus =
    isRecord(us) && typeof us.hasToken === 'boolean'
      ? {
          hasToken: us.hasToken,
          hasAccessToken: typeof us.hasAccessToken === 'boolean' ? us.hasAccessToken : undefined,
          hasExtendedToken: typeof us.hasExtendedToken === 'boolean' ? us.hasExtendedToken : undefined,
          hasRefreshToken: typeof us.hasRefreshToken === 'boolean' ? us.hasRefreshToken : undefined,
          accessTokenExpiry: typeof us.accessTokenExpiry === 'string' ? us.accessTokenExpiry : undefined,
          extendedTokenExpiry: typeof us.extendedTokenExpiry === 'string' ? us.extendedTokenExpiry : undefined,
          expired: typeof us.expired === 'boolean' ? us.expired : undefined,
        }
      : { hasToken: false }

  const uss = raw.upstoxStatusState
  const upstoxStatusState: SettingsPageUpstoxState =
    uss === 'checking' || uss === 'connected' || uss === 'missing' || uss === 'expired' ? uss : 'missing'

  const accounts = Array.isArray(raw.accounts) ? (raw.accounts as AccountRow[]) : []
  const creditSources = Array.isArray(raw.creditSources) ? (raw.creditSources as CreditSourceRow[]) : []
  const goldResources = Array.isArray(raw.goldResources) ? (raw.goldResources as GoldResource[]) : undefined

  return {
    fetchedAt: raw.fetchedAt,
    settingsFields: out,
    fintrackerDraft,
    settingsDraft,
    profile,
    upstoxStatus,
    upstoxStatusState,
    accounts,
    creditSources,
    goldResources,
  }
}

export function readSettingsPageCache(): SettingsPageCachePayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(FINTRACKER_SETTINGS_PAGE_CACHE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as unknown
    return parsePayload(j)
  } catch {
    return null
  }
}

export function mergeWriteSettingsPageCache(
  partial: Partial<Omit<SettingsPageCachePayload, 'fetchedAt'>> & { fetchedAt?: number },
): void {
  if (typeof window === 'undefined') return
  try {
    const prev = readSettingsPageCache()
    const defaultFin: FintrackerPrefs = {
      expenseCycle: { ...DEFAULT_FINTRACKER_PREFS.expenseCycle },
    }
    const next: SettingsPageCachePayload = {
      fetchedAt: partial.fetchedAt ?? Date.now(),
      settingsFields:
        partial.settingsFields !== undefined ? partial.settingsFields : prev?.settingsFields ?? {},
      fintrackerDraft:
        partial.fintrackerDraft !== undefined ? partial.fintrackerDraft : prev?.fintrackerDraft ?? defaultFin,
      settingsDraft:
        partial.settingsDraft !== undefined ? partial.settingsDraft : prev?.settingsDraft ?? { currency: 'INR', roundOff: true },
      profile: partial.profile !== undefined ? partial.profile : prev?.profile ?? null,
      upstoxStatus: partial.upstoxStatus !== undefined ? partial.upstoxStatus : prev?.upstoxStatus ?? { hasToken: false },
      upstoxStatusState:
        partial.upstoxStatusState !== undefined ? partial.upstoxStatusState : prev?.upstoxStatusState ?? 'missing',
      accounts: partial.accounts !== undefined ? partial.accounts : prev?.accounts ?? [],
      creditSources: partial.creditSources !== undefined ? partial.creditSources : prev?.creditSources ?? [],
      goldResources: partial.goldResources !== undefined ? partial.goldResources : prev?.goldResources,
    }
    sessionStorage.setItem(FINTRACKER_SETTINGS_PAGE_CACHE_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}

export function clearSettingsPageCache(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(FINTRACKER_SETTINGS_PAGE_CACHE_KEY)
  } catch {
    /* */
  }
}
