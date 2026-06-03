#!/usr/bin/env node
/**
 * Create an annotated git tag vYYYYMMDD (UTC) on HEAD.
 * Usage:
 *   node packages/tools/scripts/release-tag.mjs          # tag only
 *   node packages/tools/scripts/release-tag.mjs --push   # tag + git push origin <tag>
 *   node packages/tools/scripts/release-tag.mjs --date 20260523  # override date (testing / backfill)
 */
import { execFileSync, execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../../..')

function resolveDateKey() {
  const dateArg = process.argv.find((a) => a.startsWith('--date='))?.slice('--date='.length)
    ?? (process.argv.includes('--date') ? process.argv[process.argv.indexOf('--date') + 1] : null)
  if (dateArg) {
    if (!/^\d{8}$/.test(dateArg)) {
      console.error('--date must be YYYYMMDD')
      process.exit(1)
    }
    return dateArg
  }
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

const dateKey = resolveDateKey()
const tag = `v${dateKey}`
const doPush = process.argv.includes('--push')

try {
  execSync('git rev-parse --git-dir', { cwd: root, stdio: 'pipe' })
} catch {
  console.error('Not a git repository.')
  process.exit(1)
}

let exists = false
try {
  execSync(`git rev-parse -q --verify refs/tags/${tag}`, { cwd: root, stdio: 'pipe' })
  exists = true
} catch {
  exists = false
}

if (exists) {
  console.error(`Tag ${tag} already exists. Use another day or delete the tag first.`)
  process.exit(1)
}

const msg = `Release ${tag}`
execFileSync('git', ['tag', '-a', tag, '-m', msg], { cwd: root, stdio: 'inherit' })
console.log(`Created annotated tag ${tag} on HEAD`)

if (doPush) {
  execFileSync('git', ['push', 'origin', tag], { cwd: root, stdio: 'inherit' })
  console.log(`Pushed ${tag} (GitHub Actions will publish the release if configured).`)
} else {
  console.log(`To publish: git push origin ${tag}`)
}
