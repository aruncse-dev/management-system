const fs = require('fs')
const path = require('path')

function readWebEnv() {
  const envPath = path.resolve(__dirname, '../../../web/.env')
  if (!fs.existsSync(envPath)) return {}
  const raw = fs.readFileSync(envPath, 'utf8')
  const out = {}
  raw.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const idx = trimmed.indexOf('=')
    if (idx <= 0) return
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    out[key] = value
  })
  return out
}

const webEnv = readWebEnv()
const routeAliases = [
  ['monthly', 'Monthly'],
  ['transactions', 'Transactions'],
  ['budget', 'Budget'],
  ['credits', 'Credits'],
  ['accounts', 'Accounts'],
  ['lending', 'Lending'],
  ['savings', 'Savings'],
  ['bommi', 'Bommi'],
  ['gold', 'Gold'],
  ['investments', 'Investments'],
  ['loans', 'Loans'],
  ['settings', 'Settings'],
  ['components', 'Components'],
  ['mutualfunds', 'MutualFunds'],
  ['stocks', 'Stocks'],
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      webEnv.VITE_API_URL ||
      '/gas-proxy',
    NEXT_PUBLIC_API_TOKEN:
      process.env.NEXT_PUBLIC_API_TOKEN ||
      webEnv.VITE_API_TOKEN ||
      '',
    NEXT_PUBLIC_GAS_URL:
      process.env.NEXT_PUBLIC_GAS_URL ||
      webEnv.VITE_GAS_URL ||
      '',
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      webEnv.VITE_GOOGLE_CLIENT_ID ||
      '',
    NEXT_PUBLIC_APP_PASSWORD:
      process.env.NEXT_PUBLIC_APP_PASSWORD ||
      webEnv.VITE_APP_PASSWORD ||
      '',
    NEXT_PUBLIC_ALLOWED_EMAILS:
      process.env.NEXT_PUBLIC_ALLOWED_EMAILS ||
      webEnv.VITE_ALLOWED_EMAILS ||
      '',
  },
  transpilePackages: [
    '@fintracker-vault/ui',
    '@fintracker-vault/types',
    '@fintracker-vault/config',
    '@fintracker-vault/utils',
  ],
  async rewrites() {
    const appRouteRewrites = routeAliases.map(([lower, upper]) => ({
      source: `/${lower}`,
      destination: `/${upper}`,
    }))

    const gasUrl =
      process.env.NEXT_PUBLIC_GAS_URL ||
      process.env.GAS_EXEC_URL ||
      process.env.VITE_GAS_URL ||
      webEnv.VITE_GAS_URL
    if (!gasUrl) return appRouteRewrites

    return [
      ...appRouteRewrites,
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
};

module.exports = nextConfig;
