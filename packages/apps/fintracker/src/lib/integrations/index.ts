import {
  clearOrgIntegrationConnection,
  decryptSensitiveField,
  getDb,
  getEnabledOrgIntegrations,
  getIntegrationProviderBySlug,
  getIntegrationStatusForOrg,
  getOrgIntegrationAccessToken,
  getOrgIntegrationRow,
  resolveIntegrationOAuthRedirectUri,
  resolveIntegrationProviderCredentials,
  resolveEndpointUrl,
  saveOrgIntegrationToken,
  syncMutualFundHoldings,
  syncStockHoldings,
  type IntegrationConnectionStatus,
  type OAuthRedirectHeaders,
  markOrgIntegrationSync,
} from '@fintracker-vault/db'
import { listOrgsForUserEmail } from '@fintracker-vault/db'
import {
  buildUpstoxAuthUrl,
  exchangeUpstoxCode,
  fetchUpstoxMutualFundHoldings,
  fetchUpstoxStockHoldings,
  refreshUpstoxAccessToken,
} from './providers/upstox'
import { newIntegrationOAuthState, signIntegrationOAuthState } from './oauthState'

export type { IntegrationConnectionStatus }

export async function requireOrgIdForIntegrations(
  email: string,
  sessionOrgId: string | undefined,
): Promise<string | null> {
  const oid = sessionOrgId?.trim()
  if (!oid) return null
  const orgs = await listOrgsForUserEmail(email)
  if (!orgs.some((o) => o.id === oid)) return null
  return oid
}

export async function isProviderEnabledForOrg(orgId: string, appSlug: string, providerSlug: string): Promise<boolean> {
  const enabled = await getEnabledOrgIntegrations(orgId, appSlug)
  return enabled.some((p) => p.slug === providerSlug)
}

export async function getIntegrationAuthUrl(
  orgId: string,
  providerSlug: string,
  headers?: OAuthRedirectHeaders,
): Promise<{ url: string; redirectUri: string } | null> {
  const provider = await getIntegrationProviderBySlug(providerSlug)
  if (!provider || provider.status !== 'active') return null

  const enabled = await isProviderEnabledForOrg(orgId, 'fintracker', providerSlug)
  if (!enabled) return null

  const authUrl = resolveEndpointUrl(provider, 'auth')
  if (!authUrl) return null

  const creds = await resolveIntegrationProviderCredentials(provider)
  if (!creds) return null

  const redirectUri = resolveIntegrationOAuthRedirectUri(headers)
  const state = signIntegrationOAuthState(newIntegrationOAuthState(orgId, providerSlug))

  if (providerSlug === 'upstox') {
    const url = buildUpstoxAuthUrl({
      authUrl,
      clientId: creds.clientId,
      redirectUri,
      state,
    })
    return { url, redirectUri }
  }

  return null
}

export async function completeIntegrationOAuth(opts: {
  orgId: string
  providerSlug: string
  code: string
  connectedByEmail: string
  headers?: OAuthRedirectHeaders
}): Promise<void> {
  const provider = await getIntegrationProviderBySlug(opts.providerSlug)
  if (!provider || provider.status !== 'active') {
    throw new Error('Provider not available')
  }

  const tokenUrl = resolveEndpointUrl(provider, 'token')
  if (!tokenUrl) throw new Error('Token endpoint not configured')

  const creds = await resolveIntegrationProviderCredentials(provider)
  if (!creds) throw new Error('Integration API credentials not configured')

  const redirectUri = resolveIntegrationOAuthRedirectUri(opts.headers)

  if (opts.providerSlug === 'upstox') {
    const { accessToken, expiresAt, refreshToken } = await exchangeUpstoxCode({
      tokenUrl,
      code: opts.code,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      redirectUri,
    })
    await saveOrgIntegrationToken({
      orgId: opts.orgId,
      providerSlug: opts.providerSlug,
      accessToken,
      tokenExpiresAt: expiresAt,
      connectedByEmail: opts.connectedByEmail,
      refreshToken: refreshToken ?? null,
    })
    return
  }

  throw new Error(`Unsupported provider: ${opts.providerSlug}`)
}

export async function disconnectOrgIntegration(orgId: string, providerSlug: string): Promise<void> {
  await clearOrgIntegrationConnection(orgId, providerSlug)
}

export async function getIntegrationStatus(
  orgId: string,
  providerSlug: string,
): Promise<IntegrationConnectionStatus | null> {
  return getIntegrationStatusForOrg(orgId, providerSlug, 'fintracker')
}

export function connectionStatusToLegacyToken(status: IntegrationConnectionStatus | null) {
  if (!status) {
    return { hasToken: false, hasAccessToken: false as const }
  }
  return {
    hasToken: status.hasToken,
    hasAccessToken: status.status === 'connected' || status.status === 'expired',
    accessTokenExpiry: status.accessTokenExpiry,
    expired: status.expired,
  }
}

export async function syncAuthErrorForProvider(
  orgId: string,
  providerSlug: string,
): Promise<'REAUTH_REQUIRED' | 'TOKEN_EXPIRED' | null> {
  const status = await getIntegrationStatus(orgId, providerSlug)
  if (!status) return 'REAUTH_REQUIRED'
  if (status.expired) return 'TOKEN_EXPIRED'
  if (!status.hasToken) return 'REAUTH_REQUIRED'
  return null
}

const TOKEN_RENEW_BUFFER_MS = 5 * 60 * 1000

export type PortfolioSyncResult = {
  count: number
  syncedAt: string
  providers: string[]
}

export type PortfolioSyncAllResult = {
  stocks: PortfolioSyncResult
  mutualFunds: PortfolioSyncResult
}

function integrationHttpError(e: unknown): { status: number; msg: string } {
  const status = e && typeof e === 'object' && 'status' in e ? Number((e as { status?: number }).status) : 0
  const msg = e instanceof Error ? e.message : 'Sync failed'
  return { status, msg }
}

/** Renew access token via refresh_token when provider supports it (best-effort). */
export async function renewIntegrationAccessToken(
  orgId: string,
  providerSlug: string,
): Promise<string | null> {
  const provider = await getIntegrationProviderBySlug(providerSlug)
  const row = await getOrgIntegrationRow(orgId, providerSlug)
  if (!provider || !row?.refreshTokenEnc) return null

  const tokenUrl = resolveEndpointUrl(provider, 'token')
  if (!tokenUrl) return null

  const creds = await resolveIntegrationProviderCredentials(provider)
  if (!creds) return null

  let refreshToken: string
  try {
    refreshToken = decryptSensitiveField(row.refreshTokenEnc)
  } catch {
    return null
  }
  if (!refreshToken) return null

  if (providerSlug === 'upstox') {
    const renewed = await refreshUpstoxAccessToken({
      tokenUrl,
      refreshToken,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    })
    if (!renewed) return null
    await saveOrgIntegrationToken({
      orgId,
      providerSlug,
      accessToken: renewed.accessToken,
      tokenExpiresAt: renewed.expiresAt,
      connectedByEmail: row.connectedByEmail ?? '',
      refreshToken: renewed.refreshToken ?? refreshToken,
    })
    return renewed.accessToken
  }

  return null
}

/** Valid access token for API calls; renews via refresh_token when close to expiry. */
export async function ensureAccessTokenForSync(orgId: string, providerSlug: string): Promise<string | null> {
  const row = await getOrgIntegrationRow(orgId, providerSlug)
  if (!row?.accessTokenEnc) return null

  const expiresAt = row.tokenExpiresAt?.getTime() ?? 0
  const stillValid = expiresAt > Date.now() + TOKEN_RENEW_BUFFER_MS
  if (stillValid) {
    return getOrgIntegrationAccessToken(orgId, providerSlug)
  }

  const renewed = await renewIntegrationAccessToken(orgId, providerSlug)
  if (renewed) return renewed

  return getOrgIntegrationAccessToken(orgId, providerSlug)
}

async function fetchStockRowsForProvider(
  orgId: string,
  slug: string,
  provider: NonNullable<Awaited<ReturnType<typeof getIntegrationProviderBySlug>>>,
): Promise<Awaited<ReturnType<typeof fetchUpstoxStockHoldings>>> {
  const holdingsUrl = resolveEndpointUrl(provider, 'stocksHoldings')
  if (!holdingsUrl) return []

  const token = await ensureAccessTokenForSync(orgId, slug)
  if (!token) {
    const err = await syncAuthErrorForProvider(orgId, slug)
    throw Object.assign(new Error(err ?? 'REAUTH_REQUIRED'), { code: err ?? 'REAUTH_REQUIRED' })
  }

  if (slug === 'upstox') {
    return fetchUpstoxStockHoldings(token, holdingsUrl)
  }
  return []
}

async function fetchMutualFundRowsForProvider(
  orgId: string,
  slug: string,
  provider: NonNullable<Awaited<ReturnType<typeof getIntegrationProviderBySlug>>>,
): Promise<Awaited<ReturnType<typeof fetchUpstoxMutualFundHoldings>>> {
  const mfUrl = resolveEndpointUrl(provider, 'mfHoldings')
  if (!mfUrl) return []

  const token = await ensureAccessTokenForSync(orgId, slug)
  if (!token) {
    const err = await syncAuthErrorForProvider(orgId, slug)
    throw Object.assign(new Error(err ?? 'REAUTH_REQUIRED'), { code: err ?? 'REAUTH_REQUIRED' })
  }

  if (slug === 'upstox') {
    return fetchUpstoxMutualFundHoldings(token, mfUrl)
  }
  return []
}

export async function syncOrgStocksFromIntegrations(orgId: string): Promise<PortfolioSyncResult> {
  const db = getDb()
  const enabled = await getEnabledOrgIntegrations(orgId, 'fintracker')
  let total = 0
  let lastSynced = new Date()
  const syncedProviders: string[] = []

  for (const entry of enabled) {
    if (!entry.actions.syncStocks) continue
    const provider = await getIntegrationProviderBySlug(entry.slug)
    if (!provider) continue
    const holdingsUrl = resolveEndpointUrl(provider, 'stocksHoldings')
    if (!holdingsUrl) continue

    try {
      const rows = await fetchStockRowsForProvider(orgId, entry.slug, provider)
      const { count, syncedAt } = await syncStockHoldings(db, orgId, entry.slug, rows)
      total += count
      lastSynced = syncedAt
      syncedProviders.push(entry.slug)
      await markOrgIntegrationSync(orgId, entry.slug)
    } catch (e) {
      const { status, msg } = integrationHttpError(e)
      await markOrgIntegrationSync(orgId, entry.slug, msg)
      if (status === 401) {
        throw Object.assign(new Error('TOKEN_EXPIRED'), { code: 'TOKEN_EXPIRED' })
      }
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
      if (code === 'REAUTH_REQUIRED' || code === 'TOKEN_EXPIRED') throw e
      throw e
    }
  }

  return { count: total, syncedAt: lastSynced.toISOString(), providers: syncedProviders }
}

export async function syncOrgMutualFundsFromIntegrations(orgId: string): Promise<PortfolioSyncResult> {
  const db = getDb()
  const enabled = await getEnabledOrgIntegrations(orgId, 'fintracker')
  let total = 0
  let lastSynced = new Date()
  const syncedProviders: string[] = []

  for (const entry of enabled) {
    if (!entry.actions.syncMutualFunds) continue
    const provider = await getIntegrationProviderBySlug(entry.slug)
    if (!provider) continue
    const mfUrl = resolveEndpointUrl(provider, 'mfHoldings')
    if (!mfUrl) continue

    try {
      const rows = await fetchMutualFundRowsForProvider(orgId, entry.slug, provider)
      const { count, syncedAt } = await syncMutualFundHoldings(db, orgId, entry.slug, rows)
      total += count
      lastSynced = syncedAt
      syncedProviders.push(entry.slug)
      await markOrgIntegrationSync(orgId, entry.slug)
    } catch (e) {
      const { status, msg } = integrationHttpError(e)
      await markOrgIntegrationSync(orgId, entry.slug, msg)
      if (status === 401) {
        throw Object.assign(new Error('TOKEN_EXPIRED'), { code: 'TOKEN_EXPIRED' })
      }
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
      if (code === 'REAUTH_REQUIRED' || code === 'TOKEN_EXPIRED') throw e
      throw e
    }
  }

  return { count: total, syncedAt: lastSynced.toISOString(), providers: syncedProviders }
}

/** Sync stocks + mutual funds from every enabled integration with holdings endpoints. */
export async function syncOrgPortfolioFromIntegrations(orgId: string): Promise<PortfolioSyncAllResult> {
  const stocks = await syncOrgStocksFromIntegrations(orgId)
  const mutualFunds = await syncOrgMutualFundsFromIntegrations(orgId)
  return { stocks, mutualFunds }
}

export { getEnabledOrgIntegrations }
