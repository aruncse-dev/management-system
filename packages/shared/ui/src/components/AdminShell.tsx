import type { ReactNode } from 'react'

export function FabButton({
  label,
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children?: ReactNode }) {
  return (
    <button type="button" className={`admin-fab ${className}`.trim()} aria-label={label} title={label} {...rest}>
      {children ?? '+'}
    </button>
  )
}

export function FormCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string
  subtitle?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`admin-card${className ? ` ${className}` : ''}`.trim()}>
      {title ? <h2>{title}</h2> : null}
      {subtitle ? <div className="admin-hint">{subtitle}</div> : null}
      {children}
    </section>
  )
}

export function DataPageHeader({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <header className="admin-header">
      <h1>{title}</h1>
      {right ? <div className="admin-header__right">{right}</div> : null}
    </header>
  )
}

export function AdminDataListSearch({
  itemCount,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  itemCount: number
  value: string
  onChange: (v: string) => void
  placeholder: string
  ariaLabel: string
}) {
  if (itemCount <= 5) return null
  return (
    <div className="admin-search" style={{ marginTop: 10, marginBottom: 6 }}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
    </div>
  )
}
