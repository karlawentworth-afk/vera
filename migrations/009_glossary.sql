-- Glossary entries
CREATE TABLE IF NOT EXISTS glossary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  source_term text NOT NULL,
  target_language text NOT NULL,
  preferred_translation text NOT NULL,
  do_not_translate boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_glossary_org ON glossary_entries(organisation_id);

-- Brand voice notes (one per org)
CREATE TABLE IF NOT EXISTS brand_voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE UNIQUE,
  guidelines text,
  tone_descriptors text[] DEFAULT '{}',
  forbidden_phrases text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE glossary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to glossary_entries"
  ON glossary_entries FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: manage own glossary"
  ON glossary_entries FOR ALL TO authenticated
  USING (organisation_id = auth_org_id() AND auth_role() = 'client')
  WITH CHECK (organisation_id = auth_org_id() AND auth_role() = 'client');

CREATE POLICY "Admin: full access to brand_voice_notes"
  ON brand_voice_notes FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: manage own brand voice"
  ON brand_voice_notes FOR ALL TO authenticated
  USING (organisation_id = auth_org_id() AND auth_role() = 'client')
  WITH CHECK (organisation_id = auth_org_id() AND auth_role() = 'client');

-- Updated_at triggers
CREATE TRIGGER update_glossary_entries_updated_at BEFORE UPDATE ON glossary_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_brand_voice_notes_updated_at BEFORE UPDATE ON brand_voice_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
