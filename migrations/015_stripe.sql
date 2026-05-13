-- Stripe integration fields
ALTER TABLE tier_config ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Stripe events for webhook idempotency
CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,  -- Stripe event ID
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin: full access to stripe_events"
  ON stripe_events FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

NOTIFY pgrst, 'reload schema';
