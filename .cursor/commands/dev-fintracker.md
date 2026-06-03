# Dev: Fintracker (fresh)

Start Fintracker on port 3000 with ports cleared and Next/Turbo cache reset.

```bash
pnpm dev:fintracker:fresh
```

If login or API returns 500, run `/db-check` next.

After editing `@fintracker-vault/ui` or `@fintracker-vault/auth`, run `/build-ui-auth` first.

Reference: `CLAUDE.md`, `docs/troubleshooting.md`
