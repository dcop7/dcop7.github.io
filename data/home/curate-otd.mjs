/* ══════════════════════════════════════════════════════════════════
   curate-otd.mjs — editorial ranking for the three homepage sections.

   Hoje na História · Hoje em Portugal · Nasceram Hoje come out of
   otd-lib.js in an order that is essentially "has a picture, then newest
   first". That is a list, not a selection: on 23/08 it put the escape of
   a kidnapping victim and a 1973 bank robbery above the World Wide Web
   being opened to the public.

   This module asks a model to rank the candidates otd-lib already
   produced, by criteria appropriate to each section, and returns the
   same records in a better order — at most MAX_ITEMS of them.

   WHAT THE MODEL IS AND IS NOT ALLOWED TO DO

   It receives a numbered list of candidates and returns IDS AND SCORES.
   Nothing else. Every year, title, description, thumbnail and link in
   the output is the record otd-lib built from Wikimedia, passed through
   untouched — `pick()` below looks each id up and returns the ORIGINAL
   object by reference. The model cannot alter a date or invent a person
   because it never emits prose in the first place. An id that does not
   resolve is dropped.

   FAILURE IS NOT AN OUTCOME THE READER SEES
   No key, no network, a refused request, a malformed reply, or an empty
   result after validation: every one of them returns the section
   unchanged in its heuristic order. The homepage never depends on this
   module having worked. It is a re-ranking, not a data source.

   Cost: three requests a day, ~2.5k tokens each — under 8k of the
   200k/day free-tier budget, and only on the days the Action runs.
══════════════════════════════════════════════════════════════════ */

/* A CEILING, and one the sections reach very unevenly. Measured on the
   24/08 pool: História had 26 candidates of which ~20 are substantial
   (Rome sacked, Gorbachev resigns, Ukraine independent, NATO in force,
   Windows 95) so 15 is comfortably real; Nasceram Hoje had 26 with a
   clear cliff around 12; Hoje em Portugal had ELEVEN, one of which was a
   duplicate and two of which were not about Portugal — there 15 is
   unreachable, and the floor below is what stops it being padded. */
export const MAX_ITEMS = 15;
/* The model is told to use the whole 0–100 range and to leave weak
   candidates out entirely. This makes "up to 15, fewer when the material
   is thin" mechanical rather than merely requested. */
const MIN_SCORE = 50;

const MODEL = 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_OUTPUT_TOK = 700;      /* ids + scores only — no prose is ever returned */
const REQ_TIMEOUT = 60000;
const MAX_ATTEMPTS = 3;
const GAP_MS = 21000;            /* between requests: 3 × ~2.5k tok must fit 8k TPM */

const clamp = (s, n) => {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ── what "most interesting" means, per section ──────────────────── */
const SECTIONS = {
  history: {
    label: 'Hoje na História',
    what: 'world events that happened on this calendar day',
    criteria: `Rank by HISTORICAL WEIGHT:
- consequence — did the world work differently afterwards?
- scale — how many people it affected, and over how long
- lasting relevance — is it still referenced, taught or felt today
Prefer turning points over incidents. A treaty that redrew a continent, a
technology that changed daily life, the fall of a regime, a discovery that
opened a field — these outrank a single crime, a sports result, a plane
crash with no political consequence, or a routine anniversary, even when
the latter are more dramatic to read.`,
  },
  portugal: {
    label: 'Hoje em Portugal',
    what: 'events and people connected to Portugal',
    criteria: `Rank by IMPORTANCE TO PORTUGAL:
- weight in Portuguese history and how much it shaped the country
- cultural significance and how widely recognised it is here
- reach beyond a single town or a single institution
A founding moment, a change of regime, a discovery, a national figure of
the first rank outranks a local occurrence or a minor administrative act.
An item whose only link to Portugal is the Portuguese LANGUAGE, or that is
about Brazil or another lusophone country rather than Portugal, should be
scored low or left out.`,
  },
  births: {
    label: 'Nasceram Hoje',
    what: 'notable people born on this calendar day',
    criteria: `Rank by the PERSON'S IMPORTANCE:
- influence — did their work change a field, a country or an art form?
- achievement and recognition — major prizes, enduring works, records
- how widely and how long they have been known
A scientist whose work is still taught, a writer still read, a head of
state, a founder of something that outlived them, outrank someone known
mainly for appearing on television. Fame in a single country or a single
decade counts for less than lasting influence.`,
  },
};

const SYSTEM = `You are the editor of a Portuguese personal homepage. Each day you are given a list of candidates for one section and you decide which deserve to be shown and in what order.

ABSOLUTE RULES
- You return IDS AND SCORES ONLY. You never write titles, dates, descriptions or any other text. The text shown to the reader is the source material, not yours.
- Every id you return must be copied exactly from the input. Do not invent ids.
- Never reorder based on the order you received. The input order carries no meaning.

HOW MANY
Return AT MOST ${MAX_ITEMS} ids, best first. That is a ceiling, never a quota. If only 6 candidates genuinely deserve a place, return 6. If the day is thin, return fewer. Padding the list with weak entries is worse than a short list, because it pushes the good ones down and makes the section look unconsidered.

SCORING
Give each pick an integer 0–100 for how strongly it deserves its place. Use the FULL range — do not cluster everything between 70 and 80. Anything you would score below ${MIN_SCORE} should be left out rather than included with a low score.

OUTPUT
Strict JSON, no markdown fence, exactly this shape:
{"picks":[{"id":"h3","score":92},{"id":"h7","score":85}]}`;

/* ── candidate lines ──────────────────────────────────────────────
   Deliberately terse. `d` is trimmed hard: the model needs enough to
   recognise what something is, not the whole article. */
function candLine(item, id, kind) {
  const o = { i: id };
  if (item.year) o.y = item.year;
  o.t = clamp(kind === 'births' ? (item.title || item.text) : (item.text || item.title), 180);
  const d = clamp(item.extract || '', 130);
  /* Skip a description that just repeats the headline — pure token waste. */
  if (d && d.slice(0, 40) !== o.t.slice(0, 40)) o.d = d;
  return JSON.stringify(o);
}

function userPrompt(kind, items) {
  const s = SECTIONS[kind];
  return `Section: ${s.label} — ${s.what}.

${s.criteria}

Choose from the ${items.length} candidates below.

[${items.map((it, i) => candLine(it, kind[0] + i, kind)).join(',\n')}]`;
}

/* ── Groq ─────────────────────────────────────────────────────────
   A local client rather than the news one: build-curated.mjs states as a
   hard rule that nothing outside it may depend on its internals, and
   three small requests a day do not need its token bucket. */
async function ask(key, kind, items, log, pace) {
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
    try {
      const r = await fetch(GROQ_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt(kind, items) }],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: MAX_OUTPUT_TOK,
          reasoning_effort: 'low',
        }),
      });

      if (r.status === 429) {
        /* The news curator may be running against the same organisation
           budget; wait out what the server asks for rather than guessing. */
        const wait = Math.min(120, Math.ceil(Number(r.headers.get('retry-after') || 25))) * 1000;
        log(`  ⏳ ${kind}: 429 — waiting ${wait / 1000}s (${attempt}/${MAX_ATTEMPTS})`);
        await sleep(pace(wait));
        lastErr = new Error('429');
        continue;
      }
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        const err = new Error(`HTTP ${r.status} ${clamp(body, 160)}`);
        /* A 4xx will not become a 2xx by asking again. */
        if (r.status >= 400 && r.status < 500) err.fatal = true;
        throw err;
      }

      const j = await r.json();
      const tok = Number(j?.usage?.total_tokens);
      if (Number.isFinite(tok)) log(`  · ${kind}: ${tok} tokens`);
      const txt = j?.choices?.[0]?.message?.content || '';
      if (!txt.trim()) throw new Error('empty completion');
      return JSON.parse(txt);
    } catch (e) {
      lastErr = e;
      if (e.fatal) throw e;
      log(`  ! ${kind}: ${e.name === 'AbortError' ? 'timeout' : e.message} (${attempt}/${MAX_ATTEMPTS})`);
      if (attempt < MAX_ATTEMPTS) await sleep(1500 * attempt);
    } finally { clearTimeout(to); }
  }
  throw lastErr || new Error('unknown failure');
}

/* ── reply → the original records, reordered ──────────────────────
   The only thing taken from the reply is which index, in what order. */
function pick(reply, items, kind, log) {
  if (!reply || !Array.isArray(reply.picks)) throw new Error('reply has no "picks" array');

  const out = [];
  const used = new Set();
  for (const p of reply.picks) {
    const id = typeof p === 'string' ? p : (p && p.id);
    if (typeof id !== 'string') continue;
    if (id[0] !== kind[0]) continue;                       /* wrong section prefix */
    const idx = Number(id.slice(1));
    if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) {
      log(`  ! ${kind}: unknown id "${clamp(id, 12)}" — skipped`);
      continue;
    }
    if (used.has(idx)) continue;

    let score = Math.round(Number(typeof p === 'object' ? p.score : NaN));
    if (!Number.isFinite(score)) score = MIN_SCORE;        /* id without a score: keep it */
    if (score < MIN_SCORE) continue;                       /* its own judgement, applied */

    used.add(idx);
    out.push(items[idx]);                                  /* the ORIGINAL record */
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/* ── public ───────────────────────────────────────────────────────
   `sections` is what OTDLib.buildSections returned. Returns an object
   with the same keys; any section that could not be curated is absent,
   and the caller keeps its own version. Never throws. */
export async function curateSections(sections, opts = {}) {
  const key = opts.key || '';
  const log = opts.log || console.log;
  /* Every wait in this module goes through `pace`, so the tests can run
     the same code path without sitting through the real pacing. */
  const scale = opts.pace == null ? 1 : opts.pace;
  const pace = (ms) => Math.round(ms * scale);
  const out = {};
  if (!key) { log('GROQ_KEY not set — homepage sections keep their heuristic order.'); return out; }

  const kinds = Object.keys(SECTIONS).filter(k => Array.isArray(sections[k]) && sections[k].length);
  let first = true;
  for (const kind of kinds) {
    const items = sections[kind];
    /* Nothing to choose between: ranking 2 items is not worth a request. */
    if (items.length <= 3) { log(`  · ${kind}: ${items.length} candidate(s) — left as is`); continue; }
    try {
      if (!first) await sleep(pace(GAP_MS));
      first = false;
      const reply = await ask(key, kind, items, log, pace);
      const ranked = pick(reply, items, kind, log);
      if (!ranked.length) { log(`  ✗ ${kind}: nothing survived validation — keeping original order`); continue; }
      out[kind] = ranked;
      log(`  ✓ ${kind}: ${ranked.length} of ${items.length} candidates`);
    } catch (e) {
      log(`  ✗ ${kind}: ${e.message} — keeping original order`);
      if (e.fatal) { log('  (credential rejected — skipping the remaining sections)'); break; }
    }
  }
  return out;
}
