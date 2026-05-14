-- Internal job notes — NEVER visible to clients
CREATE TABLE IF NOT EXISTS job_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  body text NOT NULL,
  mentions uuid[] DEFAULT '{}',
  is_pinned boolean DEFAULT false,
  parent_note_id uuid REFERENCES job_internal_notes(id),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_internal_notes_job ON job_internal_notes(job_id, created_at DESC);
CREATE INDEX idx_job_internal_notes_author ON job_internal_notes(author_id);

CREATE TRIGGER update_job_internal_notes_updated_at
  BEFORE UPDATE ON job_internal_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE job_internal_notes ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin: full access to job_internal_notes"
  ON job_internal_notes FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- Reviewer: read/write on jobs assigned to them ONLY
CREATE POLICY "Reviewer: manage notes on assigned jobs"
  ON job_internal_notes FOR ALL TO authenticated
  USING (
    auth_role() = 'reviewer' AND
    job_id IN (SELECT id FROM jobs WHERE reviewer_id = auth.uid())
  )
  WITH CHECK (
    auth_role() = 'reviewer' AND
    job_id IN (SELECT id FROM jobs WHERE reviewer_id = auth.uid())
  );

-- Salesperson: read notes on jobs for clients they introduced
CREATE POLICY "Salesperson: read notes on introduced client jobs"
  ON job_internal_notes FOR SELECT TO authenticated
  USING (
    auth_role() = 'salesperson' AND
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN organisations o ON j.organisation_id = o.id
      WHERE o.introducing_salesperson_id = auth.uid()
    )
  );

-- Salesperson: insert notes on introduced client jobs (if can_comment_on_jobs)
CREATE POLICY "Salesperson: add notes if permitted"
  ON job_internal_notes FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'salesperson' AND
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN organisations o ON j.organisation_id = o.id
      WHERE o.introducing_salesperson_id = auth.uid()
    )
  );

-- CRITICAL: NO policy for 'client' role. Clients CANNOT see internal notes.
-- This is enforced at the RLS layer — no application-level bypass possible.

-- Add can_comment_on_jobs to profiles for salespeople
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_comment_on_jobs boolean DEFAULT true;

NOTIFY pgrst, 'reload schema';
