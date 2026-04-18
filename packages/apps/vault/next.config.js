const path = require('path')
const { getGoogleAuthEnv } = require('../resolve-google-env.cjs')

const { googleClientId: resolvedGoogleClientId, allowedEmails: resolvedAllowedEmails } =
  getGoogleAuthEnv(__dirname)

const clientEnv = {
  NEXT_PUBLIC_API_URL:
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.VITE_API_URL ||
    '/gas-proxy',
  NEXT_PUBLIC_API_TOKEN: process.env.NEXT_PUBLIC_API_TOKEN || process.env.VITE_API_TOKEN || '',
  NEXT_PUBLIC_GAS_URL: process.env.NEXT_PUBLIC_GAS_URL || process.env.VITE_GAS_URL || '',
  VITE_GOOGLE_CLIENT_ID: resolvedGoogleClientId,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: resolvedGoogleClientId,
  NEXT_PUBLIC_APP_PASSWORD: process.env.NEXT_PUBLIC_APP_PASSWORD || process.env.VITE_APP_PASSWORD || '',
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
  transpilePackages: [
    '@fintracker-vault/ui',
    '@fintracker-vault/types',
    '@fintracker-vault/config',
    '@fintracker-vault/utils',
  ],
  async rewrites() {
    const gasUrl =
      process.env.NEXT_PUBLIC_GAS_URL || process.env.GAS_EXEC_URL || process.env.VITE_GAS_URL || ''
    if (!gasUrl) return []

    return [
      {
        source: '/gas-proxy',
        destination: gasUrl,
      },
      {
        source: '/gas-proxy/:path*',
        destination: `${gasUrl.replace(/\/$/, '')}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
