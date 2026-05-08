/** Seed rows for `menu_sections`. */
export const MENU_SECTIONS_SEED = [
  { id: 'overview', slug: 'overview', label: 'Overview', sortOrder: 0 },
  { id: 'monthly', slug: 'monthly', label: 'Monthly', sortOrder: 1 },
  { id: 'save-borrow', slug: 'save-borrow', label: 'Save & borrow', sortOrder: 2 },
  { id: 'invest', slug: 'invest', label: 'Invest', sortOrder: 3 },
  { id: 'credit', slug: 'credit', label: 'Credit', sortOrder: 4 },
  { id: 'life', slug: 'life', label: 'Life', sortOrder: 5 },
  { id: 'system', slug: 'system', label: 'System', sortOrder: 6 },
  { id: 'vault-core', slug: 'vault-core', label: 'Vault', sortOrder: 7 },
  { id: 'vault-family', slug: 'vault-family', label: 'Family', sortOrder: 8 },
  { id: 'vault-wellness', slug: 'vault-wellness', label: 'Wellness', sortOrder: 9 },
  { id: 'vault-coverage', slug: 'vault-coverage', label: 'Coverage', sortOrder: 10 },
  { id: 'staff-main', slug: 'staff-main', label: 'Menu', sortOrder: 11 },
] as const

/** Seed rows for `apps` — `id` matches `slug` for stable joins. */
export const APPS_SEED = [
  { id: 'fintracker', slug: 'fintracker', name: 'FinTracker', description: 'Finance workspace', icon: 'Wallet', sortOrder: 0 },
  { id: 'vault', slug: 'vault', name: 'Vault', description: 'Household vault', icon: 'Landmark', sortOrder: 1 },
  { id: 'staff', slug: 'staff', name: 'Staff', description: 'Staff workspace', icon: 'Users', sortOrder: 2 },
] as const

export type MenuCatalogSeedRow = {
  id: string
  slug: string
  label: string
  icon: string | null
  path: string
  sectionId: string
  sortOrder: number
  /** App ids (`apps.id`) this entry appears in. */
  appSlugs: readonly string[]
}

/**
 * Global `menu_catalog` seed — stable ids; paths are in-app for each primary app.
 * Cross-app shortcuts use localhost defaults; override in Admin or env-backed rows later.
 */
export const MENU_CATALOG_SEED: MenuCatalogSeedRow[] = [
  // FinTracker
  { id: 'dashboard', slug: 'dashboard', label: 'Monthly Expenses', icon: 'CalendarDays', path: '/monthly?tab=dash', sectionId: 'overview', sortOrder: 0, appSlugs: ['fintracker'] },
  { id: 'budget', slug: 'budget', label: 'Budget', icon: 'Wallet', path: '/monthly?tab=bud', sectionId: 'monthly', sortOrder: 0, appSlugs: ['fintracker'] },
  { id: 'transactions', slug: 'transactions', label: 'Transactions', icon: 'List', path: '/monthly?tab=txns', sectionId: 'monthly', sortOrder: 1, appSlugs: ['fintracker'] },
  { id: 'credits', slug: 'credits', label: 'Credits', icon: 'CreditCard', path: '/monthly?tab=cc', sectionId: 'monthly', sortOrder: 2, appSlugs: ['fintracker'] },
  { id: 'accounts', slug: 'accounts', label: 'Accounts', icon: 'Landmark', path: '/monthly?tab=acct', sectionId: 'monthly', sortOrder: 3, appSlugs: ['fintracker'] },
  { id: 'savings', slug: 'savings', label: 'Savings', icon: 'PiggyBank', path: '/savings', sectionId: 'save-borrow', sortOrder: 0, appSlugs: ['fintracker'] },
  { id: 'lending', slug: 'lending', label: 'Lending', icon: 'Wallet', path: '/lending', sectionId: 'credit', sortOrder: 0, appSlugs: ['fintracker'] },
  {
    id: 'lending-vijaya',
    slug: 'lending-vijaya',
    label: 'Vijaya Amma',
    icon: 'User',
    path: '/lending?sheet=Vijaya%20Amma',
    sectionId: 'credit',
    sortOrder: 1,
    appSlugs: ['fintracker'],
  },
  { id: 'loans', slug: 'loans', label: 'All Loans', icon: 'Layers3', path: '/loans', sectionId: 'credit', sortOrder: 2, appSlugs: ['fintracker'] },
  { id: 'gold', slug: 'gold', label: 'Gold', icon: 'Gem', path: '/gold', sectionId: 'invest', sortOrder: 0, appSlugs: ['fintracker'] },
  { id: 'investments', slug: 'investments', label: 'Stocks & Mutual Funds', icon: 'TrendingUp', path: '/investments', sectionId: 'invest', sortOrder: 1, appSlugs: ['fintracker'] },
  { id: 'stocks', slug: 'stocks', label: 'Stocks', icon: 'LineChart', path: '/stocks', sectionId: 'invest', sortOrder: 2, appSlugs: ['fintracker'] },
  { id: 'mutualfunds', slug: 'mutualfunds', label: 'Mutual funds', icon: 'PieChart', path: '/mutualfunds', sectionId: 'invest', sortOrder: 3, appSlugs: ['fintracker'] },
  { id: 'subscriptions', slug: 'subscriptions', label: 'Subscriptions', icon: 'Repeat2', path: '/subscriptions', sectionId: 'life', sortOrder: 0, appSlugs: ['fintracker'] },
  { id: 'bommi', slug: 'bommi', label: 'Bommi', icon: 'PiggyBank', path: '/bommi', sectionId: 'life', sortOrder: 1, appSlugs: ['fintracker'] },
  { id: 'settings', slug: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', sectionId: 'system', sortOrder: 0, appSlugs: ['fintracker'] },
  { id: 'components', slug: 'components', label: 'UI kit', icon: 'LayoutGrid', path: '/components', sectionId: 'system', sortOrder: 1, appSlugs: ['fintracker'] },
  // Vault
  { id: 'vault', slug: 'vault', label: 'Banking', icon: 'Landmark', path: '/vault', sectionId: 'vault-core', sortOrder: 0, appSlugs: ['vault'] },
  { id: 'vaultapps', slug: 'vaultapps', label: 'Apps', icon: 'Grid2X2', path: '/vaultapps', sectionId: 'vault-core', sortOrder: 1, appSlugs: ['vault'] },
  { id: 'persons', slug: 'persons', label: 'Persons', icon: 'Users', path: '/vaultpersons', sectionId: 'vault-family', sortOrder: 0, appSlugs: ['vault'] },
  { id: 'documents', slug: 'documents', label: 'Documents', icon: 'FileText', path: '/vaultdocuments', sectionId: 'vault-family', sortOrder: 1, appSlugs: ['vault'] },
  { id: 'health', slug: 'health', label: 'Health', icon: 'HeartPulse', path: '/vaulthealth', sectionId: 'vault-wellness', sortOrder: 0, appSlugs: ['vault'] },
  { id: 'habits', slug: 'habits', label: 'Habits', icon: 'Target', path: '/vaulthabits', sectionId: 'vault-wellness', sortOrder: 1, appSlugs: ['vault'] },
  { id: 'insurance', slug: 'insurance', label: 'Insurance', icon: 'Shield', path: '/vaultinsurance', sectionId: 'vault-coverage', sortOrder: 0, appSlugs: ['vault'] },
  { id: 'vaultsettings', slug: 'vaultsettings', label: 'Settings', icon: 'Settings', path: '/vaultsettings', sectionId: 'system', sortOrder: 2, appSlugs: ['vault'] },
  // Staff (`staff` id matches legacy 0001 catalog row)
  { id: 'staff-attendance', slug: 'staff-attendance', label: 'Attendance', icon: 'CalendarDays', path: '/attendance', sectionId: 'staff-main', sortOrder: 0, appSlugs: ['staff'] },
  { id: 'staff', slug: 'staff', label: 'Staffs', icon: 'Users', path: '/staffs', sectionId: 'staff-main', sortOrder: 1, appSlugs: ['staff'] },
  { id: 'staff-settings', slug: 'staff-settings', label: 'Settings', icon: 'Settings', path: '/settings', sectionId: 'system', sortOrder: 3, appSlugs: ['staff'] },
]
