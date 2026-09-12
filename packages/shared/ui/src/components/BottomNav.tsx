import React from 'react'
import { LayoutDashboard, ArrowLeftRight, Target } from 'lucide-react'

type TabId = 'dash' | 'txns' | 'bud'

interface Props {
  tab: TabId
  onTab: (id: TabId) => void
  /** FinTracker uses `bottom-nav`; legacy vault markup uses `tab-bar`. */
  variant?: 'fintracker' | 'vault'
}

const TABS: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'dash', icon: <LayoutDashboard size={19} />, label: 'Dashboard' },
  { id: 'txns', icon: <ArrowLeftRight size={19} />, label: 'Transactions' },
  { id: 'bud', icon: <Target size={19} />, label: 'Budget' },
]

export default function BottomNav({ tab, onTab, variant = 'fintracker' }: Props) {
  const navCls = variant === 'vault' ? 'tab-bar' : 'bottom-nav'
  const itemCls = variant === 'vault' ? 'tab-item' : 'bottom-nav-item'
  const iconCls = variant === 'vault' ? 'tab-icon' : 'bottom-nav-icon'

  return (
    <nav className={navCls}>
      {TABS.map(t => (
        <button
          key={t.id}
          type="button"
          className={`${itemCls}${tab === t.id ? ' active' : ''}`}
          onClick={() => onTab(t.id)}
        >
          <span className={iconCls}>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
