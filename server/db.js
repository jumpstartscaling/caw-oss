import pg from 'pg';

let pool = null;

export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const url = process.env.DATABASE_URL;
    // Cloud/Coolify Postgres: skip cert verify for TLS connections
    const ssl = url.includes('sslmode=require') || url.includes('sslmode=no-verify') || !url.includes('127.0.0.1')
      ? { rejectUnauthorized: false }
      : false;
    pool = new pg.Pool({ connectionString: url, ssl });
  }
  return pool;
}

export async function getPageData(slug) {
  const p = getPool();
  if (!p) return null;
  const normalized = (slug || '').trim().replace(/^\/+|\/+$/g, '').replace(/^index$/, '') || '';
  try {
    const r = await p.query(
      `SELECT slug, title, blocks, palette, nav, footer, local_seo FROM caw_content WHERE slug = $1 LIMIT 1`,
      [normalized]
    );
    const row = r.rows[0];
    if (!row) return null;
    const blocks = (row.blocks || []).map((b) => ({ block_type: b.block_type, data: b.data || {} }));
    return {
      page: { id: row.slug, title: row.title || '', slug: row.slug || null },
      blocks,
      palette: row.palette || 'emerald',
      nav: row.nav ?? null,
      footer: row.footer ?? null,
      local_seo: row.local_seo,
    };
  } catch (err) {
    console.error('[db] getPageData:', err.message);
    return null;
  }
}

export async function getArticles({ category, limit = 20, offset = 0 } = {}) {
  const p = getPool();
  if (!p) return [];
  try {
    const params = [];
    let where = "status = 'published'";
    if (category) {
      params.push(category);
      where += ` AND category = $${params.length}`;
    }
    params.push(limit, offset);
    const r = await p.query(
      `SELECT slug, title, excerpt, category, tags, author, og_image, published_at
       FROM caw_articles WHERE ${where}
       ORDER BY published_at DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return r.rows;
  } catch (err) {
    console.error('[db] getArticles:', err.message);
    return [];
  }
}

export async function getArticle(slug) {
  const p = getPool();
  if (!p) return null;
  try {
    const r = await p.query(
      `SELECT slug, title, excerpt, content, category, tags, author, og_image, published_at
       FROM caw_articles WHERE slug = $1 AND status = 'published' LIMIT 1`,
      [slug]
    );
    return r.rows[0] || null;
  } catch (err) {
    console.error('[db] getArticle:', err.message);
    return null;
  }
}

export async function searchContent(query, limit = 30) {
  const p = getPool();
  if (!p) return { articles: [], pages: [] };
  const q = `%${query}%`;
  try {
    const [articles, pages] = await Promise.all([
      p.query(
        `SELECT slug, title, excerpt, category, tags, published_at,
                ts_rank(to_tsvector('english', title || ' ' || COALESCE(excerpt,'') || ' ' || content), plainto_tsquery('english', $1)) AS rank
         FROM caw_articles WHERE status = 'published'
           AND (title ILIKE $2 OR excerpt ILIKE $2 OR content ILIKE $2)
         ORDER BY rank DESC, published_at DESC LIMIT $3`,
        [query, q, limit]
      ),
      p.query(
        `SELECT slug, title FROM caw_content
         WHERE title ILIKE $1 OR blocks::text ILIKE $1
         ORDER BY slug LIMIT 10`,
        [q]
      ),
    ]);
    return { articles: articles.rows, pages: pages.rows };
  } catch (err) {
    console.error('[db] searchContent:', err.message);
    return { articles: [], pages: [] };
  }
}

export async function getRelatedArticles(slug, category, limit = 3) {
  const p = getPool();
  if (!p) return [];
  try {
    const r = await p.query(
      `SELECT slug, title, excerpt, category, tags, published_at
       FROM caw_articles
       WHERE status = 'published' AND slug != $1 AND category = $2
       ORDER BY published_at DESC LIMIT $3`,
      [slug, category, limit]
    );
    if (r.rows.length < limit) {
      const fill = await p.query(
        `SELECT slug, title, excerpt, category, tags, published_at
         FROM caw_articles
         WHERE status = 'published' AND slug != $1 AND slug != ALL($2::text[])
         ORDER BY published_at DESC LIMIT $3`,
        [slug, r.rows.map((x) => x.slug), limit - r.rows.length]
      );
      return [...r.rows, ...fill.rows];
    }
    return r.rows;
  } catch (err) {
    console.error('[db] getRelatedArticles:', err.message);
    return [];
  }
}

export async function getArticleNav(slug) {
  const p = getPool();
  if (!p) return { prev: null, next: null };
  try {
    const [prev, next] = await Promise.all([
      p.query(
        `SELECT slug, title FROM caw_articles
         WHERE status = 'published' AND published_at < (SELECT published_at FROM caw_articles WHERE slug = $1)
         ORDER BY published_at DESC LIMIT 1`,
        [slug]
      ),
      p.query(
        `SELECT slug, title FROM caw_articles
         WHERE status = 'published' AND published_at > (SELECT published_at FROM caw_articles WHERE slug = $1)
         ORDER BY published_at ASC LIMIT 1`,
        [slug]
      ),
    ]);
    return { prev: prev.rows[0] || null, next: next.rows[0] || null };
  } catch (err) {
    console.error('[db] getArticleNav:', err.message);
    return { prev: null, next: null };
  }
}

export async function getCategoryCounts() {
  const p = getPool();
  if (!p) return {};
  try {
    const r = await p.query(
      `SELECT category, COUNT(*)::int AS count
       FROM caw_articles WHERE status = 'published'
       GROUP BY category ORDER BY count DESC`
    );
    const counts = {};
    for (const row of r.rows) counts[row.category] = row.count;
    return counts;
  } catch (err) {
    console.error('[db] getCategoryCounts:', err.message);
    return {};
  }
}

export async function getRecentArticles(limit = 5) {
  const p = getPool();
  if (!p) return [];
  try {
    const r = await p.query(
      `SELECT slug, title, excerpt, category, tags, published_at
       FROM caw_articles WHERE status = 'published'
       ORDER BY published_at DESC LIMIT $1`,
      [limit]
    );
    return r.rows;
  } catch (err) {
    console.error('[db] getRecentArticles:', err.message);
    return [];
  }
}

export async function findBestRedirect(slug) {
  const p = getPool();
  if (!p) return null;

  const stopWords = new Set(['the', 'and', 'for', 'with', 'how', 'why', 'what', 'our', 'your', 'page', 'site', 'web', 'app', 'new', 'get', 'can', 'you', 'are', 'was', 'has', 'have', 'this', 'that', 'from', 'all', 'not', 'but']);
  const keywords = slug.replace(/[^a-z0-9]/gi, ' ').split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase()));
  if (keywords.length === 0) return null;

  try {
    // 1. Exact prefix match — strip trailing segments
    const parts = slug.split('/');
    for (let i = parts.length; i >= 1; i--) {
      const partial = parts.slice(0, i).join('/');
      const r = await p.query('SELECT slug FROM caw_content WHERE slug = $1 LIMIT 1', [partial]);
      if (r.rows[0]) return { slug: r.rows[0].slug, type: 'page' };
    }

    // 2. Check articles exact slug
    const artExact = await p.query(
      "SELECT slug FROM caw_articles WHERE status = 'published' AND slug = $1 LIMIT 1",
      [slug]
    );
    if (artExact.rows[0]) return { slug: `blog/${artExact.rows[0].slug}`, type: 'article' };

    // 3. Keyword match on pages — require >=2 keyword hits or 1 strong hit (>5 chars)
    const likeConditions = keywords.map((_, i) => `slug ILIKE $${i + 1}`);
    const likeParams = keywords.map((k) => `%${k}%`);
    const minScore = keywords.length >= 2 ? 2 : (keywords[0] && keywords[0].length > 5 ? 1 : 2);
    if (likeConditions.length > 0) {
      const pageMatch = await p.query(
        `SELECT slug, (${likeConditions.map((c) => `CASE WHEN ${c} THEN 1 ELSE 0 END`).join(' + ')}) AS score
         FROM caw_content WHERE ${likeConditions.join(' OR ')}
         ORDER BY score DESC, length(slug) ASC LIMIT 1`,
        likeParams
      );
      if (pageMatch.rows[0] && pageMatch.rows[0].score >= minScore) {
        return { slug: pageMatch.rows[0].slug, type: 'page' };
      }
    }

    // 4. Keyword match on articles — same threshold
    const artLikeConditions = keywords.map((_, i) => `(slug ILIKE $${i + 1} OR title ILIKE $${i + 1})`);
    if (artLikeConditions.length > 0) {
      const artMatch = await p.query(
        `SELECT slug, (${artLikeConditions.map((c) => `CASE WHEN ${c} THEN 1 ELSE 0 END`).join(' + ')}) AS score
         FROM caw_articles WHERE status = 'published' AND (${artLikeConditions.join(' OR ')})
         ORDER BY score DESC LIMIT 1`,
        likeParams
      );
      if (artMatch.rows[0] && artMatch.rows[0].score >= minScore) {
        return { slug: `blog/${artMatch.rows[0].slug}`, type: 'article' };
      }
    }

    return null;
  } catch (err) {
    console.error('[db] findBestRedirect:', err.message);
    return null;
  }
}

export async function getAllLocations() {
  const p = getPool();
  if (!p) return [];
  try {
    const r = await p.query('SELECT id, city, state, slug FROM locations ORDER BY state, city');
    return r.rows;
  } catch (err) { console.error('[db] getAllLocations:', err.message); return []; }
}

export async function getAllServices() {
  const p = getPool();
  if (!p) return [];
  try {
    const r = await p.query('SELECT id, service_type, sub_niche, slug FROM pseo_services ORDER BY service_type');
    return r.rows;
  } catch (err) { console.error('[db] getAllServices:', err.message); return []; }
}

export async function getServicePages(serviceSlug) {
  const p = getPool();
  if (!p) return { service: null, pages: [] };
  try {
    const svc = await p.query('SELECT service_type, sub_niche, slug FROM pseo_services WHERE slug = $1 LIMIT 1', [serviceSlug]);
    if (!svc.rows[0]) return { service: null, pages: [] };
    const pages = await p.query(
      `SELECT cm.slug, cm.title, l.city, l.state, l.slug AS location_slug
       FROM content_matrix cm JOIN locations l ON l.id = cm.location_id
       JOIN pseo_services ps ON ps.id = cm.service_id
       WHERE ps.slug = $1 ORDER BY l.state, l.city`,
      [serviceSlug]
    );
    return { service: svc.rows[0], pages: pages.rows };
  } catch (err) { console.error('[db] getServicePages:', err.message); return { service: null, pages: [] }; }
}

export async function getLocationPages(locationSlug) {
  const p = getPool();
  if (!p) return { location: null, pages: [] };
  try {
    const loc = await p.query('SELECT city, state, slug FROM locations WHERE slug = $1 LIMIT 1', [locationSlug]);
    if (!loc.rows[0]) return { location: null, pages: [] };
    const geo = await p.query(
      "SELECT data FROM geo_intelligence WHERE cluster_key = $1 LIMIT 1",
      [loc.rows[0].city.toLowerCase().replace(/[^a-z]/g, '-') + '-' + loc.rows[0].state.toLowerCase()]
    );
    const pages = await p.query(
      `SELECT cm.slug, cm.title, ps.service_type, ps.sub_niche, ps.slug AS service_slug
       FROM content_matrix cm JOIN pseo_services ps ON ps.id = cm.service_id
       JOIN locations l ON l.id = cm.location_id
       WHERE l.slug = $1 ORDER BY ps.service_type`,
      [locationSlug]
    );

    // Fetch tech_value_props descriptions from spintax_dictionaries
    const descRows = await p.query("SELECT data FROM spintax_dictionaries WHERE category = 'tech_value_props' LIMIT 1");
    const techDescriptions = descRows.rows[0]?.data || [];

    // Map service types to descriptions based on keyword matching
    const descMap = {
      'ai': 0,        // "We engineer private AI systems that run while you sleep."
      'headless': 1,   // "Our headless architecture delivers perfect Core Web Vitals."
      'seo': 2,        // "Programmatic SEO turns your domain into a 24/7 lead magnet."
      'zapier': 3,     // "Zapier replacements built in native code for zero latency."
      'full-stack': 4, // "Full-stack unicorn builds delivered in under 14 days."
      'agent': 5,      // "AI agents that replace entire departments."
      'scale': 6,      // "Revenue engines that scale to 10,000 concurrent users."
    };

    for (const page of pages.rows) {
      const st = (page.service_type || '').toLowerCase();
      let descIdx = null;
      for (const [keyword, idx] of Object.entries(descMap)) {
        if (st.includes(keyword)) { descIdx = idx; break; }
      }
      page.description = descIdx !== null && techDescriptions[descIdx]
        ? techDescriptions[descIdx]
        : techDescriptions[descIdx] || techDescriptions[Math.floor(Math.random() * techDescriptions.length)] || '';
    }

    return { location: loc.rows[0], geo: geo.rows[0]?.data || {}, pages: pages.rows };
  } catch (err) { console.error('[db] getLocationPages:', err.message); return { location: null, pages: [] }; }
}

export async function getPseoPage(slug) {
  const p = getPool();
  if (!p) return null;

  try {
    const cm = await p.query(
      `SELECT cm.slug, cm.title, cm.meta_description,
              l.city, l.state, l.zip, l.slug AS location_slug,
              ps.service_type, ps.sub_niche, ps.slug AS service_slug
       FROM content_matrix cm
       JOIN locations l ON l.id = cm.location_id
       JOIN pseo_services ps ON ps.id = cm.service_id
       WHERE cm.slug = $1 LIMIT 1`,
      [slug]
    );
    if (!cm.rows[0]) return null;
    const row = cm.rows[0];

    // Get geo intelligence
    const geoKey = `${row.city.toLowerCase().replace(/[^a-z]/g, '-')}-${row.state.toLowerCase()}`;
    const geo = await p.query(
      'SELECT data FROM geo_intelligence WHERE cluster_key = $1 LIMIT 1',
      [geoKey]
    );
    const geoData = geo.rows[0]?.data || { city: row.city, state: row.state, county: '', landmark: '', tech_scene_description: '' };

    // Get spintax dictionaries
    const spintaxRows = await p.query('SELECT category, data FROM spintax_dictionaries');
    const spintax = {};
    for (const s of spintaxRows.rows) spintax[s.category] = s.data;

    // Get content fragments
    const fragRows = await p.query("SELECT fragment_type, fragment_text FROM content_fragments WHERE fragment_text != '' AND status = 'active'");
    const fragments = {};
    for (const f of fragRows.rows) {
      if (!fragments[f.fragment_type]) fragments[f.fragment_type] = [];
      fragments[f.fragment_type].push(f.fragment_text);
    }

    // Get offer blocks
    const offerRows = await p.query('SELECT block_type, data FROM offer_blocks');
    const offers = {};
    for (const o of offerRows.rows) {
      if (!offers[o.block_type]) offers[o.block_type] = [];
      offers[o.block_type].push(o.data);
    }

    // Get related articles
    const serviceKeywords = row.service_slug.split('-').filter((w) => w.length > 3);
    let relatedArticles = [];
    if (serviceKeywords.length > 0) {
      const artQ = await p.query(
        `SELECT slug, title, excerpt FROM caw_articles
         WHERE status = 'published' AND (${serviceKeywords.map((_, i) => `(title ILIKE $${i + 1} OR slug ILIKE $${i + 1})`).join(' OR ')})
         ORDER BY published_at DESC LIMIT 3`,
        serviceKeywords.map((k) => `%${k}%`)
      );
      relatedArticles = artQ.rows;
    }

    // Get nav/footer from existing page
    const template = await p.query('SELECT nav, footer, palette FROM caw_content LIMIT 1');
    const nav = template.rows[0]?.nav || {};
    const footer = template.rows[0]?.footer || {};
    const palette = template.rows[0]?.palette || 'emerald';

    // Spintax resolver
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function resolve(text) {
      if (!text) return '';
      let out = text;
      // Core location/service variables
      out = out.replace(/\{City\}/gi, row.city);
      out = out.replace(/\{State\}/gi, row.state);
      out = out.replace(/\{County\}/gi, geoData.county || row.state);
      out = out.replace(/\{Landmark\}/gi, geoData.landmark || row.city);
      out = out.replace(/\{local\}/gi, `${row.city}, ${row.state}`);
      out = out.replace(/\{city\}/gi, row.city);
      out = out.replace(/\{state\}/gi, row.state);
      out = out.replace(/\{county\}/gi, geoData.county || '');
      out = out.replace(/\{service_type\}/gi, row.service_type);
      out = out.replace(/\{sub_niche\}/gi, row.sub_niche);
      out = out.replace(/\{software\}/gi, `${row.service_type} ${row.sub_niche}`);
      // Missing variable replacements
      out = out.replace(/\{headless\}/gi, 'Headless Architecture');
      out = out.replace(/\{zapier\}/gi, 'Zapier Replacement');
      out = out.replace(/\{convert\}/gi, 'convert');
      out = out.replace(/\{pipeline\}/gi, 'growth pipeline');
      out = out.replace(/\{saas\}/gi, 'Custom SaaS');
      out = out.replace(/\{ai\}/gi, 'Private AI');
      out = out.replace(/\{automation\}/gi, 'automation');
      out = out.replace(/\{cms\}/gi, 'CMS');
      out = out.replace(/\{seo\}/gi, 'SEO');
      out = out.replace(/\{dashboard\}/gi, 'dashboard');
      out = out.replace(/\{ecommerce\}/gi, 'e-commerce');
      out = out.replace(/\{results\}/gi, () => pick(spintax.results_quantified || ['Proven results for scaling agencies.']));
      // Existing branded replacements
      out = out.replace(/\{unicorn\}/gi, 'Unicorn Developer');
      out = out.replace(/\{expert\}/gi, 'full-stack architect');
      out = out.replace(/\{revenue\}/gi, 'revenue-generating');
      out = out.replace(/\{grow\}/gi, 'scale');
      out = out.replace(/\{fast\}/gi, 'in under 14 days');
      // Spintax dictionary categories
      for (const [cat, variants] of Object.entries(spintax)) {
        const regex = new RegExp(`\\{${cat}\\}`, 'gi');
        out = out.replace(regex, () => pick(variants));
      }
      // Handle {Option1|Option2|Option3} inline spintax
      out = out.replace(/\{([^{}]+\|[^{}]+)\}/g, (_, choices) => pick(choices.split('|')));
      return out;
    }

    function pickFragment(type) {
      const pool = fragments[type];
      return pool ? resolve(pick(pool)) : '';
    }

    // Assemble blocks
    const blocks = [];

    // Hero
    const heroText = pickFragment('hero_section') || `${row.service_type} ${row.sub_niche} in ${row.city}, ${row.state}`;
    blocks.push({
      block_type: 'hero',
      data: {
        badge: `${row.service_type.toUpperCase()} IN ${row.city.toUpperCase()}, ${row.state}`,
        headline: heroText.replace(/^##\s*/, ''),
        subhead: resolve(pickFragment('intro_hook') || `Expert ${row.service_type} ${row.sub_niche} solutions for ${row.city} businesses.`),
        cta_label: '< GET_STARTED />',
        cta_href: '#audit',
        warning_text: `// ${row.city.toUpperCase()}, ${row.state} — ${row.service_type.toUpperCase()} SPECIALIST`,
      },
    });

    // Problem section
    const problemText = pickFragment('problem_agitation');
    if (problemText) {
      blocks.push({
        block_type: 'terminal_problem',
        data: {
          eyebrow: `// THE_PROBLEM_IN_${row.city.toUpperCase().replace(/\s/g, '_')}`,
          title: problemText.replace(/^##\s*/, ''),
          body: resolve(`Agencies in ${row.city} face the same scaling bottleneck. ${pick(spintax.pain_agitation || spintax.b2b_pain_points || ['Your current stack is holding you back.'])}`),
          bullets: (spintax.b2b_pain_points || []).slice(0, 3).map((b) => `⚠ ${b}`),
          terminal_logs: [
            { time: '09:01', msg: `[${row.city.toUpperCase()}] ${pick(spintax.b2b_pain_points || ['System bottleneck detected'])}` },
            { time: '09:05', msg: `[AUDIT] ${row.service_type} gap identified in current stack` },
          ],
          status_text: '_ REQUIRES_ARCHITECT',
        },
      });
    }

    // Solution cards
    blocks.push({
      block_type: 'solution_cards',
      data: {
        eyebrow: '// THE_SOLUTION',
        title: `${row.service_type} ${row.sub_niche} for ${row.city}`,
        cards: [
          { title: `< ${row.service_type.toUpperCase().replace(/\s/g, '_')} />`, body: resolve(pick(spintax.tech_value_props || ['Custom-built for your exact needs.'])), border_color: 'neon-blue' },
          { title: '< SOVEREIGN_INFRA />', body: resolve('Self-hosted on your own VPS. Zero vendor lock-in. Infinite scale. ' + pick(spintax.tech_value_props || [''])), border_color: 'neon-green' },
          { title: '< GROWTH_ENGINE />', body: resolve(pick(spintax.results_quantified || ['Proven results for scaling agencies.'])), border_color: 'neon-pink' },
        ],
      },
    });

    // Geo bridge
    const geoBridge = pickFragment('geo_bridge');
    if (geoBridge || geoData.tech_scene_description) {
      blocks.push({
        block_type: 'value_prop',
        data: {
          title: `Why ${row.city}, ${row.state}`,
          body: `<p>${resolve(geoBridge || geoData.tech_scene_description)}</p>${geoData.landmark ? `<p class="mt-3">Located near <strong>${geoData.landmark}</strong>, we understand the ${row.city} market and build systems that scale with the local economy.</p>` : ''}${geoData.notable_companies ? `<p class="mt-3"><strong>Serving:</strong> ${geoData.notable_companies}</p>` : ''}`,
        },
      });
    }

    // Methodology
    const methodText = pickFragment('methodology');
    if (methodText) {
      blocks.push({
        block_type: 'icon_bullets',
        data: {
          title: 'The Process',
          bullets: [
            { icon: '🔍', title: 'Discovery', text: `We audit your ${row.city} operations and map every integration point.` },
            { icon: '📐', title: 'Architecture', text: resolve('Schema, API contracts, and infrastructure locked in 48 hours.') },
            { icon: '🚀', title: 'Deploy', text: resolve(`Production-grade ${row.service_type} live in 14 days. ${pick(spintax.results_quantified || [''])}`) },
          ],
        },
      });
    }

    // Related articles
    if (relatedArticles.length > 0) {
      const articleLinks = relatedArticles.map((a) => `<li style="margin-bottom:.75rem"><a href="/blog/${a.slug}" style="color:#00FF94;text-decoration:underline;font-weight:700">${a.title}</a>${a.excerpt ? `<br><span style="color:rgba(255,255,255,.5);font-size:.875rem">${a.excerpt}</span>` : ''}</li>`).join('');
      blocks.push({
        block_type: 'value_prop',
        data: { title: 'Deep Dives', body: `<ul style="list-style:none;padding:0">${articleLinks}</ul>` },
      });
    }

    // Social proof
    blocks.push({
      block_type: 'authority',
      data: {
        title: resolve(pick(spintax.social_proof || ['Trusted by scaling agencies.'])),
        body: `<p>${resolve(pick(spintax.case_study_tease || ['']))}</p>`,
        stats: [
          { value: '14 days', label: 'Average Delivery' },
          { value: '50+', label: 'Systems Built' },
          { value: '$10M+', label: 'Revenue Supported' },
        ],
      },
    });

    // Audit form
    const offerData = pick(offers.technical_strategy_session || offers.audit || [{ headline: 'Technical Strategy Session', button_text: 'INITIATE_HANDSHAKE_PROTOCOL' }]);
    blocks.push({
      block_type: 'audit_form',
      data: {
        title: resolve(offerData.headline || 'Technical Strategy Session'),
        subhead: `${row.service_type} ${row.sub_niche} consultation for ${row.city} businesses.`,
        form_title: offerData.button_text || 'INITIATE_HANDSHAKE_PROTOCOL',
        submit_source: `pSEO_${row.city}_${row.service_type}`.replace(/\s/g, '_'),
      },
    });

    // Interlinking: Other Services in this City
    const otherServicesQ = await p.query(
      `SELECT cm.slug, cm.title, ps.service_type, ps.sub_niche
       FROM content_matrix cm
       JOIN pseo_services ps ON ps.id = cm.service_id
       JOIN locations l ON l.id = cm.location_id
       WHERE l.city = $1 AND l.state = $2 AND cm.slug != $3
       ORDER BY RANDOM() LIMIT 6`,
      [row.city, row.state, slug]
    );
    if (otherServicesQ.rows.length > 0) {
      const linkGrid = otherServicesQ.rows.map(s =>
        `<a href="/${s.slug}" style="display:block;padding:.75rem 1rem;border:1px solid rgba(255,255,255,.08);border-radius:.375rem;text-decoration:none;color:#fff;font-size:.9rem;font-weight:600;transition:border-color .2s,background .2s" onmouseover="this.style.borderColor='rgba(0,255,148,.3)';this.style.background='rgba(0,255,148,.03)'" onmouseout="this.style.borderColor='rgba(255,255,255,.08)';this.style.background='transparent'">${s.service_type} ${s.sub_niche}</a>`
      ).join('');
      blocks.push({
        block_type: 'value_prop',
        data: {
          title: `Other Services in ${row.city}`,
          body: `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.5rem">${linkGrid}</div>`,
        },
      });
    }

    // Interlinking: Same Service in Nearby Cities
    const nearbyCitiesQ = await p.query(
      `SELECT cm.slug, cm.title, l.city, l.state
       FROM content_matrix cm
       JOIN locations l ON l.id = cm.location_id
       JOIN pseo_services ps ON ps.id = cm.service_id
       WHERE ps.service_type = $1 AND ps.sub_niche = $2 AND (l.city != $3 OR l.state != $4)
       ORDER BY RANDOM() LIMIT 6`,
      [row.service_type, row.sub_niche, row.city, row.state]
    );
    if (nearbyCitiesQ.rows.length > 0) {
      const cityGrid = nearbyCitiesQ.rows.map(c =>
        `<a href="/${c.slug}" style="display:block;padding:.75rem 1rem;border:1px solid rgba(255,255,255,.08);border-radius:.375rem;text-decoration:none;color:#fff;font-size:.9rem;font-weight:600;transition:border-color .2s,background .2s" onmouseover="this.style.borderColor='rgba(0,255,148,.3)';this.style.background='rgba(0,255,148,.03)'" onmouseout="this.style.borderColor='rgba(255,255,255,.08)';this.style.background='transparent'">${c.city}, ${c.state}</a>`
      ).join('');
      blocks.push({
        block_type: 'value_prop',
        data: {
          title: `${row.service_type} ${row.sub_niche} in Nearby Cities`,
          body: `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.5rem">${cityGrid}</div>`,
        },
      });
    }

    // CTA
    blocks.push({
      block_type: 'cta',
      data: {
        heading: resolve(pick(spintax.cta_strong || ['Book your strategy session.'])),
        text: resolve(pick(spintax.final_close || ['The next move is yours.'])),
        label: 'Book a Strategy Call',
        href: '/contact',
      },
    });

    // Save to caw_content permanently
    await p.query(
      `INSERT INTO caw_content (slug, title, blocks, palette, nav, footer, source, created_at)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb, 'pseo', NOW())
       ON CONFLICT (slug) DO NOTHING`,
      [slug, row.title, JSON.stringify(blocks), palette, JSON.stringify(nav), JSON.stringify(footer)]
    );

    return {
      page: { id: slug, title: row.title, slug },
      blocks: blocks.map((b) => ({ block_type: b.block_type, data: b.data || {} })),
      palette,
      nav,
      footer,
      meta_description: row.meta_description,
    };
  } catch (err) {
    console.error('[db] getPseoPage:', err.message);
    return null;
  }
}

export async function autoGeneratePage(slug) {
  const p = getPool();
  if (!p) return null;

  // Block bot/scanner paths
  const blocked = /wp-|\.php|\.env|\.xml|\.json|\.asp|\.cgi|admin|login|xmlrpc|feed\/|cgi-bin|\.well-known|favicon|robots\.txt|sitemap/i;
  if (blocked.test(slug)) return null;

  const keywords = slug.replace(/[^a-z0-9]/gi, ' ').split(/\s+/).filter((w) => w.length > 2);
  if (keywords.length === 0) return null;

  try {
    // Build a readable title from the slug
    const titleWords = slug.split(/[-_\/]/).filter((w) => w.length > 0).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    const title = titleWords.join(' ') + ' | CAW';

    // Find the best matching existing page to use as a template for nav/footer
    const template = await p.query('SELECT nav, footer, palette FROM caw_content LIMIT 1');
    const nav = template.rows[0]?.nav || {};
    const footer = template.rows[0]?.footer || {};
    const palette = template.rows[0]?.palette || 'emerald';

    // Search all pages for blocks whose data matches our keywords
    const allPages = await p.query('SELECT slug, blocks FROM caw_content');
    const scoredBlocks = [];

    for (const page of allPages.rows) {
      for (const block of (page.blocks || [])) {
        const blockText = JSON.stringify(block.data || {}).toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (blockText.includes(kw.toLowerCase())) score++;
        }
        if (score > 0) {
          scoredBlocks.push({ ...block, score, source: page.slug });
        }
      }
    }

    scoredBlocks.sort((a, b) => b.score - a.score);

    // Pick the best blocks by type — one of each, prioritizing high scores
    const picked = {};
    const blockOrder = ['hero', 'terminal_problem', 'solution_cards', 'icon_bullets', 'value_prop', 'authority', 'audit_form', 'cta'];
    for (const b of scoredBlocks) {
      if (!picked[b.block_type] && blockOrder.includes(b.block_type)) {
        picked[b.block_type] = { block_type: b.block_type, data: b.data };
      }
    }

    // Build a custom hero if we didn't find a matching one
    if (!picked.hero) {
      picked.hero = {
        block_type: 'hero',
        data: {
          badge: titleWords.slice(0, 3).join(' ').toUpperCase(),
          headline: titleWords.join(' '),
          subhead: 'Custom architecture and sovereign infrastructure for scaling agencies.',
          cta_label: '< GET_STARTED />',
          cta_href: '#audit',
        },
      };
    } else {
      // Override the hero headline to match the URL topic
      picked.hero = {
        block_type: 'hero',
        data: {
          ...picked.hero.data,
          badge: titleWords.slice(0, 3).join(' ').toUpperCase(),
          headline: titleWords.join(' '),
        },
      };
    }

    // Always include a CTA
    if (!picked.cta) {
      picked.cta = {
        block_type: 'cta',
        data: { heading: 'Ready to Build?', text: "Let's discuss your project.", label: 'Book a Strategy Call', href: '/contact' },
      };
    }

    // Always include audit form
    if (!picked.audit_form) {
      picked.audit_form = {
        block_type: 'audit_form',
        data: { title: 'Technical Strategy Session', subhead: "Let's audit your stack and find the bottleneck.", form_title: 'INITIATE_HANDSHAKE_PROTOCOL', submit_source: 'CAW_SITE_AutoGen' },
      };
    }

    // Assemble in correct order
    const blocks = blockOrder.filter((t) => picked[t]).map((t) => picked[t]);

    // Find related articles to embed as a value_prop block
    const articleKeywords = keywords.slice(0, 3).map((k) => `%${k}%`);
    let relatedArticles = [];
    if (articleKeywords.length > 0) {
      const artQ = await p.query(
        `SELECT slug, title, excerpt FROM caw_articles
         WHERE status = 'published' AND (${articleKeywords.map((_, i) => `(title ILIKE $${i + 1} OR slug ILIKE $${i + 1})`).join(' OR ')})
         ORDER BY published_at DESC LIMIT 5`,
        articleKeywords
      );
      relatedArticles = artQ.rows;
    }

    // Add related articles as a value_prop block if we found some
    if (relatedArticles.length > 0) {
      const articleLinks = relatedArticles.map((a) => `<li style="margin-bottom:.75rem"><a href="/blog/${a.slug}" style="color:#00FF94;text-decoration:underline;font-weight:700">${a.title}</a>${a.excerpt ? `<br><span style="color:rgba(255,255,255,.5);font-size:.875rem">${a.excerpt}</span>` : ''}</li>`).join('');
      const relBlock = {
        block_type: 'value_prop',
        data: {
          title: 'Related Articles',
          body: `<ul style="list-style:none;padding:0">${articleLinks}</ul>`,
        },
      };
      // Insert before the last CTA
      const ctaIdx = blocks.findIndex((b) => b.block_type === 'cta');
      if (ctaIdx >= 0) blocks.splice(ctaIdx, 0, relBlock);
      else blocks.push(relBlock);
    }

    // Save to database permanently with source tracking
    await p.query(
      `INSERT INTO caw_content (slug, title, blocks, palette, nav, footer, source, created_at)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb, 'auto', NOW())
       ON CONFLICT (slug) DO NOTHING`,
      [slug, title, JSON.stringify(blocks), palette, JSON.stringify(nav), JSON.stringify(footer)]
    );

    return {
      page: { id: slug, title, slug },
      blocks: blocks.map((b) => ({ block_type: b.block_type, data: b.data || {} })),
      palette,
      nav,
      footer,
    };
  } catch (err) {
    console.error('[db] autoGeneratePage:', err.message);
    return null;
  }
}

export async function getArticlesForService(serviceSlug) {
  const p = getPool();
  if (!p) return [];
  const categoryMap = {
    'python-api': 'fastapi',
    'frontend': 'frontend',
    'database': 'postgresql',
    'full-stack': 'infrastructure',
    'google-apis': 'tracking',
    'wordpress': 'frontend',
    'calculators': 'growth',
    '3d-visual': 'frontend',
  };
  const cat = categoryMap[serviceSlug] || null;
  if (!cat) return [];
  try {
    const r = await p.query(
      `SELECT slug, title, excerpt, category, published_at
       FROM caw_articles WHERE status = 'published' AND category = $1
       ORDER BY published_at DESC LIMIT 3`,
      [cat]
    );
    return r.rows;
  } catch (err) {
    console.error('[db] getArticlesForService:', err.message);
    return [];
  }
}
