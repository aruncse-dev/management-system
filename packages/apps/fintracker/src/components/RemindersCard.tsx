import { useState } from 'react'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import { SectionBlock, SectionChip } from '../ui'
import { ALERT_DAYS, type Reminders } from '../lib/reminders'

type Fmt = (n: number) => string

/** Rows shown before "Show more" — the card sits under the KPIs and must stay short. */
const COLLAPSED_ROWS = 3

/** "today", "tomorrow", "3d", "2d late". */
function when(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft}d late`
  if (daysLeft === 0) return 'today'
  if (daysLeft === 1) return 'tomorrow'
  return `${daysLeft}d`
}

/**
 * "Coming up": renewals and premiums due in the next week, one line each, and
 * a one-line warning when the account they are paid from cannot cover them.
 * Renders nothing when there is nothing to say.
 */
export function RemindersCard({ reminders, fmt }: { reminders: Reminders; fmt: Fmt }) {
  const [expanded, setExpanded] = useState(false)
  if (!reminders.items.length && !reminders.lowBalance.length) return null

  const overdue = reminders.items.filter(i => i.daysLeft < 0).length
  const total = reminders.items.reduce((t, i) => t + i.amount, 0)
  const rows = expanded ? reminders.items : reminders.items.slice(0, COLLAPSED_ROWS)

  return (
    <SectionBlock
      title="Coming up"
      icon={<CalendarClock size={16} />}
      right={<SectionChip tone={overdue || reminders.lowBalance.length ? 'red' : 'muted'}>{fmt(total)}</SectionChip>}
    >
      <div className="reminders">
        {reminders.lowBalance.map(a => (
          <div key={`low-${a.account}`} className="reminder-line reminder-line--alert" role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span className="reminder-name">Top up {a.account}</span>
            <span className="reminder-amt">−{fmt(a.shortfall)}</span>
          </div>
        ))}
        {rows.map(i => (
          <div
            key={i.key}
            className={`reminder-line${i.daysLeft < 0 ? ' is-late' : i.daysLeft <= ALERT_DAYS ? ' is-soon' : ''}`}
          >
            <span className="reminder-name">{i.name}</span>
            <span className="reminder-when">{when(i.daysLeft)}</span>
            <span className="reminder-amt">{fmt(i.amount)}</span>
          </div>
        ))}
        {reminders.items.length > COLLAPSED_ROWS && (
          <button type="button" className="reminder-more" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
            {expanded ? 'Show less' : `Show ${reminders.items.length - COLLAPSED_ROWS} more`}
          </button>
        )}
      </div>
    </SectionBlock>
  )
}
