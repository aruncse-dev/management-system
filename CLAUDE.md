# FinTracker-Vault Monorepo — Architecture & Guidelines

**Status:** Production-ready monorepo deploying to Vercel (Apr 2026)

---

## Architecture Overview

**fintracker-vault** is a pnpm monorepo with **Next.js 14** apps (pages router) sharing UI/config libraries:

```
├── packages/apps/fintracker/    # Financial tracking (port 3000)
├── packages/apps/vault/         # Secure storage (port 3001)
├── packages/apps/staff/        # Staff attendance (port 3002)
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

All apps use the **pages router** (`src/pages/`), not the App Router.

**Authentication Flow:**
1. `_document.tsx` — Injects `window.__FT_AUTH_ENV` (Google client ID + allowed emails, NOT password)
2. `_app.tsx` — Wraps app in `<AppAuthGate>` (from `@fintracker-vault/ui`)
3. `AppAuthGate.tsx` — Lock screen with Google OAuth or PIN (after 1h idle timeout)
4. `clientAuthEnv.ts` — Reads auth config from `process.env` (auto-loaded from `.env.local`)

**Environment Variables:**
- Local dev: `packages/apps/{fintracker,vault,staff}/.env.local` (gitignored; each app loads its own file)
- Vercel: Set per project (Vercel UI) with the app’s root directory
- Key vars: `VITE_GOOGLE_CLIENT_ID`, `VITE_GAS_URL`, `VITE_API_TOKEN`, `VITE_ALLOWED_EMAILS`
- **Naming:** Do not introduce app-specific Google client ID env keys — see `.cursor/rules/google-oauth-env.mdc` and `packages/apps/resolve-google-env.cjs`

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
pnpm dev:staff          # staff on :3002

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

Create `packages/apps/<app>/.env.local` (e.g. `fintracker`, `vault`, `staff`):

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
- Each app reads from its own `.env.local` (Next.js auto-loads before build)
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

1. Create a Vercel project per deployed app (https://vercel.com/new), for example:
   - **fintracker** — Root Directory: `packages/apps/fintracker`
   - **vault** — Root Directory: `packages/apps/vault`
   - **staff** (if deployed) — Root Directory: `packages/apps/staff`

2. Set environment variables in each project (see "Environment Variables" section above)

3. Add `ENABLE_EXPERIMENTAL_COREPACK=1` env var to each project
   - Allows corepack to manage pnpm 10 version

### How It Works

**`vercel.json` files:**
- Root is gone (deleted for cleaner monorepo setup)
- Each deployed app has `packages/apps/<app>/vercel.json` (adjust `buildCommand` filter name to match the app’s `package.json` `name`, e.g. `fintracker`, `vault`, `staff`):
  ```json
  {
    "installCommand": "cd ../.. && corepack enable pnpm && pnpm install --frozen-lockfile",
    "buildCommand": "cd ../.. && pnpm --filter <app-package-name> run build",
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

## Developer and agent playbook

**Human developers:** use this as a checklist. **AI agents:** follow it unless the user overrides; also read root **`AGENTS.md`** for a short invariant list.

### Adding a new Next.js app under `packages/apps/<name>/`

1. **Scaffold** — Copy the closest existing app (`fintracker`, `vault`, or `staff`): `package.json`, `next.config.js`, `tsconfig.json`, `src/pages/_app.tsx`, `_document.tsx`, `middleware.ts` (if you need URL normalization), `vercel.json`, `public/` favicons + `manifest.json`.
2. **`next.config.js`**
   - Require `../resolve-google-env.cjs` and call **`getGoogleAuthEnv(__dirname)`** so client IDs and allowed emails match the rest of the monorepo (see `.cursor/rules/google-oauth-env.mdc`).
   - Set **`experimental.outputFileTracingRoot`** to the monorepo root (same pattern as existing apps).
   - List every shared package you import in **`transpilePackages`** (e.g. `@fintracker-vault/ui`, `types`, `config`, `utils`).
   - Add **`rewrites()`** for `/gas-proxy` if the app talks to GAS via the proxy (same as fintracker/vault/staff).
3. **`package.json`**
   - Unique **`name`** (used by `pnpm --filter`).
   - **`dev`** script with a free port; many apps use **`predev`** to run `pnpm --filter @fintracker-vault/ui run build` so `dist/` is current.
4. **Root `package.json`** — Add **`dev:<name>`** / **`build:<name>`** / **`dev:<name>:fresh`** scripts for discoverability (match existing naming).
5. **Workspace** — `pnpm-workspace.yaml` already includes `packages/apps/*`; run `pnpm install` at root after adding the folder.
6. **Auth** — If the app uses **`AppAuthGate`**: inject **`window.__FT_AUTH_ENV`** from `_document.tsx` (copy pattern from an existing app), add **`clientAuthEnv.ts`**, and pass **`appKind`** in `_app.tsx`. If you add a new **`appKind`**, update **`AppAuthGate`** (`brandName`, `iconAsset`, etc.) in `packages/shared/ui`.
7. **Vercel** — New project, root directory `packages/apps/<name>`, env vars aligned with other apps, **`ENABLE_EXPERIMENTAL_COREPACK=1`**, `vercel.json` **`buildCommand`** using `pnpm --filter <package-name> run build`.

### Adding a new page (pages router)

1. Add **`src/pages/<route>.tsx`** (or nested dynamic routes under `src/pages/...`).
2. **Do not** import global CSS (`*.css` site-wide files) from the page — only from **`_app.tsx`** / **`_document.tsx`**.
3. Prefer **`@fintracker-vault/ui`** for shared primitives (`AppAuthGate`, `Nav`, `SimpleAppNav`, `LoadingState`, `SectionBlock`, forms, etc.). Apps may re-export via a local **`src/ui.tsx`** (`export * from '@fintracker-vault/ui'`) for shorter imports.
4. Match **layout and typography** of sibling pages in the same app (e.g. `ui-kit-page-shell`, `monthly-wrap`, `attendance-main`, `with-app-shell`) so navigation and padding stay consistent.
5. **Titles / meta** — Set `<Head>` in the page or centralize in `_app.tsx` if the pattern is per-route (see staff `VAULT_PAGE_TITLES`-style maps).

### API module (GAS / `gas-proxy`)

Two reference implementations:

| App | Module file | Notes |
|-----|-------------|--------|
| **fintracker** (and vault’s copy) | `packages/apps/fintracker/src/api.ts` | Large surface; **`get()`** caches by default; mutations call **`invalidateCache`** for affected GET keys. |
| **staff** | `packages/apps/staff/src/api.ts` | Sends `module=staff` on GET; same **GET cache** + **localStorage** persistence + **`invalidateCache`** on writes; exposes **`api.invalidateCache`** / **`api.clearPersistentCache`**. |

**When adding or changing API helpers:**

- Use **`get()`** for read actions with **default caching** (`cache: false` only for truly uncacheable reads, e.g. live token status).
- Use **`post()`** (or fetch POST) for writes.
- After every successful mutation, **`invalidateCache({ action, params })`** for each cached GET that can change. Prefer encapsulating this **inside** `api` methods so pages stay thin.
- Keep **`makeCacheKey`** / **`PERSIST_KEY`** app-specific so caches do not collide between apps.

### Shared UI package (`@fintracker-vault/ui`)

1. Source: **`packages/shared/ui/src/`**; exports wired in **`src/components/index.tsx`** and **`src/index.ts`**.
2. After edits, run **`pnpm --filter @fintracker-vault/ui run build`** (or rely on app **`predev`**) before **`pnpm type-check`** or consuming new exports.
3. **Global styles** for shared components live in **`packages/shared/ui/src/styles/globals.css`**; apps duplicate or mirror critical rules in their own `globals.css` today — when adding new class names, update **shared** first, then sync app `globals.css` if the app does not import the shared stylesheet directly.

### Cursor rules & docs

- **Google OAuth env:** `.cursor/rules/google-oauth-env.mdc` — do not invent new client ID variable names.
- **Agent TL;DR:** root **`AGENTS.md`**.
- **Long-form architecture:** this **`CLAUDE.md`**.

Avoid piling up one-off root markdown files; prefer extending **`CLAUDE.md`** / **`AGENTS.md`** or `.cursor/rules/` when documenting conventions.

---

## Agent Guidelines

### When Working on This Repo

✅ **DO:**
- Run **`pnpm type-check`** before committing (pre-push hook will catch you otherwise).
- Import shared packages via **`@fintracker-vault/*`** aliases.
- Keep **global CSS** in **`_app.tsx`** / **`_document.tsx`** only.
- Use **`packages/apps/<app>/.env.local`** for local auth and API testing.
- Smoke-test the app(s) you touch: **`pnpm dev`** or **`pnpm dev:fintracker`** / **`dev:vault`** / **`dev:staff`** (ports **3000** / **3001** / **3002**).
- Run **`pnpm dev:fresh`** if you see stale Next or Turbo state.
- Follow the **[Developer and agent playbook](#developer-and-agent-playbook)** for new apps, pages, and API layers.

❌ **DON'T:**
- Import global CSS in page components (ESLint warns).
- Commit **`.env.local`** files.
- Add **ad-hoc** root-level documentation files for every small task — consolidate into **`CLAUDE.md`**, **`AGENTS.md`**, or **`.cursor/rules/`**.
- Remove **`transpilePackages`** from **`next.config.js`** (breaks shared package imports).
- Use relative imports **across** packages (use workspace aliases).
- Bypass the pre-push hook with **`git push --no-verify`** without a good reason.

### Common Issues & Fixes

**Issue:** "Cannot find module '@fintracker-vault/ui'" or types out of date  
- **Cause:** Package not listed in **`transpilePackages`**, or **`@fintracker-vault/ui`** **`dist/`** stale.  
- **Fix:** Add all consumed **`@fintracker-vault/*`** packages to **this app’s** `next.config.js`. Run **`pnpm --filter @fintracker-vault/ui run build`**.

**Issue:** Stale build state, weird errors  
- **Fix:** **`pnpm dev:fresh`**.

**Issue:** Auth not working locally  
- **Check:** `.env.local` has **`VITE_GOOGLE_CLIENT_ID`** (or allowed alternate names per **`resolve-google-env.cjs`**).  
- **Check:** Google Cloud OAuth **authorized JavaScript origins** include **`http://localhost:<port>`** for the app you run.  
- **Check:** **`VITE_ALLOWED_EMAILS`** includes your Google account email.

**Issue:** Vercel build fails with "Cannot find .next"  
- **Cause:** **`outputDirectory`** / **`buildCommand`** mismatch or build failed.  
- **Fix:** App’s **`vercel.json`** and Vercel project **Root Directory** must match **`packages/apps/<app>`**.

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
