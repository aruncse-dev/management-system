/**
 * Last-known copies of what a screen showed, so a cold launch can paint
 * immediately and refresh behind it (stale-while-revalidate).
 *
 * The phone is on the other side of the world from the server, and a cold
 * launch used to show a spinner until `init`, `getData` and the dashboard
 * summary had all made the round trip. Now the last copy shows at once and the
 * fresh one replaces it when it lands.
 *
 * - Keyed by org, so switching orgs never shows the other org's numbers; with
 *   no known org nothing is read or written.
 * - Lives on this device only, and is cleared on logout and whenever the server
 *   reports the device signed out (`clearSnapshots`), so the next account to
 *   sign in never sees the previous one's figures.
 * - Never the source of truth for a write: saves still go to the server.
 */
import { readMenuCache } from './profileMenuCache'

const PREFIX = 'ft_snap_v1:'
/** Anything older than this is not worth showing as "current". */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

type Envelope<T> = { at: number; data: T }

/** Null until the org is known — reading or writing under a guessed org could cross orgs. */
function scopedKey(name: string): string | null {
  const org = readMenuCache()?.orgId
  return org ? `${PREFIX}${org}:${name}` : null
}

export function readSnapshot<T>(name: string): T | null {
  const key = typeof window === 'undefined' ? null : scopedKey(name)
  if (!key) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const env = JSON.parse(raw) as Envelope<T>
    if (!env || typeof env.at !== 'number' || Date.now() - env.at > MAX_AGE_MS) return null
    return env.data
  } catch {
    return null
  }
}

export function writeSnapshot<T>(name: string, data: T): void {
  const key = typeof window === 'undefined' ? null : scopedKey(name)
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), data } satisfies Envelope<T>))
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
