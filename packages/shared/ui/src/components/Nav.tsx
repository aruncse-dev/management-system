import { useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Gem,
  IndianRupee,
  Landmark,
  LayoutGrid,
  Layers3,
  LogOut,
  PiggyBank,
  Repeat2,
  Settings,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react'
import React from 'react'

export type ModuleId =
  | 'dashboard'
  | 'budget'
  | 'transactions'
  | 'credits'
  | 'accounts'
  | 'lending'
  | 'savings'
  | 'subscriptions'
  | 'bommi'
  | 'gold'
  | 'investments'
  | 'stocks'
  | 'mutualfunds'
  | 'loans'
  | 'settings'
  | 'components'

export type AppNavArea = 'finance' | 'vault'

interface Props {
  module: ModuleId
  onModule: (id: ModuleId, lendingSheetForUrl?: string) => void
  lendingSheet?: string
  onLendingSheet?: (sheet: string) => void
  title?: string
  onLogout?: () => void
  area?: AppNavArea
  appName?: string
}

const LENDING_SUBMENU = [
  { id: 'Lending', label: 'Lending', icon: <Wallet size={18} /> },
  { id: 'Vijaya Amma', label: 'Vijaya Amma', icon: <User size={18} /> },
]

function getAppAssetUrl(_area: AppNavArea, asset: string): string {
  return `/${asset.replace(/^\//, '')}`
}

function getAppIconAsset(area: AppNavArea): string {
  return area === 'vault' ? 'vault-192.png' : 'icon-192.png'
}

function brandName(area: AppNavArea) {
  return area === 'vault' ? 'Vault' : 'FinTracker'
}

type NavItem = { id: ModuleId; icon: React.ReactNode; label: string }

const TRACKING: NavItem[] = [
  { id: 'dashboard', icon: <BarChart3 size={18} />, label: 'Dashboard' },
  { id: 'budget', icon: <IndianRupee size={18} />, label: 'Budget' },
  { id: 'transactions', icon: <CalendarDays size={18} />, label: 'Transactions' },
]

const ASSETS: NavItem[] = [
  { id: 'savings', icon: <PiggyBank size={18} />, label: 'Savings' },
  { id: 'gold', icon: <Gem size={18} />, label: 'Gold' },
  { id: 'bommi', icon: <PiggyBank size={18} />, label: 'Bommi' },
  { id: 'accounts', icon: <Landmark size={18} />, label: 'Accounts' },
]

const INVESTMENTS: NavItem[] = [
  { id: 'investments', icon: <TrendingUp size={18} />, label: 'Investments' },
  { id: 'stocks', icon: <TrendingUp size={18} />, label: 'Stocks' },
  { id: 'mutualfunds', icon: <TrendingUp size={18} />, label: 'Mutual Funds' },
]

const CREDIT_EXTRA: NavItem[] = [{ id: 'loans', icon: <Layers3 size={18} />, label: 'All Loans' }, { id: 'credits', icon: <CreditCard size={18} />, label: 'Credits' }]

const SERVICES: NavItem[] = [{ id: 'subscriptions', icon: <Repeat2 size={18} />, label: 'Subscriptions' }]

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

  function section(titleLabel: string, items: NavItem[]) {
    return (
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
          {titleLabel}
        </div>
        {items.map(m => (
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
    )
  }

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

        {section('Tracking', TRACKING)}
        {section('Assets', ASSETS)}
        {section('Investments', INVESTMENTS)}

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
            Credit
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
          {CREDIT_EXTRA.map(m => (
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

        {section('Services', SERVICES)}

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
              onModule('components')
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
