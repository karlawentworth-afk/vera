-- Cron run log
CREATE TABLE IF NOT EXISTS cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  records_processed integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cron_runs_job ON cron_runs(job_name, started_at DESC);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to cron_runs"
  ON cron_runs FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  subscription_amount_pence integer NOT NULL DEFAULT 0,
  overflow_amount_pence integer NOT NULL DEFAULT 0,
  expedited_amount_pence integer NOT NULL DEFAULT 0,
  total_amount_pence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  issued_at timestamptz,
  paid_at timestamptz,
  xero_invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1040;

CREATE INDEX idx_invoices_org ON invoices(organisation_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to invoices"
  ON invoices FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: read own invoices"
  ON invoices FOR SELECT TO authenticated
  USING (organisation_id = auth_org_id() AND auth_role() = 'client');

-- Reviewer payouts table (separate from commission payouts)
CREATE TABLE IF NOT EXISTS reviewer_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  words_reviewed integer NOT NULL DEFAULT 0,
  amount_pence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid')),
  scheduled_for date,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS reviewer_payout_seq START 200;

ALTER TABLE reviewer_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to reviewer_payouts"
  ON reviewer_payouts FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Reviewer: read own payouts"
  ON reviewer_payouts FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() AND auth_role() = 'reviewer');

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_reviewer_payouts_updated_at BEFORE UPDATE ON reviewer_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
