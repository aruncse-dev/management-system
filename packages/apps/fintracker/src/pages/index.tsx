import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * Do not use getServerSideProps redirect from `/` — it 307s to `/monthly` while middleware
 * 307s unauthenticated `/monthly` back to `/`, causing a redirect loop.
 */
export default function HomePage() {
  const router = useRouter()
  useEffect(() => {
    let cancelled = false
    void fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(r => r.json())
      .then((d: { authed?: boolean }) => {
        if (cancelled || !d.authed) return
        void router.replace('/monthly')
      })
    return () => {
      cancelled = true
    }
  }, [router])
  return null
}
