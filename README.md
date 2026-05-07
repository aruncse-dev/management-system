# FinTracker & Vault

Three apps in a monorepo built with **Next.js 14** and shared packages, now migrating to **Neon Postgres + Next.js API** backend.

- **FinTracker** — Financial tracking: monthly expenses, gold, investments, loans, savings
- **Vault** — Secure storage: insurance, passwords, documents

All apps share UI/components via a pnpm monorepo. Frontend runs on Vercel.

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 10.x

### Local Development

```bash
# Install
pnpm install

# Start both apps (fintracker :3000, vault :3001)
pnpm dev

# Fresh restart (kill ports, clear caches)
pnpm dev:fresh
```

### Create `.env.local` Files

Create app `.env.local` files (fintracker / vault / staff):

```env
VITE_GOOGLE_CLIENT_ID=your-oauth-client-id
DATABASE_URL=postgresql://...your-neon-connection-string...
VITE_ALLOWED_EMAILS=your@email.com
ADMIN_EMAILS=admin@email.com
```

(`.env.local` files are gitignored — never committed)

---

## Architecture

```
Frontend (Next.js 14, Vercel)
    ├── fintracker/   (pages router, port 3000)
    └── vault/        (pages router, port 3001)
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

pnpm kill-ports             # Kill port 3000/3001
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

**Q: How do I restore the old GAS setup temporarily?**
- A: Follow [docs/gas-recovery.md](./docs/gas-recovery.md) to restore from tag or archive zip.

**Q: How do I add a new page?**
- A: Create a file in `packages/apps/fintracker/src/pages/` (or vault). Next.js auto-routes it.

---

## More Info

- **Architecture & Code Guidelines:** [CLAUDE.md](./CLAUDE.md)
- **GAS Recovery:** [docs/gas-recovery.md](./docs/gas-recovery.md)

---

## License

MIT
