# Auth Patterns

All apps use `@fintracker-vault/auth`. Do not write custom auth logic in app code.

---

## Session cookies

| App | Cookie name |
|---|---|
| fintracker | `ft_session_fintracker` |
| vault | `ft_session_vault` |
| staff | `ft_session_staff` |
| admin | `ft_session_admin` |

Sessions are encrypted with `SESSION_SECRET` (32+ char random string per app).

---

## Middleware

Every app's `middleware.ts` uses `createFtMiddleware()`:

```ts
// middleware.ts
import { createFtMiddleware } from '@fintracker-vault/auth/middleware'
export const middleware = createFtMiddleware()
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
```

Passes through: `/`, `/api/auth/*`, static assets. All other routes require an active session.

**Do not import from `@fintracker-vault/auth` in middleware** — always use the `/middleware` sub-path to avoid bundling `jose` into the Edge runtime.

---

## Auth flows

### Google OAuth (fintracker, vault, staff)
1. Client renders `<GoogleAuthCard>` → Google sign-in → ID token sent to `POST /api/auth/google`
2. `handleGoogleAuthPost` verifies JWT via JWKS, calls `verifyProvisionedGoogleUser` (checks `users` table, rejects suspended), calls `applyDefaultOrgToSession`
3. Session set with `user.email` and `activeOrgId`

User must have an `active` row in the `users` table — no hardcoded allowlists for fintracker. Vault/staff also check `VITE_ALLOWED_EMAILS`.

### PIN auth (admin, local dev)
1. `POST /api/auth/verify-pin` → `handleVerifyPinPost`
2. Email resolved from `PIN_SESSION_EMAIL` env or first `users.role = 'admin'` row
3. Session set after PIN match

### Adding a new app
Copy the `middleware.ts` and `src/pages/api/auth/` directory from an existing app. Update `sessionOptions('app-name')` with the new app name.

---

## Platform admin access

Requires `users.role = 'admin'` AND `users.status = 'active'` in the DB. Not controlled by env vars. Set via SQL:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

---

## Org scoping

After login, `session.activeOrgId` is set by `applyDefaultOrgToSession`. Every API query must be scoped:

```ts
const orgId = session.activeOrgId
// Always pass orgId to DB queries
const data = await getTransactions(db, orgId)
```

Never query without `orgId` — data isolation is per-org.
