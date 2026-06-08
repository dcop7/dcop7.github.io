/* Build a compact cities dataset from GeoNames cities15000 (CC BY 4.0).
   Keeps: every Portuguese city + the largest world cities. Fields kept small.
   Input:  C:/tmp/geonames/cities15000.txt  (tab-separated GeoNames dump)
   Output: data/worlddata/cities.json
   Run:    node data/worlddata/build-cities.mjs */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SRC = 'C:/tmp/geonames/cities15000.txt';
const ROOT = path.resolve(OUT, '..', '..');
const C = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'countries.json'), 'utf8'));
const iso2to3 = {}, nameOf = {}, namePtOf = {};
C.forEach(c => { iso2to3[c.cca2] = c.cca3; nameOf[c.cca3] = c.name.common; namePtOf[c.cca3] = c.namePt || c.name.common; });

const lines = fs.readFileSync(SRC, 'utf8').split('\n');
const all = [];
for (const ln of lines) {
  if (!ln) continue;
  const f = ln.split('\t');
  const name = f[1], lat = parseFloat(f[4]), lon = parseFloat(f[5]), cc = f[8], pop = parseInt(f[14], 10) || 0;
  if (!name || !cc || !isFinite(lat)) continue;
  const iso3 = iso2to3[cc];
  if (!iso3) continue;
  all.push({ name, cc, iso3, lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000, pop });
}
// keep: all PT cities + global cities with pop >= 1,000,000, then cap global to top 320
const pt = all.filter(c => c.cc === 'PT').sort((a, b) => b.pop - a.pop);
const big = all.filter(c => c.cc !== 'PT' && c.pop >= 1_000_000).sort((a, b) => b.pop - a.pop).slice(0, 320);
const kept = [...big, ...pt];
// de-dup by name+cc, keep most populous
const seen = new Map();
for (const c of kept.sort((a, b) => b.pop - a.pop)) { const k = c.cc + '|' + c.name.toLowerCase(); if (!seen.has(k)) seen.set(k, c); }
const out = [...seen.values()].sort((a, b) => b.pop - a.pop)
  .map((c, i) => ({ id: 'c' + i, name: c.name, cc: c.cc, iso3: c.iso3, lat: c.lat, lon: c.lon, pop: c.pop }));

fs.writeFileSync(path.join(OUT, 'cities.json'), JSON.stringify(out));
console.log('cities kept:', out.length, '| PT:', out.filter(c => c.cc === 'PT').length,
  '| has Leiria:', out.some(c => /leiria/i.test(c.name)),
  '| size', (fs.statSync(path.join(OUT, 'cities.json')).size / 1024).toFixed(0) + 'KB');
