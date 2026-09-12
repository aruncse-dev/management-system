import type { CSSProperties } from 'react'

export type MiniBarPoint = {
  /** Short axis label, e.g. "Jul". */
  label: string
  /** Rendered upward. */
  primary: number
  /** Rendered as a second bar in the same slot. */
  secondary?: number
}

export type MiniBarChartProps = {
  points: MiniBarPoint[]
  primaryLabel?: string
  secondaryLabel?: string
  primaryColor?: string
  secondaryColor?: string
  height?: number
  valueFormatter?: (n: number) => string
}

/**
 * Paired vertical bars for a short series (6-12 points).
 *
 * Inline SVG on purpose: the repo has no charting library, and one trend view
 * does not justify adding a dependency. Matches `RightLegendDonut`'s approach —
 * plain SVG, colors from the caller, no animation.
 *
 * Bars share one scale so the two series stay visually comparable. A zero-valued
 * series still renders a 1px stub so an empty month is visible rather than absent.
 */
export function MiniBarChart({
  points,
  primaryLabel = 'Income',
  secondaryLabel = 'Expense',
  primaryColor = 'var(--gm)',
  secondaryColor = 'var(--rm)',
  height = 120,
  valueFormatter,
}: MiniBarChartProps) {
  if (!points.length) return null

  const max = Math.max(
    1,
    ...points.map((p) => Math.max(p.primary, p.secondary ?? 0)),
  )
  const hasSecondary = points.some((p) => p.secondary !== undefined)

  const slot = 100 / points.length
  const barW = hasSecondary ? slot * 0.28 : slot * 0.44
  const gap = hasSecondary ? slot * 0.06 : 0
  const plotH = height - 22 // leave room for labels

  const scale = (v: number) => Math.max((Math.max(v, 0) / max) * plotH, v > 0 ? 2 : 1)

  const legendDot: CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 2,
    display: 'inline-block',
    flexShrink: 0,
  }

  return (
    <div className="mini-bar-chart">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
        role="img"
        aria-label={`${primaryLabel} versus ${secondaryLabel} by month`}
      >
        {points.map((p, i) => {
          const base = i * slot
          const primaryH = scale(p.primary)
          const secondaryH = scale(p.secondary ?? 0)
          const groupW = hasSecondary ? barW * 2 + gap : barW
          const left = base + (slot - groupW) / 2
          return (
            <g key={p.label + i}>
              <rect
                x={left}
                y={plotH - primaryH}
                width={barW}
                height={primaryH}
                rx={1}
                fill={primaryColor}
              />
              {hasSecondary ? (
                <rect
                  x={left + barW + gap}
                  y={plotH - secondaryH}
                  width={barW}
                  height={secondaryH}
                  rx={1}
                  fill={secondaryColor}
                />
              ) : null}
            </g>
          )
        })}
        <line x1="0" y1={plotH} x2="100" y2={plotH} stroke="var(--border)" strokeWidth="0.4" />
      </svg>

      <div className="mini-bar-chart__labels">
        {points.map((p, i) => (
          <span key={p.label + i}>{p.label}</span>
        ))}
      </div>

      <div className="mini-bar-chart__legend">
        <span>
          <i style={{ ...legendDot, background: primaryColor }} /> {primaryLabel}
        </span>
        {hasSecondary ? (
          <span>
            <i style={{ ...legendDot, background: secondaryColor }} /> {secondaryLabel}
          </span>
        ) : null}
        {valueFormatter ? (
          <span className="mini-bar-chart__peak">peak {valueFormatter(max)}</span>
        ) : null}
      </div>
    </div>
  )
}

export default MiniBarChart
