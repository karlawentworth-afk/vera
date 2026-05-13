-- Add is_demo flag to all data tables
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE job_segments ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE tier_config ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE usage_charges ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE reviewer_payouts ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE commission_agreements ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE commission_payouts ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE ai_health_snapshots ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE glossary_entries ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE brand_voice_notes ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE cron_runs ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Add is_demo to tables that may exist from later migrations
DO $$ BEGIN
  ALTER TABLE reviewer_invoices ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE lead_notes ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Mark ALL existing data as demo (since it was seeded)
UPDATE organisations SET is_demo = true WHERE type = 'client';
UPDATE profiles SET is_demo = true WHERE role != 'admin';
UPDATE subscriptions SET is_demo = true;
UPDATE jobs SET is_demo = true;
UPDATE job_segments SET is_demo = true;
UPDATE scores SET is_demo = true;
UPDATE quotes SET is_demo = true;
UPDATE invoices SET is_demo = true;
UPDATE usage_charges SET is_demo = true;
UPDATE reviewer_payouts SET is_demo = true;
UPDATE commission_agreements SET is_demo = true;
UPDATE commission_payouts SET is_demo = true;
UPDATE recommendations SET is_demo = true;
UPDATE ai_health_snapshots SET is_demo = true;
UPDATE audit_log SET is_demo = true;
UPDATE email_log SET is_demo = true;
UPDATE glossary_entries SET is_demo = true;
UPDATE brand_voice_notes SET is_demo = true;
UPDATE cron_runs SET is_demo = true;

-- Admin profiles stay is_demo=false (they access both modes)
-- Operator org stays is_demo=false

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_organisations_demo ON organisations(is_demo);
CREATE INDEX IF NOT EXISTS idx_jobs_demo ON jobs(is_demo);
CREATE INDEX IF NOT EXISTS idx_profiles_demo ON profiles(is_demo);

NOTIFY pgrst, 'reload schema';
