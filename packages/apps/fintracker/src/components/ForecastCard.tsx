import { Sparkles } from 'lucide-react'
import { SectionBlock, SectionChip } from '../ui'
import { MIN_DAYS_FOR_FORECAST, type Forecast } from '../lib/forecast'

/**
 * Forecast for the open cycle: projected spend, what is left to spend per day,
 * and the few suggestions worth acting on. Only for the current cycle — a past
 * one has no future to project.
 */
export function ForecastCard({ forecast, fmt }: { forecast: Forecast; fmt: (n: number) => string }) {
  if (!forecast.reliable) {
    return (
      <SectionBlock title="Forecast" icon={<Sparkles size={16} />}>
        <div className="reminder-note">
          A forecast appears after {MIN_DAYS_FOR_FORECAST} days of the cycle — too few days make a noisy projection.
        </div>
      </SectionBlock>
    )
  }

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
          {forecast.suggestions.map((s, i) => (
            <div key={`${s.title}-${i}`} className="dash-suggestion" data-tone={s.tone}>
              <div className="dash-suggestion__title">{s.title}</div>
              <div className="dash-suggestion__detail">{s.detail}</div>
            </div>
          ))}
        </div>
      )}
    </SectionBlock>
  )
}
