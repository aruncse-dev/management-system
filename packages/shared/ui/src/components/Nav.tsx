import { useState } from 'react'
import {
  CalendarDays,
  PiggyBank,
  Gem,
  TrendingUp,
  Repeat2,
  Wallet,
  User,
  Settings,
  LayoutGrid,
  LogOut,
  Layers3,
} from 'lucide-react'
import React from 'react'

export type ModuleId =
  | 'monthly'
  | 'lending'
  | 'savings'
  | 'subscriptions'
  | 'bommi'
  | 'gold'
  | 'investments'
  | 'loans'
  | 'settings'
  | 'components'

export type AppNavArea = 'finance' | 'vault'

interface Props {
  module: ModuleId
  /** Optional lending sheet for this navigation (avoids stale state when opening Balances submenu). */
  onModule: (id: ModuleId, lendingSheetForUrl?: string) => void
  lendingSheet?: string
  onLendingSheet?: (sheet: string) => void
  title?: string
  onLogout?: () => void
  /** Drives default icon file (`finance` vs `vault`). */
  area?: AppNavArea
  /** Display name in drawer / alt text (defaults from `area`). */
  appName?: string
}

const MODULES_LG: { id: ModuleId; icon: React.ReactNode; label: string }[] = [
  { id: 'monthly', icon: <CalendarDays size={18} />, label: 'Monthly Expenses' },
  { id: 'savings', icon: <PiggyBank size={18} />, label: 'Savings' },
  { id: 'subscriptions', icon: <Repeat2 size={18} />, label: 'Subscriptions' },
  { id: 'bommi', icon: <PiggyBank size={18} />, label: 'Bommi' },
  { id: 'gold', icon: <Gem size={18} />, label: 'Gold' },
  { id: 'investments', icon: <TrendingUp size={18} />, label: 'Investments' },
]

const LENDING_SUBMENU = [
  { id: 'Lending', label: 'Lending', icon: <Wallet size={18} /> },
  { id: 'Vijaya Amma', label: 'Vijaya Amma', icon: <User size={18} /> },
]

/** Public URL for a static asset (same contract as app `getAppAssetUrl`). */
function getAppAssetUrl(_area: AppNavArea, asset: string): string {
  return `/${asset.replace(/^\//, '')}`
}

function getAppIconAsset(area: AppNavArea): string {
  return area === 'vault' ? 'vault-192.png' : 'icon-192.png'
}

function brandName(area: AppNavArea) {
  return area === 'vault' ? 'Vault' : 'FinTracker'
}

export default function Nav({
  module,
  onModule,
  lendingSheet,
  onLendingSheet,
  title,
  onLogout,
  area = 'finance',
  appName,
}: Props) {
  const name = appName ?? brandName(area)
  const iconSrc = getAppAssetUrl(area, getAppIconAsset(area))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  return (
    <>
      <nav className="nav">
        <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span className="nav-app-icon-wrap">
            <img src={iconSrc} alt={name} className="nav-app-icon" />
          </span>
          {title && <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>}
        </span>

        <button type="button" className="nav-hamburger" onClick={() => setDrawerOpen(true)}>
          ☰
        </button>
      </nav>

      {drawerOpen && <div className="nav-overlay" onClick={() => setDrawerOpen(false)} />}

      <div className={`nav-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="nav-drawer-hd">
          <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="nav-app-icon-wrap nav-app-icon-wrap--drawer">
              <img src={iconSrc} alt={name} className="nav-app-icon" />
            </span>
            {name}
          </span>
          <button type="button" className="modal-close" onClick={() => setDrawerOpen(false)}>
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
            Tracking
          </div>
          {MODULES_LG.slice(0, 3).map(m => (
            <button
              key={m.id}
              type="button"
              className={`nav-drawer-item${module === m.id ? ' active' : ''}`}
              onClick={() => {
                onModule(m.id)
                setDrawerOpen(false)
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
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
            Assets
          </div>
          {MODULES_LG.slice(3).map(m => (
            <button
              key={m.id}
              type="button"
              className={`nav-drawer-item${module === m.id ? ' active' : ''}`}
              onClick={() => {
                onModule(m.id)
                setDrawerOpen(false)
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
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
            Balances
          </div>

          {onLendingSheet && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {LENDING_SUBMENU.map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  className={`nav-drawer-item${module === 'lending' && lendingSheet === sub.id ? ' active' : ''}`}
                  onClick={() => {
                    onLendingSheet(sub.id)
                    onModule('lending', sub.id)
                    setDrawerOpen(false)
                  }}
                >
                  {sub.icon}
                  <span>{sub.label}</span>
                </button>
              ))}
            </div>
          )}
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
            Loans
          </div>
          <button
            type="button"
            className={`nav-drawer-item${module === 'loans' ? ' active' : ''}`}
            onClick={() => {
              onModule('loans')
              setDrawerOpen(false)
            }}
          >
            <Layers3 size={18} />
            <span>All Loans</span>
          </button>
        </div>

        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          <button
            type="button"
            className={`nav-drawer-item${module === 'settings' ? ' active' : ''}`}
            onClick={() => {
              onModule('settings')
              setDrawerOpen(false)
            }}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className={`nav-drawer-item${module === 'components' ? ' active' : ''}`}
            onClick={() => {
              onModule('components' as ModuleId)
              setDrawerOpen(false)
            }}
          >
            <LayoutGrid size={18} />
            <span>UI Kit</span>
          </button>
          {onLogout && (
            <button type="button" className="nav-drawer-item" onClick={() => setLogoutConfirmOpen(true)}>
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>

      {logoutConfirmOpen && onLogout && (
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
                  This clears only the {name} session on this device. It will not log you out of Google.
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
