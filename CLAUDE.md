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
│   ├── auth/                    # iron-session + /api/auth/* handlers + middleware factory
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
3. `AppAuthGate.tsx` — Lock screen with Google OAuth or PIN (after 1h idle timeout); Google credential is **POST**ed to `/api/auth/google`, which verifies JWT **on the server** and sets an **HttpOnly** iron-session cookie (`ft_session_fintracker` / `ft_session_vault` / `ft_session_staff`)
4. `clientAuthEnv.ts` — Reads auth config from `process.env` (auto-loaded from `.env.local`)
5. `middleware.ts` — Uses `@fintracker-vault/auth/middleware` to gate non-public routes and `/api/gas-proxy` behind the session cookie

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
| `auth/` | Session options, `/api/auth/*` handlers, `createFtMiddleware` | Shared server auth for all Next apps |
| `config/` | Env config, domain mapping, constants | Imported in both apps |
| `types/` | TypeScript interfaces (GoldRow, etc.) | Shared data structures |
| `ui/` | React components (AppAuthGate, Nav, KpiCard, etc.) | Built with tsup (ESM + CJS) |
| `utils/` | `formatINR()`, `calculateReturn()`, validators | Shared logic |

**Transpiling:** Apps list every consumed `@fintracker-vault/*` package in **`transpilePackages`** in `next.config.js` (including **`@fintracker-vault/auth`**) so shared TS is compiled during the app build.

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
SESSION_SECRET=<32+-char-random-string>   # Required for login + session cookie + gated gas-proxy (see packages/apps/<app>/.env.local.example)
VITE_GOOGLE_CLIENT_ID=<your-oauth-client-id>
VITE_GAS_URL=https://script.google.com/macros/s/...
VITE_API_TOKEN=<gas-api-token>
VITE_ALLOWED_EMAILS=your@email.com
VITE_API_URL=/gas-proxy           # Proxied by Next.js
APP_PASSWORD=                     # Optional: 4-digit PIN (server-only; preferred over VITE_APP_PASSWORD)
PIN_SESSION_EMAIL=                # Optional: email to bind when using PIN without a prior Google session (see Authentication Model)
VITE_SHEET_ID=                    # Optional: GAS spreadsheet ID
```

**Important:**
- Each app reads from its own `.env.local` (Next.js auto-loads before build)
- **`SESSION_SECRET`**: minimum **32 characters**; without it, `/api/auth/google` and other auth routes return errors, `/api/gas-proxy` returns **503**, and in **development** the middleware logs a console error (see `.cursor/rules/google-oauth-env.mdc`).
- `VITE_GOOGLE_CLIENT_ID` must be registered in Google Cloud Console with your localhost origins
- `.env.local` files are gitignored and never committed
- If **`APP_PASSWORD`** / `VITE_APP_PASSWORD` is not set, PIN lock is disabled (safe default)

### Vercel Deployment

Set in each Vercel project's **Settings → Environment Variables**:

```
SESSION_SECRET = <32+-char-random-string>
VITE_GOOGLE_CLIENT_ID = <your-oauth-client-id>
VITE_GAS_URL = https://script.google.com/macros/s/...
VITE_API_TOKEN = <gas-api-token>
VITE_ALLOWED_EMAILS = your@email.com
APP_PASSWORD = <optional 4-digit PIN>
```

- Vercel injects these via `process.env` during build
- No need for `.env.local` on Vercel (ignored anyway)

---

## Authentication Model

### How It Works

1. User visits app → sees lock screen with Google "Sign In" or PIN (after idle)
2. Google: client obtains a credential JWT → **`POST /api/auth/google`** verifies it with Google’s JWKS, checks allowlist, sets **HttpOnly** iron-session cookie (`email`, `authedAt`)
3. PIN (idle lock): **`POST /api/auth/verify-pin`** checks **`APP_PASSWORD`** (or `VITE_APP_PASSWORD`); if the session already has `email`, it refreshes `authedAt`; otherwise it binds **`PIN_SESSION_EMAIL`** or, if unset, the **first** entry in **`ALLOWED_EMAILS` / `VITE_ALLOWED_EMAILS`** (documented in `@fintracker-vault/auth` — for **multiple** allowlisted users, set **`PIN_SESSION_EMAIL`** explicitly)
4. **`GET /api/auth/session`** drives `AppAuthGate` unlock state; **`localStorage.ft_last_active`** / **`ft_lock_mode`** still control the **idle PIN layer** in the browser
5. **`middleware.ts`** requires a session for non-public pages and for **`/gas-proxy`** / **`/api/gas-proxy`**

### Deploy / upgrade note (legacy client keys)

Older builds stored **`ft_google_authed`** and relied on client-only checks. After server sessions ship, **users sign in once again** (Google or PIN) so the HttpOnly cookie is issued. There is **no** automatic migration from old localStorage JWT or cookies into the new session.

### Security Model

**Defense in depth (current):**

- GAS and **`/api/gas-proxy`** are gated by the **server session** + **`VITE_API_TOKEN`** injected only on the server
- Google allowlist is enforced in **`POST /api/auth/google`**, not only in the client bundle

**Residual client surface:**

- `window.__FT_AUTH_ENV` still exposes allowlist-related config for the Google button UX
- A determined local attacker could still tamper with client JS; treat the lock screen as **casual access control**, not a hardened perimeter

**Real Data Security:**

- The GAS API (`VITE_GAS_URL`) is the actual backend — data lives there
- API token (`VITE_API_TOKEN`) is the real secret; keep it safe in Vercel
- For a personal app (single user), this model is acceptable

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

### Tags & GitHub Releases

**Version source of truth:** Root `package.json` `version` (semver `x.y.z`). The three Next apps (`fintracker`, `vault`, `staff`) use the **same** `version` when cutting a release.

**Git tag:** Annotated tag `v` + semver (e.g. `v1.1.0`). The tag must match root `package.json` on the commit you tag (usually `main` after the version bump merges).

**Release workflow**

1. Bump: `pnpm release:bump patch` (or `minor` / `major`). Commits the root + three app `package.json` files—open a PR or commit on `main` as you prefer.
2. Tag: On updated `main`, run `pnpm release:tag --push`. This creates the annotated tag and pushes it to `origin`.
3. **Automation:** [`.github/workflows/release.yml`](.github/workflows/release.yml) runs on pushes to tags matching `v*.*.*` and creates a **GitHub Release** with auto-generated notes (default `GITHUB_TOKEN`).

**Scripts:** [`packages/tools/scripts/release-bump.mjs`](packages/tools/scripts/release-bump.mjs), [`packages/tools/scripts/release-tag.mjs`](packages/tools/scripts/release-tag.mjs).

**Legacy tags:** Some older tags may use `vYYYYMMDD`; they do not trigger the semver release workflow. Prefer `vX.Y.Z` for app releases.

**Note:** Do not bump `packages/shared/*` `version` for app-only releases unless you are actually publishing those packages.

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

### GAS Data Caching (`_getCachedSheetData`)

**Helper function** in `gas/Code.gs` (lines 40-56) caches sheet data with 5-minute TTL to eliminate full table scans on every API request.

**Usage:**
```javascript
// In module GET handlers (lending, savings, gold, etc.)
const vals = _getCachedSheetData(sheetName, 'cache_key_' + sheetName);
// ... process vals and return formatted data

// In mutations (add/update/delete), invalidate cache:
CacheService.getScriptCache().remove('cache_key_' + sheetName);
```

**Sheet ID Mapping** (auto-detected in `_getCachedSheetData`):
- `'Monthly'` → `EXPENSES_SHEET_ID` (main budget sheets)
- `'Attendance'` → `STAFF_ATTENDANCE_SHEET_ID` (staff module)
- All others (Savings, Bommi, Lending, Gold, Subscriptions, etc.) → `ASSETS_SHEET_ID`

**Date Handling** (critical for cached data):
When data is cached via `JSON.stringify()`, Date objects become ISO strings. After `JSON.parse()`, they stay as strings. **Always convert back to Date objects before formatting:**
```javascript
// ❌ WRONG: Shows raw "2026-04-29T10:30:00.000Z"
date: _fmtDate(r[COL.DATE])

// ✅ RIGHT: Shows formatted "29-Apr-26"
date: _fmtDate(typeof r[COL.DATE] === 'string' ? new Date(r[COL.DATE]) : r[COL.DATE])
```

Applied in: `savings.gs` line 127, `lending.gs` line 169, `gold.gs` line 377.

**Performance Impact:**
- First request: ~2-5s (full sheet scan)
- Cached requests: ~0.1-0.2s (10-50x faster)
- Post-mutation: Cache cleared, next request is full scan, then cached again

---

## Developer and agent playbook

**Human developers:** use this as a checklist. **AI agents:** follow it unless the user overrides; also read root **`AGENTS.md`** for a short invariant list.

### Adding a new Next.js app under `packages/apps/<name>/`

1. **Scaffold** — Copy the closest existing app (`fintracker`, `vault`, or `staff`): `package.json`, `next.config.js`, `tsconfig.json`, `src/pages/_app.tsx`, `_document.tsx`, `middleware.ts` (if you need URL normalization), `vercel.json`, `public/` favicons + `manifest.json`.
2. **`next.config.js`**
   - Require `../resolve-google-env.cjs` and call **`getGoogleAuthEnv(__dirname)`** so client IDs and allowed emails match the rest of the monorepo (see `.cursor/rules/google-oauth-env.mdc`).
   - Set **`experimental.outputFileTracingRoot`** to the monorepo root (same pattern as existing apps).
   - List every shared package you import in **`transpilePackages`** (e.g. `@fintracker-vault/auth`, `@fintracker-vault/ui`, `types`, `config`, `utils`).
   - Add **`rewrites()`** for `/gas-proxy` if the app talks to GAS via the proxy (same as fintracker/vault/staff).
3. **`package.json`**
   - Unique **`name`** (used by `pnpm --filter`).
   - **`dev`** script with a free port; **`predev`** should run **`pnpm --filter @fintracker-vault/ui run build && pnpm --filter @fintracker-vault/auth run build`** so `dist/` is current (same as existing apps).
4. **Root `package.json`** — Add **`dev:<name>`** / **`build:<name>`** / **`dev:<name>:fresh`** scripts for discoverability (match existing naming).
5. **Workspace** — `pnpm-workspace.yaml` already includes `packages/apps/*`; run `pnpm install` at root after adding the folder.
6. **Auth** — Add **`@fintracker-vault/auth`** as a dependency; copy **`src/lib/session.ts`** (set a unique **`ft_session_<app>`** cookie name), **`middleware.ts`** (import **`createFtMiddleware`** from **`@fintracker-vault/auth/middleware`** so the Edge bundle does not include **`jose`**), and **`src/pages/api/auth/*`** from an existing app. Set **`moduleResolution`: `"bundler"`** in the app **`tsconfig.json`** if you use the **`/middleware`** subpath (matches fintracker/vault/staff). If the app uses **`AppAuthGate`**: inject **`window.__FT_AUTH_ENV`** from `_document.tsx`, add **`clientAuthEnv.ts`**, and pass **`appKind`** in `_app.tsx`. If you add a new **`appKind`**, update **`AppAuthGate`** in `packages/shared/ui`.
7. **Vercel** — New project, root directory `packages/apps/<name>`, env vars aligned with other apps, **`ENABLE_EXPERIMENTAL_COREPACK=1`**, `vercel.json` **`buildCommand`** using `pnpm --filter <package-name> run build`.

### Adding a new page (pages router)

1. Add **`src/pages/<route>.tsx`** (or nested dynamic routes under `src/pages/...`).
2. **Do not** import global CSS (`*.css` site-wide files) from the page — only from **`_app.tsx`** / **`_document.tsx`**.
3. Prefer **`@fintracker-vault/ui`** for shared primitives (`AppAuthGate`, `Nav`, `SimpleAppNav`, `LoadingState`, `SectionBlock`, forms, etc.). Apps may re-export via a local **`src/ui.tsx`** (`export * from '@fintracker-vault/ui'`) for shorter imports.
4. Match **layout and typography** of sibling pages in the same app (e.g. `ui-kit-page-shell`, `monthly-wrap`, `attendance-main`, `with-app-shell`) so navigation and padding stay consistent.
5. **Titles / meta** — Set `<Head>` in the page or centralize in `_app.tsx` if the pattern is per-route (see staff `VAULT_PAGE_TITLES`-style maps).

**Tab-based pages** (Dashboard + Management pattern):
- See `subscriptions.tsx` for reference — two-tab layout with `.bottom-nav` + `.bottom-nav-item` CSS classes (reused from Savings/Investments)
- Tab 1: Dashboard with `<KpiGrid>` + `<KpiCard>` metrics + summary list
- Tab 2: Search/filter UI + full list with CRUD modals
- Use `useState` for tab state and modal visibility; use `useMemo` for derived stats (filtered lists, totals)

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

## Recent Improvements (Apr 29, 2026)

✅ **Completed:**
- GAS caching with CacheService (5-min TTL) — 10-50x faster API responses
- Weekly Google Sheets auth refresh via time-based triggers — no more 401 errors
- Subscriptions feature with tab-based UI, KPI dashboard, USD→INR conversion
- Date deserialization fix for cached data (JSON.stringify gotcha)
- Sheet ID mapping in caching helper (EXPENSES_SHEET_ID, ASSETS_SHEET_ID, STAFF_ATTENDANCE_SHEET_ID)

⏳ **Next (if needed):**
- Apply same caching pattern to staff.gs (getDataRange calls on lines 128, 163, 238, 271)
- Wire up `@fintracker-vault/eslint-config` to both apps (currently unused)
- Add more shared components to `@fintracker-vault/ui` (code dedup)
- Set up CI/CD: GitHub Actions for PR checks, Vercel auto-deploy on merge
- Consider moving away from pages router to app router (performance gains)

---

**Last Updated:** Apr 29, 2026  
**Maintainer:** Arun Kumar  
**Memory:** See `memory/MEMORY.md` for indexed reference docs (caching patterns, subscriptions feature, gotchas).  
**Questions?** See this CLAUDE.md for architecture/patterns, memory files for implementation details, or check git log for recent changes.
