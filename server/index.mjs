#!/usr/bin/env node
/**
 * caw_site SSR server — Fastify + EJS + pg.
 * No build. Templates and DB rendered at request time. 0 rebuild latency.
 */
import Fastify from 'fastify';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import ejs from 'ejs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getPageData, getPool, getArticles, getArticle, searchContent, getRelatedArticles, getArticleNav, getCategoryCounts, getRecentArticles, getArticlesForService, findBestRedirect, getPseoPage, autoGeneratePage, getAllLocations, getAllServices, getServicePages, getLocationPages } from './db.js';
import { renderBlocks } from './blocks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const fastify = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT || '4321', 10);
const HOST = process.env.HOST || '0.0.0.0';
const SITE_URL = process.env.SITE_URL || 'https://caw_site';

await fastify.register(fastifyView, {
  engine: { ejs },
  root: join(ROOT, 'views'),
  defaultContext: { siteUrl: SITE_URL },
  viewExt: 'ejs',
});

await fastify.register(fastifyStatic, {
  root: join(ROOT, 'public'),
  prefix: '/',
});

// API: submit lead
fastify.post('/api/submit-lead', async (req, reply) => {
  const p = getPool();
  if (!p) {
    return reply.status(503).send({ success: false, error: 'Database unavailable' });
  }
  let data = {};
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/json')) {
    data = req.body || {};
  } else if (ct.includes('application/x-www-form-urlencoded')) {
    data = req.body || {};
  }
  const source = data.source || 'CAW_SITE';
  const formType = data.form_type || data.formType || 'unknown';
  try {
    const r = await p.query(
      `INSERT INTO leads (source, name, email, phone, website, revenue, budget, problem, form_type, data_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        source,
        data.name ?? '',
        data.email ?? '',
        data.phone ?? null,
        data.website ?? null,
        data.revenue ?? null,
        data.budget ?? null,
        data.problem ?? data.bottleneck ?? null,
        formType,
        JSON.stringify(data || {}),
      ]
    );
    return { success: true, lead_id: r.rows[0]?.id };
  } catch (err) {
    console.error('submit-lead:', err.message);
    return reply.status(500).send({ success: false, error: 'Failed to save lead' });
  }
});

// API: health — confirms DB control and whether caw_content is loaded
fastify.get('/api/health', async () => {
  const hasUrl = !!process.env.DATABASE_URL;
  const p = getPool();
  if (!p) return { ok: false, error: 'DATABASE_URL not set', db_controlled: true };
  try {
    const r = await p.query('SELECT COUNT(*)::int as n FROM caw_content');
    const n = r.rows[0]?.n ?? 0;
    return { ok: true, db_controlled: true, caw_content_rows: n, content_loaded: n > 0 };
  } catch (e) {
    return { ok: false, error: e.message, db_controlled: true };
  }
});

fastify.get('/health', async (req, reply) => {
  const p = getPool();
  if (!p) return reply.status(503).send({ ok: false, error: 'DATABASE_URL not set' });
  try {
    const r = await p.query('SELECT COUNT(*)::int as n FROM caw_content');
    return { ok: true, caw_content_rows: r.rows[0]?.n ?? 0 };
  } catch (e) {
    return reply.status(503).send({ ok: false, error: e.message });
  }
});

// Page handler — DB-driven, no build, with service cross-links
async function handlePage(req, reply, slug) {
  const pageData = await getPageData(slug);
  if (!pageData) {
    reply.code(404);
    return reply.viewAsync('404.ejs', { siteName: 'CAW', currentPath: req.url.split('?')[0] || '/' });
  }

  const { page, blocks, palette, nav, footer } = pageData;
  const siteName = footer?.copyright || 'CAW';
  let blocksHtml = renderBlocks(blocks);

  // Inject related articles for service pages
  const serviceMatch = slug.match(/^services\/custom-apps\/(.+)$/);
  if (serviceMatch) {
    const serviceArticles = await getArticlesForService(serviceMatch[1]);
    if (serviceArticles.length > 0) {
      const cardsHtml = serviceArticles.map((a) => {
        const date = a.published_at ? new Date(a.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
        return `<a href="/blog/${a.slug}" style="display:block;padding:1.25rem;border:1px solid rgba(255,255,255,.1);border-radius:.5rem;background:rgba(255,255,255,.02);transition:border-color .2s" onmouseover="this.style.borderColor='rgba(0,255,148,.4)'" onmouseout="this.style.borderColor='rgba(255,255,255,.1)'"><span style="font-size:.7rem;color:rgba(255,255,255,.4);font-family:ui-monospace,monospace">${date}</span><h4 style="font-size:1rem;font-weight:700;color:#fff;margin:.25rem 0">${a.title}</h4>${a.excerpt ? `<p style="font-size:.8rem;color:rgba(255,255,255,.5);margin:0">${a.excerpt}</p>` : ''}</a>`;
      }).join('');
      blocksHtml += `<section style="background:#050505;padding:4rem 0"><div style="max-width:1400px;margin:0 auto;padding:0 1.5rem"><h2 style="font-family:ui-monospace,monospace;font-size:1rem;color:#00FF94;margin-bottom:1.5rem">// RELATED_FROM_BLOG</h2><div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${cardsHtml}</div><a href="/blog" style="display:inline-block;margin-top:1.5rem;color:rgba(255,255,255,.5);font-size:.85rem;font-family:ui-monospace,monospace">View all posts &rarr;</a></div></section>`;
    }
  }

  return reply.viewAsync('page.ejs', {
    title: page.title || 'CAW',
    description: 'Stop hiring freelancers. Start building an empire.',
    siteName,
    nav: nav || {},
    footer: footer || {},
    palette: palette || 'emerald',
    blocksHtml,
    currentPath: req.url.split('?')[0] || '/',
  });
}

// Blog listing — shows articles from caw_articles + the blog landing page blocks
fastify.get('/blog', async (req, reply) => {
  const category = req.query.category || null;
  const [articles, categoryCounts, pageData] = await Promise.all([
    getArticles({ category, limit: 50 }),
    getCategoryCounts(),
    getPageData('blog'),
  ]);
  const nav = pageData?.nav || {};
  const footer = pageData?.footer || {};
  const palette = pageData?.palette || 'emerald';
  const blocksHtml = pageData ? renderBlocks(pageData.blocks) : '';
  return reply.viewAsync('blog.ejs', {
    title: category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Articles | CAW` : (pageData?.page?.title || 'Blog | CAW'),
    description: 'Architecture, AI Systems, and Growth Engineering.',
    siteName: footer?.copyright || 'CAW',
    nav, footer, palette, blocksHtml, articles, categoryCounts,
    currentPath: '/blog',
    activeCategory: category,
  });
});

// Single article — rendered from caw_articles with related + nav
fastify.get('/blog/:slug', async (req, reply) => {
  const article = await getArticle(req.params.slug);
  if (!article) {
    reply.code(404);
    return reply.viewAsync('404.ejs', { siteName: 'CAW', currentPath: req.url.split('?')[0] });
  }
  const [related, articleNav, pageData] = await Promise.all([
    getRelatedArticles(article.slug, article.category, 3),
    getArticleNav(article.slug),
    getPageData('blog'),
  ]);
  const nav = pageData?.nav || {};
  const footer = pageData?.footer || {};
  const palette = pageData?.palette || 'emerald';
  const wordCount = (article.content || '').replace(/<[^>]*>/g, '').split(/\s+/).length;
  const readingTime = Math.max(1, Math.round(wordCount / 230));
  return reply.viewAsync('article.ejs', {
    title: `${article.title} | CAW`,
    description: article.excerpt || '',
    siteName: footer?.copyright || 'CAW',
    nav, footer, palette, article, related, articleNav, readingTime,
    currentPath: `/blog/${article.slug}`,
  });
});

// Search page with results
fastify.get('/search', async (req, reply) => {
  const q = req.query.q || '';
  const [results, pageData] = await Promise.all([
    q ? searchContent(q) : Promise.resolve({ articles: [], pages: [] }),
    getPageData('search'),
  ]);
  const nav = pageData?.nav || {};
  const footer = pageData?.footer || {};
  const palette = pageData?.palette || 'emerald';
  return reply.viewAsync('search.ejs', {
    title: q ? `Search: ${q} | CAW` : 'Search | CAW',
    description: 'Search across all content.',
    siteName: footer?.copyright || 'CAW',
    nav, footer, palette, query: q, results,
    currentPath: '/search',
  });
});

// RSS feed
fastify.get('/blog/rss.xml', async (req, reply) => {
  const articles = await getArticles({ limit: 30 });
  const items = articles.map((a) => {
    const date = a.published_at ? new Date(a.published_at).toUTCString() : '';
    return `<item><title><![CDATA[${a.title}]]></title><link>${SITE_URL}/blog/${a.slug}</link><description><![CDATA[${a.excerpt || ''}]]></description><pubDate>${date}</pubDate><category>${a.category || ''}</category><guid>${SITE_URL}/blog/${a.slug}</guid></item>`;
  }).join('\n');
  reply.header('Content-Type', 'application/rss+xml; charset=utf-8');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n<title>CAW — Blog</title>\n<link>${SITE_URL}/blog</link>\n<description>Architecture, AI Systems, and Growth Engineering.</description>\n<atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>\n${items}\n</channel>\n</rss>`;
});

// ── pSEO Directory Routes ──────────────────────────────────

// Main directory: /locations
fastify.get('/locations', async (req, reply) => {
  const [locations, pageData] = await Promise.all([getAllLocations(), getPageData('')]);
  const nav = pageData?.nav || {}; const footer = pageData?.footer || {};
  const byState = {};
  for (const l of locations) { if (!byState[l.state]) byState[l.state] = []; byState[l.state].push(l); }
  const stateCards = Object.entries(byState).sort().map(([state, cities]) => {
    const links = cities.map(c => `<a href="/locations/${c.slug}" style="display:block;padding:.4rem 0;color:rgba(255,255,255,.7);font-size:.9rem;text-decoration:none;transition:color .2s" onmouseover="this.style.color='#00FF94'" onmouseout="this.style.color='rgba(255,255,255,.7)'">${c.city}</a>`).join('');
    return `<div style="padding:1.25rem;border:1px solid rgba(255,255,255,.08);border-radius:.5rem"><h3 style="font-family:ui-monospace,monospace;font-size:.85rem;color:#00B8FF;text-transform:uppercase;margin-bottom:.75rem">${state}</h3>${links}</div>`;
  }).join('');
  const body = `<section style="background:#050505;padding:6rem 0 2rem"><div style="max-width:1400px;margin:0 auto;padding:0 1.5rem;text-align:center"><span style="display:inline-block;font-family:ui-monospace,monospace;font-size:.85rem;color:#00FF94;border:1px solid rgba(0,255,148,.3);padding:.4rem 1rem;margin-bottom:1.5rem;text-transform:uppercase">LOCATIONS</span><h1 style="font-size:2.5rem;font-weight:900;color:#fff;margin-bottom:.5rem;letter-spacing:-2px">Service Areas</h1><p style="color:rgba(255,255,255,.5);font-family:ui-monospace,monospace;margin-bottom:2rem">${locations.length} cities across the US</p></div></section><section style="background:#050505;padding:2rem 0 4rem"><div style="max-width:1400px;margin:0 auto;padding:0 1.5rem"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">${stateCards}</div></div></section>`;
  return reply.viewAsync('page.ejs', { title: 'Service Areas | CAW', description: 'Custom software architecture in 50+ US cities.', siteName: footer?.copyright || 'CAW', nav, footer, palette: 'emerald', blocksHtml: body, currentPath: '/locations' });
});

// Single location directory: /locations/austin-tx
fastify.get('/locations/:slug', async (req, reply) => {
  const { location, geo, pages } = await getLocationPages(req.params.slug);
  if (!location) { reply.code(404); return reply.viewAsync('404.ejs', { siteName: 'CAW', currentPath: req.url, suggestions: [], nav: {}, footer: {} }); }
  const pageData = await getPageData('');
  const nav = pageData?.nav || {}; const footer = pageData?.footer || {};
  const serviceCards = pages.map(p => `<a href="/${p.slug}" style="display:block;padding:1rem;border:1px solid rgba(255,255,255,.08);border-radius:.5rem;text-decoration:none;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(0,255,148,.3)'" onmouseout="this.style.borderColor='rgba(255,255,255,.08)'"><h4 style="font-size:.95rem;font-weight:700;color:#fff;margin-bottom:.2rem">${p.service_type} ${p.sub_niche}</h4>${p.description ? `<p style="font-size:.8rem;color:rgba(255,255,255,.5);margin:.25rem 0 .4rem;line-height:1.4" class="description">${p.description}</p>` : ''}<span style="font-size:.75rem;color:rgba(255,255,255,.4);font-family:ui-monospace,monospace">/${p.slug}</span></a>`).join('');
  const geoInfo = geo.landmark ? `<p style="color:rgba(255,255,255,.5);font-size:.9rem;margin-bottom:.5rem">Near <strong style="color:#fff">${geo.landmark}</strong>${geo.county ? ` · ${geo.county} County` : ''}</p>` : '';
  const body = `<section style="background:#050505;padding:6rem 0 2rem"><div style="max-width:1400px;margin:0 auto;padding:0 1.5rem;text-align:center"><span style="display:inline-block;font-family:ui-monospace,monospace;font-size:.85rem;color:#00FF94;border:1px solid rgba(0,255,148,.3);padding:.4rem 1rem;margin-bottom:1.5rem;text-transform:uppercase">${location.state}</span><h1 style="font-size:2.5rem;font-weight:900;color:#fff;margin-bottom:.5rem;letter-spacing:-2px">Services in ${location.city}, ${location.state}</h1>${geoInfo}<p style="color:rgba(255,255,255,.4);font-family:ui-monospace,monospace;font-size:.85rem">${pages.length} services available</p><a href="/locations" style="display:inline-block;margin-top:1rem;font-size:.8rem;color:rgba(255,255,255,.4);font-family:ui-monospace,monospace;text-decoration:none">&larr; All Locations</a></div></section><section style="background:#050505;padding:2rem 0 4rem"><div style="max-width:1400px;margin:0 auto;padding:0 1.5rem"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:.75rem">${serviceCards}</div></div></section>`;
  return reply.viewAsync('page.ejs', { title: `Services in ${location.city}, ${location.state} | CAW`, description: `Custom software architecture in ${location.city}, ${location.state}.`, siteName: footer?.copyright || 'CAW', nav, footer, palette: 'emerald', blocksHtml: body, currentPath: `/locations/${req.params.slug}` });
});

// Main services directory: /solutions
fastify.get('/solutions', async (req, reply) => {
  const [services, pageData] = await Promise.all([getAllServices(), getPageData('')]);
  const nav = pageData?.nav || {}; const footer = pageData?.footer || {};
  const cards = services.map(s => `<a href="/solutions/${s.slug}" style="display:block;padding:1.25rem;border:1px solid rgba(255,255,255,.08);border-radius:.5rem;text-decoration:none;transition:border-color .2s,background .2s" onmouseover="this.style.borderColor='rgba(0,255,148,.3)';this.style.background='rgba(0,255,148,.02)'" onmouseout="this.style.borderColor='rgba(255,255,255,.08)';this.style.background='transparent'"><h3 style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:.25rem">${s.service_type}</h3><p style="font-size:.8rem;color:rgba(255,255,255,.5);margin:0">${s.sub_niche}</p></a>`).join('');
  const body = `<section style="background:#050505;padding:6rem 0 2rem"><div style="max-width:1400px;margin:0 auto;padding:0 1.5rem;text-align:center"><span style="display:inline-block;font-family:ui-monospace,monospace;font-size:.85rem;color:#00FF94;border:1px solid rgba(0,255,148,.3);padding:.4rem 1rem;margin-bottom:1.5rem;text-transform:uppercase">SOLUTIONS</span><h1 style="font-size:2.5rem;font-weight:900;color:#fff;margin-bottom:.5rem;letter-spacing:-2px">What I Build</h1><p style="color:rgba(255,255,255,.5);font-family:ui-monospace,monospace;margin-bottom:2rem">${services.length} service categories across 50 cities</p></div></section><section style="background:#050505;padding:2rem 0 4rem"><div style="max-width:1400px;margin:0 auto;padding:0 1.5rem"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem">${cards}</div></div></section>`;
  return reply.viewAsync('page.ejs', { title: 'Solutions | CAW', description: '36 custom software services across 50 US cities.', siteName: footer?.copyright || 'CAW', nav, footer, palette: 'emerald', blocksHtml: body, currentPath: '/solutions' });
});

// Single service directory: /solutions/custom-saas-development
fastify.get('/solutions/:slug', async (req, reply) => {
  const { service, pages } = await getServicePages(req.params.slug);
  if (!service) { reply.code(404); return reply.viewAsync('404.ejs', { siteName: 'CAW', currentPath: req.url, suggestions: [], nav: {}, footer: {} }); }
  const pageData = await getPageData('');
  const nav = pageData?.nav || {}; const footer = pageData?.footer || {};
  const byState = {};
  for (const p of pages) { if (!byState[p.state]) byState[p.state] = []; byState[p.state].push(p); }
  const stateGroups = Object.entries(byState).sort().map(([state, cities]) => {
    const links = cities.map(c => `<a href="/${c.slug}" style="display:block;padding:.5rem .75rem;color:rgba(255,255,255,.7);font-size:.9rem;text-decoration:none;border:1px solid rgba(255,255,255,.06);border-radius:.375rem;transition:all .2s" onmouseover="this.style.borderColor='rgba(0,255,148,.3)';this.style.color='#00FF94'" onmouseout="this.style.borderColor='rgba(255,255,255,.06)';this.style.color='rgba(255,255,255,.7)'">${c.city}, ${c.state}</a>`).join('');
    return `<div><h3 style="font-family:ui-monospace,monospace;font-size:.8rem;color:#00B8FF;text-transform:uppercase;margin-bottom:.5rem">${state}</h3><div style="display:grid;gap:.4rem">${links}</div></div>`;
  }).join('');
  const body = `<section style="background:#050505;padding:6rem 0 2rem"><div style="max-width:1400px;margin:0 auto;padding:0 1.5rem;text-align:center"><span style="display:inline-block;font-family:ui-monospace,monospace;font-size:.85rem;color:#00FF94;border:1px solid rgba(0,255,148,.3);padding:.4rem 1rem;margin-bottom:1.5rem;text-transform:uppercase">${service.service_type}</span><h1 style="font-size:2.5rem;font-weight:900;color:#fff;margin-bottom:.5rem;letter-spacing:-2px">${service.service_type} ${service.sub_niche}</h1><p style="color:rgba(255,255,255,.5);font-family:ui-monospace,monospace;margin-bottom:1rem">Available in ${pages.length} cities</p><a href="/solutions" style="display:inline-block;font-size:.8rem;color:rgba(255,255,255,.4);font-family:ui-monospace,monospace;text-decoration:none">&larr; All Solutions</a></div></section><section style="background:#050505;padding:2rem 0 4rem"><div style="max-width:1400px;margin:0 auto;padding:0 1.5rem"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1.5rem">${stateGroups}</div></div></section>`;
  return reply.viewAsync('page.ejs', { title: `${service.service_type} ${service.sub_niche} | CAW`, description: `${service.service_type} ${service.sub_niche} in 50+ US cities.`, siteName: footer?.copyright || 'CAW', nav, footer, palette: 'emerald', blocksHtml: body, currentPath: `/solutions/${req.params.slug}` });
});

// Homepage with recent articles
fastify.get('/', async (req, reply) => {
  const [pageData, recentArticles] = await Promise.all([
    getPageData(''),
    getRecentArticles(4),
  ]);
  if (!pageData) {
    reply.code(404);
    return reply.viewAsync('404.ejs', { siteName: 'CAW', currentPath: '/' });
  }
  const { page, blocks, palette, nav, footer } = pageData;
  const blocksHtml = renderBlocks(blocks);
  const siteName = footer?.copyright || 'CAW';
  return reply.viewAsync('homepage.ejs', {
    title: page.title || 'CAW',
    description: 'Stop hiring freelancers. Start building an empire.',
    siteName, nav: nav || {}, footer: footer || {}, palette: palette || 'emerald',
    blocksHtml, recentArticles, currentPath: '/',
  });
});

// Known legacy redirect map (old URL → new path)
const REDIRECT_MAP = {
  'services-how-we-help': '/services',
  'how-we-help': '/services',
  'what-we-do': '/services',
  'our-services': '/services',
  'portfolio': '/about',
  'work': '/about',
  'case-studies': '/blog',
  'articles': '/blog',
  'posts': '/blog',
  'insights': '/blog',
  'resources': '/resources/calculators',
  'tools': '/resources/calculators',
  'get-started': '/contact',
  'book': '/contact',
  'schedule': '/contact',
  'hire': '/contact',
  'consultation': '/audit',
  'free-audit': '/audit',
  'stack-audit': '/audit',
  'methodology': '/guide/how-i-build',
  'process': '/guide/how-i-build',
  'how-it-works': '/guide/how-i-build',
  'tos': '/terms',
  'terms-of-service': '/terms',
  'privacy-policy': '/privacy',
  'custom-apps': '/services',
  'custom-software': '/services',
};

fastify.setNotFoundHandler(async (req, reply) => {
  const pathname = (req.url || '/').replace(/\?.*$/, '').replace(/\/$/, '') || '/';

  if (pathname.startsWith('/api') || pathname.startsWith('/health')) {
    return reply.status(404).send({ error: 'Not found' });
  }

  const slug = pathname === '/' ? '' : pathname.replace(/^\/+/, '');

  if (slug.includes('.') && !pathname.endsWith('/')) {
    return reply.status(404).send('Not found');
  }

  // Try serving from caw_content first
  const pageData = await getPageData(slug);
  if (pageData) return handlePage(req, reply, slug);

  // 1. Check hardcoded redirect map
  const mapTarget = REDIRECT_MAP[slug] || REDIRECT_MAP[slug.split('/').pop()];
  if (mapTarget) {
    reply.code(301).redirect(mapTarget);
    return;
  }

  // 2. Trailing slash redirect: /services/ → /services
  if (req.url.endsWith('/') && slug) {
    const clean = '/' + slug;
    const check = await getPageData(slug);
    if (check) {
      reply.code(301).redirect(clean);
      return;
    }
  }

  // 3. Smart fuzzy redirect via DB
  const match = await findBestRedirect(slug);
  if (match) {
    const target = match.slug === '' ? '/' : '/' + match.slug;
    reply.code(301).redirect(target);
    return;
  }

  // 4. If URL looks like a blog article slug, try searching articles
  if (!slug.includes('/')) {
    const artCheck = await getArticle(slug);
    if (artCheck) {
      reply.code(301).redirect(`/blog/${slug}`);
      return;
    }
  }

  // 5. pSEO page from content_matrix (1,800 service×location combos)
  if (slug && !slug.includes('.')) {
    const pseo = await getPseoPage(slug);
    if (pseo) {
      const { page, blocks, palette, nav: pNav, footer: pFooter, meta_description } = pseo;
      const siteName = pFooter?.copyright || 'CAW';
      const blocksHtml = renderBlocks(blocks);
      return reply.viewAsync('page.ejs', {
        title: page.title || 'CAW',
        description: meta_description || 'Custom architecture and sovereign infrastructure.',
        siteName,
        nav: pNav || {},
        footer: pFooter || {},
        palette: palette || 'emerald',
        blocksHtml,
        currentPath: '/' + slug,
      });
    }
  }

  // 6. Auto-generate page from existing blocks — saves permanently
  if (slug && !slug.includes('.') && slug.length > 3 && slug.length < 120) {
    const generated = await autoGeneratePage(slug);
    if (generated) {
      const { page, blocks, palette, nav: gNav, footer: gFooter } = generated;
      const siteName = gFooter?.copyright || 'CAW';
      const blocksHtml = renderBlocks(blocks);
      return reply.viewAsync('page.ejs', {
        title: page.title || 'CAW',
        description: 'Custom architecture and sovereign infrastructure for scaling agencies.',
        siteName,
        nav: gNav || {},
        footer: gFooter || {},
        palette: palette || 'emerald',
        blocksHtml,
        currentPath: '/' + slug,
      });
    }
  }

  // 6. True 404 — only for truly unmatchable requests
  const [suggestions, anyPage] = await Promise.all([
    getRecentArticles(3),
    getPageData(''),
  ]);
  const navData = anyPage?.nav || {};
  const footerData = anyPage?.footer || {};
  reply.code(404);
  return reply.viewAsync('404.ejs', {
    siteName: 'CAW',
    currentPath: pathname,
    suggestions,
    nav: navData,
    footer: footerData,
  });
});

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`caw_site SSR on http://${HOST}:${PORT}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
