import { useState } from 'react'
import { CalendarDays, PiggyBank, Gem, TrendingUp, BarChart2, Wallet, User, Settings, CreditCard, Landmark, Banknote } from 'lucide-react'
import React from 'react'

export type ModuleId = 'monthly' | 'lending' | 'savings' | 'gold' | 'stocks' | 'mutualfunds' | 'emi' | 'jewelLoans' | 'cashLoans' | 'settings'

interface Props {
  module: ModuleId
  onModule: (id: ModuleId) => void
  lendingSheet?: string
  onLendingSheet?: (sheet: string) => void
  title?: string
}

const MODULES_LG: { id: ModuleId; icon: React.ReactNode; label: string }[] = [
  { id: 'monthly',     icon: <CalendarDays size={18} />, label: 'Monthly Expenses' },
  { id: 'savings',     icon: <PiggyBank size={18} />,    label: 'Savings' },
  { id: 'gold',        icon: <Gem size={18} />,          label: 'Gold' },
  { id: 'stocks',      icon: <TrendingUp size={18} />,   label: 'Stocks' },
  { id: 'mutualfunds', icon: <BarChart2 size={18} />,    label: 'Mutual Funds' },
]

const LENDING_SUBMENU = [
  { id: 'Lending', label: 'Lending', icon: <Wallet size={18} /> },
  { id: 'Vijaya Amma', label: 'Vijaya Amma', icon: <User size={18} /> },
]

export default function Nav({ module, onModule, lendingSheet, onLendingSheet, title }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

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
        </div>
      </div>
    </>
  )
}
