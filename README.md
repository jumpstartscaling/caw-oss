# CAW
Database-driven SSR framework built on **Fastify + EJS + PostgreSQL**.

CAW renders pages, blogs, and lead forms from a live Postgres database at request time — no build step, no static generation, zero rebuild latency.

## Architecture
- **Pages, Blocks, Nav, Footer** → Direct PostgreSQL (`caw_content`)
- **Forms** → POST `/api/submit-lead` → INSERT `leads`
- **Frontend** → EJS Templates + Tailwind CSS (via inline utilities in blocks)

## Use Case: Standalone Business Website

CAW can be used as a simple standalone website engine for a local service business, consultant, agency, contractor, or small company that needs a fast marketing site without a heavy CMS or static build pipeline.

A business can run CAW as its main website with database-managed pages such as Home, About, Services, Service Area pages, Blog, Contact, and landing pages. Content blocks, navigation, footer content, blog posts, and lead forms are stored in PostgreSQL, so the site can be updated from the database without rebuilding or redeploying the frontend.

Example standalone business website flow:

- A visitor lands on a service page or local landing page.
- CAW renders the page server-side from `caw_content`.
- The visitor submits a quote request, consultation request, or contact form.
- The form posts to `/api/submit-lead` and stores the lead in the `leads` table.
- The business can follow up with the lead while continuing to add or edit website content directly in the database.

This makes CAW useful for small business websites that need SEO-friendly pages, editable content, lead capture, and fast deployment without requiring WordPress, a visual page builder, or a full enterprise CMS.

## Quick Start (Local Docker)

1. Clone the repository.
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Start the application stack (App + PostgreSQL):
   ```bash
   docker compose up -d
   ```
4. Access the application at `http://localhost:4321`.

## Local Development (Bare Metal)

If you prefer to run the Node.js application directly on your host (with PostgreSQL in Docker):

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

- [AI Handoff & Architecture](docs/AI_HANDOFF.md)
- [Block Reference](docs/BLOCK_REFERENCE.md)
- [Schema Reference](docs/SCHEMA_REFERENCE.md)
- [Development Guide](DEVELOPMENT.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## Health Check
`GET /health` returns `{ ok, caw_content_rows }` or an error with a hint.

## License
MIT License. Copyright Jumpstart Scaling / Christopher Amaya.
