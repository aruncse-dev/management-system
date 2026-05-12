import { useEffect, type ReactNode } from 'react'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="modal-bg open"
      onClick={onCancel}
      role="presentation"
      style={{ alignItems: 'center', padding: '24px 16px' }}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(100%, 420px)',
          padding: 16,
          borderRadius: 16,
          boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--text)', fontWeight: 800, fontSize: 16 }}>{title}</div>
            {description ? (
              <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: 'var(--muted)' }}>{description}</div>
            ) : null}
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            style={{ background: 'var(--bg)', color: 'var(--text)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="settings-action-btn" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button
            type="button"
            className="settings-action-btn"
            onClick={() => void onConfirm()}
            disabled={busy}
            style={
              tone === 'danger'
                ? { borderColor: 'rgba(239,68,68,.25)', color: 'var(--red)' }
                : { borderColor: 'rgba(30,92,199,.25)', color: 'var(--navy)' }
            }
          >
            {busy ? 'Working…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
