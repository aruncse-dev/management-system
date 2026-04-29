import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { AppAuthGate, Nav, type ModuleId } from '@fintracker-vault/ui'
import { getAppArea } from '../appPaths'
import { StoreProvider } from '../store'
import { getClientAuthEnv } from '../clientAuthEnv'
import '../ui-kit/ui-kit.css'
import '../styles/globals.css'

const PAGE_TITLES: Record<ModuleId, string> = {
  monthly: 'Monthly Expenses',
  lending: 'Lending',
  savings: 'Savings',
  subscriptions: 'Subscriptions',
  bommi: 'Bommi',
  gold: 'Gold',
  investments: 'Investments',
  loans: 'All Loans',
  settings: 'Settings',
  components: 'UI Kit',
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [lendingSheet, setLendingSheet] = useState('Lending')
  const { googleClientId: gid } = getClientAuthEnv()
  const googleClientId = gid

  const moduleFromPath = useMemo<ModuleId | null>(() => {
    const p = router.pathname.toLowerCase()
    if (p === '/monthly') return 'monthly'
    if (p === '/lending') return 'lending'
    if (p === '/savings' || p === '/mutualfunds' || p === '/stocks') return 'savings'
    if (p === '/subscriptions') return 'subscriptions'
    if (p === '/bommi') return 'bommi'
    if (p === '/gold') return 'gold'
    if (p === '/investments') return 'investments'
    if (p === '/loans') return 'loans'
    if (p === '/settings') return 'settings'
    if (p === '/components') return 'components'
    return null
  }, [router.pathname])

  const goToModule = useCallback(
    (id: ModuleId, lendingSheetForUrl?: string) => {
      const sheet =
        id === 'lending' && lendingSheetForUrl !== undefined ? lendingSheetForUrl : lendingSheet
      const pathByModule: Record<ModuleId, string> = {
        monthly: '/monthly',
        lending:
          sheet && sheet !== 'Lending' ? `/lending?sheet=${encodeURIComponent(sheet)}` : '/lending',
        savings: '/savings',
        subscriptions: '/subscriptions',
        bommi: '/bommi',
        gold: '/gold',
        investments: '/investments',
        loans: '/loans',
        settings: '/settings',
        components: '/components',
      }
      void router.push(pathByModule[id] || '/monthly')
    },
    [router, lendingSheet],
  )

  useEffect(() => {
    if (!router.isReady || router.pathname !== '/lending') return
    const q = router.query.sheet
    const s = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : undefined
    if (s) setLendingSheet(s)
    else setLendingSheet('Lending')
  }, [router.isReady, router.pathname, router.query.sheet])

  const pageTitle = useMemo(() => {
    if (!moduleFromPath) return 'FinTracker'
    if (moduleFromPath !== 'lending') return PAGE_TITLES[moduleFromPath]
    return lendingSheet && lendingSheet !== 'Lending' ? lendingSheet : PAGE_TITLES.lending
  }, [moduleFromPath, lendingSheet])

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#1E5CC7" />
      </Head>
      <AppAuthGate appKind="fintracker" googleClientId={googleClientId}>
      {({ onLogout }) => (
        <StoreProvider>
          <div className="with-app-shell">
            {moduleFromPath && (
              <Nav
                module={moduleFromPath}
                onModule={goToModule}
                lendingSheet={lendingSheet}
                onLendingSheet={setLendingSheet}
                title={pageTitle}
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
    </>
  )
}
