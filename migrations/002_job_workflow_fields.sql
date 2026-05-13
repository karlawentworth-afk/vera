-- Add workflow fields to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS allocated_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS signed_off_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS signed_off_by uuid REFERENCES profiles(id);

-- Add 'allocated' to job_status enum
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'allocated' AFTER 'unallocated';

NOTIFY pgrst, 'reload schema';
