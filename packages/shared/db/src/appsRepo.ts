import { STATIC_APPS, APP_CONFIG } from './adminStaticData'

/**
 * Static app data — apps are defined in code, not configurable.
 * Use STATIC_APPS and APP_CONFIG from adminStaticData.ts
 */

export type AppRow = {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  sortOrder: number
  status: string
  createdAt: Date
  updatedAt: Date
}

export async function listApps(): Promise<AppRow[]> {
  // Return static apps in order
  return STATIC_APPS.map((slug, idx) => ({
    id: slug,
    slug,
    name: APP_CONFIG[slug].name,
    description: APP_CONFIG[slug].description,
    icon: APP_CONFIG[slug].icon,
    sortOrder: idx,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
}

export async function getAppById(id: string): Promise<AppRow | undefined> {
  const slugIndex = STATIC_APPS.indexOf(id as keyof typeof APP_CONFIG)
  if (slugIndex === -1) return undefined
  const slug = STATIC_APPS[slugIndex] as keyof typeof APP_CONFIG
  const config = APP_CONFIG[slug]
  return {
    id: slug,
    slug,
    name: config.name,
    description: config.description,
    icon: config.icon,
    sortOrder: slugIndex,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export async function getAppBySlug(slug: string): Promise<AppRow | undefined> {
  if (!STATIC_APPS.includes(slug as keyof typeof APP_CONFIG)) return undefined
  const slugIndex = STATIC_APPS.indexOf(slug as keyof typeof APP_CONFIG)
  const config = APP_CONFIG[slug as keyof typeof APP_CONFIG]
  return {
    id: slug,
    slug,
    name: config.name,
    description: config.description,
    icon: config.icon,
    sortOrder: slugIndex,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// Create, update, delete are no-ops for static data
export async function createApp(): Promise<AppRow> {
  throw new Error('Apps are static and cannot be created')
}

export async function updateApp(): Promise<AppRow | undefined> {
  throw new Error('Apps are static and cannot be updated')
}

export async function deleteApp(): Promise<void> {
  throw new Error('Apps are static and cannot be deleted')
}
