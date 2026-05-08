import { eq } from 'drizzle-orm'
import { getDb } from './neon'
import { STATIC_MENUS, STATIC_APPS, AppSlug, getMenusForApps } from './adminStaticData'
import { organizations } from './schema/orgs'

/**
 * Org menu management now uses static menu data + organization.enabled_menus (jsonb).
 * All database tables (menu_catalog, menu_apps, org_menu_assignments) have been removed.
 */

/** Get org menu configuration (enabled menus per app). */
export async function getOrgMenuConfig(orgId: string): Promise<Record<string, string[]>> {
  const db = getDb()
  const [org] = await db
    .select({ enabledMenus: organizations.enabledMenus })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  return (org?.enabledMenus as Record<string, string[]>) ?? {}
}

/** Update org menu configuration. */
export async function setOrgEnabledMenuIds(
  orgId: string,
  enabledMenuIds: string[],
  appSlug: string,
): Promise<void> {
  const db = getDb()
  const [org] = await db
    .select({ enabledMenus: organizations.enabledMenus })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org) throw new Error(`Organization not found: ${orgId}`)

  const enabledMenus = (org.enabledMenus as Record<string, string[]>) ?? {}
  enabledMenus[appSlug] = enabledMenuIds

  await db
    .update(organizations)
    .set({ enabledMenus: enabledMenus as any })
    .where(eq(organizations.id, orgId))
}

export type ResolvedMenuItem = {
  id: string
  slug: string
  label: string
  icon: string | null
  path: string
  sectionSlug: string
  sectionLabel: string
  sortOrder: number
}

/** Get enabled menus for an org and app (from static data + org config). */
export async function getEnabledOrgMenu(orgId: string, appSlug: string): Promise<ResolvedMenuItem[]> {
  const menuConfig = await getOrgMenuConfig(orgId)
  const enabledMenuIds = new Set(menuConfig[appSlug] ?? [])

  if (enabledMenuIds.size === 0) return []

  const appMenus = STATIC_MENUS[appSlug as AppSlug]
  if (!appMenus) return []

  const result: ResolvedMenuItem[] = []
  let sortOrder = 0

  for (const [sectionLabel, menuIds] of Object.entries(appMenus)) {
    for (const menuId of menuIds) {
      if (enabledMenuIds.has(menuId)) {
        result.push({
          id: menuId,
          slug: menuId,
          label: menuId.charAt(0).toUpperCase() + menuId.slice(1),
          icon: null,
          path: `/${menuId}`,
          sectionSlug: sectionLabel.toLowerCase().replace(/\s+/g, '-'),
          sectionLabel,
          sortOrder: sortOrder++,
        })
      }
    }
  }

  return result
}

/** Get menu editor state (all menus with enabled flag) for admin UI. */
export async function getOrgMenuEditorState(
  orgId: string,
  appSlug?: string,
): Promise<
  {
    id: string
    slug: string
    sectionSlug: string
    sectionLabel: string
    label: string
    icon: string | null
    path: string
    sortOrder: number
    enabled: boolean
  }[]
> {
  const menuConfig = await getOrgMenuConfig(orgId)
  const result: {
    id: string
    slug: string
    sectionSlug: string
    sectionLabel: string
    label: string
    icon: string | null
    path: string
    sortOrder: number
    enabled: boolean
  }[] = []

  let sortOrder = 0

  const appsToProcess = appSlug ? ([appSlug] as const) : STATIC_APPS

  for (const app of appsToProcess) {
    const appMenus = STATIC_MENUS[app as AppSlug]
    if (!appMenus) continue

    const enabledMenuIds = new Set(menuConfig[app] ?? [])

    for (const [sectionLabel, menuIds] of Object.entries(appMenus)) {
      for (const menuId of menuIds) {
        result.push({
          id: menuId,
          slug: menuId,
          sectionSlug: sectionLabel.toLowerCase().replace(/\s+/g, '-'),
          sectionLabel,
          label: menuId.charAt(0).toUpperCase() + menuId.slice(1),
          icon: null,
          path: `/${menuId}`,
          sortOrder: sortOrder++,
          enabled: enabledMenuIds.has(menuId),
        })
      }
    }
  }

  return result
}

/** Legacy function (no-op for static data). */
export async function seedMenuCatalogIfEmpty(): Promise<void> {
  // All menus are now static; no seeding needed
}

/** Legacy function (no-op for static data). */
export async function assignDefaultOrgMenus(orgId: string): Promise<void> {
  // Default org menus are set via org creation in API; this function is deprecated
}

/** Legacy function (no-op for static data). */
export async function backfillOrgMenusForAllOrgs(): Promise<void> {
  // No backfill needed; all menus are static
}
