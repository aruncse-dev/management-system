/** Server injects `window.__FT_AUTH_ENV` from env; client falls back to process.env. */
export type ClientAuthEnv = {
  googleClientId: string
  appPassword: string
  allowedEmailsRaw: string
}

declare global {
  interface Window {
    __FT_AUTH_ENV?: ClientAuthEnv
  }
}

export function getClientAuthEnv(): ClientAuthEnv {
  if (typeof window !== 'undefined' && window.__FT_AUTH_ENV) {
    return window.__FT_AUTH_ENV
  }
  return {
    googleClientId: String(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
    ).trim(),
    appPassword: (process.env.NEXT_PUBLIC_APP_PASSWORD || process.env.VITE_APP_PASSWORD || '').trim() || '1234',
    allowedEmailsRaw: String(
      process.env.NEXT_PUBLIC_ALLOWED_EMAILS || process.env.VITE_ALLOWED_EMAILS || process.env.ALLOWED_EMAILS || '',
    ),
  }
}
