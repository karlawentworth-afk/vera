-- Usage-based charges (overflow + expedited)
CREATE TABLE IF NOT EXISTS usage_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  subscription_id uuid REFERENCES subscriptions(id),
  kind text NOT NULL CHECK (kind IN ('overflow', 'expedited')),
  job_id uuid REFERENCES jobs(id),
  words integer NOT NULL,
  rate_pence_per_word integer NOT NULL,
  amount_pence integer NOT NULL,
  billing_period text NOT NULL,  -- YYYY-MM
  invoiced boolean NOT NULL DEFAULT false,
  stripe_invoice_item_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_charges_org ON usage_charges(organisation_id);
CREATE INDEX idx_usage_charges_period ON usage_charges(billing_period, invoiced);

ALTER TABLE usage_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to usage_charges"
  ON usage_charges FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: read own usage_charges"
  ON usage_charges FOR SELECT TO authenticated
  USING (organisation_id = auth_org_id() AND auth_role() = 'client');

NOTIFY pgrst, 'reload schema';
