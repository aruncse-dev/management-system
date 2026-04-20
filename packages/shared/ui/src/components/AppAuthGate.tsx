import { useState, useEffect, useRef, type FormEvent, type CSSProperties, type ReactNode } from 'react'
import { GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import { GoogleAuthCard, GoogleSignInButton } from './GoogleAuthCard'

const AUTH_MODE_KEY = 'ft_lock_mode'
const LAST_ACTIVE_KEY = 'ft_last_active'
const IDLE_TIMEOUT_MS = 60 * 60 * 1000

type LockMode = 'google' | 'password'

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
  if (kind === 'vault') return 'vault-rect.png'
  if (kind === 'staff') return 'staff-rect.png'
  return 'icon-rect.png'
}

function iconUrl(kind: AppAuthKind) {
  return `/${iconAsset(kind)}`
}

function LockScreen({
  mode,
  onUnlock,
  appKind,
  googleClientId,
  oauthError,
}: {
  mode: LockMode
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
      localStorage.setItem(AUTH_MODE_KEY, 'google')
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
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
      subtitle={
        mode === 'google'
          ? 'Sign in with Google to continue.'
          : 'You were idle for an hour. Enter your app PIN to unlock.'
      }
      error={error || oauthError || undefined}
    >
      {mode === 'google' ? (
        googleClientId ? (
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
        )
      ) : (
        <div className="login-auth-card__pin">
          <PasswordLock
            onSubmitPin={async pin => {
              setError('')
              let r: Response
              try {
                r = await fetch('/api/auth/verify-pin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'same-origin',
                  body: JSON.stringify({ pin }),
                })
              } catch {
                setError('Request failed. Try again.')
                throw new Error('network')
              }
              const data = (await r.json().catch(() => ({}))) as { error?: string }
              if (!r.ok) {
                setError(data.error || 'Incorrect PIN. Please try again.')
                throw new Error('pin')
              }
              localStorage.setItem(AUTH_MODE_KEY, 'password')
              localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
              onUnlock()
            }}
            error={error}
            setError={setError}
          />
        </div>
      )}
    </GoogleAuthCard>
  )
}

function PasswordLock({
  onSubmitPin,
  error,
  setError,
}: {
  onSubmitPin: (pin: string) => Promise<void>
  error: string
  setError: (v: string) => void
}) {
  const [password, setPassword] = useState(['', '', '', ''])
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])
  const focusBox = (index: number) => {
    inputRefs.current[index]?.focus()
    inputRefs.current[index]?.select()
  }
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const pin = password.join('')
    try {
      await onSubmitPin(pin)
    } catch {
      setPassword(['', '', '', ''])
      focusBox(0)
    }
  }
  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 48px)', gap: 8, justifyContent: 'center' }}>
        {password.map((digit, index) => (
          <input
            key={index}
            ref={el => {
              inputRefs.current[index] = el
            }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            pattern="[0-9]*"
            onChange={e => {
              const next = e.target.value.replace(/\D/g, '').slice(-1)
              const updated = [...password]
              updated[index] = next
              setPassword(updated)
              if (error) setError('')
              if (next && index < 3) focusBox(index + 1)
            }}
            onKeyDown={e => {
              if (e.key === 'Backspace' && !password[index] && index > 0) focusBox(index - 1)
            }}
            className="form-inp"
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              minHeight: 48,
              textAlign: 'center',
              fontSize: 16,
              fontWeight: 700,
              background: 'rgba(255,255,255,.96)',
              borderColor: 'rgba(191, 219, 254, .85)',
              color: 'var(--text)',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
              ...({ WebkitTextSecurity: 'disc' } as CSSProperties),
            }}
            autoComplete={index === 0 ? 'current-password' : 'off'}
            aria-label={`Password digit ${index + 1}`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <button
          className="ui-kit-btn"
          type="submit"
          style={{
            width: 'fit-content',
            minWidth: 180,
            justifyContent: 'center',
            background: 'rgba(255,255,255,.92)',
            color: 'var(--navy)',
            border: '1px solid rgba(255,255,255,.45)',
            borderRadius: 999,
            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
          }}
        >
          Unlock App
        </button>
      </div>
    </form>
  )
}

export default function AppAuthGate({ appKind, googleClientId, children }: AppAuthGateProps) {
  const clientId = (googleClientId || '').trim()
  const [authMode, setAuthMode] = useState<LockMode>('google')
  const [authed, setAuthed] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [oauthScriptError, setOauthScriptError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(r => {
        if (!r.ok) throw new Error(`session ${r.status}`)
        return r.json() as Promise<{ authed?: boolean }>
      })
      .then((d: { authed?: boolean }) => {
        const ok = Boolean(d.authed)
        setAuthed(ok)
        if (!ok) {
          // No server session: PIN mode in localStorage is stale (e.g. cookies cleared but storage left,
          // or "password" left from a previous tab). Idle lock without reload is set only by the timer below.
          localStorage.removeItem(AUTH_MODE_KEY)
          setAuthMode('google')
        }
      })
      .catch(() => {
        setAuthed(false)
        localStorage.removeItem(AUTH_MODE_KEY)
        setAuthMode('google')
      })
      .finally(() => setSessionLoading(false))
  }, [])

  useEffect(() => {
    if (!authed) return
    let timer = window.setTimeout(() => {
      localStorage.setItem(AUTH_MODE_KEY, 'password')
      setAuthMode('password')
      setAuthed(false)
    }, IDLE_TIMEOUT_MS)
    const bumpActivity = () => {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        localStorage.setItem(AUTH_MODE_KEY, 'password')
        setAuthMode('password')
        setAuthed(false)
      }, IDLE_TIMEOUT_MS)
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const
    events.forEach(evt => window.addEventListener(evt, bumpActivity, { passive: true } as AddEventListenerOptions))
    document.addEventListener('visibilitychange', bumpActivity)
    bumpActivity()
    return () => {
      window.clearTimeout(timer)
      events.forEach(evt => window.removeEventListener(evt, bumpActivity as EventListener))
      document.removeEventListener('visibilitychange', bumpActivity)
    }
  }, [authed])

  const handleUnlock = () => {
    setOauthScriptError(null)
    const mode = (localStorage.getItem(AUTH_MODE_KEY) as LockMode | null) || authMode
    localStorage.setItem(AUTH_MODE_KEY, mode)
    setAuthMode(mode)
    setAuthed(true)
  }

  const handleLogout = async () => {
    setOauthScriptError(null)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } catch {
      /* ignore */
    }
    localStorage.removeItem(LAST_ACTIVE_KEY)
    localStorage.setItem(AUTH_MODE_KEY, 'google')
    setAuthMode('google')
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

  const inner = !authed ? (
    <LockScreen
      mode={authMode}
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
      <LockScreen
        mode="google"
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
