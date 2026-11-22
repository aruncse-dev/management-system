import { useEffect } from 'react'

/**
 * Registers `/sw.js` (see packages/shared/config/pwa/sw.js) in production.
 *
 * Registration waits for `load` so it never competes with the first paint.
 * In development any worker left behind from a production build is removed,
 * because a cache-first worker makes hot reload serve stale chunks.
 */
export function PwaServiceWorker() {
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
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* no worker just means no offline shell — never break the app over it */
      })
    }
    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])
  return null
}
