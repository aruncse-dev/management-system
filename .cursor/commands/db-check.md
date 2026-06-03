# DB connection check

Verify `DATABASE_URL` and connectivity for local login/API failures.

```bash
pnpm db:check
pnpm db:check:admin
```

If checks fail:

1. Confirm `DATABASE_URL` in repo `.env` / `.env.local` / app `.env.local` (see `CLAUDE.md` env merge order).
2. Read `docs/troubleshooting.md`.
3. Do not commit `.env` files.

Reference: `docs/troubleshooting.md`, `ai/skills/db-workflow.md`
