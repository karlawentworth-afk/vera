-- Add recommendations jsonb column to organisations
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS recommendations jsonb DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
