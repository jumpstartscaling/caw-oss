# Database Schema Reference

CAW uses PostgreSQL for content, articles, pSEO data, and first-party lead capture. The base schema creates the core content tables. Some deployment-specific tables, especially `leads` and the pSEO expansion tables, may be created by external migrations or manually during development.

## `caw_content`

Stores core page configurations. One row can render one live route.

| Column | Type | Default | Description |
|---|---|---|---|
| `slug` | TEXT | PRIMARY KEY | The URL path, for example `about`, `services/api`, or an empty string for the homepage. |
| `title` | TEXT | NOT NULL | Page `<title>` value. |
| `blocks` | JSONB | `'[]'` | Array of block definitions rendered by `server/blocks.js`. |
| `palette` | TEXT | `'emerald'` | Theme palette used by the layout. |
| `nav` | JSONB | NULL | Navigation configuration for the page. |
| `footer` | JSONB | NULL | Footer configuration for the page. |
| `local_seo` | JSONB | NULL | Optional local SEO metadata. |
| `source` | TEXT | `'seed'` | Where the row came from, such as `seed`, `pseo`, or `auto`. |
| `created_at` | TIMESTAMPTZ | `NOW()` | Insert timestamp. |

## `caw_articles`

Stores blog posts, news, and knowledge-base entries.

| Column | Type | Default | Description |
|---|---|---|---|
| `slug` | TEXT | PRIMARY KEY | URL path under `/blog/`. |
| `title` | TEXT | NOT NULL | Article title. |
| `excerpt` | TEXT | NULL | Short summary for cards and metadata. |
| `content` | TEXT | NOT NULL | HTML body content. |
| `category` | TEXT | `'infrastructure'` | Categorization label. |
| `tags` | JSONB | `'[]'` | Array of tag strings. |
| `author` | TEXT | `'Author'` | Display author. |
| `og_image` | TEXT | NULL | Optional social preview image URL. |
| `status` | TEXT | `'draft'` | `draft`, `published`, or `archived`. |
| `published_at` | TIMESTAMPTZ | NULL | Controls visibility and ordering on the frontend. |
| `created_at` | TIMESTAMPTZ | `NOW()` | Insert timestamp. |
| `updated_at` | TIMESTAMPTZ | `NOW()` | Last update timestamp. |

Recommended indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_caw_articles_status ON caw_articles (status);
CREATE INDEX IF NOT EXISTS idx_caw_articles_category ON caw_articles (category);
CREATE INDEX IF NOT EXISTS idx_caw_articles_published ON caw_articles (published_at DESC)
  WHERE status = 'published';
```

## `caw_seed`

Stores raw JSON configuration chunks used for initial seeding.

| Column | Type | Default | Description |
|---|---|---|---|
| `key` | TEXT | PRIMARY KEY | Identifier such as `main_nav` or `main_footer`. |
| `value` | JSONB | NOT NULL | JSON payload. |

## `leads`

Stores inbound form submissions from `POST /api/submit-lead`.

The route writes common lead fields into columns and preserves the complete request body in `data_json`. That means new form fields, UTM parameters, click IDs, page URL, referrer, and user agent can be captured without adding a new column every time.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing lead ID. |
| `source` | TEXT | NULL | Site, page, campaign, or block source. |
| `name` | TEXT | NULL | Submitter name. |
| `email` | TEXT | NULL | Submitter email. |
| `phone` | TEXT | NULL | Submitter phone. |
| `website` | TEXT | NULL | Submitter website, when provided. |
| `revenue` | TEXT | NULL | Revenue range selected by the submitter. |
| `budget` | TEXT | NULL | Budget range selected by the submitter. |
| `problem` | TEXT | NULL | Described issue or bottleneck. |
| `form_type` | TEXT | NULL | Form identifier, for example `architect`. |
| `data_json` | JSONB | NULL | Full raw payload, including attribution metadata. |
| `created_at` | TIMESTAMPTZ | `NOW()` | Submission timestamp. |

Suggested table definition:

```sql
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  source TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  revenue TEXT,
  budget TEXT,
  problem TEXT,
  form_type TEXT,
  data_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_data_json ON leads USING GIN (data_json);
```

Common attribution fields stored in `data_json`:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `gclid`
- `fbclid`
- `msclkid`
- `landing_page`
- `page_url`
- `referrer`
- `user_agent`

## pSEO tables

The dynamic pSEO routes use additional tables when available. These are useful for service × location pages and large content matrices.

### `locations`

Stores city/state records for `/locations` and location-specific pages.

Common columns used by the app:

| Column | Description |
|---|---|
| `id` | Location primary key. |
| `city` | City name. |
| `state` | State abbreviation or name. |
| `zip` | Optional ZIP or postal code. |
| `slug` | URL-safe location slug. |

### `pseo_services`

Stores service definitions for `/solutions` and service-specific pages.

Common columns used by the app:

| Column | Description |
|---|---|
| `id` | Service primary key. |
| `service_type` | Main service name. |
| `sub_niche` | Service sub-niche or qualifier. |
| `slug` | URL-safe service slug. |

### `content_matrix`

Connects locations and services into generated pages.

Common columns used by the app:

| Column | Description |
|---|---|
| `slug` | Final route slug for the service/location page. |
| `title` | Page title. |
| `meta_description` | Page description. |
| `location_id` | Foreign key to `locations`. |
| `service_id` | Foreign key to `pseo_services`. |

### `geo_intelligence`

Stores local context used to make pSEO pages more specific.

Common columns used by the app:

| Column | Description |
|---|---|
| `cluster_key` | Lookup key, usually city-state normalized. |
| `data` | JSONB object with fields such as county, landmark, notable companies, and local descriptions. |

### `spintax_dictionaries`

Stores reusable copy variants by category.

Common columns used by the app:

| Column | Description |
|---|---|
| `category` | Dictionary name. |
| `data` | JSONB array of variants. |

### `content_fragments`

Stores reusable page-copy fragments.

Common columns used by the app:

| Column | Description |
|---|---|
| `fragment_type` | Fragment slot, such as `hero_section`, `intro_hook`, or `methodology`. |
| `fragment_text` | Fragment text. |
| `status` | Usually `active` for fragments available to the generator. |

### `offer_blocks`

Stores reusable CTA or offer definitions.

Common columns used by the app:

| Column | Description |
|---|---|
| `block_type` | Offer family, such as `technical_strategy_session`. |
| `data` | JSONB offer payload used by generated form blocks. |

## Content ownership model

CAW treats Postgres as the live content source:

- `caw_content` controls routes and page sections.
- `caw_articles` controls blog/knowledge-base content.
- pSEO tables generate and cache service/location pages.
- `leads` stores first-party form submissions and attribution.
