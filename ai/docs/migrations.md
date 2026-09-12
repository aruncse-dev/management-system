# Database Migrations

## Workflow

The migration workflow is **SQL-first with TypeScript schema sync**.

### Step 1: Write the SQL migration file

Create a new file in `packages/shared/db/migrations/` with a datestamp prefix (YYYYMMDD + HHMMSS):

```bash
packages/shared/db/migrations/20260521130000_add_account_type_to_savings.sql
```

Use **idempotent** SQL so the file can be re-run safely:

```sql
ALTER TABLE savings ADD COLUMN IF NOT EXISTS account_type text;
ALTER TABLE savings ADD COLUMN IF NOT EXISTS institution text;
```

Use `IF NOT EXISTS` / `IF EXISTS` guards on all structural operations:
- `ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type>;`
- `DROP COLUMN IF EXISTS <col>;`
- `DROP TABLE IF EXISTS <table>;`

### Step 2: Run it locally

Apply the migration to your local Neon database:

```bash
psql $DATABASE_URL < packages/shared/db/migrations/20260521130000_add_account_type_to_savings.sql
```

Put `DATABASE_URL` in **`packages/apps/fintracker/.env.local`** (gitignored). `drizzle:push` and `pnpm db:check` load it automatically.

For manual `psql`, use the same URL from that file (do not commit it):

```bash
set -a && . packages/apps/fintracker/.env.local && set +a
psql "$DATABASE_URL" < packages/shared/db/migrations/<file>.sql
```

### Step 3: Update the Drizzle TypeScript schema

Edit the relevant schema file in `packages/shared/db/src/schema/` to match the new columns. Example:

**File:** `packages/shared/db/src/schema/savings.ts`

```ts
import { pgTable, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core'

export const savings = pgTable('savings', {
  id: text('id').primaryKey(),
  orgId: text('org_id'),
  date: timestamp('date'),
  account: text('account'),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  type: text('type'), // 'savings', 'current'
  // NEW COLUMNS
  accountType: text('account_type'),
  institution: text('institution'),
  createdAt: timestamp('created_at').defaultNow(),
})
```

### Step 4: Commit the migration and schema update

```bash
git add packages/shared/db/migrations/20260521130000_add_account_type_to_savings.sql
git add packages/shared/db/src/schema/savings.ts
git commit -m "feat(db): add account_type and institution to savings"
```

The `.sql` file is your audit trail. The TS schema is your source of truth for the codebase.

---

## Applying migrations to Neon (production)

Migrations are manual — you apply `.sql` files directly to Neon.

### Option A: psql command line (recommended)

```bash
psql postgresql://<user>:<password>@<host>/fintracker < packages/shared/db/migrations/20260521_add_account_type_to_savings.sql
```

- Replace `<user>`, `<password>`, `<host>` with your Neon credentials
- Or use `$DATABASE_URL` if set: `psql $DATABASE_URL < path/to/migration.sql`

### Option B: Neon console (web UI)

1. Log in to [Neon console](https://console.neon.tech)
2. Select your project and database
3. Open the **SQL editor**
4. Copy-paste the contents of the `.sql` file
5. Click **Run**

### Option C: Query your DATABASE_URL

If you have the full `DATABASE_URL` env var:

```bash
# Find the URL in your Neon console or .env
echo $DATABASE_URL
# Run migration
psql "$DATABASE_URL" < packages/shared/db/migrations/20260521_add_account_type_to_savings.sql
```

### Verify success

After applying, check that the table has the new column:

```bash
psql "$DATABASE_URL" -c "\d <table_name>"
```

Example:
```bash
psql "$DATABASE_URL" -c "\d savings"
```

Should show the new columns `account_type` and `institution`.

---

## Fresh Neon database setup

When setting up a brand new Neon database:

1. Create the database in Neon console
2. Get the `DATABASE_URL` connection string from Neon
3. Apply the full schema:

```bash
export DATABASE_URL="postgresql://..."
psql $DATABASE_URL < packages/shared/db/migrations/schema.sql
```

This populates all 28 tables in one shot. Then start making incremental changes with new `.sql` migration files.

---

## Rules

- Individual `.sql` migration files are the audit trail — keep them, never delete
- Write idempotent SQL (`ADD COLUMN IF NOT EXISTS`, `DROP COLUMN IF EXISTS`) so files can be re-run safely
- Update the Drizzle TS schema **in the same commit** as the migration file
- `packages/shared/db/migrations/schema.sql` is generated from the Drizzle TS schema by `export-schema` — never hand-edit it. It reflects the TS schema, not the live database.
- Never auto-sync the database — all migrations are manual, applied directly to Neon

---

## Column naming conventions

| Pattern | Example | Usage |
|---|---|---|
| `_at` suffix | `created_at`, `updated_at` | timestamps |
| `_enc` suffix | `password_enc`, `token_enc` | encrypted secrets (AES-256-GCM) |
| `is_` prefix | `is_active`, `is_recurring` | boolean flags |
| numeric precision | `numeric(12, 2)` | money (cents precision) |
| | `numeric(12, 4)` | prices or weights (4 decimals) |
| JSONB | `settings`, `enabled_apps`, `tags` | config/metadata |

---

## Rollback

**To undo a migration:**

1. Create a new migration file that reverses the change:

   ```sql
   -- 20260521135000_undo_add_account_type_to_savings.sql
   ALTER TABLE savings DROP COLUMN IF EXISTS account_type;
   ALTER TABLE savings DROP COLUMN IF EXISTS institution;
   ```

2. Apply it to Neon (using one of the options above)
3. Revert the Drizzle TS schema (remove the new fields)
4. Commit the rollback migration and schema revert

Never delete historical `.sql` files — they form the audit trail.

---

## Multi-column constraint example

To add a unique constraint on multiple columns:

```sql
-- 20260521_add_unique_org_name_constraint.sql
ALTER TABLE organizations
ADD CONSTRAINT organizations_org_id_name_unique
UNIQUE (id, name);
```

In Drizzle:

```ts
export const organizations = pgTable(
  'organizations',
  { ... },
  (table) => ({
    orgIdNameUnique: uniqueIndex('organizations_org_id_name_unique')
      .on(table.id, table.name),
  })
)
```

---

## Encrypted fields (`_enc` columns)

When adding a new encrypted column:

```sql
ALTER TABLE vault_apps ADD COLUMN IF NOT EXISTS api_key_enc text;
```

In Drizzle:

```ts
apiKeyEnc: text('api_key_enc'), // nullable text
```

When **reading/writing**, use the encryption helpers from `@fintracker-vault/db`:

```ts
import { encryptSensitiveField, decryptSensitiveField } from '@fintracker-vault/db'

// Write
await db.insert(vaultApps).values({
  apiKeyEnc: encryptSensitiveField(apiKey),
})

// Read
const row = await db.select().from(vaultApps)...
const apiKey = decryptSensitiveField(row.apiKeyEnc)
```

Requires `FIELD_ENCRYPTION_KEY` env var (32-byte base64 string). See `ai/docs/sensitive-field-encryption.md`.

---

## Troubleshooting

**Error: "role 'postgres' cannot access schema public"**
- Neon connection string may have wrong user/password, DB doesn't exist, or you lack permissions

**Error: "relation 'table_name' does not exist"**
- Table hasn't been created in Neon yet. Check if the `.sql` migration was applied.

**Migration applied locally but not in Neon**
- The databases are separate. You must apply the `.sql` file to Neon using psql or Neon console.

**TS schema and Neon are out of sync**
- Review your recent `.sql` files
- Verify they were applied to Neon (check with `psql "$DATABASE_URL" -c "\dt"`)
- Update the TS schema to match Neon's current state

---

## Related

- `ai/skills/db-workflow.md` — quick schema change guide
- `ai/docs/schema-diagram.md` — all tables and relationships
- `packages/shared/db/drizzle.config.ts` — Drizzle configuration
