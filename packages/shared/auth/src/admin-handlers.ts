import type { NextApiRequest, NextApiResponse } from 'next'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getIronSession } from 'iron-session'
import type { FtAdminSessionData } from './session'
import type { GetFtSessionOptions } from './session'

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

type AdminGoogleHooks = {
  onVerified: (args: { email: string; displayName?: string }) => Promise<
    | { allowed: true }
    | { allowed: false; error?: string; statusCode?: number }
  >
}

export async function handleAdminGoogleAuthPost(
  req: NextApiRequest,
  res: NextApiResponse,
  getAdminSessionOptions: GetFtSessionOptions,
  hooks: AdminGoogleHooks,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let sessionOptions
  try {
    sessionOptions = getAdminSessionOptions()
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

  const displayName =
    typeof (body as { displayName?: unknown }).displayName === 'string'
      ? (body as { displayName: string }).displayName
      : undefined
  const verdict = await hooks.onVerified({ email, displayName })
  if (!verdict.allowed) {
    return res
      .status(verdict.statusCode ?? 403)
      .json({ ok: false, error: verdict.error || 'Not a platform administrator' })
  }

  const session = await getIronSession<FtAdminSessionData>(req, res, sessionOptions)
  session.email = email
  session.method = 'google'
  session.authedAt = Date.now()
  await session.save()

  return res.status(200).json({ ok: true, email })
}

export async function handleAdminSessionGet(
  req: NextApiRequest,
  res: NextApiResponse,
  getAdminSessionOptions: GetFtSessionOptions,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let sessionOptions
  try {
    sessionOptions = getAdminSessionOptions()
  } catch {
    return res.status(200).json({ ok: true, authed: false })
  }

  const session = await getIronSession<FtAdminSessionData>(req, res, sessionOptions)
  const authed = Boolean(session.authedAt && session.email)
  return res.status(200).json({
    ok: true,
    authed,
    method: session.method,
    email: session.email,
  })
}

export async function handleAdminLogoutPost(
  req: NextApiRequest,
  res: NextApiResponse,
  getAdminSessionOptions: GetFtSessionOptions,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let sessionOptions
  try {
    sessionOptions = getAdminSessionOptions()
  } catch {
    return res.status(200).json({ ok: true })
  }

  const session = await getIronSession<FtAdminSessionData>(req, res, sessionOptions)
  session.destroy()
  await session.save()
  return res.status(200).json({ ok: true })
}
