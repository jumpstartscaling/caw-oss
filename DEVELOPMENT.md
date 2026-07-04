# Development Guide

This guide explains how to set up the CAW framework for local development.

## Requirements
- Node.js >= 22.0.0
- Docker (for PostgreSQL)

## Setup Process

1. **Start the Database**
   ```bash
   docker compose up -d postgres
   ```
   This exposes PostgreSQL on `localhost:5433` (to avoid conflicts with standard postgres ports).

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   The defaults in `.env.example` point to the local Docker database.

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Seed the Database**
   ```bash
   npm run db:seed
   ```
   *Note: If you encounter an error about the `leads` table not existing when testing form submissions, create it manually via `psql` or a DB client.*

5. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The app will run at `http://localhost:4321`. Changes to `.js` and `.mjs` files will automatically restart the server.

## Architectural Notes
- There is **no build step**. Fastify parses `views/*.ejs` directly.
- Adding a new route requires editing `server/index.mjs`.
- Modifying block rendering logic requires editing `server/blocks.js`.

## Making Changes
After making structural changes to the database schema, be sure to update `schema.sql` and `schema-articles.sql`.
