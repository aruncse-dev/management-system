import type { UiTone } from './uiTone'

export type ProgressBarProps = {
  /** Amount completed, in the same unit as `max`. Clamped into 0..max. */
  value: number
  /** The whole. Values <= 0 render an empty track rather than dividing by zero. */
  max: number
  tone?: UiTone
  /** Right-aligned caption above the track, e.g. "16 of 39 EMIs". */
  label?: string
  /** Shows the rounded percentage next to `label`. */
  showPct?: boolean
  className?: string
}

/**
 * A single completion track.
 *
 * Progress is expressed as value/max rather than a pre-computed percentage so
 * the component can render "16 of 39" and the bar from one source — a caller
 * passing only a percentage has already thrown away the counts the label needs.
 *
 * Overpayment is real (a repayment can exceed what is owed), so `value` is
 * clamped for the bar while the label keeps the caller's true figures.
 */
export function ProgressBar({
  value,
  max,
  tone = 'navy',
  label,
  showPct = false,
  className = '',
}: ProgressBarProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0
  const safeValue = Number.isFinite(value) ? Math.max(value, 0) : 0
  const pct = safeMax > 0 ? Math.min((safeValue / safeMax) * 100, 100) : 0

  return (
    <div className={`ui-kit-progress ${className}`.trim()}>
      {(label || showPct) && (
        <div className="ui-kit-progress-head">
          {label ? <span className="ui-kit-progress-label">{label}</span> : <span />}
          {showPct ? <span className="ui-kit-progress-pct">{Math.round(pct)}%</span> : null}
        </div>
      )}
      <div
        className={`ui-kit-progress-track ui-tone-${tone}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.min(safeValue, safeMax)}
        aria-label={label}
      >
        <span className="ui-kit-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
