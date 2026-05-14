-- XTRF import flag on key tables
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS imported_from_xtrf boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS imported_from_xtrf boolean DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS imported_from_xtrf boolean DEFAULT false;
ALTER TABLE glossary_entries ADD COLUMN IF NOT EXISTS imported_from_xtrf boolean DEFAULT false;

-- Import log
CREATE TABLE IF NOT EXISTS import_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type text NOT NULL,
  filename text NOT NULL,
  records_imported integer NOT NULL DEFAULT 0,
  records_skipped integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  imported_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE import_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin: full access to import_log" ON import_log FOR ALL TO authenticated USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

NOTIFY pgrst, 'reload schema';
