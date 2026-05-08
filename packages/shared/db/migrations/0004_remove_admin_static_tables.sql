-- Schema iteration 004: Remove admin static tables (apps, menu_sections, menu_catalog).
-- All admin configuration is now defined as static JSON in code (adminStaticData.ts).
-- This cleanup removes unnecessary DB tables and simplifies the schema.
-- Apply after 0003.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/shared/db/migrations/0004_remove_admin_static_tables.sql

-- Step 1: Drop menu_catalog table (all menus are now static in code)
DROP TABLE IF EXISTS menu_catalog CASCADE;

-- Step 2: Drop menu_sections table (sections are now static in code)
DROP TABLE IF EXISTS menu_sections CASCADE;

-- Step 3: Drop apps table (all apps are static: fintracker, vault, staff)
DROP TABLE IF EXISTS apps CASCADE;

-- Step 4: Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('004', 'remove_admin_static_tables')
ON CONFLICT (version) DO NOTHING;
