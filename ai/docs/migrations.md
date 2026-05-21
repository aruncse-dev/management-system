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

`$DATABASE_URL` must be set in your `.env.local`:

```env
DATABASE_URL=postgresql://user:password@db.neon.tech/dbname
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

### Step 4: Regenerate the schema snapshot

```bash
pnpm --filter @fintracker-vault/db run export-schema
```

This command:
1. Introspects the Drizzle TS schema files
2. Generates full DDL and saves it to `packages/shared/db/migrations/schema.sql`
3. Overwrites the snapshot — **do not hand-edit `schema.sql`**

### Step 5: Commit everything

```bash
git add packages/shared/db/migrations/20260521130000_add_account_type_to_savings.sql
git add packages/shared/db/src/schema/savings.ts
git add packages/shared/db/migrations/schema.sql
git commit -m "feat(db): add account_type and institution to savings"
```

---

## Deployment to Neon (production)

The migration is already applied locally (Step 2). Neon stays in sync if:

1. Another dev already applied the migration to the shared Neon instance, OR
2. You apply it yourself (if you have access)

The `.sql` files in version control serve as the audit trail. CI/CD pipelines can apply pending migrations automatically.

**To verify Neon is up-to-date:**

```bash
# Compare Neon schema against your local Drizzle schema
drizzle-kit introspect:pg --casing snake  # inspect Neon
# then check diff against packages/shared/db/src/schema/
```

---

## Fresh database setup

For a brand new database (empty local Postgres, or a new Neon branch):

**Option A: Run full schema at once**
```bash
psql $DATABASE_URL < packages/shared/db/migrations/schema.sql
```

**Option B: Use Drizzle push (equivalent for empty DBs)**
```bash
pnpm --filter @fintracker-vault/db run drizzle:push
```

Both populate the DB with the full current schema in one shot.

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

2. Run it locally (Step 2 in the workflow above)
3. Revert the Drizzle TS schema (remove the new fields)
4. Regenerate schema snapshot: `pnpm --filter @fintracker-vault/db run export-schema`
5. Commit the rollback migration, schema revert, and updated snapshot

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

**Error: "migration lock is held"**
- Another process is running drizzle-kit. Wait or kill the process.

**Error: "role 'postgres' cannot access schema public"**
- Neon connection string may have wrong user/password or DB doesn't exist.

**Schema snapshot out of sync with TS files**
- Run `pnpm --filter @fintracker-vault/db run export-schema` again.

**Rolled back Neon, TS schema ahead**
- Apply the rolled-back state's `.sql` files again to Neon, then regenerate snapshot.

---

## Related

- `ai/skills/db-workflow.md` — quick schema change guide
- `ai/docs/schema-diagram.md` — all tables and relationships
- `packages/shared/db/drizzle.config.ts` — Drizzle configuration
