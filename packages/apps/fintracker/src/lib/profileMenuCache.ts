export const FINTRACKER_MENU_CACHE_KEY = 'ft_fintracker_menu_cache_v1'

/** Fired on `window` when menu cache payload changes (`writeMenuCache` / `clearMenuCache`). */
export const MENU_CACHE_UPDATED_EVENT = 'ft-fintracker-menu-cache-updated'

export type CachedProfileMenuRow = {
  id: string
  slug: string
  label: string
  icon: string | null
  path: string
  sectionSlug: string
  sectionLabel: string
  sortOrder: number
}

type MenuCachePayload = {
  orgId: string | null
  menu: CachedProfileMenuRow[]
  fetchedAt: number
}

function menuPayloadSignature(orgId: string | null, menu: CachedProfileMenuRow[]): string {
  const stable = [...menu].sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify({ orgId, menu: stable })
}

export function readMenuCache(): MenuCachePayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(FINTRACKER_MENU_CACHE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as MenuCachePayload
    if (!j || !Array.isArray(j.menu)) return null
    return j
  } catch {
    return null
  }
}

export function writeMenuCache(orgId: string | null, menu: CachedProfileMenuRow[]): void {
  if (typeof window === 'undefined') return
  try {
    const prev = readMenuCache()
    const prevSig = prev ? menuPayloadSignature(prev.orgId, prev.menu) : null
    const nextSig = menuPayloadSignature(orgId, menu)
    const payload: MenuCachePayload = { orgId, menu, fetchedAt: Date.now() }
    sessionStorage.setItem(FINTRACKER_MENU_CACHE_KEY, JSON.stringify(payload))
    if (nextSig !== prevSig) {
      window.dispatchEvent(new CustomEvent(MENU_CACHE_UPDATED_EVENT))
    }
  } catch {
    /* quota / private mode */
  }
}

export function clearMenuCache(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(FINTRACKER_MENU_CACHE_KEY)
  } catch {
    /* */
  }
  try {
    window.dispatchEvent(new CustomEvent(MENU_CACHE_UPDATED_EVENT))
  } catch {
    /* */
  }
}

/** First enabled menu path (server `sortOrder`, then label). */
export function firstMenuPathFromRows(menu: CachedProfileMenuRow[]): string | null {
  if (!menu.length) return null
  const sorted = [...menu].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
  const path = sorted[0]?.path?.trim()
  return path || null
}

/** Refresh cache after a fast redirect from cached menu; dispatches `MENU_CACHE_UPDATED_EVENT` so nav can re-read storage. */
export function refreshMenuCacheInBackground(): void {
  void fetch('/api/profile', { credentials: 'same-origin' })
    .then((r) => r.json())
    .then((j: { ok?: boolean; data?: { activeOrgId?: string | null; menu?: CachedProfileMenuRow[] } }) => {
      if (!j?.ok || !j.data) return
      writeMenuCache(j.data.activeOrgId ?? null, j.data.menu ?? [])
    })
    .catch(() => {})
}
