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

-- Step 2: Migrate data from org_menu_assignments to organizations.enabled_menus
DO $$
DECLARE
  org_rec RECORD;
  menu_data jsonb;
  menu_row RECORD;
  app_id text;
BEGIN
  FOR org_rec IN SELECT DISTINCT o.id, o.name FROM organizations o LOOP
    -- Build app-based menu structure
    menu_data := '{}'::jsonb;

    FOR app_id IN
      SELECT DISTINCT ma.app_id
      FROM menu_apps ma
      WHERE ma.menu_id IN (
        SELECT menu_id FROM org_menu_assignments
        WHERE org_id = org_rec.id AND enabled = true
      )
    LOOP
      -- Get enabled menus for this app
      SELECT jsonb_agg(oma.menu_id) INTO menu_data[app_id]
      FROM org_menu_assignments oma
      WHERE oma.org_id = org_rec.id
        AND oma.enabled = true
        AND oma.menu_id IN (
          SELECT menu_id FROM menu_apps WHERE app_id = app_id
        );
    END LOOP;

    UPDATE organizations
    SET enabled_menus = menu_data
    WHERE id = org_rec.id;
  END LOOP;
END $$;

-- Step 3: Set enabled_apps based on which menus each org has
UPDATE organizations
SET enabled_apps = (
  SELECT jsonb_agg(DISTINCT app_slug ORDER BY app_slug)
  FROM (
    SELECT DISTINCT a.slug AS app_slug
    FROM apps a
    WHERE a.slug IN (
      SELECT jsonb_object_keys(organizations.enabled_menus)
    )
  ) AS app_list
);

-- Step 4: Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_token_at timestamp;

-- Step 5: Create a temporary mapping for org_members → users
-- For each org_member, create/update a user record
DO $$
DECLARE
  member_rec RECORD;
BEGIN
  FOR member_rec IN
    SELECT DISTINCT om.id, om.org_id, om.user_email, om.role, u.display_name
    FROM org_members om
    LEFT JOIN users u ON u.email = om.user_email
  LOOP
    -- Update user if exists, add org_id and role
    UPDATE users
    SET org_id = member_rec.org_id,
        role = member_rec.role
    WHERE email = member_rec.user_email;
  END LOOP;
END $$;

-- Step 6: Make email unique (if not already) and add unique constraint on id
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id text UNIQUE;

-- Backfill id column with uuid if not set
UPDATE users SET id = 'usr_' || substr(md5(email), 1, 16) WHERE id IS NULL;

-- Make id primary and email non-primary
ALTER TABLE users ADD CONSTRAINT users_pk PRIMARY KEY (id);
ALTER TABLE users ALTER COLUMN email DROP DEFAULT;
ALTER TABLE users ADD CONSTRAINT users_email_uq UNIQUE (email);

-- Step 7: Remove old org_members table (it's now denormalized into users)
DROP TABLE IF EXISTS org_members CASCADE;

-- Step 8: Add foreign key from users to organizations
ALTER TABLE users
  ADD CONSTRAINT users_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- Step 9: Drop old org_menu_assignments table (menus are now in organizations.enabled_menus)
DROP TABLE IF EXISTS org_menu_assignments CASCADE;

-- Step 10: Drop menu_apps table (menus-to-apps mapping is now static, not needed in DB)
DROP TABLE IF EXISTS menu_apps CASCADE;

-- Step 11: Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('003', 'admin_schema_simplification')
ON CONFLICT (version) DO NOTHING;
