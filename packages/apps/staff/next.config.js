const path = require('path')
const { getGoogleAuthEnv } = require('../resolve-google-env.cjs')

const { googleClientId: resolvedGoogleClientId, allowedEmails: resolvedAllowedEmails } =
  getGoogleAuthEnv(__dirname)

const clientEnv = {
  NEXT_PUBLIC_API_URL:
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.VITE_API_URL ||
    '/api',
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
  transpilePackages: [
    '@fintracker-vault/auth',
    '@fintracker-vault/ui',
    '@fintracker-vault/types',
    '@fintracker-vault/config',
    '@fintracker-vault/utils',
    '@fintracker-vault/db',
  ],
}

module.exports = nextConfig
