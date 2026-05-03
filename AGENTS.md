# Agent & developer entry point

Use this file as the **first stop** for Cursor agents and new contributors. The canonical detail lives in **[`CLAUDE.md`](./CLAUDE.md)**.

## Read first

| Topic | Where |
|--------|--------|
| Monorepo layout, commands, auth, deployment | [`CLAUDE.md`](./CLAUDE.md) |
| **New apps, pages, API caching, shared UI workflow** | [`CLAUDE.md` → Developer and agent playbook](./CLAUDE.md#developer-and-agent-playbook) |
| Google OAuth / client ID env names (do not invent new keys) | [`.cursor/rules/google-oauth-env.mdc`](./.cursor/rules/google-oauth-env.mdc) |
| **Tags & GitHub Releases** (semver, bump, tag, CI) | [`CLAUDE.md` → Deployment → Tags & GitHub Releases](./CLAUDE.md#tags--github-releases) |

## Non-negotiables

1. **Git — PR-only for `main`:** Never push new commits directly to `main`. Branch → push branch → open PR → merge. See [`.cursor/rules/git-pr-only-main.mdc`](./.cursor/rules/git-pr-only-main.mdc). (`main` should be branch-protected on GitHub.)
2. **`pnpm type-check`** at repo root before pushing (`.git/hooks/pre-push` enforces this).
3. **Global CSS** only in `src/pages/_app.tsx` or `_document.tsx` — never in page components.
4. **Cross-package imports** use `@fintracker-vault/*` aliases from root `tsconfig.json`, not long relative paths.
5. **New Next apps** must use `packages/apps/resolve-google-env.cjs` + `getGoogleAuthEnv(__dirname)` in `next.config.js` (same pattern as `fintracker`, `vault`, `staff`).
6. **Shared UI** (`@fintracker-vault/ui`): after changing `packages/shared/ui/src`, run `pnpm --filter @fintracker-vault/ui run build` so `dist/` matches source (apps type-check against `dist`).
7. **Shared auth** (`@fintracker-vault/auth`): after changing `packages/shared/auth/src`, run `pnpm --filter @fintracker-vault/auth run build` (each app’s `predev` already builds UI + auth).

## Apps (quick reference)

| App | Path | Dev port |
|-----|------|----------|
| FinTracker | `packages/apps/fintracker` | 3000 |
| Vault | `packages/apps/vault` | 3001 |
| Staff | `packages/apps/staff` | 3002 |

Root scripts: `pnpm dev`, `pnpm dev:fintracker`, `pnpm dev:vault`, `pnpm dev:staff`, `pnpm dev:fresh`.

## Releases (quick)

1. `pnpm release:bump patch|minor|major` — bumps root + fintracker + vault + staff `version`.
2. Merge to `main`, then `pnpm release:tag --push` — annotated `vX.Y.Z` tag; GitHub Actions opens a Release with notes.

---

**Maintainer:** see [`CLAUDE.md`](./CLAUDE.md) footer.
