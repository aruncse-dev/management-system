# DB migration workflow

Follow the manual Neon migration workflow (no automation):

1. **Write SQL** — new file in `packages/shared/db/migrations/` with date prefix, idempotent guards (`IF NOT EXISTS` / `IF EXISTS`).
2. **Apply in Neon** — `psql $DATABASE_URL < packages/shared/db/migrations/<file>.sql`
3. **Update Drizzle** — matching columns in `packages/shared/db/src/schema/*.ts`
4. **Type-check** — `pnpm type-check`
5. **Commit** — migration `.sql` + schema TS in the same commit

Never hand-edit `schema.sql` snapshot; regenerate with `pnpm --filter @fintracker-vault/db export-schema` when updating the snapshot intentionally.

Full guide: `ai/docs/migrations.md`, `ai/skills/db-workflow.md`

Ask the user to run `psql` themselves unless they explicitly want you to run it with their `DATABASE_URL`.
