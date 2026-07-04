# CAW Framework — AI Handoff & Harris Matrix

## Overview
CAW is a **Database-Driven Server-Side Rendered (SSR) Framework** built on Fastify, EJS, and PostgreSQL. It avoids static builds entirely, fetching content directly from the database and rendering it on the fly.

This document serves as a comprehensive "Harris Matrix" and architecture catalog. It details all routes, database interactions, schema requirements, and file structures to allow rapid onboarding for any developer or AI agent.

## Core Stack
- **Runtime:** Node.js (>=22.0.0)
- **Web Server:** Fastify (v5)
- **Templating:** EJS
- **Database:** PostgreSQL (v16), `pg` client
- **Deployment:** Docker & Docker Compose

## Directory Structure
```
caw/
├── .env.example          # Environment variables template
├── .github/              # GitHub Actions (CI/CD) and Issue Templates
├── Dockerfile            # Production Docker image
├── docker-compose.yml    # Development and Deployment stack
├── docs/                 # Reference documentation
├── package.json          # Dependencies and scripts
├── public/               # Static assets (CSS, robots.txt, images)
├── schema-articles.sql   # Blog and knowledge-base schema
├── schema.sql            # Core page and seed schema
├── scripts/              # Seed scripts
├── server/               # Fastify backend source code
│   ├── blocks.js         # Block HTML renderers
│   ├── db.js             # PostgreSQL queries
│   └── index.mjs         # Fastify initialization & routing
└── views/                # EJS templates
```

## Database Schema (Summary)
Detailed schema available in `SCHEMA_REFERENCE.md`.

| Table | Purpose |
|-------|---------|
| `caw_seed` | Static seed data and site configurations. |
| `caw_content` | Dynamic pages defined by blocks (`hero`, `cta`, etc.). |
| `caw_articles` | Blog posts and knowledge base articles. |
| `leads` | Inbound form submissions and captured leads. |

## Application Flow

### 1. Request Handling (`server/index.mjs`)
- Incoming GET requests map to `handlePage` or `/blog` route handlers.
- Fastify passes the slug to `getPageData()` in `server/db.js`.
- If found, `blocks.js` is invoked to map the JSON `blocks` array into HTML strings.
- EJS `page.ejs` wrapper renders the final HTML response.

### 2. Block Rendering (`server/blocks.js`)
Blocks are JSON structures mapped into components. For example:
```json
{
  "block_type": "hero",
  "data": {
    "headline": "Hello World",
    "cta_label": "Start"
  }
}
```
`blocks.js` reads `block_type`, safely escapes (`esc()`) all strings, and injects data into inline HTML/Tailwind templates.

## API Routes

### `GET /health`
- **Purpose**: System monitoring.
- **Returns**: JSON object `{ ok: true, caw_content_rows: 5 }` if DB is reachable.

### `POST /api/submit-lead`
- **Purpose**: Captures incoming contact forms.
- **Payload**: JSON or Form-Data (name, email, phone, problem, form_type, source).
- **Action**: Inserts into `leads` table.

## Conventions & Rules
1. **No Build Step**: CAW deliberately avoids `npm run build` pipelines for content. All changes happen in the database and immediately reflect on the frontend.
2. **Inline Styling**: Tailwind CSS classes or inline styles are used in `blocks.js`. Do not extract CSS to external files unless globally required.
3. **Prepared Statements**: All `pg.query()` calls must use parameterized inputs (`$1, $2`) to prevent SQL injection.
4. **No External Frameworks**: Do not inject React, Vue, or Svelte. Stay strictly within the Fastify + EJS paradigm for maximum speed.

## Extending the Framework
- **Adding a Route**: Modify `server/index.mjs`.
- **Adding a Block Type**: Add a new `case` to the switch statement in `server/blocks.js`. Document it in `BLOCK_REFERENCE.md`.
- **Modifying Schema**: Update `schema.sql` and run `scripts/seed.mjs`.
