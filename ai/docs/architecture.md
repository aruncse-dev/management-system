# Architecture Overview

## Monorepo structure

Turborepo + pnpm workspaces. Three main Next.js 14 (pages router) applications share a set of published-but-local packages.

```
packages/
├── apps/
│   ├── fintracker/    # expense, investments, gold, loans, subscriptions (port 3000)
│   ├── vault/         # insurance, passwords, documents, health (port 3001)
│   ├── staff/         # attendance calendar, staff management (port 3002)
│   └── admin/         # org/user/integration management (port 3003)
└── shared/
    ├── db/            # Drizzle ORM, migrations, DB queries
    ├── auth/          # iron-session, Google OAuth, middleware
    ├── ui/            # shared React components (KpiCard, SectionBlock, etc.)
    ├── config/        # app menus, env helpers
    ├── types/         # shared TypeScript types
    └── utils/         # formatters, calculators, validators
```

---

## Multi-tenancy

All data is **org-scoped** via the `organizations` table:

- Every user is a member of one or more orgs
- Session holds `session.activeOrgId`
- Every API query includes `orgId` — no cross-org data leaks

Per-org config stored in JSONB:
- `enabled_apps` — list of apps this org can access (`["fintracker", "vault"]`)
- `enabled_menus` — per-app enabled menu slugs (`{"fintracker": ["dashboard", "savings"]}`)
- `enabled_integrations` — integration setup flags (`{"upstox": true}`)
- `settings` — arbitrary org-level config

---

## Single API dispatcher per app

Each app has **one** Next.js API route: `src/pages/api/index.ts`

Reads use `?module=<name>` query param; mutations use `{ action: "...", ...data }` POST body. The dispatcher switches on module/action and calls the appropriate handler.

**Example:** fintracker's `src/lib/fintrackerMainApi.ts` handles:  
`settings` | `vault` | `stocks` | `lending` | `savings` | `gold` | `loans` | `insurance` | `subscriptions` | `mutualfunds`

---

## Shared UI patterns

All pages follow consistent patterns:

| Pattern | Implementation |
|---|---|
| **Section** | `<SectionBlock>` component wrapper |
| **List rows** | Consistent left icon + title + right value layout |
| **FAB** | `position: fixed bottom-20 right-4`, opens modal |
| **Forms** | Label above input, `input` CSS class from `ui-kit.css` |
| **Delete confirmation** | `<ConfirmDialog>` before any destructive action |
| **Modals** | `<ModalShell>` + `<ModalActions>` |
| **Dashboards** | `<KpiGrid>` with `<KpiCard>` metric cards |

See `ai/skills/ui-patterns.md` for full patterns.

---

## Auth flow

**Google OAuth** (fintracker, vault, staff):
1. Google sign-in → ID token → `POST /api/auth/google`
2. Verify JWT via JWKS
3. Check user exists in `users` table (not suspended)
4. Set session with email + `activeOrgId`

**PIN auth** (admin, local dev):
1. `POST /api/auth/verify-pin` with 4-digit code
2. Resolve email from `PIN_SESSION_EMAIL` env or first `role='admin'` user
3. Set session

Session cookies are per-app: `ft_session_fintracker`, `ft_session_vault`, `ft_session_staff`, `ft_session_admin`.

See `ai/skills/auth-patterns.md`.

---

## Database

**Schema definition:** Drizzle ORM TypeScript files in `packages/shared/db/src/schema/` (13 domains)

**Migration workflow:** Write `.sql` files, run locally, update Drizzle TS schema, regenerate `schema.sql` snapshot.

| Domain | Tables | Owned by |
|---|---|---|
| Users & auth | `users`, `org_members`, `organizations` | shared |
| fintracker | `transactions`, `budget`, `payment_sources`, `savings`, `lending`, `gold_*`, `cash_loans`, `emi_loans`, `jewel_loans`, `subscriptions` | fintracker |
| vault | `vault_apps`, `banking_records`, `insurance`, `persons` | vault |
| staff | `attendance`, `staff_members` | staff |
| portfolio | `mutual_funds`, `stocks`, `gold_items` | fintracker |
| integrations | `integration_providers`, `org_integrations` | admin/shared |
| system | `schema_migrations` | shared |

See `ai/docs/schema-diagram.md` for ERD with relationships.

---

## Environment variables

**Required per app:**
- `SESSION_SECRET` — 32+ char random; encrypts iron-session cookie
- `DATABASE_URL` — Neon Postgres connection
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID
- `VITE_ALLOWED_EMAILS` — (vault/staff only) comma-separated allowlist

**Merge order:**
```
repo .env → repo .env.local → web/.env → packages/apps/<app>/.env.local → shell/Vercel
```

See `ai/skills/google-oauth-env.md` for detailed OAuth env rules.

---

## Caching pattern

GET endpoints that are slow use in-memory process-level caching:

```ts
const CACHE = { data: null, at: 0 }
const TTL = 5 * 60 * 1000  // 5 minutes

function invalidateCache() { CACHE.data = null }
```

Call `invalidateCache()` inside every POST handler that mutates the data. Example in `packages/apps/fintracker/src/pages/api/index.ts`.

---

## Cross-package imports

Always use `@fintracker-vault/*` aliases:

```ts
import { getDb } from '@fintracker-vault/db'
import { KpiCard } from '@fintracker-vault/ui'
import { useFormatMoney } from '@fintracker-vault/utils'
```

Never use relative paths across package boundaries.

---

## Build & deploy

**Type-check (required before PR):**
```bash
pnpm type-check
```

**Build all apps:**
```bash
pnpm build
```

**Shared packages:** After editing `@fintracker-vault/ui` or `@fintracker-vault/auth`, rebuild them before running apps:
```bash
pnpm --filter @fintracker-vault/ui build
pnpm --filter @fintracker-vault/auth build
```

---

## Related

- `ai/skills/` — detailed implementation guides
- `ai/docs/migrations.md` — schema change workflow
- `README.md` — setup and deployment to Vercel
