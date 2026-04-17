import { useEffect, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Tone = 'green' | 'red' | 'amber' | 'navy' | 'muted'

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

export function SectionTitle({ title, subtitle, icon, right, rightChip }: { title: string; subtitle?: string; icon?: ReactNode; right?: ReactNode; rightChip?: ReactNode }) {
  return (
    <div className="ui-kit-section">
      <div className="ui-kit-section-left">
        <div className="ui-kit-section-title">
          {icon && <span className="ui-kit-section-icon">{icon}</span>}
          <span>{title}</span>
        </div>
        {subtitle && <div className="ui-kit-section-subtitle">{subtitle}</div>}
      </div>
      {(right || rightChip) && <div className="ui-kit-section-right">{right}{rightChip}</div>}
    </div>
  )
}

export function SectionBlock({ title, subtitle, icon, right, rightChip, children }: { title: string; subtitle?: string; icon?: ReactNode; right?: ReactNode; rightChip?: ReactNode; children: ReactNode }) {
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

export function Spacer({ size = 8 }: { size?: number }) {
  return <div style={{ height: size, flexShrink: 0 }} />
}

export function UiCard({ title, subtitle, icon, right, children }: { title?: ReactNode; subtitle?: ReactNode; icon?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <article className="ui-kit-card">
      {(title || subtitle || icon || right) && (
        <div className="ui-kit-card-hd">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {icon && <span className="ui-kit-card-icon">{icon}</span>}
              {title && <div className="ui-kit-card-title">{title}</div>}
            </div>
            {subtitle && <div className="ui-kit-card-sub">{subtitle}</div>}
          </div>
          {right && <div>{right}</div>}
        </div>
      )}
      {children && <div className="ui-kit-card-body">{children}</div>}
    </article>
  )
}

export function UiPill({ children, tone = 'navy' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`ui-pill ui-tone-${tone}`}>{children}</span>
}

export function KpiCard({ label, value, icon, subtitle, tone = 'navy', accentTone, full = false, onClick }: { label: string; value: ReactNode; icon?: ReactNode; subtitle?: string; tone?: Tone; accentTone?: 'green' | 'red'; full?: boolean; onClick?: () => void }) {
  return (
    <div className={`ui-kit-card ui-kit-kpi ui-tone-${tone}${accentTone ? ` ui-kit-kpi--accent-${accentTone}` : ''}${full ? ' ui-kit-kpi--full' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
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

export function BalanceRow({ title, value, subtitle, income, expense, incomeIcon, expenseIcon }: { title: string; value: ReactNode; subtitle?: string; income?: ReactNode; expense?: ReactNode; incomeIcon?: ReactNode; expenseIcon?: ReactNode }) {
  return (
    <div className="ui-kit-card">
      <div className="ui-kit-card-title">{title}</div>
      {subtitle && <div className="ui-kit-card-sub">{subtitle}</div>}
      <div className="ui-kit-balance-value">{value}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {income && <UiPill tone="green">{incomeIcon}{income}</UiPill>}
        {expense && <UiPill tone="red">{expenseIcon}{expense}</UiPill>}
      </div>
    </div>
  )
}

export function SectionChip({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`ui-kit-section-chip ui-tone-${tone}`}>{children}</span>
}

export function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`ui-kit-chip ui-tone-${tone}`}>{children}</span>
}

export function FilterPills({ items, active, onChange, onClear }: { items: string[]; active: string; onChange: (id: string) => void; onClear?: () => void }) {
  return (
    <div className="ui-kit-filter-row">
      {onClear && active && <button type="button" className="ui-kit-filter-pill ui-kit-filter-pill--active" onClick={onClear}>{active} ×</button>}
      {items.map(item => <button key={item} type="button" className={`ui-kit-filter-pill${active === item ? ' ui-kit-filter-pill--active' : ''}`} onClick={() => onChange(item)}>{item}</button>)}
    </div>
  )
}

export const FilterChips = FilterPills

export function FormField(props: any) {
  return <input {...props} className={`form-inp ${props.className || ''}`.trim()} />
}

export function SearchField(props: any) {
  return <input {...props} className={`form-inp ${props.className || ''}`.trim()} />
}

export function ModalShell({ title, subtitle, icon, onClose, children, footer }: any) {
  return (
    <div className="sheet-panel" onClick={e => e.stopPropagation()}>
      <div className="sheet-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon && <span className="ui-sheet-icon">{icon}</span>}
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{title}</div>
              {subtitle && <div className="dash-credit-summary-sub">{subtitle}</div>}
            </div>
          </div>
          <button onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
      {footer}
    </div>
  )
}

export function InfoCallout({ title, children }: any) {
  return <div className="ui-kit-card"><strong>{title}</strong><div>{children}</div></div>
}

export function ModalActions({ children }: any) {
  return <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{children}</div>
}

export function TransactionRow({ title, subtitle, right, onClick }: any) {
  return <div className="ui-kit-card" onClick={onClick}><div>{title}</div><div>{subtitle}</div><div>{right}</div></div>
}

export function ListStack({ children }: any) {
  return <div style={{ display: 'grid', gap: 12 }}>{children}</div>
}

export function HoldingCard({ title, subtitle, leftLabel, leftValue, centerLabel, centerValue, rightLabel, rightValue, icon, onClick }: any) {
  return <div className="ui-kit-card" onClick={onClick}><div>{title}</div><div>{subtitle}</div><div>{leftLabel}{leftValue}</div><div>{centerLabel}{centerValue}</div><div>{rightLabel}{rightValue}</div>{icon}</div>
}

export function HoldingModal({ title, subtitle, icon, onClose, children, footer }: any) {
  return <ModalShell title={title} subtitle={subtitle} icon={icon} onClose={onClose} footer={footer}>{children}</ModalShell>
}

export function TabBar({ tab, onTab, tabs }: any) {
  return <div className="tab-bar">{tabs?.map((t: any) => <button key={t.id} onClick={() => onTab(t.id)}>{t.label}</button>)}</div>
}

export const InternalTabBar = TabBar
