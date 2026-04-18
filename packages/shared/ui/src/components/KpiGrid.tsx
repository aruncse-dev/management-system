import type { CSSProperties, ReactNode } from 'react'

export type KpiGridVariant = 'dash' | 'compact'

const GRID_CLASS: Record<KpiGridVariant, string> = {
  /** 2 columns, 12px gap — dashboard metrics (savings, gold, loans, …). */
  dash: 'dash-grid',
  /** 2 columns, 8px gap — tighter budget / accounts style rows. */
  compact: 'kpis',
}

export function KpiGrid({
  children,
  variant = 'dash',
  className = '',
  style,
}: {
  children: ReactNode
  variant?: KpiGridVariant
  className?: string
  style?: CSSProperties
}) {
  const cls = [GRID_CLASS[variant], className.trim()].filter(Boolean).join(' ')
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  )
}
