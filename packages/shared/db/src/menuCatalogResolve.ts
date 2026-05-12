import { MENU_CATALOG_SEED, type MenuCatalogSeedRow } from './menuCatalogSeed'

/** Legacy org menu ids → catalog ids (see FINTRACKER_MENUS vs MENU_CATALOG_SEED). */
const MENU_ID_ALIASES: Record<string, string> = {
  'vijaya-amma': 'lending-vijaya',
}

export function resolveMenuCatalogRow(appSlug: string, menuId: string): MenuCatalogSeedRow | null {
  const canonical = MENU_ID_ALIASES[menuId] ?? menuId
  const byCanonical = MENU_CATALOG_SEED.find((r) => r.id === canonical && r.appSlugs.includes(appSlug))
  if (byCanonical) return byCanonical
  return MENU_CATALOG_SEED.find((r) => r.id === menuId && r.appSlugs.includes(appSlug)) ?? null
}
