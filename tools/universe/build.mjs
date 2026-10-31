/* ══════════════════════════════════════════════════════════════════════
   Universo observável — construção dos dados (Node, só em desenvolvimento)

   Lê os catálogos de _src/ (ver fetch.mjs) e escreve data/universe/:
     stars.bin/.json   estrelas: CNS3 (Gliese & Jahreiß 1991) + BSC5
     exo.bin/.json     sistemas planetários (NASA Exoplanet Archive)
     mw.json           Via Láctea observada: masers (Reid+2019), enxames
                       globulares (Harris 2010), abertos (Dias+2002) e os
                       parâmetros dos braços (Reid+2019, tabela 2)
     lg.json           Grupo Local (McConnachie 2012, versão 2019)
     galaxies.json     galáxias brilhantes com nome (RC3 + distâncias)
     gal-local.bin     CfA ZCAT (Huchra+1995): o universo próximo
     sdss.bin          SDSS DR18 galáxias z<0.2 (1/3 das fibras)
     deep.bin          SDSS DR18 galáxias 0.2<z<0.8 e quasares
     clusters.json     enxames de Abell com redshift (Andernach)
     smallbody.bin     asteroides/TNO (JPL SBDB, H<15.2) — elementos
     craft.json        sondas interestelares (JPL Horizons)
     cmb.webp          WMAP 9 anos ILC (NASA/LAMBDA), equiretangular
                       em coordenadas galácticas, paleta própria

   Referencial comum: GALÁCTICO heliocêntrico (x → centro galáctico,
   y → l=90° (sentido da rotação), z → polo norte galáctico). Cada ficheiro
   usa a unidade natural da sua escala (pc, kpc, Mpc).
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';

const SRC = path.join(import.meta.dirname, '_src');
const OUT = path.join(import.meta.dirname, '../../data/universe');
fs.mkdirSync(OUT, { recursive: true });
const D2R = Math.PI / 180;
const r1 = (x, d = 1) => +(+x).toFixed(d);

/* ── J2000 equatorial → galáctico (matriz IAU, Hipparcos vol.1 §1.5.3) ── */
const EG = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [+0.4941094279, -0.4448296300, +0.7469822445],
  [-0.8676661490, -0.1980763734, +0.4559837762],
];
function eqToGal(ra, dec, d = 1) {
  const cr = Math.cos(ra * D2R), sr = Math.sin(ra * D2R), cd = Math.cos(dec * D2R), sd = Math.sin(dec * D2R);
  const x = cd * cr, y = cd * sr, z = sd;
  return [d * (EG[0][0] * x + EG[0][1] * y + EG[0][2] * z), d * (EG[1][0] * x + EG[1][1] * y + EG[1][2] * z), d * (EG[2][0] * x + EG[2][1] * y + EG[2][2] * z)];
}
function lbToGal(l, b, d) { return [d * Math.cos(b * D2R) * Math.cos(l * D2R), d * Math.cos(b * D2R) * Math.sin(l * D2R), d * Math.sin(b * D2R)]; }

/* ── cosmologia: ΛCDM plano, Planck 2018 (TT,TE,EE+lowE+lensing+BAO) ── */
const H0 = 67.66, OM = 0.3111, OL = 1 - OM, C = 299792.458, DH = C / H0;
const ZT = []; { const N = 20000, ZMAX = 12; let acc = 0, prev = 1; for (let i = 0; i <= N; i++) { const z = ZMAX * i / N; const f = 1 / Math.sqrt(OM * (1 + z) ** 3 + OL); if (i) acc += (prev + f) / 2 * (ZMAX / N); prev = f; ZT.push(acc * DH); } }
const comoving = z => { const f = Math.max(0, z) / 12 * 20000, i = Math.min(19999, Math.floor(f)); return ZT[i] + (ZT[i + 1] - ZT[i]) * (f - i); };

/* ── leitor TDAT (HEASARC) ── */
function tdat(name) {
  const txt = zlib.gunzipSync(fs.readFileSync(path.join(SRC, `heasarc_${name}.tdat.gz`))).toString('latin1');
  const cols = (txt.match(/^line\[1\] = (.*)$/m) || [])[1].trim().split(/\s+/);
  const body = txt.slice(txt.indexOf('<DATA>') + 6, txt.indexOf('<END>'));
  return body.split('\n').filter(l => l.includes('|')).map(l => {
    const f = l.split('|'), o = {};
    cols.forEach((c, i) => { o[c] = (f[i] ?? '').trim(); });
    return o;
  });
}
const num = s => (s === '' || s == null ? NaN : +s);

/* shuffle determinístico — os prefixos dos binários são subamostras uniformes */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function shuffle(a, seed) { const r = rng(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const writeBin = (f, ta) => { fs.writeFileSync(path.join(OUT, f), Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength)); console.log(f, (ta.byteLength / 1024).toFixed(0) + ' KB'); };
const writeJson = (f, o) => { const s = JSON.stringify(o); fs.writeFileSync(path.join(OUT, f), s); console.log(f, (s.length / 1024).toFixed(0) + ' KB'); };

/* ═════════════════════════ 1. ESTRELAS ═════════════════════════ */
/* Magnitude absoluta típica por tipo espectral e classe de luminosidade
   (calibração MK, Schmidt-Kaler 1982, arredondada). Só se usa quando não
   há paralaxe fiável — e a estrela fica marcada como "distância estimada". */
const MK = {
  V:   { O: [-5.7, -4.5], B: [-4.0, -0.3], A: [0.65, 2.5], F: [2.7, 4.1], G: [4.4, 5.6], K: [5.9, 8.3], M: [8.8, 13] },
  IV:  { O: [-5.5, -4.8], B: [-4.2, -1.0], A: [0.0, 1.7], F: [1.8, 2.8], G: [3.0, 3.4], K: [3.4, 3.8], M: [4, 4] },
  III: { O: [-5.8, -5.3], B: [-5.0, -1.5], A: [-0.2, 0.9], F: [1.0, 1.0], G: [0.9, 0.8], K: [0.7, -0.4], M: [-0.4, -1.0] },
  II:  { O: [-6.0, -6.0], B: [-5.5, -3.0], A: [-3.0, -2.5], F: [-2.3, -2.2], G: [-2.2, -2.2], K: [-2.3, -2.6], M: [-2.8, -3.0] },
  Ib:  { O: [-6.3, -6.3], B: [-5.8, -5.0], A: [-5.0, -4.8], F: [-4.7, -4.6], G: [-4.5, -4.4], K: [-4.4, -4.5], M: [-4.6, -5.0] },
  Ia:  { O: [-6.8, -6.8], B: [-6.6, -7.0], A: [-7.1, -7.5], F: [-7.8, -8.0], G: [-8.0, -8.0], K: [-7.5, -7.0], M: [-7.0, -7.0] },
};
function specMv(sp) {
  const m = /([OBAFGKM])(\d(?:\.\d)?)?/.exec(sp || '');
  if (!m) return NaN;
  const cls = m[1], sub = m[2] ? +m[2] : 5;
  const rest = sp.slice(m.index + m[0].length);
  const L = /^[^A-Za-z]*(Iab|Ia|Ib|III|II|IV|V|I)/.exec(rest);
  let lc = L ? L[1] : 'V';
  if (lc === 'Iab' || lc === 'I') lc = 'Ib';
  const [a, b] = MK[lc][cls];
  return a + (b - a) * sub / 9.5;
}

/* Distâncias de referência (literatura recente, anos-luz) para as estrelas
   mais conhecidas — o BSC5 tem paralaxes pré-Hipparcos e as estimativas
   espectroscópicas falham nas supergigantes. Chave: número HR. */
const KNOWN_LY = {
  2491: 8.6, 2326: 310, 5340: 36.7, 5459: 4.37, 7001: 25.0, 1708: 42.9, 1713: 860, 2943: 11.46, 472: 139,
  2061: 548, 5267: 390, 7557: 16.7, 4730: 320, 1457: 65.3, 6134: 550, 5056: 250, 2990: 33.8, 8728: 25.1,
  7924: 2600, 4853: 280, 3982: 79.3, 2891: 51, 424: 433, 1903: 2000, 1948: 1260, 1852: 1200, 1790: 250, 2004: 650,
};

function buildStars() {
  const PC_LY = 3.26156;
  const out = []; /* {ra,dec,d(pc),Mv,bv,V,name,sp,src,hr,gl} */

  /* CNS3 — estrelas a < ~25 pc com paralaxe resultante */
  for (const s of tdat('cns3')) {
    const plx = num(s.result_parallax), V = num(s.app_mag);
    if (!(plx > 0) || !isFinite(V)) continue;
    const d = 1000 / plx;
    out.push({ ra: +s.ra, dec: +s.dec, d, V, Mv: V - 5 * Math.log10(d) + 5, bv: num(s.bv_color), sp: s.spect_type, src: 'p', gl: (s.name + (s.component ? ' ' + s.component : '')).trim() });
  }
  const nC = out.length;

  /* BSC5 — todas as estrelas a olho nu */
  const grid = new Map(); const key = (ra, dec) => Math.round(ra) + ':' + Math.round(dec);
  out.forEach((s, i) => { const k = key(s.ra, s.dec); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  let merged = 0, est = 0, known = 0;
  for (const s of tdat('bsc5p')) {
    const ra = +s.ra, dec = +s.dec, V = num(s.vmag), hr = +s.hr;
    if (!isFinite(V) || !isFinite(ra)) continue;
    /* já está no CNS3? (mesma posição e brilho) → junta-lhe o nome HR */
    let twin = -1;
    for (let dra = -1; dra <= 1 && twin < 0; dra++) for (let dd = -1; dd <= 1 && twin < 0; dd++) {
      for (const i of grid.get((Math.round(ra) + dra) + ':' + (Math.round(dec) + dd)) || []) {
        const o = out[i];
        if (Math.abs(o.dec - dec) < 0.06 && Math.abs((o.ra - ra) * Math.cos(dec * D2R)) < 0.06 && Math.abs(o.V - V) < 0.6) { twin = i; break; }
      }
    }
    const name = s.alt_name || s.name;
    if (twin >= 0) { Object.assign(out[twin], { hr, bsc: name, sp: out[twin].sp || s.spect_type }); if (KNOWN_LY[hr]) { out[twin].d = KNOWN_LY[hr] / PC_LY; out[twin].src = 'k'; } merged++; continue; }
    let d, src;
    const plx = num(s.parallax);
    if (KNOWN_LY[hr]) { d = KNOWN_LY[hr] / PC_LY; src = 'k'; known++; }
    else if (plx >= 0.025 && s.par_code !== 'D') { d = 1 / plx; src = 'p'; }
    else {
      const Mv = specMv(s.spect_type);
      if (!isFinite(Mv)) continue;
      d = Math.min(3000, Math.pow(10, (V - Mv + 5) / 5)); src = 's'; est++;
    }
    out.push({ ra, dec, d, V, Mv: V - 5 * Math.log10(d) + 5, bv: num(s.bv_color), sp: s.spect_type, src, hr, bsc: name });
  }
  console.log(`estrelas: ${nC} CNS3 + ${out.length - nC} BSC5 (fundidas ${merged}, estimadas ${est}, literatura ${known})`);
  for (const hr of Object.keys(KNOWN_LY)) { const s = out.find(o => o.hr === +hr); if (!s) console.warn('  HR em falta', hr); }

  /* nomes portugueses e figuras das constelações do Céu Esta Noite */
  const sky = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../data/sky/stars.json'), 'utf8'));
  const skyMap = sky.stars.map(([ra, dec, mag]) => {
    let best = -1, bd = 1e9;
    out.forEach((o, i) => { if (!o.hr) return; const dd = Math.hypot((o.ra - ra) * Math.cos(dec * D2R), o.dec - dec); if (dd < 0.08 && Math.abs(o.V - mag) < 0.5 && dd < bd) { bd = dd; best = i; } });
    return best;
  });
  console.log('  figuras: estrelas do céu sem par', skyMap.filter(i => i < 0).length);

  /* ordem: mais brilhantes (em magnitude absoluta) primeiro → prefixo útil em telemóvel */
  const order = out.map((_, i) => i).sort((a, b) => out[a].Mv - out[b].Mv);
  const rank = new Int32Array(out.length); order.forEach((oi, ni) => { rank[oi] = ni; });
  const bin = new Float32Array(out.length * 5), meta = {};
  order.forEach((oi, ni) => {
    const s = out[oi]; const [x, y, z] = eqToGal(s.ra, s.dec, s.d);
    bin.set([x, y, z, s.Mv, isFinite(s.bv) ? s.bv : 0.65], ni * 5);
    meta[ni] = [s.bsc || s.gl || '', s.gl && s.bsc ? s.gl : '', (s.sp || '').trim(), r1(s.V, 2), s.src, s.hr || 0];
  });
  const names = {}; for (const [si, nm] of Object.entries(sky.names)) { const i = skyMap[si]; if (i >= 0) names[rank[i]] = nm; }
  const lines = {};
  for (const [c, pairs] of Object.entries(sky.lines)) {
    const L = pairs.map(([a, b]) => [skyMap[a], skyMap[b]]).filter(([a, b]) => a >= 0 && b >= 0).map(([a, b]) => [rank[a], rank[b]]);
    if (L.length) lines[c] = L;
  }
  writeBin('stars.bin', bin);
  writeJson('stars.json', { _doc: 'stars.bin: Float32 ×5 por estrela (x,y,z em pc, galáctico heliocêntrico; Mv; B−V). meta[i] = [nome, Gliese, tipo espectral, V, origem da distância p=paralaxe k=literatura s=estimativa espectroscópica, HR]', n: out.length, meta, names, lines, cons: sky.cons });
}

/* ═════════════════════════ 2. EXOPLANETAS ═════════════════════════ */
function csv(file) {
  const lines = fs.readFileSync(path.join(SRC, file), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#'));
  const head = lines.shift().split(',');
  return lines.map(l => { const f = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { f.push(cur); cur = ''; } else cur += ch; } f.push(cur); const o = {}; head.forEach((h, i) => { o[h] = f[i]; }); return o; });
}
const METHOD = { 'Transit': 'T', 'Radial Velocity': 'V', 'Imaging': 'I', 'Microlensing': 'M', 'Transit Timing Variations': 'X', 'Eclipse Timing Variations': 'E', 'Orbital Brightness Modulation': 'B', 'Pulsar Timing': 'P', 'Astrometry': 'A', 'Pulsation Timing Variations': 'Z', 'Disk Kinematics': 'D' };
function buildExo() {
  const hosts = new Map();
  for (const p of csv('exo.csv')) {
    const d = num(p.sy_dist); if (!(d > 0)) continue;
    let h = hosts.get(p.hostname);
    if (!h) hosts.set(p.hostname, h = { name: p.hostname, ra: +p.ra, dec: +p.dec, d, teff: num(p.st_teff), pl: [] });
    h.pl.push([p.pl_name.replace(p.hostname, '').trim() || p.pl_name, r1(num(p.pl_rade) || 0, 2), r1(num(p.pl_bmasse) || 0, 1), r1(num(p.pl_orbper) || 0, 2), r1(num(p.pl_orbsmax) || 0, 3), +p.disc_year || 0, METHOD[p.discoverymethod] || '?']);
  }
  const list = [...hosts.values()].sort((a, b) => a.d - b.d);
  const bin = new Float32Array(list.length * 3);
  list.forEach((h, i) => bin.set(eqToGal(h.ra, h.dec, h.d), i * 3));
  writeBin('exo.bin', bin);
  writeJson('exo.json', { _doc: 'exo.bin: Float32 ×3 (pc). hosts[i] = [estrela, Teff, distância pc, planetas[[nome, raio R⊕, massa M⊕, período d, a UA, ano, método]]]', methods: METHOD, hosts: list.map(h => [h.name, isFinite(h.teff) ? Math.round(h.teff) : 0, r1(h.d, 2), h.pl]) });
}

/* ═════════════════════════ 3. VIA LÁCTEA ═════════════════════════ */
function buildMW() {
  const R0 = 8.15; /* kpc, Reid+2019 */
  /* masers: tabela 1 do LaTeX */
  const tex = fs.readFileSync(path.join(SRC, 'reid/Reid_arXiv.tex'), 'utf8');
  const t1 = tex.slice(tex.indexOf('Parallaxes \\& Proper Motions'), tex.indexOf('\\enddata', tex.indexOf('Parallaxes \\& Proper Motions')));
  const masers = [];
  for (const row of t1.split('\n')) {
    const c = row.split('&').map(s => s.trim());
    if (c.length < 9 || !/^G\d/.test(c[0])) continue;
    const ra = c[2].split(':').map(Number), de = c[3].replace('$-$', '-').replace(/\$/g, '').split(':');
    const sgn = de[0].trim().startsWith('-') ? -1 : 1;
    const raD = (ra[0] + ra[1] / 60 + ra[2] / 3600) * 15, decD = sgn * (Math.abs(+de[0]) + +de[1] / 60 + +de[2] / 3600);
    const plx = +(/([\d.]+)\s*\\pm/.exec(c[4]) || [])[1], eplx = +(/\\pm\s*([\d.]+)/.exec(c[4]) || [])[1];
    if (!(plx > 0)) continue;
    const name = c[0].replace('$-$', '-').replace('$+$', '+').replace(/\$/g, '');
    const [x, y, z] = eqToGal(raD, decD, 1 / plx);
    masers.push([name, c[1].replace(/\\,|\$|\{|\}/g, '').trim(), r1(x, 3), r1(y, 3), r1(z, 3), c[8].trim(), r1(eplx / plx, 2)]);
  }
  console.log('masers', masers.length);

  const gcs = tdat('globclust').map(g => {
    const d = num(g.helio_distance); if (!(d > 0)) return null;
    const [x, y, z] = lbToGal(+g.lii, +g.bii, d);
    return [g.name, g.alt_name, r1(x, 2), r1(y, 2), r1(z, 2), r1(num(g.metallicity) || 0, 2), r1(num(g.abs_vmag) || 0, 2)];
  }).filter(Boolean);
  const ocs = tdat('openclust').map(o => {
    const d = num(o.distance); if (!(d > 0)) return null;
    const [x, y, z] = lbToGal(+o.lii, +o.bii, d);
    const diam = num(o.apparent_diameter);
    return [o.name, Math.round(x), Math.round(y), Math.round(z), r1(num(o.log_age) || 0, 2), isFinite(diam) ? r1(d * diam / 60 * D2R, 1) : 0];
  }).filter(Boolean);
  console.log('globulares', gcs.length, 'abertos', ocs.length);

  /* braços (tabela 2): [nome, βmin, βmax, βkink, Rkink, ψ<, ψ>, largura] */
  const arms = [
    ['3-kpc', 15, 18, 15, 3.52, -4.2, -4.2, 0.18],
    ['Norma', 5, 54, 18, 4.46, -1.0, 19.5, 0.14],
    ['Escudo-Centauro', 0, 104, 23, 4.91, 14.1, 12.1, 0.23],
    ['Sagitário-Carena', 2, 97, 24, 6.04, 17.1, 1.0, 0.27],
    ['Local', -8, 34, 9, 8.26, 11.4, 11.4, 0.31],
    ['Perseu', -23, 115, 40, 8.87, 10.3, 8.7, 0.35],
    ['Exterior', -16, 71, 18, 12.24, 3.0, 9.4, 0.65],
  ];
  writeJson('mw.json', {
    _doc: 'Galáctico heliocêntrico. masers [nome, alias, x,y,z kpc, braço, erro relativo da paralaxe] (Reid+2019 t.1); gcs [nome, alt, x,y,z kpc, [Fe/H], Mv] (Harris 2010); ocs [nome, x,y,z pc, log idade, diâmetro pc] (Dias+2002); arms (Reid+2019 t.2): ln(R/Rk) = −(β−βk)·tanψ, β a partir do Sol no sentido da rotação.',
    R0, masers, gcs, ocs, arms,
  });
}

/* ═════════════════════════ 4. GRUPO LOCAL ═════════════════════════ */
function buildLG() {
  const txt = fs.readFileSync(path.join(SRC, 'NearbyGalaxies.dat'), 'latin1').split('\n');
  const i0 = txt.findIndex(l => l.startsWith('GalaxyName'));
  const out = [];
  for (const l of txt.slice(i0 + 1)) {
    const t = l.trim().split(/\s+/); if (t.length < 30) continue;
    const name = t[0].replace(/^\*/, ''), amb = t[0].startsWith('*');
    const ra = (+t[1] + +t[2] / 60 + +t[3] / 3600) * 15;
    const sgn = t[4].startsWith('-') ? -1 : 1, dec = sgn * (Math.abs(+t[4]) + +t[5] / 60 + +t[6] / 3600);
    const mM = +t[8]; if (!(mM < 90)) continue;
    const dkpc = Math.pow(10, (mM + 5) / 5) / 1000;
    const v = x => (+x >= 999 ? null : +x);
    const vh = v(t[11]), Vmag = v(t[14]), PA = v(t[17]), e = v(t[20]), rh = v(t[26]), feh = v(t[t.length - 3]);
    const MHI = v(t[35]);
    const [x, y, z] = eqToGal(ra, dec, dkpc);
    out.push([name, r1(x, 2), r1(y, 2), r1(z, 2), r1(dkpc, 1), vh, Vmag == null ? null : r1(Vmag - mM, 2), PA, e, rh == null ? null : Math.round(dkpc * 1000 * rh / 60 * D2R), MHI, feh, amb ? 1 : 0, r1(ra, 3), r1(dec, 3)]);
  }
  console.log('Grupo Local', out.length, out.slice(0, 3).map(o => o[0] + ' ' + o[4] + ' kpc').join(', '));
  writeJson('lg.json', { _doc: 'McConnachie 2012 (AJ 144, 4), versão de out/2019. [nome, x,y,z kpc, d kpc, vh km/s, Mv, PA°, elipticidade, r_meia-luz pc, M_HI 1e6 M☉, [Fe/H], natureza ambígua, RA, Dec]', galaxies: out });
}

/* ═════════════════════════ 5. GALÁXIAS ═════════════════════════ */
const qInt16 = (v, s) => Math.max(-32767, Math.min(32767, Math.round(v / s * 32767)));
function buildGalaxies() {
  /* ZCAT: universo próximo, quase todo o céu (fora do plano galáctico) */
  const z = tdat('zcat').filter(g => { const v = num(g.radial_velocity); return v > 300 && v < 30000; });
  const S1 = 450; /* Mpc */
  const zl = shuffle(z.map(g => { const zz = num(g.radial_velocity) / C; const d = comoving(zz); return [...eqToGal(+g.ra, +g.dec, d), isFinite(num(g.morph_type)) ? num(g.morph_type) : 99]; }), 7);
  const a = new Int16Array(zl.length * 4);
  zl.forEach((g, i) => { a[i * 4] = qInt16(g[0], S1); a[i * 4 + 1] = qInt16(g[1], S1); a[i * 4 + 2] = qInt16(g[2], S1); a[i * 4 + 3] = g[3]; });
  writeBin('gal-local.bin', a);

  /* SDSS: z < 0.2 (cunha do céu norte + faixas sul) */
  const S2 = 1000;
  const near = shuffle(csv('sdss_near.csv').map(r => [+r.ra, +r.dec, +r.z]).filter(r => r[2] > 0.003), 11);
  const b = new Int16Array(near.length * 4);
  near.forEach(([ra, dec, zz], i) => { const p = eqToGal(ra, dec, comoving(zz)); b[i * 4] = qInt16(p[0], S2); b[i * 4 + 1] = qInt16(p[1], S2); b[i * 4 + 2] = qInt16(p[2], S2); b[i * 4 + 3] = Math.round(zz * 150000); });
  writeBin('sdss.bin', b);

  /* SDSS profundo: galáxias vermelhas 0.2<z<0.8 + quasares */
  const S3 = 10000;
  const far = shuffle(csv('sdss_far.csv').map(r => [+r.ra, +r.dec, +r.z]), 13);
  const qso = shuffle(csv('sdss_qso.csv').map(r => [+r.ra, +r.dec, +r.z]).filter(r => r[2] < 7.6), 17).slice(0, 90000);
  const deep = [...far, ...qso];
  const c = new Int16Array(deep.length * 4);
  deep.forEach(([ra, dec, zz], i) => { const p = eqToGal(ra, dec, comoving(zz)); c[i * 4] = qInt16(p[0], S3); c[i * 4 + 1] = qInt16(p[1], S3); c[i * 4 + 2] = qInt16(p[2], S3); c[i * 4 + 3] = Math.round(zz * 4000); });
  writeBin('deep.bin', c);
  writeJson('deep-meta.json', { nGal: far.length, nQso: qso.length });
  const zmax = Math.max(...qso.map(q => q[2]));
  console.log(`ZCAT ${zl.length}, SDSS ${near.length}, profundo ${far.length} gal + ${qso.length} QSO (z máx ${zmax.toFixed(2)} → ${comoving(zmax).toFixed(0)} Mpc)`);

  /* Abell com redshift */
  const ab = tdat('abellzcat').filter(r => num(r.redshift) > 0).map(r => { const zz = num(r.redshift); const p = eqToGal(+r.ra, +r.dec, comoving(zz)); return [r.name.replace('ABELL', 'Abell').replace(/\s+/g, ' '), r1(p[0], 1), r1(p[1], 1), r1(p[2], 1), zz, num(r.abell_richness_class) || 0]; });
  writeJson('clusters.json', { _doc: 'Enxames de Abell com redshift medido (Andernach, via HEASARC). [nome, x,y,z Mpc comóveis, z, classe de riqueza]', clusters: ab });

  /* galáxias com nome: RC3 (B_T < 12.5). Distância = redshift/Hubble (comóvel).
     As distâncias "independentes" do ZCAT (1995) estão desatualizadas para
     várias galáxias próximas (ex.: M101 3,6 Mpc em vez de 6,4), por isso não se
     usam: o explorador só mostra estas galáxias com v > 1500 km/s (onde o erro
     dos movimentos próprios fica < ~20%) ou com distância moderna curada
     (data/universe/objects.json). */
  const rc = tdat('rc3').filter(g => num(g.bt_mag) < 12.5);
  const named = [];
  for (const g of rc) {
    const v = num(g.radial_velocity) || num(g.h_21cm_radial_vel);
    if (!(v > 0)) continue;
    const d = comoving(v / C), src = 'z';
    const D25 = num(g.log_d25), R25 = num(g.log_r25);
    const diamKpc = isFinite(D25) ? d * 1000 * (Math.pow(10, D25) / 10 / 60 * D2R) : 0;
    const p = eqToGal(+g.ra, +g.dec, d);
    named.push([g.name.replace(/\s+/g, ' '), [g.alt_name_1, g.alt_name_2].filter(Boolean).join(' · '), r1(p[0], 3), r1(p[1], 3), r1(p[2], 3), r1(d, 2), src, isFinite(num(g.hubble_stage)) ? num(g.hubble_stage) : 99, r1(diamKpc, 2), isFinite(R25) ? r1(Math.pow(10, -R25), 2) : 1, num(g.position_angle) || 0, r1(num(g.bt_mag), 2), r1(+g.ra, 4), r1(+g.dec, 4), v, (g.morph_type || '').trim(), isFinite(D25) ? r1(Math.pow(10, D25) / 10, 2) : 0]);
  }
  console.log('galáxias com nome', named.length);
  writeJson('galaxies.json', { _doc: 'RC3 (de Vaucouleurs+1991) B_T<12.5. [nome, outros nomes, x,y,z Mpc, d Mpc (redshift), origem z, estádio T, diâmetro D25 kpc à distância de redshift, b/a, PA°, B_T, RA, Dec, v km/s, tipo, D25 arcmin]', galaxies: named });
}

/* ═════════════════════════ 6. CORPOS PEQUENOS ═════════════════════════ */
function buildSmall() {
  const d = JSON.parse(fs.readFileSync(path.join(SRC, 'ast.json'), 'utf8'));
  const CLS = ['MBA', 'IMB', 'OMB', 'MCA', 'AMO', 'APO', 'ATE', 'AST', 'TJN', 'CEN', 'TNO', 'HYA'];
  const keep = { MBA: 30000, OMB: 3000, IMB: 310, MCA: 465 };
  const cnt = {};
  const rows = d.data.filter(r => { const e = +r[3]; if (!(e < 0.99) || !(+r[2] > 0)) return false; const k = keep[r[10]]; cnt[r[10]] = (cnt[r[10]] || 0) + 1; return !k || cnt[r[10]] <= k; });
  const N = rows.length, epoch = +rows[0][8];
  const fa = new Float32Array(N), q = new Uint16Array(N * 5), h = new Uint8Array(N * 2);
  rows.forEach((r, i) => {
    fa[i] = +r[2];
    const ang = x => Math.round((((+x % 360) + 360) % 360) / 360 * 65535);
    q.set([Math.round(+r[3] * 65535), Math.round(+r[4] / 180 * 65535), ang(r[5]), ang(r[6]), ang(+r[7] + (epoch - +r[8]) * 0.9856076686 / Math.pow(+r[2], 1.5))], i * 5);
    h[i * 2] = Math.round(+r[9] * 10); h[i * 2 + 1] = CLS.indexOf(r[10]);
  });
  const buf = Buffer.concat([Buffer.from(fa.buffer), Buffer.from(q.buffer), Buffer.from(h.buffer)]);
  fs.writeFileSync(path.join(OUT, 'smallbody.bin'), buf);
  const tally = {}; rows.forEach(r => { tally[r[10]] = (tally[r[10]] || 0) + 1; });
  console.log('smallbody.bin', (buf.length / 1024).toFixed(0) + ' KB', N, JSON.stringify(tally));
  /* os maiores com nome (para pesquisa) */
  const big = rows.map((r, i) => [i, r[1] || r[0], +r[9], r[10]]).filter(r => r[1] && r[2] < 5.5).sort((a, b) => a[2] - b[2]).slice(0, 40);
  const craft = ['-31', '-32', '-98', '-23', '-24'].map(id => {
    const res = JSON.parse(fs.readFileSync(path.join(SRC, `hz${id}.json`), 'utf8')).result;
    const blk = res.slice(res.indexOf('$$SOE') + 5, res.indexOf('$$EOE'));
    const g = k => +(new RegExp(k + '\\s*=\\s*([-+.\\dE]+)').exec(blk) || [])[1];
    return { id, name: (/Target body name: ([^(]+)/.exec(res) || [])[1].trim(), jd: 2461041.5, pos: [g('X'), g('Y'), g('Z')], vel: [g('VX'), g('VY'), g('VZ')] };
  });
  writeJson('smallbody.json', {
    _doc: 'smallbody.bin = Float32 a[N] (UA) | Uint16 ×5 [e·65535, i/180·65535, Ω, ω, M na época]/360·65535 | Uint8 ×2 [H·10, classe]. Elementos osculadores eclípticos J2000 (JPL SBDB). craft: posição/velocidade heliocêntricas eclípticas (UA, UA/dia) da JPL Horizons.',
    n: N, epoch, classes: CLS, named: big, craft,
  });
}

/* ═════════════════════════ 7. CMB (WMAP 9 anos, ILC) ═════════════════════════ */
function spread(v) { let r = 0; for (let b = 0; b < 16; b++) r |= ((v >> b) & 1) << (2 * b); return r >>> 0; }
function ang2pixNest(nside, theta, phi) {
  const z = Math.cos(theta), za = Math.abs(z), TWO_PI = 2 * Math.PI;
  const tt = (((phi % TWO_PI) + TWO_PI) % TWO_PI) / (Math.PI / 2);
  let face, ix, iy;
  if (za <= 2 / 3) {
    const t1 = nside * (0.5 + tt), t2 = nside * z * 0.75;
    const jp = Math.floor(t1 - t2), jm = Math.floor(t1 + t2);
    const ifp = Math.floor(jp / nside), ifm = Math.floor(jm / nside);
    face = ifp === ifm ? (ifp | 4) : (ifp < ifm ? ifp : ifm + 8);
    ix = jm & (nside - 1); iy = nside - (jp & (nside - 1)) - 1;
  } else {
    const ntt = Math.min(3, Math.floor(tt)), tp = tt - ntt;
    const tmp = nside * Math.sqrt(3 * (1 - za));
    const jp = Math.min(nside - 1, Math.floor(tp * tmp)), jm = Math.min(nside - 1, Math.floor((1 - tp) * tmp));
    if (z >= 0) { face = ntt; ix = nside - jm - 1; iy = nside - jp - 1; }
    else { face = ntt + 8; ix = jp; iy = jm; }
  }
  return face * nside * nside + (spread(ix) | (spread(iy) << 1));
}
async function buildCMB() {
  const buf = fs.readFileSync(path.join(SRC, 'wmap_ilc.fits'));
  /* HDU primário + cabeçalho BINTABLE (blocos de 2880 bytes) */
  let off = 0; const hdr = () => { const cards = {}; for (;;) { const blk = buf.toString('latin1', off, off + 2880); off += 2880; let end = false; for (let i = 0; i < 36; i++) { const c = blk.slice(i * 80, i * 80 + 80); const k = c.slice(0, 8).trim(); if (k === 'END') { end = true; break; } if (c[8] === '=') cards[k] = c.slice(10).split('/')[0].trim().replace(/'/g, '').trim(); } if (end) return cards; } };
  hdr(); const h = hdr();
  const nside = +h.NSIDE, rowB = +h.NAXIS1, rows = +h.NAXIS2, form = h.TFORM1;
  const per = parseInt(form) || 1, npix = 12 * nside * nside;
  if (h.ORDERING !== 'NESTED') throw new Error('esperava NESTED, veio ' + h.ORDERING);
  const T = new Float32Array(npix);
  for (let r = 0, k = 0; r < rows; r++) for (let j = 0; j < per; j++, k++) T[k] = buf.readFloatBE(off + r * rowB + j * 4);
  console.log('WMAP', h.ORDERING, 'nside', nside, 'unidade', h.TUNIT1);
  /* equiretangular 2048×1024 em (l, b); coluna 0 = l 0°, l cresce para a direita */
  const W = 2048, H = 1024, img = Buffer.alloc(W * H * 3);
  /* paleta própria: índigo → azul-petróleo → creme → âmbar → carmim */
  const stops = [[-1, [22, 18, 70]], [-0.55, [28, 70, 140]], [-0.2, [60, 140, 170]], [0, [236, 226, 196]], [0.25, [244, 176, 74]], [0.6, [208, 82, 38]], [1, [120, 20, 30]]];
  const pal = x => { x = Math.max(-1, Math.min(1, x)); for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const t = (x - a) / (b - a); return ca.map((v, k) => v + (cb[k] - v) * t); } return stops.at(-1)[1]; };
  const LIM = 0.25; /* mK */
  for (let y = 0; y < H; y++) {
    const b = 90 - (y + 0.5) / H * 180, theta = (90 - b) * D2R;
    for (let x = 0; x < W; x++) {
      const l = (x + 0.5) / W * 360;
      const c = pal(T[ang2pixNest(nside, theta, l * D2R)] / LIM);
      img.set(c.map(Math.round), (y * W + x) * 3);
    }
  }
  await sharp(img, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 86 }).toFile(path.join(OUT, 'cmb.webp'));
  await sharp(img, { raw: { width: W, height: H, channels: 3 } }).resize(1024, 512).webp({ quality: 84 }).toFile(path.join(OUT, 'cmb-lo.webp'));
  console.log('cmb.webp', (fs.statSync(path.join(OUT, 'cmb.webp')).size / 1024).toFixed(0) + ' KB');
}

const only = process.argv[2];
const steps = { stars: buildStars, exo: buildExo, mw: buildMW, lg: buildLG, gal: buildGalaxies, small: buildSmall, cmb: buildCMB };
for (const [k, f] of Object.entries(steps)) if (!only || only === k) await f();
