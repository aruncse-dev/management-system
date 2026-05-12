/** Canonical lending book identifiers (persisted as `lending.sheet_slug`). */
export const LENDING_SHEET_SLUG_DEFAULT = 'lending' as const
export const LENDING_SHEET_SLUG_VIJAYA = 'vijaya-amma' as const

export type LendingSheetSlug = typeof LENDING_SHEET_SLUG_DEFAULT | typeof LENDING_SHEET_SLUG_VIJAYA

const LEGACY: Record<string, LendingSheetSlug> = {
  Lending: LENDING_SHEET_SLUG_DEFAULT,
  lending: LENDING_SHEET_SLUG_DEFAULT,
  'Vijaya Amma': LENDING_SHEET_SLUG_VIJAYA,
  'vijaya-amma': LENDING_SHEET_SLUG_VIJAYA,
}

export function normalizeLendingSheetSlug(input: unknown): LendingSheetSlug {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw) return LENDING_SHEET_SLUG_DEFAULT
  let decoded = raw
  if (raw.includes('%')) {
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      decoded = raw
    }
  }
  if (LEGACY[decoded]) return LEGACY[decoded]
  const hyphen = decoded.toLowerCase().replace(/\s+/g, '-')
  if (hyphen === LENDING_SHEET_SLUG_VIJAYA) return LENDING_SHEET_SLUG_VIJAYA
  if (hyphen === LENDING_SHEET_SLUG_DEFAULT) return LENDING_SHEET_SLUG_DEFAULT
  return LENDING_SHEET_SLUG_DEFAULT
}

export function lendingBookLabel(slug: string): string {
  if (slug === LENDING_SHEET_SLUG_VIJAYA) return 'Vijaya Amma'
  return 'Lending'
}
