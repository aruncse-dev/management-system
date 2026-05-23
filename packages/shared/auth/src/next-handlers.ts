import type { NextApiRequest, NextApiResponse } from 'next'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getIronSession } from 'iron-session'
import type { FtSessionData } from './session'
import type { GetFtSessionOptions } from './session'

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

type GoogleAuthHooks = {
  onVerified?: (args: { email: string; displayName?: string }) => Promise<
    | { allowed: true }
    | { allowed: false; error?: string; statusCode?: number }
  >
  /** Called after verification, before the session cookie is written (e.g. set `activeOrgId`). */
  prepareSession?: (args: { email: string; session: FtSessionData }) => Promise<void>
}

export async function handleGoogleAuthPost(
  req: NextApiRequest,
  res: NextApiResponse,
  getSessionOptions: GetFtSessionOptions,
  hooks?: GoogleAuthHooks,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let sessionOptions
  try {
    sessionOptions = getSessionOptions()
  } catch {
    return res.status(503).json({ ok: false, error: 'Auth not configured' })
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
  const credential = typeof (body as { credential?: unknown }).credential === 'string'
    ? (body as { credential: string }).credential
    : ''
  if (!credential) {
    return res.status(400).json({ ok: false, error: 'Missing credential' })
  }

  const clientId = String(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      '',
  ).trim()
  if (!clientId) {
    return res.status(500).json({ ok: false, error: 'Google client ID not configured' })
  }

  let email = ''
  try {
    const { payload } = await jwtVerify(credential, JWKS, {
      issuer: 'https://accounts.google.com',
      audience: clientId,
    })
    email = String(payload.email || '')
      .trim()
      .toLowerCase()
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid token' })
  }

  if (!email) {
    return res.status(401).json({ ok: false, error: 'No email in token' })
  }

  if (hooks?.onVerified) {
    const displayName =
      typeof (body as { displayName?: unknown }).displayName === 'string'
        ? (body as { displayName: string }).displayName
        : undefined
    let verdict: Awaited<ReturnType<NonNullable<GoogleAuthHooks['onVerified']>>>
    try {
      verdict = await hooks.onVerified({ email, displayName })
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      console.error('[auth] onVerified database error', e)
      return res.status(503).json({
        ok: false,
        error:
          process.env.NODE_ENV === 'production'
            ? 'Database unavailable. Check DATABASE_URL in packages/apps/<app>/.env.local, run pnpm db:check, see docs/troubleshooting.md.'
            : `Database unavailable: ${detail}`,
      })
    }
    if (!verdict.allowed) {
      return res
        .status(verdict.statusCode ?? 403)
        .json({ ok: false, error: verdict.error || 'Access denied' })
    }
  }

  const session = await getIronSession<FtSessionData>(req, res, sessionOptions)
  session.email = email
  session.authedAt = Date.now()
  if (hooks?.prepareSession) {
    await hooks.prepareSession({ email, session })
  }
  await session.save()

  return res.status(200).json({ ok: true, email })
}

export async function handleSessionGet(
  req: NextApiRequest,
  res: NextApiResponse,
  getSessionOptions: GetFtSessionOptions,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let sessionOptions
  try {
    sessionOptions = getSessionOptions()
  } catch {
    return res.status(200).json({ ok: true, authed: false })
  }

  const session = await getIronSession<FtSessionData>(req, res, sessionOptions)
  const email = session.email
  return res.status(200).json({
    ok: true,
    authed: Boolean(email),
    email: email || undefined,
    activeOrgId: session.activeOrgId || undefined,
  })
}

export async function handleLogoutPost(
  req: NextApiRequest,
  res: NextApiResponse,
  getSessionOptions: GetFtSessionOptions,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let sessionOptions
  try {
    sessionOptions = getSessionOptions()
  } catch {
    return res.status(200).json({ ok: true })
  }

  const session = await getIronSession<FtSessionData>(req, res, sessionOptions)
  session.destroy()
  await session.save()

  return res.status(200).json({ ok: true })
}
