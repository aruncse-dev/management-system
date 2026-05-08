/**
 * Menu sections are static and defined in code.
 * Use STATIC_MENUS from adminStaticData.ts to get section names.
 * This file is deprecated; sections are now read-only reference data.
 */

export type MenuSectionRow = {
  id: string
  slug: string
  label: string
  sortOrder: number
  createdAt: Date
}

/** Get all unique sections from static menu data */
export async function listMenuSections(): Promise<MenuSectionRow[]> {
  // Sections are now implicit from STATIC_MENUS structure
  const sectionMap = new Map<string, string>()
  const sections: MenuSectionRow[] = []

  // Overview, Monthly, Save & Borrow, Invest, Life, System (fintracker)
  // Vault, Family, Wellness, Coverage, System (vault)
  // Menu (staff)

  const sectionLabels: Record<string, { label: string; order: number }> = {
    'Overview': { label: 'Overview', order: 0 },
    'Monthly': { label: 'Monthly', order: 1 },
    'Save & Borrow': { label: 'Save & Borrow', order: 2 },
    'Invest': { label: 'Invest', order: 3 },
    'Life': { label: 'Life', order: 4 },
    'Vault': { label: 'Vault', order: 5 },
    'Family': { label: 'Family', order: 6 },
    'Wellness': { label: 'Wellness', order: 7 },
    'Coverage': { label: 'Coverage', order: 8 },
    'System': { label: 'System', order: 9 },
    'Menu': { label: 'Menu', order: 10 },
  }

  for (const [label, meta] of Object.entries(sectionLabels)) {
    sections.push({
      id: label.toLowerCase().replace(/\s+/g, '-'),
      slug: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      sortOrder: meta.order,
      createdAt: new Date(),
    })
  }

  return sections
}

export async function getMenuSectionById(id: string): Promise<MenuSectionRow | undefined> {
  const sections = await listMenuSections()
  return sections.find(s => s.id === id)
}

// Sections are static; these operations are no-ops
export async function createMenuSection(): Promise<MenuSectionRow> {
  throw new Error('Menu sections are static and cannot be created')
}

export async function updateMenuSection(): Promise<MenuSectionRow | undefined> {
  throw new Error('Menu sections are static and cannot be updated')
}

export async function deleteMenuSection(): Promise<void> {
  throw new Error('Menu sections are static and cannot be deleted')
}
