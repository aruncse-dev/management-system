import { type ReactNode } from 'react'

export type UiTone = 'navy' | 'green' | 'red' | 'amber' | 'muted'

export function SectionTitle({
  title,
  subtitle,
  icon,
  right,
  rightChip,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  right?: ReactNode
  rightChip?: ReactNode
}) {
  return (
    <div className="ui-kit-section">
      <div className="ui-kit-section-left">
        <div className="ui-kit-section-title">
          {icon && <span className="ui-kit-section-icon">{icon}</span>}
          <span>{title}</span>
        </div>
        {subtitle && <div className="ui-kit-section-subtitle">{subtitle}</div>}
      </div>
      {(right || rightChip) && (
        <div className="ui-kit-section-right">
          {right}
          {rightChip}
        </div>
      )}
    </div>
  )
}

export function SectionBlock({
  title,
  subtitle,
  icon,
  right,
  rightChip,
  children,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  right?: ReactNode
  rightChip?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="ui-kit-section-block">
      <SectionTitle title={title} subtitle={subtitle} icon={icon} right={right} rightChip={rightChip} />
      <Spacer size={4} />
      <div className="ui-kit-section-body">{children}</div>
    </section>
  )
}

export function Spacer({
  size = 8,
}: {
  size?: number
}) {
  return <div style={{ height: size, flexShrink: 0 }} />
}

export function KpiCard({
  label,
  value,
  icon,
  subtitle,
  tone = 'navy',
  accentTone,
  full = false,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  subtitle?: string
  tone?: UiTone
  accentTone?: Extract<UiTone, 'green' | 'red'>
  full?: boolean
}) {
  return (
    <div className={`ui-kit-card ui-kit-kpi ui-tone-${tone}${accentTone ? ` ui-kit-kpi--accent-${accentTone}` : ''}${full ? ' ui-kit-kpi--full' : ''}`}>
      <div className="ui-kit-kpi-hd">
        <div className={`ui-kit-kpi-head${icon ? ' has-icon' : ' no-icon'}`}>
          {icon && <div className="ui-kit-kpi-icon">{icon}</div>}
          <div className="ui-kit-kpi-label">{label}</div>
        </div>
      </div>
      <div className="kpi-card-v kpi-card-v-soft">{value}</div>
      {subtitle && <div className="ui-kit-kpi-sub">{subtitle}</div>}
    </div>
  )
}

export function MetricGroup({
  title,
  icon,
  right,
  subtitle,
  children,
}: {
  title: string
  icon?: ReactNode
  right?: ReactNode
  subtitle?: string
  children: ReactNode
}) {
  return (
    <UiCard title={title} icon={icon} right={right} subtitle={subtitle}>
      <div className="ui-kit-metric-group">{children}</div>
    </UiCard>
  )
}

export function SectionBadge({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: UiTone
}) {
  return <span className={`ui-kit-badge ui-tone-${tone}`}>{children}</span>
}

export function SectionChip({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: UiTone
}) {
  return <span className={`ui-kit-section-chip ui-tone-${tone}`}>{children}</span>
}

export function Chip({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: UiTone
}) {
  return <span className={`ui-kit-chip ui-tone-${tone}`}>{children}</span>
}

export function FilterPills({
  items,
  active,
  onChange,
  onClear,
}: {
  items: string[]
  active: string
  onChange: (id: string) => void
  onClear?: () => void
}) {
  return (
    <div className="ui-kit-filter-row">
      {onClear && active && (
        <button type="button" className="ui-kit-filter-pill ui-kit-filter-pill--active" onClick={onClear}>
          {active} ×
        </button>
      )}
      {items.map(item => (
        <button
          key={item}
          type="button"
          className={`ui-kit-filter-pill${active === item ? ' active' : ''}`}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

export function FilterChips({
  items,
  active,
  onChange,
}: {
  items: string[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="ui-kit-filter-chips">
      {items.map(item => (
        <button
          key={item}
          type="button"
          className={`ui-kit-filter-chip${active === item ? ' active' : ''}`}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

export function UiCard({
  title,
  subtitle,
  icon,
  right,
  children,
}: {
  title?: string
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
                <span>{title}</span>
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

export function UiPill({
  children,
  tone = 'navy',
}: {
  children: ReactNode
  tone?: UiTone
}) {
  return <span className={`ui-pill ui-tone-${tone}`}>{children}</span>
}

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; icon?: ReactNode }>
  active: string
  onChange: (id: string) => void
}) {
  return (
    <nav className="ui-kit-bottom-tabbar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={`ui-kit-bottom-tab${active === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className="tab-icon">{tab.icon}</span>}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

export function MonthlyNavBar({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; icon?: ReactNode }>
  active: string
  onChange: (id: string) => void
}) {
  return <TabBar tabs={tabs} active={active} onChange={onChange} />
}

export function InternalTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; icon?: ReactNode }>
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="ui-kit-internal-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={`ui-kit-internal-tab${active === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className="tab-icon">{tab.icon}</span>}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

export function FormField({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="ui-kit-field">
      <span className="form-lbl">{label}</span>
      {children}
      {hint && <span className="ui-kit-field-hint">{hint}</span>}
    </label>
  )
}

export function SearchField({
  value,
  placeholder,
  onChange,
  onClear,
  prefix,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  onClear?: () => void
  prefix?: ReactNode
}) {
  return (
    <div className="ui-kit-search">
      {prefix && <span className="ui-kit-search-prefix">{prefix}</span>}
      <input
        className="form-inp"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
      {value && onClear && (
        <button type="button" className="ui-kit-search-clear" onClick={onClear}>×</button>
      )}
    </div>
  )
}

export function ModalShell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="modal-bg open">
      <div className="modal-shell" onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">{title}</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function GroupBlock({
  title,
  subtitle,
  right,
  children,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="ui-kit-group-block">
      <div className="ui-kit-group-block-hd">
        <div>
          <div className="ui-kit-group-block-title">{title}</div>
          {subtitle && <div className="ui-kit-group-block-subtitle">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="ui-kit-group-block-body">{children}</div>
    </div>
  )
}

export function InfoCallout({
  title,
  children,
  tone = 'muted',
}: {
  title: string
  children: ReactNode
  tone?: UiTone
}) {
  return (
    <div className={`ui-kit-callout ui-tone-${tone}`}>
      <div className="ui-kit-callout-title">{title}</div>
      <div className="ui-kit-callout-body">{children}</div>
    </div>
  )
}

export function ModalActions({
  primaryLabel,
  secondaryLabel = 'Cancel',
  destructive = false,
  onPrimary,
  onSecondary,
  leading,
  primaryPrefix,
  disabled = false,
}: {
  primaryLabel: string
  secondaryLabel?: string
  destructive?: boolean
  onPrimary?: () => void
  onSecondary?: () => void
  leading?: ReactNode
  primaryPrefix?: ReactNode
  disabled?: boolean
}) {
  return (
    <div className="ui-kit-modal-actions">
      {leading}
      <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={onSecondary} disabled={disabled}>
        {secondaryLabel}
      </button>
      <button
        type="button"
        className={`ui-kit-btn ui-kit-btn--solid${destructive ? ' btn-red' : ''}`}
        onClick={onPrimary}
        disabled={disabled}
      >
        {primaryPrefix}
        {primaryLabel}
      </button>
    </div>
  )
}

export function TransactionRow({
  title,
  amount,
  date,
  category,
  type,
  mode,
  tone = 'navy',
  icon,
  trailing,
  onClick,
  className = '',
  showCategory = true,
  showType = true,
  showMode = true,
  categoryChip = false,
  categoryTone = 'muted',
  chips,
  metaLeft,
  metaRight,
}: {
  title: string
  amount: ReactNode
  date: string
  category: string
  type: string
  mode: ReactNode
  tone?: UiTone
  icon?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  className?: string
  showCategory?: boolean
  showType?: boolean
  showMode?: boolean
  categoryChip?: boolean
  categoryTone?: UiTone
  chips?: ReactNode
  metaLeft?: ReactNode
  metaRight?: ReactNode
}) {
  return (
    <button type="button" className={`ui-kit-txn ui-tone-${tone} ui-kit-txn-btn ${className}`.trim()} onClick={onClick}>
      <div className="ui-kit-txn-main">
        <div className="ui-kit-txn-title-row">
          <div className="ui-kit-txn-title">{title}</div>
          <div className="ui-kit-txn-amt">{amount}</div>
        </div>
        <div className="ui-kit-txn-meta">
          <div className="ui-kit-txn-meta-left">
            {metaLeft || (
              showCategory && (
                <span className={`ui-kit-txn-cat${categoryChip ? ` ui-kit-txn-cat-chip ui-tone-${categoryTone}` : ''}`}>
                  {category}
                </span>
              )
            )}
          </div>
          <div className="ui-kit-txn-meta-right">
            {metaRight || (
              <>
                {date && <span className="ui-kit-txn-date">{date}</span>}
                {showType && (
                  <>
                    <span className="ui-kit-txn-sep">•</span>
                    <span className="ui-kit-txn-type">{type}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        {chips && <div className="ui-kit-txn-chips">{chips}</div>}
      </div>
      <div className="ui-kit-txn-foot">
        {icon && <span className="ui-kit-txn-icon">{icon}</span>}
        {showMode && <span className="ui-kit-txn-mode">{mode}</span>}
        {trailing}
      </div>
    </button>
  )
}

export function BalanceRow({
  title,
  value,
  subtitle,
  income,
  expense,
  left,
  incomeIcon,
  expenseIcon,
}: {
  title: string
  value: ReactNode
  subtitle?: string
  income?: ReactNode
  expense?: ReactNode
  left?: ReactNode
  incomeIcon?: ReactNode
  expenseIcon?: ReactNode
}) {
  return (
    <div className="ui-kit-card ui-kit-balance-card">
      <div className="ui-kit-balance-header">
        <div className="ui-kit-balance-main">
          <div className="ui-kit-balance-title-row">
            <div className="ui-kit-balance-title">{title}</div>
            {left && <div className="ui-kit-balance-left">{left}</div>}
          </div>
          {subtitle && <div className="ui-kit-balance-subtitle">{subtitle}</div>}
        </div>
        <div className="ui-kit-balance-value">{value}</div>
      </div>
      {(income !== undefined || expense !== undefined) && (
        <div className="ui-kit-balance-flow-row">
          {income !== undefined && (
            <div className="ui-kit-balance-flow-item ui-tone-green">
              <div className="ui-kit-balance-flow-head">
                <span>Income</span>
                {incomeIcon && <span className="ui-kit-balance-flow-icon">{incomeIcon}</span>}
              </div>
              <strong>{income}</strong>
            </div>
          )}
          {expense !== undefined && (
            <div className="ui-kit-balance-flow-item ui-tone-red">
              <div className="ui-kit-balance-flow-head">
                <span>Expense</span>
                {expenseIcon && <span className="ui-kit-balance-flow-icon">{expenseIcon}</span>}
              </div>
              <strong>{expense}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ListStack({
  children,
}: {
  children: ReactNode
}) {
  return <div className="ui-kit-list-stack">{children}</div>
}

export function CompactRow({
  title,
  value,
  metaLeft,
  metaRight,
  chips,
  onClick,
}: {
  title: string
  value: ReactNode
  metaLeft?: ReactNode
  metaRight?: ReactNode
  chips?: ReactNode
  onClick?: () => void
}) {
  const className = `ui-kit-compact-row${onClick ? ' ui-kit-compact-row--btn' : ''}`
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <div className="ui-kit-compact-row-top">
          <div className="ui-kit-compact-row-title">{title}</div>
          <div className="ui-kit-compact-row-value">{value}</div>
        </div>
        <div className="ui-kit-compact-row-bottom">
          <div className="ui-kit-compact-row-meta">{metaLeft}</div>
          <div className="ui-kit-compact-row-meta ui-kit-compact-row-meta--right">{metaRight}</div>
        </div>
        {chips && <div className="ui-kit-compact-row-chips">{chips}</div>}
      </button>
    )
  }
  return (
    <div className={className}>
      <div className="ui-kit-compact-row-top">
        <div className="ui-kit-compact-row-title">{title}</div>
        <div className="ui-kit-compact-row-value">{value}</div>
      </div>
      <div className="ui-kit-compact-row-bottom">
        <div className="ui-kit-compact-row-meta">{metaLeft}</div>
        <div className="ui-kit-compact-row-meta ui-kit-compact-row-meta--right">{metaRight}</div>
      </div>
      {chips && <div className="ui-kit-compact-row-chips">{chips}</div>}
    </div>
  )
}

export function HoldingCard({
  title,
  subtitle,
  leftLabel,
  leftValue,
  icon,
  iconPosition = 'left',
  iconBackground = false,
  rightTop,
  compactTitle = false,
  rightLabel,
  rightValue,
  centerLabel,
  centerValue,
  pnlLabel = 'P&L',
  pnlValue,
  accentTone = 'navy',
  chips,
  onClick,
  className = '',
}: {
  title: string
  subtitle?: string
  leftLabel: string
  leftValue: ReactNode
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  iconBackground?: boolean
  rightTop?: ReactNode
  compactTitle?: boolean
  rightLabel?: string
  rightValue?: ReactNode
  centerLabel?: string
  centerValue?: ReactNode
  pnlLabel?: string
  pnlValue?: ReactNode
  accentTone?: Extract<UiTone, 'green' | 'red' | 'navy' | 'amber'>
  chips?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const toneClass = accentTone === 'green' || accentTone === 'red' ? ` ui-kit-holding-card--accent-${accentTone}` : ''
  const cardClass = `ui-kit-holding-card${toneClass}${onClick ? ' ui-kit-holding-card--btn' : ''}${className ? ` ${className}` : ''}`.trim()
  const body = (
    <>
      <div className={`ui-kit-holding-card-head${compactTitle ? ' ui-kit-holding-card-head--compact' : ''}`}>
        <div>
          <div className="ui-kit-holding-card-title">
            {icon && iconPosition === 'left' && <span className={`ui-kit-holding-icon${iconBackground ? ' ui-kit-holding-icon--bg' : ''} ui-tone-${accentTone}`}>{icon}</span>}
            <span>{title}</span>
          </div>
          {subtitle?.trim() && <div className="ui-kit-holding-card-subtitle">{subtitle}</div>}
        </div>
        <div className="ui-kit-holding-card-head-right">
          {rightTop}
          {icon && iconPosition === 'right' && <div className={`ui-kit-holding-icon${iconBackground ? ' ui-kit-holding-icon--bg' : ''} ui-tone-${accentTone}`}>{icon}</div>}
        </div>
      </div>
      <div className="ui-kit-holding-card-grid">
        <div className="ui-kit-holding-stat">
          <span>{leftLabel}</span>
          <strong>{leftValue}</strong>
        </div>
        {centerLabel && centerValue !== undefined && (
          <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
            <span>{centerLabel}</span>
            <strong>{centerValue}</strong>
          </div>
        )}
        {rightLabel && rightValue !== undefined && (
          <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
            <span>{rightLabel}</span>
            <strong>{rightValue}</strong>
          </div>
        )}
      </div>
      {pnlValue !== undefined && (
        <div className={`ui-kit-holding-pnl${accentTone === 'green' || accentTone === 'red' ? ` ui-tone-${accentTone}` : ''}`}>
          <div className="ui-kit-holding-pnl-row">
            <div className="ui-kit-holding-pnl-label">{pnlLabel}</div>
            <div className="ui-kit-holding-pnl-value">{pnlValue}</div>
          </div>
        </div>
      )}
      {chips && <div className="ui-kit-holding-chips">{chips}</div>}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={cardClass} onClick={onClick}>
        {body}
      </button>
    )
  }

  return <div className={cardClass}>{body}</div>
}

export function HoldingModal({
  title,
  onClose,
  children,
  pnlLabel = 'Profit / Loss',
  pnlValue,
  pnlPct,
  accentTone = 'navy',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  pnlLabel?: string
  pnlValue: ReactNode
  pnlPct?: ReactNode
  accentTone?: Extract<UiTone, 'green' | 'red' | 'navy'>
}) {
  const toneClass = accentTone === 'green' || accentTone === 'red' ? ` ui-tone-${accentTone}` : ''

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="ui-kit-holding-modal-grid">{children}</div>
      <div className={`ui-kit-holding-modal-pnl${toneClass}`}>
        <div className="ui-kit-holding-pnl-label">{pnlLabel}</div>
        <div className="ui-kit-holding-modal-pnl-row">
          <div className="ui-kit-holding-pnl-value">{pnlValue}</div>
          {pnlPct && <div className="ui-kit-holding-pnl-pct">{pnlPct}</div>}
        </div>
      </div>
    </ModalShell>
  )
}

export function SheetShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="sheet-panel">
      <div className="sheet-body">
        <div className="ui-kit-sheet-hd">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="modal-subtitle">{subtitle}</div>}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FormActions({
  children,
}: {
  children: ReactNode
}) {
  return <div className="ui-kit-form-actions">{children}</div>
}
