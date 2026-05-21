# DB Workflow

## Overview

Schema is defined in two places that must stay in sync:

| File | Purpose |
|---|---|
| `packages/shared/db/src/schema/*.ts` | Drizzle ORM schema — used for type-safe queries |
| `packages/shared/db/migrations/schema.sql` | Full DDL snapshot — source of truth for the DB structure |

---

## Making a schema change

### 1. Write the SQL migration

Create a file in `packages/shared/db/migrations/` with a datestamp prefix:

```
packages/shared/db/migrations/20260521_add_account_type_to_savings.sql
```

Contents — use `IF NOT EXISTS` / `IF EXISTS` guards so the file is idempotent:

```sql
ALTER TABLE savings ADD COLUMN IF NOT EXISTS account_type text;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS institution text;
```

### 2. Run it locally

```bash
psql $DATABASE_URL < packages/shared/db/migrations/20260521_add_account_type_to_savings.sql
```

`$DATABASE_URL` is the Neon connection string from your `.env.local`.

### 3. Update the Drizzle TS schema

Edit the relevant file in `packages/shared/db/src/schema/` to match the new columns. Example:

```ts
// savings.ts
accountType: text('account_type'),
institution: text('institution'),
```

### 4. Regenerate the schema snapshot

```bash
pnpm --filter @fintracker-vault/db run export-schema
```

This overwrites `packages/shared/db/migrations/schema.sql` with the current full DDL.

### 5. Commit both files

```bash
git add packages/shared/db/migrations/20260521_add_account_type_to_savings.sql
git add packages/shared/db/migrations/schema.sql
git add packages/shared/db/src/schema/savings.ts
git commit -m "feat(db): add account_type and institution to savings"
```

---

## Rules

- `schema.sql` is always a **generated snapshot** — never hand-edit it
- Individual `.sql` migration files are the audit trail — keep them, never delete
- Write idempotent SQL (`ADD COLUMN IF NOT EXISTS`, `DROP COLUMN IF EXISTS`) so files can be re-run safely
- Update the Drizzle TS schema **in the same commit** as the migration file
- `drizzle:push` still works for fresh dev environments; the `.sql` files are the canonical migration history

---

## Fresh environment setup

For a brand new database (local dev, new deployment):

```bash
# Apply full schema in one shot
psql $DATABASE_URL < packages/shared/db/migrations/schema.sql

# Or use Drizzle push (equivalent for empty DBs)
pnpm --filter @fintracker-vault/db run drizzle:push
```

---

## Column naming conventions

| Type | Convention | Example |
|---|---|---|
| Encrypted secrets | `_enc` suffix, nullable `text` | `access_token_enc` |
| Timestamps | `_at` suffix | `created_at`, `updated_at` |
| JSONB blobs | descriptive name, jsonb type | `enabled_menus`, `settings` |
| Money | `numeric(12,2)` or `numeric(12,4)` for prices | `amount`, `avg_price` |
| Booleans | `is_` prefix | `is_active`, `is_recurring` |

---

## Related

- `ai/docs/schema-diagram.md` — visual ERD of all tables
- `ai/docs/migrations.md` — detailed migration workflow reference
- `packages/shared/db/src/integrationCrypto.ts` — field encryption helpers
