import type { AppProps } from 'next/app'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { AppAuthGate, Nav, type ModuleId } from '../ui'
import { getAppArea } from '../appPaths'
import { StoreProvider } from '../store'
import '../ui-kit/ui-kit.css'
import '../styles/globals.css'

const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim()
const appPassword = (process.env.NEXT_PUBLIC_APP_PASSWORD || '').trim() || '1234'
const allowedEmails = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [lendingSheet, setLendingSheet] = useState('Lending')

  const moduleFromPath = useMemo<ModuleId | null>(() => {
    const p = router.pathname.toLowerCase()
    if (p === '/monthly') return 'monthly'
    if (p === '/lending') return 'lending'
    if (p === '/savings' || p === '/mutualfunds' || p === '/stocks') return 'savings'
    if (p === '/bommi') return 'bommi'
    if (p === '/gold') return 'gold'
    if (p === '/investments') return 'investments'
    if (p === '/loans') return 'loans'
    if (p === '/settings') return 'settings'
    if (p === '/components') return 'components'
    return null
  }, [router.pathname])

  const goToModule = useCallback((id: ModuleId) => {
    const pathByModule: Record<ModuleId, string> = {
      monthly: '/monthly',
      lending: lendingSheet && lendingSheet !== 'Lending' ? `/lending?sheet=${encodeURIComponent(lendingSheet)}` : '/lending',
      savings: '/savings',
      bommi: '/bommi',
      gold: '/gold',
      investments: '/investments',
      loans: '/loans',
      settings: '/settings',
      components: '/components',
    }
    void router.push(pathByModule[id] || '/monthly')
  }, [router, lendingSheet])

  return (
    <AppAuthGate
      appKind="fintracker"
      googleClientId={googleClientId}
      appPassword={appPassword}
      allowedEmails={allowedEmails}
    >
      {({ onLogout }) => (
        <StoreProvider>
          <div className="with-app-shell">
            {moduleFromPath && (
              <Nav
                module={moduleFromPath}
                onModule={goToModule}
                lendingSheet={lendingSheet}
                onLendingSheet={setLendingSheet}
                title="FinTracker"
                appName="FinTracker"
                area={getAppArea(router.asPath)}
                onLogout={onLogout}
              />
            )}
            <Component {...pageProps} />
          </div>
        </StoreProvider>
      )}
    </AppAuthGate>
  )
}
