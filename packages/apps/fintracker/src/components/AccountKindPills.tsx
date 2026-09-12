import type { ReactNode } from 'react'
import { ACCOUNT_KINDS, accountKindMeta } from '../config'
import { KpiCard, KpiGrid } from '../ui'

/** `''` means no filter — every kind shown. */
export type AccountKindFilter = string

/**
 * Account-kind filter.
 *
 * Labels only. The amounts used to ride on these chips, which made a control
 * you tap to filter double as a figure you read — the two jobs want different
 * shapes, so the money moved to `AccountKindTotals` below.
 *
 * Only kinds that actually have an account are offered. An FD chip on a book
 * with no FD is a chip that can only ever return nothing, the same mistake the
 * Transactions type filter already documents about its absent `Savings` pill.
 *
 * Deliberately reuses `ui-kit-filter-row` / `ui-kit-filter-pill` rather than
 * `FilterPills` itself: that component takes plain strings, and these map a
 * label back to a stored key.
 */
export function AccountKindPills({
  kinds,
  active,
  onChange,
  allLabel = 'All',
}: {
  /** Kind values present in the data, in any order. */
  kinds: readonly string[]
  active: AccountKindFilter
  onChange: (kind: AccountKindFilter) => void
  allLabel?: string
}) {
  const present = ACCOUNT_KINDS.filter(k => kinds.includes(k.value))
  // One kind is no choice at all, so the row would only take up space.
  if (present.length < 2) return null

  return (
    <div className="ui-kit-filter-row">
      <button
        type="button"
        className={`ui-kit-filter-pill${active === '' ? ' active' : ''}`}
        onClick={() => onChange('')}
      >
        {allLabel}
      </button>
      {present.map(k => (
        <button
          key={k.value}
          type="button"
          className={`ui-kit-filter-pill${active === k.value ? ' active' : ''}`}
          onClick={() => onChange(k.value)}
        >
          {k.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Available money per account kind, as KPI tiles.
 *
 * A kind is dropped when it holds nothing — no accounts, or they net to zero.
 * A tile reading "FD ₹0" for a book with no FD is noise, and unlike the filter
 * chips nothing becomes unreachable by hiding it: the chips still offer every
 * kind that has an account, whatever its balance.
 */
export function AccountKindTotals({
  totals,
  formatValue,
  onSelect,
}: {
  totals: Record<string, number>
  formatValue: (n: number) => string
  /** Tapping a tile filters to that kind, where the page supports it. */
  onSelect?: (kind: string) => void
}): ReactNode {
  const present = ACCOUNT_KINDS.filter(k => (totals[k.value] ?? 0) !== 0)
  if (present.length === 0) return null

  return (
    <KpiGrid variant="compact">
      {present.map(k => {
        const value = totals[k.value] ?? 0
        const meta = accountKindMeta(k.value)
        return (
          <KpiCard
            key={k.value}
            label={k.label}
            value={`${value < 0 ? '−' : ''}${formatValue(Math.abs(value))}`}
            tone={value < 0 ? 'red' : 'muted'}
            icon={<meta.icon size={14} />}
            onClick={onSelect ? () => onSelect(k.value) : undefined}
          />
        )
      })}
    </KpiGrid>
  )
}

/**
 * Balance per kind, for the tiles above.
 *
 * A kind with no accounts is left out of the map entirely rather than recorded
 * as zero — that absence is what hides its tile and its chip.
 */
export function totalByKind(
  rows: readonly { accountKind?: string; balance?: number }[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const kind = r.accountKind || 'savings_bank'
    out[kind] = (out[kind] ?? 0) + (r.balance ?? 0)
  }
  return out
}

/** The distinct kinds present, for the filter chips. */
export function kindsPresent(rows: readonly { accountKind?: string }[]): string[] {
  return [...new Set(rows.map(r => r.accountKind || 'savings_bank'))]
}
