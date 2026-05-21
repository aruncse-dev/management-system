import type { IntegrationProvider } from './schema/integrations'
import { decryptSensitiveField } from './sensitiveFieldCrypto'

/** Env keys for a provider slug, e.g. INTEGRATION_UPSTOX_CLIENT_ID */
export function integrationCredentialEnvKeys(slug: string): {
  clientIdKey: string
  clientSecretKey: string
} {
  const upper = slug.replace(/[^a-z0-9]/gi, '_').toUpperCase()
  return {
    clientIdKey: `INTEGRATION_${upper}_CLIENT_ID`,
    clientSecretKey: `INTEGRATION_${upper}_CLIENT_SECRET`,
  }
}

function readEnvClientId(slug: string): string {
  const { clientIdKey } = integrationCredentialEnvKeys(slug)
  let clientId = process.env[clientIdKey]?.trim() || ''
  if (slug === 'upstox') {
    clientId = clientId || process.env.UPSTOX_CLIENT_ID?.trim() || ''
  }
  return clientId
}

function readEnvClientSecret(slug: string): string {
  const { clientSecretKey } = integrationCredentialEnvKeys(slug)
  let clientSecret = process.env[clientSecretKey]?.trim() || ''
  if (slug === 'upstox') {
    clientSecret = clientSecret || process.env.UPSTOX_CLIENT_SECRET?.trim() || ''
  }
  return clientSecret
}

/** Both env vars set (used for optional DB seed). */
export function readIntegrationCredentialsFromEnv(
  slug: string,
): { clientId: string; clientSecret: string } | null {
  const clientId = readEnvClientId(slug)
  const clientSecret = readEnvClientSecret(slug)
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

/**
 * OAuth client credentials per field: env if set, otherwise Admin DB.
 * Each provider slug has its own env pair (INTEGRATION_<SLUG>_CLIENT_ID / _CLIENT_SECRET).
 */
export async function resolveIntegrationProviderCredentials(
  provider: Pick<IntegrationProvider, 'slug' | 'clientId' | 'clientSecretEnc'>,
): Promise<{ clientId: string; clientSecret: string } | null> {
  const clientId = readEnvClientId(provider.slug) || provider.clientId?.trim() || ''
  if (!clientId) return null

  let clientSecret = readEnvClientSecret(provider.slug)
  if (!clientSecret && provider.clientSecretEnc?.trim()) {
    try {
      clientSecret = decryptSensitiveField(provider.clientSecretEnc)
    } catch {
      clientSecret = ''
    }
  }

  if (!clientSecret) return null
  return { clientId, clientSecret }
}

export function integrationHasCredentials(
  provider: Pick<IntegrationProvider, 'slug' | 'clientId' | 'clientSecretEnc'>,
): boolean {
  const clientId = readEnvClientId(provider.slug) || provider.clientId?.trim() || ''
  if (!clientId) return false
  if (readEnvClientSecret(provider.slug)) return true
  return Boolean(provider.clientSecretEnc?.trim())
}

/** Keys that must not live in endpoints JSON (redirect is env or dynamic). */
export const INTEGRATION_ENDPOINT_RESERVED_KEYS = new Set([
  'redirect',
  'redirect_uri',
  'redirecturi',
])

/** One callback route for all providers — same redirect URI across integrations. */
export const INTEGRATION_OAUTH_REDIRECT_ENV = 'INTEGRATION_OAUTH_REDIRECT_URI'

export type OAuthRedirectHeaders = {
  host?: string
  'x-forwarded-host'?: string | string[]
  'x-forwarded-proto'?: string | string[]
}

export function defaultIntegrationRedirectUri(): string {
  const base = (
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/+$/, '')
  return `${base}/api/integrations/oauth/callback`
}

function readEnvRedirectUri(): string {
  return (
    process.env[INTEGRATION_OAUTH_REDIRECT_ENV]?.trim() ||
    process.env.UPSTOX_REDIRECT_URI?.trim() ||
    ''
  )
}

function redirectUriFromRequest(headers?: OAuthRedirectHeaders): string | null {
  const forwardedHost = headers?.['x-forwarded-host']
  const hostRaw =
    typeof forwardedHost === 'string'
      ? forwardedHost.split(',')[0]?.trim()
      : Array.isArray(forwardedHost)
        ? forwardedHost[0]?.trim()
        : headers?.host?.split(',')[0]?.trim()

  if (!hostRaw) return null

  const protoHeader = headers?.['x-forwarded-proto']
  const protoRaw =
    typeof protoHeader === 'string'
      ? protoHeader.split(',')[0]?.trim()
      : Array.isArray(protoHeader)
        ? protoHeader[0]?.trim()
        : undefined
  const proto =
    protoRaw === 'https' || protoRaw === 'http'
      ? protoRaw
      : hostRaw.includes('localhost') || hostRaw.startsWith('127.') || hostRaw.startsWith('0.0.0.0')
        ? 'http'
        : 'https'
  return `${proto}://${hostRaw}/api/integrations/oauth/callback`
}

/**
 * Shared OAuth redirect for every integration (/api/integrations/oauth/callback).
 * INTEGRATION_OAUTH_REDIRECT_URI if set, else request host, else APP_PUBLIC_URL default.
 */
export function resolveIntegrationOAuthRedirectUri(headers?: OAuthRedirectHeaders): string {
  const fromEnv = readEnvRedirectUri()
  if (fromEnv) return fromEnv
  return redirectUriFromRequest(headers) || defaultIntegrationRedirectUri()
}
