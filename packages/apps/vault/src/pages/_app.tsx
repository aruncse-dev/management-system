import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  FileText,
  Grid2X2,
  Landmark,
  Shield,
  Users,
} from 'lucide-react'
import { AppAuthGate, PwaServiceWorker, formatBuildLabel, SimpleAppNav, type SimpleAppNavSection } from '@fintracker-vault/ui'
import { StoreProvider } from '../store'
import { getClientAuthEnv } from '../clientAuthEnv'
import '@fintracker-vault/ui/styles/ui-kit'
// Google Sans (Gboard / Google apps), self-hosted as a variable font (weight +
// optical-size axes; globals.css pins the text optical size). Only the Latin
// + ₹ subsets are fetched.
import '@fontsource-variable/google-sans/opsz.css'
import '../styles/globals.css'

/** Which deploy is running, shown at the bottom of the menu drawer. */
const BUILD_LABEL = formatBuildLabel(process.env.NEXT_PUBLIC_BUILD_SHA, process.env.NEXT_PUBLIC_BUILD_TIME)

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
      </Head>
      <PwaServiceWorker build={process.env.NEXT_PUBLIC_BUILD_SHA} />
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
              buildLabel={BUILD_LABEL}
            />
            <Component {...pageProps} />
          </div>
        </StoreProvider>
      )}
    </AppAuthGate>
    </>
  )
}
