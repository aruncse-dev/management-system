import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Gem,
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
import { DynamicLucide } from './DynamicLucide'

export type ModuleId =
  | 'dashboard'
  | 'budget'
  | 'transactions'
  | 'credits'
  | 'accounts'
  | 'lending'
  | 'savings'
  | 'subscriptions'
  | 'gold'
  | 'investments'
  | 'stocks'
  | 'mutualfunds'
  | 'loans'
  | 'settings'
  | 'components'

export type AppNavArea = 'finance' | 'vault'

export type NavDynamicMenuItem = {
  id: string
  label: string
  icon: string | null
  path: string
}

export type NavDynamicMenuSection = {
  sectionLabel: string
  items: NavDynamicMenuItem[]
}

/** Shown in drawer footer; omit from org-driven sections to avoid duplicates. */
function isFooterOnlyMenuItem(m: NavDynamicMenuItem): boolean {
  if (m.id === 'settings' || m.id === 'components') return true
  const p = m.path.trim()
  return (
    p === '/settings' ||
    p.startsWith('/settings?') ||
    p === '/components' ||
    p.startsWith('/components?')
  )
}

function pathDrawerActive(currentAsPath: string, itemPath: string) {
  const c = currentAsPath.trim()
  const t = itemPath.trim()
  if (c === t) return true
  const [cPath, cQuery] = c.split('?')
  const [tPath, tQuery] = t.split('?')
  if (cPath !== tPath) return false
  // Item is path-only: active only when the browser URL has no query (e.g. /lending must not match /lending?sheet=vijaya-amma).
  if (!tQuery) return !cQuery?.trim()
  const cParams = new URLSearchParams(cQuery || '')
  const tParams = new URLSearchParams(tQuery)
  for (const [k, v] of tParams) {
    if (cParams.get(k) !== v) return false
  }
  return true
}

interface Props {
  module: ModuleId
  onModule: (id: ModuleId, lendingSheetForUrl?: string) => void
  lendingSheet?: string
  onLendingSheet?: (sheet: string) => void
  title?: string
  onLogout?: () => void
  area?: AppNavArea
  appName?: string
  /** Org-driven sections (may be empty ⇒ only Settings, UI Kit, Logout). */
  dynamicMenu?: NavDynamicMenuSection[] | null
  /** Path for active state when using `dynamicMenu` (e.g. `router.asPath`). */
  activeAsPath?: string
  /** Navigate for `dynamicMenu` items. */
  onNavigatePath?: (path: string) => void
}

const LENDING_SUBMENU = [
  { id: 'lending', label: 'Lending', icon: <Wallet size={18} /> },
  { id: 'vijaya-amma', label: 'Vijaya Amma', icon: <User size={18} /> },
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

type NavItem = {
  id: ModuleId
  icon: React.ReactNode
  label: string
  /** Drawer highlight when current module is any of these (routes/pages unchanged). */
  activeFor?: readonly ModuleId[]
}

function navItemActive(current: ModuleId, item: NavItem) {
  if (item.activeFor?.length) return item.activeFor.includes(current)
  return current === item.id
}

const TRACKING: NavItem[] = [
  {
    id: 'dashboard',
    icon: <CalendarDays size={18} />,
    label: 'Monthly Expenses',
    activeFor: ['dashboard', 'budget', 'transactions'],
  },
]

const ASSETS: NavItem[] = [
  { id: 'savings', icon: <PiggyBank size={18} />, label: 'Savings' },
  { id: 'gold', icon: <Gem size={18} />, label: 'Gold' },
]

const INVESTMENTS: NavItem[] = [
  {
    id: 'investments',
    icon: <TrendingUp size={18} />,
    label: 'Stocks & Mutual Funds',
    activeFor: ['investments', 'stocks', 'mutualfunds'],
  },
]

const CREDIT_EXTRA: NavItem[] = [{ id: 'loans', icon: <Layers3 size={18} />, label: 'All Loans' }]

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
  dynamicMenu,
  activeAsPath = '',
  onNavigatePath,
}: Props) {
  const name = appName ?? brandName(area)
  const iconSrc = getAppAssetUrl(area, getAppIconAsset(area))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  /** Path-based org menu: always use this layout when `onNavigatePath` is set (empty sections ⇒ minimal drawer). */
  const useOrgPathMenu = Boolean(onNavigatePath)
  const dynamicMenuForDrawer = useMemo(() => {
    const src = dynamicMenu ?? []
    return src
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((m) => !isFooterOnlyMenuItem(m)),
      }))
      .filter((sec) => sec.items.length > 0)
  }, [dynamicMenu])

  function dynamicSection(titleLabel: string, items: NavDynamicMenuItem[]) {
    return (
      <div style={{ paddingTop: 8, paddingBottom: 6 }} key={titleLabel}>
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
            className={`nav-drawer-item${pathDrawerActive(activeAsPath, m.path) ? ' active' : ''}`}
            onClick={() => {
              onNavigatePath?.(m.path)
              setDrawerOpen(false)
            }}
          >
            <DynamicLucide name={m.icon} size={18} />
            <span>{m.label}</span>
          </button>
        ))}
      </div>
    )
  }

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
            className={`nav-drawer-item${navItemActive(module, m) ? ' active' : ''}`}
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

        {useOrgPathMenu ? (
          <>
            {dynamicMenuForDrawer.map(sec => dynamicSection(sec.sectionLabel, sec.items))}
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
          </>
        ) : (
          <>
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
                  className={`nav-drawer-item${navItemActive(module, m) ? ' active' : ''}`}
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
          </>
        )}
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
