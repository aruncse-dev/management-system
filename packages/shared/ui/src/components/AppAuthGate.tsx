import { useState, useEffect, type ReactNode } from 'react'
import { GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import { GoogleAuthCard, GoogleSignInButton } from './GoogleAuthCard'

export type AppAuthKind = 'fintracker' | 'vault' | 'staff'

export type AppAuthGateRender = (ctx: { onLogout: () => void }) => ReactNode

export type AppAuthGateProps = {
  appKind: AppAuthKind
  googleClientId: string
  children: ReactNode | AppAuthGateRender
}

function brandName(kind: AppAuthKind) {
  if (kind === 'vault') return 'Vault'
  if (kind === 'staff') return 'Staff'
  return 'FinTracker'
}

function iconAsset(kind: AppAuthKind) {
  if (kind === 'vault') return 'vault-192.png'
  return 'icon-192.png'
}

function iconUrl(kind: AppAuthKind) {
  return `/${iconAsset(kind)}`
}

function LoginScreen({
  onUnlock,
  appKind,
  googleClientId,
  oauthError,
}: {
  onUnlock: () => void
  appKind: AppAuthKind
  googleClientId: string
  oauthError?: string | null
}) {
  const [error, setError] = useState('')
  const displayName = brandName(appKind)
  const src = iconUrl(appKind)

  useEffect(() => {
    document.title = displayName
    const apple = document.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']")
    if (apple) apple.content = displayName
  }, [displayName])

  const handleCredential = async (resp: CredentialResponse) => {
    setError('')
    const token = resp.credential
    if (!token) return setError('Google sign-in did not return a token.')
    try {
      const r = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ credential: token }),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string; email?: string }
      if (!r.ok) {
        return setError(data.error || 'Sign-in failed.')
      }
      setError('')
      onUnlock()
    } catch {
      setError('Sign-in request failed.')
    }
  }

  return (
    <GoogleAuthCard
      iconSrc={src}
      iconAlt={displayName}
      title={displayName}
      subtitle="Sign in with Google to continue."
      error={error || oauthError || undefined}
    >
      {googleClientId ? (
        <div className="login-auth-card__google">
          <GoogleSignInButton
            onSuccess={handleCredential}
            onError={() =>
              setError(
                'Google sign-in failed. If the button is blank, add this origin in Google Cloud Console → OAuth client → Authorized JavaScript origins (e.g. http://localhost:3000).',
              )
            }
          />
        </div>
      ) : (
        <span className="ui-kit-section-chip ui-tone-red login-auth-card__config-warn">
          Add VITE_GOOGLE_CLIENT_ID to web/.env or this app&apos;s .env.local, then restart next dev.
        </span>
      )}
    </GoogleAuthCard>
  )
}

export default function AppAuthGate({ appKind, googleClientId, children }: AppAuthGateProps) {
  const clientId = (googleClientId || '').trim()
  const [authed, setAuthed] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [oauthScriptError, setOauthScriptError] = useState<string | null>(null)
  /** The session check never completed — a network problem, not a signed-out user. */
  const [sessionUnreachable, setSessionUnreachable] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    /**
     * Only the server may end a session.
     *
     * This used to treat *any* failure as signed-out, so a single flaky request
     * — a phone waking up, a cold start, a navigation that aborted the fetch —
     * showed the Google screen while a perfectly valid cookie sat in the
     * browser. Signing in again "worked", which made it look like the session
     * kept expiring. A transient failure now retries once and then leaves the
     * previous state alone; only an explicit 401 signs the user out.
     */
    const readSession = async (): Promise<boolean | null> => {
      const r = await fetch('/api/auth/session', { credentials: 'same-origin' })
      if (r.status === 401) return false
      if (!r.ok) throw new Error(`session ${r.status}`)
      const d = (await r.json()) as { authed?: boolean }
      return Boolean(d.authed)
    }

    void (async () => {
      let result: boolean | null = null
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          result = await readSession()
          break
        } catch {
          if (attempt === 0) await new Promise(res => setTimeout(res, 600))
        }
      }
      if (cancelled) return
      if (result === null) {
        // Never got an answer. Say so — showing the sign-in card here would
        // claim the session ended when we simply could not ask.
        setSessionUnreachable(true)
      } else {
        setSessionUnreachable(false)
        setAuthed(result)
      }
      setSessionLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const handleUnlock = () => {
    setOauthScriptError(null)
    setAuthed(true)
  }

  const handleLogout = async () => {
    setOauthScriptError(null)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } catch {
      /* ignore */
    }
    setAuthed(false)
  }

  const loadingUi = (
    <div
      className="login-auth-card"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        color: 'var(--text, #0f172a)',
        fontWeight: 600,
      }}
    >
      Loading…
    </div>
  )

  const unreachableUi = (
    <div
      className="login-auth-card"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        textAlign: 'center',
        color: 'var(--text, #0f172a)',
      }}
    >
      <div style={{ display: 'grid', gap: 10, maxWidth: 320 }}>
        <div style={{ fontWeight: 700 }}>Can&apos;t reach the server</div>
        <div style={{ fontSize: 13, color: 'var(--muted, #64748b)', lineHeight: 1.5 }}>
          You are probably still signed in — we just couldn&apos;t check. Check your
          connection and try again.
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setSessionUnreachable(false)
            setSessionLoading(true)
            setReloadKey(k => k + 1)
          }}
        >
          Retry
        </button>
      </div>
    </div>
  )

  const inner = sessionUnreachable ? (
    unreachableUi
  ) : !authed ? (
    <LoginScreen
      onUnlock={handleUnlock}
      appKind={appKind}
      googleClientId={clientId}
      oauthError={oauthScriptError}
    />
  ) : typeof children === 'function' ? (
    (children as AppAuthGateRender)({ onLogout: handleLogout })
  ) : (
    children
  )

  if (sessionLoading) {
    return loadingUi
  }

  if (!clientId) {
    return (
      <LoginScreen
        onUnlock={handleUnlock}
        appKind={appKind}
        googleClientId=""
        oauthError={oauthScriptError}
      />
    )
  }

  return (
    <GoogleOAuthProvider
      clientId={clientId}
      onScriptLoadError={() =>
        setOauthScriptError(
          'Could not load Google Sign-In (accounts.google.com). Check network, ad blockers, and firewall.',
        )
      }
    >
      {inner}
    </GoogleOAuthProvider>
  )
}
