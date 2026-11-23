import { useEffect, useState } from 'react'
import { launchLog } from './launchLog'

/** "f215a3f · 22 Nov, 16:47" from the build's commit and time (local time of the viewer). */
export function formatBuildLabel(sha: string | undefined, iso: string | undefined): string {
  const s = (sha || '').trim()
  if (!s) return ''
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return s
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${s} · ${date}, ${time}`
}

/** Within this long of opening, a newer deploy is applied by reloading at once. */
const LAUNCH_WINDOW_MS = 15_000

async function deployedBuild(): Promise<string | null> {
  try {
    const r = await fetch('/version.json', { cache: 'no-store', credentials: 'same-origin' })
    if (!r.ok) return null
    const v = (await r.json()) as { build?: string }
    return typeof v.build === 'string' ? v.build : null
  } catch {
    return null
  }
}

/** Drop the service worker's saved pages so the reload is served by the network. */
async function dropSavedPages() {
  try {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k.startsWith('ft-pages')).map(k => caches.delete(k)))
  } catch {
    /* no Cache Storage (private mode) — the reload still asks the network first */
  }
}

/**
 * Registers `/sw.js` (see packages/shared/config/pwa/sw.js) in production, and
 * keeps an installed app on the newest deploy.
 *
 * Registration waits for `load` so it never competes with the first paint.
 * In development any worker left behind from a production build is removed,
 * because a cache-first worker makes hot reload serve stale chunks.
 *
 * Update check: each deploy publishes `/version.json` with its commit. When
 * the deploy on the server differs from the build that is running (an old
 * page shell served from the worker's cache on a slow launch), the app drops
 * the saved pages and reloads once if it was just opened, or shows a
 * "New version" bar if the person is already using it — never a reload in the
 * middle of an entry. `build` is the running build's commit; 'local' or empty
 * turns the check off.
 */
export function PwaServiceWorker({ build }: { build?: string } = {}) {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then(regs => Promise.all(regs.map(r => r.unregister())))
        .catch(() => {})
      return
    }

    const register = () => {
      // Ask Chrome to keep this app's data when the phone is low on space.
      // Without it the worker, saved pages and launch log can all be evicted.
      // Installed apps are usually granted this silently; no prompt on Android.
      if (navigator.storage?.persist) {
        void navigator.storage
          .persisted()
          .then(already => (already ? true : navigator.storage.persist()))
          .then(kept => launchLog(`storage ${kept ? 'kept by Chrome (persistent)' : 'not persistent: can be evicted when space is low'}`))
          .catch(() => {})
      }
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(reg => launchLog(`worker registered (${reg?.active ? 'active' : reg?.installing ? 'installing' : 'waiting'})`))
        .catch(e => {
          /* no worker just means no offline shell — never break the app over it */
          launchLog(`worker registration failed: ${e instanceof Error ? e.message : String(e)}`)
        })
    }
    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return
    if (!build || build === 'local') return
    const openedAt = Date.now()
    let cancelled = false

    const check = async () => {
      const live = await deployedBuild()
      if (cancelled) return
      launchLog(`update check: running ${build}, server has ${live ?? 'no answer'}`)
      if (!live || live === build) return
      const justOpened = Date.now() - openedAt < LAUNCH_WINDOW_MS
      const triedKey = `ft_update_tried_${live}`
      let tried = false
      try {
        tried = sessionStorage.getItem(triedKey) === '1'
        sessionStorage.setItem(triedKey, '1')
      } catch {
        /* storage blocked: fall back to the bar */
        tried = true
      }
      if (justOpened && !tried) {
        launchLog('newer version on the server: reloading once')
        await dropSavedPages()
        window.location.reload()
        return
      }
      launchLog('newer version on the server: showing the update bar')
      setUpdateReady(true)
    }

    void check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [build])

  if (!updateReady) return null
  return (
    <div className="pwa-update-bar" role="status">
      <span>New version available</span>
      <button
        type="button"
        onClick={() => {
          void dropSavedPages().then(() => window.location.reload())
        }}
      >
        Reload
      </button>
    </div>
  )
}
