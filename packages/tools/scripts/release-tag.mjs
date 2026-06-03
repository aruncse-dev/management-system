#!/usr/bin/env node
/**
 * Create or refresh an annotated git tag vYYYYMMDD (UTC) on HEAD.
 * Same UTC day: moves the existing tag to HEAD and force-pushes (overwrites release).
 *
 * Usage:
 *   node packages/tools/scripts/release-tag.mjs          # tag only
 *   node packages/tools/scripts/release-tag.mjs --push   # tag + git push origin <tag> [--force]
 *   node packages/tools/scripts/release-tag.mjs --date 20260523  # override date (backfill)
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

function tagExistsLocal(tag) {
  try {
    execSync(`git rev-parse -q --verify refs/tags/${tag}`, { cwd: root, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function tagExistsRemote(tag) {
  try {
    const out = execSync(`git ls-remote --tags origin refs/tags/${tag}`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return out.length > 0
  } catch {
    return false
  }
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

const hadLocal = tagExistsLocal(tag)
const hadRemote = doPush ? tagExistsRemote(tag) : false
const isUpdate = hadLocal || hadRemote

const head = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim()
const msg = isUpdate
  ? `Release ${tag} (updated to ${head})`
  : `Release ${tag}`

if (isUpdate) {
  console.log(
    `Tag ${tag} already exists — moving to current HEAD (${head}) and ${doPush ? 'updating' : 'will update'} the GitHub release.`,
  )
  execFileSync('git', ['tag', '-f', '-a', tag, '-m', msg], { cwd: root, stdio: 'inherit' })
} else {
  execFileSync('git', ['tag', '-a', tag, '-m', msg], { cwd: root, stdio: 'inherit' })
  console.log(`Created annotated tag ${tag} on HEAD (${head})`)
}

if (doPush) {
  const pushArgs = isUpdate ? ['push', 'origin', tag, '--force'] : ['push', 'origin', tag]
  execFileSync('git', pushArgs, { cwd: root, stdio: 'inherit' })
  console.log(
    isUpdate
      ? `Force-pushed ${tag}. GitHub Actions will regenerate release notes from commits since the previous date tag.`
      : `Pushed ${tag}. GitHub Actions will publish the release with generated notes.`,
  )
} else {
  const flag = isUpdate ? '--force' : ''
  console.log(`To publish: git push origin ${tag}${flag ? ` ${flag}` : ''}`)
}
