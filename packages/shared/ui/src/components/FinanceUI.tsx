import { type ReactNode } from 'react'

type Tone = 'green' | 'red' | 'amber' | 'navy' | 'muted'

export function UiHero({
  eyebrow,
  title,
  subtitle,
  right,
  children,
  tone = 'navy',
}: {
  eyebrow: string
  title: string
  subtitle?: string
  right?: ReactNode
  children?: ReactNode
  tone?: Tone
}) {
  return (
    <section className={`ui-hero ui-tone-${tone}`}>
      <div className="ui-hero-top">
        <div>
          <div className="ui-eyebrow">{eyebrow}</div>
          <div className="ui-title">{title}</div>
          {subtitle && <div className="ui-subtitle">{subtitle}</div>}
        </div>
        {right && <div className="ui-hero-right">{right}</div>}
      </div>
      {children && <div className="ui-hero-body">{children}</div>}
    </section>
  )
}

export function UiMetric({
  label,
  value,
  hint,
  icon,
  tone = 'navy',
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
  tone?: Tone
}) {
  return (
    <article className={`ui-metric ui-tone-${tone}`}>
      <div className="ui-metric-top">
        <span className="ui-metric-icon">{icon}</span>
        <span className="ui-metric-label">{label}</span>
      </div>
      <div className="ui-metric-value">{value}</div>
      <div className="ui-metric-hint">{hint}</div>
    </article>
  )
}

export function UiPanel({
  title,
  subtitle,
  icon,
  right,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  icon?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  const hasHeader = Boolean(title || subtitle || icon || right)
  return (
    <section className={`ui-panel ${className}`.trim()}>
      {hasHeader && (
        <div className="ui-panel-hd">
          <div className="ui-panel-title-wrap">
            {title && (
              <div className="ui-panel-title">
                {icon && <span className="ui-panel-icon">{icon}</span>}
                <span>{title}</span>
              </div>
            )}
            {subtitle && <div className="ui-panel-subtitle">{subtitle}</div>}
          </div>
          {right && <div className="ui-panel-right">{right}</div>}
        </div>
      )}
      <div className="ui-panel-body">{children}</div>
    </section>
  )
}

export function UiPill({
  children,
  tone = 'navy',
}: {
  children: ReactNode
  tone?: Tone
}) {
  return <span className={`ui-pill ui-tone-${tone}`}>{children}</span>
}

export function UiSection({
  title,
  subtitle,
  icon,
  right,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="ui-section">
      <div className="ui-section-title-wrap">
        <div className="ui-section-title">
          {icon && <span className="ui-section-icon">{icon}</span>}
          <span>{title}</span>
        </div>
        {subtitle && <div className="ui-section-subtitle">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

export function UiSheet({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="sheet-panel" onClick={e => e.stopPropagation()}>
      <div className="sheet-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {icon && <span className="ui-sheet-icon">{icon}</span>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{title}</div>
              {subtitle && <div className="dash-credit-summary-sub">{subtitle}</div>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
      {footer}
    </div>
  )
}
