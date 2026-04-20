import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Avoid SSR redirect from `/` — conflicts with middleware redirect for unauthenticated users.
 */
export default function HomePage() {
  const router = useRouter()
  useEffect(() => {
    let cancelled = false
    void fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(r => r.json())
      .then((d: { authed?: boolean }) => {
        if (cancelled || !d.authed) return
        void router.replace('/vault')
      })
    return () => {
      cancelled = true
    }
  }, [router])
  return null
}
