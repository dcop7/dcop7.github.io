#!/usr/bin/env node
/* Generate a large, VERIFIED geography quiz (pt-PT) from real datasets:
   - data/countries.json (bundled: continents, capital, population, area)
   - restcountries translations.por (Portuguese country names, cached)
   No facts are invented — every question is derived from these datasets.
   Run: node quizzes/tools/gen-geografia.mjs */
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = join(ROOT, 'quizzes', 'tools', '.cache-countries-pt.json');

/* PT names for all countries (cached after first online fetch). */
async function getPtNames() {
  if (existsSync(CACHE)) return JSON.parse(await readFile(CACHE, 'utf8'));
  const r = await fetch('https://restcountries.com/v3.1/all?fields=cca2,translations', { signal: AbortSignal.timeout(20000) });
  const data = await r.json();
  const map = {};
  for (const c of data) if (c.translations?.por?.common) map[c.cca2] = c.translations.por.common;
  await writeFile(CACHE, JSON.stringify(map), 'utf8');
  return map;
}

const CONT_PT = { 'Africa':'África', 'Asia':'Ásia', 'Europe':'Europa', 'North America':'América do Norte', 'South America':'América do Sul', 'Oceania':'Oceânia', 'Antarctica':'Antárctida' };
const ALL_CONT = ['África','Ásia','Europa','América do Norte','América do Sul','Oceânia'];

/* Curated PT capital names (accurate) keyed by cca2 — only these get capital Qs. */
const CAP = {
  PT:'Lisboa',ES:'Madrid',FR:'Paris',GB:'Londres',DE:'Berlim',IT:'Roma',NL:'Amesterdão',BE:'Bruxelas',
  CH:'Berna',AT:'Viena',SE:'Estocolmo',NO:'Oslo',DK:'Copenhaga',FI:'Helsínquia',PL:'Varsóvia',GR:'Atenas',
  IE:'Dublin',CZ:'Praga',HU:'Budapeste',RO:'Bucareste',RU:'Moscovo',UA:'Kiev',TR:'Ancara',HR:'Zagrebe',
  US:'Washington, D.C.',CA:'Otava',MX:'Cidade do México',BR:'Brasília',AR:'Buenos Aires',CL:'Santiago',
  CO:'Bogotá',PE:'Lima',VE:'Caracas',CU:'Havana',UY:'Montevideu',CN:'Pequim',JP:'Tóquio',KR:'Seul',
  IN:'Nova Deli',ID:'Jacarta',SA:'Riade',IR:'Teerão',IQ:'Bagdade',IL:'Jerusalém',PK:'Islamabade',
  TH:'Banguecoque',VN:'Hanói',PH:'Manila',MY:'Kuala Lumpur',SG:'Singapura',EG:'Cairo',NG:'Abuja',
  ZA:'Pretória',KE:'Nairóbi',ET:'Adis Abeba',GH:'Acra',MA:'Rabat',AO:'Luanda',MZ:'Maputo',SN:'Dacar',
  AU:'Camberra',NZ:'Wellington',IS:'Reiquiavique',LU:'Luxemburgo',
};

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function opts4(correct, pool){ const d=shuffle(pool.filter(x=>x!==correct)).slice(0,3); return shuffle([correct,...d]); }

const ptNames = await getPtNames();
const countries = JSON.parse(await readFile(join(ROOT,'data','countries.json'),'utf8'));

/* index for population tiering & name lookups */
const withPt = countries.filter(c => ptNames[c.cca2] && c.continents && c.continents[0]);
withPt.sort((a,b) => (b.population||0) - (a.population||0));
const tierOf = (i, n) => i < n*0.3 ? 'easy' : i < n*0.7 ? 'medium' : 'hard';

const out = { easy: [], medium: [], hard: [] };
const capNames = Object.values(CAP);

/* 1) Continent of each country (all, tiered by population) */
withPt.forEach((c, i) => {
  const name = ptNames[c.cca2];
  const cont = CONT_PT[c.continents[0]];
  if (!cont) return;
  out[tierOf(i, withPt.length)].push({
    q: `Em que continente se localiza ${name}?`, a: cont, opts: opts4(cont, ALL_CONT),
    exp: `${name} fica em ${cont}.`,
  });
});

/* 2) Capital of country (curated PT capitals) */
Object.entries(CAP).forEach(([cca2, cap], i) => {
  const name = ptNames[cca2]; if (!name) return;
  const tier = i < 28 ? 'easy' : 'medium';
  out[tier].push({
    q: `Qual é a capital de ${name}?`, a: cap, opts: opts4(cap, capNames),
    exp: `A capital de ${name} é ${cap}.`,
  });
});

/* 3) Reverse: which country has capital X (adds variety) */
Object.entries(CAP).forEach(([cca2, cap], i) => {
  const name = ptNames[cca2]; if (!name) return;
  const allNames = Object.keys(CAP).map(k => ptNames[k]).filter(Boolean);
  out[i < 20 ? 'medium' : 'hard'].push({
    q: `De que país é capital a cidade de ${cap}?`, a: name, opts: opts4(name, allNames),
    exp: `${cap} é a capital de ${name}.`,
  });
});

/* 4) "Qual destes tem MAIOR população?" — 4 country options, verified by data.
   Well-known countries → easy; mixed → medium; obscure → hard. */
const popList = withPt.filter(c => c.population > 0);
function sampleDistinct(arr, n, exclude) {
  const pool = shuffle(arr.filter(x => x !== exclude));
  return pool.slice(0, n);
}
function regionTier(i, n) { return tierOf(i, n); }
for (let i = 0; i < 90; i++) {
  const group = sampleDistinct(popList, 4);
  if (group.length < 4) break;
  const win = group.reduce((a, b) => (a.population >= b.population ? a : b));
  const names = group.map(c => ptNames[c.cca2]);
  const a = ptNames[win.cca2];
  const tier = i < 30 ? 'easy' : i < 65 ? 'medium' : 'hard';
  out[tier].push({
    q: 'Qual destes países tem maior população?', a, opts: shuffle(names),
    exp: `${a} tem a maior população dos quatro (${win.population.toLocaleString('pt')} hab.).`,
  });
}

/* 5) "Qual destes é o MAIOR em área?" */
const areaList = withPt.filter(c => c.area > 0);
for (let i = 0; i < 70; i++) {
  const group = sampleDistinct(areaList, 4);
  if (group.length < 4) break;
  const win = group.reduce((a, b) => (a.area >= b.area ? a : b));
  const names = group.map(c => ptNames[c.cca2]);
  const a = ptNames[win.cca2];
  const tier = i < 24 ? 'easy' : i < 50 ? 'medium' : 'hard';
  out[tier].push({
    q: 'Qual destes países tem maior área?', a, opts: shuffle(names),
    exp: `${a} é o maior em área dos quatro (${win.area.toLocaleString('pt')} km²).`,
  });
}

/* 6) "Qual destes países fica em <região>?" — 1 in region, 3 outside */
const byCont = {};
for (const c of withPt) { const k = CONT_PT[c.continents[0]]; if (k) (byCont[k] = byCont[k] || []).push(c); }
const conts = Object.keys(byCont).filter(k => byCont[k].length >= 1);
for (let i = 0; i < 60; i++) {
  const cont = conts[i % conts.length];
  const inside = sampleDistinct(byCont[cont], 1)[0];
  const outside = sampleDistinct(withPt.filter(c => CONT_PT[c.continents[0]] !== cont), 3);
  if (!inside || outside.length < 3) continue;
  const a = ptNames[inside.cca2];
  const opts = shuffle([a, ...outside.map(c => ptNames[c.cca2])]);
  const tier = i < 20 ? 'easy' : i < 42 ? 'medium' : 'hard';
  out[tier].push({
    q: `Qual destes países se localiza em ${cont}?`, a, opts,
    exp: `${a} fica em ${cont}.`,
  });
}

/* 7) "Com quantos países faz fronteira X?" — numeric, verified by borders[] */
const borderList = withPt.filter(c => Array.isArray(c.borders));
for (let i = 0; i < 50; i++) {
  const c = borderList[(i * 7) % borderList.length];
  if (!c) continue;
  const n = c.borders.length;
  const cand = [n, n + 1, n + 2, Math.max(0, n - 1), Math.max(0, n - 2), n + 3];
  const opts = [...new Set(cand)].slice(0, 4);
  while (opts.length < 4) { const x = Math.floor(Math.random() * 12); if (!opts.includes(x)) opts.push(x); }
  const a = String(n);
  const tier = i < 16 ? 'easy' : i < 35 ? 'medium' : 'hard';
  out[tier].push({
    q: `Com quantos países faz fronteira terrestre ${ptNames[c.cca2]}?`,
    a, opts: shuffle(opts.map(String)),
    exp: `${ptNames[c.cca2]} faz fronteira com ${n} ${n === 1 ? 'país' : 'países'}.`,
  });
}

for (const tier of ['easy','medium','hard']) {
  await writeFile(join(ROOT,'quizzes',tier,'geografia.json'), JSON.stringify(out[tier], null, 2) + '\n', 'utf8');
  console.log(`  wrote ${tier}/geografia.json — ${out[tier].length} entries`);
}
console.log(`Total geography questions: ${out.easy.length + out.medium.length + out.hard.length}`);
