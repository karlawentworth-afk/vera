-- Add review iteration tracking to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS review_iterations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS iteration_count integer DEFAULT 1;

NOTIFY pgrst, 'reload schema';
