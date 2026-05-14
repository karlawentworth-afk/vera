-- Multi-currency support
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE usage_charges ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE commission_agreements ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE commission_payouts ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE reviewer_payouts ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_currency text NOT NULL DEFAULT 'GBP';

-- Tier pricing per currency
ALTER TABLE tier_config ADD COLUMN IF NOT EXISTS prices_by_currency jsonb DEFAULT '{"GBP": null}'::jsonb;

-- Exchange rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL,
  target_currency text NOT NULL,
  rate numeric(10,6) NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  source text DEFAULT 'manual',
  UNIQUE (base_currency, target_currency, valid_from)
);

CREATE INDEX idx_exchange_rates_pair ON exchange_rates(base_currency, target_currency, valid_from DESC);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone: read exchange_rates" ON exchange_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin: manage exchange_rates" ON exchange_rates FOR ALL TO authenticated USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

-- Seed initial rates (approximate)
INSERT INTO exchange_rates (base_currency, target_currency, rate, source) VALUES
  ('GBP', 'EUR', 1.17, 'seed'),
  ('GBP', 'USD', 1.27, 'seed'),
  ('GBP', 'CHF', 1.12, 'seed'),
  ('GBP', 'JPY', 193.50, 'seed'),
  ('EUR', 'GBP', 0.85, 'seed'),
  ('USD', 'GBP', 0.79, 'seed'),
  ('CHF', 'GBP', 0.89, 'seed'),
  ('JPY', 'GBP', 0.0052, 'seed')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
