-- Job segments for inline annotation
CREATE TABLE IF NOT EXISTS job_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  segment_index integer NOT NULL,
  source_text text NOT NULL,
  ai_translation text NOT NULL,
  reviewer_translation text,
  reviewer_comment text,
  severity text CHECK (severity IN ('fine', 'minor', 'major', 'critical')),
  edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, segment_index)
);

CREATE INDEX idx_job_segments_job ON job_segments(job_id, segment_index);

ALTER TABLE job_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to job_segments"
  ON job_segments FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Reviewer: manage segments on assigned jobs"
  ON job_segments FOR ALL TO authenticated
  USING (
    auth_role() = 'reviewer' AND
    job_id IN (SELECT id FROM jobs WHERE reviewer_id = auth.uid())
  )
  WITH CHECK (
    auth_role() = 'reviewer' AND
    job_id IN (SELECT id FROM jobs WHERE reviewer_id = auth.uid())
  );

CREATE POLICY "Client: read segments on own jobs"
  ON job_segments FOR SELECT TO authenticated
  USING (
    auth_role() = 'client' AND
    job_id IN (SELECT id FROM jobs WHERE organisation_id = auth_org_id())
  );

CREATE TRIGGER update_job_segments_updated_at BEFORE UPDATE ON job_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
