/**
 * Google auth env sources (first wins; later file layers only fill empty process.env keys):
 * - Vercel Environment Variables, or
 * - `<repo>/web/.env`, or
 * - `<appDir>/.env.local` (e.g. packages/apps/fintracker/.env.local) — overrides web/.env on same key.
 *
 * next.config calls getGoogleAuthEnv() once; the client sees values via next.config `env` + _document script.
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

function getGoogleAuthEnv(appDir) {
  const monoRoot = findMonorepoRoot(appDir)
  const webEnvPath = path.join(monoRoot, 'web', '.env')
  const appEnvLocalPath = path.join(path.resolve(appDir), '.env.local')
  const fileVars = { ...readEnvFile(webEnvPath), ...readEnvFile(appEnvLocalPath) }
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
      '[next.config] Google OAuth client id missing. Add VITE_GOOGLE_CLIENT_ID to web/.env or this app\'s .env.local, then restart `next dev`.',
    )
  }

  return {
    googleClientId,
    allowedEmails,
    monoRoot,
    webDir: path.join(monoRoot, 'web'),
    webEnvPath,
    appEnvLocalPath,
    readEnvFile,
  }
}

module.exports = { getGoogleAuthEnv, readEnvFile, findMonorepoRoot }
