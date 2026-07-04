# Database Schema Reference

CAW uses PostgreSQL for all data storage. The application expects the tables to exist (created by `schema.sql` and `schema-articles.sql`).

## `caw_content`
Stores core page configurations, defining routes dynamically.

| Column | Type | Default | Description |
|---|---|---|---|
| `slug` | TEXT | PRIMARY KEY | The URL path (e.g., `about`, `services/api`) |
| `title` | TEXT | NOT NULL | Page `<title>` |
| `blocks` | JSONB | `'[]'` | Array of block definitions (see BLOCK_REFERENCE) |
| `palette` | TEXT | `'emerald'` | The CSS theme to use for the page |
| `nav` | JSONB | NULL | Navigation configuration |
| `footer` | JSONB | NULL | Footer configuration |
| `source` | TEXT | `'seed'` | Where the data originated |

## `caw_articles`
Stores blog posts, news, and knowledge-base entries.

| Column | Type | Default | Description |
|---|---|---|---|
| `slug` | TEXT | PRIMARY KEY | URL path under `/blog/` |
| `title` | TEXT | NOT NULL | Article title |
| `excerpt` | TEXT | NULL | Short summary for cards |
| `content` | TEXT | NOT NULL | HTML body content |
| `category` | TEXT | `'infrastructure'` | Categorization label |
| `tags` | JSONB | `'[]'` | Array of tag strings |
| `author` | TEXT | `'Author'` | Name of the author |
| `status` | TEXT | `'draft'` | `draft`, `published`, `archived` |
| `published_at` | TIMESTAMPTZ | NULL | Controls visibility on the frontend |

## `caw_seed`
Stores raw JSON configuration chunks used for initial seeding.

| Column | Type | Default | Description |
|---|---|---|---|
| `key` | TEXT | PRIMARY KEY | Identifier (e.g., `main_nav`, `main_footer`) |
| `value` | JSONB | NOT NULL | The JSON payload |

## `leads`
*(Not created by default `schema.sql`, usually created by external services or created manually during dev)*
Stores inbound form submissions from `POST /api/submit-lead`.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| `source` | TEXT | NULL | Site identifier |
| `name` | TEXT | NULL | Submitter name |
| `email` | TEXT | NULL | Submitter email |
| `phone` | TEXT | NULL | Submitter phone |
| `problem` | TEXT | NULL | Described issue |
| `form_type` | TEXT | NULL | Form identifier |
| `data_json` | JSONB | NULL | Raw form payload |
| `created_at` | TIMESTAMPTZ | `NOW()` | Submission timestamp |
