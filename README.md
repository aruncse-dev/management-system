# FinTracker & Vault

Two personal finance apps built with **Next.js 14** + **Google Sheets** (via Google Apps Script). Deployed to Vercel.

- **FinTracker** — Financial tracking: monthly expenses, gold, investments, loans, savings
- **Vault** — Secure storage: insurance, passwords, documents

Both apps share UI components via a pnpm monorepo. Backend runs on Google Apps Script, frontend on Vercel.

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

Create `packages/apps/fintracker/.env.local` and `packages/apps/vault/.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=your-oauth-client-id
VITE_GAS_URL=https://script.google.com/macros/s/...your-gas-url.../exec
VITE_API_TOKEN=your-gas-api-token
VITE_ALLOWED_EMAILS=your@email.com
VITE_SHEET_ID=your-google-sheet-id
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
Backend (Google Apps Script)
    ├── JSON REST API (?action=...)
           ↓
    Google Sheets (your spreadsheet)
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
| Backend | Google Apps Script (JSON API) |
| Database | Google Sheets |
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
   - `VITE_GAS_URL`
   - `VITE_API_TOKEN`
   - `VITE_ALLOWED_EMAILS`
4. Enable corepack: Set `ENABLE_EXPERIMENTAL_COREPACK=1`

---

## Key Features

- **Google OAuth** — Sign in with Google, email-based access control
- **Idle timeout** → PIN lock after 1 hour of inactivity
- **Real-time sync** — Data synced to Google Sheets automatically
- **Responsive design** — Mobile-optimized with Tailwind CSS
- **Shared components** — Code reuse via monorepo pattern
- **TypeScript** — Full type safety across all packages

---

## FAQ

**Q: Is my data secure?**
- A: Data lives in your Google Sheets (you own it). Auth is simplified for personal use. See [CLAUDE.md](./CLAUDE.md) for security details.

**Q: Can I customize account names?**
- A: Yes. Modify `gas/Code.gs` (backend) and `packages/apps/*/src/constants.ts` (frontend).

**Q: How do I redeploy Google Apps Script?**
- A: `./deploy.sh` (requires clasp login). See `gas/SETUP.md` for details.

**Q: How do I add a new page?**
- A: Create a file in `packages/apps/fintracker/src/pages/` (or vault). Next.js auto-routes it.

---

## More Info

- **Architecture & Code Guidelines:** [CLAUDE.md](./CLAUDE.md)
- **GAS Setup:** [gas/SETUP.md](./gas/SETUP.md)

---

## License

MIT
