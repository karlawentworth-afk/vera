-- Add preflight_data to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS preflight_data jsonb;

NOTIFY pgrst, 'reload schema';
