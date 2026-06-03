# Cursor slash commands

Project commands live in [`.cursor/commands/`](../../.cursor/commands/). Type `/` in Cursor chat or Agent to invoke them.

| Command | Purpose |
|---------|---------|
| `/type-check` | Run `pnpm type-check` |
| `/pre-push` | Run `pnpm prepush` (type-check + lint) |
| `/dev-fintracker` | Fresh Fintracker dev server (port 3000) |
| `/dev-vault` | Fresh Vault dev server (port 3001) |
| `/dev-admin` | Fresh Admin dev server (port 3003) |
| `/build-ui-auth` | Rebuild `@fintracker-vault/ui` and `@fintracker-vault/auth` |
| `/build-fintracker` | Production build Fintracker |
| `/db-check` | Test DB connectivity (`pnpm db:check`) |
| `/db-migration` | Manual SQL → Neon → Drizzle workflow |
| `/pr-prep` | Branch, checks, commit, `gh pr create` |
| `/release` | `vYYYYMMDD` tag + GitHub Release from main (same-day reruns overwrite tag) |

Personal/global commands can go in `~/.cursor/commands/` for use across repos.
