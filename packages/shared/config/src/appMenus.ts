export const APP_SLUGS = ['fintracker', 'vault', 'staff'] as const
export type AppSlug = typeof APP_SLUGS[number]

export const APP_LABELS: Record<AppSlug, string> = {
  fintracker: 'FinTracker',
  vault: 'Vault',
  staff: 'Staff',
}

// Fintracker menus — sections and their menu items
export const FINTRACKER_MENUS: Record<string, { slug: string; label: string }[]> = {
  Tracking: [{ slug: 'dashboard', label: 'Monthly Expenses' }],
  Assets: [
    { slug: 'savings', label: 'Savings' },
    { slug: 'gold', label: 'Gold' },
  ],
  Investments: [{ slug: 'investments', label: 'Stocks & Mutual Funds' }],
  Credit: [
    { slug: 'lending', label: 'Lending' },
    { slug: 'vijaya-amma', label: 'Vijaya Amma' },
    { slug: 'loans', label: 'All Loans' },
  ],
  Services: [{ slug: 'subscriptions', label: 'Subscriptions' }],
}

// Vault menus
export const VAULT_MENUS: Record<string, { slug: string; label: string }[]> = {
  Vault: [
    { slug: 'vault', label: 'Vault' },
    { slug: 'vaultapps', label: 'Apps' },
  ],
  Family: [
    { slug: 'persons', label: 'Persons' },
    { slug: 'documents', label: 'Documents' },
  ],
  Wellness: [
    { slug: 'health', label: 'Health' },
    { slug: 'habits', label: 'Habits' },
  ],
  Coverage: [{ slug: 'insurance', label: 'Insurance' }],
}

// Staff menus
export const STAFF_MENUS: Record<string, { slug: string; label: string }[]> = {
  Menu: [
    { slug: 'staff-attendance', label: 'Attendance' },
    { slug: 'staff', label: 'Staff' },
  ],
}

// Complete app menus map
export const APP_MENUS: Record<AppSlug, Record<string, { slug: string; label: string }[]>> = {
  fintracker: FINTRACKER_MENUS,
  vault: VAULT_MENUS,
  staff: STAFF_MENUS,
}

// Helper: get menus for a specific app
export function getMenusForApp(appSlug: AppSlug): Record<string, { slug: string; label: string }[]> {
  return APP_MENUS[appSlug] || {}
}

// Helper: flatten all menu slugs for an app
export function getEnabledMenuIds(appSlug: AppSlug): string[] {
  const menus = getMenusForApp(appSlug)
  const result: string[] = []
  for (const items of Object.values(menus)) {
    for (const item of items) {
      result.push(item.slug)
    }
  }
  return result
}
