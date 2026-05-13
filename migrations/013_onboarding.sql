-- Onboarding tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Onboarding type on orgs
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS onboarding_type text DEFAULT 'standard' CHECK (onboarding_type IN ('standard', 'guided'));

NOTIFY pgrst, 'reload schema';
