import { useEffect, useId, useRef, type ReactNode } from 'react'
import { ExternalLink, Link2, Loader2, Copy } from 'lucide-react'
import type { UiTone } from './uiTone'
import { UiCard } from './UiCard'

export type { UiTone } from './uiTone'
export { KpiCard, KPI_ICON_SIZE, type KpiCardProps } from './KpiCard'
export { KpiGrid, type KpiGridVariant } from './KpiGrid'

export function LoadingState({
  label = 'Loading…',
  variant = 'page',
}: {
  label?: string
  variant?: 'page' | 'inline' | 'section'
}) {
  return (
    <div className={`ui-kit-loading ui-kit-loading--${variant}`} role="status" aria-live="polite" aria-busy="true">
      <Loader2 size={variant === 'inline' ? 15 : 16} className="spin-icon ui-kit-loading-icon" />
      <span>{label}</span>
    </div>
  )
}

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
      <Spacer size={8} />
      <SectionTitle title={title} subtitle={subtitle} icon={icon} right={right} rightChip={rightChip} />
      <Spacer size={8} />
      <div className="ui-kit-section-body">{children}</div>
      <Spacer size={8} />
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

function SummaryMetricCard({
  label,
  value,
  color,
}: {
  label: string
  value: ReactNode
  color: string
}) {
  return (
    <div className="ui-kit-summary-metric">
      <span className="ui-kit-summary-metric-bar" style={{ background: color }} />
      <span className="ui-kit-summary-metric-label">{label}</span>
      <strong className="ui-kit-summary-metric-value">{value}</strong>
    </div>
  )
}

export function DonutSummaryCard({
  totalLabel,
  totalValue,
  slices,
  items,
}: {
  totalLabel: string
  totalValue: ReactNode
  slices: Array<{ label: string; color: string; strokeDasharray: string; strokeDashoffset: number }>
  items: Array<{ label: string; value: ReactNode; color: string }>
}) {
  return (
    <UiCard>
      <div className="ui-kit-donut-summary">
        <div className="ui-kit-donut-summary-ring">
          <svg viewBox="0 0 120 120" width="100%" height="100%" aria-label="Summary donut chart">
            <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(59,130,246,.22)" strokeWidth="16" />
            {slices.map(slice => (
              <circle
                key={slice.label}
                cx="60"
                cy="60"
                r="44"
                fill="none"
                stroke={slice.color}
                strokeWidth="16"
                strokeLinecap="butt"
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                transform="rotate(-90 60 60)"
              />
            ))}
            <circle cx="60" cy="60" r="24" fill="#fff" />
            <text x="60" y="55" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--muted)">{totalLabel}</text>
            <text x="60" y="72" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--text)">{totalValue}</text>
          </svg>
        </div>
        <div className="ui-kit-donut-summary-items">
          {items.map(item => (
            <SummaryMetricCard key={item.label} label={item.label} value={item.value} color={item.color} />
          ))}
        </div>
      </div>
    </UiCard>
  )
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
  className = '',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Extra class on the shell, for per-sheet styling. Modals share one look by
      default — reach for this only when one sheet genuinely differs. */
  className?: string
}) {
  const titleId = useId()
  const shellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const body = document.body
    const html = document.documentElement
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverflow = html.style.overflow
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    return () => {
      body.style.overflow = prevBodyOverflow
      html.style.overflow = prevHtmlOverflow
    }
  }, [])

  // Escape closes, and focus moves into the dialog and back to whatever opened
  // it. Without this the sheet was mouse-only and left focus stranded on the
  // page behind it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    shellRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [onClose])

  return (
    <div className="modal-bg open" onClick={onClose}>
      <div
        ref={shellRef}
        className={`modal-shell${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-hd">
          <div>
            <div className="modal-title" id={titleId}>{title}</div>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
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
      <div className="ui-kit-modal-actions-left">{leading}</div>
      <div className="ui-kit-modal-actions-right">
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
    </div>
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
  incomeLabel = 'Income',
  expenseLabel = 'Expense',
  incomeTone = 'green',
  expenseTone = 'red',
}: {
  title?: string
  value: ReactNode
  subtitle?: string
  income?: ReactNode
  expense?: ReactNode
  left?: ReactNode
  incomeIcon?: ReactNode
  expenseIcon?: ReactNode
  incomeLabel?: string
  expenseLabel?: string
  incomeTone?: 'green' | 'red'
  expenseTone?: 'green' | 'red'
}) {
  return (
    <div className="ui-kit-card ui-kit-balance-card">
      {(title || subtitle || left) && (
        <div className="ui-kit-balance-header">
          <div className="ui-kit-balance-main">
            <div className="ui-kit-balance-title-row">
              {title ? <div className="ui-kit-balance-title">{title}</div> : <div />}
              {left && <div className="ui-kit-balance-left">{left}</div>}
            </div>
            {subtitle && <div className="ui-kit-balance-subtitle">{subtitle}</div>}
          </div>
          <div className="ui-kit-balance-value">{value}</div>
        </div>
      )}
      {!title && !subtitle && !left && <div className="ui-kit-balance-value">{value}</div>}
      {(income !== undefined || expense !== undefined) && (
        <div className="ui-kit-balance-flow-row">
          {income !== undefined && (
            <div className={`ui-kit-balance-flow-item ui-tone-${incomeTone}`}>
              <div className="ui-kit-balance-flow-head">
                <span>{incomeLabel}</span>
                {incomeIcon && <span className="ui-kit-balance-flow-icon">{incomeIcon}</span>}
              </div>
              <strong>{income}</strong>
            </div>
          )}
          {expense !== undefined && (
            <div className={`ui-kit-balance-flow-item ui-tone-${expenseTone}`}>
              <div className="ui-kit-balance-flow-head">
                <span>{expenseLabel}</span>
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
  secondaryGrid,
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
  secondaryGrid?: {
    leftLabel: string
    leftValue: ReactNode
    centerLabel?: string
    centerValue?: ReactNode
    rightLabel?: string
    rightValue?: ReactNode
  }
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
      {secondaryGrid && (
        <div className="ui-kit-holding-card-grid">
          <div className="ui-kit-holding-stat">
            <span>{secondaryGrid.leftLabel}</span>
            <strong>{secondaryGrid.leftValue}</strong>
          </div>
          {secondaryGrid.centerLabel && secondaryGrid.centerValue !== undefined && (
            <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
              <span>{secondaryGrid.centerLabel}</span>
              <strong>{secondaryGrid.centerValue}</strong>
            </div>
          )}
          {secondaryGrid.rightLabel && secondaryGrid.rightValue !== undefined && (
            <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
              <span>{secondaryGrid.rightLabel}</span>
              <strong>{secondaryGrid.rightValue}</strong>
            </div>
          )}
        </div>
      )}
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

/** Clickable card shell — `div` + `onClick` so action buttons (e.g. duplicate) are not nested inside `<button>`. */
function TransactionCardShell({
  className,
  onClick,
  children,
}: {
  className: string
  onClick?: () => void
  children: ReactNode
}) {
  if (!onClick) {
    return <div className={className}>{children}</div>
  }
  return (
    <div className={className} onClick={onClick}>
      {children}
    </div>
  )
}

/** Ledger / savings entry card: holding header + optional Amount · Type · Date grid. */
export function TransactionCard({
  title,
  amount,
  type,
  date,
  tone,
  icon,
  onClick,
  onDuplicate,
  refHref,
  refLabel,
  onRefOpen,
  className = '',
  amountLabel = 'Amount',
  typeLabel = 'Type',
  dateLabel = 'Date',
  linkUrl,
  compact = false,
  asStatic = false,
  variant = 'grid',
  meta,
}: {
  title: ReactNode
  /** Omitted from layout when `compact` is true. */
  amount?: ReactNode
  type?: ReactNode
  date?: ReactNode
  tone: Extract<UiTone, 'green' | 'red' | 'amber' | 'navy' | 'muted'>
  icon: ReactNode
  onClick?: () => void
  /** Callback when duplicate button is clicked. */
  onDuplicate?: (e: React.MouseEvent) => void
  /**
   * Where this row's linked module row lives. Renders a jump button beside the
   * duplicate button. Omit for rows that are not linked.
   */
  refHref?: string
  /** Accessible name for the jump button, e.g. "Open in EMI loans". */
  refLabel?: string
  /**
   * Client-side navigation for the jump button. When given, the anchor keeps its
   * `href` (so middle-click and "open in new tab" still work) but a plain click
   * is handled here instead — a bare `href` in a Next app costs a full document
   * reload. The host owns routing, so this is a callback rather than `next/link`;
   * this package deliberately has no Next dependency.
   */
  onRefOpen?: () => void
  className?: string
  /** Column header above `amount` (default: Amount). */
  amountLabel?: string
  /** Column header above `type` (default: Type). */
  typeLabel?: string
  /** Column header above `date` (default: Date). */
  dateLabel?: string
  /** Optional URL: shows icon + “Preview” below the grid (full URL in `title`; opens in new tab; does not trigger `onClick`). */
  linkUrl?: string
  /** Name + icon only (no stats grid). For accounts / credits lists. */
  compact?: boolean
  /**
   * `grid` (default) keeps the three labelled stats — right when the labels
   * vary and carry meaning (Vault's DOB / Relation, Staff's Gender / Basis).
   *
   * `row` is the dense single-line form for long lists where the labels would
   * be identical on every row, e.g. a month of transactions. Amount, type and
   * date collapse into one line: the sign and tone carry type, `meta` carries
   * the detail, and the caller groups by date with its own headers.
   */
  variant?: 'grid' | 'row'
  /** Second line in the `row` variant, e.g. "Groceries · HDFC Bank". */
  meta?: ReactNode
  /** When true, render a non-interactive div (e.g. profile summary). */
  asStatic?: boolean
}) {
  const trimmedLink = linkUrl?.trim() ?? ''
  const hasLink = trimmedLink.length > 0

  if (variant === 'row') {
    const rowBody = (
      <>
        <span className={`ui-kit-txn-row-icon ui-tone-${tone}`}>{icon}</span>
        <span className="ui-kit-txn-row-body">
          <span className="ui-kit-txn-row-title">{title}</span>
          {meta ? <span className="ui-kit-txn-row-meta">{meta}</span> : null}
        </span>
        {amount !== undefined ? (
          <span className={`ui-kit-txn-row-amount ui-tone-${tone}`}>{amount}</span>
        ) : null}
      </>
    )
    const rowClass = `ui-kit-txn-row${className ? ` ${className}` : ''}`.trim()
    if (asStatic || !onClick) {
      return <div className={rowClass}>{rowBody}</div>
    }
    return (
      <button type="button" className={`${rowClass} ui-kit-txn-row--btn`} onClick={onClick}>
        {rowBody}
      </button>
    )
  }

  const btnClass = `ui-kit-holding-card ui-kit-holding-card--accent-${tone} ui-kit-holding-card--btn txn-entry-card${hasLink ? ' ui-kit-holding-card--stacked' : ''}${compact ? ' txn-entry-card--compact' : ''}${className ? ` ${className}` : ''}`.trim()

  const iconWrap = (
    <div className={`ui-kit-holding-icon ui-kit-holding-icon--bg ui-tone-${tone}`}>
      <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted)', flexShrink: 0 }}>{icon}</span>
    </div>
  )

  const body = (
    <>
      <div className={`ui-kit-holding-card-head${compact ? ' ui-kit-holding-card-head--compact' : ''}`}>
        <div>
          <div className="ui-kit-holding-card-title">
            <span>{title}</span>
          </div>
        </div>
        <div className="ui-kit-holding-card-head-right">
          {refHref && (
            // A linked row can be opened where it was mirrored to. `stopPropagation`
            // keeps the card's own onClick (edit) from firing underneath it.
            <a
              className="ui-kit-txn-reflink"
              href={refHref}
              aria-label={refLabel || 'Open linked entry'}
              title={refLabel || 'Open linked entry'}
              onClick={e => {
                e.stopPropagation()
                // Let modified clicks (new tab / new window) fall through to the
                // browser; route the plain one client-side.
                if (!onRefOpen || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                e.preventDefault()
                onRefOpen()
              }}
            >
              <Link2 size={15} />
            </a>
          )}
          {onDuplicate && (
            <button
              type="button"
              className="ui-kit-icon-btn"
              onClick={e => {
                e.stopPropagation()
                e.preventDefault()
                onDuplicate(e)
              }}
              title="Duplicate transaction"
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                marginRight: '8px',
                color: 'var(--muted)',
              }}
            >
              <Copy size={16} />
            </button>
          )}
          {iconWrap}
        </div>
      </div>
      {!compact && (
        <div className="ui-kit-holding-card-grid">
          <div className="ui-kit-holding-stat">
            <span>{amountLabel}</span>
            <strong>{amount}</strong>
          </div>
          <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
            <span>{typeLabel}</span>
            <strong>{type}</strong>
          </div>
          <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
            <span>{dateLabel}</span>
            <strong>{date}</strong>
          </div>
        </div>
      )}
    </>
  )

  if (!hasLink) {
    if (asStatic) {
      return (
        <div className={btnClass} role="group">
          {body}
        </div>
      )
    }
    return (
      <TransactionCardShell className={btnClass} onClick={onClick}>
        {body}
      </TransactionCardShell>
    )
  }

  return (
    <div className="ui-kit-holding-card-with-link">
      {asStatic ? (
        <div className={btnClass} role="group">
          {body}
        </div>
      ) : (
        <TransactionCardShell className={btnClass} onClick={onClick}>
          {body}
        </TransactionCardShell>
      )}
      <a
        className="ui-kit-holding-card-linkrow ui-kit-holding-card-previewlink"
        href={trimmedLink}
        target="_blank"
        rel="noopener noreferrer"
        title={trimmedLink}
        onClick={e => e.stopPropagation()}
      >
        <ExternalLink size={14} className="ui-kit-holding-card-linkrow-icon" aria-hidden />
        <span className="ui-kit-holding-card-preview-label">Preview</span>
      </a>
    </div>
  )
}

export { UiCard } from './UiCard'
export { SettingsSectionCard, type SettingField } from './SettingsSectionCard'

export { default as CatIcon } from './CatIcon'
export * from './FinanceUI'
export * from './RightLegendDonut'
export * from './MiniBarChart'
export { default as BottomNav } from './BottomNav'
export { default as ErrorScreen } from './ErrorScreen'
export {
  default as Nav,
  type ModuleId,
  type AppNavArea,
  type NavDynamicMenuItem,
  type NavDynamicMenuSection,
} from './Nav'
export {
  default as SimpleAppNav,
  performGoogleAppLogout,
  type SimpleAppNavProps,
  type SimpleAppNavItem,
  type SimpleAppNavSection,
} from './SimpleAppNav'
export { default as TransactionModal, type TransactionModalApi, type TransactionRefOption } from './TransactionModal'
export { CategoryCombobox } from './CategoryCombobox'
export { RefCombobox } from './RefCombobox'
export {
  default as AppAuthGate,
  type AppAuthGateProps,
  type AppAuthGateRender,
  type AppAuthKind,
} from './AppAuthGate'
export {
  GoogleAuthCard,
  GoogleSignInButton,
  LOGIN_BRAND_MARK_STYLE,
  type GoogleAuthCardProps,
} from './GoogleAuthCard'
export { ConfirmDialog } from './ConfirmDialog'
export { FabButton, FormCard, DataPageHeader, AdminDataListSearch } from './AdminShell'
export { UpstoxIcon } from './UpstoxIcon'
export { IntegrationIcon } from './IntegrationIcon'
export { DynamicLucide } from './DynamicLucide'
