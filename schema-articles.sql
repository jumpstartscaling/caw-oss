-- caw_articles: blog/knowledge-base articles
-- Insert articles from any source (god-mode-api, manual, AI pipeline).
-- The SSR server reads published articles and renders them at /blog/:slug.

CREATE TABLE IF NOT EXISTS caw_articles (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  excerpt     TEXT,
  content     TEXT NOT NULL,                -- HTML body
  category    TEXT NOT NULL DEFAULT 'infrastructure',
  tags        JSONB NOT NULL DEFAULT '[]',  -- ["postgres","fastapi"]
  author      TEXT NOT NULL DEFAULT 'Author',
  og_image    TEXT,                         -- Open Graph image URL
  status      TEXT NOT NULL DEFAULT 'draft',-- draft | published | archived
  published_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caw_articles_status ON caw_articles (status);
CREATE INDEX IF NOT EXISTS idx_caw_articles_category ON caw_articles (category);
CREATE INDEX IF NOT EXISTS idx_caw_articles_published ON caw_articles (published_at DESC)
  WHERE status = 'published';
