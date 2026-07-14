# CAW
Database-driven SSR framework built on **Fastify + EJS + PostgreSQL**.

CAW renders pages, blogs, and lead forms from a live Postgres database at request time — no build step, no static generation, zero rebuild latency.

## Business Lead-Gen Template

CAW can be used as a standalone website template for a business that needs lead generation, service pages, service area pages, contact forms, and PostgreSQL-backed lead storage.

The business use case is simple:

1. A visitor lands on a service page, local page, blog page, or landing page.
2. CAW renders the page server-side from `caw_content`.
3. The visitor submits a quote, estimate, consultation, or contact request.
4. The form posts to `/api/submit-lead`.
5. The submission is stored in the `leads` table.
6. The business follows up by phone, email, CRM, or automation.

See the implementation guide: [Lead Generation Template](docs/LEAD_GEN_TEMPLATE.md).

## Architecture
- **Pages, Blocks, Nav, Footer** → Direct PostgreSQL (`caw_content`)
- **Forms** → POST `/api/submit-lead` → INSERT `leads`
- **Frontend** → EJS Templates + Tailwind CSS (via inline utilities in blocks)

## Template Pages

A lead-gen business site should start with:

- Home
- About
- Services
- Individual service pages
- Service areas
- Individual local pages
- Blog/resource center
- Contact
- Thank-you page
- Privacy policy
- Terms of service

## Build Instructions

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:seed
npm run dev
```

Open `http://localhost:4321`.

## Production Release Path

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:4321/health
```

Before release, confirm:

- `DATABASE_URL` points to production PostgreSQL
- `SITE_URL` is the final HTTPS domain
- `/health` returns ok
- `/contact` loads
- a test lead writes to the `leads` table
- privacy and terms pages are real, not placeholders
- phone, email, services, and service areas are correct

## Local Development (Bare Metal)

If you prefer to run the Node.js application directly on your host with PostgreSQL in Docker:

```bash
# Start just the database
docker compose up -d postgres

# Install dependencies
npm install

# Seed the database with demo content
npm run db:seed

# Start the dev server with hot reload
npm run dev
```

## Documentation

- [Lead Generation Template](docs/LEAD_GEN_TEMPLATE.md)
- [AI Handoff & Architecture](docs/AI_HANDOFF.md)
- [Block Reference](docs/BLOCK_REFERENCE.md)
- [Schema Reference](docs/SCHEMA_REFERENCE.md)
- [Development Guide](DEVELOPMENT.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## Health Check
`GET /health` returns `{ ok, caw_content_rows }` or an error with a hint.

## License
MIT License. Copyright Jumpstart Scaling / Christopher Amaya.
