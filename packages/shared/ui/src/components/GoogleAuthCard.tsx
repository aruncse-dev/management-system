import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'

/** Circular white tile behind transparent auth logo (matches nav app icon). */
export const LOGIN_BRAND_MARK_STYLE: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  background: '#ffffff',
  backgroundColor: '#ffffff',
  border: '1px solid rgba(15, 35, 80, 0.08)',
  boxShadow: '0 8px 22px rgba(15, 35, 80, 0.28)',
  boxSizing: 'border-box',
}

export type GoogleAuthCardProps = {
  iconSrc: string
  iconAlt: string
  title: string
  subtitle: string
  error?: string | null
  /** Google button, PIN form, or config message — laid out inside the card actions row. */
  children: ReactNode
}

/**
 * Full-viewport gradient + frosted card with app icon, title, copy, optional error, and actions.
 * Use with app `globals.css` login-* rules.
 */
export function GoogleAuthCard({ iconSrc, iconAlt, title, subtitle, error, children }: GoogleAuthCardProps) {
  return (
    <div className="login-screen">
      <div className="login-panel login-auth-card">
        <div className="login-auth-card__head">
          <div className="login-brand-mark login-auth-card__mark" style={LOGIN_BRAND_MARK_STYLE}>
            <img src={iconSrc} alt={iconAlt} width={52} height={52} className="login-brand-img" />
          </div>
          <div className="login-title">{title}</div>
          <div className="login-sub">{subtitle}</div>
        </div>
        {(error || '').trim() ? <div className="login-auth-card__error">{error}</div> : null}
        <div className="login-auth-card__actions">{children}</div>
      </div>
    </div>
  )
}

/** Mount Google button after paint so GSI script + Strict Mode remounts do not race. */
export function GoogleSignInButton({
  onSuccess,
  onError,
  width = 240,
}: {
  onSuccess: (credentialResponse: CredentialResponse) => void
  onError: () => void
  width?: number
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) {
    return <div className="login-google-placeholder" aria-busy="true" aria-label="Loading Google Sign-In" />
  }
  return (
    <GoogleLogin
      onSuccess={onSuccess}
      onError={onError}
      type="standard"
      theme="outline"
      size="large"
      text="signin_with"
      shape="pill"
      width={width}
    />
  )
}
