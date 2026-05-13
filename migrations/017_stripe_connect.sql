-- Stripe Connect fields on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_account_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_completed_at timestamptz;

-- Stripe transfer tracking on payouts
ALTER TABLE reviewer_payouts ADD COLUMN IF NOT EXISTS stripe_transfer_id text;
ALTER TABLE commission_payouts ADD COLUMN IF NOT EXISTS stripe_transfer_id text;

NOTIFY pgrst, 'reload schema';
