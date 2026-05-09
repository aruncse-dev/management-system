import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
  firstMenuPathFromRows,
  readMenuCache,
  refreshMenuCacheInBackground,
  writeMenuCache,
} from '../lib/profileMenuCache'

/**
 * Do not use getServerSideProps redirect from `/` — it 307s to `/monthly` while middleware
 * 307s unauthenticated `/monthly` back to `/`, causing a redirect loop.
 *
 * Authenticated: redirect to first enabled org menu path (cached immediately if available;
 * otherwise wait for `/api/profile`). Empty menu ⇒ `/settings`. Background refresh updates cache.
 */
export default function HomePage() {
  const router = useRouter()
  const [waitingForMenu, setWaitingForMenu] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const sess = await fetch('/api/auth/session', { credentials: 'same-origin' }).then((r) => r.json())
      if (cancelled) return
      if (!sess?.authed) return

      const cached = readMenuCache()
      const fromCache = cached?.menu?.length ? firstMenuPathFromRows(cached.menu) : null
      if (fromCache) {
        void router.replace(fromCache)
        refreshMenuCacheInBackground()
        return
      }

      setWaitingForMenu(true)
      const pr = await fetch('/api/profile', { credentials: 'same-origin' }).then((r) => r.json())
      if (cancelled) return
      setWaitingForMenu(false)

      if (!pr?.ok) {
        void router.replace('/settings')
        return
      }

      const menu = pr.data?.menu ?? []
      writeMenuCache(pr.data?.activeOrgId ?? null, menu)
      const path = firstMenuPathFromRows(menu)
      void router.replace(path ?? '/settings')
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (waitingForMenu) {
    return (
      <div className="ui-kit-page-shell" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
        Loading…
      </div>
    )
  }
  return null
}
