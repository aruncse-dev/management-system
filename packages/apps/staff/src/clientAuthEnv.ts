/** Server injects `window.__FT_AUTH_ENV` from env; client falls back to process.env. */
export type ClientAuthEnv = {
  googleClientId: string
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
  }
}
