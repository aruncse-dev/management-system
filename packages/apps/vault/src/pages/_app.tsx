import type { AppProps } from 'next/app'
import Head from 'next/head'
import { GeistSans } from 'geist/font/sans'
import { useRouter } from 'next/router'
import {
  FileText,
  Grid2X2,
  Landmark,
  Shield,
  Users,
} from 'lucide-react'
import { AppAuthGate, PwaServiceWorker, SimpleAppNav, type SimpleAppNavSection } from '@fintracker-vault/ui'
import { StoreProvider } from '../store'
import { getClientAuthEnv } from '../clientAuthEnv'
import '@fintracker-vault/ui/styles/ui-kit'
import '../styles/globals.css'

const VAULT_PAGE_TITLES: Record<string, string> = {
  '/vault': 'Banking',
  '/vaultinsurance': 'Insurance',
  '/vaultapps': 'Apps',
  '/vaultpersons': 'Persons',
  '/vaultdocuments': 'Documents',
}

const VAULT_NAV_SECTIONS: SimpleAppNavSection[] = [
  {
    heading: 'Vault',
    items: [
      { path: '/vault', label: 'Banking', icon: <Landmark size={18} /> },
      { path: '/vaultapps', label: 'Apps', icon: <Grid2X2 size={18} /> },
    ],
  },
  {
    heading: 'Family',
    items: [
      { path: '/vaultpersons', label: 'Persons', icon: <Users size={18} /> },
      { path: '/vaultdocuments', label: 'Documents', icon: <FileText size={18} /> },
    ],
  },
  {
    heading: 'Coverage',
    items: [{ path: '/vaultinsurance', label: 'Insurance', icon: <Shield size={18} /> }],
  },
]

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const { googleClientId: gid } = getClientAuthEnv()
  const googleClientId = gid

  const pageTitle = VAULT_PAGE_TITLES[router.pathname] || 'Vault'

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        {/* Self-hosted Geist (next/font): preloaded from this origin, no third-party CSS blocking first paint. */}
        <style dangerouslySetInnerHTML={{ __html: `:root{--font-sans:${GeistSans.style.fontFamily}}` }} />
      </Head>
      <PwaServiceWorker />
      <AppAuthGate appKind="vault" googleClientId={googleClientId}>
      {({ onLogout }) => (
        <StoreProvider>
          <div className="with-app-shell">
            <SimpleAppNav
              appName="Vault"
              iconSrc="/vault-192.png"
              iconAlt="Vault"
              barTitle={pageTitle}
              currentPath={router.pathname || '/vault'}
              onNavigate={(path: string) => {
                void router.push(path)
              }}
              sections={VAULT_NAV_SECTIONS}
              onLogout={onLogout}
            />
            <Component {...pageProps} />
          </div>
        </StoreProvider>
      )}
    </AppAuthGate>
    </>
  )
}
