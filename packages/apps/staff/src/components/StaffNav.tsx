import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { CalendarDays, LogOut, Settings as SettingsIcon, Users } from 'lucide-react'

type StaffPage = 'attendance' | 'staffs' | 'settings'

const ROUTES: Record<StaffPage, string> = {
  attendance: '/attendance',
  staffs: '/staffs',
  settings: '/settings',
}

const STAFF_NAV_ICON_SRC = '/icon-192.png'

const staffNavBrandImgStyle = {
  borderRadius: '50%',
  flexShrink: 0,
  objectFit: 'contain' as const,
  display: 'block' as const,
}

const AUTH_GOOGLE_COOKIE = 'ft_google_authed'

function pathToStaffPage(pathname: string): StaffPage {
  const p = pathname.toLowerCase()
  if (p === '/staffs') return 'staffs'
  if (p === '/settings') return 'settings'
  return 'attendance'
}

function pageTitle(page: StaffPage): string {
  if (page === 'staffs') return 'Staffs'
  if (page === 'settings') return 'Settings'
  return 'Attendance'
}

export function performStaffLogout() {
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

export default function StaffNav({ onLogout }: { onLogout?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const currentPage = useMemo(() => pathToStaffPage(router.pathname || '/attendance'), [router.pathname])

  function go(page: StaffPage) {
    void router.push(ROUTES[page])
    setOpen(false)
  }

  return (
    <>
      <nav className="nav">
        <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <img
            src={STAFF_NAV_ICON_SRC}
            width={30}
            height={30}
            alt=""
            style={staffNavBrandImgStyle}
            aria-hidden
          />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{pageTitle(currentPage)}</span>
        </span>
        <button type="button" className="nav-hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
          ☰
        </button>
      </nav>
      {open && <div className="nav-overlay" onClick={() => setOpen(false)} role="presentation" />}
      <div className={`nav-drawer${open ? ' open' : ''}`}>
        <div className="nav-drawer-hd">
          <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <img
              src={STAFF_NAV_ICON_SRC}
              width={28}
              height={28}
              alt=""
              style={staffNavBrandImgStyle}
              aria-hidden
            />
            Staff
          </span>
          <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="Close menu">
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
            Menu
          </div>
          <button
            type="button"
            className={`nav-drawer-item${currentPage === 'attendance' ? ' active' : ''}`}
            onClick={() => go('attendance')}
          >
            <CalendarDays size={18} />
            <span>Attendance</span>
          </button>
          <button
            type="button"
            className={`nav-drawer-item${currentPage === 'staffs' ? ' active' : ''}`}
            onClick={() => go('staffs')}
          >
            <Users size={18} />
            <span>Staffs</span>
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
                  This clears only the Staff session on this device. It will not log you out of Google.
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
                  else performStaffLogout()
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
