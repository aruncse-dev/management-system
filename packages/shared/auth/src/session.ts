import type { SessionOptions } from 'iron-session'

export type GetFtSessionOptions = () => SessionOptions

export type FtSessionData = {
  email?: string
  authedAt?: number
}

/** Minimum length enforced by iron-session usage; keep in sync with middleware error copy. */
export const SESSION_SECRET_MIN_LEN = 32

export function getFtSessionOptions(cookieName: string): SessionOptions {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < SESSION_SECRET_MIN_LEN) {
    throw new Error(
      `SESSION_SECRET must be set to at least ${SESSION_SECRET_MIN_LEN} characters (e.g. openssl rand -base64 32). See packages/apps/<app>/.env.local.example.`,
    )
  }
  return {
    cookieName,
    password: secret,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 604800,
      path: '/',
    },
  }
}
