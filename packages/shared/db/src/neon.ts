import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema/index'

const { Pool } = pg

let pool: pg.Pool | null = null

function getPool(): pg.Pool {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not configured. Add it to packages/apps/<app>/.env.local (gitignored). See docs/troubleshooting.md and run pnpm db:check.',
    )
  }
  if (!pool) {
    /** Use connection string as-is (sslmode, channel_binding, etc. from Neon dashboard). */
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
    })
  }
  return pool
}

/** Node `pg` (TCP) — same path as `psql`; Neon HTTP `fetch` often fails locally. */
export function getDb() {
  return drizzle(getPool(), { schema })
}
