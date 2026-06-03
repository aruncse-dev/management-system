# Pre-push checks

Run the standard gate before `git push` or opening a PR:

```bash
pnpm prepush
```

Equivalent to `pnpm type-check && pnpm lint`.

Fix all failures before pushing. For fintracker/vault test changes, also run `pnpm test` when you touched tested code.

Reference: `CLAUDE.md`, `ai/skills/git-workflow.md`
