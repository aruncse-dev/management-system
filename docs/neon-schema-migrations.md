# Neon schema

TypeScript schema: `packages/shared/db/src/schema/`.

## Existing database (recommended)

With `DATABASE_URL` set (same as the app):

```bash
pnpm --filter @fintracker-vault/db run drizzle:push
```

## `migration.sql` (root)

Hand-maintained **idempotent** SQL for drift and optional one-off data fixes. **Append new queries here only** — do not add separate `.sql` migration files in the repo.

Typical sections: `ALTER TABLE …` / `DO $$` blocks, and (at the end) commented optional blocks such as bulk `org_id` repoint—uncomment after editing placeholders, then run:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migration.sql
```

When you add new columns in TypeScript, append matching `ADD COLUMN IF NOT EXISTS` lines here (and run `drizzle:push` in dev).

## `packages/shared/db/migrations/schema.sql` — CREATE only

Full **greenfield** DDL generated from Drizzle (no ALTERs). Regenerate after **any** schema change in TS:

```bash
pnpm --filter @fintracker-vault/db run export-schema
```

Use for documentation, Neon SQL reference, or **new empty** databases (`psql -f …/schema.sql`). Do not edit `schema.sql` by hand.

`drizzle:generate` still runs `export-schema` afterward so `schema.sql` stays current.

**Do not commit** ad-hoc `pg_dump` files (`neon-schema.sql`, etc.); they are gitignored.

`packages/shared/db/migrations/meta/_journal.json` is empty until you adopt versioned `drizzle-kit migrate` flows.
