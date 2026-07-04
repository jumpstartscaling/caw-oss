-- CAW content schema

-- Table 1: Complete seed data
CREATE TABLE IF NOT EXISTS caw_seed (
  key TEXT PRIMARY KEY, -- Unique key for the seed entry
  value JSONB NOT NULL -- Data payload
);

-- Table 2: Content pages (one row per page)
CREATE TABLE IF NOT EXISTS caw_content (
  slug TEXT PRIMARY KEY, -- URL path for the page
  title TEXT NOT NULL, -- Page title
  blocks JSONB NOT NULL DEFAULT '[]', -- JSON array of page blocks
  palette TEXT NOT NULL DEFAULT 'emerald', -- Theme palette
  nav JSONB, -- Navigation links
  footer JSONB, -- Footer configuration
  local_seo JSONB, -- SEO metadata
  source TEXT DEFAULT 'seed', -- Data source
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Blog/knowledge-base articles
CREATE TABLE IF NOT EXISTS caw_articles (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  excerpt     TEXT,
  content     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'infrastructure',
  tags        JSONB NOT NULL DEFAULT '[]',
  author      TEXT NOT NULL DEFAULT 'Author',
  og_image    TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caw_articles_status ON caw_articles (status);
CREATE INDEX IF NOT EXISTS idx_caw_articles_category ON caw_articles (category);
CREATE INDEX IF NOT EXISTS idx_caw_articles_published ON caw_articles (published_at DESC)
  WHERE status = 'published';
