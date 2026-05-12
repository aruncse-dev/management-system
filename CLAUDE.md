# FinTracker-Vault Monorepo Guide

This file is a concise, generic guide for anyone working in this repository.
`README.md` is the canonical source for setup and daily usage. Keep this file short and stable.

## Canonical Docs

- `README.md` — primary developer guide (setup, architecture, deployment)
- `.cursor/rules/google-oauth-env.mdc` — allowed Google OAuth env keys
- `.cursor/rules/git-pr-only-main.mdc` — PR-only workflow for `main`
- `docs/gas-recovery.md` — legacy Google Apps Script (removed from tree; recover from tag/zip only if needed)
- `docs/neon-schema-migrations.md` — `drizzle:push` for existing DBs; `export-schema` regenerates `migrations/schema.sql` (CREATE); root `migration.sql` holds ALTERs for drift

## Repo Overview

- Apps:
  - `packages/apps/fintracker` (port 3000)
  - `packages/apps/vault` (port 3001)
  - `packages/apps/staff` (port 3002)
- Shared packages:
  - `@fintracker-vault/auth`, `@fintracker-vault/db`, `@fintracker-vault/ui`, `@fintracker-vault/types`, `@fintracker-vault/config`, `@fintracker-vault/utils`
- Runtime:
  - Frontend + API routes on Vercel
  - Database on Neon Postgres

## Non-Negotiables

1. Use PRs for all changes to `main` (no direct push).
2. Run `pnpm type-check` before pushing.
3. Import global CSS only in `_app.tsx` / `_document.tsx`.
4. Use `@fintracker-vault/*` aliases for cross-package imports.
5. Keep env naming consistent with existing conventions; do not invent app-specific Google OAuth key names.

## Environment Baseline

Minimum per-app envs:

- `SESSION_SECRET`
- `VITE_GOOGLE_CLIENT_ID` (or supported equivalent)
- `VITE_ALLOWED_EMAILS`
- `DATABASE_URL`

Platform admin console access is **`users.role = 'admin'`** (active) in Neon, not an env var.

## Working Agreement for Docs

- Prefer updating `README.md` instead of duplicating long instructions here.
- Keep this file and `AGENTS.md` as short index/guardrail docs.
- Use `docs/*` for focused playbooks (for example, rollback or migration operations).
