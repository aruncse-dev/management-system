import dns from 'node:dns'
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
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      ssl: { rejectUnauthorized: true },
      lookup:
        process.env.DATABASE_PG_FORCE_IPV4 === '0'
          ? undefined
          : (hostname, _opts, cb) => {
              dns.lookup(hostname, { family: 4 }, cb)
            },
    })
  }
  return pool
}

/** Node `pg` over TCP (same as `psql`). Use Neon pooler URL in `DATABASE_URL`. */
export function getDb() {
  return drizzle(getPool(), { schema })
}
