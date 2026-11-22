import { Sparkles } from 'lucide-react'
import { SectionBlock } from '../ui'
import type { Forecast } from '../lib/forecast'

/**
 * One line on where the cycle is heading: projected spend and what is left to
 * spend per day. Only for the current cycle, and only once a few days have
 * passed — a projection from one or two days is noise.
 */
export function ForecastCard({ forecast, fmt }: { forecast: Forecast; fmt: (n: number) => string }) {
  if (!forecast.reliable) return null
  const over = forecast.suggestions.some(s => s.tone === 'red')
  return (
    <SectionBlock title="Forecast" icon={<Sparkles size={16} />}>
      <div className={`forecast-line${over ? ' is-over' : ''}`}>
        <span>
          On pace for <b>{fmt(forecast.projectedSpend)}</b>
        </span>
        {forecast.dailyAllowance !== null && (
          <span>
            <b>{fmt(forecast.dailyAllowance)}</b>/day left
          </span>
        )}
      </div>
    </SectionBlock>
  )
}
