# AI Reference — FinTracker Development Guides

This folder contains all shared development knowledge for the FinTracker monorepo. It's tool-agnostic (works with Claude Code, Cursor, any IDE).

## Quick Start

**New to the repo?** Read in this order:
1. Root `README.md` — setup and deployment
2. `ai/docs/architecture.md` — monorepo overview
3. Pick your task:
   - Adding a page? → `ai/skills/ui-patterns.md`
   - Changing the DB? → `ai/skills/db-workflow.md` + `ai/docs/migrations.md`
   - New API? → `ai/skills/api-patterns.md`
   - Debugging auth? → `ai/skills/auth-patterns.md`

## Skills (Implementation Guides)

How-to documents for common tasks. Each covers patterns and best practices.

| Guide | For |
|-------|-----|
| `skills/ui-patterns.md` | Building pages and components with consistent UI (SectionBlock, FAB, forms, delete dialogs) |
| `skills/db-workflow.md` | Making schema changes (write SQL, run locally, sync Drizzle schema) |
| `skills/api-patterns.md` | Single-dispatcher API pattern, caching, auth in routes |
| `skills/auth-patterns.md` | Google OAuth, PIN auth, session management, org scoping |
| `skills/monorepo-guidelines.md` | Cross-package imports, building shared packages, adding new apps |
| `skills/git-workflow.md` | Branch naming, commits, PR-only main, tagging releases |
| `skills/google-oauth-env.md` | Google OAuth env var setup and allowlists |

## Docs (Reference)

Detailed reference material and diagrams.

| Doc | Contains |
|-----|----------|
| `docs/architecture.md` | Full monorepo breakdown: layout, multi-tenancy, auth flow, build/deploy |
| `docs/schema-diagram.md` | Mermaid ERD of all 28 database tables with FK relationships and ownership |
| `docs/migrations.md` | Step-by-step database migration workflow with examples |
| `docs/integrations-encryption.md` | OAuth provider setup (Upstox), token encryption, API integration |
| `docs/sensitive-field-encryption.md` | AES-256-GCM field encryption for secrets/PII, key rotation |

## Organization

```
ai/
├── skills/           # Implementation guides (copy patterns from here)
│   ├── ui-patterns.md
│   ├── db-workflow.md
│   ├── api-patterns.md
│   ├── auth-patterns.md
│   ├── monorepo-guidelines.md
│   ├── git-workflow.md
│   └── google-oauth-env.md
├── docs/            # Reference material and diagrams
│   ├── architecture.md
│   ├── schema-diagram.md
│   ├── migrations.md
│   ├── integrations-encryption.md
│   └── sensitive-field-encryption.md
└── README.md        # This file
```

## What's Not Here

These belong in the root or are version-controlled:
- `CLAUDE.md` — Claude Code's project instructions (root)
- `README.md` — setup and deployment (root)
- `.env.local.example` — env var template (root)
- Git history, recent changes → use `git log` / `git blame`
- Debugging solutions → check code comments and commit messages

## Conventions at a Glance

| Area | Rule |
|------|------|
| **UI** | Use `<SectionBlock>`, `<ConfirmDialog>`, `<ModalShell>` from `@fintracker-vault/ui` |
| **DB** | Write `.sql` migrations → run locally → update TS schema → regenerate snapshot |
| **API** | Single dispatcher per app; cache GET; invalidate on POST |
| **Auth** | Session per app; always scope queries to `orgId` |
| **Imports** | Always `@fintracker-vault/*`; never relative cross-package paths |
| **Git** | Branch + PR only; never push to `main`; run `pnpm type-check` before PR |

## Questions?

- Something unclear? The guides have inline examples.
- Can't find what you're looking for? Check the root `CLAUDE.md` or use `grep` to search across guides.
- Found a mistake? Update the guide directly.

---

**Last updated:** May 21, 2026
