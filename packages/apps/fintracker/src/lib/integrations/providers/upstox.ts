import {
  normalizeMutualFundHoldingsPayload,
  type MutualFundHoldingInput,
} from '@fintracker-vault/db'

type ApiRow = Record<string, unknown>

function numStr(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : null
}

export function buildUpstoxAuthUrl(opts: {
  authUrl: string
  clientId: string
  redirectUri: string
  state: string
}): string {
  const base = opts.authUrl.replace(/\?.*$/, '')
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    state: opts.state,
  })
  return `${base}?${params.toString()}`
}

export async function exchangeUpstoxCode(opts: {
  tokenUrl: string
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<{ accessToken: string; expiresAt: Date; refreshToken?: string }> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch(opts.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const msg =
      typeof json.message === 'string' ? json.message : typeof json.error === 'string' ? json.error : 'Token exchange failed'
    throw new Error(msg)
  }

  const accessToken = typeof json.access_token === 'string' ? json.access_token : ''
  if (!accessToken) throw new Error('No access_token in Upstox response')

  const refreshToken =
    typeof json.refresh_token === 'string' && json.refresh_token.trim()
      ? json.refresh_token.trim()
      : undefined

  const expiresIn = Number(json.expires_in)
  const expiresAt = new Date()
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn)
  } else {
    expiresAt.setHours(expiresAt.getHours() + 24)
  }

  return { accessToken, expiresAt, refreshToken }
}

/** Upstox does not document refresh_token grant; use when provider adds refresh support. */
export async function refreshUpstoxAccessToken(opts: {
  tokenUrl: string
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ accessToken: string; expiresAt: Date; refreshToken?: string } | null> {
  const body = new URLSearchParams({
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    grant_type: 'refresh_token',
  })

  const res = await fetch(opts.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) return null

  const accessToken = typeof json.access_token === 'string' ? json.access_token : ''
  if (!accessToken) return null

  const refreshToken =
    typeof json.refresh_token === 'string' && json.refresh_token.trim()
      ? json.refresh_token.trim()
      : opts.refreshToken

  const expiresIn = Number(json.expires_in)
  const expiresAt = new Date()
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn)
  } else {
    expiresAt.setHours(expiresAt.getHours() + 24)
  }

  return { accessToken, expiresAt, refreshToken }
}

async function upstoxGet<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const msg = typeof json.message === 'string' ? json.message : `Upstox API error (${res.status})`
    const err = new Error(msg) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return json as T
}

export async function fetchUpstoxStockHoldings(accessToken: string, holdingsUrl: string) {
  const payload = await upstoxGet<{ data?: ApiRow[] }>(holdingsUrl, accessToken)
  const data = Array.isArray(payload.data) ? payload.data : []
  return data
    .map((row) => {
      const isin = String(row.isin ?? '').trim()
      const symbol = String(row.trading_symbol ?? row.symbol ?? isin).trim()
      if (!isin && !symbol) return null
      return {
        symbol: symbol || isin,
        company: row.company_name != null ? String(row.company_name) : null,
        isin: isin || symbol,
        qty: numStr(row.quantity) ?? '0',
        avgPrice: numStr(row.average_price),
        lastPrice: numStr(row.last_price),
        pnl: numStr(row.pnl),
        dayChangePct: numStr(row.day_change_percentage),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
}

export async function fetchUpstoxMutualFundHoldings(
  accessToken: string,
  mfUrl: string,
): Promise<MutualFundHoldingInput[]> {
  const payload = await upstoxGet<{ data?: unknown }>(mfUrl, accessToken)
  return normalizeMutualFundHoldingsPayload(payload.data)
}

export type { MutualFundHoldingInput }
