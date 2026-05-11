-- FinTracker Multi-Organization Schema Migration
-- Drop user_email, use org_id alone for data filtering
-- Apply with: psql "$DATABASE_URL" -f migration.sql

-- ============================================================================
-- 1. CREATE org_members JOIN TABLE (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.org_members (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  user_email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_email ON public.org_members(user_email);

-- ============================================================================
-- 2. BACKFILL org_members FROM EXISTING users.org_id
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'org_id'
  ) THEN
    INSERT INTO public.org_members (id, org_id, user_email, role, created_at)
    SELECT
      gen_random_uuid()::text as id,
      org_id,
      email,
      'member' as role,
      now() as created_at
    FROM public.users
    WHERE org_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 3. DROP org_id FROM users TABLE
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.users DROP COLUMN IF EXISTS org_id CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 4. REMOVE user_email, ADD org_id TO ALL DATA TABLES
-- ============================================================================

-- Transactions
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'transactions') THEN
    ALTER TABLE public.transactions DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_transactions_org_id ON public.transactions(org_id);
  END IF;
END $$;

-- Budget
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'budget') THEN
    ALTER TABLE public.budget DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.budget ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_budget_org_id ON public.budget(org_id);
  END IF;
END $$;

-- Accounts
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'accounts') THEN
    ALTER TABLE public.accounts DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_accounts_org_id ON public.accounts(org_id);
  END IF;
END $$;

-- Credit Sources
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'credit_sources') THEN
    ALTER TABLE public.credit_sources DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.credit_sources ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_credit_sources_org_id ON public.credit_sources(org_id);
  END IF;
END $$;

-- Savings
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'savings') THEN
    ALTER TABLE public.savings DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.savings ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_savings_org_id ON public.savings(org_id);
  END IF;
END $$;

-- Lending
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'lending') THEN
    ALTER TABLE public.lending DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.lending ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_lending_org_id ON public.lending(org_id);
  END IF;
END $$;

-- Gold Items
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'gold_items') THEN
    ALTER TABLE public.gold_items DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.gold_items ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_gold_items_org_id ON public.gold_items(org_id);
  END IF;
END $$;

-- Gold History
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'gold_history') THEN
    ALTER TABLE public.gold_history DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.gold_history ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_gold_history_org_id ON public.gold_history(org_id);
  END IF;
END $$;

-- EMI Loans
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'emi_loans') THEN
    ALTER TABLE public.emi_loans DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.emi_loans ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_emi_loans_org_id ON public.emi_loans(org_id);
  END IF;
END $$;

-- Jewel Loans
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'jewel_loans') THEN
    ALTER TABLE public.jewel_loans DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.jewel_loans ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_jewel_loans_org_id ON public.jewel_loans(org_id);
  END IF;
END $$;

-- Jewel Loan Repayments
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'jewel_loan_repayments') THEN
    ALTER TABLE public.jewel_loan_repayments DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.jewel_loan_repayments ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_jewel_loan_repayments_org_id ON public.jewel_loan_repayments(org_id);
  END IF;
END $$;

-- Cash Loans
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'cash_loans') THEN
    ALTER TABLE public.cash_loans DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.cash_loans ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_cash_loans_org_id ON public.cash_loans(org_id);
  END IF;
END $$;

-- Cash Loan Repayments
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'cash_loan_repayments') THEN
    ALTER TABLE public.cash_loan_repayments DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.cash_loan_repayments ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_cash_loan_repayments_org_id ON public.cash_loan_repayments(org_id);
  END IF;
END $$;

-- Stocks
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'stocks') THEN
    ALTER TABLE public.stocks DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.stocks ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_stocks_org_id ON public.stocks(org_id);
  END IF;
END $$;

-- Mutual Funds
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'mutual_funds') THEN
    ALTER TABLE public.mutual_funds DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.mutual_funds ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_mutual_funds_org_id ON public.mutual_funds(org_id);
  END IF;
END $$;

-- Vault Apps
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'vault_apps') THEN
    ALTER TABLE public.vault_apps DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.vault_apps ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_vault_apps_org_id ON public.vault_apps(org_id);
  END IF;
END $$;

-- Banking Records
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'banking_records') THEN
    ALTER TABLE public.banking_records DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.banking_records ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_banking_records_org_id ON public.banking_records(org_id);
  END IF;
END $$;

-- Persons
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'persons') THEN
    ALTER TABLE public.persons DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.persons ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_persons_org_id ON public.persons(org_id);
  END IF;
END $$;

-- Insurance
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'insurance') THEN
    ALTER TABLE public.insurance DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.insurance ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_insurance_org_id ON public.insurance(org_id);
  END IF;
END $$;

-- Staff Members
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'staff_members') THEN
    ALTER TABLE public.staff_members DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_staff_members_org_id ON public.staff_members(org_id);
  END IF;
END $$;

-- Attendance
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'attendance') THEN
    ALTER TABLE public.attendance DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_attendance_org_id ON public.attendance(org_id);
  END IF;
END $$;

-- Subscriptions
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'subscriptions') THEN
    ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS user_email CASCADE;
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS org_id text NOT NULL DEFAULT 'default';
    CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON public.subscriptions(org_id);
  END IF;
END $$;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- Check org_members populated: SELECT COUNT(*) FROM public.org_members;
-- Check user_email removed: SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'user_email';
-- Check org_id added: SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'org_id';
