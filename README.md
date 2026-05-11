# FinTracker & Vault

Three apps in a monorepo built with **Next.js 14** and shared packages, now migrating to **Neon Postgres + Next.js API** backend.

- **FinTracker** — Financial tracking: monthly expenses, gold, investments, loans, savings
- **Vault** — Secure storage: insurance, passwords, documents
- **Staff** — Staff attendance (port 3002)

All apps share UI/components via a pnpm monorepo. Frontend + API deploy to **Vercel**; database is **Neon Postgres**. Google Apps Script has been **removed** from this repo (see [docs/gas-recovery.md](./docs/gas-recovery.md) for legacy snapshots only).

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 10.x
- A [Neon](https://neon.tech) project and **connection string** (`DATABASE_URL`)

### FinTracker + platform admin + Neon (local)

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Configure FinTracker** — copy [packages/apps/fintracker/.env.local.example](./packages/apps/fintracker/.env.local.example) to `packages/apps/fintracker/.env.local` and set at minimum:
   - **`SESSION_SECRET`** — 32+ random characters (e.g. `openssl rand -base64 32`)
   - **`VITE_GOOGLE_CLIENT_ID`** — OAuth Web client ID (see `.cursor/rules/google-oauth-env.mdc`)
   - **`DATABASE_URL`** — Neon Postgres URL (`postgresql://...`)
   - **`VITE_ALLOWED_EMAILS`** — comma-separated emails allowed to sign in (vault/staff still use this in `next.config`; fintracker auth is DB-aware but allowlist remains useful for other apps)
   - **`ADMIN_EMAILS`** — your Google email → platform admin (`/admin`, orgs, users)

3. **Apply database schema** (creates tables in Neon). From repo root:
   ```bash
   export DATABASE_URL="postgresql://..."
   pnpm --filter @fintracker-vault/db run drizzle:push
   ```
   Schema is defined in `packages/shared/db/src/schema` and applied with `drizzle:push`. After changing schema files, run `pnpm --filter @fintracker-vault/db run export-schema` (updates **`packages/shared/db/migrations/schema.sql`** — full CREATE DDL). For existing DBs that lag behind, use root **`migration.sql`** (ALTER-only) or `drizzle:push`. See [docs/neon-schema-migrations.md](./docs/neon-schema-migrations.md).

4. **Run FinTracker**
   ```bash
   pnpm dev:fintracker
   ```
   Open [http://localhost:3000](http://localhost:3000), sign in with Google.

5. **Platform admin app** (separate package, port **3003**) — copy `packages/apps/admin/.env.local.example` to `packages/apps/admin/.env.local` (same `SESSION_SECRET`, `DATABASE_URL`, Google keys, `ADMIN_EMAILS` as FinTracker). Then:
   ```bash
   pnpm dev:admin
   ```
   - [http://localhost:3003/admin/orgs](http://localhost:3003/admin/orgs) — organizations, members, per-app menus
   - [http://localhost:3003/admin/users](http://localhost:3003/admin/users) — global users
   - Apps / menu sections / menu catalog: `/admin/apps`, `/admin/sections`, `/admin/menus`

### Other apps locally

```bash
pnpm dev:vault    # http://localhost:3001
pnpm dev:staff    # http://localhost:3002
```

Use each app’s `.env.local.example` as a template. Set **`SESSION_SECRET`**, **`VITE_GOOGLE_CLIENT_ID`**, **`DATABASE_URL`**, and **`VITE_ALLOWED_EMAILS`** as needed.

### Env naming (trimmed)

| Variable | Scope | Purpose |
|----------|--------|---------|
| `SESSION_SECRET` | Server | Iron-session cookie encryption |
| `VITE_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Client + server | Google Sign-In (mirrored in `next.config`) |
| `VITE_ALLOWED_EMAILS` / `ALLOWED_EMAILS` | Server (+ client mirror in vault/staff) | Sign-in allowlist where enforced |
| `DATABASE_URL` | Server only | Neon connection string |
| `ADMIN_EMAILS` | Server only | FinTracker platform admins |
| `NEXT_PUBLIC_API_URL` | Client | API base path; default **`/api`** (only set if API is on another origin) |
| `APP_PASSWORD` | Server | Optional PIN (`POST /api/auth/verify-pin`) |
| `PIN_SESSION_EMAIL` | Server | Optional PIN-only session email |

Removed / obsolete: **`VITE_GAS_URL`**, **`VITE_API_TOKEN`**, **`GAS_EXEC_URL`**, **`NEXT_PUBLIC_GAS_URL`**, **`VITE_API_URL`** (for default same-origin API).

### Monorepo dev shortcuts

```bash
pnpm dev              # all apps (turbo)
pnpm dev:fresh        # kill ports, clear caches, then dev
```

(`.env.local` files are gitignored — never committed)

---

## Architecture

```
Frontend (Next.js 14, Vercel)
    ├── fintracker/   (pages router, port 3000)
    ├── vault/        (pages router, port 3001)
    └── staff/        (pages router, port 3002)
           ↓
    Shared packages (@fintracker-vault/*)
    ├── config/       (constants, env config)
    ├── types/        (TypeScript interfaces)
    ├── ui/           (React components, AppAuthGate)
    └── utils/        (formatters, validators)
           ↓
Backend (Next.js API + Neon Postgres)
    ├── API routes in each app
    └── Shared schema package: @fintracker-vault/db
```

**See [CLAUDE.md](./CLAUDE.md) for full architecture, code guidelines, and development tips.**

---

## Tech Stack

| Component | Tech |
|-----------|------|
| Frontend Apps | Next.js 14 (pages router) |
| UI Components | React 18 + Tailwind CSS |
| Shared Packages | TypeScript, tsup |
| Build Tool | Turborepo (monorepo orchestration) |
| Auth | Google OAuth 2.0 |
| Backend | Next.js API Routes |
| Database | Neon PostgreSQL |
| Deployment | Vercel (auto-deploy on push) |

---

## Development Commands

```bash
pnpm dev                    # Start both apps
pnpm dev:fintracker        # Start fintracker only
pnpm dev:vault             # Start vault only
pnpm dev:fresh             # Fresh restart (kill ports, clear cache)

pnpm build                  # Build all apps
pnpm type-check             # TypeScript validation
pnpm lint                   # ESLint
pnpm format                 # Prettier

pnpm kill-ports             # Kill ports 3000–3002
pnpm clean:cache            # Clear .next + .turbo
pnpm clean                  # Full clean (node_modules + .turbo + .next)
```

---

## Deployment

Both apps deploy to Vercel automatically on push to `main`.

**Setup (one-time):**
1. Create two Vercel projects (fintracker + vault)
2. Set Root Directory: `packages/apps/fintracker` (or `vault`)
3. Add environment variables in Vercel project settings:
   - `VITE_GOOGLE_CLIENT_ID`
   - `DATABASE_URL`
   - `VITE_ALLOWED_EMAILS`
   - `ADMIN_EMAILS` (fintracker admin panel)
4. Enable corepack: Set `ENABLE_EXPERIMENTAL_COREPACK=1`

---

## Key Features

- **Google OAuth** — Sign in with Google, email-based access control
- **Idle timeout** → PIN lock after 1 hour of inactivity
- **Server-backed auth** — Google login + server session controls API access
- **Responsive design** — Mobile-optimized with Tailwind CSS
- **Shared components** — Code reuse via monorepo pattern
- **TypeScript** — Full type safety across all packages

---

## FAQ

**Q: Is my data secure?**
- A: Data lives in your DB and is protected by server-side session checks. See [CLAUDE.md](./CLAUDE.md) for security details.

**Q: Where is the old Google Apps Script code?**
- A: It is no longer in this repo. Use [docs/gas-recovery.md](./docs/gas-recovery.md) only if you need a historical copy from a git tag or zip.

**Q: How do I add a new page?**
- A: Create a file in `packages/apps/fintracker/src/pages/` (or vault). Next.js auto-routes it.

---

## More Info

- **Architecture & Code Guidelines:** [CLAUDE.md](./CLAUDE.md)
- **Legacy GAS notes:** [docs/gas-recovery.md](./docs/gas-recovery.md)

---

## License

MIT
