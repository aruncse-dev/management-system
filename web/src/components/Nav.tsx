import { useState } from 'react'
import { CalendarDays, PiggyBank, Gem, TrendingUp, Wallet, User, Settings, CreditCard, Landmark, Banknote, LayoutGrid, LogOut } from 'lucide-react'
import React from 'react'

export type ModuleId = 'monthly' | 'lending' | 'savings' | 'gold' | 'investments' | 'emi' | 'jewelLoans' | 'cashLoans' | 'settings' | 'components'

interface Props {
  module: ModuleId
  onModule: (id: ModuleId) => void
  lendingSheet?: string
  onLendingSheet?: (sheet: string) => void
  title?: string
  onLogout?: () => void
}

const MODULES_LG: { id: ModuleId; icon: React.ReactNode; label: string }[] = [
  { id: 'monthly',     icon: <CalendarDays size={18} />, label: 'Monthly Expenses' },
  { id: 'savings',     icon: <PiggyBank size={18} />,    label: 'Savings' },
  { id: 'gold',        icon: <Gem size={18} />,          label: 'Gold' },
  { id: 'investments', icon: <TrendingUp size={18} />,   label: 'Investments' },
]

const LENDING_SUBMENU = [
  { id: 'Lending', label: 'Lending', icon: <Wallet size={18} /> },
  { id: 'Vijaya Amma', label: 'Vijaya Amma', icon: <User size={18} /> },
]

export default function Nav({ module, onModule, lendingSheet, onLendingSheet, title, onLogout }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  return (
    <>
      <nav className="nav">
        {/* Brand — left */}
        <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <img src="./apple-touch-icon.png" width="30" height="30" alt="FinTracker" style={{borderRadius:8,flexShrink:0,objectFit:'contain',background:'#1E3A8A'}} />
          {title && <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>}
        </span>

        {/* Hamburger */}
        <button className="nav-hamburger" onClick={() => setDrawerOpen(true)}>☰</button>
      </nav>

      {/* Overlay — closes drawer on outside click */}
      {drawerOpen && <div className="nav-overlay" onClick={() => setDrawerOpen(false)} />}

      {/* Drawer panel */}
      <div className={`nav-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="nav-drawer-hd">
          <span className="nav-b" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <img src="./apple-touch-icon.png" width="28" height="28" alt="FinTracker" style={{borderRadius:7,flexShrink:0,objectFit:'contain',background:'#1E3A8A'}} />
            FinTracker
          </span>
          <button className="modal-close" onClick={() => setDrawerOpen(false)}>×</button>
        </div>

        {/* Primary Section — Tracking */}
        <div style={{ paddingTop: 8, paddingBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '8px 14px 4px 14px', marginBottom: 2 }}>
            Tracking
          </div>
          {MODULES_LG.slice(0, 2).map(m => (
            <button
              key={m.id}
              className={`nav-drawer-item${module === m.id ? ' active' : ''}`}
              onClick={() => { onModule(m.id); setDrawerOpen(false) }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Assets Section */}
        <div style={{ paddingTop: 8, paddingBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '8px 14px 4px 14px', marginBottom: 2 }}>
            Assets
          </div>
          {MODULES_LG.slice(2).map(m => (
            <button
              key={m.id}
              className={`nav-drawer-item${module === m.id ? ' active' : ''}`}
              onClick={() => { onModule(m.id); setDrawerOpen(false) }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Balances Section */}
        <div style={{ paddingTop: 8, paddingBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '8px 14px 4px 14px', marginBottom: 2 }}>
            Balances
          </div>

          {/* Lending Submenu Items */}
          {onLendingSheet && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {LENDING_SUBMENU.map(sub => (
                <button
                  key={sub.id}
                  className={`nav-drawer-item${module === 'lending' && lendingSheet === sub.id ? ' active' : ''}`}
                  onClick={() => { onModule('lending'); onLendingSheet(sub.id); setDrawerOpen(false) }}
                >
                  {sub.icon}
                  <span>{sub.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loans Section */}
        <div style={{ paddingTop: 8, paddingBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '8px 14px 4px 14px', marginBottom: 2 }}>
            Loans
          </div>
          <button
            className={`nav-drawer-item${module === 'emi' ? ' active' : ''}`}
            onClick={() => { onModule('emi'); setDrawerOpen(false) }}
          >
            <CreditCard size={18} />
            <span>EMI Loans</span>
          </button>
          <button
            className={`nav-drawer-item${module === 'jewelLoans' ? ' active' : ''}`}
            onClick={() => { onModule('jewelLoans'); setDrawerOpen(false) }}
          >
            <Landmark size={18} />
            <span>Jewel Loans</span>
          </button>
          <button
            className={`nav-drawer-item${module === 'cashLoans' ? ' active' : ''}`}
            onClick={() => { onModule('cashLoans'); setDrawerOpen(false) }}
          >
            <Banknote size={18} />
            <span>Cash Loans</span>
          </button>
        </div>

        {/* Settings Section */}
        <div style={{ paddingTop: 12, paddingBottom: 8 }}>
          <button
            className={`nav-drawer-item${module === 'settings' ? ' active' : ''}`}
            onClick={() => { onModule('settings'); setDrawerOpen(false) }}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button
            className={`nav-drawer-item${module === 'components' ? ' active' : ''}`}
            onClick={() => { onModule('components' as ModuleId); setDrawerOpen(false) }}
          >
            <LayoutGrid size={18} />
            <span>UI Kit</span>
          </button>
          {onLogout && (
            <button
              className="nav-drawer-item"
              onClick={() => setLogoutConfirmOpen(true)}
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>

      {logoutConfirmOpen && onLogout && (
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
                  This clears only the FinTracker session on this device. It will not log you out of Google.
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
