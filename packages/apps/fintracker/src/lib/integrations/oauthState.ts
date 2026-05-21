import { createHmac, timingSafeEqual } from 'node:crypto'

const STATE_TTL_MS = 15 * 60 * 1000

function stateSecret(): string {
  const s = process.env.SESSION_SECRET?.trim()
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set (32+ characters) for OAuth state signing')
  }
  return s
}

export type IntegrationOAuthState = {
  orgId: string
  provider: string
  exp: number
}

export function signIntegrationOAuthState(payload: IntegrationOAuthState): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', stateSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyIntegrationOAuthState(raw: string): IntegrationOAuthState | null {
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = createHmac('sha256', stateSecret()).update(body).digest('base64url')
  try {
    const a = Buffer.from(sig, 'base64url')
    const b = Buffer.from(expected, 'base64url')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as IntegrationOAuthState
    if (!payload.orgId || !payload.provider || typeof payload.exp !== 'number') return null
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function newIntegrationOAuthState(orgId: string, provider: string): IntegrationOAuthState {
  return { orgId, provider, exp: Date.now() + STATE_TTL_MS }
}
