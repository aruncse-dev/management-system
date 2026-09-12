import { and, asc, eq } from 'drizzle-orm'
import { decryptSensitiveField, encryptSensitiveField } from './sensitiveFieldCrypto'
import {
  deriveIntegrationActions,
  parseAppMenus,
  parseEndpoints,
  providerSupportsApp,
  type IntegrationActions,
  type IntegrationAppMenus,
  type IntegrationEndpoints,
} from './integrationProviderUtils'
import { getDb } from './neon'
import { integrationProviders, orgIntegrations } from './schema/integrations'
import { organizations } from './schema/orgs'
import { STATIC_APPS, type AppSlug } from './adminStaticData'

export type { IntegrationActions, IntegrationAppMenus, IntegrationEndpoints }
export {
  slugFromIntegrationName,
  parseEndpoints,
  parseAppMenus,
  getEndpoint,
  resolveEndpointUrl,
  providerSupportsApp,
  deriveIntegrationActions,
  endpointsFromRows,
  endpointsToRows,
  defaultEndpointsForName,
  defaultAppMenusForName,
  UPSTOX_DEFAULT_ENDPOINTS,
  UPSTOX_DEFAULT_APP_MENUS,
} from './integrationProviderUtils'

export type ResolvedIntegrationProvider = {
  slug: string
  name: string
  menuSlugs: string[]
  actions: IntegrationActions
}

export type IntegrationConnectionStatus = {
  slug: string
  name: string
  menuSlugs: string[]
  actions: IntegrationActions
  status: 'disconnected' | 'connected' | 'expired' | 'error'
  hasToken: boolean
  accessTokenExpiry?: string
  expired?: boolean
  connectedByEmail?: string
  lastSyncAt?: string
  lastError?: string
}

export {
  defaultIntegrationRedirectUri,
  resolveIntegrationOAuthRedirectUri,
  type OAuthRedirectHeaders,
} from './integrationCredentials'

export async function getOrgIntegrationConfig(orgId: string): Promise<Record<string, string[]>> {
  const db = getDb()
  const [org] = await db
    .select({ enabledIntegrations: organizations.enabledIntegrations })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  return (org?.enabledIntegrations as Record<string, string[]>) ?? {}
}

export async function setOrgEnabledIntegrationIds(
  orgId: string,
  enabledSlugs: string[],
  appSlug: string,
): Promise<void> {
  const db = getDb()
  const mapped = await listIntegrationsForApp(appSlug)
  const mappedSet = new Set(mapped.map((r) => r.slug))
  const validIds = enabledSlugs.filter((id) => mappedSet.has(id))

  const [org] = await db
    .select({ enabledIntegrations: organizations.enabledIntegrations })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  if (!org) throw new Error(`Organization not found: ${orgId}`)

  const enabledIntegrations = (org.enabledIntegrations as Record<string, string[]>) ?? {}
  enabledIntegrations[appSlug] = validIds

  await db
    .update(organizations)
    .set({ enabledIntegrations: enabledIntegrations as Record<string, string[]>, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

function toResolved(
  row: typeof integrationProviders.$inferSelect,
  appSlug: string,
): ResolvedIntegrationProvider {
  const menuSlugs = parseAppMenus(row.appMenus)[appSlug] ?? []
  return {
    slug: row.slug,
    name: row.name,
    menuSlugs,
    actions: deriveIntegrationActions(row),
  }
}

export async function listIntegrationsForApp(appSlug: string) {
  const db = getDb()
  const rows = await db
    .select()
    .from(integrationProviders)
    .where(eq(integrationProviders.status, 'active'))
    .orderBy(asc(integrationProviders.name))

  return rows.filter((r) => providerSupportsApp(r, appSlug))
}

export async function getEnabledOrgIntegrations(
  orgId: string,
  appSlug: string,
): Promise<ResolvedIntegrationProvider[]> {
  const config = await getOrgIntegrationConfig(orgId)
  const enabled = new Set(config[appSlug] ?? [])
  if (enabled.size === 0) return []

  const rows = await listIntegrationsForApp(appSlug)
  return rows.filter((r) => enabled.has(r.slug)).map((r) => toResolved(r, appSlug))
}

export async function getOrgIntegrationEditorStateForApp(
  orgId: string,
  appSlug: string,
): Promise<{ slug: string; name: string; menuSlugs: string[]; enabled: boolean }[]> {
  const config = await getOrgIntegrationConfig(orgId)
  const enabledSet = new Set(config[appSlug] ?? [])
  const rows = await listIntegrationsForApp(appSlug)

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    menuSlugs: parseAppMenus(r.appMenus)[appSlug] ?? [],
    enabled: enabledSet.has(r.slug),
  }))
}

export async function getOrgIntegrationEditorState(
  orgId: string,
  appSlug?: string,
): Promise<{ slug: string; name: string; menuSlugs: string[]; enabled: boolean }[]> {
  if (appSlug) return getOrgIntegrationEditorStateForApp(orgId, appSlug)
  const config = await getOrgIntegrationConfig(orgId)
  const db = getDb()
  const rows = await db
    .select()
    .from(integrationProviders)
    .where(eq(integrationProviders.status, 'active'))
    .orderBy(asc(integrationProviders.name))

  const enabledSet = new Set<string>()
  for (const app of STATIC_APPS) {
    for (const slug of config[app] ?? []) enabledSet.add(slug)
  }

  return rows
    .filter((r) => STATIC_APPS.some((app) => providerSupportsApp(r, app)))
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      menuSlugs: [],
      enabled: enabledSet.has(r.slug),
    }))
}

export async function getIntegrationProviderBySlug(slug: string) {
  const db = getDb()
  const [row] = await db
    .select()
    .from(integrationProviders)
    .where(eq(integrationProviders.slug, slug))
    .limit(1)
  return row ?? null
}

export async function listIntegrationProviders() {
  const db = getDb()
  return db.select().from(integrationProviders).orderBy(asc(integrationProviders.name))
}

export async function getOrgIntegrationRow(orgId: string, providerSlug: string) {
  const db = getDb()
  const [row] = await db
    .select()
    .from(orgIntegrations)
    .where(and(eq(orgIntegrations.orgId, orgId), eq(orgIntegrations.providerSlug, providerSlug)))
    .limit(1)
  return row ?? null
}

export async function getOrgIntegrationAccessToken(
  orgId: string,
  providerSlug: string,
): Promise<string | null> {
  const row = await getOrgIntegrationRow(orgId, providerSlug)
  if (!row?.accessTokenEnc) return null
  if (row.tokenExpiresAt && row.tokenExpiresAt < new Date()) return null
  try {
    return decryptSensitiveField(row.accessTokenEnc)
  } catch {
    return null
  }
}

export function buildIntegrationConnectionStatus(
  provider: typeof integrationProviders.$inferSelect,
  row: typeof orgIntegrations.$inferSelect | null,
  appSlug = 'fintracker',
): IntegrationConnectionStatus {
  const menuSlugs = parseAppMenus(provider.appMenus)[appSlug] ?? []
  const actions = deriveIntegrationActions(provider)
  if (!row || !row.accessTokenEnc) {
    return {
      slug: provider.slug,
      name: provider.name,
      menuSlugs,
      actions,
      status: 'disconnected',
      hasToken: false,
    }
  }
  const expired = row.tokenExpiresAt ? row.tokenExpiresAt < new Date() : false
  const status = expired ? 'expired' : row.status === 'error' ? 'error' : 'connected'
  return {
    slug: provider.slug,
    name: provider.name,
    menuSlugs,
    actions,
    status,
    hasToken: !expired && row.status === 'connected',
    accessTokenExpiry: row.tokenExpiresAt?.toISOString(),
    expired,
    connectedByEmail: row.connectedByEmail ?? undefined,
    lastSyncAt: row.lastSyncAt?.toISOString(),
    lastError: row.lastError ?? undefined,
  }
}

export async function getIntegrationStatusForOrg(
  orgId: string,
  providerSlug: string,
  appSlug = 'fintracker',
): Promise<IntegrationConnectionStatus | null> {
  const provider = await getIntegrationProviderBySlug(providerSlug)
  if (!provider) return null
  const row = await getOrgIntegrationRow(orgId, providerSlug)
  return buildIntegrationConnectionStatus(provider, row, appSlug)
}

export async function saveOrgIntegrationToken(opts: {
  orgId: string
  providerSlug: string
  accessToken: string
  tokenExpiresAt: Date
  connectedByEmail: string
  refreshToken?: string | null
}): Promise<void> {
  const db = getDb()
  const now = new Date()
  const enc = encryptSensitiveField(opts.accessToken)
  const refreshEnc =
    opts.refreshToken?.trim() ? encryptSensitiveField(opts.refreshToken.trim()) : undefined
  const existing = await getOrgIntegrationRow(opts.orgId, opts.providerSlug)
  if (existing) {
    await db
      .update(orgIntegrations)
      .set({
        status: 'connected',
        accessTokenEnc: enc,
        ...(refreshEnc !== undefined ? { refreshTokenEnc: refreshEnc } : {}),
        tokenExpiresAt: opts.tokenExpiresAt,
        connectedByEmail: opts.connectedByEmail,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(orgIntegrations.id, existing.id))
  } else {
    await db.insert(orgIntegrations).values({
      id: crypto.randomUUID(),
      orgId: opts.orgId,
      providerSlug: opts.providerSlug,
      status: 'connected',
      accessTokenEnc: enc,
      refreshTokenEnc: refreshEnc ?? null,
      tokenExpiresAt: opts.tokenExpiresAt,
      connectedByEmail: opts.connectedByEmail,
      createdAt: now,
      updatedAt: now,
    })
  }
}

export async function clearOrgIntegrationConnection(orgId: string, providerSlug: string): Promise<void> {
  const db = getDb()
  const existing = await getOrgIntegrationRow(orgId, providerSlug)
  if (!existing) return
  await db
    .update(orgIntegrations)
    .set({
      status: 'disconnected',
      accessTokenEnc: null,
      refreshTokenEnc: null,
      tokenExpiresAt: null,
      connectedByEmail: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(orgIntegrations.id, existing.id))
}

export async function markOrgIntegrationSync(
  orgId: string,
  providerSlug: string,
  error?: string,
  /**
   * The provider rejected the token (401). Expire it now rather than leaving a
   * future `token_expires_at`, which made Settings read "Connected" while every
   * sync failed.
   */
  expireToken = false,
): Promise<void> {
  const db = getDb()
  const existing = await getOrgIntegrationRow(orgId, providerSlug)
  if (!existing) return
  await db
    .update(orgIntegrations)
    .set({
      lastSyncAt: error ? existing.lastSyncAt : new Date(),
      lastError: error ?? null,
      status: error ? 'error' : existing.status,
      ...(expireToken ? { tokenExpiresAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orgIntegrations.id, existing.id))
}

/** Legacy env bootstrap — optional; prefer Admin UI. */
export async function seedUpstoxProviderIfMissing(): Promise<void> {
  const existing = await getIntegrationProviderBySlug('upstox')
  if (existing) return

  const { readIntegrationCredentialsFromEnv } = await import('./integrationCredentials')
  const creds = readIntegrationCredentialsFromEnv('upstox')
  if (!creds) return
  const { clientId, clientSecret } = creds

  let secretEnc: string
  try {
    secretEnc = encryptSensitiveField(clientSecret)
  } catch {
    return
  }

  const { UPSTOX_DEFAULT_ENDPOINTS, UPSTOX_DEFAULT_APP_MENUS } = await import('./integrationProviderUtils')
  const db = getDb()
  const now = new Date()
  await db.insert(integrationProviders).values({
    slug: 'upstox',
    name: 'Upstox',
    status: 'active',
    clientId,
    clientSecretEnc: secretEnc,
    endpoints: UPSTOX_DEFAULT_ENDPOINTS,
    appMenus: UPSTOX_DEFAULT_APP_MENUS,
    createdAt: now,
    updatedAt: now,
  })
}

export type { AppSlug }
