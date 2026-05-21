# Monorepo Guidelines

Turborepo + pnpm workspaces. All packages under `packages/`.

---

## Package structure

```
packages/
  apps/
    fintracker/   # expense tracking, investments, gold, loans, subscriptions (port 3000)
    vault/        # insurance, passwords, documents, health (port 3001)
    staff/        # attendance, staff management (port 3002)
    admin/        # org/user/integration management (port 3003)
  shared/
    db/           # @fintracker-vault/db  — Drizzle ORM + all DB query helpers
    auth/         # @fintracker-vault/auth — iron-session, Google OAuth, middleware
    ui/           # @fintracker-vault/ui  — shared React components
    config/       # @fintracker-vault/config — app menus catalog, env helpers
    utils/        # @fintracker-vault/utils — formatters, calculators, validators
    types/        # @fintracker-vault/types — shared domain TypeScript types
  tools/
    configs/eslint-config
    scripts/
```

---

## Cross-package imports

Always use `@fintracker-vault/*` aliases — never relative paths that cross package boundaries:

```ts
// Good
import { getDb } from '@fintracker-vault/db'
import { KpiCard } from '@fintracker-vault/ui'

// Bad
import { getDb } from '../../../shared/db/src'
```

Aliases are defined in the root `tsconfig.json`.

---

## Building shared packages

After editing `@fintracker-vault/ui` or `@fintracker-vault/auth`, rebuild before running apps:

```bash
pnpm --filter @fintracker-vault/ui build
pnpm --filter @fintracker-vault/auth build
```

Consumers import from `dist/` — stale builds cause silent runtime errors.

---

## Adding a new Next.js app

1. Copy `next.config.js` from an existing app — especially `getGoogleAuthEnv(__dirname)` and `transpilePackages`
2. List every `@fintracker-vault/*` package consumed in `transpilePackages`
3. Mirror `experimental.outputFileTracingRoot` from existing apps
4. Create `middleware.ts` using `createFtMiddleware()` from `@fintracker-vault/auth/middleware`
5. Add a `dev:<app>` script to root `package.json`

---

## Global CSS rule

Only import or define global CSS in:
- `src/pages/_app.tsx`
- `src/pages/_document.tsx`

Never add `@import` or global styles inside page components or layout files.

---

## Type-check before pushing

```bash
pnpm type-check
```

Run from repo root. Must pass before opening a PR. Covers all apps and packages.
