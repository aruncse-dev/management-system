import { AlertCircle } from 'lucide-react'

interface Props {
  error: string
  onRetry?: () => void
  /** Public path to app icon (vault may use `/apple-touch-icon.png`). */
  iconSrc?: string
}

export default function ErrorScreen({ error, onRetry, iconSrc = '/icon-192.png' }: Props) {
  const showApiHints =
    error.includes('Unexpected HTML from API') || error.includes('sign-in page instead of API JSON')

  return (
    <div className="login-screen">
      <div style={{ textAlign: 'center', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 24,
              background: 'rgba(255,255,255,.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,.14)',
            }}
          >
            <img src={iconSrc} alt="" width="48" height="48" style={{ borderRadius: 14, objectFit: 'cover' }} />
          </div>
        </div>
        <AlertCircle size={48} style={{ color: '#EF4444', marginBottom: 16 }} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FFF', marginBottom: 8 }}>Backend or network error</h1>
        <p style={{ fontSize: 14, color: '#A5B4FC', marginBottom: 24 }}>{error}</p>

        {showApiHints && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', marginBottom: 10 }}>Things to check</div>
            <ol style={{ fontSize: 12, color: '#A5B4FC', margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
              <li>Sign in with Google on this app (session cookie required for API routes).</li>
              <li>
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>DATABASE_URL</code>{' '}
                is set and schema is applied (<code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>drizzle-kit push</code>).
              </li>
              <li>
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>NEXT_PUBLIC_API_URL</code>{' '}
                matches your API (default <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>/api</code>).
              </li>
              <li>Restart <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>pnpm dev:fintracker</code> after env changes.</li>
            </ol>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                background: '#2563EB',
                color: '#FFF',
                border: 'none',
                borderRadius: 8,
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#1d4ed8'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#2563EB'
              }}
            >
              🔄 Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#FFF',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            🔁 Refresh Page
          </button>
        </div>

        <p style={{ fontSize: 11, color: '#64748B', marginTop: 16 }}>
          Need more help? Check the browser console (F12) for detailed error logs
        </p>
      </div>
    </div>
  )
}
