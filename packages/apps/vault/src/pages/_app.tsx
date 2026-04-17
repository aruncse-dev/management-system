import type { AppProps } from 'next/app'
import { AppAuthGate } from '../ui'
import { StoreProvider } from '../store'
import VaultNav from '../components/VaultNav'
import '../ui-kit/ui-kit.css'
import '../styles/globals.css'

const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim()
const appPassword = (process.env.NEXT_PUBLIC_APP_PASSWORD || '').trim() || '1234'
const allowedEmails = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export default function App({ Component, pageProps }: AppProps) {
  return (
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
  )
}
