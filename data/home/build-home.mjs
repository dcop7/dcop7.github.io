/* ══════════════════════════════════════════════════════════════════
   build-home.mjs — generates data/home/today.json for the homepage
   "discovery panel". Runs server-side (GitHub Action, daily) so the
   browser only ever reads one local JSON: no API keys in the client,
   no per-visit third-party calls, works offline, low maintenance.

   Sources (one feed can serve several sections):
     • Wikimedia "on this day" EN+PT → 📜 História, 🌍 Hoje em Portugal,
                                       🎂 Nasceram Hoje
     • data/news/topic-geral.json   → 📰 Destaque do Dia (reuses the news pipeline)
     • data/home/quotes.json        → 💡 Inspiração do Dia (curated, rotated by date)

   The feed→sections selection logic lives in js/core/otd-lib.js, SHARED
   with the browser: when today.json is stale (Action ran late) the client
   rebuilds the same sections live from the same feeds.

   3-tier resilience: live fetch → committed today.json (cache) → bundled
   fallback.json. Any failing source falls back to the fallback section.
       node data/home/build-home.mjs
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OTD = createRequire(import.meta.url)(join(ROOT, 'js', 'core', 'otd-lib.js'));
const UA = 'dcop7.github.io homepage builder (https://github.com/dcop7/dcop7.github.io)';

/* date in Europe/Lisbon */
const now = new Date();
const lisbon = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }));
const MM = String(lisbon.getMonth() + 1).padStart(2, '0');
const DD = String(lisbon.getDate()).padStart(2, '0');
const ISO = `${lisbon.getFullYear()}-${MM}-${DD}`;
const MONTHS_PT = OTD.MONTHS_PT;
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

const clean = OTD.clean, cap = OTD.cap;

/* ── load fallback + curated quotes ─────────────────────────────── */
let fallback = {};
try { fallback = JSON.parse(readFileSync(join(HERE, 'fallback.json'), 'utf8')); } catch (e) { console.warn('no fallback.json'); }
let quotes = [];
try { quotes = JSON.parse(readFileSync(join(HERE, 'quotes.json'), 'utf8')); } catch (e) {}

const out = { date: ISO, dateLabel, generated: now.toISOString() };

/* ── Wikimedia on this day (EN + PT) → shared selection logic ───── */
console.log('Wikimedia on this day…');
const en = await getJSON(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${MM}/${DD}`);
const pt = await getJSON(`https://pt.wikipedia.org/api/rest_v1/feed/onthisday/all/${MM}/${DD}`);

const sec = OTD.buildSections(pt, en, fallback);
out.births = sec.births;
out.portugal = sec.portugal;
out.history = sec.history;

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
