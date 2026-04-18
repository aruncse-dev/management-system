import type { ReactNode } from 'react'
import type { UiTone } from './uiTone'

/** Default Lucide icon size for KPI headers (matches FinTracker savings-style cards). */
export const KPI_ICON_SIZE = 14 as const

export type KpiCardProps = {
  label: string
  value: ReactNode
  icon?: ReactNode
  subtitle?: string
  tone?: UiTone
  accentTone?: Extract<UiTone, 'green' | 'red'>
  full?: boolean
  onClick?: () => void
  className?: string
}

/**
 * Metric tile: `ui-kit-card ui-kit-kpi` + label row (optional icon) + value + optional subtitle.
 * Use inside {@link KpiGrid} for consistent spacing.
 */
export function KpiCard({
  label,
  value,
  icon,
  subtitle,
  tone = 'navy',
  accentTone,
  full = false,
  onClick,
  className = '',
}: KpiCardProps) {
  const rootClass = [
    'ui-kit-card',
    'ui-kit-kpi',
    `ui-tone-${tone}`,
    accentTone ? `ui-kit-kpi--accent-${accentTone}` : '',
    full ? 'ui-kit-kpi--full' : '',
    className.trim(),
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="ui-kit-kpi-hd">
        <div className={`ui-kit-kpi-head${icon ? ' has-icon' : ' no-icon'}`}>
          {icon && <div className="ui-kit-kpi-icon">{icon}</div>}
          <div className="ui-kit-kpi-label">{label}</div>
        </div>
      </div>
      <div className="kpi-card-v kpi-card-v-soft">{value}</div>
      {subtitle ? <div className="ui-kit-kpi-sub">{subtitle}</div> : null}
    </div>
  )
}
