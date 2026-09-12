#!/usr/bin/env node
/**
 * Copy shared secrets from fintracker's .env.local into the other apps'
 * .env.local files, so all four run against the same database and session.
 *
 * The troubleshooting doc requires DATABASE_URL and SESSION_SECRET to be
 * identical across every app you run; this removes that manual toil.
 *
 * Values are NEVER printed — only masked confirmation.
 *
 * Usage (from repo root, after filling packages/apps/fintracker/.env.local):
 *   pnpm env:sync
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const SOURCE = 'packages/apps/fintracker/.env.local'
const TARGETS = ['vault', 'staff', 'admin'].map((a) => `packages/apps/${a}/.env.local`)
const KEYS = ['DATABASE_URL', 'SESSION_SECRET', 'VITE_GOOGLE_CLIENT_ID']

const mask = (v) => (v.length <= 8 ? '*'.repeat(v.length) : `${v.slice(0, 4)}${'*'.repeat(12)}${v.slice(-4)}`)

function parse(text) {
  const out = {}
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

if (!existsSync(SOURCE)) {
  console.error(`[env:sync] missing ${SOURCE}`)
  process.exit(1)
}

const src = parse(readFileSync(SOURCE, 'utf8'))
const missing = KEYS.filter((k) => !src[k])
if (missing.length) {
  console.error(`[env:sync] ${SOURCE} has no value for: ${missing.join(', ')}`)
  console.error('[env:sync] Fill those in first, then re-run.')
  process.exit(1)
}

console.log('')
console.log(`  source: ${SOURCE}`)
for (const k of KEYS) console.log(`    ${k.padEnd(22)} ${mask(src[k])}`)
console.log('')

for (const file of TARGETS) {
  if (!existsSync(file)) {
    console.log(`  skip (absent): ${file}`)
    continue
  }
  let text = readFileSync(file, 'utf8')
  for (const k of KEYS) {
    const re = new RegExp(`^\\s*${k}\\s*=.*$`, 'm')
    if (re.test(text)) text = text.replace(re, `${k}=${src[k]}`)
    else text = `${text.replace(/\n*$/, '')}\n${k}=${src[k]}\n`
  }
  writeFileSync(file, text)
  console.log(`  updated: ${file}`)
}
console.log('')
console.log('  Next: unset DATABASE_URL SESSION_SECRET && pnpm db:where')
console.log('')
