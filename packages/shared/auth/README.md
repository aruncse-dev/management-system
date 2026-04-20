# @fintracker-vault/auth

Shared **iron-session** options, Google/PIN API route handlers, and **Next.js middleware** helpers for the three apps. Each app keeps a tiny `src/lib/session.ts` (distinct session cookie name per app) and thin `pages/api/auth/*` re-exports. **`middleware.ts`** imports from **`@fintracker-vault/auth/middleware`** so the Edge bundle does not pull **`jose`** (Google JWT verification stays in API routes only).

After changing this package, run `pnpm --filter @fintracker-vault/auth run build` (or rely on each app’s `predev`, which builds UI + auth).
