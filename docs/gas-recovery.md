# GAS Recovery Playbook

This repository has removed active GAS runtime wiring, but old GAS code can be restored quickly from Git tags or your archived zip.

## Recovery Sources

- Git tag created for final GAS state (example: `gas-final-v1.0.0`)
- Archived zip of the old codebase kept outside this repo

## Option A: Restore from tag (recommended)

1. Create a branch from the current `main`:
   - `git checkout main`
   - `git pull origin main`
   - `git checkout -b chore/restore-gas-runtime`
2. Restore deleted GAS-era files from the tag:
   - `git checkout <gas-tag> -- gas deploy.sh worker.js wrangler.toml .github/workflows/deploy-worker.yml`
   - `git checkout <gas-tag> -- packages/apps/*/src/pages/api/gas-proxy`
   - `git checkout <gas-tag> -- packages/apps/*/next.config.js`
   - `git checkout <gas-tag> -- packages/apps/*/.env.local.example`
   - `git checkout <gas-tag> -- packages/shared/auth/src/middleware.ts`
3. Reinstall and validate:
   - `pnpm install`
   - `pnpm type-check`
4. Open a PR and merge after verification.

## Option B: Restore from zip archive

1. Extract zip to a temporary directory outside this repo.
2. Copy back only required files/folders:
   - `gas/`
   - app `gas-proxy` API routes
   - `next.config.js` files with gas rewrites
   - `deploy.sh`, `worker.js`, `wrangler.toml`, worker workflow
3. Reconcile conflicts manually, then run `pnpm type-check`.

## Required envs when re-enabling GAS

- `VITE_GAS_URL`
- `VITE_API_TOKEN`
- `VITE_ALLOWED_EMAILS` (if allowlist enforced)
- `SESSION_SECRET`

## Safety notes

- Restore in a branch only; do not push directly to `main`.
- Keep DB migration changes isolated from GAS rollback commits.
