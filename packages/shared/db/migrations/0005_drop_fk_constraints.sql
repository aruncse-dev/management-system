-- Migration 0005: Drop all foreign key constraints
-- Relationships are now managed at the application level

-- Drop FK on users.orgId
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_id_fkey;

-- Drop user_email FKs across all tables
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_email_fkey;
ALTER TABLE budget DROP CONSTRAINT IF EXISTS budget_user_email_fkey;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_email_fkey;
ALTER TABLE savings DROP CONSTRAINT IF EXISTS savings_user_email_fkey;
ALTER TABLE lending DROP CONSTRAINT IF EXISTS lending_user_email_fkey;
ALTER TABLE emi_loans DROP CONSTRAINT IF EXISTS emi_loans_user_email_fkey;
ALTER TABLE jewel_loans DROP CONSTRAINT IF EXISTS jewel_loans_user_email_fkey;
ALTER TABLE jewel_loan_repayments DROP CONSTRAINT IF EXISTS jewel_loan_repayments_user_email_fkey;
ALTER TABLE cash_loans DROP CONSTRAINT IF EXISTS cash_loans_user_email_fkey;
ALTER TABLE cash_loan_repayments DROP CONSTRAINT IF EXISTS cash_loan_repayments_user_email_fkey;
ALTER TABLE gold_items DROP CONSTRAINT IF EXISTS gold_items_user_email_fkey;
ALTER TABLE gold_history DROP CONSTRAINT IF EXISTS gold_history_user_email_fkey;
ALTER TABLE stocks DROP CONSTRAINT IF EXISTS stocks_user_email_fkey;
ALTER TABLE mutual_funds DROP CONSTRAINT IF EXISTS mutual_funds_user_email_fkey;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_email_fkey;
ALTER TABLE staff_members DROP CONSTRAINT IF EXISTS staff_members_user_email_fkey;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_user_email_fkey;
ALTER TABLE vault_apps DROP CONSTRAINT IF EXISTS vault_apps_user_email_fkey;
ALTER TABLE banking_records DROP CONSTRAINT IF EXISTS banking_records_user_email_fkey;
ALTER TABLE persons DROP CONSTRAINT IF EXISTS persons_user_email_fkey;
ALTER TABLE insurance DROP CONSTRAINT IF EXISTS insurance_user_email_fkey;

-- Drop nested table FKs
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_staff_id_fkey;
ALTER TABLE jewel_loan_repayments DROP CONSTRAINT IF EXISTS jewel_loan_repayments_loan_id_fkey;
ALTER TABLE cash_loan_repayments DROP CONSTRAINT IF EXISTS cash_loan_repayments_loan_id_fkey;
ALTER TABLE banking_records DROP CONSTRAINT IF EXISTS banking_records_app_uuid_fkey;
ALTER TABLE insurance DROP CONSTRAINT IF EXISTS insurance_app_id_fkey;
ALTER TABLE insurance DROP CONSTRAINT IF EXISTS insurance_person_uuid_fkey;

-- Record migration
INSERT INTO schema_migrations (version, name) VALUES ('0005', 'drop_fk_constraints');
