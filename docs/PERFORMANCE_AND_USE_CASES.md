# Performance & Use Cases

CAW is a database-driven SSR framework. The main tradeoff is simple: content changes are live immediately because pages are rendered from Postgres at request time, but production performance depends on database proximity, indexes, and caching strategy.

## When CAW is a good fit

CAW works best when a website is more than a brochure site.

Good fits:

- Agency and consultant lead-generation sites.
- Content-heavy service businesses.
- Programmatic SEO pages by location, niche, industry, or service.
- Sites where form submissions must be first-party and queryable.
- Blog or knowledge-base sites where articles should connect to service pages.
- Self-hosted funnels where content, leads, and tracking should stay in one owned database.

Less ideal fits:

- Tiny static sites that never change.
- Sites that must be served entirely from CDN edge HTML with no dynamic rendering.
- Teams that need a visual page-builder UI before a database/content workflow.

## Performance difference: CAW vs static sites vs CMS

| Model | How it serves pages | Strength | Bottleneck |
|---|---|---|---|
| Static site generator | Builds HTML ahead of time, then serves from CDN or file host. | Very fast for stable content. | Rebuild/redeploy required when content changes. Large pSEO builds can get slow. |
| Traditional CMS | Runtime PHP/plugin/theme render or hosted page-builder render. | Easy non-technical editing. | Plugin bloat, theme overhead, caching complexity, and fragmented form/tracking systems. |
| Headless CMS + frontend | Content API plus frontend app. | Flexible editor/content separation. | More moving parts, API dependency, build hooks, preview complexity. |
| CAW | Fastify renders EJS with page/block data from Postgres. | Immediate DB-driven content updates, first-party leads, dynamic pSEO. | Postgres query speed and app/DB network latency. |

## The core benefit: zero rebuild latency

In a static workflow, this change usually needs a content edit, build trigger, deployment, and cache invalidation:

```txt
Change page headline → build site → deploy → purge cache → verify live page
```

In CAW, content is read from the database on request:

```txt
Update caw_content.blocks → refresh page
```

That matters when you have:

- Hundreds or thousands of service/location pages.
- Campaign pages that change during a launch.
- Local SEO pages where copy, offers, or internal links need frequent edits.
- Forms where source naming and attribution need quick changes.

## Runtime performance model

A CAW page render usually includes:

1. Fastify receives the request.
2. The server normalizes the slug.
3. Postgres returns page data from `caw_content` or the pSEO tables.
4. The block renderer converts JSON blocks into HTML strings.
5. EJS wraps the page in the layout.
6. Fastify returns HTML.

The important optimization target is database work, not client-side JavaScript.

## Production recommendations

### Keep Postgres close to the app

The app reads from Postgres on each uncached page request. Keep app and database in the same region and preferably the same private network.

### Add indexes where traffic grows

The base schema indexes article status, category, and published date. For pSEO-heavy deployments, add indexes around columns used by service/location lookups.

Examples:

```sql
CREATE INDEX IF NOT EXISTS idx_caw_content_slug ON caw_content (slug);
CREATE INDEX IF NOT EXISTS idx_locations_slug ON locations (slug);
CREATE INDEX IF NOT EXISTS idx_pseo_services_slug ON pseo_services (slug);
CREATE INDEX IF NOT EXISTS idx_content_matrix_slug ON content_matrix (slug);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
```

### Cache public pages when possible

For high-traffic pages where content does not need to change every request, put CAW behind a reverse proxy or CDN and cache HTML briefly.

Suggested starting point:

- Homepage and service pages: 30–300 seconds.
- Blog posts: 5–30 minutes.
- Health endpoints and form submits: never cache.

### Keep forms dynamic

Do not cache `POST /api/submit-lead`. Keep JSON body limits reasonable and log failures.

### Measure before claiming numbers

This repo does not currently include official benchmark results. When you publish numbers, include:

- Server CPU/RAM.
- Node version.
- Postgres location and hardware.
- Dataset size.
- Whether pages were cached.
- The command used for testing.

Example local test tools:

```bash
wrk -t4 -c64 -d30s http://localhost:4321/
ab -n 1000 -c 50 http://localhost:4321/
```

## Use case patterns

### Agency website

Use `caw_content` for the main pages, `caw_articles` for deep technical content, and `audit_form` blocks for technical strategy calls.

Recommended pages:

- `/`
- `/services`
- `/about`
- `/contact`
- `/blog`
- `/guide/how-i-build`

### Programmatic SEO site

Use the pSEO tables to generate many route combinations from structured data.

Typical entities:

- Locations: city, state, county, landmark, local descriptions.
- Services: service type, sub-niche, slug.
- Content matrix: service × location landing pages.
- Fragments: reusable localized copy sections.
- Offer blocks: CTA and audit offers.

This lets you create pages like:

```txt
/custom-saas-development-austin-tx
/private-ai-agents-miami-fl
/postgresql-architecture-denver-co
```

### Blog + service cross-linking

CAW can attach related articles to service pages and use article content to support internal links.

Pattern:

```txt
Service page → related article cards → blog article → CTA/audit form
```

This is useful for technical SEO because educational content and commercial pages reinforce each other.

### First-party lead dashboard

Because leads are stored in Postgres, you can build reporting on top of the same database:

- Leads by campaign.
- Leads by page.
- Leads by source.
- Leads by budget range.
- Leads with missing attribution.
- Leads with paid click IDs.

Example:

```sql
SELECT
  COALESCE(data_json->>'utm_campaign', 'no_campaign') AS campaign,
  COUNT(*) AS leads
FROM leads
GROUP BY campaign
ORDER BY leads DESC;
```

## Scaling checklist

- [ ] Put app and database in the same region.
- [ ] Add indexes for high-volume lookup paths.
- [ ] Cache public HTML with a reverse proxy or CDN.
- [ ] Keep lead submits uncached.
- [ ] Add database backups.
- [ ] Monitor `/health` and `/api/health`.
- [ ] Log form insert failures.
- [ ] Run benchmark tests against realistic seed data.
