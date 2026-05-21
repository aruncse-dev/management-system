import { createRequire } from 'node:module'
import type { Config } from 'drizzle-kit'

const require = createRequire(import.meta.url)
require('../../apps/resolve-google-env.cjs').applyMergedDotenv(
  process.env.FINTRACKER_ENV_APP || 'fintracker',
)

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
} satisfies Config
