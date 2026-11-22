const path = require('path')
const { getGoogleAuthEnv } = require('../resolve-google-env.cjs')

const { googleClientId: resolvedGoogleClientId, allowedEmails: resolvedAllowedEmails } =
  getGoogleAuthEnv(__dirname)

const clientEnv = {
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

module.exports = nextConfig
