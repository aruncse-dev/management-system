/**
 * Regenerates packages/shared/db/migrations/schema.sql from Drizzle TS (full CREATE DDL for an empty DB).
 *
 * Run after any change under src/schema/:
 *   pnpm --filter @fintracker-vault/db run export-schema
 */
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(__dirname, '..')
const schemaPath = join(pkgRoot, 'migrations', 'schema.sql')

let sql
try {
  sql = execSync('pnpm exec drizzle-kit export --sql', {
    cwd: pkgRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (err) {
  const e = err
  const stderr = e && typeof e === 'object' && 'stderr' in e ? String(e.stderr) : ''
  console.error(stderr || e)
  process.exit(1)
}

const header = [
  '--',
  '-- Full PostgreSQL DDL for an empty database (matches Drizzle TS in src/schema/).',
  '-- GENERATED — edit TypeScript only, then: pnpm --filter @fintracker-vault/db run export-schema',
  '-- For existing DBs: pnpm --filter @fintracker-vault/db run drizzle:push.',
  '--',
  '',
].join('\n')

const body = header + sql

mkdirSync(dirname(schemaPath), { recursive: true })
writeFileSync(schemaPath, body, 'utf8')
console.log(`Wrote ${schemaPath}`)
