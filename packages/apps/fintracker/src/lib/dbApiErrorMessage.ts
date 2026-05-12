/** Walk Error causes and plain driver objects (Neon/Drizzle often nest `code`, `detail`, `cause`). */
function errorMessageChain(e: unknown): string {
  const parts: string[] = []
  const seen = new Set<unknown>()
  let cur: unknown = e
  let depth = 0
  while (cur != null && depth < 12 && !seen.has(cur)) {
    seen.add(cur)
    if (cur instanceof Error) {
      if (cur.message) parts.push(cur.message)
      cur = (cur as Error & { cause?: unknown }).cause
      depth++
      continue
    }
    if (typeof cur === 'object') {
      const o = cur as Record<string, unknown>
      if (typeof o.message === 'string' && o.message) parts.push(o.message)
      if (typeof o.detail === 'string' && o.detail) parts.push(`detail: ${o.detail}`)
      cur = o.cause ?? o.originalError
      depth++
      continue
    }
    parts.push(String(cur))
    break
  }
  return parts.filter(Boolean).join(' — ')
}

/** Postgres `code` on Error or nested plain objects (e.g. Neon). */
function pgCodeFromChain(e: unknown): string {
  const seen = new Set<unknown>()
  let cur: unknown = e
  for (let i = 0; i < 12 && cur != null && !seen.has(cur); i++) {
    seen.add(cur)
    if (typeof cur === 'object' && cur !== null && 'code' in cur) {
      const c = (cur as { code: unknown }).code
      if (typeof c === 'string' && /^[0-9A-Z]{5}$/i.test(c)) return c.toUpperCase()
    }
    if (cur instanceof Error) {
      cur = (cur as Error & { cause?: unknown }).cause
    } else if (typeof cur === 'object' && cur !== null) {
      const o = cur as Record<string, unknown>
      cur = o.cause ?? o.originalError
    } else {
      break
    }
  }
  return ''
}

/** `column "x" of relation "y" does not exist` (Postgres 42703). */
function looksLikeUndefinedColumn(msg: string): boolean {
  return (
    /\b42703\b/i.test(msg) ||
    /column\s+["'][^"']*["']\s+of relation\s+["'][^"']*["']\s+does not exist/i.test(msg)
  )
}

/** Missing *table*: `relation "t" does not exist` — not the substring inside a column error. */
function looksLikeUndefinedRelation(msg: string): boolean {
  if (looksLikeUndefinedColumn(msg)) return false
  return /\b42P01\b/i.test(msg) || /relation\s+["'][^"']*["']\s+does not exist/i.test(msg)
}

/**
 * Prefer real driver/Postgres text. Append hints only for missing relation/column — never replace the message.
 */
export function dbApiErrorMessage(e: unknown): string {
  const msg = errorMessageChain(e)
  const base = msg || 'Internal error'
  const code = pgCodeFromChain(e)

  // Column errors contain `... of relation "tablename" does not exist` — classify before relation.
  if (code === '42703' || looksLikeUndefinedColumn(msg)) {
    return `${base} Your database is behind the app schema (missing column). With the same DATABASE_URL: pnpm --filter @fintracker-vault/db run drizzle:push — compare packages/shared/db/migrations/schema.sql if needed.`
  }
  if (code === '42P01' || looksLikeUndefinedRelation(msg)) {
    return `${base} If a table is missing, sync with the same DATABASE_URL: pnpm --filter @fintracker-vault/db run drizzle:push (full DDL reference: packages/shared/db/migrations/schema.sql).`
  }
  return base
}
