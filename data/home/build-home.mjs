/* ══════════════════════════════════════════════════════════════════
   build-home.mjs — generates data/home/today.json for the homepage
   "discovery panel". Runs server-side (GitHub Action, daily) so the
   browser only ever reads one local JSON: no API keys in the client,
   no per-visit third-party calls, works offline, low maintenance.

   Sources (one feed can serve several sections):
     • NASA APOD                    → 📸 Foto do Dia
     • Wikimedia "on this day" EN   → 📜 História, 🚀 Espaço, 💻 Tecnologia, 🎂 Nasceram Hoje
     • Wikimedia "on this day" PT   → 🌍 Hoje em Portugal
     • data/news/topic-geral.json   → 📰 Destaque do Dia (reuses the news pipeline)
     • data/home/quotes.json        → 💡 Inspiração do Dia (curated, rotated by date)

   3-tier resilience: live fetch → committed today.json (cache) → bundled
   fallback.json. Any failing source falls back to the fallback section.
       node data/home/build-home.mjs
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const UA = 'dcop7.github.io homepage builder (https://github.com/dcop7/dcop7.github.io)';
const NASA_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';

/* date in Europe/Lisbon */
const now = new Date();
const lisbon = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }));
const MM = String(lisbon.getMonth() + 1).padStart(2, '0');
const DD = String(lisbon.getDate()).padStart(2, '0');
const ISO = `${lisbon.getFullYear()}-${MM}-${DD}`;
const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dateLabel = `${lisbon.getDate()} de ${MONTHS_PT[lisbon.getMonth()]}`;

async function getJSON(url, opts = {}) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), opts.timeout || 20000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json', ...(opts.headers || {}) }, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) { console.warn('  ! fetch failed', url.slice(0, 70), '—', e.message); return null; }
  finally { clearTimeout(to); }
}

const clean = s => (s || '').toString().replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const cap = (s, n) => { s = clean(s); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

/* map a Wikimedia on-this-day item → flat record */
function mapItem(it) {
  const p = (it.pages || [])[0] || {};
  return {
    year: it.year || null,
    text: clean(it.text),
    title: clean(p.normalizedtitle || p.title || '').replace(/_/g, ' '),
    extract: cap(p.extract || '', 160),
    thumb: (p.thumbnail && p.thumbnail.source) || '',
    url: (p.content_urls && p.content_urls.desktop && p.content_urls.desktop.page) || '',
  };
}
const hay = it => (it.text + ' ' + (it.extract || '') + ' ' + (it.title || '')).toLowerCase();

/* keyword filters — PT first (the feed is Portuguese), EN as backup */
const SPACE_RE = /\b(espa[çc]o|espacial|nave|astronauta|cosmonauta|nasa|esa|spacex|foguet|sat[ée]lite|[óo]rbita|lunar|\blua\b|apollo|soyuz|sputnik|voyager|hubble|telesc[óo]pio|marte|v[ée]nus|j[úu]piter|saturno|gal[áa]xia|nebulosa|cometa|asteroide|sonda|esta[çc][ãa]o espacial|vai[ée]m|space|spacecraft|astronaut|rocket|satellite|orbit|moon|telescope|mars|galaxy|comet|asteroid|spaceflight)\b/i;
const TECH_RE = /\b(computador|inform[áa]tic|software|internet|\bweb\b|s[íi]tio web|microprocessador|processador|trans[íi]stor|semicondutor|programa[çc][ãa]o|algoritmo|telem[óo]vel|smartphone|iphone|android|videojogo|sistema operativo|microsoft|apple|google|ibm|intel|nintendo|correio eletr[óo]nico|arpanet|bitcoin|intelig[êe]ncia artificial|\brob[ôo]\b|telefone|tel[ée]grafo|computer|world wide web|website|transistor|programming|video game|operating system|email|robot)\b/i;
const PT_RE = /\bportugal\b|portugu[êe]s|portuguesa|lisboa|\bporto\b(?!-riquenh)|coimbra|\bbraga\b|[ée]vora|a[çc]ores|a[çc]oriano|madeira|madeirense|alentejo|algarve|sal[aá]zar|rep[úu]blica portugu|reino de portugal|rei de portugal|rainha de portugal|descobrimentos|vasco da gama|cam[õo]es|lusitan|lus[óo]fon|d\. afonso|d\. jo[ãa]o|d\. manuel|d\. pedro|d\. maria|d\. sebasti[ãa]o|infante d/i;
/* stronger Portugal signal for matching free-text extracts (proper nouns only —
   excludes the bare "português/portuguesa" that also tags the language / Brazil). */
const PT_STRONG = /\bportugal\b|lisboa|coimbra|a[çc]ores|madeira|alentejo|algarve|sal[aá]zar|rep[úu]blica portuguesa|reino de portugal|rei de portugal|rainha de portugal|descobrimentos portugu|vasco da gama|cam[õo]es|d\. afonso|d\. jo[ãa]o|d\. manuel|d\. sebasti[ãa]o/i;
/* births: relevant fields (sci/tech/arts/letters/sport/history) vs pop-only */
const B_GOOD = /\b(cientista|f[íi]sic|qu[íi]mic|bi[óo]log|matem[áa]tic|engenheir|inventor|astr[óo]nom|astronauta|programador|inform[áa]tic|escritor|escritora|autor|poeta|poetisa|romancista|dramaturg|fil[óo]sof|pintor|pintora|escultor|arquitet|compositor|maestro|economista|m[ée]dic|cirurgi[ãa]|explorador|navegador|nobel|estadista|pioneir|fundador|rei\b|rainha|imperador|monarca|hist[oó]ria|scientist|physicist|inventor|engineer|mathematician|astronomer|writer|poet|painter|composer|philosopher|architect|explorer|nobel)\b/i;
const B_SPORT = /\b(futebolista|t[ée]nista|ol[íi]mpic|atleta|ciclista|nadador|automobilismo|f[óo]rmula 1|basquetebol|andebol|footballer|olympic athlete)\b/i;
const B_POP = /\b(cantor|cantora|ator\b|atriz|apresentador|youtuber|influen|\brapper\b|\bdj\b|\bmodelo\b|reality|celebridade|tiktok|actor|actress|singer|rapper|tv personality|youtube)\b/i;

function rankBirths(births, n) {
  return births
    .map(mapItem)
    .filter(b => b.title)
    .map(b => {
      const h = hay(b), good = B_GOOD.test(h), sport = B_SPORT.test(h), pop = B_POP.test(h);
      if (pop && !good) return null;                      /* drop pop-only celebs */
      if (!good && !sport && !b.thumb) return null;        /* drop the truly obscure */
      let s = 0;
      if (b.year) s += Math.max(0, (2010 - b.year)) / 8;   /* historical figures preferred */
      if (good) s += 35; if (sport) s += 14;
      if (b.thumb) s += 18;
      s += Math.min(40, (b.extract || '').length / 4);     /* longer article ≈ more notable */
      return { ...b, _s: s };
    })
    .filter(Boolean)
    .sort((a, b) => b._s - a._s)
    .slice(0, n)
    .map(({ _s, ...b }) => b);
}
/* pick from PT feed; if too few, top up from the EN feed (still useful) */
function pickLang(ptArr, enArr, n, re) {
  let out = pick(ptArr, n, re);
  if (out.length < Math.min(2, n) && enArr) { const more = pick(enArr, n, re).filter(x => !out.find(o => o.title && o.title === x.title)); out = out.concat(more).slice(0, n); }
  return out;
}
function pick(items, n, filterRe) {
  let arr = (items || []).map(mapItem).filter(x => x.text);
  if (filterRe) arr = arr.filter(x => filterRe.test(hay(x)));
  /* dedupe by title (then text) */
  const seen = new Set();
  arr = arr.filter(x => { const k = (x.title || x.text).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  /* prefer entries with a thumbnail, keep chronological-ish variety */
  const withThumb = arr.filter(x => x.thumb), without = arr.filter(x => !x.thumb);
  return withThumb.concat(without).slice(0, n);
}

/* ── load fallback + curated quotes ─────────────────────────────── */
let fallback = {};
try { fallback = JSON.parse(readFileSync(join(HERE, 'fallback.json'), 'utf8')); } catch (e) { console.warn('no fallback.json'); }
let quotes = [];
try { quotes = JSON.parse(readFileSync(join(HERE, 'quotes.json'), 'utf8')); } catch (e) {}

const out = { date: ISO, dateLabel, generated: now.toISOString() };

/* (📸 Foto do Dia / NASA APOD removed — not used by the homepage anymore.) */

/* ── Wikimedia on this day (EN + PT) ────────────────────────────── */
console.log('Wikimedia on this day…');
const en = await getJSON(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${MM}/${DD}`);
const pt = await getJSON(`https://pt.wikipedia.org/api/rest_v1/feed/onthisday/all/${MM}/${DD}`);

const ptSel = pt ? (pt.selected || []) : [];
const ptAll = pt ? [...(pt.selected || []), ...(pt.events || [])] : [];
const enAll = en ? [...(en.events || []), ...(en.selected || [])] : [];

/* 🎂 Nasceram Hoje — relevant people, PT feed first, up to 15
   (computed first so "Hoje em Portugal" can avoid repeating the same people) */
{
  let b = rankBirths(pt ? (pt.births || []) : [], 15);
  if (b.length < 6 && en) b = b.concat(rankBirths(en.births || [], 15).filter(x => !b.find(o => o.title === x.title))).slice(0, 15);
  out.births = b.length ? b : (fallback.births || []);
}
const bornTitles = new Set(out.births.map(x => x.title));

/* 🌍 Hoje em Portugal — Portugal-related items across the whole PT feed
   (events + people born/died), so it's not as sparse as an events-only filter.
   text (PT_RE) reliably tags Portuguese people via nationality; the extract is
   matched only against strong proper-noun signals (PT_STRONG — no bare
   "português" which would also catch the Portuguese language / Brazil). Up to 15. */
const ptPool = pt ? [...(pt.selected || []), ...(pt.events || []), ...(pt.births || []), ...(pt.deaths || [])] : [];
const ptExtract = x => clean((x.pages && x.pages[0] && x.pages[0].extract) || '');
out.portugal = pick(ptPool.filter(x => PT_RE.test(clean(x.text)) || PT_STRONG.test(ptExtract(x))), 15);
if (!out.portugal.length) out.portugal = fallback.portugal || [];
const ptUsed = new Set(out.portugal.map(x => x.title));

/* 📜 Hoje na História — world efemérides in Portuguese (minus Portugal ones), up to 15 */
out.history = pick(ptAll.filter(x => !PT_RE.test(clean(x.text))), 15).filter(x => !ptUsed.has(x.title));
if (out.history.length < 6 && en) out.history = out.history.concat(pick(enAll, 15).filter(x => !out.history.find(o => o.title === x.title))).slice(0, 15);
if (!out.history.length) out.history = fallback.history || [];

/* link to the full Portuguese "on this day" Wikipedia page (Ver mais) */
out.links = { onthisday: `https://pt.wikipedia.org/wiki/${lisbon.getDate()}_de_${MONTHS_PT[lisbon.getMonth()]}` };

/* ── 📰 Destaque do Dia (reuse news pipeline) ───────────────────── */
console.log('Destaque (news)…');
try {
  const news = JSON.parse(readFileSync(join(ROOT, 'data', 'news', 'topic-geral.json'), 'utf8'));
  const arts = (news.articles || news.items || []).filter(a => a && a.title && a.url);
  if (arts.length) {
    const a = arts[0];
    out.highlight = { title: clean(a.title).replace(/^\d{1,2}h\d{0,2}\s+/i, ''), url: a.url, source: clean(a.source || a.feed || 'Notícias'), extra: arts.slice(1, 4).map(x => ({ title: cap(clean(x.title).replace(/^\d{1,2}h\d{0,2}\s+/i, ''), 90), url: x.url })) };
  } else out.highlight = fallback.highlight || null;
} catch (e) { out.highlight = fallback.highlight || null; }

/* ── 💡 Inspiração do Dia (curated, rotated deterministically) ──── */
{
  const pool = quotes.length ? quotes : (fallback.inspirationPool || []);
  if (pool.length) {
    const doy = Math.floor((lisbon - new Date(lisbon.getFullYear(), 0, 0)) / 86400000);
    out.inspiration = pool[doy % pool.length];
  } else out.inspiration = fallback.inspiration || null;
}

writeFileSync(join(HERE, 'today.json'), JSON.stringify(out));
console.log(`\ntoday.json written for ${ISO}:`);
for (const k of ['history', 'portugal', 'births', 'inspiration']) {
  const v = out[k];
  console.log(`  ${k}: ${Array.isArray(v) ? v.length + ' items' : (v ? 'ok' : '— (empty)')}`);
}
