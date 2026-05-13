-- AI Health Score snapshots
CREATE TABLE IF NOT EXISTS ai_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  overall_score integer NOT NULL,
  prev_period_score integer,
  jobs_in_period integer NOT NULL DEFAULT 0,
  words_in_period integer NOT NULL DEFAULT 0,
  avg_hter numeric(4,3),
  by_language_pair jsonb DEFAULT '[]'::jsonb,
  by_content_type jsonb DEFAULT '[]'::jsonb,
  by_ai_tool jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, snapshot_date)
);

CREATE INDEX idx_health_snapshots_org_date ON ai_health_snapshots(organisation_id, snapshot_date DESC);

ALTER TABLE ai_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to ai_health_snapshots"
  ON ai_health_snapshots FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Client: read own snapshots"
  ON ai_health_snapshots FOR SELECT TO authenticated
  USING (organisation_id = auth_org_id() AND auth_role() = 'client');

NOTIFY pgrst, 'reload schema';
