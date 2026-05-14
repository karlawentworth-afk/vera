-- Help articles
CREATE TABLE IF NOT EXISTS help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL,
  audience text[] NOT NULL DEFAULT '{admin,client,reviewer,salesperson}',
  order_index integer NOT NULL DEFAULT 0,
  is_draft boolean NOT NULL DEFAULT false,
  version_history jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_help_articles_category ON help_articles(category);
CREATE INDEX idx_help_articles_audience ON help_articles USING GIN(audience);

ALTER TABLE help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone: read published articles for their role"
  ON help_articles FOR SELECT TO authenticated
  USING (is_draft = false);

CREATE POLICY "Admin: full access to help_articles"
  ON help_articles FOR ALL TO authenticated
  USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

-- Help feedback
CREATE TABLE IF NOT EXISTS help_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES help_articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  helpful boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE help_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated: insert own feedback" ON help_feedback FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin: read all feedback" ON help_feedback FOR SELECT TO authenticated USING (auth_role() = 'admin');

CREATE TRIGGER update_help_articles_updated_at BEFORE UPDATE ON help_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
