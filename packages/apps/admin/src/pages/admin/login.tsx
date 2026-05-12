import Head from 'next/head'
import { useRouter } from 'next/router'
import { useCallback, useState } from 'react'
import type { CredentialResponse } from '@react-oauth/google'
import { GoogleAuthCard, GoogleSignInButton } from '@fintracker-vault/ui'
import { getClientAuthEnv } from '../../clientAuthEnv'

export default function AdminLoginPage() {
  const router = useRouter()
  const { googleClientId } = getClientAuthEnv()
  const [error, setError] = useState('')

  const goNext = useCallback(() => {
    const next = typeof router.query.next === 'string' ? router.query.next : '/admin'
    void router.replace(next.startsWith('/') ? next : '/admin')
  }, [router])

  const handleGoogle = async (resp: CredentialResponse) => {
    setError('')
    const token = resp.credential
    if (!token) {
      setError('Google did not return a token.')
      return
    }

    try {
      const r = await fetch('/api/admin/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ credential: token }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError((j as { error?: string }).error || 'Google sign-in failed.')
        return
      }
      goNext()
    } catch {
      setError('Google sign-in request failed.')
    }
  }

  return (
    <>
      <Head>
        <title>Admin sign-in · FinTracker</title>
      </Head>
      <GoogleAuthCard
        iconSrc="/favicon.svg"
        iconAlt="FinTracker"
        title="Admin"
        subtitle="Sign in with Google."
        error={error}
      >
        <div className="admin-login-stack">
          {googleClientId ? (
            <div className="login-auth-card__google">
              <GoogleSignInButton onSuccess={handleGoogle} onError={() => setError('Google sign-in failed.')} />
            </div>
          ) : null}
        </div>
      </GoogleAuthCard>
    </>
  )
}
