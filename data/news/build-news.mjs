/* ══════════════════════════════════════════════════════════════════
   build-news.mjs — static news aggregator (no DB, no runtime deps)
   Reads the Feedly OPML (data/news/feeds.opml) as the source of truth,
   fetches every RSS/Atom feed server-side (a GitHub Action runs this every
   4h — no CORS there), parses + dedupes + classifies by topic, and writes
   static JSON for GitHub Pages:
       data/news/index.json        catalog: topics, sources, counts, ts
       data/news/latest.json       newest ~180 across all topics
       data/news/topic-<id>.json   newest ~140 per topic
   Pure Node (global fetch, Node 18+). Scales to hundreds of feeds via a
   bounded fetch pool with per-feed timeout and isolated failures.
   Run: node data/news/build-news.mjs
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/* A real browser UA recovers feeds that block generic/bot user-agents. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CONCURRENCY = 10;
const FEED_TIMEOUT = 14000;
const ITEMS_PER_FEED = 80;     /* capture as many as each feed offers (most give fewer) */
const RETAIN_DAYS = 14;
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
  ['factcheck',     '✅', 'Fact Check',    'Fact Check',    true],
  ['geral',         '🇵🇹', 'Portugal',     'Geral',         false],
  ['mundo',         '🌍', 'World',         'Mundo',         false],
  ['economia',      '💶', 'Economy',       'Economia',      false],
];
const TOPIC_IDS = new Set(TOPICS.map(t => t[0]));
const FEATURED = new Set(TOPICS.filter(t => t[4]).map(t => t[0]));

/* ── Source → primary topic + Portuguese flag (keyed by OPML title) ── */
const SRC = {
  /* Tecnologia */
  'MakeUseOf - Technology News': ['tecnologia', false], 'MakeUseOf - Internet': ['tecnologia', false],
  'MakeUseOf - Windows': ['tecnologia', false], 'MakeUseOf - Linux': ['tecnologia', false],
  'Pplware': ['tecnologia', true], 'MaisTecnologia': ['tecnologia', true], 'Leak': ['tecnologia', true],
  'Tek Notícias': ['tecnologia', true], 'PCGuia': ['tecnologia', true], 'Minuto Digital': ['tecnologia', true],
  'Xa das 5': ['tecnologia', true], 'A tecnologia está do teu lado': ['tecnologia', true],
  'XDA': ['tecnologia', false], 'ZDNet': ['tecnologia', false], 'Forbes - Innovation': ['tecnologia', false],
  'TechCrunch': ['tecnologia', false], 'The Verge': ['tecnologia', false], 'Ars Technica': ['tecnologia', false],
  'HowToGeek': ['tecnologia', false],
  /* IA */
  'Simon Willison': ['ia', false], 'OpenAI': ['ia', false],
  'Google DeepMind': ['ia', false], 'Latent Space': ['ia', false], 'One Useful Thing': ['ia', false],
  'Future Tools': ['ia', false],
  /* TLDR (isolated newsletter section) */
  'TLDR Tech': ['tldr', false], 'TLDR IT': ['tldr', false], 'TLDR DevOps': ['tldr', false],
  'TLDR AI': ['tldr', false], 'TLDR Data': ['tldr', false], 'TLDR Hardware': ['tldr', false],
  /* Android */
  'MakeUseOf - Android': ['android', false], '9to5Google': ['android', false], 'Android Police': ['android', false],
  'AndroidGeek': ['android', true], 'Android Authority': ['android', false],
  /* Produtividade */
  'MakeUseOf - Productivity': ['produtividade', false], 'Lifehacker': ['produtividade', false],
  /* DevOps */
  'DevOps on Medium': ['devops', false],
  'The New Stack': ['devops', false], 'DevOps.com': ['devops', false], 'Cloud Native Now': ['devops', false],
  'Platform Engineering': ['devops', false], 'Cloud Native Computing Foundation': ['devops', false],
  'Reddit — selfhosted': ['devops', false],
  /* Segurança */
  'The Hacker News': ['seguranca', false], 'Krebs on Security': ['seguranca', false],
  'BleepingComputer': ['seguranca', false], 'Dark Reading': ['seguranca', false],
  /* Ciência */
  'ScienceDaily': ['ciencia', false], 'Nature': ['ciencia', false], 'New Scientist': ['ciencia', false],
  /* Carros */
  'Razão Automóvel': ['carros', true], 'Autoblog': ['carros', true], 'Motor24': ['carros', true],
  'What Car?': ['carros', false], 'InsideEVs': ['carros', false],
  /* F1 & Motorsport */
  'Latest F1 News': ['f1', false], 'AutoSport': ['f1', true],
  /* Gaming */
  'IGN Portugal': ['gaming', true], 'Eurogamer.pt': ['gaming', true],
  /* Filmes e TV */
  'MovieWeb': ['filmes', false], '/Film': ['filmes', false], 'ScreenRant': ['filmes', false],
  'Aberto até de Madrugada': ['filmes', true],
  /* Fact Check */
  'Polígrafo': ['factcheck', true], 'Lusa — Combate Fake News': ['factcheck', true],
  'Público — Prova dos Factos': ['factcheck', true], 'EU vs Disinfo': ['factcheck', false],
  'FactCheck.org': ['factcheck', false], 'Snopes': ['factcheck', false],
  /* Geral PT */
  'SIC Notícias': ['geral', true], 'Diário de Notícias': ['geral', true],
  'RTP Notícias / Geral / Últimas': ['geral', true], 'Expresso': ['geral', true], 'Região de Leiria': ['geral', true],
  /* Mundo */
  'The Guardian — World': ['mundo', false],
  'BBC News': ['mundo', false], 'Euronews': ['mundo', false],
  /* Economia */
  'Contas Poupança': ['economia', true], 'Jornal de Negócios': ['economia', true],
  'Literacia Financeira': ['economia', true],
};

/* No cross-cutting keyword tags — each article keeps its source's topic, so
   the tabs stay clean (a tech article never leaks into Geral PT). */
const KW = [];

/* ── tiny helpers ── */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', deg: '°', euro: '€' };
const decodeEntities = (s) => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
  .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch { return ''; } })
  .replace(/&([a-z]+[0-9]?);/gi, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m));
const stripCdata = (s) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const stripTags = (s) => (s || '').replace(/<[^>]+>/g, ' ');
const cleanText = (s) => decodeEntities(stripTags(stripCdata(s || ''))).replace(/\s+/g, ' ').trim();
const cleanTitle = (s) => decodeEntities(stripTags(stripCdata(s || ''))).replace(/\s+/g, ' ').trim();

function tagInner(block, name) {
  const re = new RegExp('<(?:\\w+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?' + name + '>', 'i');
  const m = block.match(re); return m ? m[1] : '';
}
/* Atom <link href=…>: prefer rel="alternate" or no rel; skip rel="self". */
function atomLink(block) {
  const links = block.match(/<link\b[^>]*\/?>/gi) || [];
  let best = '';
  for (const l of links) {
    const href = (l.match(/href="([^"]+)"/i) || [])[1];
    if (!href) continue;
    const rel = (l.match(/rel="([^"]+)"/i) || [])[1] || 'alternate';
    if (rel === 'self') continue;
    if (rel === 'alternate') return href;
    if (!best) best = href;
  }
  return best;
}

/* ── OPML ── (supports type="rss"/"atom" feeds and type="scrape" sources:
   a scrape outline points xmlUrl at an HTML listing page and carries a
   `match` regex selecting article hrefs — a fallback for sites without RSS.) */
function parseOPML(xml) {
  const feeds = [];
  const re = /<outline\b[^>]*type="(rss|atom|scrape)"[^>]*>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const o = m[0];
    const kind = (m[1] || 'rss').toLowerCase();
    const xmlUrl = (o.match(/xmlUrl="([^"]+)"/i) || [])[1];
    const title = decodeEntities((o.match(/(?:title|text)="([^"]+)"/i) || [])[1] || '');
    const htmlUrl = (o.match(/htmlUrl="([^"]+)"/i) || [])[1] || '';
    const match = (o.match(/\bmatch="([^"]+)"/i) || [])[1] || '';
    const titlefrom = (o.match(/\btitlefrom="([^"]+)"/i) || [])[1] || '';
    if (xmlUrl) feeds.push({ title, kind, match, titlefrom, xmlUrl: decodeEntities(xmlUrl), htmlUrl: decodeEntities(htmlUrl) });
  }
  /* de-dup identical feed URLs (the OPML has a couple) */
  const seen = new Set();
  return feeds.filter(f => (seen.has(f.xmlUrl) ? false : seen.add(f.xmlUrl)));
}

/* Title from a URL slug (for scraped links whose anchor text is JS-rendered). */
function slugTitle(u) {
  try {
    const seg = (new URL(u).pathname.replace(/\/$/, '').split('/').pop() || '').replace(/-\d{4,}$/, '');
    const t = decodeEntities(decodeURIComponent(seg)).replace(/[-_]+/g, ' ').trim();
    return t.replace(/\b\p{L}/gu, c => c.toUpperCase());
  } catch { return ''; }
}

/* Scrape article links from an HTML listing page (no-RSS fallback). Undated →
   given a staggered just-past timestamp so they stay present but never bury the
   site's real dated news. */
const SCRAPE_JUNK = /^(ler mais|leia mais|saiba mais|ver mais|read more|continuar a ler|continue reading)$|arrow_|read_more|chevron|material-icons/i;
function scrapeArticles(html, f, now) {
  let origin = ''; try { origin = new URL(f.xmlUrl).origin; } catch {}
  const matchRe = f.match ? new RegExp(f.match, 'i') : /^https?:/i;
  const forceSlug = f.titlefrom === 'slug';
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
      const txt = cleanTitle(m[2]).replace(/^Media\s+/, '').trim();   /* drop inline category label */
      if (txt.length >= 12 && !SCRAPE_JUNK.test(txt)) title = txt;
    }
    if (!title) title = slugTitle(href);
    if (!title || title.length < 6) continue;
    out.push({ title: title.slice(0, 160), link: href, ts: now - 2 * 86400000 - idx * 3600000, summary: '', image: '' });
    idx++;
  }
  return out;
}

/* ── fetch with timeout ── */
async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FEED_TIMEOUT);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

/* Best-effort thumbnail: media:content/thumbnail, image enclosure, <img> in
   the content, or itunes:image. Returns '' if none found. */
function extractImage(block, rawDesc) {
  const cands = [];
  let m, re = /<media:(?:content|thumbnail)\b[^>]*\burl="([^"]+)"/gi;
  while ((m = re.exec(block))) cands.push(m[1]);
  re = /<enclosure\b[^>]*\burl="([^"]+)"[^>]*>/gi;
  while ((m = re.exec(block))) { if (/type="image\//i.test(m[0]) || /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(m[1])) cands.push(m[1]); }
  const im = (rawDesc || '').match(/<img\b[^>]*\bsrc="([^"]+)"/i); if (im) cands.push(im[1]);
  const it = block.match(/<itunes:image\b[^>]*\bhref="([^"]+)"/i); if (it) cands.push(it[1]);
  for (const c of cands) { const u = decodeEntities(c).trim(); if (/^https?:\/\//i.test(u)) return u; }
  return '';
}

/* ── feed parsing (RSS <item> + Atom <entry>) ── */
function parseFeed(xml) {
  const out = [];
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const title = cleanTitle(tagInner(b, 'title'));
    let link = '';
    if (isAtom) link = atomLink(b);
    if (!link) link = cleanText(tagInner(b, 'link'));
    if (!link) {
      const guid = cleanText(tagInner(b, 'guid'));
      if (/^https?:\/\//i.test(guid)) link = guid;
    }
    const dateStr = tagInner(b, 'pubDate') || tagInner(b, 'published') || tagInner(b, 'updated') || tagInner(b, 'date');
    const ts = Date.parse(cleanText(dateStr));
    const rawDesc = tagInner(b, 'encoded') || tagInner(b, 'description') || tagInner(b, 'content') || tagInner(b, 'summary');
    const desc = cleanText(rawDesc);
    const image = extractImage(b, rawDesc);
    if (!title || !link) continue;
    out.push({ title, link: link.trim(), ts: isNaN(ts) ? null : ts, summary: desc, image });
  }
  return out;
}

/* ── url normalisation for dedupe ── */
function urlKey(u) {
  try {
    const x = new URL(u);
    x.hash = '';
    const drop = [...x.searchParams.keys()].filter(k => /^utm_|^fbclid$|^gclid$|^mc_|^ref$|^source$/i.test(k));
    drop.forEach(k => x.searchParams.delete(k));
    let s = (x.host + x.pathname).toLowerCase().replace(/\/$/, '');
    const q = x.searchParams.toString();
    return s + (q ? '?' + q : '');
  } catch { return (u || '').toLowerCase(); }
}
const normTitle = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/* ── classify ── */
function classify(art, primary) {
  const topics = new Set([primary]);
  const hay = art.title + ' ' + art.summary;
  for (const [tp, re] of KW) if (re.test(hay)) topics.add(tp);
  return [...topics].filter(t => TOPIC_IDS.has(t));
}

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/* ── bounded pool ── */
async function pool(items, n, fn) {
  const ret = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; try { ret[idx] = await fn(items[idx], idx); } catch (e) { ret[idx] = { _err: String(e && e.message || e) }; } }
  }));
  return ret;
}

/* ════════════════════════════ MAIN ════════════════════════════ */
const opml = readFileSync(HERE + '/feeds.opml', 'utf8');
const feeds = parseOPML(opml);
console.log(`OPML: ${feeds.length} feeds`);

const now = Date.now();
const minTs = now - RETAIN_DAYS * 86400000;
const maxTs = now + 36 * 3600000; /* allow slight clock skew / scheduled posts */

const results = await pool(feeds, CONCURRENCY, async (f) => {
  const text = await fetchText(f.xmlUrl);
  const items = (f.kind === 'scrape' ? scrapeArticles(text, f, now) : parseFeed(text)).slice(0, ITEMS_PER_FEED);
  return { feed: f, items };
});

const sourcesMeta = [];
const all = [];
let okFeeds = 0, failFeeds = 0;
for (let k = 0; k < results.length; k++) {
  const f = feeds[k];
  const map = SRC[f.title] || ['mundo', false];
  const [primary, pt] = map;
  const r = results[k];
  if (!r || r._err || !r.items) { failFeeds++; sourcesMeta.push({ name: f.title, topic: primary, pt, site: f.htmlUrl, count: 0, ok: false }); continue; }
  okFeeds++;
  let kept = 0;
  for (const it of r.items) {
    if (it.ts == null) it.ts = now; /* undated → treat as fresh-ish */
    if (it.ts < minTs || it.ts > maxTs) continue;
    const topics = classify(it, primary);
    if (pt && !topics.includes('portugal') && primary !== 'portugal') { /* keep pt flag, no forced topic */ }
    all.push({
      id: slug(f.title) + '-' + Math.abs(hash(it.link)).toString(36),
      title: it.title.slice(0, 200),
      url: it.link,
      source: f.title,
      site: f.htmlUrl,
      topics, pt,
      ts: it.ts,
      summary: it.summary.slice(0, SUMMARY_LEN),
      image: (it.image || '').slice(0, 300),
    });
    kept++;
  }
  sourcesMeta.push({ name: f.title, topic: primary, pt, site: f.htmlUrl, count: kept, ok: true });
}

function hash(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

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

/* per-topic shards (the UI loads these per selected topic) */
for (const [id] of TOPICS) {
  const arts = deduped.filter(a => a.topics.includes(id)).slice(0, PER_TOPIC);
  writeFileSync(HERE + `/topic-${id}.json`, JSON.stringify({ id, generated, count: arts.length, articles: arts }));
}

/* index.json */
writeFileSync(HERE + '/index.json', JSON.stringify({
  generated,
  total: deduped.length,
  feeds: { total: feeds.length, ok: okFeeds, failed: failFeeds },
  topics: TOPICS.map(([id, icon, en, pt, feature]) => ({ id, icon, en, pt, feature: !!feature, count: topicCounts[id] })),
  sources: sourcesMeta.sort((a, b) => b.count - a.count),
}));

console.log(`Wrote index.json + ${TOPICS.length} topic files.`);
console.log('Topic counts:', topicCounts);
