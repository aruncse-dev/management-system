# Neon schema

TypeScript schema: `packages/shared/db/src/schema/`.

## Existing database

**Option A — Drizzle push** (recommended day to day):

```bash
pnpm --filter @fintracker-vault/db run drizzle:push
```

**Option B — SQL migration file** (reviewable, CI-friendly):

```bash
psql "$DATABASE_URL" -f packages/shared/db/migrations/20250519120000_integrations_and_org_flags.sql
```

Use the dated `migrations/*.sql` files for incremental **ALTER** / new tables on databases that already have data. Add a new dated file per schema change batch; do not edit applied migration files.

## `packages/shared/db/migrations/schema.sql` — CREATE only

Full **greenfield** DDL generated from Drizzle (no ALTERs). Regenerate after **any** schema change in TS:

```bash
pnpm --filter @fintracker-vault/db run export-schema
```

Use for documentation, Neon SQL reference, or **new empty** databases (`psql -f …/schema.sql`). Do not edit `schema.sql` by hand.

`drizzle:generate` still runs `export-schema` afterward so `schema.sql` stays current.

**Do not commit** ad-hoc `pg_dump` files (`neon-schema.sql`, etc.); they are gitignored.

`packages/shared/db/migrations/meta/_journal.json` is empty until you adopt versioned `drizzle-kit migrate` flows.
