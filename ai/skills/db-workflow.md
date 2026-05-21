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

### 2. Apply to Neon

Apply the migration directly to your Neon database. Choose one method:

**Method A: psql command line (recommended)**
```bash
psql $DATABASE_URL < packages/shared/db/migrations/20260521_add_account_type_to_savings.sql
```

Get `DATABASE_URL` from your `.env.local` or Neon console (do not commit).

**Method B: Neon web console**
1. Go to [console.neon.tech](https://console.neon.tech)
2. Select your project and database
3. Open **SQL editor**
4. Paste the `.sql` file contents
5. Click **Run**

### 3. Update the Drizzle TS schema

Edit the relevant file in `packages/shared/db/src/schema/` to match the new columns:

```ts
// savings.ts
accountType: text('account_type'),
institution: text('institution'),
```

### 4. Commit the changes

```bash
git add packages/shared/db/migrations/20260521_add_account_type_to_savings.sql
git add packages/shared/db/src/schema/savings.ts
git commit -m "feat(db): add account_type and institution to savings"
```

---

## Rules

- Individual `.sql` migration files are the audit trail — keep them, never delete
- Write idempotent SQL (`ADD COLUMN IF NOT EXISTS`, `DROP COLUMN IF EXISTS`) so files can be re-run safely
- Update the Drizzle TS schema **in the same commit** as the migration file
- `schema.sql` is a reference snapshot only — never auto-generated or synced
- All migrations are manual — apply directly to Neon, no automation

---

## Neon setup (first time)

When setting up a brand new Neon database:

1. Create the database in Neon console
2. Get the `DATABASE_URL` connection string
3. Apply the full schema in one shot:

```bash
psql $DATABASE_URL < packages/shared/db/migrations/schema.sql
```

This populates all tables. Then make incremental changes with new `.sql` migration files.

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

- `ai/docs/migrations.md` — detailed step-by-step migration guide
- `ai/docs/schema-diagram.md` — visual ERD of all 28 tables with FKs
- `ai/docs/sensitive-field-encryption.md` — field encryption for secrets/PII
