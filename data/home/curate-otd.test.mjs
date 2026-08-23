/* ══════════════════════════════════════════════════════════════════
   curate-otd.test.mjs — contract tests for the homepage ranking.

     node data/home/curate-otd.test.mjs        (exit 0 = pass)

   Groq is replaced by a stub, so this runs offline and costs nothing.
   What is being pinned down here is not "does it rank well" — that is a
   judgement call on live data — but the three properties the homepage
   depends on:

     1. NOTHING IS GENERATED. Every item that comes out must be the exact
        same object that went in. If a future change ever lets a model
        supply a year, a title or a link, the identity assertion below
        fails immediately.
     2. THE CEILING HOLDS, and short answers are allowed through.
     3. FAILURE IS INVISIBLE. Every way the model can misbehave leaves
        the section absent from the result, so the caller keeps its own.
══════════════════════════════════════════════════════════════════ */
import { curateSections, MAX_ITEMS } from './curate-otd.mjs';

const quiet = () => {};
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

/* Candidates carry a marker no model could reproduce, so "same object"
   can be told apart from "object that looks the same". */
const mk = (n, kind) => Array.from({ length: n }, (_, i) => ({
  year: 1900 + i,
  text: `${kind} event number ${i}`,
  title: `${kind} title ${i}`,
  extract: `description of ${kind} ${i}`,
  thumb: '', url: `https://example.org/${kind}/${i}`,
  __marker: Symbol('untouched'),
}));

const SECTIONS = () => ({ history: mk(26, 'history'), portugal: mk(26, 'portugal'), births: mk(26, 'births') });

/* Stub Groq. `plan(kind)` returns the parsed body the model would send. */
function stub(plan) {
  globalThis.fetch = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    const user = body.messages[1].content;
    const kind = user.includes('Hoje na História') ? 'history'
      : user.includes('Hoje em Portugal') ? 'portugal' : 'births';
    const reply = plan(kind, user);
    if (reply instanceof Error) throw reply;
    if (typeof reply === 'number') return { ok: false, status: reply, headers: { get: () => null }, text: async () => 'nope' };
    return {
      ok: true, status: 200, headers: { get: () => null },
      json: async () => ({ usage: { total_tokens: 1234 }, choices: [{ message: { content: JSON.stringify(reply) } }] }),
    };
  };
}
const realFetch = globalThis.fetch;

/* ── 1 · records pass through untouched ──────────────────────────── */
console.log('\n1 · nothing is generated');
{
  stub((kind) => ({ picks: [3, 1, 7, 0].map(i => ({ id: kind[0] + i, score: 90 - i })) }));
  const src = SECTIONS();
  const out = await curateSections(src, { key: 'test', log: quiet, pace: 0 });

  check('all three sections curated', Object.keys(out).length === 3, Object.keys(out).join(','));
  check('order follows the model, not the input',
    out.history.map(x => x.text).join('|') === [3, 1, 7, 0].map(i => `history event number ${i}`).join('|'));
  let identical = true;
  for (const k of ['history', 'portugal', 'births']) {
    for (const item of out[k]) if (!src[k].includes(item)) identical = false;
  }
  check('every output item is the SAME OBJECT as its input', identical);
  check('markers survive (no reconstruction)', out.births.every(x => typeof x.__marker === 'symbol'));
}

/* ── 2 · the ceiling, and short answers ──────────────────────────── */
console.log('\n2 · how many come back');
{
  stub((kind) => ({ picks: Array.from({ length: 25 }, (_, i) => ({ id: kind[0] + i, score: 95 })) }));
  const out = await curateSections(SECTIONS(), { key: 'test', log: quiet, pace: 0 });
  check(`25 picks are cut to ${MAX_ITEMS}`, out.history.length === MAX_ITEMS, String(out.history?.length));
}
{
  stub((kind) => ({ picks: [0, 1, 2, 3, 4, 5].map(i => ({ id: kind[0] + i, score: 80 })) }));
  const out = await curateSections(SECTIONS(), { key: 'test', log: quiet, pace: 0 });
  check('6 picks stay 6 (fewer than 10 is allowed)', out.history.length === 6, String(out.history?.length));
}
{
  /* Below the floor: the model said these are weak, so they are dropped
     even though that leaves the section far short of the ceiling. */
  stub((kind) => ({ picks: [{ id: kind[0] + '0', score: 88 }, { id: kind[0] + '1', score: 30 }, { id: kind[0] + '2', score: 12 }] }));
  const out = await curateSections(SECTIONS(), { key: 'test', log: quiet, pace: 0 });
  check('self-scored below the floor are dropped', out.history.length === 1, String(out.history?.length));
}
{
  const src = { history: mk(3, 'history'), portugal: [], births: mk(26, 'births') };
  stub((kind) => ({ picks: [{ id: kind[0] + '0', score: 90 }] }));
  const out = await curateSections(src, { key: 'test', log: quiet, pace: 0 });
  check('a 3-item section is not worth a request', !('history' in out));
  check('an empty section is skipped', !('portugal' in out));
}

/* ── 3 · every failure mode leaves the section alone ─────────────── */
console.log('\n3 · failure is invisible');
const bad = [
  ['hallucinated ids', () => ({ picks: [{ id: 'h999', score: 90 }, { id: 'zz1', score: 90 }] })],
  ['wrong section prefix', (k) => ({ picks: [{ id: (k === 'history' ? 'b' : 'h') + '1', score: 90 }] })],
  ['no picks array', () => ({ result: 'ok' })],
  ['picks not an array', () => ({ picks: 'h1,h2' })],
  ['everything below the floor', (k) => ({ picks: [{ id: k[0] + '0', score: 10 }] })],
  ['HTTP 500', () => 500],
  ['HTTP 401', () => 401],
  ['network error', () => new Error('ECONNREFUSED')],
];
for (const [name, plan] of bad) {
  stub(plan);
  const out = await curateSections(SECTIONS(), { key: 'test', log: quiet, pace: 0 });
  check(`${name} → section left to the caller`, !('history' in out), `got ${JSON.stringify(Object.keys(out))}`);
}
{
  const out = await curateSections(SECTIONS(), { key: '', log: quiet, pace: 0 });
  check('no key → nothing curated, no throw', Object.keys(out).length === 0);
}
{
  /* Duplicated ids must not duplicate a record on the homepage. */
  stub((kind) => ({ picks: ['0', '0', '1', '1', '2'].map(i => ({ id: kind[0] + i, score: 90 })) }));
  const out = await curateSections(SECTIONS(), { key: 'test', log: quiet, pace: 0 });
  check('repeated ids are de-duplicated', out.history.length === 3, String(out.history?.length));
}

globalThis.fetch = realFetch;
console.log(`\n${fail === 0 ? '✓ all cases pass' : `✗ ${fail} failure(s)`} (${pass}/${pass + fail})`);
process.exitCode = fail ? 1 : 0;
