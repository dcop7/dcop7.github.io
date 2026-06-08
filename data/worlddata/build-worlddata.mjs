/* ──────────────────────────────────────────────────────────────────────
   Build the "Dados do Mundo" datasets from Our World in Data (CC BY 4.0).
   Produces (small, offline, in-repo):
     data/worlddata/indicators.json   metadata + world min/max per indicator
     data/worlddata/values.json       latest value per entity per indicator
     data/worlddata/series/<id>.json  full yearly series per entity (lazy)
   Entities kept: countries (ISO3) + World + the six continents.
   Run:  node data/worlddata/build-worlddata.mjs
────────────────────────────────────────────────────────────────────────── */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SERIES_DIR = path.join(OUT, 'series');
fs.mkdirSync(SERIES_DIR, { recursive: true });

/* id, slug, pt, en, unit, decimals, emoji, cat, dir(+1 higher better / -1 lower better / 0 neutral) */
const IND = [
  { id:'life',        slug:'life-expectancy',                                      pt:'Esperança de vida',           en:'Life expectancy',         unit:'anos',     unitEn:'years',     dec:1, emoji:'🧬', cat:'saude',     dir:1 },
  { id:'gdppc',       slug:'gdp-per-capita-worldbank',                             pt:'PIB per capita',              en:'GDP per capita',          unit:'$ (PPC)',  unitEn:'$ (PPP)',   dec:0, emoji:'💰', cat:'economia',  dir:1 },
  { id:'hdi',         slug:'human-development-index',                              pt:'Desenvolvimento Humano (IDH)',en:'Human Development Index', unit:'índice',   unitEn:'index',     dec:3, emoji:'📈', cat:'sociedade', dir:1 },
  { id:'happiness',   slug:'happiness-cantril-ladder',                             pt:'Felicidade',                  en:'Happiness',               unit:'0–10',     unitEn:'0–10',      dec:2, emoji:'😀', cat:'sociedade', dir:1 },
  { id:'internet',    slug:'share-of-individuals-using-the-internet',              pt:'Utilizadores de Internet',    en:'Internet users',          unit:'%',        unitEn:'%',         dec:1, emoji:'🌐', cat:'tecnologia',dir:1 },
  { id:'schooling',   slug:'mean-years-of-schooling-long-run',                     pt:'Anos de escolaridade',        en:'Years of schooling',      unit:'anos',     unitEn:'years',     dec:1, emoji:'🎓', cat:'educacao',  dir:1 },
  { id:'doctors',     slug:'physicians-per-1000-people',                           pt:'Médicos (por 1000 hab.)',     en:'Physicians (per 1000)',   unit:'/1000',    unitEn:'/1000',     dec:2, emoji:'🩺', cat:'saude',     dir:1 },
  { id:'electricity', slug:'share-of-the-population-with-access-to-electricity',   pt:'Acesso a eletricidade',       en:'Access to electricity',   unit:'%',        unitEn:'%',         dec:1, emoji:'💡', cat:'infra',     dir:1 },
  { id:'co2',         slug:'co-emissions-per-capita',                              pt:'Emissões de CO₂ per capita',  en:'CO₂ emissions per capita',unit:'t',        unitEn:'t',         dec:2, emoji:'🏭', cat:'ambiente',  dir:-1 },
  { id:'medage',      slug:'median-age',                                           pt:'Idade mediana',               en:'Median age',              unit:'anos',     unitEn:'years',     dec:1, emoji:'👥', cat:'demografia',dir:0 },
  { id:'fertility',   slug:'children-born-per-woman',                              pt:'Filhos por mulher',           en:'Children per woman',      unit:'',         unitEn:'',          dec:2, emoji:'👶', cat:'demografia',dir:0 },
  { id:'urban',       slug:'share-of-population-urban',                            pt:'População urbana',            en:'Urban population',        unit:'%',        unitEn:'%',         dec:1, emoji:'🏙️', cat:'demografia',dir:0 },
  { id:'population',  slug:'population',                                           pt:'População',                   en:'Population',              unit:'',         unitEn:'',          dec:0, emoji:'🧑‍🤝‍🧑', cat:'demografia',dir:0 },
  { id:'density',     slug:'population-density',                                   pt:'Densidade populacional',      en:'Population density',      unit:'hab/km²',  unitEn:'/km²',      dec:1, emoji:'📍', cat:'demografia',dir:0 },
];

const SPECIALS = { 'World':'WORLD', 'Africa':'Africa', 'Asia':'Asia', 'Europe':'Europe',
                   'North America':'North America', 'South America':'South America', 'Oceania':'Oceania' };

function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
    i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const round = (v, d) => { const m = 10 ** d; return Math.round(v * m) / m; };
const NOW = new Date().getFullYear();

const values = {};     // { indId: { key: {v, y} } }
const indicatorsOut = [];

for (const ind of IND) {
  const url = `https://ourworldindata.org/grapher/${ind.slug}.csv?csvType=full&useColumnShortNames=true`;
  process.stdout.write(`${ind.id} … `);
  let text;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    text = await r.text();
  } catch (e) { console.log('FAIL', e.message); continue; }

  const rows = parseCSV(text);
  const header = rows[0];
  const valCol = 3;                              // entity,code,year,<value>,...
  const series = {};                             // key -> [[year, value], ...]
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length <= valCol) continue;
    const entity = row[0], code = row[1], year = parseInt(row[2], 10);
    let raw = row[valCol];
    if (raw === '' || raw == null) continue;
    const v = parseFloat(raw);
    if (!isFinite(v) || !isFinite(year)) continue;
    if (year > NOW) continue;                       // drop future projections
    let key = null;
    if (/^[A-Z]{3}$/.test(code) && code !== 'OWID') key = code;       // a country
    else if (SPECIALS[entity]) key = SPECIALS[entity];               // World / continent
    if (!key) continue;
    (series[key] = series[key] || []).push([year, round(v, ind.dec)]);
  }
  // sort each series by year; compute latest
  let minV = Infinity, maxV = -Infinity, latestYear = 0;
  for (const k of Object.keys(series)) {
    series[k].sort((a, b) => a[0] - b[0]);
    const last = series[k][series[k].length - 1];
    values[ind.id] = values[ind.id] || {};
    values[ind.id][k] = { v: last[1], y: last[0] };
    if (/^[A-Z]{3}$/.test(k)) {                 // world scale from countries only
      if (last[1] < minV) minV = last[1];
      if (last[1] > maxV) maxV = last[1];
    }
    if (last[0] > latestYear) latestYear = last[0];
  }
  fs.writeFileSync(path.join(SERIES_DIR, ind.id + '.json'), JSON.stringify(series));
  indicatorsOut.push({ ...ind, min: round(minV, ind.dec), max: round(maxV, ind.dec), latestYear,
                       countries: Object.keys(series).filter(k => /^[A-Z]{3}$/.test(k)).length });
  console.log(`ok (${Object.keys(series).length} entities, latest ${latestYear})`);
}

fs.writeFileSync(path.join(OUT, 'indicators.json'), JSON.stringify(indicatorsOut, null, 1));
fs.writeFileSync(path.join(OUT, 'values.json'), JSON.stringify(values));
const sz = p => (fs.statSync(p).size / 1024).toFixed(0) + 'KB';
console.log('\nWROTE indicators.json', sz(path.join(OUT, 'indicators.json')),
            '| values.json', sz(path.join(OUT, 'values.json')),
            '| series files', fs.readdirSync(SERIES_DIR).length);
