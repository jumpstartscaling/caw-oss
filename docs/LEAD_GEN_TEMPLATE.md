# Lead Generation Template

CAW can be used as a standalone business website template with service pages, service area pages, contact forms, and PostgreSQL-backed lead storage.

## Funnel

Visitor -> service page -> call to action -> lead form -> `/api/submit-lead` -> `leads` table -> follow-up.

## Default Pages

- `/`
- `/about`
- `/services`
- `/services/:service`
- `/service-areas`
- `/service-areas/:area`
- `/blog`
- `/contact`
- `/thank-you`
- `/privacy`
- `/terms`

## Business Variables

- `BUSINESS_NAME`
- `BUSINESS_TYPE`
- `PRIMARY_SERVICE`
- `PRIMARY_CITY`
- `PRIMARY_REGION`
- `BUSINESS_PHONE`
- `BUSINESS_EMAIL`
- `LEAD_OFFER`
- `BUSINESS_SERVICES`
- `BUSINESS_SERVICE_AREAS`
- `CAW_OVERWRITE`

## Build

1. Copy `.env.example` to `.env`.
2. Start Postgres.
3. Install dependencies.
4. Run the business seed script.
5. Start the app.

## Production

1. Set a production `DATABASE_URL`.
2. Set a production `SITE_URL`.
3. Build and start the Docker stack.
4. Run the business seed inside the app container.
5. Check `/health`.
6. Submit one test lead.
7. Confirm the lead exists in PostgreSQL.
