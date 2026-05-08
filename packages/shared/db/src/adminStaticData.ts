/**
 * Static admin configuration — apps and menus.
 * These are NOT stored in the database but referenced by organization configurations.
 * Format: apps are static list, menus are organized by app and section.
 */

export const STATIC_APPS = ['fintracker', 'vault', 'staff'] as const
export type AppSlug = typeof STATIC_APPS[number]

export const APP_CONFIG: Record<AppSlug, { name: string; description: string; icon: string }> = {
  fintracker: {
    name: 'FinTracker',
    description: 'Finance workspace',
    icon: 'Wallet',
  },
  vault: {
    name: 'Vault',
    description: 'Household vault',
    icon: 'Landmark',
  },
  staff: {
    name: 'Staff',
    description: 'Staff workspace',
    icon: 'Users',
  },
}

/** Menu catalog by app and section. Structure: { [app]: { [section]: [menuIds] } } */
export const STATIC_MENUS: Record<AppSlug, Record<string, string[]>> = {
  fintracker: {
    'Overview': ['dashboard'],
    'Monthly': ['budget', 'transactions', 'credits', 'accounts'],
    'Save & Borrow': ['savings', 'lending', 'loans'],
    'Invest': ['gold', 'investments', 'stocks', 'mutualfunds'],
    'Life': ['subscriptions', 'bommi'],
    'System': ['settings', 'components'],
  },
  vault: {
    'Vault': ['vault', 'vaultapps'],
    'Family': ['persons', 'documents'],
    'Wellness': ['health', 'habits'],
    'Coverage': ['insurance'],
    'System': ['vaultsettings'],
  },
  staff: {
    'Menu': ['staff-attendance', 'staff', 'staff-settings'],
  },
}

/** Flat list of all available menus across all apps (for reference). */
export const ALL_MENUS = Object.values(STATIC_MENUS).flatMap(appMenus =>
  Object.values(appMenus).flat(),
)

/** Get menus for a specific app. */
export function getMenusForApp(appSlug: AppSlug): Record<string, string[]> {
  return STATIC_MENUS[appSlug] || {}
}

/** Get all menus across selected apps. */
export function getMenusForApps(appSlugs: AppSlug[]): Record<AppSlug, Record<string, string[]>> {
  const result: Partial<Record<AppSlug, Record<string, string[]>>> = {}
  for (const app of appSlugs) {
    result[app] = getMenusForApp(app)
  }
  return result as Record<AppSlug, Record<string, string[]>>
}

/** Convert enabled menus format to flat menu IDs list. */
export function getEnabledMenuIds(enabledMenusJson: Record<string, string[]>): string[] {
  return Object.values(enabledMenusJson).flat()
}
