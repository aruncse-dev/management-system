# Release (tag + GitHub Release)

Ship a release from **updated `main`** after PR merge.

**Tag pattern:** `vYYYYMMDD` (UTC), one tag per day — see `ai/skills/git-workflow.md`.

```bash
git checkout main && git pull origin main
pnpm prepush
# optional app semver bump:
pnpm release:bump patch
git add package.json packages/apps/*/package.json
git commit -m "chore(release): bump version to X.Y.Z"
git push origin main
pnpm release:tag --push
```

GitHub Actions (`.github/workflows/release.yml`) creates or **updates** the release when the tag is pushed.

**Same UTC day, second release:** `pnpm release:tag --push` moves today's `vYYYYMMDD` tag to current HEAD and regenerates notes from **all commits since the previous date tag** (e.g. since `v20260523`), so both merges appear in one release.

Preview notes before tagging: `pnpm release:notes:preview` (requires `gh` auth).

Do not use semver tags (`v1.3.1`) for GitHub releases in this repo.
