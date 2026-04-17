import { useState, useEffect, useRef, type FormEvent, type CSSProperties } from 'react'
import { StoreProvider } from './store'
import Nav, { ModuleId } from './components/Nav'
import ErrorScreen from './components/ErrorScreen'
import { Grid2X2, Smartphone, Landmark, Settings as SettingsIcon, LogOut, Shield } from 'lucide-react'
import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import Monthly from './pages/Monthly'
import Lending from './pages/Lending'
import Savings from './pages/Savings'
import Bommi from './pages/Bommi'
import Gold from './pages/Gold'
import Investments from './pages/Investments'
import Loans from './pages/Loans'
import Settings from './pages/Settings'
import Components from './pages/Components'
import { VaultBankingPage } from './pages/Vault'
import VaultAppsPage from './pages/VaultApps'
import VaultInsurancePage from './pages/VaultInsurance'
import VaultSettings from './pages/VaultSettings'
import { ALLOWED_EMAILS } from './constants'
import { SectionChip } from './ui-kit'
import { api } from './api'
import { getAppAssetUrl, getAppDisplayName, getAppIconAsset, getAppManifestUrl, resolveAppArea, type AppArea } from './appPaths'

function setDocumentManifest(area: AppArea) {
  const link = document.querySelector<HTMLLinkElement>("link[rel='manifest']")
  if (link) link.href = getAppManifestUrl(area)
  document.title = getAppDisplayName(area)
  const appleTitle = document.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']")
  if (appleTitle) appleTitle.content = getAppDisplayName(area)
  const themeColor = document.querySelector<HTMLMetaElement>("meta[name='theme-color']")
  if (themeColor) themeColor.content = '#1E5CC7'
}

function InstallBanner({ area }: { area: AppArea }) {
  const deferredPrompt = useRef<Event & { prompt: () => void } | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); deferredPrompt.current = e as any; setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null
  return (
    <div style={{position:'fixed',top:106,left:12,right:12,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:150,boxShadow:'0 4px 16px rgba(55,48,163,.12)'}}>
      <span style={{fontSize:13,fontWeight:600,color:'var(--text)',display:'flex',alignItems:'center',gap:6}}><Smartphone size={14} /> Add {getAppDisplayName(area)} to home screen</span>
      <div style={{display:'flex',gap:6,flexShrink:0}}>
        <button style={{background:'var(--navy)',color:'#fff',border:'none',borderRadius:8,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}} onClick={() => { deferredPrompt.current?.prompt(); setShow(false) }}>Install</button>
        <button style={{background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer',lineHeight:1,padding:'0 2px'}} onClick={() => setShow(false)}>×</button>
      </div>
    </div>
  )
}

const AUTH_GOOGLE_COOKIE = 'ft_google_authed'
const AUTH_MODE_KEY = 'ft_lock_mode'
const LAST_ACTIVE_KEY = 'ft_last_active'
const GOOGLE_AUTH_MAX_AGE = 7 * 24 * 60 * 60
const IDLE_TIMEOUT_MS = 60 * 60 * 1000
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || ''
type LockMode = 'google' | 'password'

function setGoogleAuthCookie(value: string) {
  document.cookie = `${AUTH_GOOGLE_COOKIE}=${value}; path=/; max-age=${GOOGLE_AUTH_MAX_AGE}; samesite=lax`
}

function getGoogleAuthCookie() {
  return document.cookie.split('; ').find(row => row.startsWith(`${AUTH_GOOGLE_COOKIE}=`))?.split('=')[1] || ''
}

function clearGoogleAuthCookie() {
  document.cookie = `${AUTH_GOOGLE_COOKIE}=; path=/; max-age=0; samesite=lax`
}

/** PIN only after 1h idle (cookie cleared). Otherwise Google: first visit, logout, expiry. */
function getInitialLockMode(): LockMode {
  const hasCookie = getGoogleAuthCookie() === '1'
  const mode = localStorage.getItem(AUTH_MODE_KEY) as LockMode | null
  if (mode === 'password' && !hasCookie) return 'password'
  return 'google'
}

function FinanceShell({ onLogout }: { onLogout: () => void }) {
  const [module, setModule] = useState<ModuleId>('monthly')
  const [lendingSheet, setLendingSheet] = useState('Lending')
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'refreshing'>('idle')
  const pullStartRef = useRef<{ y: number; active: boolean } | null>(null)
  const refreshingRef = useRef(false)

  const handleModuleChange = (id: ModuleId) => {
    setModule(id)
    if (id !== 'lending') setLendingSheet('Lending')
  }

  const getTitleForModule = (): string => {
    if (module === 'monthly') return 'Monthly Expenses'
    if (module === 'lending') return lendingSheet === 'Vijaya Amma' ? 'Vijaya Amma' : 'Lending'
    if (module === 'savings') return 'Savings'
    if (module === 'bommi') return 'Bommi'
    if (module === 'gold') return 'Gold'
    if (module === 'investments') return 'Investments'
    if (module === 'loans') return 'Loans'
    if (module === 'settings') return 'Settings'
    if (module === 'components') return 'UI Kit'
    return 'FinTracker'
  }

  useEffect(() => {
    const startYThreshold = 20
    const refreshThreshold = 90
    const canPullRefresh = () => (document.scrollingElement?.scrollTop ?? document.documentElement.scrollTop ?? document.body.scrollTop ?? 0) <= 0
    const handleTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return
      if (!canPullRefresh()) return
      if (e.touches.length !== 1) return
      pullStartRef.current = { y: e.touches[0].clientY, active: e.touches[0].clientY <= startYThreshold }
    }
    const handleTouchMove = (e: TouchEvent) => {
      const start = pullStartRef.current
      if (!start || refreshingRef.current || !start.active) return
      const delta = e.touches[0].clientY - start.y
      if (delta > 20) setPullState('pulling')
      if (delta > refreshThreshold) {
        refreshingRef.current = true
        setPullState('refreshing')
        api.clearPersistentCache()
        window.location.reload()
      }
    }
    const handleTouchEnd = () => {
      pullStartRef.current = null
      if (!refreshingRef.current) setPullState('idle')
    }
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  return (
    <div style={{ minHeight: '100vh' }} className={module === 'monthly' ? 'with-app-shell' : ''}>
      <Nav module={module} onModule={handleModuleChange} lendingSheet={lendingSheet} onLendingSheet={setLendingSheet} title={getTitleForModule()} onLogout={onLogout} />
      {pullState !== 'idle' && <div style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 220, background: 'rgba(15, 28, 63, .92)', color: '#fff', borderRadius: 999, padding: '8px 14px', fontSize: 12, fontWeight: 600, boxShadow: '0 10px 30px rgba(15, 23, 42, .25)' }}>{pullState === 'pulling' ? 'Release to refresh' : 'Refreshing…'}</div>}
      {module === 'monthly'     && <Monthly />}
      {module === 'lending'     && <Lending key={lendingSheet} sheetName={lendingSheet} />}
      {module === 'savings'     && <Savings />}
      {module === 'bommi'       && <Bommi />}
      {module === 'gold'        && <Gold />}
      {module === 'investments' && <Investments />}
      {module === 'loans'       && <Loans />}
      {module === 'settings'    && <Settings />}
      {module === 'components'  && <Components />}
      <InstallBanner area="finance" />
    </div>
  )
}

function VaultShell({ onLogout }: { onLogout: () => void }) {
  const [vaultPage, setVaultPage] = useState<'banking' | 'insurance' | 'apps' | 'settings'>('banking')

  useEffect(() => {
    setDocumentManifest('vault')
  }, [])

  return (
    <div style={{ minHeight: '100vh' }}>
      <VaultNav onLogout={onLogout} currentPage={vaultPage} onPageChange={setVaultPage} />
      {vaultPage === 'banking' && <VaultBankingPage />}
      {vaultPage === 'insurance' && <VaultInsurancePage />}
      {vaultPage === 'apps' && <VaultAppsPage />}
      {vaultPage === 'settings' && <VaultSettings />}
      <InstallBanner area="vault" />
    </div>
  )
}

function VaultNav({ onLogout, currentPage, onPageChange }: { onLogout: () => void; currentPage: 'banking' | 'insurance' | 'apps' | 'settings'; onPageChange: (page: 'banking' | 'insurance' | 'apps' | 'settings') => void }) {
  const [open, setOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  return (
    <>
      <nav className="nav">
        <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <img src={getAppAssetUrl('vault', getAppIconAsset('vault'))} width="30" height="30" alt={getAppDisplayName('vault')} style={{borderRadius:8,flexShrink:0,objectFit:'contain',background:'#1E5CC7'}} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {currentPage === 'banking' ? 'Banking' : currentPage === 'insurance' ? 'Insurance' : currentPage === 'apps' ? 'Apps' : 'Settings'}
          </span>
        </span>
        <button className="nav-hamburger" onClick={() => setOpen(true)}>☰</button>
      </nav>
      {open && <div className="nav-overlay" onClick={() => setOpen(false)} />}
      <div className={`nav-drawer${open ? ' open' : ''}`}>
        <div className="nav-drawer-hd">
          <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <img src={getAppAssetUrl('vault', getAppIconAsset('vault'))} width="28" height="28" alt={getAppDisplayName('vault')} style={{borderRadius:7,flexShrink:0,objectFit:'contain',background:'#1E5CC7'}} />
            {getAppDisplayName('vault')}
          </span>
          <button className="modal-close" onClick={() => setOpen(false)}>×</button>
        </div>
        <div style={{ paddingTop: 8, paddingBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '8px 14px 4px 14px', marginBottom: 2 }}>
            Vault
          </div>
          <button className={`nav-drawer-item${currentPage === 'banking' ? ' active' : ''}`} onClick={() => { onPageChange('banking'); setOpen(false) }}>
            <Landmark size={18} />
            <span>Banking</span>
          </button>
          <button className={`nav-drawer-item${currentPage === 'insurance' ? ' active' : ''}`} onClick={() => { onPageChange('insurance'); setOpen(false) }}>
            <Shield size={18} />
            <span>Insurance</span>
          </button>
          <button className={`nav-drawer-item${currentPage === 'apps' ? ' active' : ''}`} onClick={() => { onPageChange('apps'); setOpen(false) }}>
            <Grid2X2 size={18} />
            <span>Apps</span>
          </button>
        </div>
        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          <button className={`nav-drawer-item${currentPage === 'settings' ? ' active' : ''}`} onClick={() => { onPageChange('settings'); setOpen(false) }}>
            <SettingsIcon size={18} />
            <span>Settings</span>
          </button>
          <button className="nav-drawer-item" onClick={() => setLogoutConfirmOpen(true)}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {logoutConfirmOpen && (
        <div className="modal-bg open" onClick={() => setLogoutConfirmOpen(false)} style={{ alignItems: 'center', padding: '24px 16px' }}>
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(100%, 360px)', padding: 16, borderRadius: 16, boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>
                  <LogOut size={18} />
                  Logout app?
                </div>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: 'var(--muted)' }}>
                  This clears only the Vault session on this device. It will not log you out of Google.
                </div>
              </div>
              <button className="modal-close" onClick={() => setLogoutConfirmOpen(false)} style={{ background: 'var(--bg)', color: 'var(--text)' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="settings-action-btn"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="settings-action-btn"
                onClick={() => {
                  setLogoutConfirmOpen(false)
                  onLogout()
                }}
                style={{ borderColor: 'rgba(239,68,68,.25)', color: 'var(--red)' }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function AppWithErrorBoundary({ onLogout }: { onLogout: () => void }) {
  const [apiError, setApiError] = useState<string | null>(null)
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
  if (apiError) return <ErrorScreen error={apiError} onRetry={() => setApiError(null)} />
  const area = resolveAppArea()
  return area === 'vault' ? <VaultShell onLogout={onLogout} /> : <FinanceShell onLogout={onLogout} />
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
  const area = resolveAppArea()
  useEffect(() => setDocumentManifest(area), [area])

  const handleCredential = (resp: CredentialResponse) => {
    setError('')
    const token = resp.credential
    if (!token) return setError('Google sign-in did not return a token.')
    const payload = decodeJwtPayload(token)
    const email = String(payload?.email || '').trim().toLowerCase()
    if (!email) return setError('Could not read Google account email.')
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) return setError('This Google account is not allowed for FinTracker.')
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
    <div className="login-screen">
      <div style={{ width: 'min(100%, 380px)', display: 'grid', gap: 20 }}>
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,.20)' }}>
            <img src={getAppAssetUrl(area, getAppIconAsset(area))} alt={getAppDisplayName(area)} width="44" height="44" style={{ borderRadius: 12, objectFit: 'contain' }} />
          </div>
          <div>
            <div className="login-title">{getAppDisplayName(area)}</div>
            <div className="login-sub">{mode === 'google' ? 'Sign in with Google to continue.' : 'You were idle for an hour. Enter your app PIN to unlock.'}</div>
          </div>
        </div>
        {error && <div style={{ width: '100%', maxWidth: 320, padding: '6px 2px', color: '#fff', fontSize: 13, fontWeight: 500, lineHeight: 1.4, textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          {mode === 'google' ? (
            GOOGLE_CLIENT_ID ? (
              <GoogleLogin onSuccess={handleCredential} onError={() => setError('Google sign-in failed. Please try again.')} type="standard" theme="outline" size="large" text="signin_with" shape="pill" width={300} />
            ) : (
              <SectionChip tone="red">Google login is not configured. Add `VITE_GOOGLE_CLIENT_ID`.</SectionChip>
            )
          ) : (
            <div style={{ width: '100%' }}>
              <PasswordLock onUnlock={handlePasswordUnlock} error={error} setError={setError} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PasswordLock({ onUnlock, error, setError }: { onUnlock: () => void; error: string; setError: (v: string) => void }) {
  const [password, setPassword] = useState(['', '', '', ''])
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  useEffect(() => { inputRefs.current[0]?.focus() }, [])
  const focusBox = (index: number) => { inputRefs.current[index]?.focus(); inputRefs.current[index]?.select() }
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const appPassword = (import.meta.env.VITE_APP_PASSWORD as string | undefined)?.trim() || '1234'
    if (password.join('') === appPassword) { setError(''); onUnlock(); return }
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
            ref={el => { inputRefs.current[index] = el }}
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
            onKeyDown={e => { if (e.key === 'Backspace' && !password[index] && index > 0) focusBox(index - 1) }}
            className="form-inp"
            style={{ width: '100%', aspectRatio: '1 / 1', minHeight: 48, textAlign: 'center', fontSize: 16, fontWeight: 700, background: 'rgba(255,255,255,.96)', borderColor: 'rgba(191, 219, 254, .85)', color: 'var(--text)', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)', ...({ WebkitTextSecurity: 'disc' } as CSSProperties) }}
            autoComplete={index === 0 ? 'current-password' : 'off'}
            aria-label={`Password digit ${index + 1}`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <button className="ui-kit-btn" type="submit" style={{ width: 'fit-content', minWidth: 180, justifyContent: 'center', background: 'rgba(255,255,255,.92)', color: 'var(--navy)', border: '1px solid rgba(255,255,255,.45)', borderRadius: 999, boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)' }}>Unlock App</button>
      </div>
    </form>
  )
}

export default function App() {
  useEffect(() => {
    const area = resolveAppArea()
    setDocumentManifest(area)
    const onPop = () => setDocumentManifest(resolveAppArea())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const [authMode, setAuthMode] = useState<LockMode>(() => getInitialLockMode())
  const [authed, setAuthed] = useState(() => {
    const unlocked = getGoogleAuthCookie() === '1'
    const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY) || '0')
    return unlocked && lastActive && Date.now() - lastActive <= SESSION_MAX_AGE_MS
  })

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

  const handleUnlock = (mode: LockMode) => {
    localStorage.setItem(AUTH_MODE_KEY, mode)
    setAuthMode(mode)
    setAuthed(true)
  }

  const handleLogout = () => {
    clearGoogleAuthCookie()
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
        <LockScreen mode={authMode} onUnlock={() => handleUnlock(authMode)} />
      ) : (
        <StoreProvider>
          <AppWithErrorBoundary onLogout={handleLogout} />
        </StoreProvider>
      )}
    </GoogleOAuthProvider>
  )
}
