/**
 * Google OAuth + shared local env (all Next apps: fintracker, vault, staff):
 * - process.env / Vercel already set wins.
 * - Then merge file keys only where process.env is still empty. File order (later overrides earlier):
 *   `<repo>/.env` → `<repo>/.env.local` → `<repo>/web/.env` → `<appDir>/.env.local`
 * - Google client id keys (any one): VITE_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GOOGLE_CLIENT_ID, GOOGLE_CLIENT_ID
 * - Allowlist: VITE_ALLOWED_EMAILS, NEXT_PUBLIC_ALLOWED_EMAILS, ALLOWED_EMAILS
 *
 * Each app’s next.config.js calls getGoogleAuthEnv(__dirname).
 * API routes can use readMergedDotenv(process.cwd()) for VITE_GAS_URL etc. (cwd = app package root).
 */
const fs = require('fs')
const path = require('path')

function unquoteEnvValue(raw) {
  const v = String(raw).trim()
  if (v.length >= 2 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
    return v.slice(1, -1).trim()
  }
  return v
}

function findMonorepoRoot(startDir) {
  let dir = path.resolve(startDir)
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    const pkgPath = path.join(dir, 'package.json')
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        if (pkg.name === 'fintracker-vault') return dir
      } catch {
        // ignore
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(startDir, '../../..')
}

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {}
  let raw = fs.readFileSync(envPath, 'utf8')
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
  const out = {}
  for (const rawLine of raw.split(/\r?\n/)) {
    let line = rawLine.replace(/\r$/, '').trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('export ')) line = line.slice(7).trim()
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = unquoteEnvValue(line.slice(idx + 1))
    if (key) out[key] = value
  }
  return out
}

/** Merged key/value from repo + app env files (does not mutate process.env). */
function readMergedDotenv(appDir) {
  const monoRoot = findMonorepoRoot(appDir)
  const resolvedApp = path.resolve(appDir)
  return {
    ...readEnvFile(path.join(monoRoot, '.env')),
    ...readEnvFile(path.join(monoRoot, '.env.local')),
    ...readEnvFile(path.join(monoRoot, 'web', '.env')),
    ...readEnvFile(path.join(resolvedApp, '.env.local')),
  }
}

function getGoogleAuthEnv(appDir) {
  const monoRoot = findMonorepoRoot(appDir)
  const webEnvPath = path.join(monoRoot, 'web', '.env')
  const rootEnvPath = path.join(monoRoot, '.env')
  const rootEnvLocalPath = path.join(monoRoot, '.env.local')
  const appEnvLocalPath = path.join(path.resolve(appDir), '.env.local')
  const fileVars = readMergedDotenv(appDir)
  for (const [k, v] of Object.entries(fileVars)) {
    if (!k) continue
    if (process.env[k] === undefined || process.env[k] === '') {
      process.env[k] = v
    }
  }

  const googleClientId =
    process.env.VITE_GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    ''

  const allowedEmails =
    process.env.VITE_ALLOWED_EMAILS || process.env.NEXT_PUBLIC_ALLOWED_EMAILS || process.env.ALLOWED_EMAILS || ''

  if (googleClientId) {
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = googleClientId
    if (!process.env.VITE_GOOGLE_CLIENT_ID) process.env.VITE_GOOGLE_CLIENT_ID = googleClientId
  }

  if (!googleClientId) {
    console.warn(
      '[next.config] Google OAuth client id missing. Set VITE_GOOGLE_CLIENT_ID (or NEXT_PUBLIC_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID) in repo `.env`, `.env.local`, `web/.env`, this app\'s `.env.local`, or Vercel — then restart `next dev`.',
    )
  }

  return {
    googleClientId,
    allowedEmails,
    monoRoot,
    rootEnvPath,
    rootEnvLocalPath,
    webEnvPath,
    appEnvLocalPath,
    readEnvFile,
    readMergedDotenv,
  }
}

module.exports = { getGoogleAuthEnv, readEnvFile, findMonorepoRoot, readMergedDotenv }
