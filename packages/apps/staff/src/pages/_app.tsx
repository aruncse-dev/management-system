import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { AppAuthGate } from '@fintracker-vault/ui'
import StaffNav from '../components/StaffNav'
import { getClientAuthEnv } from '../clientAuthEnv'
import '../ui-kit/ui-kit.css'
import '../styles/globals.css'

const STAFF_PAGE_TITLES: Record<string, string> = {
  '/attendance': 'Attendance',
  '/staffs': 'Staffs',
  '/settings': 'Settings',
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const { googleClientId: gid, appPassword: pw, allowedEmailsRaw } = getClientAuthEnv()
  const googleClientId = gid
  const appPassword = pw
  const allowedEmails = allowedEmailsRaw
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  const pageTitle = STAFF_PAGE_TITLES[router.pathname] || 'Staff'

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#1E5CC7" />
      </Head>
      <AppAuthGate
        appKind="staff"
        googleClientId={googleClientId}
        appPassword={appPassword}
        allowedEmails={allowedEmails}
      >
        {({ onLogout }) => (
          <div className="with-app-shell">
            <StaffNav onLogout={onLogout} />
            <Component {...pageProps} />
          </div>
        )}
      </AppAuthGate>
    </>
  )
}
