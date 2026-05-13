-- ============================================================
-- SALESPERSON FEATURE
-- ============================================================

-- 1. Add 'salesperson' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'salesperson';

-- 2. Add default commission fields to profiles (for salespeople)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_finders_fee_pct numeric(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_recurring_pct numeric(5,2);

-- 3. Add introducing_salesperson_id to organisations
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS introducing_salesperson_id uuid REFERENCES profiles(id);

-- 4. Add salesperson_id to quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES profiles(id);

-- 5. Commission payout status enum
CREATE TYPE commission_payout_status AS ENUM ('pending', 'processing', 'paid');

-- 6. Commission agreements table
CREATE TABLE commission_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesperson_id uuid NOT NULL REFERENCES profiles(id),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  finders_fee_pence integer,
  finders_fee_pct numeric(5,2),
  recurring_commission_pct numeric(5,2) NOT NULL DEFAULT 10,
  recurring_duration_months integer,  -- NULL = lifetime
  starts_at date NOT NULL DEFAULT CURRENT_DATE,
  ends_at date,  -- calculated or null
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_finders_fee CHECK (
    NOT (finders_fee_pence IS NOT NULL AND finders_fee_pct IS NOT NULL)
  )
);

-- 7. Commission payouts sequence
CREATE SEQUENCE commission_payout_seq START 100;

-- 8. Commission payouts table
CREATE TABLE commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  salesperson_id uuid NOT NULL REFERENCES profiles(id),
  agreement_id uuid NOT NULL REFERENCES commission_agreements(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount_pence integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('finders_fee', 'recurring')),
  status commission_payout_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  xero_bill_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-generate payout references
CREATE OR REPLACE FUNCTION generate_commission_reference()
RETURNS trigger AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'COMM-' || nextval('commission_payout_seq')::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_commission_reference
  BEFORE INSERT ON commission_payouts
  FOR EACH ROW
  EXECUTE FUNCTION generate_commission_reference();

-- 9. Indexes
CREATE INDEX idx_commission_agreements_salesperson ON commission_agreements(salesperson_id);
CREATE INDEX idx_commission_agreements_org ON commission_agreements(organisation_id);
CREATE INDEX idx_commission_payouts_salesperson ON commission_payouts(salesperson_id);
CREATE INDEX idx_commission_payouts_agreement ON commission_payouts(agreement_id);

-- 10. Updated_at triggers
CREATE TRIGGER update_commission_agreements_updated_at
  BEFORE UPDATE ON commission_agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_commission_payouts_updated_at
  BEFORE UPDATE ON commission_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 11. RLS
ALTER TABLE commission_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payouts ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin: full access to commission_agreements"
  ON commission_agreements FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Admin: full access to commission_payouts"
  ON commission_payouts FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- Salesperson: read own
CREATE POLICY "Salesperson: read own agreements"
  ON commission_agreements FOR SELECT TO authenticated
  USING (salesperson_id = auth.uid() AND auth_role() = 'salesperson');

CREATE POLICY "Salesperson: read own payouts"
  ON commission_payouts FOR SELECT TO authenticated
  USING (salesperson_id = auth.uid() AND auth_role() = 'salesperson');

NOTIFY pgrst, 'reload schema';
