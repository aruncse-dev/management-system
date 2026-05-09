/**
 * Static admin configuration — apps and menus.
 * These are NOT stored in the database but referenced by organization configurations.
 * Single source of truth: @fintracker-vault/config/appMenus
 */

import { APP_SLUGS, APP_MENUS } from '@fintracker-vault/config'

export const STATIC_APPS = APP_SLUGS
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

/** Menu catalog by app and section. Converts from { app: { section: [items] } } to { app: { section: [menuIds] } } format. */
export const STATIC_MENUS: Record<AppSlug, Record<string, string[]>> = (() => {
  const result: Partial<Record<AppSlug, Record<string, string[]>>> = {}
  for (const [app, sections] of Object.entries(APP_MENUS) as [AppSlug, Record<string, { slug: string; label: string }[]>][]) {
    result[app] = {}
    for (const [section, items] of Object.entries(sections)) {
      result[app]![section] = items.map(item => item.slug)
    }
  }
  return result as Record<AppSlug, Record<string, string[]>>
})()

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
