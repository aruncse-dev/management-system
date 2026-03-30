import { useState, useEffect, useRef, type FormEvent } from 'react'
import { StoreProvider } from './store'
import Nav, { ModuleId } from './components/Nav'
import ErrorScreen from './components/ErrorScreen'
import { Smartphone } from 'lucide-react'
import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import Monthly from './pages/Monthly'
import Lending from './pages/Lending'
import Savings from './pages/Savings'
import Gold from './pages/Gold'
import Investments from './pages/Investments'
import EMI from './pages/EMI'
import JewelLoans from './pages/JewelLoans'
import CashLoans from './pages/CashLoans'
import Settings from './pages/Settings'
import Components from './pages/Components'
import { ALLOWED_EMAILS } from './constants'

function InstallBanner() {
  const deferredPrompt = useRef<Event & { prompt: () => void } | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); deferredPrompt.current = e as any; setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null
  return (
    <div style={{position:'fixed',top:106,left:12,right:12,background:'var(--card)',border:'1px solid var(--border)',borderLeft:'4px solid var(--navy)',borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:150,boxShadow:'0 4px 16px rgba(55,48,163,.12)'}}>
      <span style={{fontSize:13,fontWeight:600,color:'var(--text)',display:'flex',alignItems:'center',gap:6}}><Smartphone size={14} /> Add FinTracker to home screen</span>
      <div style={{display:'flex',gap:6,flexShrink:0}}>
        <button style={{background:'var(--navy)',color:'#fff',border:'none',borderRadius:8,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}} onClick={() => { deferredPrompt.current?.prompt(); setShow(false) }}>Install</button>
        <button style={{background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer',lineHeight:1,padding:'0 2px'}} onClick={() => setShow(false)}>×</button>
      </div>
    </div>
  )
}

const AUTH_COOKIE = 'ft_app_unlocked'
const AUTH_MODE_KEY = 'ft_lock_mode'
const LAST_ACTIVE_KEY = 'ft_last_active'
const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || ''
type LockMode = 'google' | 'password'

function setAppAuthCookie(value: string) {
  document.cookie = `${AUTH_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`
}

function getAppAuthCookie() {
  return document.cookie.split('; ').find(row => row.startsWith(`${AUTH_COOKIE}=`))?.split('=')[1] || ''
}

function clearAppAuthCookie() {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax`
}

function getInitialLockMode(): LockMode {
  const unlocked = getAppAuthCookie() === '1'
  const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY) || '0')
  if (unlocked && lastActive && Date.now() - lastActive > IDLE_TIMEOUT_MS) return 'password'
  return localStorage.getItem(AUTH_MODE_KEY) === 'password' ? 'password' : 'google'
}

function Inner({ onLogout }: { onLogout: () => void }) {
  const [module, setModule] = useState<ModuleId>('monthly')
  const [lendingSheet, setLendingSheet] = useState('Lending')

  const handleModuleChange = (id: ModuleId) => {
    setModule(id)
    if (id !== 'lending') setLendingSheet('Lending')
  }

  const getTitleForModule = (): string => {
    if (module === 'monthly') return 'Monthly Expenses'
    if (module === 'lending') return lendingSheet === 'Vijaya Amma' ? 'Vijaya Amma' : 'Lending'
    if (module === 'savings') return 'Savings'
    if (module === 'gold') return 'Gold'
    if (module === 'investments') return 'Investments'
    if (module === 'emi') return 'EMI Loans'
    if (module === 'jewelLoans') return 'Jewel Loans'
    if (module === 'cashLoans') return 'Cash Loans'
    if (module === 'settings') return 'Settings'
    if (module === 'components') return 'UI Kit'
    return 'FinTracker'
  }

  return (
    <div style={{ minHeight: '100vh' }} className={module === 'monthly' ? 'with-app-shell' : ''}>
      <Nav module={module} onModule={handleModuleChange} lendingSheet={lendingSheet} onLendingSheet={setLendingSheet} title={getTitleForModule()} onLogout={onLogout} />
      {module === 'monthly'     && <Monthly />}
      {module === 'lending'     && <Lending key={lendingSheet} sheetName={lendingSheet} />}
      {module === 'savings'     && <Savings />}
      {module === 'gold'        && <Gold />}
      {module === 'investments' && <Investments />}
      {module === 'emi'         && <EMI />}
      {module === 'jewelLoans'  && <JewelLoans />}
      {module === 'cashLoans'   && <CashLoans />}
      {module === 'settings'    && <Settings />}
      {module === 'components'  && <Components />}
      <InstallBanner />
    </div>
  )
}

// Error boundary wrapper
function AppWithErrorBoundary({ onLogout }: { onLogout: () => void }) {
  const [apiError, setApiError] = useState<string | null>(null)
  const [shouldRetry, setShouldRetry] = useState(false)

  useEffect(() => {
    setShouldRetry(false)
  }, [shouldRetry])

  // Catch unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason) || ''
      if (msg.includes('GAS') && msg.includes('deployed')) {
        setApiError(msg)
        event.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [])

  if (apiError) {
    return <ErrorScreen error={apiError} onRetry={() => setApiError(null)} />
  }

  return <Inner onLogout={onLogout} />
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

function LockScreen({ mode, onUnlock }: { mode: LockMode; onUnlock: () => void }) {
  const [error, setError] = useState('')

  const handleCredential = (resp: CredentialResponse) => {
    setError('')
    const token = resp.credential
    if (!token) {
      setError('Google sign-in did not return a token.')
      return
    }

    const payload = decodeJwtPayload(token)
    const email = String(payload?.email || '').trim().toLowerCase()
    if (!email) {
      setError('Could not read Google account email.')
      return
    }

    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) {
      setError('This Google account is not allowed for FinTracker.')
      return
    }

    localStorage.setItem(AUTH_MODE_KEY, 'google')
    localStorage.setItem('ft_email', email)
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
    setAppAuthCookie('1')
    onUnlock()
  }

  const handlePasswordUnlock = () => {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
    setAppAuthCookie('1')
    onUnlock()
  }

  return (
    <div className="login-screen">
      <div style={{ width: 'min(100%, 380px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ width: 92, height: 92, borderRadius: 28, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 12px 36px rgba(0,0,0,.16)' }}>
          <img
            src="./apple-touch-icon.png"
            alt="FinTracker"
            width="50"
            height="50"
            style={{ borderRadius: 15, objectFit: 'contain' }}
          />
        </div>
        <div className="login-title" style={{ textAlign: 'center', color: '#fff' }}>FinTracker</div>
        <div className="login-sub" style={{ textAlign: 'center' }}>
          {mode === 'google' ? 'Sign in with Google to continue.' : 'Your session expired. Enter your app password to continue.'}
        </div>
        {error && <div style={{ color: '#FCA5A5', fontSize: 13, fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{error}</div>}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          {mode === 'google' ? (
            GOOGLE_CLIENT_ID ? (
              <GoogleLogin
                onSuccess={handleCredential}
                onError={() => setError('Google sign-in failed. Please try again.')}
                type="standard"
                theme="outline"
                size="large"
                text="signin_with"
                shape="pill"
                width={300}
              />
            ) : (
              <div style={{ color: '#FCA5A5', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                Google login is not configured. Add `VITE_GOOGLE_CLIENT_ID`.
              </div>
            )
          ) : (
            <div style={{ width: '100%', maxWidth: 320 }}>
              <PasswordLock onUnlock={handlePasswordUnlock} error={error} setError={setError} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PasswordLock({ onUnlock, error, setError }: { onUnlock: () => void; error: string; setError: (v: string) => void }) {
  const [password, setPassword] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const appPassword = (import.meta.env.VITE_APP_PASSWORD as string | undefined)?.trim() || '1234'
    if (password === appPassword) {
      setError('')
      onUnlock()
      return
    }
    setError('Incorrect password. Please try again.')
    setPassword('')
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        ref={inputRef}
        type="password"
        value={password}
        onChange={e => {
          setPassword(e.target.value)
          if (error) setError('')
        }}
        placeholder="Enter password"
        className="form-inp"
        style={{ background: 'rgba(255,255,255,.96)', borderColor: 'rgba(255,255,255,.25)', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)' }}
        autoComplete="current-password"
      />
      <button className="btn btn-full" style={{ fontSize: 15, padding: '12px 28px', justifyContent: 'center' }} type="submit">
        Unlock App
      </button>
    </form>
  )
}

export default function App() {
  const [authMode, setAuthMode] = useState<LockMode>(() => getInitialLockMode())
  const [authed, setAuthed] = useState(() => {
    const unlocked = getAppAuthCookie() === '1'
    if (!unlocked) return false
    const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY) || '0')
    if (lastActive && Date.now() - lastActive > IDLE_TIMEOUT_MS) return false
    return true
  })

  useEffect(() => {
    if (!authed) return

    const lockForIdle = () => {
      localStorage.setItem(AUTH_MODE_KEY, 'password')
      setAuthMode('password')
      setAuthed(false)
    }

    const bumpActivity = () => {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
      window.clearTimeout(timer)
      timer = window.setTimeout(lockForIdle, IDLE_TIMEOUT_MS)
    }

    let timer = window.setTimeout(lockForIdle, IDLE_TIMEOUT_MS)
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

  const handleUnlock = (mode: LockMode) => {
    localStorage.setItem(AUTH_MODE_KEY, mode)
    setAuthMode(mode)
    setAuthed(true)
  }

  const handleLogout = () => {
    clearAppAuthCookie()
    localStorage.removeItem(LAST_ACTIVE_KEY)
    localStorage.removeItem('ft_email')
    localStorage.setItem(AUTH_MODE_KEY, 'google')
    setAuthMode('google')
    setAuthed(false)
  }

  if (!GOOGLE_CLIENT_ID && authMode === 'google') {
    return <LockScreen mode="password" onUnlock={() => handleUnlock('password')} />
  }
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {!authed ? (
        <LockScreen
          mode={authMode}
          onUnlock={() => handleUnlock(authMode)}
        />
      ) : (
        <StoreProvider>
          <AppWithErrorBoundary onLogout={handleLogout} />
        </StoreProvider>
      )}
    </GoogleOAuthProvider>
  )
}
