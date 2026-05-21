# Google OAuth Environment Variables

## Client ID

Use **any one** of these three names (same value, checked in priority order):

1. `VITE_GOOGLE_CLIENT_ID`
2. `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
3. `GOOGLE_CLIENT_ID`

Do not invent new names. All three are accepted by `getGoogleAuthEnv(__dirname)` in `next.config.js`.

## Env file merge order (later overrides earlier)

```
repo .env
→ repo .env.local
→ web/.env
→ packages/apps/<app>/.env.local
→ shell / Vercel env
```

Set `VITE_GOOGLE_CLIENT_ID` in repo `.env` or `.env.local` to share across all apps.

## Allowlist (optional)

Comma-separated list of allowed Google emails for vault/staff:

- `VITE_ALLOWED_EMAILS`
- `NEXT_PUBLIC_ALLOWED_EMAILS`
- `ALLOWED_EMAILS`

Checked server-side in `POST /api/auth/google` — not exposed to the client bundle.

## Required server-side vars

| Var | Purpose |
|---|---|
| `SESSION_SECRET` | 32+ char random string; encrypts iron-session cookie |
| `DATABASE_URL` | Neon/Postgres connection string |
| `APP_PASSWORD` | 4-digit PIN for PIN-based auth (`POST /api/auth/verify-pin`) |
| `PIN_SESSION_EMAIL` | (Optional) Email to bind when PIN auth succeeds; defaults to first `role='admin'` user |

## Do not use (obsolete)

`VITE_GAS_URL`, `VITE_API_TOKEN`, `GAS_EXEC_URL`, `NEXT_PUBLIC_GAS_URL`, `VITE_API_URL`, `VITE_APP_PASSWORD`, `NEXT_PUBLIC_APP_PASSWORD`

## new Next.js app checklist

- [ ] `getGoogleAuthEnv(__dirname)` called in `next.config.js`
- [ ] `@fintracker-vault/auth` listed in `transpilePackages`
- [ ] `SESSION_SECRET` set in `packages/apps/<app>/.env.local`
- [ ] `middleware.ts` uses `createFtMiddleware()` from `@fintracker-vault/auth/middleware`
