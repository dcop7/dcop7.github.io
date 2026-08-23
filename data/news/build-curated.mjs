/* ══════════════════════════════════════════════════════════════════
   build-curated.mjs — Notícias AI (V2): daily editorial pass over the
   articles the existing RSS pipeline already collected.

       data/news/topic-*.json      (input — written by build-news.mjs)
                 │
                 ▼  consolidate 17 raw topics → 13 editorial themes
                 ▼  pre-filter: 24h window, dedupe, cap 60 candidates
                 ▼  chunk to a conservative Groq token budget
                 ▼  Groq: group + rank + summarise  (returns IDs ONLY)
                 ▼  validate against the schema; re-attach URLs by lookup
                 ▼  write atomically
       data/news/curated/d/YYYY-MM-DD.json   daily detail (0–30 days)
       data/news/curated/latest.json         what the V2 page reads
       data/news/curated/index.json          catalog + archive listing

   HARD RULES, in order of importance:

   1. This script NEVER writes an empty or partial-looking result over a
      good one. Output is assembled in memory, validated, and only then
      written. If nothing valid was produced, it exits without touching
      a single file — the Action then finds no diff and the previous day
      stays published.
   2. The model returns article IDs, never URLs, titles of sources, or
      dates. Every link, source name and timestamp in the output is
      copied from the RSS candidate that the ID resolves to. An ID that
      does not resolve invalidates the whole story. This makes fabricated
      sources structurally impossible rather than merely unlikely.
   3. GROQ_KEY is read from the environment and never logged, never
      written to output, never sent anywhere except api.groq.com.
   4. Failure here cannot affect the existing Notícias page: different
      script, different workflow, different output directory, different
      page module.

   Groq free tier, verified 2026-08-23 (console.groq.com/docs/rate-limits),
   openai/gpt-oss-120b: 30 RPM · 1 000 RPD · 8 000 TPM · 200 000 TPD.
   Limits are per ORGANISATION, not per key. See RATE section below for
   the margins actually used.

   Usage:
     node data/news/build-curated.mjs            build today
     node data/news/build-curated.mjs --dry-run  pre-filter + batch plan,
                                                 no API calls, no writes
     node data/news/build-curated.mjs --check    validate committed output
     node data/news/build-curated.mjs --mock     offline end-to-end test
                                                 (no API calls; output is
                                                  stamped model:"mock")
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from './curated-themes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'curated');
const DAY_DIR = join(OUT_DIR, 'd');

const ARGV = new Set(process.argv.slice(2));
const DRY = ARGV.has('--dry-run');
const CHECK_ONLY = ARGV.has('--check');
/* --mock exercises the whole chain (chunking → materialise → regroup →
   validate → write) with a deterministic stand-in for the model, so the
   plumbing and the V2 page can be tested offline without spending
   quota. It is NOT a production fallback: output is stamped
   model:"mock" so it can never be mistaken for curation. */
const MOCK = ARGV.has('--mock');

/* ── SELECTION ──────────────────────────────────────────────────── */
const WINDOW_H = 24;          /* the "last 24 hours" the brief asks for      */
const WINDOW_H_MAX = 36;      /* widened for a theme too quiet to judge at 24h */
const MIN_CANDIDATES = 6;     /* below this, widen the window before giving up */
const MIN_TO_CURATE = 3;      /* fewer than this: not worth a request at all   */
const MAX_CANDIDATES = 60;    /* per theme, newest first — keeps chunks small  */
const MAX_STORIES = 5;        /* per theme per day. A ceiling, never a quota.  */
const SUMMARY_MAX = 260;
const WHY_MAX = 180;
const TITLE_MAX = 120;

/* ── RATE: conservative margins against the free tier ────────────
   TPM is the binding limit, not RPD: 8 000 tokens/minute against a
   1 000 request/day allowance we barely touch (~20 requests). So the
   budget below is a TOKEN budget, and requests are paced by it.

   A request costs input + output, and gpt-oss emits reasoning tokens
   that count as output, so the bucket reserves the full max_tokens up
   front and refunds nothing — deliberately pessimistic.

     per-request ceiling  3 200 in + 1 600 out  = 4 800  (60% of TPM)
     rolling budget       6 000 tokens / 60 s           (75% of TPM)

   That leaves 2 000 TPM of headroom so a retry lands without queuing
   behind our own traffic. Measured on the real corpus: 21 requests/day
   = 2% of RPD, ~101k tokens worst case = 50% of TPD, and well under
   that in practice since few chunks fill their input budget.        */
const MODEL = 'openai/gpt-oss-120b';
const TOK_BUDGET_PER_MIN = 6000;
const MAX_INPUT_TOK = 3200;
const MAX_OUTPUT_TOK = 1600;
const REQ_TIMEOUT = 90000;
const MAX_ATTEMPTS = 3;       /* per chunk, including the initial call */

const GROQ_KEY = process.env.GROQ_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/* ── tiny helpers ────────────────────────────────────────────────── */
const clamp = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* Estimated tokens. Portuguese + English mixed JSON runs ~3.5 chars/token;
   3.2 is used so the estimate errs high and the bucket stays honest. */
const estTok = (s) => Math.ceil(String(s).length / 3.2);

function hash32(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/* Same URL normalisation the RSS pipeline uses, so a candidate that
   appears in two shards collapses to one. */
function urlKey(u) {
  try {
    const x = new URL(u);
    x.hash = '';
    [...x.searchParams.keys()].filter(k => /^utm_|^fbclid$|^gclid$|^mc_|^ref$|^source$/i.test(k)).forEach(k => x.searchParams.delete(k));
    const q = x.searchParams.toString();
    return (x.host + x.pathname).toLowerCase().replace(/\/$/, '') + (q ? '?' + q : '');
  } catch { return String(u || '').toLowerCase(); }
}

/* Europe/Lisbon calendar day — the site's clock everywhere else too. */
function lisbonToday() {
  const l = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }));
  return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, '0')}-${String(l.getDate()).padStart(2, '0')}`;
}

/* ── token bucket: rolling 60 s window ───────────────────────────── */
const _spent = [];   /* [{ t, n }] */
async function reserve(n) {
  for (;;) {
    const cut = Date.now() - 60000;
    while (_spent.length && _spent[0].t < cut) _spent.shift();
    const used = _spent.reduce((s, x) => s + x.n, 0);
    if (used + n <= TOK_BUDGET_PER_MIN) { _spent.push({ t: Date.now(), n }); return; }
    const waitMs = Math.max(1000, 60000 - (Date.now() - _spent[0].t) + 250);
    console.log(`   ⏳ token budget: ${used}/${TOK_BUDGET_PER_MIN} used — waiting ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
}

/* ════════════════════════ 1 · CANDIDATES ════════════════════════ */
function loadShard(id) {
  const p = join(HERE, `topic-${id}.json`);
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, 'utf8')).articles || []; }
  catch (e) { console.warn(`  ! unreadable topic-${id}.json — ${e.message}`); return []; }
}

/* The "last 24 hours" must be measured from when the RSS snapshot was
   built, NOT from wall-clock now. GitHub delays crons by minutes to
   hours (the rule this repo learned the hard way), and anchoring to
   now() would silently shrink the window every time the runner started
   late — a theme that had 34 candidates would quietly become 5.
   Falls back to now() only if no shard carries a timestamp. */
function snapshotNow() {
  let newest = 0;
  for (const t of THEMES) for (const raw of t.from) {
    const p = join(HERE, `topic-${raw}.json`);
    if (!existsSync(p)) continue;
    try {
      const g = Date.parse(JSON.parse(readFileSync(p, 'utf8')).generated || '');
      if (Number.isFinite(g) && g > newest) newest = g;
    } catch {}
  }
  return newest || Date.now();
}

/* Newest-first, deduped, capped. Widens the window once when a theme is
   too quiet to judge, rather than curating three articles as if they
   were a day's news. */
function candidatesFor(theme, now) {
  const raw = [];
  for (const t of theme.from) raw.push(...loadShard(t));

  const pick = (hours) => {
    const min = now - hours * 3600000;
    const seen = new Set();
    return raw
      .filter(a => a && a.title && a.url && typeof a.ts === 'number' && a.ts >= min && a.ts <= now + 36 * 3600000)
      .sort((a, b) => b.ts - a.ts)
      .filter(a => { const k = urlKey(a.url); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, MAX_CANDIDATES);
  };

  let arts = pick(WINDOW_H);
  let hours = WINDOW_H;
  if (arts.length < MIN_CANDIDATES) { const wide = pick(WINDOW_H_MAX); if (wide.length > arts.length) { arts = wide; hours = WINDOW_H_MAX; } }
  return { arts, hours };
}

/* ════════════════════════ 2 · BATCHING ═════════════════════════ */
/* One line per candidate, deliberately terse — every character here is
   a token we pay for at 8 000 TPM. */
const candLine = (a, now) => JSON.stringify({
  i: a.id,
  t: clamp(a.title, 150),
  s: clamp(a.summary, 190),
  f: a.source,
  h: Math.max(0, Math.round((now - a.ts) / 3600000)),
});

function chunkCandidates(arts, now, overheadTok) {
  const chunks = [];
  let cur = [], curTok = 0;
  for (const a of arts) {
    const cost = estTok(candLine(a, now)) + 2;
    if (cur.length && curTok + cost > MAX_INPUT_TOK - overheadTok) { chunks.push(cur); cur = []; curTok = 0; }
    cur.push(a); curTok += cost;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/* ════════════════════════ 3 · PROMPT ═══════════════════════════ */
const SYSTEM = `You are the editor of a Portuguese personal news dashboard. You receive a JSON array of news articles collected from RSS feeds in the last hours. You select and organise them. You never write news yourself.

ABSOLUTE RULES
- Work ONLY from the supplied articles. Never add an event, number, name, date or claim that is not in the material you were given.
- Refer to articles ONLY by their "i" id. Never output a URL, a source name or a date — those are attached later from the source data. Inventing one invalidates the story.
- Every id you output must be copied exactly from the input.

YOUR JOB
1. GROUP: when several articles report the SAME underlying event, emit ONE story listing all their ids in "articleIds", most informative article first. Articles that merely share a topic are NOT the same event and must stay separate.
2. RANK: order stories by editorial importance — consequence, how many people it affects, novelty, and how much it changes what a reader already assumed. Not by recency, and not by how dramatic the headline sounds.
3. SUMMARISE: 1–2 factual sentences, in European Portuguese, drawn strictly from the supplied title and summary.
4. EXPLAIN: "why" is one short sentence on why this matters to a general reader. No hype.
5. SCORE: integer 0–100 for your editorial judgement of importance. This is your opinion, and it is labelled as such to readers. Use the full range; do not cluster everything at 70–80.

HOW MANY
Return AT MOST 5 stories. Fewer is correct and expected when the material is thin — routine product updates, listicles, sponsored posts, "best deals" roundups and opinion filler are not stories. Returning 2 strong stories is a better answer than 5 padded ones. Returning 0 is right when nothing of substance came in.

OUTPUT
Strict JSON, no markdown fence, exactly this shape:
{"stories":[{"articleIds":["id1","id2"],"title":"…","summary":"…","why":"…","score":0,"tags":["…"]}]}
title: European Portuguese, max 110 chars, factual, no clickbait.
summary: max 240 chars. why: max 160 chars. tags: 1–3 lowercase words.`;

const MODE_HINT = {
  coverage: 'These feeds are generalist outlets that frequently cover the same events. Expect real duplicates: merge them into single stories with several ids.',
  discovery: 'These feeds are specialist outlets that rarely cover the same event. Expect few or no duplicates — do not force groupings. Your value here is choosing the few items that matter out of many, and saying why.',
};

function userPrompt(theme, arts, now, lang) {
  const label = theme.pt;
  return `Theme: ${label}. ${MODE_HINT[theme.mode]}
Select at most ${MAX_STORIES} stories from the ${arts.length} articles below.

[${arts.map(a => candLine(a, now)).join(',\n')}]`;
}

/* ════════════════════════ 4 · GROQ ═════════════════════════════ */
/* Offline stand-in (--mock): groups articles that share ≥3 significant
   title words, scores by recency + coverage, returns the top 5. Shaped
   exactly like a model reply so it flows through the same validation. */
function mockReply(arts) {
  const groups = [];
  for (const a of arts) {
    const w = sigWords(a.title);
    const g = groups.find(x => { let n = 0; for (const t of w) if (x.w.has(t)) n++; return n >= 3; });
    if (g) { g.ids.push(a.id); g.srcs.add(a.source); }
    else groups.push({ w, ids: [a.id], srcs: new Set([a.source]), a });
  }
  const newest = Math.max(...arts.map(a => a.ts));
  return {
    stories: groups
      .map(g => ({
        articleIds: g.ids,
        title: clamp(g.a.title, TITLE_MAX),
        summary: clamp(g.a.summary || g.a.title, SUMMARY_MAX),
        why: 'Selecção heurística offline (modo de teste, sem IA).',
        score: Math.min(100, Math.round(30 + g.srcs.size * 15 + 25 * (1 - (newest - g.a.ts) / 86400000))),
        tags: ['mock'],
      }))
      .sort((x, y) => y.score - x.score)
      .slice(0, MAX_STORIES),
  };
}

async function groqJSON(system, user, label) {
  const inTok = estTok(system) + estTok(user) + 40;
  if (inTok > MAX_INPUT_TOK + 400) console.warn(`   ! ${label}: prompt ~${inTok} tok, above the ${MAX_INPUT_TOK} target`);

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await reserve(inTok + MAX_OUTPUT_TOK);

    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
    try {
      const r = await fetch(GROQ_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: MAX_OUTPUT_TOK,
          reasoning_effort: 'low',
        }),
      });

      if (r.status === 429) {
        /* Respect the server's own backoff rather than guessing. */
        const wait = Math.min(180, Math.ceil(Number(r.headers.get('retry-after') || 30))) * 1000;
        console.log(`   ⏳ ${label}: 429 — waiting ${wait / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
        await sleep(wait);
        lastErr = new Error('429 rate limited');
        continue;
      }
      if (!r.ok) {
        /* Body may carry a provider message; it never carries the key. */
        const body = await r.text().catch(() => '');
        const err = new Error(`HTTP ${r.status} ${clamp(body, 200)}`);
        /* A 4xx will not become a 2xx by asking again: retrying burns
           wall clock and, because each attempt reserves against the
           token budget, stalls every later theme behind a 60s wait for
           a request that can never succeed. Auth failures additionally
           abort the whole run — one bad key means all 21 chunks fail. */
        if (r.status === 401 || r.status === 403) { err.fatal = true; err.auth = true; throw err; }
        if (r.status >= 400 && r.status < 500) { err.fatal = true; throw err; }
        throw err;
      }

      const j = await r.json();
      const txt = j?.choices?.[0]?.message?.content || '';
      if (!txt.trim()) throw new Error('empty completion');
      return JSON.parse(txt);
    } catch (e) {
      lastErr = e;
      if (e.fatal) { console.warn(`   ! ${label}: ${e.message} — not retryable`); throw e; }
      const msg = e.name === 'AbortError' ? `timeout after ${REQ_TIMEOUT / 1000}s` : e.message;
      console.warn(`   ! ${label}: ${msg} (attempt ${attempt}/${MAX_ATTEMPTS})`);
      if (attempt < MAX_ATTEMPTS) await sleep(2000 * attempt);
    } finally { clearTimeout(to); }
  }
  throw lastErr || new Error('unknown failure');
}

/* ════════════════════════ 5 · VALIDATION ═══════════════════════ */
/* Turns a model reply into stories, or throws. Every field that a reader
   will see as fact (url, source, date, image) comes from `byId`, never
   from the model. Anything the model got wrong is dropped here, not
   rendered later. */
function materialise(reply, byId, theme, dayISO) {
  if (!reply || !Array.isArray(reply.stories)) throw new Error('reply has no "stories" array');

  const out = [];
  const claimed = new Set();   /* an article belongs to exactly one story */

  for (const s of reply.stories) {
    if (!s || typeof s !== 'object') continue;

    const ids = Array.isArray(s.articleIds) ? s.articleIds.filter(x => typeof x === 'string') : [];
    const arts = [];
    let bogus = false;
    for (const id of ids) {
      const a = byId.get(id);
      if (!a) { bogus = true; break; }            /* hallucinated id → drop the story */
      if (claimed.has(id)) continue;               /* already used → drop the dupe ref */
      arts.push(a);
    }
    if (bogus) { console.warn(`   ! ${theme.id}: story references an unknown article id — dropped`); continue; }
    if (!arts.length) continue;

    const title = clamp(s.title, TITLE_MAX);
    const summary = clamp(s.summary, SUMMARY_MAX);
    if (title.length < 12) { console.warn(`   ! ${theme.id}: story title too short — dropped`); continue; }
    /* A generated title or summary must not smuggle in a link. */
    if (/https?:\/\//i.test(title + ' ' + summary + ' ' + (s.why || ''))) { console.warn(`   ! ${theme.id}: generated text contains a URL — dropped`); continue; }

    let score = Math.round(Number(s.score));
    if (!Number.isFinite(score)) score = 50;
    score = Math.max(0, Math.min(100, score));

    arts.sort((a, b) => b.ts - a.ts);
    const lead = arts.find(a => a.image) || arts[0];
    /* Measured signal, kept separate from the model's opinion. */
    const sourceCount = new Set(arts.map(a => a.source)).size;

    arts.forEach(a => claimed.add(a.id));

    out.push({
      key: `${theme.id}-${dayISO}-${hash32(arts.map(a => a.id).sort().join('|')).toString(36)}`,
      slug: slugify(title),
      theme: theme.id,
      date: dayISO,
      rank: 0,                                   /* assigned after the final sort */
      title,
      summary,
      why: clamp(s.why, WHY_MAX),
      score,                                     /* AI judgement — labelled as such in the UI */
      sourceCount,                               /* measured */
      tags: (Array.isArray(s.tags) ? s.tags : []).slice(0, 3).map(t => clamp(t, 24).toLowerCase()).filter(Boolean),
      ts: Math.max(...arts.map(a => a.ts)),
      image: lead.image || '',
      sources: arts.map(a => ({
        id: a.id, title: clamp(a.title, 180), url: a.url,
        source: a.source, site: a.site || '', ts: a.ts,
      })),
    });
  }

  return out;
}

/* Cross-chunk regrouping.
   A theme with >60 candidates is split into several requests, and each
   request only sees its own slice — so two chunks can independently
   raise the same event as a story. Chunks are cut in time order and
   coverage of one event clusters in time, so this is uncommon, but it
   is exactly the "several cards for the same story" failure the whole
   feature exists to remove. Deterministic, no extra model call: merge
   two stories whose significant title words overlap heavily. */
const STOP = new Set(['para', 'como', 'mais', 'pode', 'sobre', 'entre', 'depois', 'contra', 'ainda', 'novo', 'nova', 'anos', 'este', 'esta', 'with', 'from', 'that', 'this', 'have', 'will', 'after', 'over', 'into', 'says', 'their', 'about']);
const sigWords = (s) => new Set(String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w)));

function regroup(stories) {
  const out = [];
  for (const s of stories) {
    const w = sigWords(s.title);
    const twin = out.find(o => {
      const ow = sigWords(o.title);
      let inter = 0; for (const x of w) if (ow.has(x)) inter++;
      return inter >= 3 && inter / Math.min(w.size, ow.size) >= 0.5;
    });
    if (!twin) { out.push(s); continue; }
    /* Fold the weaker card into the stronger one, keeping every source. */
    const have = new Set(twin.sources.map(x => x.id));
    for (const src of s.sources) if (!have.has(src.id)) { twin.sources.push(src); have.add(src.id); }
    twin.sources.sort((a, b) => b.ts - a.ts);
    twin.sourceCount = new Set(twin.sources.map(x => x.source)).size;
    twin.ts = Math.max(twin.ts, s.ts);
    twin.score = Math.max(twin.score, s.score);
    if (!twin.image && s.image) twin.image = s.image;
  }
  return out;
}

/* Schema gate. Runs over the assembled file before it is written, and
   again via --check over what is committed. */
function validateDay(doc) {
  const errs = [];
  const E = (m) => errs.push(m);

  if (!doc || typeof doc !== 'object') return ['not an object'];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.date || '')) E('date is not YYYY-MM-DD');
  if (!doc.generated || isNaN(Date.parse(doc.generated))) E('generated is not a date');
  if (!doc.model) E('missing model id');
  if (!Array.isArray(doc.themes)) return errs.concat('themes is not an array');

  const keys = new Set();
  for (const t of doc.themes) {
    const at = (m) => E(`${t && t.id}: ${m}`);
    if (!t || !t.id) { E('theme without id'); continue; }
    if (!Array.isArray(t.stories)) { at('stories is not an array'); continue; }
    if (t.stories.length > MAX_STORIES) at(`${t.stories.length} stories, max is ${MAX_STORIES}`);

    const seenArticles = new Set();
    t.stories.forEach((s, i) => {
      const sa = (m) => E(`${t.id}#${i}: ${m}`);
      if (!s.key) sa('missing key');
      if (keys.has(s.key)) sa('duplicate story key'); else keys.add(s.key);
      if (s.rank !== i + 1) sa(`rank ${s.rank} out of order`);
      if (typeof s.title !== 'string' || s.title.length < 12 || s.title.length > TITLE_MAX + 1) sa('bad title');
      if (typeof s.summary !== 'string' || s.summary.length > SUMMARY_MAX + 1) sa('bad summary');
      if (!Number.isInteger(s.score) || s.score < 0 || s.score > 100) sa('score out of range');
      if (!Number.isInteger(s.sourceCount) || s.sourceCount < 1) sa('bad sourceCount');
      if (!Number.isFinite(s.ts)) sa('bad ts');
      if (/https?:\/\//i.test(`${s.title} ${s.summary} ${s.why || ''}`)) sa('generated text contains a URL');
      if (!Array.isArray(s.sources) || !s.sources.length) { sa('no sources'); return; }
      if (s.sourceCount > s.sources.length) sa('sourceCount above the number of sources');
      s.sources.forEach((src, k) => {
        const ss = (m) => E(`${t.id}#${i}.src${k}: ${m}`);
        if (!src.url || !/^https?:\/\//i.test(src.url)) ss('source url is not http(s)');
        if (!src.source) ss('missing source name');
        if (!Number.isFinite(src.ts)) ss('missing timestamp');
        if (seenArticles.has(src.id)) ss('article appears in two stories of the same theme');
        seenArticles.add(src.id);
      });
    });
  }
  return errs;
}

/* ════════════════════════ 6 · ARCHIVE ══════════════════════════ */
/* Prunes daily files past the detail window. Weekly/monthly rollups are
   deliberately NOT built yet — the daily files carry rank and score, so
   compaction stays a pure function of data already on disk and can be
   added later without another model call, and without changing anything
   written here. `w/` and `m/` are reserved for that. */
const DETAIL_DAYS = 30;
function pruneDays(todayISO) {
  if (!existsSync(DAY_DIR)) return [];
  const cut = Date.parse(todayISO + 'T00:00:00Z') - DETAIL_DAYS * 86400000;
  const kept = [];
  for (const f of readdirSync(DAY_DIR)) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    if (Date.parse(m[1] + 'T00:00:00Z') < cut) { try { rmSync(join(DAY_DIR, f)); console.log(`  · pruned ${f} (older than ${DETAIL_DAYS} days)`); } catch {} }
    else kept.push(m[1]);
  }
  return kept.sort().reverse();
}

/* ════════════════════════ MAIN ═════════════════════════════════ */
function writeJSON(path, obj) {
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj));
  renameSync(tmp, path);
}

async function main() {
  /* ── --check: validate what is already committed, touch nothing ── */
  if (CHECK_ONLY) {
    const p = join(OUT_DIR, 'latest.json');
    if (!existsSync(p)) { console.log('No curated/latest.json yet — nothing to check.'); return 0; }
    const errs = validateDay(JSON.parse(readFileSync(p, 'utf8')));
    if (errs.length) { console.error(`✗ latest.json invalid:\n  - ${errs.join('\n  - ')}`); return 1; }
    const doc = JSON.parse(readFileSync(p, 'utf8'));
    const n = doc.themes.reduce((s, t) => s + t.stories.length, 0);
    console.log(`✓ latest.json valid — ${doc.date}, ${doc.themes.length} themes, ${n} stories.`);
    return 0;
  }

  if (!GROQ_KEY && !DRY && !MOCK) {
    /* Same degradation contract as TMDB_KEY / ITAD_KEY: no key, no work,
       no damage. The V2 page keeps serving whatever was last committed. */
    console.log('GROQ_KEY not set — skipping curation, existing data untouched.');
    return 0;
  }

  const now = snapshotNow();
  const dayISO = lisbonToday();
  const lagH = ((Date.now() - now) / 3600000).toFixed(1);
  console.log(`[curated] ${dayISO} · model=${MODEL} · themes=${THEMES.length}${DRY ? ' · DRY RUN' : ''}`);
  console.log(`RSS snapshot: ${new Date(now).toISOString()} (${lagH}h old) — windows measured from there.`);

  /* ── plan ── */
  const plan = THEMES.map(theme => {
    const { arts, hours } = candidatesFor(theme, now);
    const overhead = estTok(SYSTEM) + estTok(MODE_HINT[theme.mode]) + 80;
    const chunks = arts.length >= MIN_TO_CURATE ? chunkCandidates(arts, now, overhead) : [];
    return { theme, arts, hours, chunks };
  });

  const totalReq = plan.reduce((s, p) => s + p.chunks.length, 0);
  console.log(`\nPlan: ${totalReq} requests · worst case ≈${(totalReq * (MAX_INPUT_TOK + MAX_OUTPUT_TOK) / 1000).toFixed(0)}k tokens of the 200k daily budget`);
  for (const p of plan) {
    const note = p.arts.length && !p.chunks.length ? ` — below ${MIN_TO_CURATE}, not worth a request` : '';
    console.log(`  ${p.theme.id.padEnd(14)} ${String(p.arts.length).padStart(3)} candidates (${p.hours}h) → ${p.chunks.length} request(s)${note}`);
  }
  if (DRY) { console.log('\nDry run — no API calls, no files written.'); return 0; }
  if (!totalReq) { console.log('\nNo candidates in any theme — nothing written.'); return 0; }

  /* ── curate ── */
  const themesOut = [];
  const failed = [];
  console.log('');
  for (const { theme, arts, hours, chunks } of plan) {
    if (!chunks.length) { console.log(`· ${theme.id}: ${arts.length} candidate(s) — too few to curate, skipped`); continue; }
    const byId = new Map(arts.map(a => [a.id, a]));
    let stories = [];
    let chunkFailed = 0;

    for (let c = 0; c < chunks.length; c++) {
      const label = `${theme.id}${chunks.length > 1 ? ` [${c + 1}/${chunks.length}]` : ''}`;
      try {
        const reply = MOCK ? mockReply(chunks[c]) : await groqJSON(SYSTEM, userPrompt(theme, chunks[c], now), label);
        stories.push(...materialise(reply, byId, theme, dayISO));
      } catch (e) {
        chunkFailed++;
        console.warn(`   ✗ ${label}: giving up — ${e.message}`);
        /* A rejected key fails identically for every remaining theme.
           Stop now so the run ends in seconds instead of grinding
           through 20 more doomed requests. */
        if (e.auth) { console.error('\n✗ Groq rejected the credential — aborting. Previous data left untouched.'); return 1; }
      }
    }

    if (chunkFailed === chunks.length) { failed.push(theme.id); console.warn(`✗ ${theme.id}: all requests failed — theme omitted from today`); continue; }

    /* Merge chunks deterministically: fold any story two chunks raised
       twice, then highest editorial score wins, ties broken by measured
       coverage and recency. Only then the ceiling of 5. */
    const before = stories.length;
    if (chunks.length > 1) stories = regroup(stories);
    if (stories.length < before) console.log(`   · ${theme.id}: regrouped ${before - stories.length} cross-chunk duplicate(s)`);
    stories.sort((a, b) => b.score - a.score || b.sourceCount - a.sourceCount || b.ts - a.ts);
    stories = stories.slice(0, MAX_STORIES);
    stories.forEach((s, i) => { s.rank = i + 1; });

    themesOut.push({
      id: theme.id, icon: theme.icon, pt: theme.pt, en: theme.en, mode: theme.mode,
      candidates: arts.length, windowHours: hours,
      partial: chunkFailed > 0 || undefined,
      stories,
    });
    console.log(`✓ ${theme.id.padEnd(14)} ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'} from ${arts.length} candidates`);
  }

  /* ── refuse to publish a result that is not worth publishing ── */
  const totalStories = themesOut.reduce((s, t) => s + t.stories.length, 0);
  if (!themesOut.length || !totalStories) {
    console.error('\n✗ No usable stories produced — previous data left untouched.');
    return 1;
  }
  if (failed.length > THEMES.length / 2) {
    console.error(`\n✗ ${failed.length}/${THEMES.length} themes failed — too degraded to publish. Previous data left untouched.`);
    return 1;
  }

  const doc = {
    date: dayISO,
    generated: new Date(now).toISOString(),
    model: MOCK ? 'mock' : MODEL,
    promptVersion: 1,          /* bump when SYSTEM changes, so drift is traceable */
    maxStories: MAX_STORIES,
    windowHours: WINDOW_H,
    themes: themesOut,
    failedThemes: failed.length ? failed : undefined,
  };

  /* ── validate BEFORE anything reaches disk ── */
  const errs = validateDay(doc);
  if (errs.length) {
    console.error(`\n✗ Generated data failed validation — nothing written:\n  - ${errs.slice(0, 20).join('\n  - ')}`);
    return 1;
  }

  /* ── write ── */
  mkdirSync(DAY_DIR, { recursive: true });
  writeJSON(join(DAY_DIR, `${dayISO}.json`), doc);
  writeJSON(join(OUT_DIR, 'latest.json'), doc);

  const days = pruneDays(dayISO);
  writeJSON(join(OUT_DIR, 'index.json'), {
    generated: doc.generated,
    latest: dayISO,
    model: MODEL,
    maxStories: MAX_STORIES,
    detailDays: DETAIL_DAYS,
    themes: themesOut.map(t => ({ id: t.id, icon: t.icon, pt: t.pt, en: t.en, count: t.stories.length })),
    days,                       /* daily archive, newest first */
    weeks: [],                  /* reserved: 30 days – 6 months */
    months: [],                 /* reserved: 6 – 18 months */
  });

  console.log(`\n✓ ${totalStories} stories across ${themesOut.length} themes → curated/d/${dayISO}.json + latest.json`);
  if (failed.length) console.log(`  (themes omitted after failures: ${failed.join(', ')})`);
  return 0;
}

/* Set exitCode rather than calling process.exit(): an aborted fetch may
   still be tearing its socket down, and exiting mid-teardown makes Node
   print a libuv assertion that reads like a crash in the Action log. */
main()
  .then(c => { process.exitCode = c; })
  .catch(e => { console.error('fatal:', e && e.message || e); process.exitCode = 1; });
