# Production Release

Use this checklist to ship CAW as a standalone business lead-generation website.

## Goal

Deploy a database-driven website that renders business pages from PostgreSQL and stores contact requests in the `leads` table.

## Required Environment

- `DATABASE_URL`
- `HOST`
- `PORT`
- `SITE_URL`
- `SITE_NAME`
- `BUSINESS_NAME`
- `PRIMARY_SERVICE`
- `PRIMARY_CITY`
- `PRIMARY_REGION`
- `BUSINESS_PHONE`
- `BUSINESS_EMAIL`
- `LEAD_OFFER`
- `BUSINESS_SERVICES`
- `BUSINESS_SERVICE_AREAS`

## Docker Release

1. Copy `.env.example` to `.env`.
2. Set production values.
3. Start the Docker stack with build enabled.
4. Confirm `/health` returns ok.
5. Open the home, services, service areas, and contact pages.
6. Submit a test contact request.
7. Confirm the row exists in PostgreSQL.

## Proxy

Run the app behind HTTPS using Caddy, Nginx, Cloudflare Tunnel, Coolify, or your server proxy. Set `SITE_URL` to the public HTTPS domain.

## Launch Checklist

- [ ] Production database is connected
- [ ] Public domain is configured
- [ ] HTTPS works
- [ ] Health check passes
- [ ] Home page loads
- [ ] Services page loads
- [ ] Contact page loads
- [ ] Test lead saves successfully
- [ ] Phone number is correct
- [ ] Email address is correct
- [ ] Services are correct
- [ ] Service areas are correct
- [ ] Privacy page is real
- [ ] Terms page is real
- [ ] Database backup is configured

## Rollback

Keep the previous working app deployment available. Roll back the app first. Restore the database only if schema or seeded content caused the failure.

## Future Release Items

- Admin editor for `caw_content`
- Lead dashboard
- New-lead notification
- CRM webhook delivery
- Thank-you redirect
- Sitemap and robots.txt
- FAQ block
- Review/testimonial block
