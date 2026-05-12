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
    const verdict = await hooks.onVerified({ email, displayName })
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

/**
 * PIN-only bootstrap when there is no Google session yet: which email to bind to the new session.
 *
 * - If `PIN_SESSION_EMAIL` is set, that value wins.
 * - Otherwise the first entry in `ADMIN_EMAILS` is used (single-admin / household setups).
 */
function resolvePinSessionEmail(): string | undefined {
  const explicit = (process.env.PIN_SESSION_EMAIL || '').trim().toLowerCase()
  if (explicit) return explicit
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return admins[0] || undefined
}

type VerifyPinHooks = {
  finalizeSession?: (session: FtSessionData) => Promise<void>
}

export async function handleVerifyPinPost(
  req: NextApiRequest,
  res: NextApiResponse,
  getSessionOptions: GetFtSessionOptions,
  hooks?: VerifyPinHooks,
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
  const pin = typeof (body as { pin?: unknown }).pin === 'string' ? (body as { pin: string }).pin : ''
  if (!pin) {
    return res.status(400).json({ ok: false, error: 'Missing pin' })
  }

  const expected = (process.env.APP_PASSWORD || process.env.VITE_APP_PASSWORD || '').trim()
  if (!expected) {
    return res.status(503).json({ ok: false, error: 'PIN not configured' })
  }

  if (pin !== expected) {
    return res.status(401).json({ ok: false, error: 'Incorrect PIN' })
  }

  const session = await getIronSession<FtSessionData>(req, res, sessionOptions)

  if (session.email) {
    session.authedAt = Date.now()
    if (hooks?.finalizeSession) await hooks.finalizeSession(session)
    await session.save()
    return res.status(200).json({ ok: true })
  }

  const email = resolvePinSessionEmail()
  if (!email) {
    return res.status(401).json({
      ok: false,
      error:
        'No active session. Sign in with Google once, or set PIN_SESSION_EMAIL (or ADMIN_EMAILS) so PIN can restore your session.',
    })
  }

  session.email = email
  session.authedAt = Date.now()
  if (hooks?.finalizeSession) await hooks.finalizeSession(session)
  await session.save()

  return res.status(200).json({ ok: true })
}
