/**
 * Menu sections table has been removed (migration 0004).
 * All menu sections are now static, defined in adminStaticData.ts STATIC_MENUS structure.
 * Use menuSectionsRepo.ts functions to access section data from static configuration.
 */

// Legacy type definitions for compatibility
export type MenuSectionRow = {
  id: string
  slug: string
  label: string
  sortOrder: number
  createdAt: Date
}

export type NewMenuSectionRow = Omit<MenuSectionRow, 'createdAt'>
