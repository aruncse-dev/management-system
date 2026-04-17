import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Grid2X2, Landmark, LogOut, Settings as SettingsIcon, Shield } from 'lucide-react'

type VaultPage = 'banking' | 'insurance' | 'apps' | 'settings'

const ROUTES: Record<VaultPage, string> = {
  banking: '/Vault',
  insurance: '/VaultInsurance',
  apps: '/VaultApps',
  settings: '/VaultSettings',
}

const AUTH_GOOGLE_COOKIE = 'ft_google_authed'

function getAppAssetUrl(asset: string): string {
  return `/${asset.replace(/^\//, '')}`
}

function getAppIconAsset(): string {
  return 'vault-192.png'
}

function pathToVaultPage(pathname: string): VaultPage {
  const p = pathname.toLowerCase()
  if (p === '/vaultinsurance') return 'insurance'
  if (p === '/vaultapps') return 'apps'
  if (p === '/vaultsettings') return 'settings'
  return 'banking'
}

function pageTitle(page: VaultPage): string {
  if (page === 'banking') return 'Banking'
  if (page === 'insurance') return 'Insurance'
  if (page === 'apps') return 'Apps'
  return 'Settings'
}

function clearGoogleAuthCookie() {
  document.cookie = `${AUTH_GOOGLE_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function performVaultLogout() {
  clearGoogleAuthCookie()
  try {
    localStorage.removeItem('ft_last_active')
    localStorage.removeItem('ft_email')
    localStorage.setItem('ft_lock_mode', 'google')
  } catch {
    // ignore
  }
  window.location.reload()
}

export default function VaultNav({ onLogout }: { onLogout?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const currentPage = useMemo(() => pathToVaultPage(router.pathname || '/Vault'), [router.pathname])

  const iconSrc = getAppAssetUrl(getAppIconAsset())

  function go(page: VaultPage) {
    void router.push(ROUTES[page])
    setOpen(false)
  }

  return (
    <>
      <nav className="nav">
        <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <img
            src={iconSrc}
            width="30"
            height="30"
            alt="Vault"
            style={{ borderRadius: 8, flexShrink: 0, objectFit: 'contain', background: '#1E5CC7' }}
          />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{pageTitle(currentPage)}</span>
        </span>
        <button type="button" className="nav-hamburger" onClick={() => setOpen(true)}>
          ☰
        </button>
      </nav>
      {open && <div className="nav-overlay" onClick={() => setOpen(false)} />}
      <div className={`nav-drawer${open ? ' open' : ''}`}>
        <div className="nav-drawer-hd">
          <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <img
              src={iconSrc}
              width="28"
              height="28"
              alt="Vault"
              style={{ borderRadius: 7, flexShrink: 0, objectFit: 'contain', background: '#1E5CC7' }}
            />
            Vault
          </span>
          <button type="button" className="modal-close" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>
        <div style={{ paddingTop: 8, paddingBottom: 6 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '.04em',
              padding: '8px 14px 4px 14px',
              marginBottom: 2,
            }}
          >
            Vault
          </div>
          <button
            type="button"
            className={`nav-drawer-item${currentPage === 'banking' ? ' active' : ''}`}
            onClick={() => go('banking')}
          >
            <Landmark size={18} />
            <span>Banking</span>
          </button>
          <button
            type="button"
            className={`nav-drawer-item${currentPage === 'insurance' ? ' active' : ''}`}
            onClick={() => go('insurance')}
          >
            <Shield size={18} />
            <span>Insurance</span>
          </button>
          <button
            type="button"
            className={`nav-drawer-item${currentPage === 'apps' ? ' active' : ''}`}
            onClick={() => go('apps')}
          >
            <Grid2X2 size={18} />
            <span>Apps</span>
          </button>
        </div>
        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          <button
            type="button"
            className={`nav-drawer-item${currentPage === 'settings' ? ' active' : ''}`}
            onClick={() => go('settings')}
          >
            <SettingsIcon size={18} />
            <span>Settings</span>
          </button>
          <button type="button" className="nav-drawer-item" onClick={() => setLogoutConfirmOpen(true)}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {logoutConfirmOpen && (
        <div
          className="modal-bg open"
          onClick={() => setLogoutConfirmOpen(false)}
          style={{ alignItems: 'center', padding: '24px 16px' }}
        >
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
              <button
                type="button"
                className="modal-close"
                onClick={() => setLogoutConfirmOpen(false)}
                style={{ background: 'var(--bg)', color: 'var(--text)' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="settings-action-btn" onClick={() => setLogoutConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-action-btn"
                onClick={() => {
                  setLogoutConfirmOpen(false)
                  if (onLogout) onLogout()
                  else performVaultLogout()
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
