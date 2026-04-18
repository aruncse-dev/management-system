import type { AppProps } from 'next/app'
import Head from 'next/head'
import { AppAuthGate } from '../ui'
import { StoreProvider } from '../store'
import VaultNav from '../components/VaultNav'
import { getClientAuthEnv } from '../clientAuthEnv'
import '../ui-kit/ui-kit.css'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  const { googleClientId: gid, appPassword: pw, allowedEmailsRaw } = getClientAuthEnv()
  const googleClientId = gid
  const appPassword = pw
  const allowedEmails = allowedEmailsRaw
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#1E5CC7" />
      </Head>
      <AppAuthGate
      appKind="vault"
      googleClientId={googleClientId}
      appPassword={appPassword}
      allowedEmails={allowedEmails}
    >
      {({ onLogout }) => (
        <StoreProvider>
          <div className="with-app-shell">
            <VaultNav onLogout={onLogout} />
            <Component {...pageProps} />
          </div>
        </StoreProvider>
      )}
    </AppAuthGate>
    </>
  )
}
