import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Grid2X2, Landmark, Settings as SettingsIcon, Shield } from 'lucide-react'
import { AppAuthGate, SimpleAppNav, type SimpleAppNavSection } from '@fintracker-vault/ui'
import { StoreProvider } from '../store'
import { getClientAuthEnv } from '../clientAuthEnv'
import '../ui-kit/ui-kit.css'
import '../styles/globals.css'

const VAULT_PAGE_TITLES: Record<string, string> = {
  '/vault': 'Banking',
  '/vaultinsurance': 'Insurance',
  '/vaultapps': 'Apps',
  '/vaultsettings': 'Settings',
}

const VAULT_NAV_SECTIONS: SimpleAppNavSection[] = [
  {
    heading: 'Vault',
    items: [
      { path: '/vault', label: 'Banking', icon: <Landmark size={18} /> },
      { path: '/vaultinsurance', label: 'Insurance', icon: <Shield size={18} /> },
      { path: '/vaultapps', label: 'Apps', icon: <Grid2X2 size={18} /> },
    ],
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
        <meta name="theme-color" content="#1E5CC7" />
      </Head>
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
              settingsItem={{ path: '/vaultsettings', label: 'Settings', icon: <SettingsIcon size={18} /> }}
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
