#!/usr/bin/env node
/**
 * Preview GitHub-style release notes (same API as CI) for today's tag vs previous date tag.
 * Usage: pnpm release:notes:preview   (requires `gh` CLI and auth)
 */
import { execFileSync, execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../../..')

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim()
}

const now = new Date()
const dateKey = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
const tag = `v${dateKey}`
const sha = run('git', ['rev-parse', 'HEAD'])

const tags = run('git', ['tag', '-l', 'v20[0-9][0-9][0-9][0-9][0-9][0-9]', '--sort=-creatordate'])
  .split('\n')
  .filter(Boolean)
const previous = tags.find((t) => t !== tag) ?? ''

const remote = run('git', ['remote', 'get-url', 'origin'])
const m = remote.match(/github\.com[:/](.+?)(?:\.git)?$/)
if (!m) {
  console.error('Could not parse owner/repo from origin:', remote)
  process.exit(1)
}

const args = [
  'api',
  '--method',
  'POST',
  `repos/${m[1]}/releases/generate-notes`,
  '-f',
  `tag_name=${tag}`,
  '-f',
  `target_commitish=${sha}`,
]
if (previous) args.push('-f', `previous_tag_name=${previous}`)

const body = execFileSync('gh', [...args, '--jq', '.body'], { cwd: root, encoding: 'utf8' })

console.log(`Tag: ${tag} @ ${sha}`)
console.log(`Previous: ${previous || '(none)'}`)
console.log('---\n')
console.log(body)
