# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run a single app in dev mode
pnpm dev:fintracker          # port 3000
pnpm dev:vault               # port 3001
pnpm dev:staff               # port 3002

# Fresh start (kills ports 3000-3003, clears .next + .turbo cache)
pnpm dev:fintracker:fresh

# Type-check all packages (required before pushing)
pnpm type-check

# Lint all packages
pnpm lint

# Run tests (fintracker and vault only; staff has no test script)
pnpm test
# Run a single test file
pnpm --filter fintracker test -- --testPathPattern="<filename>"

# Build
pnpm build                   # all apps
pnpm build:fintracker        # single app

# Apply DB schema changes to Neon
pnpm --filter @fintracker-vault/db run drizzle:push

# Regenerate migrations/schema.sql (full CREATE DDL snapshot)
pnpm --filter @fintracker-vault/db run export-schema

# After editing @fintracker-vault/ui or @fintracker-vault/auth, build them first
pnpm --filter @fintracker-vault/ui build
pnpm --filter @fintracker-vault/auth build
```

## Architecture

### Monorepo layout

Turborepo + pnpm workspaces. Three Next.js 14 (pages router) apps share a set of published-but-local packages.

```
packages/
  apps/
    fintracker/   # expense tracking, gold, loans, investments, subscriptions (port 3000)
    vault/        # insurance, passwords, documents, health (port 3001)
    staff/        # attendance calendar, staff management (port 3002)
  shared/
    db/           # @fintracker-vault/db  — Drizzle ORM schema + all DB query helpers
    auth/         # @fintracker-vault/auth — iron-session handlers, Google OAuth, middleware
    ui/           # @fintracker-vault/ui  — shared React components (KpiCard, AppAuthGate, etc.)
    config/       # @fintracker-vault/config — app menus catalog, env helpers
    utils/        # @fintracker-vault/utils — formatters, calculators, validators
    types/        # @fintracker-vault/types — shared domain types
```

### Single API handler per app

Each app exposes one Next.js API route at `src/pages/api/index.ts`. That file reads `module` (GET query param) and `action` (POST body) and dispatches to the relevant handler block. There is no REST-style routing — everything is a POST for mutations and GET for reads, all through `/api`.

**fintracker** has a 1600-line monolithic dispatcher (`src/lib/fintrackerMainApi.ts`) with blocks for: `settings`, `vault`, `stocks`, `lending`, `savings`, `gold`, `loans`, `insurance`, `subscriptions`, `mutualfunds`. Auth routes live under `src/pages/api/auth/`.

### Auth flow (shared across all apps)

`@fintracker-vault/auth` provides:
- `createFtMiddleware()` — Next.js middleware that protects all page and API routes; passes through `/`, `/api/auth/*`, and static assets.
- `handleGoogleAuthPost` — verifies Google JWT via JWKS, then calls `verifyProvisionedGoogleUser` (checks `users` table; rejects suspended accounts) and `applyDefaultOrgToSession` (sets `session.activeOrgId`).
- `handleVerifyPinPost` — PIN-based auth for local/admin login; resolves email from `PIN_SESSION_EMAIL` env or first platform admin in DB.

Session cookies are per-app: `ft_session_fintracker`, `ft_session_vault`, `ft_session_staff`. Access is DB-driven — a user must have an `active` row in the `users` table (no hardcoded email allowlist for fintracker; vault/staff use `VITE_ALLOWED_EMAILS`).

### Org and menu system

All data is org-scoped. `organizations` table has two JSONB columns:
- `enabled_apps` — which apps (`fintracker`, `vault`, `staff`) the org can access.
- `enabled_menus` — per-app enabled menu slugs (e.g. `{"fintracker": ["dashboard", "savings"]}`).

The canonical menu catalog is `packages/shared/config/src/appMenus.ts`. `getEnabledOrgMenu(orgId, appSlug)` in `@fintracker-vault/db/orgMenu` filters it by the org's enabled set. Platform admin access requires `users.role = 'admin'` in Neon — not an env var.

### DB schema

Schema files: `packages/shared/db/src/schema/`. Apply changes with `drizzle:push` (no migration files needed for existing DBs). Never edit `migrations/schema.sql` by hand — regenerate it with `export-schema`. Do not commit ad-hoc `pg_dump` files.

## Non-Negotiables

1. All changes to `main` via PR — no direct push (tags are exempt).
2. Run `pnpm type-check` before pushing.
3. Global CSS only in `_app.tsx` / `_document.tsx`.
4. Cross-package imports via `@fintracker-vault/*` aliases.
5. Google OAuth client ID must use one of: `VITE_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, or `GOOGLE_CLIENT_ID`. Do not invent new names. New apps must use `getGoogleAuthEnv(__dirname)` in `next.config.js`.
6. After editing `@fintracker-vault/ui` or `@fintracker-vault/auth`, build those packages before running an app.

## Environment Variables

Minimum per app: `SESSION_SECRET` (32+ chars), `DATABASE_URL` (Neon Postgres), `VITE_GOOGLE_CLIENT_ID`, `VITE_ALLOWED_EMAILS` (vault/staff).

Merge order: repo `.env` → `.env.local` → `web/.env` → `packages/apps/<app>/.env.local` → shell/Vercel env.

Obsolete (do not use): `VITE_GAS_URL`, `VITE_API_TOKEN`, `GAS_EXEC_URL`, `NEXT_PUBLIC_GAS_URL`, `VITE_API_URL`, `VITE_APP_PASSWORD`, `NEXT_PUBLIC_APP_PASSWORD`.

## Reference Docs

- `README.md` — setup and deployment
- `docs/neon-schema-migrations.md` — schema workflow details
- `.cursor/rules/google-oauth-env.mdc` — OAuth env key rules
- `.cursor/rules/monorepo-guidelines.mdc` — monorepo constraints
