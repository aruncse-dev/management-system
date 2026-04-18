/**
 * Local: shared `web/.env` at monorepo root (same for Fintracker + Vault).
 * Vercel: project env vars (shell wins; file only fills missing keys locally).
 *
 * Debug logs (masked client id): set FT_DEBUG_ENV=1 (also on when NODE_ENV !== production).
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

/** Repo root (where pnpm installs `@next/env` next to `next`). */
function findRepoRootFromAppsModule() {
  return path.resolve(__dirname, '..', '..')
}

/**
 * Merge `web/.env` into process.env when a key is missing or empty (shell / Vercel wins if set).
 */
function mergeWebDotEnvIntoProcess(appDir) {
  const monoRoot = findMonorepoRoot(appDir)
  const webDir = path.join(monoRoot, 'web')
  const webEnvPath = path.join(webDir, '.env')
  const fileVars = readEnvFile(webEnvPath)
  for (const [k, v] of Object.entries(fileVars)) {
    if (!k) continue
    const cur = process.env[k]
    if (cur === undefined || cur === '') {
      process.env[k] = v
    }
  }
  return { monoRoot, webDir, webEnvPath }
}

function maskClientId(id) {
  if (!id) return '(empty)'
  const s = String(id)
  if (s.length <= 14) return `${s.length} chars`
  return `${s.slice(0, 8)}…${s.slice(-4)} (${s.length} chars)`
}

function envDebugEnabled() {
  return process.env.FT_DEBUG_ENV === '1' || process.env.NODE_ENV !== 'production'
}

function debugLog(label, payload) {
  if (!envDebugEnabled()) return
  console.log(`[resolve-google-env] ${label}`, payload)
}

function tryNextLoadEnvConfig(webDir, appDir) {
  const repoRoot = findRepoRootFromAppsModule()
  const searchPaths = [
    repoRoot,
    path.join(repoRoot, 'node_modules'),
    appDir,
    path.join(appDir, 'node_modules'),
  ]
  try {
    const entry = require.resolve('@next/env', { paths: searchPaths })
    const { loadEnvConfig } = require(entry)
    const dev = process.env.NODE_ENV !== 'production'
    loadEnvConfig(webDir, dev)
    debugLog('@next/env loaded', { webDir, dev })
  } catch (e) {
    debugLog('@next/env skipped', { reason: e && e.message ? e.message : String(e) })
  }
}

function getGoogleAuthEnv(appDir) {
  const { monoRoot, webDir, webEnvPath } = mergeWebDotEnvIntoProcess(appDir)
  debugLog('after mergeWebDotEnv', {
    appDir,
    monoRoot,
    webEnvPath,
    webEnvExists: fs.existsSync(webEnvPath),
    hasViteGoogle: Boolean(process.env.VITE_GOOGLE_CLIENT_ID),
    hasNextPublicGoogle: Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
  })

  tryNextLoadEnvConfig(webDir, appDir)

  const googleClientId =
    process.env.VITE_GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    ''

  const allowedEmails =
    process.env.VITE_ALLOWED_EMAILS || process.env.NEXT_PUBLIC_ALLOWED_EMAILS || process.env.ALLOWED_EMAILS || ''

  debugLog('resolved Google auth', {
    googleClientId: maskClientId(googleClientId),
    allowedEmailsLen: String(allowedEmails).length,
  })

  if (googleClientId) {
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = googleClientId
    if (!process.env.VITE_GOOGLE_CLIENT_ID) process.env.VITE_GOOGLE_CLIENT_ID = googleClientId
  }

  if (!googleClientId) {
    const hint = fs.existsSync(webEnvPath)
      ? `Check VITE_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GOOGLE_CLIENT_ID, or GOOGLE_CLIENT_ID in ${webEnvPath}.`
      : `No ${webEnvPath} — for Vercel, set NEXT_PUBLIC_GOOGLE_CLIENT_ID (or VITE_GOOGLE_CLIENT_ID) on the project.`
    console.warn(`[next.config] Google client id is empty. ${hint}`)
  }

  return { googleClientId, allowedEmails, monoRoot, webDir, webEnvPath, readEnvFile }
}

module.exports = { getGoogleAuthEnv, readEnvFile, findMonorepoRoot, mergeWebDotEnvIntoProcess }
