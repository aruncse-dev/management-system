/**
 * Apps table has been removed (migration 0004).
 * All apps are now static (fintracker, vault, staff) defined in adminStaticData.ts
 * Use appsRepo.ts functions to access app data from static configuration.
 */

// Legacy type definitions for compatibility
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

export type NewAppRow = Omit<AppRow, 'createdAt' | 'updatedAt'>
