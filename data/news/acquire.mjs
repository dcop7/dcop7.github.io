/* ══════════════════════════════════════════════════════════════════
   acquire.mjs — THE acquisition layer. Turns a source into recent,
   dated articles, and is the only place in the repo that fetches or
   parses a feed.

   Both consumers use it:
     build-news.mjs     → Notícias ▸ Todas   (every 4h, all topics)
     build-curated.mjs  → Notícias ▸ Destaques (daily, curated themes)

   Before this module there were two implementations of the same job —
   one keyed on feeds.opml, one on curated-sources.mjs — with two feed
   parsers and two URL normalisers. A single Blogger quirk (single-quoted
   Atom link attributes, which silently returned zero items for every
   Blogger feed) had to be found and fixed twice. It is fixed once here.

   In sources.mjs the unit is the SITE, not the feed URL: a feed is a
   hint, not an identity. Each source is resolved through a chain,
   stopping at the first strategy that yields articles:

     0. scrape         only for kind:'scrape' sources — an HTML listing
                       page plus a link pattern, for the four sites that
                       have never had a usable feed
     1. known feed     the `feed` in sources.mjs, when it works
     2. autodiscovery  <link rel="alternate" type="application/rss+xml">
                       on the homepage — finds feeds that MOVED (this is
                       what recovered Lusa when its old host went dead)
     3. news sitemap   robots.txt → Sitemap: lines → the news-ish one.
                       Google News sitemaps carry <news:publication_date>,
                       which is exactly the "last 24h" question we ask,
                       and they work on sites whose homepage 403s bots
     4. search         TinyFish, ONLY when 0–3 all came back empty. See
                       tinyfishSearch() for why it is last and what it
                       deliberately does not do.

   Whatever succeeds is remembered in sources-resolved.json, so homepages
   are not re-fetched daily — only when a cached feed breaks or the entry
   goes stale. A cached FAILURE is never reused as a shortcut.
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/* Shared by both builders, so it lives beside sources.mjs rather than
   inside either consumer's output directory. */
const CACHE_PATH = join(HERE, 'sources-resolved.json');

/* A real browser UA recovers feeds that block generic/bot agents. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT = 14000;
const CONCURRENCY = 8;
const CACHE_TTL_DAYS = 7;
const ITEMS_PER_SOURCE = 80;   /* Todas keeps 30 days; Destaques filters to 24h itself */
const DATE_CAP = 32;           /* datefrom=page article fetches, per source */

/* ── tiny helpers ── */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', deg: '°', euro: '€' };
const decodeEntities = (s) => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
  .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch { return ''; } })
  .replace(/&([a-z]+[0-9]?);/gi, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m));
const stripCdata = (s) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
export const cleanText = (s) => decodeEntities(stripCdata(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function tagInner(block, name) {
  const re = new RegExp('<(?:\\w+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?' + name + '>', 'i');
  const m = block.match(re); return m ? m[1] : '';
}
export function hash32(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

/* URL normalisation for dedupe: strips the hash and the usual tracking
   parameters so two links to the same article compare equal. Shared, so
   both builders dedupe identically. */
export function urlKey(u) {
  try {
    const x = new URL(u);
    x.hash = '';
    for (const k of [...x.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$|^mc_|^ref$|^source$/i.test(k)) x.searchParams.delete(k);
    const s = (x.host + x.pathname).toLowerCase().replace(/\/$/, '');
    const q = x.searchParams.toString();
    return s + (q ? '?' + q : '');
  } catch { return (u || '').toLowerCase(); }
}
export const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

async function get(url, timeout = TIMEOUT) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, {
      signal: c.signal, redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*' },
    });
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '', url: r.url };
  } catch (e) {
    return { ok: false, status: 0, text: '', err: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(t); }
}

export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { _err: String(e && e.message || e) }; } }
  }));
  return out;
}

/* ── strategy 1/2 payload: RSS + Atom ── */
export function parseFeed(xml) {
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  const out = [];
  for (const b of blocks) {
    const title = cleanText(tagInner(b, 'title'));
    let link = '';
    if (isAtom) {
      /* Attributes may be single- OR double-quoted: Blogger/Atom emits
         rel='alternate' href='…', and a double-quote-only regex silently
         returns zero links for every Blogger-hosted feed. */
      for (const l of b.match(/<link\b[^>]*\/?>/gi) || []) {
        const href = (l.match(/href=["']([^"']+)["']/i) || [])[1];
        if (!href) continue;
        const rel = (l.match(/rel=["']([^"']+)["']/i) || [])[1] || 'alternate';
        if (rel === 'self' || rel === 'replies' || rel === 'edit') continue;
        if (rel === 'alternate') { link = href; break; }
        if (!link) link = href;
      }
    }
    if (!link) link = cleanText(tagInner(b, 'link'));
    if (!link) { const g = cleanText(tagInner(b, 'guid')); if (/^https?:\/\//i.test(g)) link = g; }
    if (!title || !link) continue;

    const ds = tagInner(b, 'pubDate') || tagInner(b, 'published') || tagInner(b, 'updated') || tagInner(b, 'date');
    const ts = Date.parse(cleanText(ds));
    const rawDesc = tagInner(b, 'encoded') || tagInner(b, 'description') || tagInner(b, 'content') || tagInner(b, 'summary');

    /* thumbnail, best effort */
    let image = '';
    const cands = [];
    let m, re = /<media:(?:content|thumbnail)\b[^>]*\burl=["']([^"']+)["']/gi;
    while ((m = re.exec(b))) cands.push(m[1]);
    re = /<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*>/gi;
    while ((m = re.exec(b))) { if (/type=["']image\//i.test(m[0]) || /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(m[1])) cands.push(m[1]); }
    const im = (rawDesc || '').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i); if (im) cands.push(im[1]);
    for (const c of cands) { const u = decodeEntities(c).trim(); if (/^https?:\/\//i.test(u)) { image = u; break; } }

    out.push({ title, url: link.trim(), ts: Number.isFinite(ts) ? ts : null, summary: cleanText(rawDesc), image });
  }
  return out;
}

/* ── strategy 3 payload: Google News sitemap ── */
function parseNewsSitemap(xml) {
  const out = [];
  for (const b of xml.match(/<url>[\s\S]*?<\/url>/gi) || []) {
    const url = cleanText(tagInner(b, 'loc'));
    if (!url) continue;
    const ds = tagInner(b, 'publication_date') || tagInner(b, 'lastmod');
    const ts = Date.parse(cleanText(ds));
    /* Half the sitemaps carry no <news:title>; fall back to the slug so
       the model still has something to judge, and never invent one. */
    let title = cleanText(tagInner(b, 'title'));
    if (!title) {
      try {
        const seg = (new URL(url).pathname.replace(/\/$/, '').split('/').pop() || '')
          .replace(/\.\w{2,5}$/, '').replace(/-\d{4,}$/, '');
        title = decodeURIComponent(seg).replace(/[-_]+/g, ' ').trim().replace(/\b\p{L}/gu, c => c.toUpperCase());
      } catch {}
    }
    if (!title || title.length < 10) continue;
    out.push({ title, url, ts: Number.isFinite(ts) ? ts : null, summary: '', image: '' });
  }
  return out;
}

function discoverFeeds(html, base) {
  const out = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["']?alternate/i.test(tag)) continue;
    if (!/type=["']application\/(rss|atom)\+xml["']/i.test(tag)) continue;
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    /* comment feeds are noise, never news */
    if (/\/comments\/feed|comment-feed/i.test(href)) continue;
    try { out.push(new URL(decodeEntities(href), base).href); } catch {}
  }
  return [...new Set(out)];
}

async function findNewsSitemap(site) {
  const origin = (() => { try { return new URL(site).origin; } catch { return ''; } })();
  if (!origin) return null;
  const rob = await get(origin + '/robots.txt', 9000);
  const listed = [...(rob.text || '').matchAll(/Sitemap:\s*(\S+)/gi)].map(m => m[1].trim());
  const tries = [
    ...listed.filter(u => /news|noticia/i.test(u)),
    origin + '/sitemap-news.xml', origin + '/sitemap/news.xml', origin + '/news-sitemap.xml',
  ];
  for (const u of tries.slice(0, 5)) {
    const r = await get(u, 10000);
    if (r.ok && /<url>/i.test(r.text)) {
      const items = parseNewsSitemap(r.text);
      if (items.some(x => x.ts != null)) return { url: u, items };
    }
  }
  return null;
}

/* ── strategy 0 payload: HTML listing pages ──────────────────────
   Four sources in the list have never had a usable feed (Polígrafo,
   Lusa, Público — Prova dos Factos, Literacia Financeira). They are
   configured with kind:'scrape', a listing `page` and a `match` pattern
   for article links. This is deliberately NOT a general fallback: it
   needs hand-tuning per site and is the opposite of "adding a source is
   one line". Only sources that explicitly declare it get it. */
const SCRAPE_JUNK = /^(ler mais|leia mais|saiba mais|ver mais|read more|continuar a ler|continue reading)$|arrow_|read_more|chevron|material-icons/i;

function slugTitle(u) {
  try {
    const seg = (new URL(u).pathname.replace(/\/$/, '').split('/').pop() || '').replace(/-\d{4,}$/, '');
    const t = decodeEntities(decodeURIComponent(seg)).replace(/[-_]+/g, ' ').trim();
    return t.replace(/\b\p{L}/gu, c => c.toUpperCase());
  } catch { return ''; }
}

/* Real publish date from an article page (JSON-LD datePublished or og meta). */
export function extractPubDate(html) {
  let m = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (m) { const t = Date.parse(m[1]); if (!isNaN(t)) return t; }
  m = html.match(/property="article:published_time"[^>]*content="([^"]+)"/i) || html.match(/content="([^"]+)"[^>]*property="article:published_time"/i);
  if (m) { const t = Date.parse(m[1]); if (!isNaN(t)) return t; }
  return null;
}
/* Date embedded in a URL path, e.g. /2026/06/13/… (Público). */
function urlDate(u) {
  const m = (u || '').match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//);
  if (m) { const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`); if (!isNaN(t)) return t; }
  return null;
}

/* Dating: datefrom="url" parses it out of the article URL; datefrom="page"
   is flagged here and resolved by fetching each article (see acquire());
   otherwise a staggered just-past timestamp keeps the item present without
   burying genuinely dated news above it. */
function scrapeArticles(html, src, now) {
  const page = src.page || src.site;
  let origin = ''; try { origin = new URL(page).origin; } catch {}
  const matchRe = src.match ? new RegExp(src.match, 'i') : /^https?:/i;
  const forceSlug = src.titlefrom === 'slug';
  const re = /<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const out = [], seen = new Set();
  let m, idx = 0;
  while ((m = re.exec(html))) {
    let href = m[1];
    if (!matchRe.test(href)) continue;
    if (href.startsWith('/')) href = origin + href;
    else if (!/^https?:/i.test(href)) continue;
    const key = href.replace(/\/$/, '');
    if (seen.has(key)) continue; seen.add(key);
    let title = '';
    if (!forceSlug) {
      const txt = cleanText(m[2]).replace(/^Media\s+/, '').trim();   /* drop inline category label */
      if (txt.length >= 12 && !SCRAPE_JUNK.test(txt)) title = txt;
    }
    if (!title) title = slugTitle(href);
    if (!title || title.length < 6) continue;
    let ts = now - 2 * 86400000 - idx * 3600000, needDate = false;   /* default: buried */
    if (src.datefrom === 'url') { const ud = urlDate(href); if (ud != null) ts = ud; else ts = now - idx * 3600000; }
    else if (src.datefrom === 'page') needDate = true;
    out.push({ title: title.slice(0, 160), url: href, ts, _needDate: needDate, _idx: idx, summary: '', image: '' });
    idx++;
  }
  return out;
}

/* ── strategy 4: search ──────────────────────────────────────────
   TinyFish Search, used ONLY when strategies 0–3 all returned nothing.
   That is the case for a handful of publishers that refuse automated
   fetches outright (BleepingComputer, New Scientist, What Car?), where
   the alternative today is no coverage at all.

   Why it is last and stays last, measured on this source list:
   a news index carries big publishers within hours but is months behind
   on small ones — Região de Leiria publishes daily and the freshest
   indexed item was 39 days old. Search ranks by relevance, RSS
   enumerates by recency. So search is a floor under the blocked sources,
   never a replacement for the feed.

     GET https://api.search.tinyfish.ai   header X-API-Key
     domain_type=news  → results carry `date` and `publisher`
     recency_minutes   → the exact 24h window, rather than a coarse "day"

   Free tier: 30 requests/minute, no monthly quota, no card. At ~3 blocked
   sources this is 3 requests/day. No key, no network, a bad response or
   an undated result set: returns [] and the source is reported `none`,
   exactly as before this strategy existed. */
const TINYFISH_KEY = process.env.TINYFISH_KEY || '';
const TINYFISH_URL = 'https://api.search.tinyfish.ai';

async function tinyfishSearch(src, windowH) {
  if (!TINYFISH_KEY) return null;
  let host = '';
  try { host = new URL(src.site).host.replace(/^www\./, ''); } catch { return null; }
  if (!host) return null;

  const qs = new URLSearchParams({
    /* The site's own name is the least leading query available: anything
       topical would bias which of its articles come back. */
    query: src.name,
    domain_type: 'news',
    include_domains: host,
    recency_minutes: String(Math.round((windowH || 48) * 60)),
    language: src.pt ? 'pt' : 'en',
  });

  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const r = await fetch(`${TINYFISH_URL}?${qs}`, {
      signal: c.signal,
      headers: { 'X-API-Key': TINYFISH_KEY, Accept: 'application/json' },
    });
    if (!r.ok) { console.warn(`   ! search: HTTP ${r.status} for ${src.name}`); return null; }
    const j = await r.json();
    const rows = Array.isArray(j && j.results) ? j.results : [];
    const items = [];
    for (const x of rows) {
      if (!x || typeof x.url !== 'string' || typeof x.title !== 'string') continue;
      /* Never accept a result from another domain: include_domains is a
         request, and the article's own URL is the only proof. */
      try { if (new URL(x.url).host.replace(/^www\./, '') !== host) continue; } catch { continue; }
      const ts = Date.parse(x.date || '');
      /* Undated is useless here — the whole pipeline filters on a time
         window, and an undated item would be treated as fresh forever. */
      if (!Number.isFinite(ts)) continue;
      items.push({ title: cleanText(x.title).slice(0, 200), url: x.url, ts, summary: cleanText(x.snippet || ''), image: '' });
    }
    return items.length ? items : null;
  } catch (e) {
    console.warn(`   ! search: ${e.name === 'AbortError' ? 'timeout' : e.message} for ${src.name}`);
    return null;
  } finally { clearTimeout(t); }
}

/* ── cache ── */
function loadCache() {
  try { return JSON.parse(readFileSync(CACHE_PATH, 'utf8')); } catch { return {}; }
}
export function saveCache(cache) {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    const tmp = CACHE_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify(cache, null, 1));
    renameSync(tmp, CACHE_PATH);
  } catch (e) { console.warn('  ! could not write resolver cache —', e.message); }
}
/* A cached FAILURE is never a shortcut: re-run the whole chain for it,
   otherwise a site that was down once stays "none" until the TTL lapses. */
const isStale = (entry) => !entry || !entry.checked || !entry.ok ||
  (Date.now() - Date.parse(entry.checked)) > CACHE_TTL_DAYS * 86400000;

/* ── resolve one source ──────────────────────────────────────────
   Returns { items, via, feed } — `via` records which strategy won, so
   the run log shows at a glance which sites are living on a fallback. */
async function resolveOne(src, cache, opts) {
  /* Keyed on the source NAME, not the site. Seven MakeUseOf sections and
     five TLDR newsletters are separate sources that share one site, and a
     site-keyed cache made them collide — the first to resolve won and the
     rest silently reused its feed. The name is the unique identifier in
     sources.mjs and survives a feed URL change, which is what the cache
     exists to absorb. */
  const key = src.name || src.feed || src.site;
  const cached = cache[key];

  /* 0. scrape — declared per source, never a general fallback. Not cached:
     the listing page IS the source, there is no feed URL to remember. */
  if (src.kind === 'scrape') {
    const r = await get(src.page || src.site);
    const items = r.ok ? scrapeArticles(r.text, src, opts.now) : [];
    cache[key] = { feed: src.page || src.site, via: 'scrape', checked: new Date().toISOString(), ok: !!items.length };
    return { items, via: items.length ? 'scrape' : 'none', feed: src.page || src.site };
  }

  const attempts = [];

  /* 1. whatever we used last time, then the configured feed */
  if (cached && cached.feed && !isStale(cached)) attempts.push([cached.feed, cached.via || 'cache']);
  if (src.feed) attempts.push([src.feed, 'known feed']);
  if (cached && cached.feed && isStale(cached)) attempts.push([cached.feed, 'cache (stale)']);

  for (const [url, via] of attempts) {
    const r = await get(url);
    if (!r.ok) continue;
    const items = parseFeed(r.text);
    if (items.length) {
      /* A cache hit reports the strategy that originally WORKED, never a
         stale failure marker — "none (7 items)" is a contradiction. */
      const isCacheHit = via === 'cache' || via === 'cache (stale)';
      const real = isCacheHit
        ? (cached && cached.ok && cached.via && cached.via !== 'none' ? cached.via : 'known feed')
        : via;
      cache[key] = { feed: url, via: real, checked: new Date().toISOString(), ok: true };
      return { items, via: real, feed: url };
    }
  }

  /* 2. autodiscovery — catches feeds that moved (found lusaverifica.pt
     when combatefakenews.lusa.pt had been dead for months) */
  if (src.site) {
    const home = await get(src.site);
    if (home.ok && home.text) {
      for (const f of discoverFeeds(home.text, home.url || src.site).slice(0, 3)) {
        const r = await get(f);
        if (!r.ok) continue;
        const items = parseFeed(r.text);
        if (items.length) {
          cache[key] = { feed: f, via: 'autodiscovery', checked: new Date().toISOString(), ok: true };
          return { items, via: 'autodiscovery', feed: f };
        }
      }
    }
  }

  /* 3. news sitemap — works even where the homepage 403s bots */
  if (src.site) {
    const sm = await findNewsSitemap(src.site);
    if (sm) {
      cache[key] = { feed: sm.url, via: 'news sitemap', checked: new Date().toISOString(), ok: true };
      return { items: sm.items, via: 'news sitemap', feed: sm.url };
    }
  }

  /* 4. search — last resort for sources that refuse automated fetching.
     Not cached: there is no feed URL to remember, and it must be retried
     from scratch every run in case the feed comes back. */
  const found = await tinyfishSearch(src, opts.windowH);
  if (found && found.length) {
    cache[key] = { feed: '', via: 'search', checked: new Date().toISOString(), ok: false };
    return { items: found, via: 'search', feed: '' };
  }

  cache[key] = { feed: (cached && cached.feed) || src.feed || '', via: 'none', checked: new Date().toISOString(), ok: false };
  return { items: [], via: 'none', feed: '' };
}

/* ── public ──────────────────────────────────────────────────────
   Every article comes back in one shape regardless of which strategy
   produced it, so neither builder has to care where it came from.

     windowH  how far back the caller intends to look. Only strategy 4
              uses it, to size its recency filter; nothing is filtered
              here, because the two builders keep different windows
              (Todas retains 30 days, Destaques asks for 24 hours).     */
export async function acquire(sources, { concurrency = CONCURRENCY, now = Date.now(), windowH = 48 } = {}) {
  const cache = loadCache();
  const opts = { now, windowH };
  const results = await pool(sources, concurrency, async (src) => ({ src, ...(await resolveOne(src, cache, opts)) }));

  /* Scrape sources flagged datefrom="page" carry no date until their
     article page is read. Resolve the newest few so recent items are not
     hidden behind a date filter; anything unresolved stays staggered. */
  const undated = [];
  for (const r of results) if (r && r.items) for (const it of r.items.slice(0, DATE_CAP)) if (it._needDate) undated.push(it);
  if (undated.length) {
    console.log(`  resolving ${undated.length} article dates (datefrom=page)…`);
    await pool(undated, 6, async (it) => {
      const r = await get(it.url, 12000);
      const t = r.ok ? extractPubDate(r.text) : null;
      it.ts = t != null ? t : (now - (it._idx + 1) * 4 * 3600000);
    });
  }

  const articles = [];
  const report = [];
  for (const r of results) {
    if (!r || r._err) { report.push({ name: '?', via: 'error', count: 0, err: r && r._err }); continue; }
    const { src, items, via, feed } = r;
    let kept = 0;
    for (const it of items.slice(0, ITEMS_PER_SOURCE)) {
      if (!it.title || !it.url) continue;
      articles.push({
        id: slug(src.name) + '-' + hash32(it.url).toString(36),
        title: it.title.slice(0, 200),
        url: it.url,
        source: src.name,
        site: src.site || '',
        pt: !!src.pt,
        ts: it.ts,                       /* may be null — caller decides */
        topic: src.topic || '',
        theme: src.theme || null,
        summary: (it.summary || '').slice(0, 220),
        image: (it.image || '').slice(0, 300),
      });
      kept++;
    }
    report.push({ name: src.name, via, feed, count: kept });
  }
  return { articles, report, cache };
}
