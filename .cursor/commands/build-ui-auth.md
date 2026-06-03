# Build shared UI + Auth

Rebuild packages required before running apps after editing shared components or session/auth code.

```bash
pnpm --filter @fintracker-vault/ui build
pnpm --filter @fintracker-vault/auth build
```

Then restart the app dev server (`/dev-fintracker`, `/dev-vault`, etc.).

Reference: `CLAUDE.md`
