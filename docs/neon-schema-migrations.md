# Neon schema

TypeScript schema: `packages/shared/db/src/schema/`.

## Existing database (recommended)

With `DATABASE_URL` set (same as the app):

```bash
pnpm --filter @fintracker-vault/db run drizzle:push
```

## `packages/shared/db/migrations/schema.sql` — CREATE only

Full **greenfield** DDL generated from Drizzle (no ALTERs). Regenerate after **any** schema change in TS:

```bash
pnpm --filter @fintracker-vault/db run export-schema
```

Use for documentation, Neon SQL reference, or **new empty** databases (`psql -f …/schema.sql`). Do not edit `schema.sql` by hand.

`drizzle:generate` still runs `export-schema` afterward so `schema.sql` stays current.

**Do not commit** ad-hoc `pg_dump` files (`neon-schema.sql`, etc.); they are gitignored.

`packages/shared/db/migrations/meta/_journal.json` is empty until you adopt versioned `drizzle-kit migrate` flows.
