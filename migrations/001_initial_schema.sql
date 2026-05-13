-- Vera initial schema
-- Run this in the Supabase SQL Editor

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'client', 'reviewer');
CREATE TYPE job_status AS ENUM ('unallocated', 'in_review', 'awaiting_signoff', 'delivered', 'cancelled');
CREATE TYPE urgency_level AS ENUM ('standard', 'expedited');
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'declined');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due');
CREATE TYPE org_type AS ENUM ('operator', 'client');

-- ============================================================
-- TABLES
-- ============================================================

-- Organisations (ECLS operator + client companies)
CREATE TABLE organisations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        org_type NOT NULL DEFAULT 'client',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- User profiles (linked 1:1 with auth.users)
CREATE TABLE profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text NOT NULL,
  full_name         text NOT NULL,
  role              user_role NOT NULL,
  organisation_id   uuid REFERENCES organisations(id),
  languages         text[] DEFAULT '{}',
  specialism        text,
  rate_per_word     numeric(6,4),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Subscription tier configuration (editable by Emma)
CREATE TABLE tier_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL UNIQUE,
  monthly_price_pence integer NOT NULL,
  word_allowance      integer,          -- NULL = unlimited
  overflow_rate_pence integer NOT NULL DEFAULT 8,  -- pence per word
  colour              text NOT NULL DEFAULT '#1FA1D6',
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Client subscriptions
CREATE TABLE subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tier_name             text NOT NULL,
  monthly_price_pence   integer NOT NULL,
  word_allowance        integer,
  overflow_rate_pence   integer DEFAULT 8,
  status                subscription_status NOT NULL DEFAULT 'active',
  current_period_start  timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end    timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Jobs
CREATE TABLE jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number        text NOT NULL UNIQUE,
  organisation_id   uuid NOT NULL REFERENCES organisations(id),
  source_language   text NOT NULL,
  target_language   text NOT NULL,
  content_type      text NOT NULL,
  ai_tool_used      text,
  word_count        integer NOT NULL,
  urgency           urgency_level NOT NULL DEFAULT 'standard',
  status            job_status NOT NULL DEFAULT 'unallocated',
  reviewer_id       uuid REFERENCES profiles(id),
  notes             text,
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  due_at            timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  delivered_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Job number sequence
CREATE SEQUENCE job_number_seq START 2880;

-- Auto-generate job numbers
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    NEW.job_number := 'V-' || nextval('job_number_seq')::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_job_number
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION generate_job_number();

-- Scores (hTER reviews)
CREATE TABLE scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reviewer_id     uuid NOT NULL REFERENCES profiles(id),
  accuracy        integer NOT NULL CHECK (accuracy BETWEEN 1 AND 10),
  terminology     integer NOT NULL CHECK (terminology BETWEEN 1 AND 10),
  tone_register   integer NOT NULL CHECK (tone_register BETWEEN 1 AND 10),
  brand_voice     integer NOT NULL CHECK (brand_voice BETWEEN 1 AND 10),
  cultural_fit    integer NOT NULL CHECK (cultural_fit BETWEEN 1 AND 10),
  risk            integer NOT NULL CHECK (risk BETWEEN 1 AND 10),
  hter_score      numeric(4,3) NOT NULL,
  reviewer_notes  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Quotes (pre-sales pipeline)
CREATE TABLE quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number    text NOT NULL UNIQUE,
  prospect_name   text NOT NULL,
  proposal        text NOT NULL,
  monthly_value   integer NOT NULL,  -- pence
  status          quote_status NOT NULL DEFAULT 'draft',
  sent_at         timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Audit log
CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES profiles(id),
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_org ON profiles(organisation_id);
CREATE INDEX idx_jobs_org ON jobs(organisation_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_reviewer ON jobs(reviewer_id);
CREATE INDEX idx_scores_job ON scores(job_id);
CREATE INDEX idx_subscriptions_org ON subscriptions(organisation_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organisations_updated_at BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tier_config_updated_at BEFORE UPDATE ON tier_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's organisation
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid AS $$
  SELECT organisation_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ORGANISATIONS
CREATE POLICY "Admin: full access to organisations"
  ON organisations FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: read own organisation"
  ON organisations FOR SELECT TO authenticated
  USING (id = auth_org_id() AND auth_role() = 'client');

-- PROFILES
CREATE POLICY "Admin: full access to profiles"
  ON profiles FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Users: read own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Client: read profiles in own org"
  ON profiles FOR SELECT TO authenticated
  USING (organisation_id = auth_org_id() AND auth_role() = 'client');

-- TIER_CONFIG
CREATE POLICY "Admin: full access to tier_config"
  ON tier_config FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Authenticated: read tier_config"
  ON tier_config FOR SELECT TO authenticated
  USING (true);

-- SUBSCRIPTIONS
CREATE POLICY "Admin: full access to subscriptions"
  ON subscriptions FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: read own subscription"
  ON subscriptions FOR SELECT TO authenticated
  USING (organisation_id = auth_org_id() AND auth_role() = 'client');

-- JOBS
CREATE POLICY "Admin: full access to jobs"
  ON jobs FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: read own jobs"
  ON jobs FOR SELECT TO authenticated
  USING (organisation_id = auth_org_id() AND auth_role() = 'client');

CREATE POLICY "Client: insert own jobs"
  ON jobs FOR INSERT TO authenticated
  WITH CHECK (organisation_id = auth_org_id() AND auth_role() = 'client');

CREATE POLICY "Reviewer: read assigned jobs"
  ON jobs FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() AND auth_role() = 'reviewer');

CREATE POLICY "Reviewer: update assigned jobs"
  ON jobs FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid() AND auth_role() = 'reviewer')
  WITH CHECK (reviewer_id = auth.uid() AND auth_role() = 'reviewer');

-- SCORES
CREATE POLICY "Admin: full access to scores"
  ON scores FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: read scores for own jobs"
  ON scores FOR SELECT TO authenticated
  USING (
    auth_role() = 'client' AND
    job_id IN (SELECT id FROM jobs WHERE organisation_id = auth_org_id())
  );

CREATE POLICY "Reviewer: read and insert own scores"
  ON scores FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() AND auth_role() = 'reviewer');

CREATE POLICY "Reviewer: insert own scores"
  ON scores FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid() AND auth_role() = 'reviewer');

-- QUOTES
CREATE POLICY "Admin: full access to quotes"
  ON quotes FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- AUDIT LOG
CREATE POLICY "Admin: full access to audit_log"
  ON audit_log FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: read own audit entries"
  ON audit_log FOR SELECT TO authenticated
  USING (
    auth_role() = 'client' AND
    entity_type = 'job' AND
    entity_id IN (SELECT id::text FROM jobs WHERE organisation_id = auth_org_id())
  );

-- ============================================================
-- DONE
-- ============================================================
