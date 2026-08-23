/* ══════════════════════════════════════════════════════════════════
   rollup.mjs — weekly and monthly editions, from the daily ones.

   The point: a day you did not open is a day you lost. The archive
   picker lets you go back one day at a time, which is no help after a
   week away. Semana and Mês answer "what actually mattered while I was
   not looking".

   NO EXTRA MODEL CALLS. Every daily story already carries the score the
   model gave it, the rank it ended on, and the measured source count.
   Compaction is a pure function of files already on disk, so it costs
   nothing, is deterministic, and can be re-run over history at any time.

   HOW A STORY EARNS ITS PLACE IN A ROLLUP

   Ranking by the daily score alone would just concatenate the best
   single days. Two signals a single day cannot give you are added:

     PERSISTENCE  a story the editor kept choosing across several days was
                  not a one-morning headline. `days` counts how many
                  editions carried it, and it is the strongest boost
                  available here precisely because it is measured over
                  time rather than judged in a moment.
     COVERAGE     the union of distinct publishers across those days,
                  which grows as a story develops.

   The formula is deliberately simple and legible:

       weight = bestScore + 6·(days − 1) + 2·min(sources, 6)

   so a 78 that ran three days (78 + 12) outranks an 85 that ran once,
   and coverage breaks ties without ever dominating. Nothing here is
   tuned to a particular week; if it starts mis-ranking, change it in
   one place and re-run.

   DEDUPLICATION ACROSS DAYS
   The same event appears on consecutive days as separate stories with
   different keys. They are folded with the same entity-agreement test
   the cross-theme pass uses — shared significant words, containment,
   and ≥3 named things in common — because the failure mode is
   identical: a wrong merge silently deletes a story, so it fails
   closed. The survivor keeps the earliest date it appeared and the
   union of every publisher that covered it.
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sigWords, entities, sharedEntities } from './build-curated.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'curated');
const DAY_DIR = join(OUT_DIR, 'd');
const WEEK_DIR = join(OUT_DIR, 'w');
const MONTH_DIR = join(OUT_DIR, 'm');

/* Per theme, per rollup. Smaller than the daily ceiling on purpose: a
   week is meant to be skimmable, not exhaustive. */
export const WEEK_MAX = 10;
export const MONTH_MAX = 8;
/* A rollup of one day is just that day wearing a different label. */
const MIN_DAYS_FOR_WEEK = 2;
const MIN_DAYS_FOR_MONTH = 8;

const W_PERSIST = 6;      /* per extra day the story stayed in an edition */
const W_COVERAGE = 2;     /* per distinct publisher, capped */
const COVERAGE_CAP = 6;

/* ── ISO week helpers (Monday-based, matching Europe/Lisbon usage) ── */
export function isoWeek(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;                 /* Mon = 0 */
  d.setUTCDate(d.getUTCDate() - day + 3);              /* nearest Thursday */
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
export const monthKey = (iso) => iso.slice(0, 7);

/* Monday of the ISO week a date belongs to, and the Sunday after it. */
export function weekRange(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - day);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}

/* ── same-event test, reused from the cross-theme pass ───────────── */
const SAME = { MIN_SHARED: 3, MIN_CONTAINMENT: 0.55, MIN_ENTITIES: 3 };

function sameStory(a, b) {
  const shared = [];
  for (const x of a._w) if (b._w.has(x)) shared.push(x);
  if (shared.length < SAME.MIN_SHARED) return false;
  if (shared.length / Math.min(a._w.size, b._w.size) < SAME.MIN_CONTAINMENT) return false;

  /* Identical significant-word sets: the same headline on two days. The
     entity gate below exists because a wrong CROSS-THEME merge deletes a
     story, and two unrelated events can share a lot of vocabulary — but
     they cannot have identical word sets, since what makes them different
     is precisely the word that differs ("…da Vodafone" / "…do LinkedIn").
     A running story often keeps its exact title from one day to the next,
     and would otherwise fail the gate for lack of three named things:
     "Greve geral paralisa os transportes em Lisboa" names only Lisboa. */
  if (shared.length === a._w.size && shared.length === b._w.size) return true;

  return sharedEntities(a._e, b._e).length >= SAME.MIN_ENTITIES;
}

/* ── fold one theme's stories from several days into one list ────── */
function foldTheme(perDay) {
  const out = [];
  for (const { date, story } of perDay) {
    const s = { ...story, _w: sigWords(story.title), _e: entities(story.title),
      _days: new Set([date]), _first: date, _last: date, _best: story.score };
    const twin = out.find(o => sameStory(o, s));
    if (!twin) { out.push(s); continue; }
    /* Fold: keep the strongest telling of it, but remember the whole run. */
    twin._days.add(date);
    twin._first = twin._first < date ? twin._first : date;
    twin._last = twin._last > date ? twin._last : date;
    if (story.score > twin._best) {
      twin._best = story.score;
      twin.title = story.title; twin.summary = story.summary; twin.why = story.why;
      twin._w = s._w; twin._e = s._e;
    }
    if (!twin.image && story.image) twin.image = story.image;
    const have = new Set(twin.sources.map(x => x.id));
    for (const src of story.sources) if (!have.has(src.id)) { twin.sources.push(src); have.add(src.id); }
    twin.ts = Math.max(twin.ts, story.ts);
  }
  return out;
}

function finalise(list, cap, period) {
  for (const s of list) {
    s.days = s._days.size;
    s.sourceCount = new Set(s.sources.map(x => x.source)).size;
    s.score = s._best;
    s.weight = s._best + W_PERSIST * (s.days - 1) + W_COVERAGE * Math.min(s.sourceCount, COVERAGE_CAP);
    s.firstSeen = s._first;
    s.lastSeen = s._last;
    s.period = period;
    s.sources.sort((a, b) => b.ts - a.ts);
  }
  list.sort((a, b) => b.weight - a.weight || b.days - a.days || b.ts - a.ts);
  const kept = list.slice(0, cap);
  kept.forEach((s, i) => {
    s.rank = i + 1;
    delete s._w; delete s._e; delete s._days; delete s._first; delete s._last; delete s._best;
  });
  return kept;
}

/* ── build one rollup document from a set of daily docs ──────────── */
export function rollup(days, { id, period, from, to, cap }) {
  const themes = new Map();
  const order = [];
  for (const doc of days) {
    for (const t of doc.themes || []) {
      if (!themes.has(t.id)) {
        themes.set(t.id, { meta: { id: t.id, icon: t.icon, pt: t.pt, en: t.en, mode: t.mode }, rows: [] });
        order.push(t.id);
      }
      for (const s of t.stories || []) themes.get(t.id).rows.push({ date: doc.date, story: s });
    }
  }

  const out = [];
  for (const id2 of order) {
    const { meta, rows } = themes.get(id2);
    const folded = foldTheme(rows);
    const stories = finalise(folded, cap, period);
    if (!stories.length) continue;
    out.push({ ...meta, candidates: rows.length, stories });
  }

  return {
    id, period, from, to,
    days: days.map(d => d.date).sort(),
    generated: new Date().toISOString(),
    maxStories: cap,
    themes: out,
  };
}

/* ── read every daily file on disk ───────────────────────────────── */
function loadDays() {
  if (!existsSync(DAY_DIR)) return [];
  const out = [];
  for (const f of readdirSync(DAY_DIR)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
    try {
      const doc = JSON.parse(readFileSync(join(DAY_DIR, f), 'utf8'));
      if (doc && Array.isArray(doc.themes)) out.push(doc);
    } catch (e) { console.warn(`  ! unreadable ${f} — ${e.message}`); }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const writeJSON = (p, o) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(o)); };

/* ── public: rebuild every rollup from whatever days exist ───────── */
export function buildRollups({ log = console.log } = {}) {
  const all = loadDays();
  if (!all.length) { log('  no daily editions on disk — no rollups to build'); return { weeks: [], months: [] }; }

  const byWeek = new Map(), byMonth = new Map();
  const push = (map, key, v) => { if (!map.has(key)) map.set(key, []); map.get(key).push(v); };
  for (const d of all) { push(byWeek, isoWeek(d.date), d); push(byMonth, monthKey(d.date), d); }

  const weeks = [], months = [];
  for (const [id, days] of [...byWeek].sort()) {
    /* A "week" built from one day would mislead: it would look like a
       considered selection when it is a single edition relabelled. */
    if (days.length < MIN_DAYS_FOR_WEEK) { log(`  · ${id}: ${days.length} day(s) — too few for a weekly edition`); continue; }
    const [from, to] = weekRange(days[0].date);
    const doc = rollup(days, { id, period: 'week', from, to, cap: WEEK_MAX });
    writeJSON(join(WEEK_DIR, `${id}.json`), doc);
    weeks.push({ id, from, to, days: days.length, stories: doc.themes.reduce((n, t) => n + t.stories.length, 0) });
    log(`  ✓ ${id}  ${from}…${to}  ${days.length} days → ${weeks[weeks.length - 1].stories} stories`);
  }
  for (const [id, days] of [...byMonth].sort()) {
    if (days.length < MIN_DAYS_FOR_MONTH) { log(`  · ${id}: ${days.length} day(s) — too few for a monthly edition`); continue; }
    const doc = rollup(days, { id, period: 'month', from: `${id}-01`, to: days[days.length - 1].date, cap: MONTH_MAX });
    writeJSON(join(MONTH_DIR, `${id}.json`), doc);
    months.push({ id, days: days.length, stories: doc.themes.reduce((n, t) => n + t.stories.length, 0) });
    log(`  ✓ ${id}  ${days.length} days → ${months[months.length - 1].stories} stories`);
  }

  return { weeks: weeks.reverse(), months: months.reverse() };
}

/* Run standalone to rebuild rollups without a full curation pass. */
if (process.argv[1] && process.argv[1].endsWith('rollup.mjs')) {
  console.log('Rebuilding rollups from daily editions…');
  const r = buildRollups();
  console.log(`\n${r.weeks.length} weekly · ${r.months.length} monthly`);
}
