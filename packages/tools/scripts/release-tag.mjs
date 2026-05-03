#!/usr/bin/env node
/**
 * Create an annotated git tag v<x.y.z> from root package.json version.
 * Usage:
 *   node packages/tools/scripts/release-tag.mjs          # tag only
 *   node packages/tools/scripts/release-tag.mjs --push   # tag + git push origin <tag>
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../../..')
const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = rootPkg.version

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Root package.json version must be semver x.y.z, got: ${version}`)
  process.exit(1)
}

const tag = `v${version}`
const doPush = process.argv.includes('--push')

try {
  execSync(`git rev-parse --git-dir`, { cwd: root, stdio: 'pipe' })
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
  console.error(`Tag ${tag} already exists. Bump version (pnpm release:bump) or delete the tag first.`)
  process.exit(1)
}

const msg = `Release ${tag}`
execFileSync('git', ['tag', '-a', tag, '-m', msg], { cwd: root, stdio: 'inherit' })
console.log(`Created annotated tag ${tag}`)

if (doPush) {
  execFileSync('git', ['push', 'origin', tag], { cwd: root, stdio: 'inherit' })
  console.log(`Pushed ${tag} (GitHub Actions will draft the release if configured).`)
} else {
  console.log(`To publish the tag: git push origin ${tag}`)
}
