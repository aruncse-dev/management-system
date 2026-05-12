--
-- PostgreSQL database dump
--

\restrict J4MYve3sh5EjumgpeGAW4gF5Vb9VwwLjX10nj4yBgS9jTkHUbp9Gpn0fE9GmPGI

-- Dumped from database version 17.8 (ad62774)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: neon_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA neon_auth;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: invitation; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.invitation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    email text NOT NULL,
    role text,
    status text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "inviterId" uuid NOT NULL
);


--
-- Name: jwks; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.jwks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "publicKey" text NOT NULL,
    "privateKey" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "expiresAt" timestamp with time zone
);


--
-- Name: member; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);


--
-- Name: organization; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    "createdAt" timestamp with time zone NOT NULL,
    metadata text
);


--
-- Name: project_config; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.project_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    endpoint_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    trusted_origins jsonb NOT NULL,
    social_providers jsonb NOT NULL,
    email_provider jsonb,
    email_and_password jsonb,
    allow_localhost boolean NOT NULL,
    plugin_configs jsonb,
    webhook_config jsonb
);


--
-- Name: session; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" uuid NOT NULL,
    "impersonatedBy" text,
    "activeOrganizationId" text
);


--
-- Name: user; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role text,
    banned boolean,
    "banReason" text,
    "banExpires" timestamp with time zone
);


--
-- Name: verification; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id text NOT NULL,
    name text NOT NULL,
    type text,
    org_id text,
    description text,
    used_for text DEFAULT 'both'::text NOT NULL,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0
);


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id text NOT NULL,
    staff_id text NOT NULL,
    month_year text NOT NULL,
    day integer NOT NULL,
    status text NOT NULL,
    notes text,
    org_id text
);


--
-- Name: banking_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banking_records (
    id text NOT NULL,
    holder_name text,
    bank_name text NOT NULL,
    account_no text,
    ifsc text,
    cif text,
    username text,
    password text,
    transaction_password text,
    profile_password text,
    mpin text,
    app_uuid text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    org_id text
);


--
-- Name: budget; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget (
    id text NOT NULL,
    org_id text,
    month_year text NOT NULL,
    category text NOT NULL,
    amount numeric(12,2) NOT NULL
);


--
-- Name: cash_loan_repayments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_loan_repayments (
    id text NOT NULL,
    loan_id text NOT NULL,
    date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    note text,
    org_id text
);


--
-- Name: cash_loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_loans (
    id text NOT NULL,
    person_name text NOT NULL,
    amount_received numeric(12,2) NOT NULL,
    start_date date NOT NULL,
    paid_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    org_id text
);


--
-- Name: credit_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_sources (
    id text NOT NULL,
    org_id text,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0
);


--
-- Name: emi_loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emi_loans (
    id text NOT NULL,
    name text NOT NULL,
    bank text,
    principal numeric(12,2) NOT NULL,
    rate numeric(6,3) NOT NULL,
    start_date date NOT NULL,
    tenure_months integer NOT NULL,
    emi_amount numeric(12,2) NOT NULL,
    paid_emis integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'Ongoing'::text NOT NULL,
    org_id text
);


--
-- Name: gold_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gold_history (
    id text NOT NULL,
    date date NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    weight_g numeric(10,3) NOT NULL,
    note text,
    org_id text
);


--
-- Name: gold_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gold_items (
    id text NOT NULL,
    name text NOT NULL,
    weight_g numeric(10,3) NOT NULL,
    person text,
    location text,
    org_id text
);


--
-- Name: insurance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance (
    id text NOT NULL,
    policy_type text,
    plan_name text NOT NULL,
    insurer text,
    app_id text,
    policy_no text,
    owner text,
    premium numeric(12,2),
    premium_mode text,
    payment_method text,
    issue_date date,
    maturity_date date,
    sum_assured numeric(14,2),
    cash_value numeric(14,2),
    nominee text,
    notes text,
    person_uuid text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    org_id text
);


--
-- Name: jewel_loan_repayments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jewel_loan_repayments (
    id text NOT NULL,
    loan_id text NOT NULL,
    date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    note text,
    org_id text
);


--
-- Name: jewel_loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jewel_loans (
    id text NOT NULL,
    name text NOT NULL,
    bank text,
    principal numeric(12,2) NOT NULL,
    rate numeric(6,3) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    paid_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    status text DEFAULT 'Ongoing'::text NOT NULL,
    org_id text
);


--
-- Name: lending; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lending (
    id text NOT NULL,
    date date NOT NULL,
    name text NOT NULL,
    amount numeric(12,2) NOT NULL,
    type text NOT NULL,
    description text,
    org_id text
);


--
-- Name: mutual_funds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mutual_funds (
    id integer NOT NULL,
    fund_name text NOT NULL,
    folio_no text,
    units numeric(14,4),
    purchased numeric(14,2),
    current_value numeric(14,2),
    profit_loss numeric(14,2),
    scheme_code text,
    org_id text
);


--
-- Name: mutual_funds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mutual_funds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mutual_funds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mutual_funds_id_seq OWNED BY public.mutual_funds.id;


--
-- Name: org_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_members (
    id text NOT NULL,
    org_id text NOT NULL,
    user_email text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id text NOT NULL,
    name text NOT NULL,
    slug text,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    enabled_apps jsonb DEFAULT '[]'::jsonb,
    enabled_menus jsonb DEFAULT '{}'::jsonb
);


--
-- Name: persons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persons (
    uuid text NOT NULL,
    name text NOT NULL,
    relation text,
    dob date,
    gender text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    org_id text
);


--
-- Name: savings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.savings (
    id text NOT NULL,
    date date NOT NULL,
    account text NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text,
    type text NOT NULL,
    to_account text,
    category text,
    org_id text
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: staff_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_members (
    id text NOT NULL,
    name text NOT NULL,
    role text,
    joined_date date,
    status text DEFAULT 'active'::text NOT NULL,
    org_id text
);


--
-- Name: stocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stocks (
    id integer NOT NULL,
    symbol text NOT NULL,
    company text,
    isin text,
    qty numeric(12,4) NOT NULL,
    avg_price numeric(12,4),
    last_price numeric(12,4),
    pnl numeric(14,2),
    day_change_pct numeric(8,4),
    synced_at timestamp without time zone,
    org_id text
);


--
-- Name: stocks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stocks_id_seq OWNED BY public.stocks.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id text NOT NULL,
    name text NOT NULL,
    category text,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    billing_cycle text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    autopay boolean DEFAULT false,
    status text DEFAULT 'active'::text NOT NULL,
    payment_method text,
    app_uuid text,
    notes text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    org_id text
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id text NOT NULL,
    date date NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    category text,
    type text NOT NULL,
    mode text,
    notes text,
    month_year text NOT NULL,
    org_id text
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    email text NOT NULL,
    display_name text,
    role text DEFAULT 'user'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    settings jsonb,
    use_db boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    id text,
    token text,
    last_token_at timestamp without time zone
);


--
-- Name: vault_apps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vault_apps (
    id text NOT NULL,
    app_name text NOT NULL,
    category text,
    logo text,
    app_link text,
    username text,
    password text,
    two_factor boolean DEFAULT false,
    notes text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    org_id text
);


--
-- Name: mutual_funds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mutual_funds ALTER COLUMN id SET DEFAULT nextval('public.mutual_funds_id_seq'::regclass);


--
-- Name: stocks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocks ALTER COLUMN id SET DEFAULT nextval('public.stocks_id_seq'::regclass);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: jwks jwks_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.jwks
    ADD CONSTRAINT jwks_pkey PRIMARY KEY (id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization organization_slug_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_slug_key UNIQUE (slug);


--
-- Name: project_config project_config_endpoint_id_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_endpoint_id_key UNIQUE (endpoint_id);


--
-- Name: project_config project_config_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: banking_records banking_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banking_records
    ADD CONSTRAINT banking_records_pkey PRIMARY KEY (id);


--
-- Name: budget budget_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget
    ADD CONSTRAINT budget_pkey PRIMARY KEY (id);


--
-- Name: cash_loan_repayments cash_loan_repayments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_loan_repayments
    ADD CONSTRAINT cash_loan_repayments_pkey PRIMARY KEY (id);


--
-- Name: cash_loans cash_loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_loans
    ADD CONSTRAINT cash_loans_pkey PRIMARY KEY (id);


--
-- Name: credit_sources credit_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_sources
    ADD CONSTRAINT credit_sources_pkey PRIMARY KEY (id);


--
-- Name: emi_loans emi_loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emi_loans
    ADD CONSTRAINT emi_loans_pkey PRIMARY KEY (id);


--
-- Name: gold_history gold_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gold_history
    ADD CONSTRAINT gold_history_pkey PRIMARY KEY (id);


--
-- Name: gold_items gold_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gold_items
    ADD CONSTRAINT gold_items_pkey PRIMARY KEY (id);


--
-- Name: insurance insurance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance
    ADD CONSTRAINT insurance_pkey PRIMARY KEY (id);


--
-- Name: jewel_loan_repayments jewel_loan_repayments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jewel_loan_repayments
    ADD CONSTRAINT jewel_loan_repayments_pkey PRIMARY KEY (id);


--
-- Name: jewel_loans jewel_loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jewel_loans
    ADD CONSTRAINT jewel_loans_pkey PRIMARY KEY (id);


--
-- Name: lending lending_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lending
    ADD CONSTRAINT lending_pkey PRIMARY KEY (id);


--
-- Name: mutual_funds mutual_funds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mutual_funds
    ADD CONSTRAINT mutual_funds_pkey PRIMARY KEY (id);


--
-- Name: org_members org_members_org_id_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_org_id_user_email_key UNIQUE (org_id, user_email);


--
-- Name: org_members org_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (uuid);


--
-- Name: savings savings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.savings
    ADD CONSTRAINT savings_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: staff_members staff_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_members
    ADD CONSTRAINT staff_members_pkey PRIMARY KEY (id);


--
-- Name: stocks stocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT stocks_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (email);


--
-- Name: vault_apps vault_apps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vault_apps
    ADD CONSTRAINT vault_apps_pkey PRIMARY KEY (id);


--
-- Name: account_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "account_userId_idx" ON neon_auth.account USING btree ("userId");


--
-- Name: invitation_email_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX invitation_email_idx ON neon_auth.invitation USING btree (email);


--
-- Name: invitation_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "invitation_organizationId_idx" ON neon_auth.invitation USING btree ("organizationId");


--
-- Name: member_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "member_organizationId_idx" ON neon_auth.member USING btree ("organizationId");


--
-- Name: member_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "member_userId_idx" ON neon_auth.member USING btree ("userId");


--
-- Name: organization_slug_uidx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE UNIQUE INDEX organization_slug_uidx ON neon_auth.organization USING btree (slug);


--
-- Name: session_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "session_userId_idx" ON neon_auth.session USING btree ("userId");


--
-- Name: verification_identifier_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX verification_identifier_idx ON neon_auth.verification USING btree (identifier);


--
-- Name: idx_accounts_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_org_id ON public.accounts USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_attendance_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_org_id ON public.attendance USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_banking_records_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_banking_records_org_id ON public.banking_records USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_budget_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_org_id ON public.budget USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_budget_org_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_org_month ON public.budget USING btree (org_id, month_year) WHERE (org_id IS NOT NULL);


--
-- Name: idx_cash_loan_repayments_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_loan_repayments_org_id ON public.cash_loan_repayments USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_cash_loans_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_loans_org_id ON public.cash_loans USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_credit_sources_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_sources_org_id ON public.credit_sources USING btree (org_id);


--
-- Name: idx_emi_loans_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emi_loans_org_id ON public.emi_loans USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_gold_history_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gold_history_org_id ON public.gold_history USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_gold_items_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gold_items_org_id ON public.gold_items USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_insurance_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insurance_org_id ON public.insurance USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_jewel_loan_repayments_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jewel_loan_repayments_org_id ON public.jewel_loan_repayments USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_jewel_loans_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jewel_loans_org_id ON public.jewel_loans USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_lending_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lending_org_id ON public.lending USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_mutual_funds_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mutual_funds_org_id ON public.mutual_funds USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_org_members_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_org_id ON public.org_members USING btree (org_id);


--
-- Name: idx_org_members_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_user_email ON public.org_members USING btree (user_email);


--
-- Name: idx_persons_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_org_id ON public.persons USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_savings_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_savings_org_id ON public.savings USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_staff_members_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_members_org_id ON public.staff_members USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_stocks_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stocks_org_id ON public.stocks USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_subscriptions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_org_id ON public.subscriptions USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_transactions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_org_id ON public.transactions USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_vault_apps_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vault_apps_org_id ON public.vault_apps USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_inviterId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: attendance attendance_staff_id_staff_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_staff_id_staff_members_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff_members(id);


--
-- Name: banking_records banking_records_app_uuid_vault_apps_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banking_records
    ADD CONSTRAINT banking_records_app_uuid_vault_apps_id_fk FOREIGN KEY (app_uuid) REFERENCES public.vault_apps(id);


--
-- Name: cash_loan_repayments cash_loan_repayments_loan_id_cash_loans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_loan_repayments
    ADD CONSTRAINT cash_loan_repayments_loan_id_cash_loans_id_fk FOREIGN KEY (loan_id) REFERENCES public.cash_loans(id);


--
-- Name: insurance insurance_app_id_vault_apps_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance
    ADD CONSTRAINT insurance_app_id_vault_apps_id_fk FOREIGN KEY (app_id) REFERENCES public.vault_apps(id);


--
-- Name: insurance insurance_person_uuid_persons_uuid_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance
    ADD CONSTRAINT insurance_person_uuid_persons_uuid_fk FOREIGN KEY (person_uuid) REFERENCES public.persons(uuid);


--
-- Name: jewel_loan_repayments jewel_loan_repayments_loan_id_jewel_loans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jewel_loan_repayments
    ADD CONSTRAINT jewel_loan_repayments_loan_id_jewel_loans_id_fk FOREIGN KEY (loan_id) REFERENCES public.jewel_loans(id);


--
-- PostgreSQL database dump complete
--

\unrestrict J4MYve3sh5EjumgpeGAW4gF5Vb9VwwLjX10nj4yBgS9jTkHUbp9Gpn0fE9GmPGI

