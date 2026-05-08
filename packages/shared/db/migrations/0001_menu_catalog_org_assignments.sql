-- Schema iteration 001: global menu catalog, per-org assignments, slim users table.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING / DROP IF EXISTS.
-- Apply: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/shared/db/migrations/0001_menu_catalog_org_assignments.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_catalog (
  id text PRIMARY KEY,
  section_slug text NOT NULL,
  section_label text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO menu_catalog (id, section_slug, section_label, label, sort_order) VALUES
('dashboard', 'overview', 'Overview', 'Dashboard', 0),
('budget', 'monthly', 'Monthly', 'Budget', 0),
('transactions', 'monthly', 'Monthly', 'Transactions', 1),
('credits', 'monthly', 'Monthly', 'Credits', 2),
('accounts', 'monthly', 'Monthly', 'Accounts', 3),
('savings', 'save-borrow', 'Save & borrow', 'Savings', 0),
('lending', 'save-borrow', 'Save & borrow', 'Lending', 1),
('loans', 'save-borrow', 'Save & borrow', 'Loans', 2),
('gold', 'invest', 'Invest', 'Gold', 0),
('investments', 'invest', 'Invest', 'Investments', 1),
('stocks', 'invest', 'Invest', 'Stocks', 2),
('mutualfunds', 'invest', 'Invest', 'Mutual funds', 3),
('subscriptions', 'life', 'Life', 'Subscriptions', 0),
('bommi', 'life', 'Life', 'Bommi', 1),
('settings', 'system', 'System', 'Settings', 0),
('components', 'system', 'System', 'UI kit', 1),
('vault', 'apps', 'Apps', 'Vault', 0),
('insurance', 'apps', 'Apps', 'Insurance', 1),
('persons', 'apps', 'Apps', 'Persons', 2),
('health', 'apps', 'Apps', 'Health', 3),
('habits', 'apps', 'Apps', 'Habits', 4),
('documents', 'apps', 'Apps', 'Documents', 5),
('staff', 'apps', 'Apps', 'Staff', 6)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS org_menu_assignments (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  menu_id text NOT NULL REFERENCES menu_catalog(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS org_menu_org_menu_uq ON org_menu_assignments (org_id, menu_id);

INSERT INTO org_menu_assignments (id, org_id, menu_id, sort_order, enabled)
SELECT o.id || ':' || m.id, o.id, m.id, m.sort_order, true
FROM organizations o
CROSS JOIN menu_catalog m
ON CONFLICT (id) DO NOTHING;

ALTER TABLE users DROP COLUMN IF EXISTS modules;
ALTER TABLE users DROP COLUMN IF EXISTS menu_config;

INSERT INTO schema_migrations (version, name)
VALUES ('001', 'menu_catalog_org_assignments_users_slim')
ON CONFLICT (version) DO NOTHING;
