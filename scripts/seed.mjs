#!/usr/bin/env node
/**
 * CAW seed — caw_seed + caw_content (minimal schema, no factory).
 * Run: DATABASE_URL=... node scripts/seed.mjs
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_THEME = {
  palette: 'emerald',
  nav: {
    portfolio: [
      { name: 'The Problem', href: '/#hook' },
      { name: 'Architecture', href: '/#solution' },
      { name: 'Blog', href: '/blog' },
      { name: 'How I Build', href: '/guide/how-i-build' },
      { name: 'Knowledge Base', href: '/knowledge-base' },
      { name: 'Search', href: '/search' },
    ],
    custom_apps: [
      { name: 'Python & FastAPI', href: '/services/custom-apps/python-api' },
      { name: 'Astro & React', href: '/services/custom-apps/frontend' },
      { name: 'Full-Stack', href: '/services/custom-apps/full-stack' },
      { name: 'PostgreSQL', href: '/services/custom-apps/database' },
      { name: 'Google APIs', href: '/services/custom-apps/google-apis' },
      { name: 'WordPress', href: '/services/custom-apps/wordpress' },
      { name: 'Calculators', href: '/services/custom-apps/calculators' },
      { name: '3D & Visual', href: '/services/custom-apps/3d-visual' },
    ],
    growth_tools: [
      { name: 'Jumpstart Scaling', href: 'https://jumpstartscaling.com' },
      { name: 'Growth Retainer', href: 'https://jumpstartscaling.com/services/growth-retainer' },
      { name: 'CRM Build', href: 'https://jumpstartscaling.com/services/crm-transformation' },
    ],
    cta: { label: 'INITIATE_HANDSHAKE', href: '#audit' },
  },
  footer: { tagline: 'The Unicorn Developer.', copyright: 'CAW' },
};

const HOMEPAGE_BLOCKS = [
  ['hero', 0, { badge: 'STATUS: ACCEPTING 2 CLIENTS FOR Q1', headline: 'I ARCHITECT SYSTEMS<br class="hidden md:block" />THAT <span class="text-neon">SCALE AGENCIES</span>.', subhead: 'Stop gluing your business together with Zapier and hope.\nI build Sovereign Infrastructure that works while you sleep.', cta_label: '< DEPLOY_ARCHITECT />', cta_href: '#audit', warning_text: '// WARNING: Technical Strategy Session Only. No Sales Fluff.' }],
  ['terminal_problem', 1, { eyebrow: '// SYSTEM_CRITICAL_ERROR', title: 'The "Frankenstein" Stack Is Killing Your Margins.', body: 'You have revenue. You have product-market fit. But your backend is a tangled mess of SaaS subscriptions, broken webhooks, and manual data entry.', bullets: ['⚠ SALES TEAM IS BLIND (CRM not syncing)', '⚠ ZAPIER BILL IS SCALING FASTER THAN REVENUE', '⚠ YOU ARE THE BOTTLENECK (Playing CTO instead of CEO)'], terminal_logs: [{ time: '09:00:01', msg: '[ERROR] Webhook Timeout: Zapier webhook failed to respond.' }, { time: '09:05:23', msg: '[CRITICAL] Lead Loss: 5 leads failed to sync to GHL.' }, { time: '09:12:00', msg: '[WARN] API Rate Limit Exceeded (Airtable).' }], status_text: '_ SYSTEM_UNSTABLE' }],
  ['solution_cards', 2, { eyebrow: '// THE_FIX', title: 'Sovereign Infrastructure', cards: [{ title: '< INFRASTRUCTURE />', body: 'Self-hosted n8n automation engines that run on your own servers. Zero per-task fees. Infinite scalability.', border_color: 'neon-blue' }, { title: '< INTELLIGENCE />', body: 'Private LLM agents that draft emails, qualify leads, and analyze competitors without leaking data to OpenAI.', border_color: 'neon-green' }, { title: '< REVENUE_PHYSICS />', body: 'Server-side tracking (CAPI) and attribution dashboards that tell you exactly where your ROAS is coming from.', border_color: 'neon-pink' }] }],
  ['authority', 3, { title: 'I Am Not A Freelancer.<br>I Am An Architect.', body: 'Most developers write code to finish a ticket. I design systems to finish the business model. As the founder of <a href="https://jumpstartscaling.com" class="text-neon border-b border-[#00FF94]">Jumpstart Scaling</a>, I have seen the backend of 50+ scaling agencies.', stats: [{ value: '50+', label: 'Systems Built' }, { value: '$10M+', label: 'Revenue Supported' }] }],
  ['audit_form', 4, { title: 'Technical Strategy Session', subhead: "Let's audit your stack and find the bottleneck.", form_title: 'INITIATE_HANDSHAKE_PROTOCOL', submit_source: 'CAWSite' }],
  ['calculator', 5, { section_title: 'Engineering Resources' }],
  ['survey', 6, { section_title: "Let's Build It Right." }],
];

const CORE_PAGES = [
  ['about', 'About | CAW', [['hero', { badge: 'ABOUT', headline: 'About CAW', subhead: 'The Unicorn Developer.', cta_label: 'Get Started', cta_href: '#contact' }], ['cta', { heading: 'Ready to Start?', text: "Let's build together.", label: 'Book a Call', href: '#contact' }]]],
  ['contact', 'Contact | CAW', [['hero', { badge: 'GET IN TOUCH', headline: "Let's Build Together", subhead: 'Book a technical strategy session. No pitch.', cta_label: 'Book Consultation', cta_href: '#contact-form' }], ['cta', { heading: 'Ready to Start?', text: 'Fill out the form below or book a call.', label: 'Book a Call', href: '#contact-form' }]]],
  ['audit', 'Technical Audit | CAW', [['hero', { badge: 'FREE AUDIT', headline: 'Get Your AI Architecture Audit', subhead: '90 seconds. Custom roadmap. No pitch.', cta_label: 'Start Audit', cta_href: '#contact' }], ['cta', { heading: 'Claim Your Free Audit', text: 'See how we can replace Zapier and scale your stack.', label: 'Get Audit', href: '#contact' }]]],
  ['terms', 'Terms of Service | CAW', [['value_prop', { title: 'Terms of Service', body: 'Terms of service content. Update via admin.' }]]],
  ['privacy', 'Privacy Policy | CAW', [['value_prop', { title: 'Privacy Policy', body: 'Privacy policy content. Update via admin.' }]]],
  ['services', 'Services | CAW', [['hero', { badge: 'SERVICES', headline: 'What I Build', subhead: 'Custom SaaS, Private AI, Headless CMS, and more.', cta_label: 'Get Started', cta_href: '#contact' }], ['cta', { heading: 'Ready to Build?', text: "Let's discuss your project.", label: 'Book a Call', href: '#contact' }]]],
  ['resources/calculators', 'Calculators | CAW', [['hero', { badge: 'TOOLS', headline: 'Growth Calculators', subhead: 'ROAS, CAC, LTV, and more.', cta_label: 'Start Calculating', cta_href: '#calculators' }], ['calculator', { section_title: 'Engineering Resources' }]]],
  ['guide/how-i-build', 'How I Build | CAW', [['hero', { badge: 'METHODOLOGY', headline: 'How I Build', subhead: 'From discovery to deployment.', cta_label: 'Get Started', cta_href: '#contact' }], ['value_prop', { title: 'The Unicorn Process', body: 'Discovery → Design → Deploy. I build production-grade systems in under 14 days.' }], ['cta', { heading: 'Ready to Build?', text: "Let's discuss your project.", label: 'Book a Call', href: '#contact' }]]],
  ['blog', 'Blog & Knowledge Base | CAW — Architecture, AI & Growth Systems', [['hero', { badge: 'BLOG & KNOWLEDGE BASE', headline: 'Architecture.<br class="hidden md:block"/>AI Systems.<br class="hidden md:block"/><span class="text-neon">Growth Engineering.</span>', subhead: 'Deep technical content on building sovereign infrastructure, private AI agents, PostgreSQL at scale, and full-stack systems design.', cta_label: '< EXPLORE_KNOWLEDGE />', cta_href: '#topics' }], ['solution_cards', { eyebrow: '// CONTENT_PILLARS', title: 'What I Write About', cards: [{ title: '< INFRASTRUCTURE />', body: 'Self-hosted alternatives to SaaS, Coolify deployment guides, n8n automation patterns, PostgreSQL schema design, and Docker production setups.', border_color: 'neon-blue' }, { title: '< AI_SYSTEMS />', body: 'Private LLM deployment, RAG pipelines with pgvector, LangChain vs bare API patterns, and AI agents that run on your own hardware.', border_color: 'neon-green' }, { title: '< GROWTH_ENGINEERING />', body: 'Server-side conversion tracking, CAPI setup, attribution modeling, CAC/LTV calculators, and funnel analytics that survive iOS14.', border_color: 'neon-pink' }] }], ['icon_bullets', { title: 'Topic Index', bullets: [{ icon: '🏗️', title: 'Sovereign Infrastructure', text: 'Why self-hosted beats SaaS past $1M revenue. Coolify, n8n, Supabase, and the stack for infrastructure independence.' }, { icon: '🤖', title: 'Private AI Agents', text: 'Running Llama, Mistral, and custom fine-tunes on your own VPS. No OpenAI data risk. Full control.' }, { icon: '🐘', title: 'PostgreSQL Deep Dives', text: 'JSONB vs relational, pgvector for semantic search, Row-Level Security for multi-tenancy, and asyncpg patterns.' }, { icon: '📡', title: 'Server-Side Tracking', text: 'Facebook CAPI, Google Enhanced Conversions, and TikTok Events API. Attribution without cookies or pixels.' }, { icon: '⚡', title: 'FastAPI Patterns', text: 'Async architecture, dependency injection, Pydantic v2, background tasks, and deployment on Coolify.' }, { icon: '🌐', title: 'Astro & Frontend', text: 'SSR with Astro, React islands, Tailwind design systems, and building Lighthouse 100 marketing sites.' }, { icon: '🧮', title: 'Calculator Architecture', text: 'ROAS, CAC, LTV, cohort analysis. How I build interactive financial tools that capture leads and educate buyers.' }, { icon: '🔐', title: 'Security & DevOps', text: 'SSH hardening, Docker secrets, PostgreSQL RLS, and zero-trust architecture for agencies handling client data.' }] }], ['value_prop', { title: 'Featured: The Sovereign Stack Guide', body: '<p>The most common question I get after a strategy call: <em>"What would you actually build for us?"</em> The answer is almost always the same stack, adapted to the problem.</p><h3 class="text-white font-bold mt-6 mb-2">The Core Stack</h3><p><strong class="text-white">Backend:</strong> Python 3.12 + FastAPI + asyncpg + PostgreSQL 16. This handles everything from lead capture to AI agent orchestration to billing webhooks. One language, one database, full async.</p><p class="mt-3"><strong class="text-white">Automation:</strong> Self-hosted n8n on a $10/mo VPS (or shared with the main server). Replaces Zapier entirely. Handles CRM syncs, email sequences, Slack notifications, and webhook relay without per-task fees.</p><p class="mt-3"><strong class="text-white">Frontend:</strong> Astro SSR for marketing pages, React for dashboards and interactive tools. Tailwind for design system. Zero client-side JavaScript unless needed.</p><p class="mt-3"><strong class="text-white">Infra:</strong> Coolify on a Hetzner or Digital Ocean VPS. Git-push deploys. Auto SSL. Docker Compose per service. Total cost: $50\u2013$200/mo depending on scale, vs. $3,000\u2013$5,000/mo in SaaS subscriptions.</p><p class="mt-3"><strong class="text-white">AI:</strong> Ollama + pgvector for private LLM operations. OpenAI API only for non-sensitive tasks. Fine-tuned Llama for client-specific workflows.</p>' }], ['authority', { title: 'Built From Real Projects, Not Tutorials', body: '<p>Every post on this blog comes from a system I have actually deployed in production. No tutorial repos. No "example" codebases. If I write about a PostgreSQL optimization, it is because I ran EXPLAIN ANALYZE on a 50M-row table and found the winning index.</p><p class="mt-4">I have built systems for media agencies, solar installation companies, law firms, e-commerce brands, and SaaS startups. The patterns repeat. The mistakes repeat. The solutions I write about are the ones that closed the gap between "it works in dev" and "it works at scale."</p>', stats: [{ value: '50+', label: 'Systems Referenced' }, { value: '8yr', label: 'Production Experience' }, { value: '$10M+', label: 'Revenue on These Stacks' }] }], ['cta', { heading: 'Want This Applied to Your Stack?', text: 'Reading about architecture is useful. Having it built for you is better.', label: 'Book a Strategy Session', href: '/contact' }]]],
  ['knowledge-base', 'Knowledge Base | CAW — Redirecting to Blog', [['hero', { badge: 'KNOWLEDGE BASE', headline: 'Knowledge Base<br class="hidden md:block"/>Has<br class="hidden md:block"/><span class="text-neon">Moved.</span>', subhead: 'The Knowledge Base and Blog are now unified at /blog — all architecture deep-dives, AI guides, and growth engineering content in one place.', cta_label: '< GO_TO_BLOG />', cta_href: '/blog', warning_text: '// Bookmark /blog for all future content.' }], ['cta', { heading: 'Everything Is at /blog Now.', text: 'Architecture guides, AI systems, PostgreSQL deep dives, and growth engineering — all in one place.', label: 'Go to Blog & Knowledge Base', href: '/blog' }]]],
  ['search', 'Search | CAW', [['hero', { badge: 'SEARCH', headline: 'Find What<br class="hidden md:block"/><span class="text-neon">You Need.</span>', subhead: 'Search across all content: services, blog posts, architecture guides, and calculators.', cta_label: '< EXPLORE_CONTENT />', cta_href: '/blog' }], ['solution_cards', { eyebrow: '// QUICK_LINKS', title: 'Jump To What You Need', cards: [{ title: '< SERVICES />', body: 'Custom Python APIs, Astro frontends, PostgreSQL design, Google integrations, WordPress, calculators, and 3D visuals.', border_color: 'neon-blue' }, { title: '< BLOG />', body: 'Technical deep-dives on infrastructure, private AI, server-side tracking, FastAPI patterns, and full-stack architecture.', border_color: 'neon-green' }, { title: '< TOOLS />', body: 'ROAS, CAC, LTV, and funnel calculators. Free growth engineering tools powered by Jumpstart Scaling.', border_color: 'neon-pink' }] }], ['icon_bullets', { title: 'Browse by Topic', bullets: [{ icon: '🐍', title: 'Python & FastAPI', text: 'Backend API architecture, async patterns, and production deployment guides.' }, { icon: '🐘', title: 'PostgreSQL', text: 'Schema design, indexes, pgvector, RLS, and asyncpg integration.' }, { icon: '🤖', title: 'Private AI', text: 'Self-hosted LLMs, RAG pipelines, and GDPR-safe AI agent architecture.' }, { icon: '📡', title: 'Server-Side Tracking', text: 'CAPI setup, attribution modeling, and post-iOS14 conversion tracking.' }, { icon: '🧮', title: 'Calculators & Tools', text: 'ROAS, CAC, LTV, cohort analysis. Interactive lead-capture tools.' }, { icon: '🌐', title: 'Frontend & Astro', text: 'SSR, React islands, Tailwind, and Lighthouse-100 marketing sites.' }] }], ['cta', { heading: 'Cannot Find It? Ask Directly.', text: 'If you need something specific, the fastest path is a 20-minute strategy call.', label: 'Book a Strategy Call', href: '/contact' }]]],
];

const OFFER_PAGES = [
  ['services/custom-apps/python-api', 'Python & FastAPI | Custom Backend | CAW', [['hero', { badge: 'BACKEND', headline: 'Python & FastAPI Custom APIs', subhead: 'Async PostgreSQL, REST, and automation backends built for scale.', cta_label: 'Discuss Your API', cta_href: '#contact' }], ['value_prop', { title: 'Production-Grade Python Backends', body: 'FastAPI, asyncpg, and PostgreSQL — the same stack powering God Mode.' }], ['cta', { heading: 'Need a Custom Backend?', text: "Let's scope your API.", label: 'Book a Call', href: '#contact' }]]],
  ['services/custom-apps/frontend', 'Astro, React & Vite | Custom Frontend | CAW', [['hero', { badge: 'FRONTEND', headline: 'Astro, React & Vite Apps', subhead: 'SSR, Tailwind, Framer Motion. Marketing sites and dashboards.', cta_label: 'Get Started', cta_href: '#contact' }], ['value_prop', { title: 'Modern Frontend Stack', body: 'Astro for content, React for interactivity, Vite for speed.' }], ['cta', { heading: 'Ready for a Custom Frontend?', text: "Let's build it.", label: 'Book a Call', href: '#contact' }]]],
  ['services/custom-apps/full-stack', 'Full-Stack Astro + FastAPI | CAW', [['hero', { badge: 'FULL-STACK', headline: 'Astro + FastAPI Full-Stack', subhead: 'SSR, multi-tenant, DB-driven. The God Mode template.', cta_label: 'Discuss Your Stack', cta_href: '#contact' }], ['value_prop', { title: 'DB-Driven Multi-Tenant Apps', body: 'Same architecture as CAW. Routes in Astro, content from PostgreSQL.' }], ['cta', { heading: 'Build Your Full-Stack App', text: "Let's talk architecture.", label: 'Book a Call', href: '#contact' }]]],
  ['services/custom-apps/database', 'PostgreSQL & Database Design | CAW', [['hero', { badge: 'DATABASE', headline: 'PostgreSQL Schema & Migrations', subhead: 'Schema design, migrations, optimization. Built for scale.', cta_label: 'Discuss Your Schema', cta_href: '#contact' }], ['value_prop', { title: 'Production Database Design', body: 'Schema design, indexes, asyncpg integration.' }], ['cta', { heading: 'Database Design Help?', text: "Let's design it right.", label: 'Book a Call', href: '#contact' }]]],
  ['services/custom-apps/google-apis', 'Google Solar, Roofing & Maps API | CAW', [['hero', { badge: 'GOOGLE APIS', headline: 'Solar, Roofing & Maps Integration', subhead: 'Custom apps using Google Solar API, Roofing API, Maps, Places, Geocoding.', cta_label: 'Explore Integrations', cta_href: '#contact' }], ['value_prop', { title: 'Google APIs for Your Product', body: 'Solar potential, rooftop data, maps, directions, places.' }], ['cta', { heading: 'Need Google API Integration?', text: "Let's build it.", label: 'Book a Call', href: '#contact' }]]],
  ['services/custom-apps/wordpress', 'Headless WordPress & Custom Plugins | CAW', [['hero', { badge: 'WORDPRESS', headline: 'Headless WordPress & Custom Development', subhead: 'REST API, GraphQL, custom themes, plugins, WooCommerce.', cta_label: 'Discuss Your WP', cta_href: '#contact' }], ['value_prop', { title: 'WordPress as a Headless CMS', body: 'Use WordPress for content, Astro/React for frontend.' }], ['cta', { heading: 'WordPress Project?', text: "Let's modernize it.", label: 'Book a Call', href: '#contact' }]]],
  ['services/custom-apps/calculators', 'React Calculators & Interactive Tools | CAW', [['hero', { badge: 'TOOLS', headline: 'Custom Calculators & Interactive Tools', subhead: 'ROAS, CAC, LTV, forecasts. React calculators and dashboards.', cta_label: 'Build a Calculator', cta_href: '#contact' }], ['value_prop', { title: 'Lead-Magnet Calculators', body: 'ROAS, funnel, LTV calculators. Custom interactive tools that capture leads.' }], ['cta', { heading: 'Need a Custom Calculator?', text: "Let's build it.", label: 'Book a Call', href: '#contact' }]]],
  ['services/custom-apps/3d-visual', 'Three.js, Rive & 3D Visual | CAW', [['hero', { badge: '3D & VISUAL', headline: 'Three.js, Rive & Spline', subhead: '3D web experiences, animations, interactive visuals.', cta_label: 'Discuss Your Vision', cta_href: '#contact' }], ['value_prop', { title: '3D and Motion on the Web', body: 'Three.js for 3D, Rive for interactive animation, Spline for design-to-3D.' }], ['cta', { heading: '3D or Motion Project?', text: "Let's create it.", label: 'Book a Call', href: '#contact' }]]],
];

function blockSpecsToBlocks(blockSpecs) {
  return blockSpecs.map((spec, i) => {
    const bt = Array.isArray(spec) ? spec[0] : spec;
    const data = Array.isArray(spec) && spec.length >= 2 ? spec[1] : {};
    return { block_type: bt, data };
  });
}

async function runSeed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required. Set it in env or Coolify.');
    process.exit(1);
  }

  const ssl = url.includes('sslmode=require') || url.includes('sslmode=verify')
    ? { rejectUnauthorized: false }
    : false;
  const pool = new Pool({ connectionString: url, ssl });
  const client = await pool.connect();

  try {
    const schema = readFileSync(resolve(ROOT, 'schema.sql'), 'utf8');
    await client.query(schema);

    const theme = { palette: DEFAULT_THEME.palette, nav: DEFAULT_THEME.nav, footer: DEFAULT_THEME.footer };
    const homepageBlocks = HOMEPAGE_BLOCKS.map(([bt, , data]) => ({ block_type: bt, data }));

    const pages = {};
    for (const [slug, title, blockSpecs] of [...CORE_PAGES, ...OFFER_PAGES]) {
      pages[slug] = { title, blocks: blockSpecsToBlocks(blockSpecs) };
    }

    await client.query(
      `INSERT INTO caw_seed (key, value) VALUES 
        ('theme', $1::jsonb),
        ('homepage_blocks', $2::jsonb),
        ('pages', $3::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(theme), JSON.stringify(homepageBlocks), JSON.stringify(pages)]
    );

    const contentRows = [
      ['', 'The One-Stop Architect | CAW', homepageBlocks],
      ...CORE_PAGES.map(([slug, title, blockSpecs]) => [slug, title, blockSpecsToBlocks(blockSpecs)]),
      ...OFFER_PAGES.map(([slug, title, blockSpecs]) => [slug, title, blockSpecsToBlocks(blockSpecs)]),
    ];

    for (const [slug, title, blocks] of contentRows) {
      await client.query(
        `INSERT INTO caw_content (slug, title, blocks, palette, nav, footer)
         VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb)
         ON CONFLICT (slug) DO NOTHING`,
        [slug, title, JSON.stringify(blocks), theme.palette, JSON.stringify(theme.nav), JSON.stringify(theme.footer)]
      );
    }

    console.log(JSON.stringify({ message: 'CAW seed complete (caw_seed + caw_content).', pages: contentRows.length }, null, 2));
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
