-- Global pricing settings (single-row table)
CREATE TABLE IF NOT EXISTS pricing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payg_rate_pence integer NOT NULL DEFAULT 10,
  expedited_surcharge_pct integer NOT NULL DEFAULT 50,
  health_check_fee_pence integer NOT NULL DEFAULT 500000,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the single row
INSERT INTO pricing_settings (payg_rate_pence, expedited_surcharge_pct, health_check_fee_pence)
VALUES (10, 50, 500000)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to pricing_settings"
  ON pricing_settings FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Authenticated: read pricing_settings"
  ON pricing_settings FOR SELECT TO authenticated
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_pricing_settings_updated_at
  BEFORE UPDATE ON pricing_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
