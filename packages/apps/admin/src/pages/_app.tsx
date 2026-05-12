import type { AppProps } from 'next/app'
import Head from 'next/head'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { useRouter } from 'next/router'
import {
  SimpleAppNav,
  type SimpleAppNavSection,
} from '@fintracker-vault/ui'
import { LayoutGrid, UserCog, Users } from 'lucide-react'
import { getClientAuthEnv } from '../clientAuthEnv'
import '@fintracker-vault/ui/styles'
import '../ui-kit/ui-kit.css'
import '@fintracker-vault/ui/styles/admin'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const { googleClientId: gid } = getClientAuthEnv()
  const googleClientId = gid

  const isLogin = router.pathname === '/admin/login'

  const sections: SimpleAppNavSection[] = [
    {
      heading: 'Admin',
      items: [
        { path: '/admin/orgs', label: 'Organizations', icon: <LayoutGrid size={18} /> },
        { path: '/admin/users', label: 'Admin users', icon: <UserCog size={18} /> },
        { path: '/admin/members', label: 'Org members', icon: <Users size={18} /> },
      ],
    },
  ]

  return (
    <>
      <Head>
        <title>Admin · FinTracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#1E5CC7" />
      </Head>
      <GoogleOAuthProvider clientId={googleClientId || ''}>
        <div className="with-app-shell admin-surface">
          {isLogin ? (
            <Component {...pageProps} />
          ) : (
            <>
              <SimpleAppNav
                appName="Admin"
                iconSrc="/favicon.svg"
                iconAlt="Admin"
                barTitle="Admin"
                currentPath={router.pathname || '/admin/orgs'}
                onNavigate={(path: string) => void router.push(path)}
                sections={sections}
                onLogout={async () => {
                  try {
                    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin' })
                  } catch {
                    /* ignore */
                  }
                  void router.push('/admin/login')
                }}
              />
              <Component {...pageProps} />
            </>
          )}
        </div>
      </GoogleOAuthProvider>
    </>
  )
}
