import Head from 'next/head'
import { useEffect, useState } from 'react'
import { DataPageHeader, LoadingState, SectionChip } from '@fintracker-vault/ui'

type AppRow = {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  sortOrder: number
  status: string
}

export default function AdminAppsPage() {
  const [rows, setRows] = useState<AppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/admin/apps', { credentials: 'same-origin' })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || 'Failed to load apps')
        setRows((json.data || []) as AppRow[])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <>
      <Head>
        <title>Apps · Admin</title>
      </Head>
      <div className="admin-page">
        <DataPageHeader title="Applications" right={<SectionChip>{rows.length}</SectionChip>} />

        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

        {loading && <LoadingState variant="page" />}

        {!loading && rows.length === 0 && (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem 0' }}>
            No apps found.
          </p>
        )}

        {!loading && rows.length > 0 && (
          <div className="admin-card-list">
            {rows.map(app => (
              <div key={app.id} className="admin-card-item">
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1 }}>
                  {app.icon && (
                    <img
                      src={app.icon}
                      alt={app.name}
                      style={{ width: '32px', height: '32px', borderRadius: '6px', flexShrink: 0 }}
                    />
                  )}
                  <div className="admin-card-item__body">
                    <h3 className="admin-card-item__title">{app.name}</h3>
                    <p className="admin-card-item__meta">
                      {app.description || 'No description'} • {app.status}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                  <SectionChip>{app.slug}</SectionChip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
