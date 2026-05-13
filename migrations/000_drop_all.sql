-- Drop everything and start fresh
-- Run this BEFORE 001_initial_schema.sql if you have an existing schema

-- Drop policies first (they reference tables)
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Drop triggers
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.trigger_name, r.event_object_table);
  END LOOP;
END $$;

-- Drop functions
DROP FUNCTION IF EXISTS auth_role() CASCADE;
DROP FUNCTION IF EXISTS auth_org_id() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS generate_job_number() CASCADE;

-- Drop tables in dependency order
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS tier_config CASCADE;
DROP TABLE IF EXISTS organisations CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS job_number_seq;

-- Drop enums
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS job_status CASCADE;
DROP TYPE IF EXISTS urgency_level CASCADE;
DROP TYPE IF EXISTS quote_status CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS org_type CASCADE;
