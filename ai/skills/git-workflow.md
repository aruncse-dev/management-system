# Git Workflow

## Rule: `main` is PR-only

Never push commits directly to `main`. All changes go through a branch + pull request.

```bash
# Start work
git checkout main && git pull origin main
git checkout -b feat/short-slug   # or fix/, chore/, docs/

# Implement, then
pnpm type-check
git add <specific files>
git commit -m "feat(scope): description"
git push -u origin feat/short-slug

# Open PR
gh pr create --title "..." --body "..."
# Merge after review (self-review is fine for solo work)
```

---

## Branch naming

| Prefix | Use for |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `chore/` | Tooling, deps, config |
| `docs/` | Documentation only |
| `refactor/` | Code restructure, no behaviour change |

Examples: `feat/vault-export`, `fix/login-redirect`, `docs/schema-diagram`

---

## Commit message format

```
<type>(<scope>): <short description>

# Types: feat, fix, chore, docs, refactor, perf, test
# Scope: app name or package (fintracker, vault, db, ui, auth)
```

Examples:
- `feat(fintracker): add recurring subscription toggle`
- `fix(db): guard against null org_id in savings query`
- `chore(deps): upgrade drizzle-orm to 0.30`

---

## Tags / releases

Release tags use **UTC calendar dates**: `vYYYYMMDD` (e.g. `v20260604`). **One tag name per UTC day** — a second release the same day **moves that tag to latest `main`** and force-pushes (GitHub Release is updated, release notes regenerated). Package.json semver (`pnpm release:bump`) is separate from the git tag.

```bash
# On main after merge (optional: pnpm release:bump patch for app package versions)
pnpm release:tag --push
```

GitHub Actions (`.github/workflows/release.yml`) creates or updates the release. Notes are built via GitHub’s `generate-notes` API from **commits/PRs since the previous `vYYYYMMDD` tag** (same-day retag uses the prior day’s tag as baseline, so one release includes all of that day’s merges). Preview locally: `pnpm release:notes:preview`.

---

## Emergency exception

Only bypass the PR rule if the repo owner explicitly authorizes a hotfix revert with a documented reason. This is rare — prefer a fast PR.
