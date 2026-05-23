--
-- Full PostgreSQL DDL for an empty database (matches Drizzle TS in src/schema/).
-- GENERATED — edit TypeScript only, then: pnpm --filter @fintracker-vault/db run export-schema
-- For existing DBs: pnpm --filter @fintracker-vault/db run drizzle:push.
--
CREATE TABLE "users" (
	"email" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"token" text,
	"last_token_at" timestamp,
	"settings" jsonb,
	"use_db" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "org_members" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"enabled_apps" jsonb DEFAULT '[]',
	"enabled_menus" jsonb DEFAULT '{}',
	"enabled_integrations" jsonb DEFAULT '{}',
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);

CREATE TABLE "schema_migrations" (
	"version" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "budget" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"month_year" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"start_month" text,
	"end_month" text
);

CREATE TABLE "payment_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"description" text,
	"source_type" text NOT NULL,
	"used_for" text DEFAULT 'both' NOT NULL,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0
);

CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"category" text,
	"category_id" text,
	"type" text NOT NULL,
	"mode" text,
	"payment_source_id" text,
	"transfer_to" text,
	"transfer_to_id" text,
	"notes" text,
	"month_year" text NOT NULL
);

CREATE TABLE "savings" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"date" date NOT NULL,
	"account" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"to_account" text,
	"category" text
);

CREATE TABLE "lending" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"sheet_slug" text DEFAULT 'lending' NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" text NOT NULL,
	"description" text
);

CREATE TABLE "gold_history" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"date" date NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"weight_g" numeric(10, 3) NOT NULL,
	"note" text
);

CREATE TABLE "gold_items" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"weight_g" numeric(10, 3) NOT NULL,
	"person_id" text,
	"location_id" text
);

CREATE TABLE "gold_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"skip" boolean DEFAULT false NOT NULL
);

CREATE TABLE "cash_loan_repayments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"loan_id" text NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text
);

CREATE TABLE "cash_loans" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"person_name" text NOT NULL,
	"amount_received" numeric(12, 2) NOT NULL,
	"start_date" date NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL
);

CREATE TABLE "emi_loans" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"bank" text,
	"principal" numeric(12, 2) NOT NULL,
	"rate" numeric(6, 3) NOT NULL,
	"start_date" date NOT NULL,
	"tenure_months" integer NOT NULL,
	"emi_amount" numeric(12, 2) NOT NULL,
	"paid_emis" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Ongoing' NOT NULL
);

CREATE TABLE "jewel_loan_repayments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"loan_id" text NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text
);

CREATE TABLE "jewel_loans" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"bank" text,
	"principal" numeric(12, 2) NOT NULL,
	"rate" numeric(6, 3) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'Ongoing' NOT NULL
);

CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"category" text,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"billing_cycle" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"autopay" boolean DEFAULT false,
	"status" text DEFAULT 'active' NOT NULL,
	"payment_method" text,
	"app_uuid" text,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "banking_records" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"holder_name" text,
	"bank_name" text NOT NULL,
	"account_no_enc" text,
	"ifsc" text,
	"cif_enc" text,
	"username_enc" text,
	"password_enc" text,
	"transaction_password_enc" text,
	"profile_password_enc" text,
	"mpin_enc" text,
	"app_uuid" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "insurance" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"policy_type" text,
	"plan_name" text NOT NULL,
	"insurer" text,
	"app_id" text,
	"policy_no" text,
	"owner" text,
	"premium" numeric(12, 2),
	"premium_mode" text,
	"payment_method" text,
	"issue_date" date,
	"maturity_date" date,
	"sum_assured" numeric(14, 2),
	"cash_value" numeric(14, 2),
	"nominee" text,
	"notes" text,
	"person_uuid" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "persons" (
	"uuid" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"relation" text,
	"dob" date,
	"gender" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "vault_apps" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"app_name" text NOT NULL,
	"category" text,
	"logo" text,
	"app_link" text,
	"username_enc" text,
	"password_enc" text,
	"two_factor" boolean DEFAULT false,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "vault_documents" (
	"doc_uuid" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"person_uuid" text NOT NULL,
	"doc_type" text NOT NULL,
	"doc_number" text,
	"drive_url" text,
	"expiry" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "vault_habit_logs" (
	"log_uuid" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"habit_uuid" text NOT NULL,
	"person_uuid" text NOT NULL,
	"log_date" date NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);

CREATE TABLE "vault_habits" (
	"habit_uuid" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"person_uuid" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"target_frequency" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "vault_health_vitals" (
	"vital_uuid" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"person_uuid" text NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"height_cm" numeric(6, 2),
	"weight_kg" numeric(6, 2),
	"systolic" numeric(5, 1),
	"diastolic" numeric(5, 1),
	"blood_sugar" numeric(6, 2),
	"notes" text
);

CREATE TABLE "vault_illnesses" (
	"illness_uuid" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"person_uuid" text NOT NULL,
	"name" text NOT NULL,
	"diagnosed_on" date,
	"status" text,
	"notes" text
);

CREATE TABLE "vault_medications" (
	"med_uuid" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"person_uuid" text NOT NULL,
	"illness_uuid" text,
	"name" text NOT NULL,
	"dosage" text,
	"frequency" text,
	"start_date" date,
	"end_date" date,
	"reminder_times" text,
	"notes" text
);

CREATE TABLE "mutual_funds" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text,
	"provider_slug" text,
	"holding_key" text,
	"fund_name" text NOT NULL,
	"folio_no" text,
	"instrument_key" text,
	"units" numeric(14, 4),
	"avg_price" numeric(12, 4),
	"last_price" numeric(12, 4),
	"last_price_date" text,
	"purchased" numeric(14, 2),
	"current_value" numeric(14, 2),
	"profit_loss" numeric(14, 2),
	"pledged_quantity" numeric(14, 4),
	"scheme_code" text,
	"synced_at" timestamp
);

CREATE TABLE "stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text,
	"provider_slug" text,
	"symbol" text NOT NULL,
	"company" text,
	"isin" text,
	"qty" numeric(12, 4) NOT NULL,
	"avg_price" numeric(12, 4),
	"last_price" numeric(12, 4),
	"pnl" numeric(14, 2),
	"day_change_pct" numeric(8, 4),
	"synced_at" timestamp
);

CREATE TABLE "integration_providers" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_enc" text NOT NULL,
	"endpoints" jsonb DEFAULT '{}' NOT NULL,
	"app_menus" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "org_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"provider_slug" text NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp,
	"connected_by_email" text,
	"last_sync_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"staff_id" text NOT NULL,
	"month_year" text NOT NULL,
	"day" integer NOT NULL,
	"status" text NOT NULL,
	"notes" text
);

CREATE TABLE "staff_members" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"role" text,
	"gender" text,
	"joined_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"salary_type" text,
	"salary_amount" text
);

CREATE UNIQUE INDEX "org_members_org_user_unique" ON "org_members" USING btree ("org_id","user_email");
