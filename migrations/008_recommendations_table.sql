-- Recommendations table (AI-generated)
CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'neutral' CHECK (severity IN ('positive', 'neutral', 'attention')),
  related_language_pair text,
  related_ai_tool text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_org ON recommendations(organisation_id);

-- RLS
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to recommendations"
  ON recommendations FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: read own recommendations"
  ON recommendations FOR SELECT TO authenticated
  USING (organisation_id = auth_org_id() AND auth_role() = 'client');

CREATE POLICY "Client: update own recommendations (dismiss)"
  ON recommendations FOR UPDATE TO authenticated
  USING (organisation_id = auth_org_id() AND auth_role() = 'client')
  WITH CHECK (organisation_id = auth_org_id() AND auth_role() = 'client');

NOTIFY pgrst, 'reload schema';
