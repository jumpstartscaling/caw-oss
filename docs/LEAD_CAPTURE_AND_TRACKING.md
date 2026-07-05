# Lead Capture & Tracking

CAW is designed to keep lead capture first-party: the form submits to the app, the app writes to Postgres, and the full payload is preserved for attribution, exports, dashboards, and CRM syncs.

## Lead flow

```txt
Visitor lands on a page
  ↓
Visitor submits an audit/contact form
  ↓
Form posts JSON to POST /api/submit-lead
  ↓
Fastify inserts a row into leads
  ↓
Structured fields + full data_json payload are available in Postgres
```

The submit route stores common fields directly on the `leads` row and also saves the complete request body in `data_json`.

## Lead table

The lead API expects a table similar to:

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
```

The structured columns make the most common operations simple. The JSONB payload preserves every extra field without needing a migration for each new campaign.

## What the built-in audit form sends

The `audit_form` block includes these core fields:

| Field | Purpose |
|---|---|
| `source` | The page/form source. Controlled by the block `submit_source`. |
| `form_type` | The form family. The built-in audit form uses `architect`. |
| `name` | Submitter name. |
| `email` | Submitter email. |
| `revenue` | Revenue range selected by the visitor. |
| `budget` | Budget range selected by the visitor. |
| `problem` | Free-text description of the bottleneck. |

The form also captures campaign and page context when present:

| Field | Source |
|---|---|
| `utm_source` | URL query parameter. |
| `utm_medium` | URL query parameter. |
| `utm_campaign` | URL query parameter. |
| `utm_term` | URL query parameter. |
| `utm_content` | URL query parameter. |
| `gclid` | Google Ads click ID query parameter. |
| `fbclid` | Meta/Facebook click ID query parameter. |
| `msclkid` | Microsoft Ads click ID query parameter. |
| `landing_page` | `window.location.pathname`. |
| `page_url` | Full browser URL. |
| `referrer` | `document.referrer`. |
| `user_agent` | Browser user agent. |

## Campaign URLs

Use UTM-tagged links in ads, email, social posts, and partner placements.

```txt
https://example.com/services/custom-apps/database?utm_source=google&utm_medium=cpc&utm_campaign=postgres_offer
```

Good naming rules:

- Keep campaign names stable and lowercase.
- Use hyphens or underscores consistently.
- Separate audience, offer, and channel when useful.
- Avoid putting private customer information in query parameters.

Example:

```txt
utm_source=linkedin
utm_medium=organic
utm_campaign=founder_postgres_audit
utm_content=carousel_01
```

## Retrieve leads

Recent submissions:

```sql
SELECT id, created_at, source, form_type, name, email, revenue, budget, problem
FROM leads
ORDER BY created_at DESC
LIMIT 25;
```

Campaign attribution:

```sql
SELECT
  id,
  created_at,
  name,
  email,
  source,
  data_json->>'utm_source' AS utm_source,
  data_json->>'utm_medium' AS utm_medium,
  data_json->>'utm_campaign' AS utm_campaign,
  data_json->>'page_url' AS page_url,
  data_json->>'referrer' AS referrer
FROM leads
ORDER BY created_at DESC;
```

Leads from a specific page:

```sql
SELECT id, created_at, name, email, problem, data_json->>'page_url' AS page_url
FROM leads
WHERE data_json->>'landing_page' = '/services/custom-apps/database'
ORDER BY created_at DESC;
```

Leads by paid click IDs:

```sql
SELECT id, created_at, name, email, data_json
FROM leads
WHERE data_json ? 'gclid'
   OR data_json ? 'fbclid'
   OR data_json ? 'msclkid'
ORDER BY created_at DESC;
```

## Export leads

Postgres CSV export:

```sql
\copy (
  SELECT id, created_at, source, form_type, name, email, phone, revenue, budget, problem, data_json
  FROM leads
  ORDER BY created_at DESC
) TO 'caw-leads.csv' CSV HEADER;
```

## CRM or webhook handoff

CAW does not force one CRM. Common patterns:

1. **Manual export:** Run the SQL export and upload the CSV to your CRM.
2. **Scheduled sync:** Run a small worker that polls new `leads` rows and sends them to HubSpot, GoHighLevel, Salesforce, Airtable, or another CRM.
3. **Webhook extension:** Add a post-insert step in `/api/submit-lead` that calls your webhook after the database insert succeeds.
4. **Queue-based sync:** Insert into Postgres first, then use a worker or queue so a CRM outage never loses the lead.

Recommended order for production:

```txt
Database insert first → webhook/CRM second → log failures → retry async
```

That order protects the lead even when a third-party service is down.

## Analytics script setup

CAW lead attribution is independent from analytics scripts. Add scripts through whichever approach fits your deployment:

- Put Google Tag Manager, Google Analytics, Meta Pixel, Clarity, or other snippets in `views/layout.ejs`.
- Or deploy one GTM container and manage vendor scripts inside GTM.
- Use UTM URLs so lead rows can be matched against analytics reports.

Minimal GTM placement pattern:

```ejs
<!-- views/layout.ejs, inside <head> -->
<script>
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');
</script>
```

Then place the GTM noscript block after `<body>` if your compliance requirements call for it.

## Form source strategy

Every `audit_form` block can define a source:

```json
{
  "block_type": "audit_form",
  "data": {
    "title": "Technical Strategy Session",
    "subhead": "Let's audit your stack.",
    "form_title": "INITIATE_HANDSHAKE_PROTOCOL",
    "submit_source": "ServicePage_Postgres"
  }
}
```

Use sources like:

- `Home_Audit`
- `Blog_CTA`
- `PSEO_Austin_Postgres`
- `GoogleAds_Database_Audit`

The `source` field is useful when URLs or UTM parameters are missing.

## Troubleshooting

### The form shows `ERR_CONNECTION_REFUSED`

Check:

```bash
curl http://localhost:4321/health
curl http://localhost:4321/api/health
```

Then confirm `DATABASE_URL` is set and the `leads` table exists.

### Leads are inserted but attribution fields are missing

Confirm the landing URL actually contains UTM or click ID query parameters. The form captures query parameters from the browser URL at submit time.

### The page works locally but not in production

Check:

- `DATABASE_URL` is correct for the production database.
- Postgres allows the app to connect.
- `SITE_URL` is set to the HTTPS domain.
- Reverse proxy request body limits allow JSON form submissions.

## Privacy notes

- Do not put sensitive personal information in UTM parameters.
- Add consent banners or consent-mode logic when required by the target market.
- Keep a retention policy for lead rows.
- Limit database access to only the people and services that need it.
