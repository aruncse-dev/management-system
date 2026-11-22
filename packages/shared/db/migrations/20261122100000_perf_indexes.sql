-- Performance: composite indexes that match the hot WHERE / ORDER BY patterns.
--
-- Evidence (pg_stat_user_tables on 2026-11-22): `transactions` had ~16k sequential
-- scans reading ~14M tuples against only 556 index scans. Every read is
-- `org_id = ? AND month_year = ? ORDER BY date DESC` (register / cycle view) or
-- `org_id = ? AND month_year IN (...)` (trend), which the single-column org index
-- cannot serve. Smaller tables (payment_sources, gold_resources, persons,
-- insurance, vault_*) had no org index at all.
--
-- Data is small today, so the win is mostly headroom as rows grow, but these are
-- cheap and every one matches a query in the code. Idempotent; safe to re-run.

-- fintracker register: org + cycle, newest first
CREATE INDEX IF NOT EXISTS transactions_org_month_date_idx
  ON transactions (org_id, month_year, date DESC);

-- account balances / reference counts filter by org + source label
CREATE INDEX IF NOT EXISTS transactions_org_mode_idx
  ON transactions (org_id, mode);

-- savings list: org, newest first
CREATE INDEX IF NOT EXISTS savings_org_date_idx
  ON savings (org_id, date DESC);

-- lending book: org + sheet, by date
CREATE INDEX IF NOT EXISTS lending_org_sheet_date_idx
  ON lending (org_id, sheet_slug, date DESC);

-- accounts / credit sources: org + kind
CREATE INDEX IF NOT EXISTS payment_sources_org_type_idx
  ON payment_sources (org_id, source_type);

CREATE INDEX IF NOT EXISTS gold_resources_org_idx ON gold_resources (org_id);
CREATE INDEX IF NOT EXISTS gold_lends_org_idx ON gold_lends (org_id);
CREATE INDEX IF NOT EXISTS other_investments_org_idx ON other_investments (org_id);
CREATE INDEX IF NOT EXISTS other_investment_txns_org_inv_idx
  ON other_investment_txns (org_id, investment_id);
CREATE INDEX IF NOT EXISTS org_integrations_org_provider_idx
  ON org_integrations (org_id, provider_slug);

-- vault
CREATE INDEX IF NOT EXISTS persons_org_idx ON persons (org_id);
CREATE INDEX IF NOT EXISTS insurance_org_updated_idx ON insurance (org_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS vault_apps_org_idx ON vault_apps (org_id);
CREATE INDEX IF NOT EXISTS banking_records_org_idx ON banking_records (org_id);
CREATE INDEX IF NOT EXISTS vault_documents_org_person_idx ON vault_documents (org_id, person_uuid);

-- staff: attendance is already covered by attendance_org_staff_month_day_unique
-- and attendance_org_month_idx.

ANALYZE transactions;
ANALYZE savings;
ANALYZE lending;
ANALYZE payment_sources;
