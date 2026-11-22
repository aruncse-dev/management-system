-- Performance: composite indexes that match the hot WHERE / ORDER BY patterns.
--
-- APPLIED to production (Neon project soft-brook-60356295, default branch) on
-- 2026-11-22. Schema-only: no row was inserted, updated or deleted.
--
-- Evidence (pg_stat_user_tables, 2026-11-22): `transactions` had ~16k sequential
-- scans reading ~14M tuples against only 556 index scans. Every read is
-- `org_id = ? AND month_year = ? ORDER BY date DESC` (register / cycle view) or
-- `org_id = ? AND month_year IN (...)` (trend), which the single-column org index
-- cannot serve. Smaller tables had no org index at all. Data is small today, so
-- the win is mostly headroom, but every index matches a query in the code.
-- Idempotent; safe to re-run.

-- fintracker register: org + cycle, newest first
CREATE INDEX IF NOT EXISTS transactions_org_month_date_idx ON transactions (org_id, month_year, date DESC);
-- account balances / reference counts filter by org + source label
CREATE INDEX IF NOT EXISTS transactions_org_mode_idx ON transactions (org_id, mode);
CREATE INDEX IF NOT EXISTS transactions_org_transfer_to_idx ON transactions (org_id, transfer_to) WHERE transfer_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS savings_org_date_idx ON savings (org_id, date DESC);
CREATE INDEX IF NOT EXISTS savings_org_account_idx ON savings (org_id, account);
CREATE INDEX IF NOT EXISTS savings_org_to_account_idx ON savings (org_id, to_account) WHERE to_account IS NOT NULL;

CREATE INDEX IF NOT EXISTS lending_org_sheet_date_idx ON lending (org_id, sheet_slug, date DESC);
CREATE INDEX IF NOT EXISTS payment_sources_org_type_idx ON payment_sources (org_id, source_type);

CREATE INDEX IF NOT EXISTS gold_resources_org_idx ON gold_resources (org_id);
CREATE INDEX IF NOT EXISTS gold_lends_org_idx ON gold_lends (org_id);
CREATE INDEX IF NOT EXISTS gold_items_org_lend_idx ON gold_items (org_id, lend_id) WHERE lend_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gold_items_org_jewel_loan_idx ON gold_items (org_id, jewel_loan_id) WHERE jewel_loan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS jewel_loan_repayments_org_loan_idx ON jewel_loan_repayments (org_id, loan_id);
CREATE INDEX IF NOT EXISTS cash_loan_repayments_org_loan_idx ON cash_loan_repayments (org_id, loan_id);
CREATE INDEX IF NOT EXISTS subscriptions_org_status_idx ON subscriptions (org_id, status);

CREATE INDEX IF NOT EXISTS other_investments_org_idx ON other_investments (org_id);
CREATE INDEX IF NOT EXISTS other_investment_txns_org_inv_idx ON other_investment_txns (org_id, investment_id);
CREATE INDEX IF NOT EXISTS org_integrations_org_provider_idx ON org_integrations (org_id, provider_slug);

-- vault
CREATE INDEX IF NOT EXISTS persons_org_idx ON persons (org_id);
CREATE INDEX IF NOT EXISTS insurance_org_updated_idx ON insurance (org_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS vault_apps_org_idx ON vault_apps (org_id);
CREATE INDEX IF NOT EXISTS banking_records_org_idx ON banking_records (org_id);
CREATE INDEX IF NOT EXISTS vault_documents_org_person_idx ON vault_documents (org_id, person_uuid);

-- staff: attendance is already covered by attendance_org_staff_month_day_unique
-- and attendance_org_month_idx.

-- Query statistics, so slow queries can be found from real traffic.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

ANALYZE transactions;
ANALYZE savings;
ANALYZE lending;
ANALYZE payment_sources;
