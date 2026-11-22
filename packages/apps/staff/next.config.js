const path = require('path')
const fs = require('fs')
const { PHASE_PRODUCTION_BUILD } = require('next/constants')

/**
 * Which deploy this is: the commit Vercel built, and when. Baked into the
 * client (drawer stamp) and published as /version.json so a running app can
 * tell that a newer deploy is live and stop showing an old cached page.
 */
const BUILD_SHA = String(process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)
const BUILD_TIME = new Date().toISOString()
const { getGoogleAuthEnv } = require('../resolve-google-env.cjs')

const { googleClientId: resolvedGoogleClientId, allowedEmails: resolvedAllowedEmails } =
  getGoogleAuthEnv(__dirname)

const clientEnv = {
  NEXT_PUBLIC_BUILD_SHA: BUILD_SHA,
  NEXT_PUBLIC_BUILD_TIME: BUILD_TIME,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  VITE_GOOGLE_CLIENT_ID: resolvedGoogleClientId,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: resolvedGoogleClientId,
  VITE_ALLOWED_EMAILS: resolvedAllowedEmails,
  NEXT_PUBLIC_ALLOWED_EMAILS: resolvedAllowedEmails,
}

for (const [k, v] of Object.entries(clientEnv)) {
  if (v !== undefined && v !== null && String(v) !== '') {
    process.env[k] = String(v)
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../..'),
  },
  env: clientEnv,
  async headers() {
    return [
      {
        // The service worker must always be revalidated, or a fix to it can sit
        // behind a cached copy for as long as the browser likes.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Must never be cached: it is how an open app learns a newer deploy exists.
        source: '/version.json',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
    ]
  },
  transpilePackages: [
    // next/font/local inside geist must be compiled by Next, not imported raw.
    'geist',
    '@fintracker-vault/auth',
    '@fintracker-vault/ui',
    '@fintracker-vault/types',
    '@fintracker-vault/config',
    '@fintracker-vault/utils',
    '@fintracker-vault/db',
  ],
}

module.exports = phase => {
  if (phase === PHASE_PRODUCTION_BUILD) {
    try {
      fs.writeFileSync(
        path.join(__dirname, 'public', 'version.json'),
        JSON.stringify({ build: BUILD_SHA, time: BUILD_TIME }) + '\n',
      )
    } catch {
      // A missing version file only disables the update check.
    }
  }
  return nextConfig
}
