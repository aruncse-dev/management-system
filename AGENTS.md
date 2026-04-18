# Agent & developer entry point

Use this file as the **first stop** for Cursor agents and new contributors. The canonical detail lives in **[`CLAUDE.md`](./CLAUDE.md)**.

## Read first

| Topic | Where |
|--------|--------|
| Monorepo layout, commands, auth, deployment | [`CLAUDE.md`](./CLAUDE.md) |
| **New apps, pages, API caching, shared UI workflow** | [`CLAUDE.md` → Developer and agent playbook](./CLAUDE.md#developer-and-agent-playbook) |
| Google OAuth / client ID env names (do not invent new keys) | [`.cursor/rules/google-oauth-env.mdc`](./.cursor/rules/google-oauth-env.mdc) |

## Non-negotiables

1. **`pnpm type-check`** at repo root before pushing (`.git/hooks/pre-push` enforces this).
2. **Global CSS** only in `src/pages/_app.tsx` or `_document.tsx` — never in page components.
3. **Cross-package imports** use `@fintracker-vault/*` aliases from root `tsconfig.json`, not long relative paths.
4. **New Next apps** must use `packages/apps/resolve-google-env.cjs` + `getGoogleAuthEnv(__dirname)` in `next.config.js` (same pattern as `fintracker`, `vault`, `staff`).
5. **Shared UI** (`@fintracker-vault/ui`): after changing `packages/shared/ui/src`, run `pnpm --filter @fintracker-vault/ui run build` so `dist/` matches source (apps type-check against `dist`).

## Apps (quick reference)

| App | Path | Dev port |
|-----|------|----------|
| FinTracker | `packages/apps/fintracker` | 3000 |
| Vault | `packages/apps/vault` | 3001 |
| Staff | `packages/apps/staff` | 3002 |

Root scripts: `pnpm dev`, `pnpm dev:fintracker`, `pnpm dev:vault`, `pnpm dev:staff`, `pnpm dev:fresh`.

---

**Maintainer:** see [`CLAUDE.md`](./CLAUDE.md) footer.
