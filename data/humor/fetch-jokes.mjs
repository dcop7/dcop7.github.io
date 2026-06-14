/* One-off seeder for the English-humour categories (dad jokes, nerd, puns,
   general). Pulls from public joke APIs, de-dupes, keeps it clean, and writes
   our own data/humor/<cat>.json files. PT categories are authored by hand.
   Run: node data/humor/fetch-jokes.mjs   (not part of CI — content is static) */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url, headers = {}) {
  try { const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'dcop7 humor seeder', ...headers } }); return r.ok ? await r.json() : null; }
  catch (e) { console.warn('fail', url.slice(0, 50), e.message); return null; }
}
const norm = s => (s || '').toString().replace(/\s+/g, ' ').trim();
const bad = s => /\b(sex|nazi|rape|suicide|porn|nigger|retard|f[u\*]ck|sh[i\*]t|dick|penis|cunt|abort)\b/i.test(s);

const buckets = { dadjokes: [], nerd: [], trocadilhos: [], geral: [] };
const seen = new Set();
function add(cat, obj) {
  const key = norm((obj.q || '') + (obj.a || '') + (obj.t || '')).toLowerCase();
  if (!key || seen.has(key)) return;
  if (bad(key)) return;
  seen.add(key);
  buckets[cat].push(obj);
}

/* icanhazdadjoke → dad jokes */
console.log('dad jokes…');
for (let p = 1; p <= 4; p++) {
  const d = await getJSON(`https://icanhazdadjoke.com/search?limit=30&page=${p}`);
  (d?.results || []).forEach(j => add('dadjokes', { t: norm(j.joke) }));
  await sleep(400);
}

/* JokeAPI → nerd (Programming), trocadilhos (Pun), geral (Misc) */
async function jokeApi(cat, dest, calls) {
  for (let i = 0; i < calls; i++) {
    const d = await getJSON(`https://v2.jokeapi.dev/joke/${cat}?amount=10&safe-mode&type=single,twopart&lang=en&_=${Date.now()}${i}`);
    (d?.jokes || []).forEach(j => { if (j.type === 'twopart') add(dest, { q: norm(j.setup), a: norm(j.delivery) }); else add(dest, { t: norm(j.joke) }); });
    await sleep(500);
  }
}
console.log('nerd…'); await jokeApi('Programming', 'nerd', 8);
console.log('trocadilhos (pun)…'); await jokeApi('Pun', 'trocadilhos', 8);
console.log('geral (misc)…'); await jokeApi('Misc', 'geral', 6);

/* official_joke_api → general + programming top-up */
console.log('official_joke_api…');
const off = await getJSON('https://raw.githubusercontent.com/15Dkatz/official_joke_api/master/jokes/index.json');
(off || []).forEach(j => { const dest = j.type === 'programming' ? 'nerd' : 'geral'; add(dest, { q: norm(j.setup), a: norm(j.punchline) }); });

/* write, merging with any existing hand-added items, assigning ids */
for (const cat of Object.keys(buckets)) {
  const file = join(HERE, cat + '.json');
  let existing = [];
  if (existsSync(file)) { try { existing = JSON.parse(readFileSync(file, 'utf8')); } catch (e) {} }
  const exKeys = new Set(existing.map(o => norm((o.q || '') + (o.a || '') + (o.t || '')).toLowerCase()));
  const merged = existing.concat(buckets[cat].filter(o => !exKeys.has(norm((o.q || '') + (o.a || '') + (o.t || '')).toLowerCase())));
  merged.forEach((o, i) => { o.id = cat + (i + 1); });
  writeFileSync(file, JSON.stringify(merged, null, 0));
  console.log(`  ${cat}: ${merged.length}`);
}
