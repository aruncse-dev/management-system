-- Schema iteration 003: Admin schema simplification.
-- Consolidate organizations to store apps & menus as denormalized JSON.
-- Merge org_members into users table with orgId and token tracking.
-- Apps and menus sections remain as static reference data (not user-configurable).
-- Apply after 0002.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/shared/db/migrations/0003_admin_schema_simplification.sql

-- Step 1: Add new columns to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enabled_apps jsonb DEFAULT '[]'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enabled_menus jsonb DEFAULT '{}'::jsonb;

-- Structure of enabled_apps: ["fintracker", "vault", "staff"]
-- Structure of enabled_menus: {"fintracker": ["dashboard", "budget"], "vault": ["vault", "persons"]}

-- Step 2: Initialize enabled_apps and enabled_menus to empty arrays (will be set during org configuration)
-- For now, all orgs get all apps by default
UPDATE organizations
SET enabled_apps = '["fintracker", "vault", "staff"]'::jsonb
WHERE enabled_apps IS NULL OR enabled_apps = '[]'::jsonb;

UPDATE organizations
SET enabled_menus = '{"fintracker": [], "vault": [], "staff": []}'::jsonb
WHERE enabled_menus IS NULL OR enabled_menus = '{}'::jsonb;

-- Step 4: Add new columns to users table (keeping email as PK due to many FK references)
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_token_at timestamp;

-- Add FK constraint from users to organizations (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_org_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 5: Migrate org_members → users (if table still exists)
-- (Org_members table may have been dropped already; this is idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'org_members') THEN
    UPDATE users u
    SET org_id = om.org_id,
        role = om.role
    FROM org_members om
    WHERE u.email = om.user_email AND u.org_id IS NULL;
  END IF;
END $$;

-- Step 6: Drop old org_members table (now denormalized into users via org_id + role)
DROP TABLE IF EXISTS org_members CASCADE;

-- Step 7: Drop old org_menu_assignments table (menus now denormalized into organizations.enabled_menus)
DROP TABLE IF EXISTS org_menu_assignments CASCADE;

-- Step 8: Drop menu_apps table (menus-to-apps mapping is now static, not DB-driven)
DROP TABLE IF EXISTS menu_apps CASCADE;

-- Step 11: Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('003', 'admin_schema_simplification')
ON CONFLICT (version) DO NOTHING;
