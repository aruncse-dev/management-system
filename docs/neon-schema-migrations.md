# Neon schema

There are **no** checked-in SQL migration files under `packages/shared/db/migrations/`. Sync the database from the Drizzle schema with `DATABASE_URL` set:

```bash
pnpm --filter @fintracker-vault/db run drizzle:push
```

Older databases may still have a `schema_migrations` table from historical manual SQL; it is not required for new setups.
