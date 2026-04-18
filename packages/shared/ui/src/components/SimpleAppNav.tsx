import { useMemo, useState, type ReactNode } from 'react'
import { LogOut } from 'lucide-react'

const AUTH_GOOGLE_COOKIE = 'ft_google_authed'

/** Clears FinTracker-style Google session cookie + lock state and reloads (client-only guard). */
export function performGoogleAppLogout() {
  document.cookie = `${AUTH_GOOGLE_COOKIE}=; path=/; max-age=0; samesite=lax`
  try {
    localStorage.removeItem('ft_last_active')
    localStorage.removeItem('ft_email')
    localStorage.setItem('ft_lock_mode', 'google')
  } catch {
    /* ignore */
  }
  window.location.reload()
}

export type SimpleAppNavItem = {
  path: string
  label: string
  icon: ReactNode
}

export type SimpleAppNavSection = {
  heading: string
  items: SimpleAppNavItem[]
}

export type SimpleAppNavProps = {
  appName: string
  iconSrc: string
  iconAlt?: string
  barTitle: string
  currentPath: string
  onNavigate: (path: string) => void
  sections: SimpleAppNavSection[]
  settingsItem?: SimpleAppNavItem
  onLogout?: () => void
}

export default function SimpleAppNav({
  appName,
  iconSrc,
  iconAlt = '',
  barTitle,
  currentPath,
  onNavigate,
  sections,
  settingsItem,
  onLogout,
}: SimpleAppNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const normalizedPath = useMemo(() => (currentPath || '/').toLowerCase(), [currentPath])

  function go(path: string) {
    onNavigate(path)
    setDrawerOpen(false)
  }

  function isActive(path: string) {
    return normalizedPath === path.toLowerCase()
  }

  return (
    <>
      <nav className="nav">
        <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span className="nav-app-icon-wrap" aria-hidden={!iconAlt}>
            <img src={iconSrc} alt={iconAlt} className="nav-app-icon" />
          </span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{barTitle}</span>
        </span>
        <button type="button" className="nav-hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          ☰
        </button>
      </nav>
      {drawerOpen && <div className="nav-overlay" onClick={() => setDrawerOpen(false)} role="presentation" />}
      <div className={`nav-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="nav-drawer-hd">
          <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="nav-app-icon-wrap nav-app-icon-wrap--drawer" aria-hidden={!iconAlt}>
              <img src={iconSrc} alt={iconAlt} className="nav-app-icon" />
            </span>
            {appName}
          </span>
          <button type="button" className="modal-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            ×
          </button>
        </div>
        {sections.map(section => (
          <div key={section.heading} style={{ paddingTop: 8, paddingBottom: 6 }}>
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
              {section.heading}
            </div>
            {section.items.map(item => (
              <button
                key={item.path}
                type="button"
                className={`nav-drawer-item${isActive(item.path) ? ' active' : ''}`}
                onClick={() => go(item.path)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          {settingsItem && (
            <button
              type="button"
              className={`nav-drawer-item${isActive(settingsItem.path) ? ' active' : ''}`}
              onClick={() => go(settingsItem.path)}
            >
              {settingsItem.icon}
              <span>{settingsItem.label}</span>
            </button>
          )}
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
          role="presentation"
        >
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(100%, 360px)',
              padding: 16,
              borderRadius: 16,
              boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>
                  <LogOut size={18} />
                  Logout app?
                </div>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: 'var(--muted)' }}>
                  This clears only the {appName} session on this device. It will not log you out of Google.
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setLogoutConfirmOpen(false)}
                style={{ background: 'var(--bg)', color: 'var(--text)' }}
                aria-label="Close"
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
                  else performGoogleAppLogout()
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
