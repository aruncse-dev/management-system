# Local development troubleshooting

Use this when login/API returns **500**, HTML error pages, or `Failed query` on `users` (Google auth, PIN, or any API).

## Quick checklist (do in order)

1. **Stop dev servers** (`Ctrl+C`), then run a DB smoke test:
   ```bash
   pnpm db:check              # fintracker env
   pnpm db:check -- admin     # admin env (port 3003)
   ```
   If this fails, fix env/Neon before restarting apps.

2. **Per-app `.env.local`** (gitignored — never commit):
   - FinTracker: `packages/apps/fintracker/.env.local`
   - Admin: `packages/apps/admin/.env.local`
   - Vault: `packages/apps/vault/.env.local`
   - Staff: `packages/apps/staff/.env.local`  
   Each app you run must have the **same** current `DATABASE_URL` and `SESSION_SECRET` (admin can share fintracker values).

3. **Shell must not override files** — a stale export wins over `.env.local`:
   ```bash
   unset DATABASE_URL SESSION_SECRET
   ```
   Then start dev again from repo root: `pnpm dev:fintracker` or `pnpm dev:admin`.

4. **Schema in sync** (reads `DATABASE_URL` from `packages/apps/fintracker/.env.local` automatically):
   ```bash
   pnpm --filter @fintracker-vault/db run drizzle:push
   ```
   Optional: `FINTRACKER_ENV_APP=admin pnpm --filter @fintracker-vault/db run drizzle:push` to use admin’s `.env.local`.

5. **Shared packages built** after pulling auth/ui changes:
   ```bash
   pnpm --filter @fintracker-vault/auth build
   pnpm --filter @fintracker-vault/ui build
   ```

6. **Fresh dev** if caches/port conflicts:
   ```bash
   pnpm dev:fintracker:fresh
   pnpm dev:admin:fresh
   ```

---

## Symptom: 500 on Google sign-in (`Failed query` on `users`)

Example (Admin app, port 3003):

```text
Failed query: select ... from "users" where "users"."email" = $1
```

### A. `DATABASE_URL` missing or wrong

| Check | Fix |
|--------|-----|
| `pnpm db:check` exits 1 | Add `DATABASE_URL=postgresql://...` to that app’s `.env.local` |
| Rotated Neon password after a leak | Neon console → reset password → copy **new** connection string into **every** app `.env.local` |
| Fintracker works, admin fails | Copy `DATABASE_URL` + `SESSION_SECRET` into `packages/apps/admin/.env.local` |
| `vault` has no `DATABASE_URL` | Copy from fintracker before `pnpm dev:vault` |

`next.config.js` merges repo `.env` → `.env.local` → `web/.env` → **app** `.env.local` (see `packages/apps/resolve-google-env.cjs`). Restart `next dev` after any edit.

### B. Connection string shape (Neon + `pg` driver)

Apps use the Node **`pg`** driver (TCP), not Neon HTTP `fetch`. Prefer Neon’s **pooled** connection string (`*-pooler.*.neon.tech`).

- **Remove** `channel_binding=require` if present (can break some clients).
- Keep `sslmode=require`.
- If `pnpm db:check` fails with **fetch failed**, restart dev after pulling latest — older code used Neon HTTP; current code uses `pg`.

### C. Schema behind the app

If `db:check` mentions missing table/column:

```bash
pnpm --filter @fintracker-vault/db run drizzle:push
```

Reference DDL: `packages/shared/db/migrations/schema.sql`.

### D. Account not provisioned (403, not 500)

If the DB works but sign-in says *not provisioned* / *not a platform administrator*:

- FinTracker / Vault / Staff: need a row in `users` (active).
- Admin console: need `users.role = 'admin'` and `status = 'active'` for your email.

```sql
-- example (run in Neon SQL editor or psql)
INSERT INTO users (email, display_name, role, status, use_db)
VALUES ('you@example.com', 'You', 'admin', 'active', false)
ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'active';
```

---

## Symptom: HTML error page instead of JSON

Usually means the API route crashed before returning JSON, or the browser hit a **login redirect** page.

- Confirm you’re signed in and hitting the correct port (3000 fintracker, 3003 admin).
- Check the terminal running `next dev` for the real stack trace (more detail than the browser `__NEXT_DATA__` blob).
- Ensure `SESSION_SECRET` is set (32+ chars) in the same `.env.local` as `DATABASE_URL`.

---

## Symptom: Google client ID missing / sign-in button broken

Set **one** of: `VITE_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, or `GOOGLE_CLIENT_ID` in repo `.env.local` or `packages/apps/<app>/.env.local`. Restart dev. See `.cursor/rules/google-oauth-env.mdc`.

---

## Symptom: Port already in use (`EADDRINUSE`)

```bash
pnpm run kill-ports
pnpm dev:fintracker:fresh   # or dev:admin:fresh
```

Ports: 3000 fintracker, 3001 vault, 3002 staff, 3003 admin.

---

## Symptom: Stale UI / old auth after package changes

```bash
pnpm --filter @fintracker-vault/auth build
pnpm --filter @fintracker-vault/ui build
pnpm run clean:cache
pnpm dev:fintracker:fresh
```

---

## Env file rules (avoid repeat incidents)

| Do | Don’t |
|----|--------|
| Keep secrets only in **gitignored** `.env.local` | Commit `.env.local` or `*.env.local.example` with real values |
| Use the same Neon URL in every app you run locally | Mix old/new passwords across apps |
| Run `pnpm db:check` after rotating credentials | Assume copy-paste from GitHub/history is still valid |
| `unset DATABASE_URL` if shell exports conflict | Rely on a broken export in `~/.zshrc` |

---

## Related docs

- [README.md](../README.md) — setup and env variable list
- [CLAUDE.md](../CLAUDE.md) — monorepo commands
- [ai/docs/migrations.md](../ai/docs/migrations.md) — schema workflow
- `.cursor/rules/google-oauth-env.mdc` — OAuth env key names
