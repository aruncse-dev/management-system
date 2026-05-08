-- Schema iteration 002: apps, menu_sections, menu_apps; menu_catalog restructure.
-- Apply after 0001.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/shared/db/migrations/0002_apps_sections_menu_restructure.sql

CREATE TABLE IF NOT EXISTS apps (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_sections (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO apps (id, slug, name, description, icon, sort_order, status) VALUES
('fintracker', 'fintracker', 'FinTracker', 'Finance workspace', 'Wallet', 0, 'active'),
('vault', 'vault', 'Vault', 'Household vault', 'Landmark', 1, 'active'),
('staff', 'staff', 'Staff', 'Staff workspace', 'Users', 2, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_sections (id, slug, label, sort_order) VALUES
('overview', 'overview', 'Overview', 0),
('monthly', 'monthly', 'Monthly', 1),
('save-borrow', 'save-borrow', 'Save & borrow', 2),
('invest', 'invest', 'Invest', 3),
('credit', 'credit', 'Credit', 4),
('life', 'life', 'Life', 5),
('system', 'system', 'System', 6),
('vault-core', 'vault-core', 'Vault', 7),
('vault-family', 'vault-family', 'Family', 8),
('vault-wellness', 'vault-wellness', 'Wellness', 9),
('vault-coverage', 'vault-coverage', 'Coverage', 10),
('staff-main', 'staff-main', 'Menu', 11)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE menu_catalog ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE menu_catalog ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE menu_catalog ADD COLUMN IF NOT EXISTS path text;
ALTER TABLE menu_catalog ADD COLUMN IF NOT EXISTS section_id text;
ALTER TABLE menu_catalog ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Legacy columns from 0001 may still be NOT NULL; relax them before inserting new rows.
ALTER TABLE menu_catalog ALTER COLUMN section_slug DROP NOT NULL;
ALTER TABLE menu_catalog ALTER COLUMN section_label DROP NOT NULL;

-- FinTracker rows (from 0001 section_slug → section_id)
UPDATE menu_catalog SET section_id = 'overview', slug = 'dashboard', path = '/monthly?tab=dash', icon = 'CalendarDays' WHERE id = 'dashboard';
UPDATE menu_catalog SET section_id = 'monthly', slug = 'budget', path = '/monthly?tab=bud', icon = 'Wallet' WHERE id = 'budget';
UPDATE menu_catalog SET section_id = 'monthly', slug = 'transactions', path = '/monthly?tab=txns', icon = 'List' WHERE id = 'transactions';
UPDATE menu_catalog SET section_id = 'monthly', slug = 'credits', path = '/monthly?tab=cc', icon = 'CreditCard' WHERE id = 'credits';
UPDATE menu_catalog SET section_id = 'monthly', slug = 'accounts', path = '/monthly?tab=acct', icon = 'Landmark' WHERE id = 'accounts';
UPDATE menu_catalog SET section_id = 'save-borrow', slug = 'savings', path = '/savings', icon = 'PiggyBank' WHERE id = 'savings';
UPDATE menu_catalog SET section_id = 'credit', slug = 'lending', path = '/lending', icon = 'Wallet' WHERE id = 'lending';
UPDATE menu_catalog SET section_id = 'credit', slug = 'loans', path = '/loans', icon = 'Layers3' WHERE id = 'loans';
UPDATE menu_catalog SET section_id = 'invest', slug = 'gold', path = '/gold', icon = 'Gem' WHERE id = 'gold';
UPDATE menu_catalog SET section_id = 'invest', slug = 'investments', path = '/investments', icon = 'TrendingUp' WHERE id = 'investments';
UPDATE menu_catalog SET section_id = 'invest', slug = 'stocks', path = '/stocks', icon = 'LineChart' WHERE id = 'stocks';
UPDATE menu_catalog SET section_id = 'invest', slug = 'mutualfunds', path = '/mutualfunds', icon = 'PieChart' WHERE id = 'mutualfunds';
UPDATE menu_catalog SET section_id = 'life', slug = 'subscriptions', path = '/subscriptions', icon = 'Repeat2' WHERE id = 'subscriptions';
UPDATE menu_catalog SET section_id = 'life', slug = 'bommi', path = '/bommi', icon = 'PiggyBank' WHERE id = 'bommi';
UPDATE menu_catalog SET section_id = 'system', slug = 'settings', path = '/settings', icon = 'Settings' WHERE id = 'settings';
UPDATE menu_catalog SET section_id = 'system', slug = 'components', path = '/components', icon = 'LayoutGrid' WHERE id = 'components';

-- Vault + Staff (0001 used section_slug = apps)
UPDATE menu_catalog SET section_id = 'vault-core', slug = 'vault', label = 'Banking', path = '/vault', icon = 'Landmark' WHERE id = 'vault';
UPDATE menu_catalog SET section_id = 'vault-coverage', slug = 'insurance', path = '/vaultinsurance', icon = 'Shield' WHERE id = 'insurance';
UPDATE menu_catalog SET section_id = 'vault-family', slug = 'persons', path = '/vaultpersons', icon = 'Users' WHERE id = 'persons';
UPDATE menu_catalog SET section_id = 'vault-wellness', slug = 'health', path = '/vaulthealth', icon = 'HeartPulse' WHERE id = 'health';
UPDATE menu_catalog SET section_id = 'vault-wellness', slug = 'habits', path = '/vaulthabits', icon = 'Target' WHERE id = 'habits';
UPDATE menu_catalog SET section_id = 'vault-family', slug = 'documents', path = '/vaultdocuments', icon = 'FileText' WHERE id = 'documents';
UPDATE menu_catalog SET section_id = 'staff-main', slug = 'staff', label = 'Staffs', path = '/staffs', icon = 'Users' WHERE id = 'staff';

INSERT INTO menu_catalog (id, slug, label, icon, path, section_id, sort_order, created_at, updated_at) VALUES
('lending-vijaya', 'lending-vijaya', 'Vijaya Amma', 'User', '/lending?sheet=Vijaya%20Amma', 'credit', 1, now(), now()),
('vaultapps', 'vaultapps', 'Apps', 'Grid2X2', '/vaultapps', 'vault-core', 1, now(), now()),
('vaultsettings', 'vaultsettings', 'Settings', 'Settings', '/vaultsettings', 'system', 2, now(), now()),
('staff-attendance', 'staff-attendance', 'Attendance', 'CalendarDays', '/attendance', 'staff-main', 0, now(), now()),
('staff-settings', 'staff-settings', 'Settings', 'Settings', '/settings', 'system', 3, now(), now())
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menu_catalog_section_id_fkey'
  ) THEN
    ALTER TABLE menu_catalog
      ADD CONSTRAINT menu_catalog_section_id_fkey
      FOREIGN KEY (section_id) REFERENCES menu_sections(id);
  END IF;
END $$;

ALTER TABLE menu_catalog DROP COLUMN IF EXISTS section_slug;
ALTER TABLE menu_catalog DROP COLUMN IF EXISTS section_label;

ALTER TABLE menu_catalog ALTER COLUMN slug SET NOT NULL;
ALTER TABLE menu_catalog ALTER COLUMN path SET NOT NULL;
ALTER TABLE menu_catalog ALTER COLUMN section_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS menu_catalog_slug_uq ON menu_catalog (slug);

CREATE TABLE IF NOT EXISTS menu_apps (
  id text PRIMARY KEY,
  menu_id text NOT NULL REFERENCES menu_catalog(id) ON DELETE CASCADE,
  app_id text NOT NULL REFERENCES apps(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS menu_apps_menu_app_uq ON menu_apps (menu_id, app_id);

INSERT INTO menu_apps (id, menu_id, app_id) VALUES
('dashboard:fintracker', 'dashboard', 'fintracker'),
('budget:fintracker', 'budget', 'fintracker'),
('transactions:fintracker', 'transactions', 'fintracker'),
('credits:fintracker', 'credits', 'fintracker'),
('accounts:fintracker', 'accounts', 'fintracker'),
('savings:fintracker', 'savings', 'fintracker'),
('lending:fintracker', 'lending', 'fintracker'),
('lending-vijaya:fintracker', 'lending-vijaya', 'fintracker'),
('loans:fintracker', 'loans', 'fintracker'),
('gold:fintracker', 'gold', 'fintracker'),
('investments:fintracker', 'investments', 'fintracker'),
('stocks:fintracker', 'stocks', 'fintracker'),
('mutualfunds:fintracker', 'mutualfunds', 'fintracker'),
('subscriptions:fintracker', 'subscriptions', 'fintracker'),
('bommi:fintracker', 'bommi', 'fintracker'),
('settings:fintracker', 'settings', 'fintracker'),
('components:fintracker', 'components', 'fintracker'),
('vault:vault', 'vault', 'vault'),
('vaultapps:vault', 'vaultapps', 'vault'),
('persons:vault', 'persons', 'vault'),
('documents:vault', 'documents', 'vault'),
('health:vault', 'health', 'vault'),
('habits:vault', 'habits', 'vault'),
('insurance:vault', 'insurance', 'vault'),
('vaultsettings:vault', 'vaultsettings', 'vault'),
('staff-attendance:staff', 'staff-attendance', 'staff'),
('staff:staff', 'staff', 'staff'),
('staff-settings:staff', 'staff-settings', 'staff')
ON CONFLICT (id) DO NOTHING;

INSERT INTO org_menu_assignments (id, org_id, menu_id, sort_order, enabled)
SELECT o.id || ':' || m.id, o.id, m.id, m.sort_order, true
FROM organizations o
CROSS JOIN menu_catalog m
ON CONFLICT (id) DO NOTHING;

INSERT INTO schema_migrations (version, name)
VALUES ('002', 'apps_sections_menu_restructure')
ON CONFLICT (version) DO NOTHING;
