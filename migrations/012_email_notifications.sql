-- Email log
CREATE TABLE IF NOT EXISTS email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  template text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error text,
  resend_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_log_recipient ON email_log(recipient);
CREATE INDEX idx_email_log_template ON email_log(template);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access to email_log"
  ON email_log FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

-- Notification preferences on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
