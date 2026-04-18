# FinTracker-Vault Monorepo — Architecture & Guidelines

**Status:** Production-ready monorepo deploying to Vercel (Apr 2026)

---

## Architecture Overview

**fintracker-vault** is a pnpm monorepo with two Next.js 14 apps sharing UI/config libraries:

```
├── packages/apps/fintracker/    # Financial tracking (port 3000)
├── packages/apps/vault/         # Secure storage app (port 3001)
├── packages/shared/             # Shared @fintracker-vault/* packages
│   ├── config/                  # Constants, domain config
│   ├── types/                   # Shared TypeScript interfaces
│   ├── ui/                      # React components, theme, AppAuthGate
│   └── utils/                   # Calculations, validators, formatters
├── packages/tools/configs/
│   └── eslint-config/           # Shared ESLint rules (unused by apps — TODO: wire up)
├── gas/                         # Google Apps Script backend (deployment via clasp)
├── worker.js / wrangler.toml   # Cloudflare Worker (proxies GAS)
└── deploy.sh                    # Clasp deployment script
```

---

## Key Files & Responsibilities

### Root Level

- **`pnpm-workspace.yaml`** — Declares all workspace packages
- **`turbo.json`** — Build pipeline: `dev`, `build`, `lint`, `type-check`
- **`package.json`** — Root scripts (dev:fresh, kill-ports, etc.) + Node/pnpm constraints
- **`tsconfig.json`** — Path aliases for all `@fintracker-vault/*` imports
- **`.env.local`** — Local Google OAuth + GAS URL (ignored, never committed)
- **`.git/hooks/pre-push`** — Runs `pnpm type-check` before push

### Apps

Both apps use **pages router** (`src/pages/`), not app router.

**Authentication Flow:**
1. `_document.tsx` — Injects `window.__FT_AUTH_ENV` (Google client ID + allowed emails, NOT password)
2. `_app.tsx` — Wraps app in `<AppAuthGate>` (from `@fintracker-vault/ui`)
3. `AppAuthGate.tsx` — Lock screen with Google OAuth or PIN (after 1h idle timeout)
4. `clientAuthEnv.ts` — Reads auth config from `process.env` (auto-loaded from `.env.local`)

**Environment Variables:**
- Local dev: `packages/apps/{fintracker,vault}/.env.local` (gitignored)
- Vercel: Set in project settings (Vercel UI)
- Key vars: `VITE_GOOGLE_CLIENT_ID`, `VITE_GAS_URL`, `VITE_API_TOKEN`, `VITE_ALLOWED_EMAILS`

**API Route (Vault only):**
- `packages/apps/vault/src/pages/api/gas-proxy/[[...path]].ts` — Proxies requests to GAS API
- Passes through `user-agent`, `accept`, `content-type` headers
- Resolves GAS URL from `process.env` (Next.js auto-loads `.env.local`)

### Shared Packages

Each package in `packages/shared/` is published as `@fintracker-vault/*`:

| Package | Exports | Usage |
|---------|---------|-------|
| `config/` | Env config, domain mapping, constants | Imported in both apps |
| `types/` | TypeScript interfaces (GoldRow, etc.) | Shared data structures |
| `ui/` | React components (AppAuthGate, Nav, KpiCard, etc.) | Built with tsup (ESM + CJS) |
| `utils/` | `formatINR()`, `calculateReturn()`, validators | Shared logic |

**Transpiling:** Both apps declare `transpilePackages: ['@fintracker-vault/*']` in next.config.js so shared packages (written in TS) are compiled during app build.

### Backend

**GAS:** `gas/` directory contains Google Apps Script code. Deploy with `pnpm deploy:gas` or `./deploy.sh` (uses clasp).

**Cloudflare Worker:** `worker.js` + `wrangler.toml` proxy requests to GAS URL. Used for CORS headers or URL rewriting.

---

## Development Commands

### Local Development

```bash
# Start both apps on ports 3000 (fintracker) + 3001 (vault)
pnpm dev

# Start one app only
pnpm dev:fintracker     # fintracker on :3000
pnpm dev:vault          # vault on :3001

# Fresh restart (kills ports, clears .turbo/.next caches, reinstalls, starts dev)
pnpm dev:fresh

# Clean specific caches
pnpm clean:cache        # Clears .next + .turbo
pnpm clean              # Full nuke: .turbo + node_modules + pnpm store
```

### Building & Testing

```bash
pnpm build              # Turborepo: builds all apps in dependency order
pnpm build:fintracker   # Build only fintracker
pnpm build:vault        # Build only vault

pnpm type-check         # TypeScript validation across all packages
pnpm lint               # ESLint across all packages
pnpm format             # Prettier format all files
```

### Pre-Push Checks

Before pushing to GitHub, `.git/hooks/pre-push` runs `pnpm type-check`. Prevents pushing code with TS errors.

---

## Environment Variables

### Local Development (`.env.local` files)

Create `packages/apps/fintracker/.env.local` and `packages/apps/vault/.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=<your-oauth-client-id>
VITE_GAS_URL=https://script.google.com/macros/s/...
VITE_API_TOKEN=<gas-api-token>
VITE_ALLOWED_EMAILS=your@email.com
VITE_API_URL=/gas-proxy           # Proxied by Next.js
VITE_APP_PASSWORD=                # Optional: 4-digit PIN for idle lock
VITE_SHEET_ID=                    # Optional: GAS spreadsheet ID
```

**Important:**
- Both apps read from their own `.env.local` (Next.js auto-loads before build)
- `VITE_GOOGLE_CLIENT_ID` must be registered in Google Cloud Console with your localhost origins
- `.env.local` files are gitignored and never committed
- If `VITE_APP_PASSWORD` is not set, PIN lock is disabled (safe default)

### Vercel Deployment

Set in each Vercel project's **Settings → Environment Variables**:

```
VITE_GOOGLE_CLIENT_ID = <your-oauth-client-id>
VITE_GAS_URL = https://script.google.com/macros/s/...
VITE_API_TOKEN = <gas-api-token>
VITE_ALLOWED_EMAILS = your@email.com
```

- Vercel injects these via `process.env` during build
- No need for `.env.local` on Vercel (ignored anyway)

---

## Authentication Model

### How It Works

1. User visits app → sees lock screen with Google "Sign In" button
2. Clicks → Google OAuth dialog → user authorizes
3. App decodes JWT token client-side, extracts email
4. Checks if email is in `VITE_ALLOWED_EMAILS` → grants access
5. Sets cookie `ft_google_authed=1` + `localStorage.ft_last_active` → unlocked
6. After 1 hour of inactivity → lock resets, requires PIN entry

### Security Model

**Known Limitations (By Design):**

- Auth is **entirely client-side** — a determined attacker can:
  - Set cookie `ft_google_authed=1` in DevTools
  - Modify JavaScript to bypass lock screen
- `window.__FT_AUTH_ENV` exposes `allowedEmailsRaw` (needed for client-side auth check)
- `NEXT_PUBLIC_API_TOKEN` is visible in JS bundle (embedded via webpack define)

**Real Data Security:**
- The GAS API (`VITE_GAS_URL`) is the actual backend — data lives there
- API token (`VITE_API_TOKEN`) is the real secret; keep it safe in Vercel
- Client-side auth is for casual access control, not adversary defense
- For a personal app (single user: aruncse17@gmail.com), this model is acceptable

---

## Deployment (Vercel)

### Setup (One-Time)

1. Create two Vercel projects at https://vercel.com/new:
   - **Project 1:** fintracker
     - Root Directory: `packages/apps/fintracker`
   - **Project 2:** vault
     - Root Directory: `packages/apps/vault`

2. Set environment variables in each project (see "Environment Variables" section above)

3. Add `ENABLE_EXPERIMENTAL_COREPACK=1` env var to both projects
   - Allows corepack to manage pnpm 10 version

### How It Works

**`vercel.json` files:**
- Root is gone (deleted for cleaner monorepo setup)
- Each app has `packages/apps/{fintracker,vault}/vercel.json`:
  ```json
  {
    "installCommand": "cd ../.. && corepack enable pnpm && pnpm install --frozen-lockfile",
    "buildCommand": "cd ../.. && pnpm --filter fintracker run build",
    "outputDirectory": ".next"
  }
  ```
- Root directory setting in Vercel UI tells build where to run from
- Build commands run from repo root (`cd ../..`) so turbo works correctly

**Corepack:** Automatically installs pnpm 10.0.0 (from `packageManager` field in package.json)
- Solves pnpm version mismatch issues

**pnpm-lock.yaml:** Committed to git (not ignored) for reproducible builds

### Verify Deployment

```bash
# Check both apps deployed
curl https://fintracker.vercel.app
curl https://vault.vercel.app

# Check pre-push hook prevents broken code
git push origin main  # Should run type-check first
```

---

## Code Patterns & Conventions

### Global CSS

**Rule:** Global CSS can ONLY be imported in `_app.tsx` or `_document.tsx`.

**Wrong (ESLint warns):**
```tsx
// ❌ Don't do this in page components
import '../styles/global.css'  // ESLint: no-restricted-imports warn
```

**Right:**
```tsx
// ✅ Only in _app.tsx
import '../ui-kit/ui-kit.css'
```

**Why?** Next.js requires global CSS at app level to avoid CSS injection vulnerabilities. Page-level global CSS breaks the build.

**ESLint Rule:** `eslint-config/index.js` has `no-restricted-imports: ['warn', { patterns: ['*.css'] }]`

### Shared Components

Import from `@fintracker-vault/ui`:
```tsx
import { AppAuthGate, Nav, KpiCard, FormField } from '@fintracker-vault/ui'
```

Components are built with tsup (ESM + CJS) and declared in `transpilePackages`.

### TypeScript Paths

Use aliases from root `tsconfig.json`:
```tsx
// ✅ Use aliases
import type { GoldRow } from '@fintracker-vault/types'
import { INR } from '@fintracker-vault/utils'

// ❌ Avoid relative paths across packages
import type { GoldRow } from '../../../packages/shared/types/src'
```

### Env Config

Always use `next.config.js` to resolve env vars, not direct `process.env` in components:
```tsx
// In next.config.js: resolves env via resolve-google-env.cjs
const clientEnv = {
  NEXT_PUBLIC_API_URL: process.env.VITE_API_URL || '/gas-proxy',
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: resolvedGoogleClientId,
}

// In components: read from process.env (webpack-defined by Next.js)
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

---

## Agent Guidelines

### When Working on This Repo

✅ **DO:**
- Run `pnpm type-check` before committing (pre-push hook will catch you otherwise)
- Import shared packages via `@fintracker-vault/*` aliases
- Keep global CSS in `_app.tsx` only
- Use `packages/apps/{fintracker,vault}/.env.local` for local auth testing
- Test both apps: `pnpm dev` + visit `http://localhost:3000` and `http://localhost:3001`
- Run `pnpm dev:fresh` to clear caches if you hit stale state issues

❌ **DON'T:**
- Import global CSS in page components (ESLint warns)
- Commit `.env.local` files (ignored by git)
- Add new planning/documentation files at root level (use inline comments or keep docs in CLAUDE.md)
- Remove `transpilePackages` from `next.config.js` (breaks shared package imports)
- Use relative imports across packages (use workspace aliases instead)
- Bypass pre-push hook by using `git push --no-verify` (defeats the purpose)

### Common Issues & Fixes

**Issue:** "Cannot find module '@fintracker-vault/ui'"
- Cause: shared package isn't in `transpilePackages` list
- Fix: Add to both `packages/apps/fintracker/next.config.js` and `packages/apps/vault/next.config.js`

**Issue:** Stale build state, weird errors
- Fix: `pnpm dev:fresh` (kills ports, clears caches, reinstalls, restarts)

**Issue:** Auth not working locally
- Check: `.env.local` has `VITE_GOOGLE_CLIENT_ID` set
- Check: Google Cloud Console has `http://localhost:3000` + `http://localhost:3001` in OAuth authorized origins
- Check: `VITE_ALLOWED_EMAILS` includes your Google account email

**Issue:** Vercel build fails with "Cannot find .next"
- Cause: `outputDirectory` path mismatch or build command failed
- Fix: Check app's `vercel.json` has correct `buildCommand` and `outputDirectory`

---

## Future Work

- Wire up `@fintracker-vault/eslint-config` to both apps (currently unused)
- Add more shared components to `@fintracker-vault/ui` (code dedup)
- Set up CI/CD: GitHub Actions for PR checks, Vercel auto-deploy on merge
- Consider moving away from pages router to app router (performance gains)

---

**Last Updated:** Apr 18, 2026  
**Maintainer:** Arun Kumar  
**Questions?** See this CLAUDE.md for architecture/patterns, or check git log for recent changes.
