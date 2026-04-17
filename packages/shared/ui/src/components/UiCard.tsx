import { type ReactNode } from 'react'

export function UiCard({
  title,
  subtitle,
  icon,
  right,
  children,
}: {
  title?: ReactNode
  subtitle?: string
  icon?: ReactNode
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="ui-kit-card">
      {(title || subtitle || icon || right) && (
        <div className="ui-kit-card-hd">
          <div>
            {title && (
              <div className="ui-kit-card-title">
                {icon && <span className="ui-kit-section-icon">{icon}</span>}
                {title}
              </div>
            )}
            {subtitle && <div className="ui-kit-card-subtitle">{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      <div className="ui-kit-card-body">{children}</div>
    </section>
  )
}
