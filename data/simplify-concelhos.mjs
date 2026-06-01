#!/usr/bin/env node
/* One-off: turn the full CAOP mainland concelhos GeoJSON (~36 MB, EPSG:3763
   projected metres, ~1.25M points) into a small WGS84 file the web app can ship.
   Steps: inverse Transverse Mercator (ETRS89 / PT-TM06) → lon/lat, then a
   distance-based decimation (drop points closer than ~tol degrees) plus 4-dp
   rounding. Keeps only the props the Portugal Explorer needs and tags each
   concelho with its district id.
   Source: nmota/caop_GeoJSON (CAOP — Direção-Geral do Território, open data).
   Run: node data/simplify-concelhos.mjs <raw.json> [out] [tol] */
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath = 'data/pt-concelhos.geojson', tolArg] = process.argv.slice(2);
if (!inPath) { console.error('usage: node data/simplify-concelhos.mjs <raw.json> [out] [tol]'); process.exit(1); }
const TOL = +tolArg || 0.0025;     // ~250 m min spacing between kept points

/* ── Inverse Transverse Mercator for EPSG:3763 (ETRS89 / PT-TM06) ──
   GRS80 ellipsoid; lat0=39.668258333°, lon0=-8.133108333°, k0=1,
   FE=0, FN=0. Standard inverse series. */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const a = 6378137.0, f = 1 / 298.257222101, e2 = f * (2 - f);
const k0 = 1, lat0 = 39.66825833333333 * D2R, lon0 = -8.133108333333333 * D2R, FE = 0, FN = 0;

function meridionalArc(lat) {
  const e4 = e2 * e2, e6 = e4 * e2;
  const A0 = 1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256;
  const A2 = 3 / 8 * (e2 + e4 / 4 + 15 * e6 / 128);
  const A4 = 15 / 256 * (e4 + 3 * e6 / 4);
  const A6 = 35 * e6 / 3072;
  return a * (A0 * lat - A2 * Math.sin(2 * lat) + A4 * Math.sin(4 * lat) - A6 * Math.sin(6 * lat));
}
const M0 = meridionalArc(lat0);

function inverse(E, N) {
  const M = M0 + (N - FN) / k0;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1), cos1 = Math.cos(phi1), tan1 = Math.tan(phi1);
  const ep2 = e2 / (1 - e2);
  const C1 = ep2 * cos1 ** 2;
  const T1 = tan1 ** 2;
  const N1 = a / Math.sqrt(1 - e2 * sin1 ** 2);
  const R1 = a * (1 - e2) / (1 - e2 * sin1 ** 2) ** 1.5;
  const D = (E - FE) / (N1 * k0);
  const lat = phi1 - (N1 * tan1 / R1) * (D ** 2 / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720);
  const lon = lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120) / cos1;
  return [lon * R2D, lat * R2D];
}

const r4 = n => Math.round(n * 1e4) / 1e4;

/* Reproject + decimate one ring. */
function ring(coords) {
  const out = [];
  let prev = null;
  for (let i = 0; i < coords.length; i++) {
    const [E, N] = coords[i];
    const ll = inverse(E, N);
    const p = [r4(ll[0]), r4(ll[1])];
    const isLast = i === coords.length - 1;
    if (prev && !isLast) {
      const dx = p[0] - prev[0], dy = p[1] - prev[1];
      if (dx * dx + dy * dy < TOL * TOL) continue;   // too close, skip
    }
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) { out.push(p); prev = p; }
  }
  if (out.length >= 2) { const fst = out[0], lst = out[out.length - 1]; if (fst[0] !== lst[0] || fst[1] !== lst[1]) out.push([fst[0], fst[1]]); }
  return out;
}
function simplifyGeom(geom) {
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates.map(ring).filter(rg => rg.length >= 4) };
  if (geom.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geom.coordinates.map(poly => poly.map(ring).filter(rg => rg.length >= 4)).filter(p => p.length) };
  return geom;
}

const noAccent = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const titleCase = s => (s || '').toLowerCase().replace(/(^|[\s\-'])([a-zà-ú])/g, (_, b, c) => b + c.toUpperCase());
const districtId = s => noAccent(s).toLowerCase().trim().replace(/\s+/g, '-');

let txt = readFileSync(inPath, 'utf8');
if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
const gj = JSON.parse(txt);

const out = {
  type: 'FeatureCollection',
  features: gj.features.map(ft => {
    const p = ft.properties || {};
    return {
      type: 'Feature',
      properties: {
        c:  titleCase(p.Concelho || ''),
        d:  districtId(p.Distrito || ''),
        dn: titleCase(p.Distrito || ''),
        nf: +p.N_Freguesi || null,
        ha: Math.round(+p.Area_Ha || 0),
        am: +p.ALT_MAX || null,
      },
      geometry: simplifyGeom(ft.geometry),
    };
  }),
};

const json = JSON.stringify(out);
writeFileSync(outPath, json);
let pts = 0;
out.features.forEach(ft => (function c(a) { if (typeof a[0] === 'number') { pts++; return; } a.forEach(c); })(ft.geometry.coordinates));
console.log(`concelhos: ${out.features.length} · ${(txt.length / 1e6).toFixed(1)}MB → ${(json.length / 1e6).toFixed(2)}MB · ${pts} points · sample ${out.features[0].properties.c}/${out.features[0].properties.d}`);
