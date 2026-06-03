# Type-check (pre-push)

Run the monorepo TypeScript check. Required before every push and PR.

```bash
pnpm type-check
```

If errors appear, fix them in the reported package before committing. Do not skip with `@ts-ignore` unless the existing file already uses that pattern.

Reference: `CLAUDE.md`, `ai/skills/monorepo-guidelines.md`
