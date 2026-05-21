#!/usr/bin/env node
/**
 * Verify DATABASE_URL for a local app matches a working Neon connection and `users` table.
 * Usage (from repo root):
 *   pnpm db:check
 *   pnpm db:check -- admin
 */
import { createRequire } from 'node:module'
import pg from 'pg'

const require = createRequire(import.meta.url)
const { applyMergedDotenv } = require('../../../apps/resolve-google-env.cjs')

const app = process.argv[2] === '--' ? process.argv[3] : process.argv[2] || 'fintracker'
const { appDir } = applyMergedDotenv(app)

const url = process.env.DATABASE_URL
if (!url) {
  console.error(`[db:check] DATABASE_URL missing for app "${app}".`)
  console.error(`  Create ${appDir}/.env.local with DATABASE_URL=postgresql://...`)
  console.error('  See docs/troubleshooting.md')
  process.exit(1)
}

let host = '(invalid url)'
try {
  host = new URL(url).host
} catch {
  /* ignore */
}

console.log(`[db:check] app=${app} host=${host} driver=pg`)

const pool = new pg.Pool({
  connectionString: url,
  connectionTimeoutMillis: 20_000,
})
try {
  const { rows } = await pool.query('select email, role, status from users limit 1')
  console.log(`[db:check] OK — users table reachable (${rows.length ? 'has rows' : 'empty'})`)
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  console.error('[db:check] FAILED —', msg)
  console.error('')
  console.error('Common fixes (docs/troubleshooting.md):')
  console.error('  1. Use the full Neon URL from the dashboard in packages/apps/<app>/.env.local')
  console.error('  2. unset DATABASE_URL  # avoid stale shell override')
  console.error('  3. pnpm --filter @fintracker-vault/db run drizzle:push')
  process.exit(1)
} finally {
  await pool.end()
}
