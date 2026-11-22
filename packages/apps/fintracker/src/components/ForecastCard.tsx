import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { SectionBlock, SectionChip } from '../ui'
import type { Forecast } from '../lib/forecast'

/**
 * Forecast for the open cycle: projected spend, what is left to spend per day,
 * and the few suggestions worth acting on. Only for the current cycle — a past
 * one has no future to project.
 */
/** Suggestions shown before "More insights". */
const COLLAPSED_SUGGESTIONS = 1

export function ForecastCard({ forecast, fmt }: { forecast: Forecast; fmt: (n: number) => string }) {
  const [expanded, setExpanded] = useState(false)
  // Too few days in for a meaningful projection: show nothing rather than a placeholder.
  if (!forecast.reliable) return null

  return (
    <SectionBlock
      title="Forecast"
      icon={<Sparkles size={16} />}
      right={<SectionChip>{forecast.daysLeft} days left</SectionChip>}
    >
      <div className="forecast-stats">
        <div>
          <div className="forecast-k">Projected spend</div>
          <div className="forecast-v">{fmt(forecast.projectedSpend)}</div>
        </div>
        <div>
          <div className="forecast-k">Daily pace</div>
          <div className="forecast-v">{fmt(forecast.dailyPace)}</div>
        </div>
        {forecast.dailyAllowance !== null && (
          <div>
            <div className="forecast-k">Left per day</div>
            <div className="forecast-v">{fmt(forecast.dailyAllowance)}</div>
          </div>
        )}
      </div>
      {forecast.suggestions.length > 0 && (
        <div className="dash-suggestions" style={{ marginTop: 10 }}>
          {(expanded ? forecast.suggestions : forecast.suggestions.slice(0, COLLAPSED_SUGGESTIONS)).map((s, i) => (
            <div key={`${s.title}-${i}`} className="dash-suggestion" data-tone={s.tone}>
              <div className="dash-suggestion__title">{s.title}</div>
              <div className="dash-suggestion__detail">{s.detail}</div>
            </div>
          ))}
          {forecast.suggestions.length > COLLAPSED_SUGGESTIONS && (
            <button type="button" className="reminder-more" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
              {expanded ? 'Show less' : `${forecast.suggestions.length - COLLAPSED_SUGGESTIONS} more insights`}
            </button>
          )}
        </div>
      )}
    </SectionBlock>
  )
}
