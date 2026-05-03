#!/usr/bin/env node
/**
 * Bump semver in root + app package.json files (patch | minor | major).
 * Usage: node packages/tools/scripts/release-bump.mjs [patch|minor|major]
 * Default: patch
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../../..')

const PKG_PATHS = [
  join(root, 'package.json'),
  join(root, 'packages/apps/fintracker/package.json'),
  join(root, 'packages/apps/vault/package.json'),
  join(root, 'packages/apps/staff/package.json'),
]

function bump(version, part) {
  const [maj, min, pat] = version.split('.').map(n => parseInt(n, 10))
  if ([maj, min, pat].some(Number.isNaN)) throw new Error(`Invalid version: ${version}`)
  if (part === 'major') return `${maj + 1}.0.0`
  if (part === 'minor') return `${maj}.${min + 1}.0`
  return `${maj}.${min}.${pat + 1}`
}

const part = process.argv[2] || 'patch'
if (!['patch', 'minor', 'major'].includes(part)) {
  console.error('Usage: node packages/tools/scripts/release-bump.mjs [patch|minor|major]')
  process.exit(1)
}

const rootPath = PKG_PATHS[0]
const rootPkg = JSON.parse(readFileSync(rootPath, 'utf8'))
const current = rootPkg.version
if (!/^\d+\.\d+\.\d+$/.test(current)) {
  console.error(`Root package.json version must be semver x.y.z, got: ${current}`)
  process.exit(1)
}

const next = bump(current, part)
console.log(`Bumping ${current} → ${next} (${part})`)

for (const p of PKG_PATHS) {
  const pkg = JSON.parse(readFileSync(p, 'utf8'))
  pkg.version = next
  writeFileSync(p, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  console.log(`  updated ${p.replace(root + '/', '')}`)
}

console.log('\nNext: commit the version bump, merge to main, then: pnpm release:tag [--push]')
