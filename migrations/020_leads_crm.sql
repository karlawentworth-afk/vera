-- Leads CRM
CREATE TYPE lead_stage AS ENUM ('new', 'contacted', 'qualified', 'demo_booked', 'proposal_sent', 'negotiating', 'won', 'lost');

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES profiles(id),
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  job_title text,
  company_name text,
  company_size text CHECK (company_size IN ('small', 'medium', 'large', 'enterprise')),
  industry text,
  source text,
  stage lead_stage NOT NULL DEFAULT 'new',
  estimated_value_pence integer,
  lost_reason text,
  next_action text,
  next_action_date date,
  converted_to_quote_id uuid REFERENCES quotes(id),
  converted_to_organisation_id uuid REFERENCES organisations(id),
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS lead_seq START 100;

CREATE OR REPLACE FUNCTION generate_lead_ref()
RETURNS trigger AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'LEAD-' || LPAD(nextval('lead_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_lead_ref BEFORE INSERT ON leads FOR EACH ROW EXECUTE FUNCTION generate_lead_ref();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_leads_owner ON leads(owner_id);
CREATE INDEX idx_leads_stage ON leads(stage);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin: full access to leads" ON leads FOR ALL TO authenticated USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
CREATE POLICY "Salesperson: manage own leads" ON leads FOR ALL TO authenticated USING (owner_id = auth.uid() AND auth_role() = 'salesperson') WITH CHECK (owner_id = auth.uid() AND auth_role() = 'salesperson');

-- Lead notes
CREATE TABLE IF NOT EXISTS lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_notes_lead ON lead_notes(lead_id);
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin: full access to lead_notes" ON lead_notes FOR ALL TO authenticated USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
CREATE POLICY "Salesperson: manage own lead notes" ON lead_notes FOR ALL TO authenticated
  USING (auth_role() = 'salesperson' AND lead_id IN (SELECT id FROM leads WHERE owner_id = auth.uid()))
  WITH CHECK (auth_role() = 'salesperson' AND lead_id IN (SELECT id FROM leads WHERE owner_id = auth.uid()));

-- Lead activities
CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'stage_change')),
  summary text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id);
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin: full access to lead_activities" ON lead_activities FOR ALL TO authenticated USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
CREATE POLICY "Salesperson: manage own lead activities" ON lead_activities FOR ALL TO authenticated
  USING (auth_role() = 'salesperson' AND lead_id IN (SELECT id FROM leads WHERE owner_id = auth.uid()))
  WITH CHECK (auth_role() = 'salesperson' AND lead_id IN (SELECT id FROM leads WHERE owner_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
