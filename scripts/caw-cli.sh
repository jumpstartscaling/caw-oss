#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# caw-cli — Terminal tool for managing caw_site content
# Usage: ./caw-cli.sh [command]
# ─────────────────────────────────────────────────────────────

DB_URL="postgres://postgres:T5onXDGk5dEB5usKJeLsBG4YCSXqbk7HZVAIn6d3sse8Do5LYyFfYQScPStbuQYA@86.48.23.38:5432/postgres?sslmode=require"

# Colors
G='\033[0;32m'  # Green
P='\033[0;35m'  # Pink
B='\033[0;34m'  # Blue
W='\033[1;37m'  # White bold
D='\033[0;90m'  # Dim
R='\033[0m'     # Reset

banner() {
  echo ""
  echo -e "${G}  ┌─────────────────────────────────────┐${R}"
  echo -e "${G}  │${W}  caw_site — Content Manager  ${G}│${R}"
  echo -e "${G}  └─────────────────────────────────────┘${R}"
  echo ""
}

require_psql() {
  if ! command -v psql &>/dev/null; then
    echo -e "${P}psql not found.${R} Install with: brew install libpq && brew link --force libpq"
    exit 1
  fi
}

run_sql() {
  PGSSLMODE=require psql "$DB_URL" -t -A -c "$1" 2>/dev/null
}

run_sql_pretty() {
  PGSSLMODE=require psql "$DB_URL" -c "$1" 2>/dev/null
}

# ── Commands ──────────────────────────────────────────────────

cmd_list() {
  echo -e "${W}Published Articles:${R}"
  echo ""
  run_sql_pretty "
    SELECT
      slug,
      LEFT(title, 50) AS title,
      category,
      to_char(published_at, 'YYYY-MM-DD') AS published
    FROM caw_articles
    WHERE status = 'published'
    ORDER BY published_at DESC;
  "
  COUNT=$(run_sql "SELECT COUNT(*) FROM caw_articles WHERE status = 'published'")
  echo -e "${D}Total: ${COUNT} articles${R}"
  echo -e "${D}Blog: https://caw_site/blog${R}"
}

cmd_pages() {
  local FILTER="$1"
  if [ "$FILTER" = "--auto" ]; then
    echo -e "${W}Auto-Generated Pages:${R}"
    echo ""
    run_sql_pretty "
      SELECT
        '/' || slug AS path,
        LEFT(title, 50) AS title,
        jsonb_array_length(blocks) AS blocks,
        to_char(created_at, 'YYYY-MM-DD') AS created
      FROM caw_content
      WHERE source = 'auto'
      ORDER BY created_at DESC;
    "
    COUNT=$(run_sql "SELECT COUNT(*) FROM caw_content WHERE source = 'auto'")
    echo -e "${D}Total auto-generated: ${COUNT}${R}"
  elif [ "$FILTER" = "--seed" ]; then
    echo -e "${W}Original Seeded Pages:${R}"
    echo ""
    run_sql_pretty "
      SELECT
        CASE WHEN slug = '' THEN '/' ELSE '/' || slug END AS path,
        LEFT(title, 55) AS title,
        jsonb_array_length(blocks) AS blocks
      FROM caw_content
      WHERE source = 'seed' OR source IS NULL
      ORDER BY slug;
    "
  else
    echo -e "${W}All Pages:${R}"
    echo ""
    run_sql_pretty "
      SELECT
        CASE WHEN slug = '' THEN '/' ELSE '/' || slug END AS path,
        LEFT(title, 50) AS title,
        jsonb_array_length(blocks) AS blocks,
        COALESCE(source, 'seed') AS src
      FROM caw_content
      ORDER BY source, slug;
    "
    TOTAL=$(run_sql "SELECT COUNT(*) FROM caw_content")
    AUTO=$(run_sql "SELECT COUNT(*) FROM caw_content WHERE source = 'auto'")
    echo -e "${D}Total: ${TOTAL} pages (${AUTO} auto-generated)${R}"
  fi
}

cmd_purge_auto() {
  COUNT=$(run_sql "SELECT COUNT(*) FROM caw_content WHERE source = 'auto'")
  echo -e "${W}This will delete ${COUNT} auto-generated pages from the database.${R}"
  echo -e "${D}Original seeded pages will NOT be affected.${R}"
  read -p "Continue? (y/N): " CONFIRM
  if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
    run_sql "DELETE FROM caw_content WHERE source = 'auto'"
    echo -e "${G}✓ Purged ${COUNT} auto-generated pages.${R}"
  else
    echo "Cancelled."
  fi
}

cmd_view() {
  if [ -z "$1" ]; then
    echo -e "${P}Usage: $0 view <slug>${R}"
    echo -e "${D}Example: $0 view why-self-hosted-beats-saas${R}"
    return 1
  fi
  run_sql_pretty "
    SELECT slug, title, excerpt, category, tags, status,
           to_char(published_at, 'YYYY-MM-DD HH24:MI') AS published,
           length(content) AS content_chars
    FROM caw_articles WHERE slug = '$1';
  "
  echo -e "${B}URL: https://caw_site/blog/$1${R}"
}

cmd_new() {
  echo -e "${W}Create New Article${R}"
  echo ""

  read -p "$(echo -e ${G})slug${R} (lowercase-with-hyphens): " SLUG
  [ -z "$SLUG" ] && echo "Cancelled." && return

  read -p "$(echo -e ${G})title${R}: " TITLE
  [ -z "$TITLE" ] && echo "Cancelled." && return

  read -p "$(echo -e ${G})excerpt${R} (one sentence): " EXCERPT

  echo -e "${D}Categories: infrastructure, ai, postgresql, frontend, fastapi, tracking, growth, security${R}"
  read -p "$(echo -e ${G})category${R} [infrastructure]: " CATEGORY
  CATEGORY=${CATEGORY:-infrastructure}

  read -p "$(echo -e ${G})tags${R} (comma-separated): " TAGS_RAW
  # Convert "tag1, tag2" to ["tag1","tag2"]
  TAGS_JSON=$(echo "$TAGS_RAW" | sed 's/[[:space:]]*,[[:space:]]*/","/g' | sed 's/^/["/' | sed 's/$/"]/')

  echo ""
  echo -e "${W}Enter HTML content below. Press Ctrl+D when done:${R}"
  echo -e "${D}(Tip: write in a text editor first, then paste here)${R}"
  CONTENT=$(cat)

  # Escape single quotes
  TITLE_ESC="${TITLE//\'/\'\'}"
  EXCERPT_ESC="${EXCERPT//\'/\'\'}"
  CONTENT_ESC="${CONTENT//\'/\'\'}"

  run_sql "
    INSERT INTO caw_articles (slug, title, excerpt, content, category, tags, status, published_at)
    VALUES (
      '${SLUG}',
      '${TITLE_ESC}',
      '${EXCERPT_ESC}',
      '${CONTENT_ESC}',
      '${CATEGORY}',
      '${TAGS_JSON}'::jsonb,
      'published',
      NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, content = EXCLUDED.content,
      category = EXCLUDED.category, tags = EXCLUDED.tags, status = EXCLUDED.status, updated_at = NOW();
  "

  echo ""
  echo -e "${G}✓ Published!${R}"
  echo -e "${B}URL: https://caw_site/blog/${SLUG}${R}"
}

cmd_insert_file() {
  if [ -z "$1" ]; then
    echo -e "${P}Usage: $0 insert-file <path-to-sql-file>${R}"
    echo -e "${D}Example: $0 insert-file article.sql${R}"
    return 1
  fi
  if [ ! -f "$1" ]; then
    echo -e "${P}File not found: $1${R}"
    return 1
  fi
  
  LINES=$(wc -l < "$1" | tr -d ' ')
  echo -e "${D}Running ${1} (${LINES} lines)...${R}"

  # Detect existing slugs
  SLUGS=$(grep -oE "'[a-z0-9][a-z0-9-]*[a-z0-9]'" "$1" | head -20 | tr -d "'" | sort -u)
  EXISTING_BEFORE=""
  for SLUG in $SLUGS; do
    CHECK=$(run_sql "SELECT slug FROM caw_articles WHERE slug = '${SLUG}'" 2>/dev/null)
    if [ -n "$CHECK" ]; then
      EXISTING_BEFORE="$EXISTING_BEFORE $SLUG"
    fi
  done

  START_S=$(python3 -c "import time; print(time.time())" 2>/dev/null || echo "0")
  OUTPUT=$(PGSSLMODE=require psql "$DB_URL" -f "$1" 2>&1)
  EXIT_CODE=$?
  END_S=$(python3 -c "import time; print(time.time())" 2>/dev/null || echo "0")
  DURATION=$(python3 -c "print(f'{(${END_S} - ${START_S}):.2f}')" 2>/dev/null || echo "?")

  echo ""
  if [ $EXIT_CODE -ne 0 ]; then
    echo -e "${P}✗ SQL Error:${R}"
    echo ""
    echo "$OUTPUT" | head -10
    rm -f "$TMPFILE"
    return 1
  fi

  INSERT_COUNT=$(echo "$OUTPUT" | grep -c "INSERT")
  echo -e "${G}✓ Done${R} — ${INSERT_COUNT} article(s) from ${1} in ${DURATION}s"
  echo ""

  for SLUG in $SLUGS; do
    ROW=$(run_sql "SELECT slug, title, status FROM caw_articles WHERE slug = '${SLUG}' LIMIT 1" 2>/dev/null)
    if [ -n "$ROW" ]; then
      TITLE=$(echo "$ROW" | cut -d'|' -f2)
      STATUS=$(echo "$ROW" | cut -d'|' -f3)
      if echo "$EXISTING_BEFORE" | grep -q "$SLUG"; then
        LABEL="${P}updated${R}"
      else
        LABEL="${G}new${R}"
      fi
      echo -e "  ${G}●${R} [${LABEL}] ${W}${TITLE}${R}"
      if [ "$STATUS" = "published" ]; then
        echo -e "    ${B}https://caw_site/blog/${SLUG}${R}"
      else
        echo -e "    ${D}(status: ${STATUS} — not live yet)${R}"
      fi
      echo ""
    fi
  done
}

cmd_insert_sql() {
  TMPFILE=$(mktemp /tmp/caw_insert_XXXXXX.sql)
  
  echo -e "${W}Paste your SQL below, then press ${G}Ctrl+D${W} to execute:${R}"
  echo -e "${D}(Paste the full INSERT statement — it can be multiple lines)${R}"
  echo ""

  # Read input into temp file
  cat > "$TMPFILE"
  
  # Check we got something
  if [ ! -s "$TMPFILE" ]; then
    echo -e "\n${P}✗ Empty input. Nothing executed.${R}"
    rm -f "$TMPFILE"
    return 1
  fi

  LINES=$(wc -l < "$TMPFILE" | tr -d ' ')
  echo ""
  echo -e "${D}Received ${LINES} lines of SQL. Executing...${R}"

  # Get slugs BEFORE execution to detect new vs update
  SLUGS=$(grep -oE "'[a-z0-9][a-z0-9-]*[a-z0-9]'" "$TMPFILE" | head -20 | tr -d "'" | sort -u)
  EXISTING_BEFORE=""
  for SLUG in $SLUGS; do
    CHECK=$(run_sql "SELECT slug FROM caw_articles WHERE slug = '${SLUG}'" 2>/dev/null)
    if [ -n "$CHECK" ]; then
      EXISTING_BEFORE="$EXISTING_BEFORE $SLUG"
    fi
  done

  # Replace NOW() with random dates between last year and today
  python3 -c "
import random, datetime, re, sys
text = open('$TMPFILE').read()
today = datetime.date.today()
one_year_ago = today - datetime.timedelta(days=365)
def rand_date(_):
    days = random.randint(0, 365)
    d = one_year_ago + datetime.timedelta(days=days)
    h, m, s = random.randint(6,22), random.randint(0,59), random.randint(0,59)
    return f\"'{d.isoformat()}T{h:02d}:{m:02d}:{s:02d}Z'\"
text = re.sub(r'NOW\(\)', rand_date, text)
open('$TMPFILE','w').write(text)
" 2>/dev/null

  # Execute
  START_S=$(python3 -c "import time; print(time.time())" 2>/dev/null || echo "0")
  OUTPUT=$(PGSSLMODE=require psql "$DB_URL" -f "$TMPFILE" 2>&1)
  EXIT_CODE=$?
  END_S=$(python3 -c "import time; print(time.time())" 2>/dev/null || echo "0")
  DURATION=$(python3 -c "print(f'{(${END_S} - ${START_S}):.2f}')" 2>/dev/null || echo "?")

  echo ""

  if [ $EXIT_CODE -ne 0 ]; then
    echo -e "${P}✗ SQL Error:${R}"
    echo ""
    echo "$OUTPUT" | head -10
    echo ""
    echo -e "${D}Check your SQL for syntax errors (missing quotes, unescaped apostrophes, etc.)${R}"
    rm -f "$TMPFILE"
    return 1
  fi

  INSERT_COUNT=$(echo "$OUTPUT" | grep -c "INSERT")
  echo -e "${G}✓ Done${R} — ${INSERT_COUNT} article(s) processed in ${DURATION}s"
  echo ""

  # Show results for each article
  for SLUG in $SLUGS; do
    ROW=$(run_sql "SELECT slug, title, status FROM caw_articles WHERE slug = '${SLUG}' LIMIT 1" 2>/dev/null)
    if [ -n "$ROW" ]; then
      TITLE=$(echo "$ROW" | cut -d'|' -f2)
      STATUS=$(echo "$ROW" | cut -d'|' -f3)

      # Detect if it was new or updated
      if echo "$EXISTING_BEFORE" | grep -q "$SLUG"; then
        LABEL="${P}updated${R}"
      else
        LABEL="${G}new${R}"
      fi

      echo -e "  ${G}●${R} [${LABEL}] ${W}${TITLE}${R}"
      if [ "$STATUS" = "published" ]; then
        echo -e "    ${B}https://caw_site/blog/${SLUG}${R}"
      else
        echo -e "    ${D}(status: ${STATUS} — not live yet)${R}"
      fi
      echo ""
    fi
  done

  rm -f "$TMPFILE"
}

cmd_delete() {
  if [ -z "$1" ]; then
    echo -e "${P}Usage: $0 delete <slug>${R}"
    return 1
  fi
  read -p "Archive article '${1}'? (y/N): " CONFIRM
  if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
    run_sql "UPDATE caw_articles SET status = 'archived', updated_at = NOW() WHERE slug = '$1'"
    echo -e "${G}✓ Archived (not deleted). Set status back to 'published' to restore.${R}"
  else
    echo "Cancelled."
  fi
}

cmd_unpublish() {
  if [ -z "$1" ]; then
    echo -e "${P}Usage: $0 unpublish <slug>${R}"
    return 1
  fi
  run_sql "UPDATE caw_articles SET status = 'draft', updated_at = NOW() WHERE slug = '$1'"
  echo -e "${G}✓ Unpublished. Article is now a draft.${R}"
}

cmd_publish() {
  if [ -z "$1" ]; then
    echo -e "${P}Usage: $0 publish <slug>${R}"
    return 1
  fi
  run_sql "UPDATE caw_articles SET status = 'published', published_at = COALESCE(published_at, NOW()), updated_at = NOW() WHERE slug = '$1'"
  echo -e "${G}✓ Published!${R}"
  echo -e "${B}URL: https://caw_site/blog/$1${R}"
}

cmd_health() {
  echo -e "${W}Site Health:${R}"
  echo ""
  HEALTH=$(curl -s https://caw_site/api/health)
  echo -e "  API:      ${G}${HEALTH}${R}"
  echo ""
  PAGES=$(run_sql "SELECT COUNT(*) FROM caw_content")
  ARTICLES=$(run_sql "SELECT COUNT(*) FROM caw_articles WHERE status = 'published'")
  DRAFTS=$(run_sql "SELECT COUNT(*) FROM caw_articles WHERE status = 'draft'")
  LEADS=$(run_sql "SELECT COUNT(*) FROM leads")
  echo -e "  Pages:    ${W}${PAGES}${R}"
  echo -e "  Articles: ${W}${ARTICLES}${R} published, ${D}${DRAFTS} drafts${R}"
  echo -e "  Leads:    ${W}${LEADS}${R}"
  echo ""
  echo -e "  Site:     ${B}https://caw_site${R}"
  echo -e "  Blog:     ${B}https://caw_site/blog${R}"
  echo -e "  Coolify:  ${B}http://localhost:8000${R}"
}

cmd_leads() {
  echo -e "${W}Recent Leads:${R}"
  echo ""
  run_sql_pretty "
    SELECT
      id, name, email, source, form_type,
      to_char(created_at, 'YYYY-MM-DD HH24:MI') AS submitted
    FROM leads
    ORDER BY created_at DESC
    LIMIT 20;
  "
}

cmd_search() {
  if [ -z "$1" ]; then
    echo -e "${P}Usage: $0 search <keyword>${R}"
    return 1
  fi
  run_sql_pretty "
    SELECT slug, LEFT(title, 50) AS title, category
    FROM caw_articles
    WHERE title ILIKE '%${1}%' OR content ILIKE '%${1}%' OR excerpt ILIKE '%${1}%'
    ORDER BY published_at DESC;
  "
}

cmd_categories() {
  echo -e "${W}Articles by Category:${R}"
  echo ""
  run_sql_pretty "
    SELECT category, COUNT(*) AS articles
    FROM caw_articles
    WHERE status = 'published'
    GROUP BY category
    ORDER BY articles DESC;
  "
}

cmd_export() {
  OUTFILE="${1:-caw_articles_export.sql}"
  echo -e "${W}Exporting all articles to ${OUTFILE}...${R}"
  PGSSLMODE=require pg_dump "$DB_URL" -t caw_articles --data-only --inserts > "$OUTFILE" 2>/dev/null
  echo -e "${G}✓ Exported to ${OUTFILE}${R}"
}

cmd_sql() {
  echo -e "${W}Interactive SQL (type \\q to quit):${R}"
  PGSSLMODE=require psql "$DB_URL" 2>/dev/null
}

cmd_help() {
  banner
  echo -e "  ${W}ARTICLES${R}"
  echo -e "  ${G}list${R}                    List all published articles"
  echo -e "  ${G}view${R} <slug>             View article details"
  echo -e "  ${G}new${R}                     Create a new article (interactive)"
  echo -e "  ${G}insert-sql${R}              Paste raw SQL to execute"
  echo -e "  ${G}insert-file${R} <file.sql>  Run a SQL file"
  echo -e "  ${G}publish${R} <slug>          Publish a draft article"
  echo -e "  ${G}unpublish${R} <slug>        Unpublish (set to draft)"
  echo -e "  ${G}delete${R} <slug>           Archive an article"
  echo -e "  ${G}search${R} <keyword>        Search articles by keyword"
  echo -e "  ${G}categories${R}              Show article counts by category"
  echo ""
  echo -e "  ${W}SITE${R}"
  echo -e "  ${G}pages${R}                   List all site pages"
  echo -e "  ${G}pages --auto${R}            List auto-generated pages only"
  echo -e "  ${G}pages --seed${R}            List original seeded pages only"
  echo -e "  ${G}purge-auto${R}              Delete all auto-generated pages"
  echo -e "  ${G}health${R}                  Check site health & stats"
  echo -e "  ${G}leads${R}                   Show recent form submissions"
  echo ""
  echo -e "  ${W}ADVANCED${R}"
  echo -e "  ${G}sql${R}                     Interactive psql session"
  echo -e "  ${G}export${R} [file.sql]       Export all articles as SQL"
  echo ""
  echo -e "  ${D}Requires: psql (brew install libpq && brew link --force libpq)${R}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────

require_psql

case "${1}" in
  list)         cmd_list ;;
  pages)        cmd_pages "$2" ;;
  purge-auto)   cmd_purge_auto ;;
  view)         cmd_view "$2" ;;
  new)          cmd_new ;;
  insert-sql)   cmd_insert_sql ;;
  insert-file)  cmd_insert_file "$2" ;;
  delete)       cmd_delete "$2" ;;
  unpublish)    cmd_unpublish "$2" ;;
  publish)      cmd_publish "$2" ;;
  health)       cmd_health ;;
  leads)        cmd_leads ;;
  search)       cmd_search "$2" ;;
  categories)   cmd_categories ;;
  export)       cmd_export "$2" ;;
  sql)          cmd_sql ;;
  help|--help|-h|"") cmd_help ;;
  *)
    echo -e "${P}Unknown command: $1${R}"
    cmd_help
    ;;
esac
