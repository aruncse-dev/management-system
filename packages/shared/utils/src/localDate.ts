/**
 * `YYYY-MM-DD` for a moment in the *local* time zone.
 *
 * `Date#toISOString()` renders UTC, so between midnight and 05:30 IST it still
 * says yesterday. Every "defaults to today" field must go through this instead.
 */
export function localIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
