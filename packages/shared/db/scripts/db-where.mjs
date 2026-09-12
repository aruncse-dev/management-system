#!/usr/bin/env node
/**
 * Show which database each app's env resolves to.
 *
 * This project has ONE database: development runs against production. So a prod
 * host is expected, not an error — this prints a loud banner so you always know
 * that saves, deletes and org switches in the local UI hit live data.
 *
 * READ-ONLY BY CONSTRUCTION: this never opens a database connection. It parses
 * connection strings only. Do not add queries here.
 *
 * Usage (from repo root):
 *   pnpm db:where
 *
 * Mark production hosts in the gitignored root .env, e.g.
 *   PROD_DB_HOSTS=ep-prod-abc-123.ap-southeast-1.aws.neon.tech
 * Set STRICT_PROD_GUARD=1 to make a prod host fail instead of warn (useful if a
 * separate branch/database ever exists).
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { readMergedDotenv, resolveAppDir } = require('../../../apps/resolve-google-env.cjs')

const APPS = ['fintracker', 'vault', 'staff', 'admin']

// Root .env is not auto-loaded into process.env here, so read it via the merged
// dotenv (same resolution the apps use) and fall back to a real shell export.
const rootEnv = readMergedDotenv(resolveAppDir('fintracker'))
const prodHosts = String(process.env.PROD_DB_HOSTS || rootEnv.PROD_DB_HOSTS || '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)

let sawProd = false
let sawMissing = false

console.log('')
for (const app of APPS) {
  // readMergedDotenv does not mutate process.env, so apps cannot leak into each other.
  const merged = readMergedDotenv(resolveAppDir(app))
  const url = process.env.DATABASE_URL || merged.DATABASE_URL || ''

  if (!url) {
    console.log(`  ${app.padEnd(11)} —  (DATABASE_URL not set)`)
    sawMissing = true
    continue
  }

  let host = '(unparseable)'
  let database = '?'
  try {
    const u = new URL(url)
    host = u.host
    database = u.pathname.replace(/^\//, '') || '?'
  } catch {
    /* leave defaults */
  }

  const isProd = prodHosts.includes(host.toLowerCase())
  if (isProd) sawProd = true
  console.log(`  ${app.padEnd(11)} ${isProd ? 'PROD !!' : 'ok     '}  ${host}  db=${database}`)
}
console.log('')

if (process.env.DATABASE_URL) {
  console.log('  NOTE: a shell DATABASE_URL export is set and overrides every .env.local.')
  console.log('        Run: unset DATABASE_URL SESSION_SECRET')
  console.log('')
}

if (!prodHosts.length) {
  console.log('  PROD_DB_HOSTS is unset, so nothing can be flagged as production.')
  console.log('  Add it to the gitignored root .env to arm this check:')
  console.log('    PROD_DB_HOSTS=ep-your-prod-host.aws.neon.tech')
  console.log('')
}

if (sawProd) {
  console.log('  ============================================================')
  console.log('   LIVE PRODUCTION DATA — this is the only database.')
  console.log('   Every save, delete and org switch in the UI is permanent.')
  console.log('   There is no undo. Take a Neon snapshot before risky work.')
  console.log('  ============================================================')
  console.log('')
  if (process.env.STRICT_PROD_GUARD === '1') {
    console.error('  REFUSING: STRICT_PROD_GUARD=1 is set.')
    console.error('')
    process.exit(1)
  }
}

process.exit(sawMissing ? 1 : 0)
