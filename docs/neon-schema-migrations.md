# Neon schema migrations (SQL)

Apply in order against `DATABASE_URL` (see comments at top of each file for the exact `psql` command).

| File | Version | Summary |
|------|---------|---------|
| [`packages/shared/db/migrations/0001_menu_catalog_org_assignments.sql`](../packages/shared/db/migrations/0001_menu_catalog_org_assignments.sql) | `001` | `menu_catalog`, `org_menu_assignments`, slim `users` |
| [`packages/shared/db/migrations/0002_apps_sections_menu_restructure.sql`](../packages/shared/db/migrations/0002_apps_sections_menu_restructure.sql) | `002` | `apps`, `menu_sections`, `menu_apps`, `menu_catalog` columns (`slug`, `icon`, `path`, `section_id`) |

Applied versions are recorded in `schema_migrations`.
