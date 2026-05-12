import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { AppAuthGate, Nav, type ModuleId, type NavDynamicMenuSection } from '@fintracker-vault/ui'
import { getAppArea } from '../appPaths'
import { StoreProvider } from '../store'
import { getClientAuthEnv } from '../clientAuthEnv'
import { OrgSwitcher } from '../components/OrgSwitcher'
import { FintrackerModesProvider } from '../context/FintrackerModesContext'
import {
  MENU_CACHE_UPDATED_EVENT,
  readMenuCache,
  writeMenuCache,
  type CachedProfileMenuRow,
} from '../lib/profileMenuCache'
import '../ui-kit/ui-kit.css'
import '../styles/globals.css'

/** Empty array ⇒ drawer shows only Settings, UI Kit, Logout (no org menu items). */
function groupNavMenu(menu: CachedProfileMenuRow[] | undefined | null): NavDynamicMenuSection[] {
  if (!menu?.length) return []
  const map = new Map<string, CachedProfileMenuRow[]>()
  for (const m of menu) {
    const arr = map.get(m.sectionLabel) ?? []
    arr.push(m)
    map.set(m.sectionLabel, arr)
  }
  return [...map.entries()].map(([sectionLabel, items]) => ({
    sectionLabel,
    items: [...items]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
      .map(m => ({ id: m.id, label: m.label, icon: m.icon, path: m.path })),
  }))
}

const PAGE_TITLES: Record<ModuleId, string> = {
  dashboard: 'Dashboard',
  budget: 'Budget',
  transactions: 'Transactions',
  credits: 'Credits',
  accounts: 'Accounts',
  lending: 'Lending',
  savings: 'Savings',
  subscriptions: 'Subscriptions',
  bommi: 'Bommi',
  gold: 'Gold',
  investments: 'Investments',
  stocks: 'Stocks',
  mutualfunds: 'Mutual Funds',
  loans: 'All Loans',
  settings: 'Settings',
  components: 'UI Kit',
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [lendingSheet, setLendingSheet] = useState('Lending')
  const [dynamicMenu, setDynamicMenu] = useState<NavDynamicMenuSection[]>([])

  useLayoutEffect(() => {
    const c = readMenuCache()
    if (c?.menu?.length) setDynamicMenu(groupNavMenu(c.menu))
  }, [])

  useEffect(() => {
    const onMenuCacheUpdated = () => {
      const c = readMenuCache()
      setDynamicMenu(groupNavMenu(c?.menu ?? []))
    }
    window.addEventListener(MENU_CACHE_UPDATED_EVENT, onMenuCacheUpdated)
    return () => window.removeEventListener(MENU_CACHE_UPDATED_EVENT, onMenuCacheUpdated)
  }, [])

  const { googleClientId: gid } = getClientAuthEnv()
  const googleClientId = gid

  const moduleFromPath = useMemo<ModuleId | null>(() => {
    const p = router.pathname.toLowerCase()
    if (p === '/dashboard') return 'dashboard'
    if (p === '/monthly') {
      const t = router.query.tab
      const tab = typeof t === 'string' ? t : Array.isArray(t) ? t[0] : undefined
      if (tab === 'bud') return 'budget'
      if (tab === 'txns') return 'transactions'
      if (tab === 'cc') return 'credits'
      if (tab === 'acct') return 'accounts'
      return 'dashboard'
    }
    if (p === '/accounts') return 'accounts'
    if (p === '/lending') return 'lending'
    if (p === '/savings' || p === '/savingspage') return 'savings'
    if (p === '/subscriptions') return 'subscriptions'
    if (p === '/bommi') return 'bommi'
    if (p === '/gold') return 'gold'
    if (p === '/investments') return 'investments'
    if (p === '/stocks') return 'stocks'
    if (p === '/mutualfunds') return 'mutualfunds'
    if (p === '/loans') return 'loans'
    if (p === '/settings') return 'settings'
    if (p === '/components') return 'components'
    return null
  }, [router.pathname, router.query.tab])

  const goToModule = useCallback(
    (id: ModuleId, lendingSheetForUrl?: string) => {
      const sheet =
        id === 'lending' && lendingSheetForUrl !== undefined ? lendingSheetForUrl : lendingSheet
      const pathByModule: Record<ModuleId, string> = {
        dashboard: '/monthly?tab=dash',
        budget: '/monthly?tab=bud',
        transactions: '/monthly?tab=txns',
        credits: '/monthly?tab=cc',
        accounts: '/monthly?tab=acct',
        lending:
          sheet && sheet !== 'Lending' ? `/lending?sheet=${encodeURIComponent(sheet)}` : '/lending',
        savings: '/savings',
        subscriptions: '/subscriptions',
        bommi: '/bommi',
        gold: '/gold',
        investments: '/investments',
        stocks: '/stocks',
        mutualfunds: '/mutualfunds',
        loans: '/loans',
        settings: '/settings',
        components: '/components',
      }
      void router.push(pathByModule[id] || '/monthly?tab=dash')
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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/profile', { credentials: 'same-origin' })
        const j = await r.json()
        if (cancelled || !j.ok) return
        const menu = (j.data?.menu ?? []) as CachedProfileMenuRow[]
        writeMenuCache(j.data?.activeOrgId ?? null, menu)
        setDynamicMenu(groupNavMenu(menu))
      } catch {
        if (!cancelled) setDynamicMenu([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router.pathname])

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
            <FintrackerModesProvider>
            <div className="with-app-shell">
              {moduleFromPath && (
                <>
                  <Nav
                    module={moduleFromPath}
                    onModule={goToModule}
                    lendingSheet={lendingSheet}
                    onLendingSheet={setLendingSheet}
                    title={pageTitle}
                    appName="FinTracker"
                    area={getAppArea(router.asPath)}
                    onLogout={onLogout}
                    dynamicMenu={dynamicMenu}
                    activeAsPath={router.asPath}
                    onNavigatePath={(path: string) => void router.push(path)}
                  />
                  <OrgSwitcher />
                </>
              )}
              <Component {...pageProps} />
            </div>
            </FintrackerModesProvider>
          </StoreProvider>
        )}
      </AppAuthGate>
    </>
  )
}
