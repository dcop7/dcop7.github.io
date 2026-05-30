#!/usr/bin/env node
/* Generate the monuments quiz from LOCALLY DOWNLOADED images
   (quizzes/assets/monuments). Only monuments whose image exists are emitted,
   so every entry shows a real photo. Questions are text-answerable (country
   or Portuguese city). Run: node quizzes/tools/gen-monuments.mjs */
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MON = join(ROOT, 'quizzes', 'assets', 'monuments');
const manifest = JSON.parse(await readFile(join(ROOT, 'quizzes', 'assets', 'manifest.json'), 'utf8'));

const EASY = new Set(['torre-eiffel','coliseu','taj-mahal','estatua-liberdade','big-ben','cristo-redentor','machu-picchu','piramide-queops','torre-belem']);
const HARD = new Set(['convento-cristo','bom-jesus','aqueduto-aguas-livres','mosteiro-batalha','torre-clerigos','esfinge','versalhes','atomium']);

const PT_CITIES = ['Lisboa','Porto','Sintra','Braga','Coimbra','Tomar','Batalha','Guimarães','Évora','Faro'];

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function parsePlace(p){const parts=p.split(',').map(s=>s.trim());return parts.length>1?{city:parts[0],country:parts[parts.length-1]}:{city:null,country:parts[0]};}

const items = manifest.monuments.items.filter(it => existsSync(join(MON, `${it.slug}.jpg`)));
const countries = [...new Set(items.map(it => parsePlace(it.place).country))];

const out = { easy: [], medium: [], hard: [] };
for (const it of items) {
  const { city, country } = parsePlace(it.place);
  const tier = EASY.has(it.slug) ? 'easy' : HARD.has(it.slug) ? 'hard' : 'medium';
  let q, a, pool;
  if (country === 'Portugal' && city) {
    q = `Em que cidade portuguesa se encontra ${it.name}?`; a = city; pool = PT_CITIES;
  } else {
    q = `Em que país se encontra ${it.name}?`; a = country; pool = countries;
  }
  const distractors = shuffle(pool.filter(x => x !== a)).slice(0, 3);
  if (distractors.length < 3) continue; // need 3 plausible distractors
  out[tier].push({
    q, a, opts: shuffle([a, ...distractors]),
    exp: `${it.name} encontra-se em ${it.place}.`,
    imgType: 'img', img: `quizzes/assets/monuments/${it.slug}.jpg`, imgCredit: 'Wikimedia Commons',
  });
}

for (const tier of ['easy','medium','hard']) {
  await writeFile(join(ROOT, 'quizzes', tier, 'monumentos.json'), JSON.stringify(out[tier], null, 2) + '\n', 'utf8');
  console.log(`  wrote ${tier}/monumentos.json — ${out[tier].length} entries`);
}
console.log(`Total monuments with verified local images: ${items.length}`);
