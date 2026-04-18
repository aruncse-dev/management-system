import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { CalendarDays, Settings as SettingsIcon, Users } from 'lucide-react'
import { AppAuthGate, SimpleAppNav, type SimpleAppNavSection } from '@fintracker-vault/ui'
import { getClientAuthEnv } from '../clientAuthEnv'
import { StaffWorkspaceProvider } from '../StaffWorkspaceContext'
import '../ui-kit/ui-kit.css'
import '../styles/globals.css'

const STAFF_PAGE_TITLES: Record<string, string> = {
  '/attendance': 'Attendance',
  '/staffs': 'Staffs',
  '/settings': 'Settings',
}

const STAFF_NAV_SECTIONS: SimpleAppNavSection[] = [
  {
    heading: 'Menu',
    items: [
      { path: '/attendance', label: 'Attendance', icon: <CalendarDays size={18} /> },
      { path: '/staffs', label: 'Staffs', icon: <Users size={18} /> },
    ],
  },
]

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
          <StaffWorkspaceProvider>
            <div className="with-app-shell">
              <SimpleAppNav
                appName="Staff"
                iconSrc="/icon-192.png"
                barTitle={pageTitle}
                currentPath={router.pathname || '/attendance'}
                onNavigate={(path: string) => {
                  void router.push(path)
                }}
                sections={STAFF_NAV_SECTIONS}
                settingsItem={{ path: '/settings', label: 'Settings', icon: <SettingsIcon size={18} /> }}
                onLogout={onLogout}
              />
              <Component {...pageProps} />
            </div>
          </StaffWorkspaceProvider>
        )}
      </AppAuthGate>
    </>
  )
}
