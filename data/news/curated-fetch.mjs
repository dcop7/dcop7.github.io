/* ══════════════════════════════════════════════════════════════════
   curated-fetch.mjs — turns a SITE into recent articles, for Notícias AI.

   The point of this module: in curated-sources.mjs the unit is the site,
   not the feed URL. A feed is a hint, not an identity. So each source is
   resolved through a chain, stopping at the first strategy that yields
   dated articles:

     1. known feed     the `feed` in curated-sources.mjs, when it works
     2. autodiscovery  <link rel="alternate" type="application/rss+xml">
                       on the homepage — finds feeds that MOVED
     3. news sitemap   robots.txt → Sitemap: lines → the news-ish one,
                       or the usual paths. Google News sitemaps carry
                       <news:publication_date>, which is exactly the
                       "last 24h" question we ask. Measured to work on
                       7 of 12 sampled sites, including ones whose
                       homepage returns 403 to bots.

   Whatever succeeds is remembered in curated/sources-resolved.json, so
   the homepage is not re-fetched daily — only when the cached feed
   breaks or the entry goes stale.

   Deliberately NOT here: HTML scraping with per-site regexes. That is
   what feeds.opml already does for four sources, it needs hand-tuning
   per site, and it is the opposite of "adding a site is one line".
   A site that reaches strategy 3 and still yields nothing is reported
   and skipped, not guessed at.

   V1 (build-news.mjs / feeds.opml) does not import this and is not
   affected by it.
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(HERE, 'curated', 'sources-resolved.json');

/* A real browser UA recovers feeds that block generic/bot agents. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT = 14000;
const CONCURRENCY = 8;
const CACHE_TTL_DAYS = 7;
const ITEMS_PER_SOURCE = 40;

/* ── tiny helpers (kept local: importing from build-news.mjs would
   execute it, since it is a top-level script, not a library) ── */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', deg: '°', euro: '€' };
const decodeEntities = (s) => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
  .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch { return ''; } })
  .replace(/&([a-z]+[0-9]?);/gi, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m));
const stripCdata = (s) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const cleanText = (s) => decodeEntities(stripCdata(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function tagInner(block, name) {
  const re = new RegExp('<(?:\\w+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?' + name + '>', 'i');
  const m = block.match(re); return m ? m[1] : '';
}
function hash32(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
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
async function resolveOne(src, cache) {
  const key = src.site || src.feed || src.name;
  const cached = cache[key];
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

  cache[key] = { feed: (cached && cached.feed) || src.feed || '', via: 'none', checked: new Date().toISOString(), ok: false };
  return { items: [], via: 'none', feed: '' };
}

/* ── public: fetch every source of a theme ───────────────────────
   Shapes articles exactly like the V1 shards do, so the curator does
   not care where they came from. */
export async function fetchSources(sources, { concurrency = CONCURRENCY } = {}) {
  const cache = loadCache();
  const results = await pool(sources, concurrency, async (src) => ({ src, ...(await resolveOne(src, cache)) }));

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
        summary: (it.summary || '').slice(0, 220),
        image: (it.image || '').slice(0, 300),
      });
      kept++;
    }
    report.push({ name: src.name, via, feed, count: kept });
  }
  return { articles, report, cache };
}
