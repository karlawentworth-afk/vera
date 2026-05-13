-- Reviewer invoices
CREATE TYPE reviewer_invoice_status AS ENUM ('draft', 'submitted', 'approved', 'paid', 'queried', 'rejected');

CREATE TABLE IF NOT EXISTS reviewer_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount_pence integer NOT NULL DEFAULT 0,
  vat_pence integer NOT NULL DEFAULT 0,
  total_pence integer NOT NULL DEFAULT 0,
  job_ids uuid[] DEFAULT '{}',
  line_items jsonb DEFAULT '[]'::jsonb,
  status reviewer_invoice_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  queried_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  reviewer_notes text,
  admin_notes text,
  attachment_path text,
  xero_bill_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS reviewer_invoice_seq START 10;

CREATE OR REPLACE FUNCTION generate_reviewer_invoice_ref()
RETURNS trigger AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'RINV-' || LPAD(nextval('reviewer_invoice_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_reviewer_invoice_ref
  BEFORE INSERT ON reviewer_invoices
  FOR EACH ROW EXECUTE FUNCTION generate_reviewer_invoice_ref();

CREATE INDEX idx_reviewer_invoices_reviewer ON reviewer_invoices(reviewer_id);
CREATE INDEX idx_reviewer_invoices_status ON reviewer_invoices(status);

ALTER TABLE reviewer_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to reviewer_invoices"
  ON reviewer_invoices FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Reviewer: manage own invoices"
  ON reviewer_invoices FOR ALL TO authenticated
  USING (reviewer_id = auth.uid() AND auth_role() = 'reviewer')
  WITH CHECK (reviewer_id = auth.uid() AND auth_role() = 'reviewer');

CREATE TRIGGER update_reviewer_invoices_updated_at BEFORE UPDATE ON reviewer_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
