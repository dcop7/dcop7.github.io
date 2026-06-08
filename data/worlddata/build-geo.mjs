/* Build a compact, higher-resolution world map for the data explorer from
   Natural Earth 50m (public domain). Keeps only {iso, name} + geometry, with
   coordinates rounded to 2 decimals (~1 km) to stay small.
   Input:  C:/tmp/ne50.geojson   Output: data/worlddata/world-50m.geojson
   Run:    node data/worlddata/build-geo.mjs */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const g = JSON.parse(fs.readFileSync('C:/tmp/ne50.geojson', 'utf8'));
const r = n => Math.round(n * 100) / 100;
const roundRing = ring => ring.map(([x, y]) => [r(x), r(y)]);
const roundGeom = geom => {
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates.map(roundRing) };
  if (geom.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geom.coordinates.map(p => p.map(roundRing)) };
  return geom;
};
const feats = [];
for (const f of g.features) {
  const p = f.properties;
  let iso = (p.ISO_A3 && p.ISO_A3 !== '-99') ? p.ISO_A3 : (p.ADM0_A3 || p.ISO_A3_EH);
  if (!iso || iso === '-99') continue;
  if (p.NAME === 'Antarctica') continue;
  feats.push({ type: 'Feature', properties: { iso, name: p.NAME }, geometry: roundGeom(f.geometry) });
}
fs.writeFileSync(path.join(OUT, 'world-50m.geojson'), JSON.stringify({ type: 'FeatureCollection', features: feats }));
console.log('features', feats.length, '| size', (fs.statSync(path.join(OUT, 'world-50m.geojson')).size / 1024).toFixed(0) + 'KB');
