-- Extend quotes table for conversion flow
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prospect_email text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prospect_company text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS proposed_tier text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS one_off_fee_pence integer;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS converted_to_organisation_id uuid REFERENCES organisations(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- Backfill existing demo quotes with company names
UPDATE quotes SET prospect_company = prospect_name WHERE prospect_company IS NULL;

NOTIFY pgrst, 'reload schema';
