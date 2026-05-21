import type { IntegrationProvider } from './schema/integrations'
import { INTEGRATION_ENDPOINT_RESERVED_KEYS, integrationHasCredentials } from './integrationCredentials'

export type IntegrationEndpoints = Record<string, string>
export type IntegrationAppMenus = Record<string, string[]>

export type IntegrationActions = {
  login: boolean
  syncStocks: boolean
  syncMutualFunds: boolean
}

export const UPSTOX_DEFAULT_ENDPOINTS: IntegrationEndpoints = {
  auth: 'https://api.upstox.com/v2/login/authorization/dialog',
  token: 'https://api.upstox.com/v2/login/authorization/token',
  apiBase: 'https://api.upstox.com/v2',
  stocksHoldings: '/portfolio/long-term-holdings',
  mfHoldings: '/mf/holdings',
}

export const UPSTOX_DEFAULT_APP_MENUS: IntegrationAppMenus = {
  fintracker: ['investments'],
  vault: [],
  staff: [],
}

export function slugFromIntegrationName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s || 'integration'
}

export function parseEndpoints(raw: unknown): IntegrationEndpoints {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: IntegrationEndpoints = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim()
    if (!key || INTEGRATION_ENDPOINT_RESERVED_KEYS.has(key.toLowerCase())) continue
    if (typeof v === 'string' && v.trim()) out[key] = v.trim()
  }
  return out
}

export function parseAppMenus(raw: unknown): IntegrationAppMenus {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: IntegrationAppMenus = {}
  for (const [app, menus] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(menus)) {
      out[app] = menus.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    }
  }
  return out
}

export function getEndpoint(provider: { endpoints: unknown }, key: string): string | undefined {
  return parseEndpoints(provider.endpoints)[key]
}

/** Resolve full URL: absolute URLs pass through; paths join apiBase. */
export function resolveEndpointUrl(provider: { endpoints: unknown }, key: string): string | undefined {
  const endpoints = parseEndpoints(provider.endpoints)
  const value = endpoints[key]
  if (!value) return undefined
  if (/^https?:\/\//i.test(value)) return value
  const base = (endpoints.apiBase || '').replace(/\/+$/, '')
  if (!base) return value.startsWith('/') ? value : `/${value}`
  const path = value.startsWith('/') ? value : `/${value}`
  return `${base}${path}`
}

export function providerSupportsApp(provider: { appMenus: unknown }, appSlug: string): boolean {
  const menus = parseAppMenus(provider.appMenus)[appSlug] ?? []
  return menus.length > 0
}

export function deriveIntegrationActions(provider: {
  slug?: string
  endpoints: unknown
  clientId?: string | null
  clientSecretEnc?: string | null
}): IntegrationActions {
  const endpoints = parseEndpoints(provider.endpoints)
  const hasAuth = Boolean(endpoints.auth?.trim() && endpoints.token?.trim())
  const hasCreds = provider.slug
    ? integrationHasCredentials({
        slug: provider.slug,
        clientId: provider.clientId ?? '',
        clientSecretEnc: provider.clientSecretEnc ?? '',
      })
    : Boolean(provider.clientId?.trim() && provider.clientSecretEnc?.trim())
  return {
    login: hasAuth && hasCreds,
    syncStocks: Boolean(endpoints.stocksHoldings?.trim() || resolveEndpointUrl(provider, 'stocksHoldings')),
    syncMutualFunds: Boolean(endpoints.mfHoldings?.trim() || resolveEndpointUrl(provider, 'mfHoldings')),
  }
}

export function endpointsFromRows(rows: { key: string; url: string }[]): IntegrationEndpoints {
  const out: IntegrationEndpoints = {}
  for (const { key, url } of rows) {
    const k = key.trim()
    const u = url.trim()
    if (!k || !u || INTEGRATION_ENDPOINT_RESERVED_KEYS.has(k.toLowerCase())) continue
    out[k] = u
  }
  return out
}

export function endpointsToRows(endpoints: IntegrationEndpoints): { key: string; url: string }[] {
  return Object.entries(endpoints).map(([key, url]) => ({ key, url }))
}

export function defaultEndpointsForName(name: string): IntegrationEndpoints {
  if (slugFromIntegrationName(name) === 'upstox') return { ...UPSTOX_DEFAULT_ENDPOINTS }
  return {}
}

export function defaultAppMenusForName(name: string): IntegrationAppMenus {
  if (slugFromIntegrationName(name) === 'upstox') return { ...UPSTOX_DEFAULT_APP_MENUS }
  return { fintracker: [], vault: [], staff: [] }
}

export type ProviderRow = IntegrationProvider
