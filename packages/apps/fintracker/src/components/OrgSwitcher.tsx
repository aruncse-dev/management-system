import { useCallback, useEffect, useState } from 'react'

type Org = { id: string; name: string }

export function OrgSwitcher() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/profile', { credentials: 'same-origin' })
      const j = await r.json()
      if (!j.ok || !j.data?.orgs) return
      setOrgs(j.data.orgs as Org[])
      setActiveId((j.data.activeOrgId as string | null) ?? null)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (orgs.length < 2) return null

  async function onChange(orgId: string) {
    setBusy(true)
    try {
      const r = await fetch('/api/session/active-org', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      const j = await r.json()
      if (j.ok) {
        setActiveId(orgId)
        window.location.reload()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="org-switcher-bar" role="navigation" aria-label="Organization">
      <label className="org-switcher-bar__label">
        <span className="org-switcher-bar__text">Organization</span>
        <select
          className="org-switcher-bar__select"
          value={activeId ?? orgs[0]?.id ?? ''}
          disabled={busy}
          onChange={e => void onChange(e.target.value)}
        >
          {orgs.map(o => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
