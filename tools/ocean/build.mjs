/* _src/ → data/ocean/. Grelhas Int16 (elevação em m), perfis WOA23, taxonomia
   WoRMS e estatísticas OBIS. uso: node build.mjs (depois de fetch.mjs) */
import fs from 'node:fs';
import path from 'node:path';
import { SITES, SPECIES, ZONES } from '../../js/explorer/ocean/o-content.mjs';

const SRC = path.join(import.meta.dirname, '_src');
const OUT = path.join(import.meta.dirname, '../../data/ocean');
fs.mkdirSync(OUT, { recursive: true });
const rd = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const js = f => JSON.parse(rd(f));
const R_EARTH = 6371008.8, D2R = Math.PI / 180;

/* ── grelhas ESRI ASCII do GMRT ── */
function readAsc(f) {
  const t = rd(f).split('\n');
  const h = {};
  let i = 0;
  for (; i < 6; i++) { const [k, v] = t[i].trim().split(/\s+/); h[k.toLowerCase()] = +v; }
  const v = new Float32Array(h.ncols * h.nrows);
  let k = 0;
  for (; i < t.length; i++) for (const x of t[i].trim().split(/\s+/)) if (x) v[k++] = +x;
  return { nc: h.ncols, nr: h.nrows, x0: h.xllcorner, y0: h.yllcorner, cs: h.cellsize, nd: h.nodata_value, v };
}
/* amostra bilinear em (lon, lat); linha 0 = norte */
function sampler(g) {
  return (lon, lat) => {
    const fx = (lon - g.x0) / g.cs - 0.5, fy = (g.y0 + g.nr * g.cs - lat) / g.cs - 0.5;
    const x = Math.max(0, Math.min(g.nc - 1.001, fx)), y = Math.max(0, Math.min(g.nr - 1.001, fy));
    const i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j;
    const at = (c, r) => g.v[r * g.nc + c];
    return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - b) + (at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a) * b;
  };
}
/* reamostra uma caixa geográfica numa grelha métrica nx × nz (x = este, z = sul) */
function resample(g, box, nx) {
  const latc = (box.s + box.n) / 2;
  const W = (box.e - box.w) * D2R * R_EARTH * Math.cos(latc * D2R), H = (box.n - box.s) * D2R * R_EARTH;
  const nz = Math.round(nx * H / W);
  const S = sampler(g), out = new Int16Array(nx * nz);
  let mn = 1e9, mx = -1e9, mi = 0;
  for (let r = 0; r < nz; r++) for (let c = 0; c < nx; c++) {
    const lon = box.w + (box.e - box.w) * c / (nx - 1), lat = box.n - (box.n - box.s) * r / (nz - 1);
    const e = Math.round(S(lon, lat));
    out[r * nx + c] = e;
    if (e < mn) { mn = e; mi = r * nx + c; }
    if (e > mx) mx = e;
  }
  return { nx, nz, W: Math.round(W), H: Math.round(H), min: mn, max: mx, minAt: [mi % nx, Math.floor(mi / nx)], data: out };
}

/* ── água do mar: UNESCO 1983 (Fofonoff & Millard) ── */
function atg(S, T, P) {
  const DS = S - 35;
  return (((-2.1687e-16 * T + 1.8676e-14) * T - 4.6206e-13) * P + ((2.7759e-12 * T - 1.1351e-10) * DS + ((-5.4481e-14 * T + 8.733e-12) * T - 6.7795e-10) * T + 1.8741e-8)) * P
    + (-4.2393e-8 * T + 1.8932e-6) * DS + ((6.6228e-10 * T - 6.836e-8) * T + 8.5258e-6) * T + 3.5803e-5;
}
function theta(S, T0, P0, PR) {
  let H = PR - P0, XK = H * atg(S, T0, P0), T = T0 + 0.5 * XK, Q = XK, P = P0 + 0.5 * H;
  XK = H * atg(S, T, P); T += 0.29289322 * (XK - Q); Q = 0.58578644 * XK + 0.121320344 * Q;
  XK = H * atg(S, T, P); T += 1.707106781 * (XK - Q); Q = 3.414213562 * XK - 4.121320344 * Q;
  P += 0.5 * H; XK = H * atg(S, T, P);
  return T + (XK - 2 * Q) / 6;
}
/* Saunders (1981): profundidade (m) → pressão (dbar) */
function pres(z, lat) {
  const c1 = (5.92 + 5.25 * Math.sin(lat * D2R) ** 2) * 1e-3;
  return ((1 - c1) - Math.sqrt((1 - c1) ** 2 - 8.84e-6 * z)) / 4.42e-6;
}
if (Math.abs(theta(40, 40, 10000, 0) - 36.89073) > 1e-4) throw new Error('theta UNESCO não confere');

function woa(site, k) {
  const rows = rd(`${site}-woa-${k}.csv`).trim().split('\n').slice(1).map(l => l.split(','));
  return rows.map(r => [+r[1], +r[5]]).filter(r => isFinite(r[1]));
}

const sitesOut = [];
for (const s of SITES) {
  const L = resample(readAsc(`${s.id}-local.asc`), s.local, 257);
  const Rg = resample(readAsc(`${s.id}-region.asc`), s.region, 384);
  fs.writeFileSync(path.join(OUT, `${s.id}-local.bin`), Buffer.from(L.data.buffer));
  fs.writeFileSync(path.join(OUT, `${s.id}-region.bin`), Buffer.from(Rg.data.buffer));
  /* ponto de mergulho: o mais fundo da grelha local (Marianas) ou o centro */
  const dive = s.id === 'marianas' ? L.minAt : [128, Math.round(L.nz / 2)];
  const bottom = -L.data[dive[1] * L.nx + dive[0]];
  /* perfis */
  const T = woa(s.id, 't'), Sa = woa(s.id, 's'), O = woa(s.id, 'o');
  const sAt = z => { let b = Sa[0]; for (const r of Sa) if (r[0] <= z) b = r; return b[1]; };
  const prof = T.map(([z, t]) => ({ z, t: +t.toFixed(3), s: +sAt(z).toFixed(3), o: +((O.find(r => r[0] === z) || [0, NaN])[1]).toFixed(1), p: Math.round(pres(z, s.lat)), src: 'woa' }));
  const last = prof[prof.length - 1];
  if (bottom > last.z + 50) {
    /* abaixo do último nível WOA (5 500 m): θ constante → temperatura in situ por compressão adiabática */
    const th = theta(last.s, last.t, last.p, 0);
    for (let z = Math.ceil(last.z / 250) * 250 + 250; z <= bottom + 250; z += 250) {
      const p = pres(z, s.lat);
      prof.push({ z, t: +theta(last.s, th, 0, p).toFixed(3), s: last.s, o: last.o, p: Math.round(p), src: 'calc' });
    }
    console.log(s.id, 'θ fundo WOA', th.toFixed(3), '→ in situ a', bottom, 'm =', theta(last.s, th, 0, pres(bottom, s.lat)).toFixed(2), '°C');
  }
  /* OBIS por zona */
  const obis = {};
  for (const z of ZONES) {
    const c = js(`${s.id}-obis-${z.id}.json`);
    obis[z.id] = { n: c.total, top: (c.results || []).slice(0, 8).map(r => ({ sci: r.scientificName, rec: r.records, cls: r.class || r.phylum || '' })) };
  }
  sitesOut.push({ id: s.id, bottom, pBottom: Math.round(pres(bottom, s.lat)),
    local: { nx: L.nx, nz: L.nz, W: L.W, H: L.H, min: L.min, max: L.max, dive, box: s.local },
    region: { nx: Rg.nx, nz: Rg.nz, W: Rg.W, H: Rg.H, min: Rg.min, max: Rg.max, box: s.region },
    prof, obis });
  console.log(s.id, 'fundo', bottom, 'm; local', L.W, '×', L.H, 'm', L.min, L.max, '; região', Rg.W, '×', Rg.H, Rg.min, Rg.max);
}

const taxa = {};
for (const sp of SPECIES) {
  const w = (js(`worms-${sp.id}.json`) || [])[0] || {};
  let cls = [];
  try { for (let c = js(`wormsc-${sp.id}.json`); c; c = c.child) cls.push([c.rank, c.scientificname]); } catch { /* sem classificação */ }
  cls = cls.filter(([r]) => ['Kingdom', 'Phylum', 'Class', 'Order', 'Family', 'Genus', 'Species'].includes(r)).map(c => c[1]);
  const st = js(`obis-stat-${sp.id}.json`), env = js(`obis-env-${sp.id}.json`);
  const occ = {};
  for (const s of SITES) { const f = `obis-occ-${sp.id}-${s.id}.json`; if (fs.existsSync(path.join(SRC, f))) occ[s.id] = js(f).total; }
  taxa[sp.id] = { aphia: w.valid_AphiaID || w.AphiaID, name: w.valid_name || w.scientificname, auth: w.valid_authority || w.authority, status: w.status, rank: w.rank, cls,
    obis: { rec: st.records, ds: st.datasets, yr: st.yearrange, depth: (env.depth || []).map(d => [d.from, d.records]), occ } };
}
fs.writeFileSync(path.join(OUT, 'sites.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), sites: sitesOut }));
fs.writeFileSync(path.join(OUT, 'taxa.json'), JSON.stringify(taxa));
console.log('feito');
