# CAW

**CAW** is a database-driven SSR website framework for agencies, consultants, and builders who need landing pages, blogs, local/service pages, and lead capture without waiting on a static rebuild every time content changes.

It runs on **Fastify + EJS + PostgreSQL**. Pages, blocks, navigation, footers, blog posts, and pSEO content live in Postgres and are rendered at request time.

## Why this exists

Most marketing sites eventually become a mess of static builds, CMS glue, disconnected forms, and tracking scripts that do not agree with each other. CAW is built for the opposite workflow:

- Change content in the database and the live site reflects it immediately.
- Capture leads directly into your own Postgres database.
- Attribute form submissions with source, form type, page URL, referrer, and UTM parameters.
- Scale content into service pages, location pages, blogs, and knowledge-base pages from one schema.
- Keep ownership of the stack instead of wiring every funnel through third-party SaaS.

## What you can build with CAW

| Use case | What CAW gives you |
|---|---|
| Agency lead generation site | Landing pages, technical strategy forms, service pages, and blog content in one app. |
| Programmatic SEO site | Service × location pages from `content_matrix`, `locations`, `pseo_services`, geo data, fragments, and offer blocks. |
| Consultant portfolio | Database-editable pages, blocks, nav, footer, case-study/blog routes, and contact capture. |
| Knowledge-base/blog | Published articles rendered from `caw_articles`, with categories, related posts, search, and RSS. |
| Self-hosted growth engine | First-party lead storage, UTM capture, Postgres queries, and optional CRM/webhook forwarding. |

## Feature overview

- **Database-rendered pages:** `caw_content` stores routes, page titles, JSONB blocks, nav, footer, palette, and source metadata.
- **Block renderer:** `server/blocks.js` turns JSON blocks into HTML sections such as hero, problem, solution cards, authority, audit forms, CTAs, calculators, and surveys.
- **Lead capture API:** `POST /api/submit-lead` inserts form submissions into the `leads` table and stores the full payload in `data_json`.
- **Tracking-aware forms:** Audit forms include source and form type and now preserve UTM parameters, click IDs, current page URL, referrer, and user agent in the lead payload.
- **Blog and search:** `/blog`, `/blog/:slug`, `/search`, and `/blog/rss.xml` are backed by Postgres.
- **pSEO routing:** `/locations`, `/locations/:slug`, `/solutions`, `/solutions/:slug`, and service/location landing pages are generated from database tables.
- **Smart fallbacks:** Unknown clean URLs can redirect to known content, resolve article slugs, load pSEO pages, or auto-generate a page from existing blocks.
- **Health checks:** `/health` and `/api/health` verify database connectivity and loaded content.

## Architecture

```txt
Visitor request
   ↓
Fastify server
   ↓
PostgreSQL content lookup
   ↓
EJS layout + block renderer
   ↓
SSR HTML response

Lead form submit
   ↓
POST /api/submit-lead
   ↓
leads table + raw JSON payload
   ↓
SQL export, CRM sync, webhook, dashboard, or manual review
```

Core tables:

- `caw_content` — pages and JSONB blocks.
- `caw_articles` — blog and knowledge-base entries.
- `caw_seed` — raw seed configuration chunks.
- `leads` — inbound submissions from audit/contact forms.
- `locations`, `pseo_services`, `content_matrix`, `geo_intelligence`, `spintax_dictionaries`, `content_fragments`, `offer_blocks` — optional pSEO/content expansion layer used by the dynamic service/location pages.

## Performance model

CAW is not a static-site generator. It is a database-driven SSR app.

| Approach | Best at | Tradeoff |
|---|---|---|
| Static generation | Lowest CDN latency after build | Every content change needs a rebuild/redeploy. Large pSEO sites can make builds slow. |
| Traditional CMS page builder | Non-technical editing | Often adds plugin overhead, theme bloat, and hard-to-debug tracking/form flows. |
| CAW SSR | Instant content updates, first-party forms, dynamic pSEO, database-owned content | Each page render reads from Postgres, so database health and indexes matter. |

The main performance benefit is **zero rebuild latency**: update the database, refresh the page, and the new content can render immediately. For production, run Postgres close to the app server, keep the app and DB on the same private network when possible, add indexes for high-volume tables, and cache at the proxy/CDN layer for pages that do not need per-request freshness.

See [Performance & Use Cases](docs/PERFORMANCE_AND_USE_CASES.md) for a deeper comparison.

## Quick start with Docker

Requirements:

- Docker + Docker Compose
- Node.js 22+ if running bare metal

```bash
git clone https://github.com/jumpstartscaling/caw-oss.git
cd caw-oss
cp .env.example .env
docker compose up -d
```

Open:

```txt
http://localhost:4321
```

Check health:

```bash
curl http://localhost:4321/health
curl http://localhost:4321/api/health
```

Expected health responses include `ok` and the number of rows loaded from `caw_content`.

## Bare-metal development

Run Postgres in Docker, then run the Node app locally:

```bash
# Start only Postgres
docker compose up -d postgres

# Install dependencies
npm install

# Seed demo content
npm run db:seed

# Start Fastify with Node watch mode
npm run dev
```

Useful scripts:

```bash
npm start       # Run server/index.mjs
npm run dev     # Run server/index.mjs with node --watch
npm run db:up   # Start the Postgres service
npm run db:seed # Seed database content
```

## Environment setup

The default local `.env.example` points the app at the Docker Postgres port:

```env
DATABASE_URL=postgresql://caw:caw_local@127.0.0.1:5433/caw_db
HOST=0.0.0.0
PORT=4321
SITE_URL=http://localhost:4321
SITE_NAME="CAW Site"
SITE_DESCRIPTION="CAW Open Source Framework"
```

Production notes:

- Set `SITE_URL` to the canonical HTTPS domain. Canonical URLs and RSS links depend on it.
- Put Postgres on a private network when your host supports it.
- Use a strong database password and never commit production `.env` files.
- If using managed Postgres or cloud Postgres, confirm the correct `sslmode` behavior for your provider.

## Lead capture

The audit form posts JSON to:

```txt
POST /api/submit-lead
```

Minimum useful payload:

```json
{
  "source": "CAWSite",
  "form_type": "architect",
  "name": "Jane Founder",
  "email": "jane@example.com",
  "revenue": "1m-3m",
  "budget": "25k+",
  "problem": "Our CRM and ad tracking do not match."
}
```

The server writes structured fields to `leads` and stores the full original payload in `data_json`, so custom fields are preserved.

### Retrieve leads from Postgres

Recent leads:

```sql
SELECT id, created_at, source, form_type, name, email, phone, revenue, budget, problem
FROM leads
ORDER BY created_at DESC
LIMIT 25;
```

Leads by campaign:

```sql
SELECT
  id,
  created_at,
  name,
  email,
  data_json->>'utm_source' AS utm_source,
  data_json->>'utm_campaign' AS utm_campaign,
  data_json->>'page_url' AS page_url
FROM leads
WHERE data_json->>'utm_campaign' = 'spring_offer'
ORDER BY created_at DESC;
```

Export to CSV:

```sql
\copy (
  SELECT id, created_at, source, form_type, name, email, phone, revenue, budget, problem, data_json
  FROM leads
  ORDER BY created_at DESC
) TO 'caw-leads.csv' CSV HEADER;
```

See [Lead Capture & Tracking](docs/LEAD_CAPTURE_AND_TRACKING.md) for attribution fields, tracking setup, troubleshooting, and CRM handoff patterns.

## Tracking configuration

CAW separates **analytics scripts** from **lead attribution**:

1. Add your analytics scripts in `views/layout.ejs` or through Google Tag Manager.
2. Use UTM-tagged URLs for campaigns.
3. CAW audit forms preserve attribution fields in the lead JSON payload.

Example campaign URL:

```txt
https://example.com/services/custom-apps/database?utm_source=google&utm_medium=cpc&utm_campaign=postgres_offer
```

Captured lead metadata includes:

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

## Content workflow

1. Edit or seed rows in Postgres.
2. Store page sections as JSONB blocks in `caw_content.blocks`.
3. Use `block_type` to select the renderer case in `server/blocks.js`.
4. Refresh the URL; no static build is required.

Example block:

```json
{
  "block_type": "hero",
  "data": {
    "badge": "DATABASE-DRIVEN SSR",
    "headline": "Launch content without rebuilds.",
    "subhead": "Postgres-backed pages, forms, blogs, and pSEO routes.",
    "cta_label": "Start Audit",
    "cta_href": "#audit"
  }
}
```

## Production deployment checklist

- [ ] Set a production `DATABASE_URL`.
- [ ] Set `SITE_URL` to your real domain.
- [ ] Run the schema and seed scripts.
- [ ] Confirm `/health` and `/api/health` return `ok: true`.
- [ ] Add analytics scripts or GTM in `views/layout.ejs`.
- [ ] Submit a test lead and verify it appears in Postgres.
- [ ] Add database backups.
- [ ] Put the app behind HTTPS.
- [ ] Add proxy/CDN caching for public pages if traffic grows.

## Documentation

- [Installation & Deployment](docs/INSTALLATION_AND_DEPLOYMENT.md)
- [Lead Capture & Tracking](docs/LEAD_CAPTURE_AND_TRACKING.md)
- [Performance & Use Cases](docs/PERFORMANCE_AND_USE_CASES.md)
- [AI Handoff & Architecture](docs/AI_HANDOFF.md)
- [Block Reference](docs/BLOCK_REFERENCE.md)
- [Schema Reference](docs/SCHEMA_REFERENCE.md)
- [Development Guide](DEVELOPMENT.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## License

MIT License. Copyright Jumpstart Scaling / Christopher Amaya.
