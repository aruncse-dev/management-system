import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import { GoogleAuthCard, GoogleSignInButton } from './GoogleAuthCard'

export type AppAuthKind = 'fintracker' | 'vault' | 'staff'

export type AppAuthGateRender = (ctx: { onLogout: () => void }) => ReactNode

export type AppAuthGateProps = {
  appKind: AppAuthKind
  googleClientId: string
  children: ReactNode | AppAuthGateRender
  /**
   * Called when the server says this device is signed out (or the user logs
   * out). Apps clear device caches here so the next account to sign in never
   * sees the previous one's data.
   */
  onSignedOut?: () => void
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

/** `useLayoutEffect` warns during SSR; on the server it would never run anyway. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** How long one session check may take before we treat it as unanswered. */
const SESSION_TIMEOUT_MS = 6000
const SESSION_RETRY_DELAYS_MS = [800]

function authHintKey(kind: AppAuthKind) {
  return `ft_auth_hint_${kind}`
}

/**
 * "This device was signed in last time." A UI hint only — it decides whether
 * to paint the app while the session check runs, never what the server
 * allows. Every API call is still checked by the middleware.
 */
function readAuthHint(kind: AppAuthKind): boolean {
  try {
    return window.localStorage.getItem(authHintKey(kind)) === '1'
  } catch {
    return false
  }
}

function writeAuthHint(kind: AppAuthKind, authed: boolean) {
  try {
    if (authed) window.localStorage.setItem(authHintKey(kind), '1')
    else window.localStorage.removeItem(authHintKey(kind))
  } catch {
    /* storage blocked (private mode) — the hint is optional */
  }
}

/**
 * Only the server may end a session, and a check that never answers must not
 * hang the app.
 *
 * Installed PWAs cold-start with the radio still waking up, so the first
 * request can stall rather than fail. Without a timeout the gate sat on
 * "Loading…" forever and the only fix was to kill and relaunch the app. Each
 * attempt is now capped, retried with backoff, and a missing answer is
 * reported as `null` (unreachable) — never as signed-out.
 */
async function readSessionOnce(): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), SESSION_TIMEOUT_MS)
  try {
    const r = await fetch('/api/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: ctrl.signal,
    })
    if (r.status === 401) return false
    if (!r.ok) throw new Error(`session ${r.status}`)
    const d = (await r.json()) as { authed?: boolean }
    return Boolean(d.authed)
  } finally {
    clearTimeout(timer)
  }
}

async function readSessionWithRetry(isCancelled: () => boolean): Promise<boolean | null> {
  for (let attempt = 0; attempt <= SESSION_RETRY_DELAYS_MS.length; attempt++) {
    if (isCancelled()) return null
    try {
      return await readSessionOnce()
    } catch {
      const delay = SESSION_RETRY_DELAYS_MS[attempt]
      if (delay === undefined) break
      await new Promise(res => setTimeout(res, delay))
    }
  }
  return null
}

export default function AppAuthGate({ appKind, googleClientId, children, onSignedOut }: AppAuthGateProps) {
  const clientId = (googleClientId || '').trim()
  const [authed, setAuthed] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [oauthScriptError, setOauthScriptError] = useState<string | null>(null)
  /** The session check never completed — a network problem, not a signed-out user. */
  const [sessionUnreachable, setSessionUnreachable] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  /** True once the app is on screen; a later unanswered check must not tear it down. */
  const showingAppRef = useRef(false)
  useEffect(() => {
    showingAppRef.current = authed && !sessionLoading
  }, [authed, sessionLoading])

  /**
   * Paint the app straight away when this device was signed in at the last
   * successful check, and confirm in the background. This takes a full network
   * round trip off every launch. If the background check comes back
   * signed-out, the login screen replaces the app.
   *
   * The URL path is deliberately not used as evidence: a page served from the
   * service worker's cache never passed through the middleware.
   */
  useIsoLayoutEffect(() => {
    if (readAuthHint(appKind)) {
      showingAppRef.current = true
      setAuthed(true)
      setSessionLoading(false)
    }
  }, [appKind])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await readSessionWithRetry(() => cancelled)
      if (cancelled) return
      if (result === null) {
        // Never got an answer. If the app is already showing, leave it — its
        // own requests will surface errors. Otherwise say so; showing the
        // sign-in card here would claim the session ended when we could not ask.
        if (!showingAppRef.current) setSessionUnreachable(true)
      } else {
        setSessionUnreachable(false)
        setAuthed(result)
        writeAuthHint(appKind, result)
        if (!result) onSignedOut?.()
      }
      setSessionLoading(false)
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, appKind])

  const handleUnlock = () => {
    setOauthScriptError(null)
    writeAuthHint(appKind, true)
    setAuthed(true)
  }

  const handleLogout = async () => {
    setOauthScriptError(null)
    writeAuthHint(appKind, false)
    onSignedOut?.()
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
        color: 'var(--muted, #64748b)',
        fontWeight: 600,
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
        <img src={iconUrl(appKind)} alt="" width={56} height={56} style={{ borderRadius: 14 }} />
        <span>Loading…</span>
      </div>
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

  if (sessionLoading) {
    return loadingUi
  }

  if (sessionUnreachable) {
    return unreachableUi
  }

  if (authed) {
    return <>{typeof children === 'function' ? (children as AppAuthGateRender)({ onLogout: handleLogout }) : children}</>
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

  // The Google Identity script is only needed to sign in, so it is loaded only
  // for the login screen — a signed-in launch no longer waits on, or even
  // contacts, accounts.google.com.
  return (
    <GoogleOAuthProvider
      clientId={clientId}
      onScriptLoadError={() =>
        setOauthScriptError(
          'Could not load Google Sign-In (accounts.google.com). Check network, ad blockers, and firewall.',
        )
      }
    >
      <LoginScreen
        onUnlock={handleUnlock}
        appKind={appKind}
        googleClientId={clientId}
        oauthError={oauthScriptError}
      />
    </GoogleOAuthProvider>
  )
}
