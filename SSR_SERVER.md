# caw_site SSR Server (Fastify + EJS)

**No build. 0 rebuild latency.** Templates and DB content rendered at request time.

## Run

```bash
# Development (with --watch for hot reload)
npm run dev

# Production
npm run start
```

Requires `DATABASE_URL` (Postgres with `caw_content` seeded).

## Stack

- **Fastify** — High-performance HTTP
- **EJS** — Server-side templates (loaded at runtime)
- **pg** — Direct Postgres (`caw_content`)

## Structure

```
server/
  index.mjs   — Main app, routes, APIs
  db.js       — getPageData(slug) from caw_content
  blocks.js   — Block → HTML renderer (hero, terminal_problem, etc.)
views/
  layout.ejs  — Shell (nav, footer, styles)
  page.ejs    — Page template
  404.ejs     — Not found
  nav.ejs     — Navigation partial
  footer.ejs  — Footer partial
public/       — Static (favicon, etc.)
```

## Endpoints

- `GET /` — Homepage
- `GET /:slug` — Dynamic pages (about, contact, services/custom-apps/..., etc.)
- `POST /api/submit-lead` — Form submission → leads table
- `GET /api/health` — Health check
- `GET /health` — Health (JSON)

## Seed

Ensure `caw_content` is populated:

```bash
DATABASE_URL=... npm run db:seed
```
