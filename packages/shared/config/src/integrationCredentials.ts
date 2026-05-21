/** Client-safe env key names for integration OAuth. */

export const INTEGRATION_OAUTH_REDIRECT_ENV = 'INTEGRATION_OAUTH_REDIRECT_URI'

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

export function integrationOAuthEnvHint(slug: string): string {
  const { clientIdKey, clientSecretKey } = integrationCredentialEnvKeys(slug)
  const legacy =
    slug === 'upstox'
      ? ' Legacy: UPSTOX_CLIENT_ID, UPSTOX_CLIENT_SECRET, UPSTOX_REDIRECT_URI.'
      : ''
  return `Credentials (this provider): ${clientIdKey}, ${clientSecretKey}. Redirect (same for all integrations): ${INTEGRATION_OAUTH_REDIRECT_ENV} or auto from app URL (/api/integrations/oauth/callback).${legacy}`
}
