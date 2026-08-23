/* ══════════════════════════════════════════════════════════════════
   build-news.mjs — Notícias ▸ Todas: the complete chronological reader.

   Reads the shared list in sources.mjs and acquires articles through
   acquire.mjs — the SAME module Notícias ▸ Destaques uses, so a feed
   parsed here is parsed by exactly one implementation. This file owns
   only what is specific to Todas: the 17 topics, keyword classification,
   TMDB trailers, the 30-day retention window and the per-topic shards.

   A GitHub Action runs it every 4h (no CORS there). Writes static JSON
   for GitHub Pages:
       data/news/index.json        catalog: topics, sources, counts, ts
       data/news/latest.json       newest ~180 across all topics
       data/news/topic-<id>.json   newest ~140 per topic
   Pure Node (global fetch, Node 18+).
   Run: node data/news/build-news.mjs
══════════════════════════════════════════════════════════════════ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './sources.mjs';
import { acquire, saveCache, urlKey, slug, cleanText } from './acquire.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONCURRENCY = 10;
const RETAIN_DAYS = 30;   /* retain a bit longer so slower feeds (e.g. fact-checkers) still surface */
const PER_TOPIC = 500;         /* topic shard cap — serves the "all ≤500" view option */
const SUMMARY_LEN = 220;

/* ── Topics ── [id, icon, en, pt, featured]
   "featured" topics are the user's interests and form the default "Para ti"
   feed; the rest (Geral PT, Mundo, Economia) live in their own tabs only. */
const TOPICS = [
  ['tecnologia',    '💻', 'Technology',    'Tecnologia',    true],
  ['ia',            '🧠', 'AI',            'IA',            true],
  ['tldr',          '📩', 'TLDR',          'TLDR',          true],
  ['android',       '📱', 'Android',       'Android',       true],
  ['produtividade', '🧰', 'Productivity',  'Produtividade', true],
  ['devops',        '🧩', 'DevOps',        'DevOps',        true],
  ['seguranca',     '🔒', 'Security',      'Segurança',     true],
  ['ciencia',       '🔬', 'Science',       'Ciência',       true],
  ['carros',        '🚗', 'Cars',          'Carros',        true],
  ['f1',            '🏎️', 'F1 & Motorsport', 'F1 & Motorsport', true],
  ['gaming',        '🎮', 'Gaming',        'Gaming',        true],
  ['filmes',        '🎬', 'Film & TV',     'Filmes & TV',   true],
  ['trailers',      '🎞️', 'Trailers',      'Trailers',      true],
  ['factcheck',     '✅', 'Fact Check',    'Fact Check',    true],
  ['geral',         '🇵🇹', 'Portugal',     'Geral',         false],
  ['mundo',         '🌍', 'World',         'Mundo',         false],
  ['economia',      '💶', 'Economy',       'Economia',      false],
];
const TOPIC_IDS = new Set(TOPICS.map(t => t[0]));
const FEATURED = new Set(TOPICS.filter(t => t[4]).map(t => t[0]));

/* Topic and Portuguese flag now live on each record in sources.mjs, so
   the old title-keyed SRC map is gone: one source, one place. */

const KW = [];

/* ── classification + dedupe helpers (specific to Todas) ──────────
   Everything to do with fetching and parsing now lives in acquire.mjs;
   what remains here is only how Todas organises what it was given. */
const normTitle = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function classify(art, primary) {
  const topics = new Set([primary]);
  const hay = art.title + ' ' + art.summary;
  for (const [tp, re] of KW) if (re.test(hay)) topics.add(tp);
  return [...topics].filter(t => TOPIC_IDS.has(t));
}

/* ── Trailers via TMDB API (mainstream only, scored to hide obscure films) ──
   Needs a free TMDB v3 API key in env TMDB_KEY (GitHub Action secret). Pulls
   popular/upcoming movies (US region) + popular TV, keeps English-language or
   high-popularity titles, then fetches each one's official YouTube trailer.
   Degrades to [] (no Trailers tab) when the key is absent or TMDB is down. */
const TMDB_KEY = process.env.TMDB_KEY || '';
async function tmdbJSON(path, params) {
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.searchParams.set('api_key', TMDB_KEY);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(u, { signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) throw new Error('TMDB ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function fetchTrailers(now) {
  if (!TMDB_KEY) { console.log('Trailers: no TMDB_KEY — skipped.'); return []; }
  let lists;
  try {
    lists = await Promise.all([
      tmdbJSON('/movie/popular',  { region: 'US', language: 'pt-PT', page: '1' }).catch(() => ({ results: [] })),
      tmdbJSON('/movie/upcoming', { region: 'US', language: 'pt-PT', page: '1' }).catch(() => ({ results: [] })),
      tmdbJSON('/tv/popular',     { language: 'pt-PT', page: '1' }).catch(() => ({ results: [] })),
    ]);
  } catch (e) { console.log('Trailers: TMDB error', e.message); return []; }
  const cand = [];
  const add = (arr, kind) => (arr || []).forEach(m => {
    const title = m.title || m.name || '';
    const pop = m.popularity || 0;
    const mainstream = (m.original_language === 'en') || pop >= 40;   /* drop non-Hollywood unless very popular */
    if (!title || !mainstream || pop < 15) return;                     /* hide obscure */
    cand.push({ kind, id: m.id, title, pop, date: m.release_date || m.first_air_date || '', poster: m.poster_path || '', overview: m.overview || '' });
  });
  add(lists[0].results, 'movie'); add(lists[1].results, 'movie'); add(lists[2].results, 'tv');
  const seen = new Set(), top = [];
  for (const c of cand.sort((a, b) => b.pop - a.pop)) { const k = c.kind + c.id; if (seen.has(k)) continue; seen.add(k); top.push(c); if (top.length >= 28) break; }
  const withVid = await pool(top, 8, async (c) => {
    const v = await tmdbJSON(`/${c.kind}/${c.id}/videos`, { language: 'en-US' }).catch(() => null);
    const vids = ((v && v.results) || []).filter(x => x.site === 'YouTube' && /Trailer|Teaser/i.test(x.type));
    vids.sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0) || (Date.parse(b.published_at || 0) - Date.parse(a.published_at || 0)));
    return vids[0] ? { ...c, ytKey: vids[0].key } : null;
  });
  const items = [];
  withVid.forEach((c, idx) => {
    if (!c || c._err || !c.ytKey) return;
    items.push({
      id: 'trailer-' + c.kind + '-' + c.id,
      title: `${c.title}${c.kind === 'tv' ? ' (série)' : ''} — Trailer`,
      url: 'https://www.youtube.com/watch?v=' + c.ytKey,
      source: 'Trailers', site: 'https://www.themoviedb.org',
      topics: ['trailers'], pt: false,
      ts: now - idx * 3600000,                 /* keep popularity order; all stay "fresh" */
      summary: (c.overview || '').slice(0, SUMMARY_LEN),
      image: c.poster ? ('https://image.tmdb.org/t/p/w500' + c.poster) : '',
    });
  });
  console.log(`Trailers: ${items.length} from TMDB.`);
  return items;
}

/* ════════════════════════════ MAIN ════════════════════════════ */
const now = Date.now();
const minTs = now - RETAIN_DAYS * 86400000;
const maxTs = now + 36 * 3600000; /* allow slight clock skew / scheduled posts */

console.log(`Sources: ${SOURCES.length} (shared list)`);

/* One call. Fetching, feed/scrape parsing, feed rediscovery, sitemap
   fallback, search fallback and datefrom=page resolution all happen
   inside acquire.mjs — the same code path Destaques uses. */
const { articles: acquired, report, cache } = await acquire(SOURCES, {
  concurrency: CONCURRENCY, now, windowH: RETAIN_DAYS * 24,
});
saveCache(cache);

const viaCount = {};
for (const r of report) viaCount[r.via] = (viaCount[r.via] || 0) + 1;
console.log('  strategies: ' + Object.entries(viaCount).map(([k, v]) => `${k}=${v}`).join(' · '));
for (const r of report) if (r.via !== 'known feed' && r.via !== 'cache') console.log(`   · ${r.name}: ${r.via}${r.count ? ` (${r.count})` : ''}`);

/* ── shape into Todas' article records ── */
const byName = new Map(SOURCES.map(x => [x.name, x]));
const counts = new Map();
const all = [];
for (const a of acquired) {
  const src = byName.get(a.source);
  if (!src) continue;
  let ts = a.ts;
  if (ts == null) ts = now;                    /* undated → treat as fresh-ish */
  if (ts < minTs || ts > maxTs) continue;
  all.push({
    id: a.id,
    title: a.title.slice(0, 200),
    url: a.url,
    source: a.source,
    site: a.site,
    topics: classify(a, src.topic),
    pt: !!src.pt,
    ts,
    summary: (a.summary || '').slice(0, SUMMARY_LEN),
    image: a.image || '',
  });
  counts.set(a.source, (counts.get(a.source) || 0) + 1);
}

const okFeeds = report.filter(r => r.count > 0).length;
const failFeeds = report.length - okFeeds;
const sourcesMeta = SOURCES.map(src => ({
  name: src.name, topic: src.topic, pt: !!src.pt, site: src.site,
  count: counts.get(src.name) || 0, ok: (counts.get(src.name) || 0) > 0,
}));

/* Trailers (TMDB) — appended to the same pipeline (dedupe/shard) as a topic. */
const trailerItems = await fetchTrailers(now);
let trailerKept = 0;
for (const t of trailerItems) { if (t.ts >= minTs && t.ts <= maxTs) { all.push(t); trailerKept++; } }
if (trailerKept) sourcesMeta.push({ name: 'Trailers', topic: 'trailers', pt: false, site: 'https://www.themoviedb.org', count: trailerKept, ok: true });

/* dedupe: by URL, and by (source + normalised title) */
const seenUrl = new Set(), seenST = new Set();
const deduped = [];
for (const a of all.sort((x, y) => y.ts - x.ts)) {
  const uk = urlKey(a.url);
  const stk = slug(a.source) + '|' + normTitle(a.title);
  if (seenUrl.has(uk) || seenST.has(stk)) continue;
  seenUrl.add(uk); seenST.add(stk);
  deduped.push(a);
}
deduped.sort((a, b) => b.ts - a.ts);
console.log(`Articles: ${all.length} raw → ${deduped.length} after dedupe (${okFeeds} feeds ok, ${failFeeds} failed)`);

/* ── write output ── */
mkdirSync(HERE, { recursive: true });
const generated = new Date(now).toISOString();
const topicCounts = {};
for (const t of TOPICS) topicCounts[t[0]] = 0;
for (const a of deduped) for (const tp of a.topics) if (tp in topicCounts) topicCounts[tp]++;

/* per-topic shards (the UI loads these per selected topic). Skip empty topics
   (e.g. Trailers when no TMDB key) so the UI never shows an empty tab. */
for (const [id] of TOPICS) {
  const arts = deduped.filter(a => a.topics.includes(id)).slice(0, PER_TOPIC);
  if (!arts.length) continue;
  writeFileSync(HERE + `/topic-${id}.json`, JSON.stringify({ id, generated, count: arts.length, articles: arts }));
}

/* index.json */
writeFileSync(HERE + '/index.json', JSON.stringify({
  generated,
  total: deduped.length,
  feeds: { total: SOURCES.length, ok: okFeeds, failed: failFeeds },
  topics: TOPICS.map(([id, icon, en, pt, feature]) => ({ id, icon, en, pt, feature: !!feature, count: topicCounts[id] })).filter(t => t.count > 0),
  sources: sourcesMeta.sort((a, b) => b.count - a.count),
}));

console.log(`Wrote index.json + ${TOPICS.length} topic files.`);
console.log('Topic counts:', topicCounts);
