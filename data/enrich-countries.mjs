#!/usr/bin/env node
/* Enrich data/countries.json with European-Portuguese names + region and
   verified GDP (World Bank). Idempotent — re-running refreshes the fields.
   Sources: restcountries translations.por (PT names), World Bank
   NY.GDP.MKTP.CD (GDP, USD). Run: node data/enrich-countries.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, 'countries.json');

const REGION_PT = { 'Africa':'África','Americas':'Américas','Asia':'Ásia','Europe':'Europa','Oceania':'Oceânia','Antarctic':'Antárctida','':'' };
const SUBREGION_PT = {
  'Northern Africa':'Norte de África','Eastern Africa':'África Oriental','Middle Africa':'África Central','Western Africa':'África Ocidental','Southern Africa':'África Austral',
  'Northern America':'América do Norte','Central America':'América Central','South America':'América do Sul','Caribbean':'Caraíbas',
  'Central Asia':'Ásia Central','Eastern Asia':'Ásia Oriental','South-Eastern Asia':'Sudeste Asiático','Southern Asia':'Ásia Meridional','Western Asia':'Ásia Ocidental',
  'Eastern Europe':'Europa de Leste','Northern Europe':'Europa do Norte','Southern Europe':'Europa do Sul','Western Europe':'Europa Ocidental','Central Europe':'Europa Central','Southeast Europe':'Sudeste Europeu',
  'Australia and New Zealand':'Austrália e Nova Zelândia','Melanesia':'Melanésia','Micronesia':'Micronésia','Polynesia':'Polinésia',
};

async function get(u) { const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }

const countries = JSON.parse(await readFile(FILE, 'utf8'));

/* PT names by cca2 */
console.log('Fetching Portuguese country names…');
const rc = await get('https://restcountries.com/v3.1/all?fields=cca2,translations');
const ptName = {};
for (const c of rc) if (c.translations?.por?.common) ptName[c.cca2] = c.translations.por.common;

/* GDP (latest available) by ISO3 — World Bank, paginated. Non-fatal: if the
   API is unavailable, PT names are still written and GDP is simply omitted. */
console.log('Fetching World Bank GDP…');
const gdp = {};
try {
  for (let page = 1; page <= 7; page++) {
    const j = await get(`https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=300&page=${page}`);
    if (!Array.isArray(j) || !j[1]) break;
    for (const row of j[1]) {
      const iso3 = row.countryiso3code;
      if (iso3 && row.value != null && gdp[iso3] == null) gdp[iso3] = row.value;
    }
    if (page >= (j[0].pages || 1)) break;
  }
} catch (e) { console.log('  (GDP fetch failed — continuing without GDP):', e.message); }

let nName = 0, nGdp = 0;
for (const c of countries) {
  if (ptName[c.cca2]) { c.namePt = ptName[c.cca2]; nName++; }
  c.regionPt = REGION_PT[c.region] ?? c.region ?? '';
  c.subregionPt = SUBREGION_PT[c.subregion] ?? c.subregion ?? '';
  if (gdp[c.cca3] != null) { c.gdp = Math.round(gdp[c.cca3]); nGdp++; }
}

await writeFile(FILE, JSON.stringify(countries) + '\n', 'utf8');
console.log(`Enriched ${countries.length} countries: ${nName} PT names, ${nGdp} GDP values.`);
