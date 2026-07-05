# Installation & Deployment

This guide covers the fastest local setup, bare-metal development, production environment variables, database setup, and deployment checks for CAW.

## Requirements

For Docker-based local development:

- Docker
- Docker Compose

For bare-metal Node development:

- Node.js 22+
- npm
- PostgreSQL 16+ or the included Docker Postgres service

## Local setup with Docker

```bash
git clone https://github.com/jumpstartscaling/caw-oss.git
cd caw-oss
cp .env.example .env
docker compose up -d
```

Open the app:

```txt
http://localhost:4321
```

Check health:

```bash
curl http://localhost:4321/health
curl http://localhost:4321/api/health
```

If the database is connected and seeded, the health response should include `ok: true` and a `caw_content_rows` count.

## Bare-metal development

Use this path when you want the app running directly on your host while Postgres runs in Docker.

```bash
# Start only the database
docker compose up -d postgres

# Install dependencies
npm install

# Seed content
npm run db:seed

# Start the development server
npm run dev
```

The dev script runs:

```bash
node --watch server/index.mjs
```

## Scripts

| Script | Purpose |
|---|---|
| `npm start` | Run the Fastify server. |
| `npm run dev` | Run the Fastify server with Node watch mode. |
| `npm run db:up` | Start the Postgres Docker service. |
| `npm run db:seed` | Seed the database with demo content. |
| `npm run build` | Astro build command kept for projects using the Astro side of the repo. |
| `npm run preview` | Astro preview command. |

## Environment variables

Default local values:

```env
DATABASE_URL=postgresql://caw:caw_local@127.0.0.1:5433/caw_db
HOST=0.0.0.0
PORT=4321
SITE_URL=http://localhost:4321
SITE_NAME="CAW Site"
SITE_DESCRIPTION="CAW Open Source Framework"
```

Production recommendations:

| Variable | Production guidance |
|---|---|
| `DATABASE_URL` | Use a production Postgres connection string with a strong password. |
| `HOST` | Usually `0.0.0.0` inside containers. |
| `PORT` | Match your platform or reverse proxy port. |
| `SITE_URL` | Set to the public HTTPS domain, without a trailing slash. |
| `SITE_NAME` | Set to the brand/site name. |
| `SITE_DESCRIPTION` | Set to the default description for the site. |

## Database setup

The base schema creates:

- `caw_seed`
- `caw_content`
- `caw_articles`

Lead capture expects a `leads` table. If your environment does not already create it, add:

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

## Docker Compose notes

The included Docker Compose file runs:

- `caw_app` on port `4321`
- `postgres` on host port `5433`, container port `5432`
- A persistent volume named `caw_pgdata`

For local development, the app uses:

```txt
postgresql://caw:caw_local@127.0.0.1:5433/caw_db
```

Inside Docker Compose, the app connects through the service name:

```txt
postgresql://caw:caw_local@postgres:5432/caw_db
```

## Production deployment pattern

A common production layout:

```txt
Internet
  ↓
HTTPS reverse proxy / platform router
  ↓
CAW Fastify container
  ↓
Private Postgres database
```

Recommended checklist:

- [ ] Use HTTPS.
- [ ] Use a strong production database password.
- [ ] Keep Postgres on a private network when possible.
- [ ] Set `SITE_URL` to the canonical public domain.
- [ ] Run the schema and seed scripts.
- [ ] Verify `/health` and `/api/health`.
- [ ] Submit a test lead and verify it is in the `leads` table.
- [ ] Configure backups for Postgres.
- [ ] Configure uptime monitoring for `/health`.
- [ ] Add a reverse proxy or CDN cache for high-traffic public pages.

## Adding analytics and tracking scripts

Add tracking scripts in `views/layout.ejs` or use a tag manager. Keep lead attribution in Postgres by using UTM-tagged campaign URLs.

Example campaign URL:

```txt
https://example.com/contact?utm_source=linkedin&utm_medium=organic&utm_campaign=founder_offer
```

The built-in audit form saves those UTM values into `leads.data_json` when the form is submitted.

## Common issues

### `DATABASE_URL not set`

Copy `.env.example` to `.env`, then restart the app.

```bash
cp .env.example .env
npm run dev
```

### Health check returns database errors

Confirm Postgres is running:

```bash
docker compose ps
```

Then confirm the connection string matches the environment where the app is running.

### The app starts but there is no content

Run the seed script:

```bash
npm run db:seed
```

Then check:

```sql
SELECT COUNT(*) FROM caw_content;
```

### Form submits fail

Confirm the `leads` table exists and the app can write to it.

```sql
SELECT COUNT(*) FROM leads;
```

Then submit a test lead and inspect the latest row:

```sql
SELECT id, created_at, source, name, email, data_json
FROM leads
ORDER BY created_at DESC
LIMIT 5;
```
