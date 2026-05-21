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

Pushing tags directly to `main` is allowed:

```bash
git tag v1.4.0
git push origin v1.4.0
```

---

## Emergency exception

Only bypass the PR rule if the repo owner explicitly authorizes a hotfix revert with a documented reason. This is rare — prefer a fast PR.
