/**
 * Last-known copies of what a screen showed, so a cold launch can paint
 * immediately and refresh behind it (stale-while-revalidate).
 *
 * The phone is on the other side of the world from the server, and a cold
 * launch used to show a spinner until `init`, `getData` and the dashboard
 * summary had all made the round trip. Now the last copy shows at once and the
 * fresh one replaces it when it lands.
 *
 * - Keyed by org, so switching orgs never shows the other org's numbers.
 * - Lives on this device only and is cleared on logout (`clearSnapshots`).
 * - Never the source of truth for a write: saves still go to the server.
 */
import { readMenuCache } from './profileMenuCache'

const PREFIX = 'ft_snap_v1:'
/** Anything older than this is not worth showing as "current". */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

type Envelope<T> = { at: number; data: T }

function scopedKey(name: string): string {
  const org = readMenuCache()?.orgId ?? 'none'
  return `${PREFIX}${org}:${name}`
}

export function readSnapshot<T>(name: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(scopedKey(name))
    if (!raw) return null
    const env = JSON.parse(raw) as Envelope<T>
    if (!env || typeof env.at !== 'number' || Date.now() - env.at > MAX_AGE_MS) return null
    return env.data
  } catch {
    return null
  }
}

export function writeSnapshot<T>(name: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(scopedKey(name), JSON.stringify({ at: Date.now(), data } satisfies Envelope<T>))
  } catch {
    // Quota full: drop our snapshots and carry on without them.
    clearSnapshots()
  }
}

export function clearSnapshots(): void {
  if (typeof window === 'undefined') return
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith(PREFIX)) window.localStorage.removeItem(k)
    }
  } catch {
    /* storage blocked */
  }
}
