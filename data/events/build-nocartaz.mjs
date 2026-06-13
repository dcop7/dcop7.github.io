/* ══════════════════════════════════════════════════════════════════
   build-nocartaz.mjs — generates data/events/nocartaz.json
   A trimmed, future-only national snapshot of NoCartaz' open-data agenda
   (https://www.nocartaz.pt/events.json — ~9000 events, all districts,
   updated several times a day). NoCartaz serves CORS locked to its own
   origin, so the browser cannot fetch it live from dcop7.github.io; we
   bundle a snapshot at build time instead (Node has no CORS). This is a
   MANUAL refresh tool (no CI), like build-places.mjs — re-run to refresh:
       node data/events/build-nocartaz.mjs
   Source: NoCartaz (agregador independente, dados abertos). Atribuição.
══════════════════════════════════════════════════════════════════ */
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = 'https://www.nocartaz.pt/events.json';
const HORIZON_DAYS = 150;          /* keep events up to ~5 months out */
const CAP = 2600;                  /* keep the bundle small (~400 KB) */

const now = new Date();
const today = new Date(now); today.setHours(0, 0, 0, 0);
const horizon = new Date(today.getTime() + HORIZON_DAYS * 86400000);

console.log('Fetching', SRC, '…');
const res = await fetch(SRC, { headers: { 'Accept': 'application/json' } });
if (!res.ok) { console.error('HTTP', res.status); process.exit(1); }
const raw = await res.json();
const all = Array.isArray(raw) ? raw : (raw.events || []);
console.log('Total events from source:', all.length);

const clean = (s) => (s || '').toString().replace(/\s+/g, ' ').trim();
/* NoCartaz descriptions are raw HTML and sometimes embed third-party widgets
   (e.g. a Google Maps <iframe> carrying that site's API key). Strip all markup
   to plain text, decode the common entities, hard-redact anything that looks
   like a leaked API key, and cap the length. Keeps the snapshot clean and
   prevents committing other people's secrets. */
const stripHtml = (s, max = 280) => (s || '')
  .toString()
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
  .replace(/AIza[0-9A-Za-z_\-]{20,}/g, '')                 /* Google API keys */
  .replace(/\bAKIA[0-9A-Z]{16}\b/g, '')                    /* AWS access keys */
  .replace(/https?:\/\/\S*[?&]key=\S+/gi, '')              /* any url with a key= param */
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

let kept = all
  .map(e => {
    const start = new Date(String(e.starts_at || '').replace(' ', 'T'));
    return { e, start };
  })
  .filter(({ start }) => !isNaN(start) && start >= today && start <= horizon)
  .sort((a, b) => (b.e.relevance_score || 0) - (a.e.relevance_score || 0));

/* Cap total but keep a national spread: round-robin a per-district cap first. */
const PER_DISTRICT = 220;
const byDist = {};
const spread = [];
const overflow = [];
for (const item of kept) {
  const d = clean(item.e.distrito) || '—';
  byDist[d] = (byDist[d] || 0) + 1;
  if (byDist[d] <= PER_DISTRICT) spread.push(item); else overflow.push(item);
}
const final = spread.concat(overflow).slice(0, CAP);

const events = final.map(({ e, start }) => ({
  id: 'nc-' + e.id,
  title: stripHtml(e.title, 160),
  desc: stripHtml(e.description),
  start: start.toISOString(),
  district: clean(e.distrito),
  url: e.url || 'https://www.nocartaz.pt/',
  /* Images intentionally omitted: NoCartaz thumbnails live on many external
     CDNs that 403/404 on hotlinking → broken boxes + console noise. We show
     the category placeholder instead (live AgendaLX images still load). */
  free: Number(e.price_min) === 0,
  price: Number(e.price_min) > 0 ? Math.round(Number(e.price_min)) + ' €' : '',
  rel: e.relevance_score || 0,
}));

const out = { source: 'NoCartaz', generated: now.toISOString().slice(0, 10), count: events.length, events };
writeFileSync(HERE + '/nocartaz.json', JSON.stringify(out));
const dists = [...new Set(events.map(e => e.district))].filter(Boolean);
console.log(`nocartaz.json: ${events.length} events, ${dists.length} districts (${dists.slice(0, 22).join(', ')})`);
