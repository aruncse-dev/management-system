import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { CalendarDays, History, Users } from 'lucide-react'
import { AppAuthGate, PwaServiceWorker, formatBuildLabel, SimpleAppNav, type SimpleAppNavSection } from '@fintracker-vault/ui'
import { getClientAuthEnv } from '../clientAuthEnv'
import { StaffWorkspaceProvider } from '../StaffWorkspaceContext'
import '@fintracker-vault/ui/styles/ui-kit'
// Google Sans (Gboard / Google apps), self-hosted as a variable font with
// optical sizing: headline digits get their wider display shapes, small text
// its open text shapes. Only the Latin + ₹ subsets are fetched.
import '@fontsource-variable/google-sans/opsz.css'
import '../styles/globals.css'

/** Which deploy is running, shown at the bottom of the menu drawer. */
const BUILD_LABEL = formatBuildLabel(process.env.NEXT_PUBLIC_BUILD_SHA, process.env.NEXT_PUBLIC_BUILD_TIME)

const STAFF_PAGE_TITLES: Record<string, string> = {
  '/attendance': 'Attendance',
  '/history': 'History',
  '/staffs': 'Staffs',
}

const STAFF_NAV_SECTIONS: SimpleAppNavSection[] = [
  {
    heading: 'Menu',
    items: [
      { path: '/attendance', label: 'Attendance', icon: <CalendarDays size={18} /> },
      { path: '/history', label: 'History', icon: <History size={18} /> },
      { path: '/staffs', label: 'Staffs', icon: <Users size={18} /> },
    ],
  },
]

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const { googleClientId: gid } = getClientAuthEnv()
  const googleClientId = gid

  const pageTitle = STAFF_PAGE_TITLES[router.pathname] || 'Staff'

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </Head>
      <PwaServiceWorker build={process.env.NEXT_PUBLIC_BUILD_SHA} />
      <AppAuthGate appKind="staff" googleClientId={googleClientId}>
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
                onLogout={onLogout}
                buildLabel={BUILD_LABEL}
              />
              <Component {...pageProps} />
            </div>
          </StaffWorkspaceProvider>
        )}
      </AppAuthGate>
    </>
  )
}
