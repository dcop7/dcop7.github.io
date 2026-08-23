/* ══════════════════════════════════════════════════════════════════
   acquire.test.mjs — contract tests for the shared acquisition layer.

     node data/news/acquire.test.mjs        (exit 0 = pass)

   Offline: `fetch` is stubbed, so nothing is requested and no key is
   needed. What is pinned down here is the behaviour that is otherwise
   only observable in production:

     1. The RESOLVER CHAIN order, and that each strategy is only reached
        when the ones before it produced nothing.
     2. The SEARCH FALLBACK (strategy 4) — that it is last, that every
        way it can fail leaves the source exactly as it was before the
        fallback existed, and that it never accepts an off-domain or
        undated result.
     3. That the CACHE keys per source, not per site — seven MakeUseOf
        sections and five TLDR newsletters share one site, and a
        site-keyed cache silently collapsed them into one feed.
══════════════════════════════════════════════════════════════════ */
import { rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, 'sources-resolved.json');
/* Tests must not inherit or leave a resolver cache. */
const hadCache = existsSync(CACHE);
let saved = null;
if (hadCache) saved = (await import('node:fs')).readFileSync(CACHE, 'utf8');
rmSync(CACHE, { force: true });

const realFetch = globalThis.fetch;
let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};

const RSS = (n, host = 'example.org') => `<rss><channel>${
  Array.from({ length: n }, (_, i) =>
    `<item><title>Item ${i}</title><link>https://${host}/a${i}</link><pubDate>${new Date(Date.now() - i * 3600e3).toUTCString()}</pubDate></item>`
  ).join('')}</channel></rss>`;

/* `routes` maps a URL substring to a response spec. Anything unmatched
   404s, which is how "this strategy found nothing" is expressed. */
function stub(routes) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    calls.push(u);
    for (const [frag, spec] of routes) {
      if (!u.includes(frag)) continue;
      if (spec instanceof Error) throw spec;
      if (typeof spec === 'number') return { ok: false, status: spec, url: u, text: async () => '', json: async () => ({}) };
      return {
        ok: true, status: 200, url: u,
        headers: { get: (h) => (opts && opts.headers && opts.headers[h]) || null },
        text: async () => (typeof spec === 'string' ? spec : JSON.stringify(spec)),
        json: async () => (typeof spec === 'string' ? JSON.parse(spec) : spec),
      };
    }
    return { ok: false, status: 404, url: u, text: async () => '', json: async () => ({}) };
  };
  return calls;
}
const fresh = async () => {
  rmSync(CACHE, { force: true });
  return (await import(`./acquire.mjs?t=${Date.now()}${Math.random()}`));
};

/* ── 1 · chain order ─────────────────────────────────────────────── */
console.log('\n1 · resolver chain');
{
  const { acquire } = await fresh();
  const calls = stub([['/feed', RSS(3)]]);
  const { report } = await acquire([{ name: 'A', site: 'https://example.org', feed: 'https://example.org/feed' }]);
  check('a working feed stops the chain', report[0].via === 'known feed' && report[0].count === 3, report[0].via);
  check('the homepage is never fetched when the feed works', !calls.some(u => u === 'https://example.org'));
}
{
  const { acquire } = await fresh();
  /* Order matters: routes match by substring, so the bare origin must be
     listed last or it shadows every path under it. */
  stub([
    ['/oldfeed', 500],
    ['/new.xml', RSS(4)],
    ['https://example.org', '<link rel="alternate" type="application/rss+xml" href="/new.xml">'],
  ]);
  const { report } = await acquire([{ name: 'B', site: 'https://example.org', feed: 'https://example.org/oldfeed' }]);
  check('a dead feed falls through to autodiscovery', report[0].via === 'autodiscovery' && report[0].count === 4, report[0].via);
}

/* ── 2 · search fallback ─────────────────────────────────────────── */
console.log('\n2 · search fallback (strategy 4)');
const NEWS = (rows) => ({ results: rows });
const blocked = { name: 'Blocked', site: 'https://blocked.example', feed: 'https://blocked.example/feed' };

{
  delete process.env.TINYFISH_KEY;
  const { acquire } = await fresh();
  const calls = stub([]);
  const { report } = await acquire([blocked]);
  check('no key → reported none, exactly as before', report[0].via === 'none' && report[0].count === 0, report[0].via);
  check('no key → the search API is never called', !calls.some(u => u.includes('tinyfish')));
}
{
  process.env.TINYFISH_KEY = 'test-key';
  const { acquire } = await fresh();
  const calls = stub([['api.search.tinyfish.ai', NEWS([
    { title: 'Real story', url: 'https://blocked.example/x', snippet: 's', date: new Date().toISOString() },
  ])]]);
  const { report } = await acquire([blocked]);
  check('key present + all else failed → search recovers the source', report[0].via === 'search' && report[0].count === 1, report[0].via);
  const q = calls.find(u => u.includes('tinyfish')) || '';
  check('query is domain-restricted, news, time-boxed',
    q.includes('include_domains=blocked.example') && q.includes('domain_type=news') && q.includes('recency_minutes='), q);
}
{
  /* Search must never run when an earlier strategy worked — that is what
     keeps it a floor under blocked sources rather than a second opinion. */
  process.env.TINYFISH_KEY = 'test-key';
  const { acquire } = await fresh();
  const calls = stub([['/feed', RSS(2)], ['api.search.tinyfish.ai', NEWS([{ title: 'x', url: 'https://example.org/y', date: new Date().toISOString() }])]]);
  const { report } = await acquire([{ name: 'C', site: 'https://example.org', feed: 'https://example.org/feed' }]);
  check('a working feed means search is never called', report[0].via === 'known feed' && !calls.some(u => u.includes('tinyfish')));
}

console.log('\n3 · search results are not trusted blindly');
const badRows = [
  ['off-domain result', [{ title: 'Elsewhere', url: 'https://other.example/x', date: new Date().toISOString() }]],
  ['undated result', [{ title: 'No date', url: 'https://blocked.example/x' }]],
  ['unparseable date', [{ title: 'Bad date', url: 'https://blocked.example/x', date: 'sometime' }]],
  ['missing url', [{ title: 'No url', date: new Date().toISOString() }]],
  ['empty results', []],
];
for (const [name, rows] of badRows) {
  process.env.TINYFISH_KEY = 'test-key';
  const { acquire } = await fresh();
  stub([['api.search.tinyfish.ai', NEWS(rows)]]);
  const { report } = await acquire([blocked]);
  check(`${name} → rejected, source stays none`, report[0].via === 'none' && report[0].count === 0, report[0].via);
}
for (const [name, spec] of [['HTTP 500', 500], ['HTTP 401', 401], ['network error', new Error('ECONNREFUSED')]]) {
  process.env.TINYFISH_KEY = 'test-key';
  const { acquire } = await fresh();
  stub([['api.search.tinyfish.ai', spec]]);
  const { report } = await acquire([blocked]);
  check(`${name} → falls back cleanly`, report[0].via === 'none' && report[0].count === 0, report[0].via);
}

/* ── 4 · cache keys per source, not per site ─────────────────────── */
console.log('\n4 · cache identity');
{
  process.env.TINYFISH_KEY = '';
  const { acquire } = await fresh();
  stub([['/rss/it', RSS(3, 'tldr.tech')], ['/rss/tech', RSS(5, 'tldr.tech')]]);
  const { report } = await acquire([
    { name: 'TLDR IT',   site: 'https://tldr.tech', feed: 'https://tldr.tech/api/rss/it' },
    { name: 'TLDR Tech', site: 'https://tldr.tech', feed: 'https://tldr.tech/api/rss/tech' },
  ], { concurrency: 1 });
  const it = report.find(r => r.name === 'TLDR IT'), tech = report.find(r => r.name === 'TLDR Tech');
  check('two sources sharing a site keep separate feeds', it.count === 3 && tech.count === 5, `${it.count}/${tech.count}`);
  check('each keeps its own feed url', it.feed !== tech.feed, `${it.feed} vs ${tech.feed}`);
}

globalThis.fetch = realFetch;
rmSync(CACHE, { force: true });
if (hadCache && saved) (await import('node:fs')).writeFileSync(CACHE, saved);
console.log(`\n${fail === 0 ? '✓ all cases pass' : `✗ ${fail} failure(s)`} (${pass}/${pass + fail})`);
process.exitCode = fail ? 1 : 0;
