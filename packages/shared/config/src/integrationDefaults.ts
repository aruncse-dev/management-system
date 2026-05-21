/** Client-safe integration templates (no DB/crypto). Server uses @fintracker-vault/db for the same values. */

export type IntegrationEndpoints = Record<string, string>
export type IntegrationAppMenus = Record<string, string[]>

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

export function defaultEndpointsForName(name: string): IntegrationEndpoints {
  if (slugFromIntegrationName(name) === 'upstox') return { ...UPSTOX_DEFAULT_ENDPOINTS }
  return {}
}

export function defaultAppMenusForName(name: string): IntegrationAppMenus {
  if (slugFromIntegrationName(name) === 'upstox') return { ...UPSTOX_DEFAULT_APP_MENUS }
  return { fintracker: [], vault: [], staff: [] }
}
