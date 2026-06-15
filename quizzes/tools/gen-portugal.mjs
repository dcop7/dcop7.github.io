#!/usr/bin/env node
/* Generate a large, VERIFIED Portugal quiz from the district dataset that
   already lives in explorer-portugal.js (single source of truth — extracted,
   not duplicated). Question types: region of a district, municipality count,
   and "in which district is <landmark>?" / "which district is <dish>/<tradition>
   from?" — using only entries that map to exactly ONE district (ambiguous ones
   are skipped so every answer is unambiguous). Merges idempotently with the
   hand-authored portugal.json (dedupe by question). Run:
   node quizzes/tools/gen-portugal.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* Extract the DISTRICTS array literal from explorer-portugal.js and eval it. */
const src = await readFile(join(ROOT, 'explorer-portugal.js'), 'utf8');
const m = src.match(/const DISTRICTS = (\[[\s\S]*?\n {2}\]);/);
if (!m) { console.error('DISTRICTS array not found'); process.exit(1); }
const DISTRICTS = eval(m[1]);

const NAMES = DISTRICTS.map(d => d.name);
const REGIONS = [...new Set(DISTRICTS.map(d => d.region))];
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function opts4(c, pool){ const d=shuffle(pool.filter(x=>x!==c)).slice(0,3); return shuffle([c,...d]); }

const out = { easy: [], medium: [], hard: [] };

/* Build value → [districts] maps; keep only unambiguous (single-district) values. */
function uniqueMap(field) {
  const map = {};
  for (const d of DISTRICTS) for (const v of (d[field] || [])) (map[v] = map[v] || new Set()).add(d.name);
  return Object.entries(map).filter(([, set]) => set.size === 1).map(([v, set]) => [v, [...set][0]]);
}

/* 1) Region of each district */
for (const d of DISTRICTS) {
  out.medium.push({ q: `A que região pertence o distrito de ${d.name}?`, a: d.region,
    opts: opts4(d.region, REGIONS), exp: `O distrito de ${d.name} pertence à região ${d.region}.` });
}

/* 2) Municipality (concelho) count */
for (const d of DISTRICTS) {
  const n = d.munic;
  const cand = [...new Set([n, n+1, n-1, n+2, n-2, n+3])].filter(x => x > 0);
  const opts = shuffle(cand).slice(0, 4);
  while (opts.length < 4) { const x = n + (Math.floor(Math.random()*9)-4); if (x>0 && !opts.includes(x)) opts.push(x); }
  if (!opts.includes(n)) opts[0] = n;
  out.hard.push({ q: `Quantos concelhos tem o distrito de ${d.name}?`, a: String(n),
    opts: shuffle(opts.map(String)), exp: `O distrito de ${d.name} tem ${n} concelhos.` });
}

/* 3) Landmarks → district (famous = easy, rest = medium) */
const FAMOUS = /Ria de Aveiro|Torre|Mosteiro|Universidade de Coimbra|Santuário|Castelo|Sé |Ponte|Serra da Estrela|Bom Jesus/i;
for (const [landmark, dist] of uniqueMap('landmarks')) {
  out[FAMOUS.test(landmark) ? 'easy' : 'medium'].push({
    q: `Em que distrito se encontra: ${landmark}?`, a: dist, opts: opts4(dist, NAMES),
    exp: `${landmark} fica no distrito de ${dist}.` });
}

/* 4) Gastronomy → district */
for (const [dish, dist] of uniqueMap('food')) {
  out.medium.push({ q: `De que distrito é típico o prato/produto: ${dish}?`, a: dist, opts: opts4(dist, NAMES),
    exp: `${dish} é típico do distrito de ${dist}.` });
}

/* 5) Traditions → district */
for (const [trad, dist] of uniqueMap('traditions')) {
  out.hard.push({ q: `A que distrito está associada a tradição: ${trad}?`, a: dist, opts: opts4(dist, NAMES),
    exp: `${trad} está associada ao distrito de ${dist}.` });
}

/* 6) Island capitals (non-trivial, unlike mainland where capital == district name) */
for (const d of DISTRICTS.filter(x => x.capital !== x.name)) {
  out.medium.push({ q: `Qual é a capital de ${d.name}?`, a: d.capital,
    opts: opts4(d.capital, ['Funchal','Ponta Delgada','Angra do Heroísmo','Horta','Câmara de Lobos','Machico']),
    exp: `A capital de ${d.name} é ${d.capital}.` });
}

/* Merge with existing hand-authored portugal.json (dedupe by question text). */
let total = 0;
for (const tier of ['easy','medium','hard']) {
  const p = join(ROOT, 'quizzes', 'portugal', 'pt', `${tier}.json`);
  let existing = [];
  try { existing = JSON.parse(await readFile(p, 'utf8')); } catch (e) {}
  const seen = new Set(existing.map(x => x.q));
  const merged = existing.concat(out[tier].filter(x => !seen.has(x.q)));
  total += merged.length;
  await writeFile(p, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`  ${tier}/portugal.json — ${existing.length} + ${merged.length - existing.length} generated = ${merged.length}`);
}
console.log(`Total Portugal questions: ${total}`);
