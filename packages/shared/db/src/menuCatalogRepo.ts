import { STATIC_MENUS, STATIC_APPS, AppSlug } from './adminStaticData'

/**
 * Menu catalog is now fully static, defined in code.
 * All menus are provided by STATIC_MENUS structure.
 */

export type MenuCatalogListRow = {
  id: string
  slug: string
  label: string
  icon: string | null
  path: string
  sectionId: string
  sectionSlug: string
  sectionLabel: string
  sortOrder: number
  appSlugs: string[]
}

/**
 * STATIC_MENUS structure:
 * {
 *   fintracker: { 'Overview': ['dashboard'], 'Monthly': ['budget', ...] },
 *   vault: { 'Vault': ['vault', 'vaultapps'], ... },
 *   staff: { 'Menu': ['staff-attendance', ...] }
 * }
 *
 * This function converts static menus to the legacy MenuCatalogListRow format for compatibility.
 */
export async function listMenuCatalog(appSlug?: string): Promise<MenuCatalogListRow[]> {
  const result: MenuCatalogListRow[] = []
  let sortOrder = 0

  const appsToProcess = appSlug ? ([appSlug] as const) : STATIC_APPS

  for (const app of appsToProcess) {
    const appMenus = STATIC_MENUS[app as AppSlug]
    if (!appMenus) continue

    for (const [sectionLabel, menuIds] of Object.entries(appMenus)) {
      for (const menuId of menuIds) {
        result.push({
          id: menuId,
          slug: menuId,
          label: menuId.charAt(0).toUpperCase() + menuId.slice(1),
          icon: null,
          path: `/${menuId}`,
          sectionId: sectionLabel.toLowerCase().replace(/\s+/g, '-'),
          sectionSlug: sectionLabel.toLowerCase().replace(/\s+/g, '-'),
          sectionLabel,
          sortOrder: sortOrder++,
          appSlugs: [app],
        })
      }
    }
  }

  return result
}

export async function getMenuCatalogEntry(id: string): Promise<MenuCatalogListRow | undefined> {
  const all = await listMenuCatalog()
  return all.find(m => m.id === id)
}

// Menus are static; these operations are no-ops
export async function setMenuApps(): Promise<void> {
  throw new Error('Menus are static and cannot be modified')
}

export async function ensureOrgAssignmentsForMenu(): Promise<void> {
  throw new Error('Menus are static; org assignments are handled via organizations.enabled_menus')
}

export async function createMenuCatalogEntry(): Promise<MenuCatalogListRow> {
  throw new Error('Menus are static and cannot be created')
}

export async function updateMenuCatalogEntry(): Promise<MenuCatalogListRow | undefined> {
  throw new Error('Menus are static and cannot be updated')
}

export async function deleteMenuCatalogEntry(): Promise<void> {
  throw new Error('Menus are static and cannot be deleted')
}
