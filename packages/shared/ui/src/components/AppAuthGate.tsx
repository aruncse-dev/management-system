import { useState, useEffect, useRef, type FormEvent, type CSSProperties, type ReactNode } from 'react'
import { GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import { GoogleAuthCard, GoogleSignInButton } from './GoogleAuthCard'

const AUTH_GOOGLE_COOKIE = 'ft_google_authed'
const AUTH_MODE_KEY = 'ft_lock_mode'
const LAST_ACTIVE_KEY = 'ft_last_active'
const GOOGLE_AUTH_MAX_AGE = 7 * 24 * 60 * 60
const IDLE_TIMEOUT_MS = 60 * 60 * 1000
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type LockMode = 'google' | 'password'

export type AppAuthKind = 'fintracker' | 'vault' | 'staff'

export type AppAuthGateRender = (ctx: { onLogout: () => void }) => ReactNode

export type AppAuthGateProps = {
  appKind: AppAuthKind
  googleClientId: string
  appPassword: string
  allowedEmails: string[]
  children: ReactNode | AppAuthGateRender
}

function setGoogleAuthCookie(value: string) {
  document.cookie = `${AUTH_GOOGLE_COOKIE}=${value}; path=/; max-age=${GOOGLE_AUTH_MAX_AGE}; samesite=lax`
}

function getGoogleAuthCookie() {
  if (typeof document === 'undefined') return ''
  return document.cookie.split('; ').find(row => row.startsWith(`${AUTH_GOOGLE_COOKIE}=`))?.split('=')[1] || ''
}

function clearGoogleAuthCookie() {
  document.cookie = `${AUTH_GOOGLE_COOKIE}=; path=/; max-age=0; samesite=lax`
}

/**
 * PIN is only for the 1h idle lock (we clear the session cookie then, but keep
 * `ft_lock_mode=password`). Every other locked state uses Google: first visit,
 * logout, or expired session.
 */
function getInitialLockMode(): LockMode {
  if (typeof window === 'undefined') return 'google'
  const hasCookie = getGoogleAuthCookie() === '1'
  const mode = localStorage.getItem(AUTH_MODE_KEY) as LockMode | null
  if (mode === 'password' && !hasCookie) return 'password'
  return 'google'
}

function readSessionAuthed(): boolean {
  if (typeof window === 'undefined') return false
  const unlocked = getGoogleAuthCookie() === '1'
  const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY) || '0')
  return Boolean(unlocked && lastActive && Date.now() - lastActive <= SESSION_MAX_AGE_MS)
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function brandName(kind: AppAuthKind) {
  if (kind === 'vault') return 'Vault'
  if (kind === 'staff') return 'Staff'
  return 'FinTracker'
}

/** Transparent playstore export; rendered inside `.login-brand-mark` (circular white tile). Nav uses `icon-192` (launcher / round mask). */
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
  appPassword,
  allowedEmails,
  oauthError,
}: {
  mode: LockMode
  onUnlock: () => void
  appKind: AppAuthKind
  googleClientId: string
  appPassword: string
  allowedEmails: string[]
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

  const handleCredential = (resp: CredentialResponse) => {
    setError('')
    const token = resp.credential
    if (!token) return setError('Google sign-in did not return a token.')
    const payload = decodeJwtPayload(token)
    const email = String(payload?.email || '').trim().toLowerCase()
    if (!email) return setError('Could not read Google account email.')
    if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
      return setError(`This Google account is not allowed for ${displayName}.`)
    }
    localStorage.setItem(AUTH_MODE_KEY, 'google')
    localStorage.setItem('ft_email', email)
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
    setGoogleAuthCookie('1')
    setError('')
    onUnlock()
  }

  const handlePasswordUnlock = () => {
    localStorage.setItem(AUTH_MODE_KEY, 'password')
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
    setGoogleAuthCookie('1')
    onUnlock()
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
            onUnlock={handlePasswordUnlock}
            error={error}
            setError={setError}
            appPassword={appPassword}
          />
        </div>
      )}
    </GoogleAuthCard>
  )
}

function PasswordLock({
  onUnlock,
  error,
  setError,
  appPassword,
}: {
  onUnlock: () => void
  error: string
  setError: (v: string) => void
  appPassword: string
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
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password.join('') === appPassword) {
      setError('')
      onUnlock()
      return
    }
    setError('Incorrect password. Please try again.')
    setPassword(['', '', '', ''])
    focusBox(0)
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

export default function AppAuthGate({
  appKind,
  googleClientId,
  appPassword,
  allowedEmails,
  children,
}: AppAuthGateProps) {
  const clientId = (googleClientId || '').trim()
  const [authMode, setAuthMode] = useState<LockMode>('google')
  const [authed, setAuthed] = useState(false)
  const [oauthScriptError, setOauthScriptError] = useState<string | null>(null)

  useEffect(() => {
    setAuthMode(getInitialLockMode())
    setAuthed(readSessionAuthed())
  }, [])

  useEffect(() => {
    if (!authed) return
    let timer = window.setTimeout(() => {
      clearGoogleAuthCookie()
      localStorage.setItem(AUTH_MODE_KEY, 'password')
      setAuthMode('password')
      setAuthed(false)
    }, IDLE_TIMEOUT_MS)
    const bumpActivity = () => {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        clearGoogleAuthCookie()
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

  const handleLogout = () => {
    setOauthScriptError(null)
    clearGoogleAuthCookie()
    localStorage.removeItem(LAST_ACTIVE_KEY)
    localStorage.removeItem('ft_email')
    localStorage.setItem(AUTH_MODE_KEY, 'google')
    setAuthMode('google')
    setAuthed(false)
  }

  if (!clientId && authMode === 'google') {
    return (
      <LockScreen
        mode="google"
        onUnlock={handleUnlock}
        appKind={appKind}
        googleClientId=""
        appPassword={appPassword}
        allowedEmails={allowedEmails}
        oauthError={oauthScriptError}
      />
    )
  }

  const inner = !authed ? (
    <LockScreen
      mode={authMode}
      onUnlock={handleUnlock}
      appKind={appKind}
      googleClientId={clientId}
      appPassword={appPassword}
      allowedEmails={allowedEmails}
      oauthError={oauthScriptError}
    />
  ) : typeof children === 'function' ? (
    (children as AppAuthGateRender)({ onLogout: handleLogout })
  ) : (
    children
  )

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
