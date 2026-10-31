/* ══════════════════════════════════════════════════════════════════════
   Oceano profundo — modelos procedurais dos animais.

   Todos são RECONSTRUÇÕES ILUSTRATIVAS feitas aqui em código (sem modelos
   de terceiros): proporções, cores e órgãos luminosos seguem descrições e
   fotografias científicas publicadas, mas não são digitalizações de
   exemplares. Cada geometria tem comprimento 1 no eixo x (cabeça em +x);
   a instância é escalada pelo tamanho típico da espécie.

   Atributos: color (linear), aDef (t ao longo do corpo, peso da onda
   lateral, peso do bater/pulsar), aEm (luz própria).
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, clamp, smooth, lerp, vnoise } from './o-core.mjs';
import { waterify } from './o-water.mjs';

const C = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };   /* sRGB → linear */
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const K0 = [0, 0, 0];
/* curva por pontos [t, v] com interpolação suave */
const curve = pts => t => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const a = pts[i - 1], b = pts[i], k = (t - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], k * k * (3 - 2 * k)); }
  return pts[pts.length - 1][1];
};

/* ── construtor de geometria ── */
class Builder {
  constructor() { this.P = []; this.N = []; this.Cl = []; this.D = []; this.E = []; this.I = []; }
  get n() { return this.P.length / 3; }
  add(geo, { col = [1, 1, 1], em = null, def = null } = {}) {
    const p = geo.attributes.position, nr = geo.attributes.normal, base = this.n;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      this.P.push(x, y, z); this.N.push(nr.getX(i), nr.getY(i), nr.getZ(i));
      const c = typeof col === 'function' ? col(x, y, z, i) : col; this.Cl.push(c[0], c[1], c[2]);
      const e = typeof em === 'function' ? em(x, y, z, i) : (em || K0); this.E.push(e[0], e[1], e[2]);
      const d = typeof def === 'function' ? def(x, y, z, i) : (def || [0.5 - x, 0, 0]); this.D.push(d[0], d[1], d[2]);
    }
    if (geo.index) for (const k of geo.index.array) this.I.push(base + k);
    else for (let i = 0; i < p.count; i++) this.I.push(base + i);
    geo.dispose();
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.Cl, 3));
    g.setAttribute('aEm', new THREE.Float32BufferAttribute(this.E, 3));
    g.setAttribute('aDef', new THREE.Float32BufferAttribute(this.D, 3));
    g.setIndex(this.I);
    g.computeBoundingSphere();
    return g;
  }
}

/* corpo por secções (superelipse) ao longo de x; t=0 focinho (+0.5), t=1 cauda (−0.5) */
function loft({ h, w, yc = () => 0, n = 2, nt = 44, na = 18, x0 = 0.5, x1 = -0.5 }) {
  const pos = [], idx = [];
  for (let i = 0; i <= nt; i++) {
    const t = i / nt, x = lerp(x0, x1, t), H = Math.max(h(t), 1e-4), W = Math.max(w(t), 1e-4), Y = yc(t);
    for (let j = 0; j <= na; j++) {
      const a = (j / na) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a), e = 2 / (typeof n === 'function' ? n(t, a) : n);
      pos.push(x, Y + H * Math.sign(s) * Math.pow(Math.abs(s), e), W * Math.sign(c) * Math.pow(Math.abs(c), e));
    }
  }
  for (let i = 0; i < nt; i++) for (let j = 0; j < na; j++) { const a = i * (na + 1) + j, b = a + na + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* barbatana plana a partir de um contorno 2D; plano 'xy' (vertical) ou 'xz' (horizontal) */
function fin(pts, plane = 'xy', { z = 0, y = 0, rot = 0 } = {}) {
  const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ShapeGeometry(sh, 6);
  if (plane === 'xz') g.rotateX(Math.PI / 2);
  if (rot) g.rotateX(rot);
  g.translate(0, y, z);
  return g;
}
/* tubo ao longo de pontos, raio variável */
function tube(pts, r, { seg = 24, rs = 6 } = {}) {
  const cv = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const fr = cv.computeFrenetFrames(seg, false), pos = [], idx = [], P = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg; cv.getPointAt(t, P); const R = typeof r === 'function' ? r(t) : r;
    for (let j = 0; j <= rs; j++) { const a = j / rs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(P.x + R * (c * fr.normals[i].x + s * fr.binormals[i].x), P.y + R * (c * fr.normals[i].y + s * fr.binormals[i].y), P.z + R * (c * fr.normals[i].z + s * fr.binormals[i].z)); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rs; j++) { const a = i * (rs + 1) + j, b = a + rs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.userData.tOf = i => Math.floor(i / (rs + 1)) / seg;
  return g;
}
const sphere = (c, r, ws = 10, hs = 8) => { const g = new THREE.SphereGeometry(r, ws, hs); g.translate(...c); return g; };
const cone = (c, r, h, dir = [0, 1, 0]) => { const g = new THREE.ConeGeometry(r, h, 5, 1); g.translate(0, h / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()); g.applyQuaternion(q); g.translate(...c); return g; };

/* ── peças de peixe reutilizáveis ── */
function eyes(b, { t, prof, ry = 0.3, rz = 0.85, r, iris = '#a9b4b8', dark = '#050608', up = 0 }) {
  const x = 0.5 - t, H = prof.h(t), W = prof.w(t), Y = (prof.yc ? prof.yc(t) : 0) + H * ry;
  for (const s of [-1, 1]) b.add(sphere([x, Y + up, s * W * rz], r, 12, 10), { col: (px, py, pz) => (Math.abs(pz) > W * rz + r * 0.55 ? C(dark) : C(iris)), def: [t, smooth(0.3, 1, t), 0] });
}
function fishDef(env) { return x => { const t = 0.5 - x; return [t, env(t), 0]; }; }

/* paleta e utilitários de cor */
const counter = (top, side, belly, k = 0) => (x, y) => (y > k ? mix3(side, top, smooth(k, k + 0.06, y)) : mix3(side, belly, smooth(k, k - 0.06, y)));

/* ═════════════════════ MODELOS ═════════════════════ */
const M = {};

M.tuna = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.004], [0.05, 0.055], [0.18, 0.11], [0.36, 0.13], [0.6, 0.095], [0.8, 0.035], [0.9, 0.016], [1, 0.012]]), w: curve([[0, 0.003], [0.05, 0.04], [0.2, 0.085], [0.38, 0.095], [0.62, 0.07], [0.82, 0.03], [0.92, 0.022], [1, 0.015]]) };
  const env = t => lerp(0.04, 1, Math.pow(t, 2.6));
  const col = (x, y) => { const t = 0.5 - x; const c = counter(C('#0c1e3d'), C('#7d8ea0'), C('#e6eaee'), 0.012)(x, y); return Math.abs(y - 0.01) < 0.012 && t > 0.15 && t < 0.75 ? mix3(c, C('#c9a92a'), 0.6) : c; };
  b.add(loft({ ...prof, n: 2.1 }), { col, def: fishDef(env) });
  eyes(b, { t: 0.09, prof, r: 0.017, ry: 0.15, rz: 0.75, iris: '#9aa38c' });
  const Y = '#e3c430', D = '#13213f';
  b.add(fin([[0.2, 0.12], [0.07, 0.24], [0.04, 0.12]], 'xy'), { col: C(D), def: fishDef(env) });                      /* 1.ª dorsal */
  b.add(fin([[-0.02, 0.1], [-0.13, 0.33], [-0.14, 0.08]], 'xy'), { col: C(Y), def: fishDef(env) });                   /* 2.ª dorsal em foice */
  b.add(fin([[-0.02, -0.08], [-0.13, -0.32], [-0.14, -0.07]], 'xy'), { col: C(Y), def: fishDef(env) });               /* anal */
  b.add(fin([[-0.44, 0.0], [-0.56, 0.22], [-0.52, 0.0], [-0.56, -0.22]], 'xy'), { col: C('#1b2b47'), def: fishDef(env) }); /* caudal lunada */
  for (let k = 0; k < 7; k++) { const x = -0.16 - k * 0.04, h = prof.h(0.5 - x); b.add(fin([[x + 0.012, h * 0.9], [x - 0.012, h + 0.022], [x - 0.014, h * 0.9]], 'xy'), { col: C(Y), def: fishDef(env) }); b.add(fin([[x + 0.012, -h * 0.9], [x - 0.012, -h - 0.022], [x - 0.014, -h * 0.9]], 'xy'), { col: C(Y), def: fishDef(env) }); }
  for (const s of [-1, 1]) b.add(fin([[0.32, 0], [0.12, 0.015], [0.1, -0.005]], 'xz', { y: -0.02, z: s * 0.07 }), { col: C(D), def: x => [0.5 - x, 0.2, s * 0.6] });
  return { b, deform: { lat: 0.05, k: 5.5, flap: 0.004 }, mat: { roughness: 0.32 } };
};

M.dorado = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.02], [0.03, 0.1], [0.12, 0.13], [0.35, 0.115], [0.7, 0.06], [0.88, 0.022], [1, 0.016]]), w: curve([[0, 0.01], [0.06, 0.035], [0.3, 0.045], [0.7, 0.03], [1, 0.01]]) };
  const env = t => lerp(0.08, 1, Math.pow(t, 2));
  const col = (x, y, z) => { const t = 0.5 - x; let c = y > 0.04 ? mix3(C('#2f8c7a'), C('#1a5f8e'), smooth(0.04, 0.11, y)) : mix3(C('#d9c13a'), C('#f2ecc0'), smooth(0.0, -0.08, y)); if (vnoise(t * 70, y * 70 + z * 20) > 0.8 && y > -0.04) c = mix3(c, C('#183c4a'), 0.7); return c; };
  b.add(loft({ ...prof, n: 2 }), { col, def: fishDef(env) });
  eyes(b, { t: 0.1, prof, r: 0.016, ry: -0.05, rz: 0.8 });
  b.add(fin([[0.47, 0.11], [0.3, 0.17], [-0.2, 0.12], [-0.33, 0.06], [-0.3, 0.03], [0.45, 0.08]], 'xy'), { col: C('#1d4f7a'), def: fishDef(env) });
  b.add(fin([[0.0, -0.08], [-0.15, -0.12], [-0.32, -0.05], [-0.3, -0.02]], 'xy'), { col: C('#c6b236'), def: fishDef(env) });
  b.add(fin([[-0.44, 0.0], [-0.58, 0.2], [-0.51, 0.0], [-0.58, -0.2]], 'xy'), { col: C('#bfa634'), def: fishDef(env) });
  for (const s of [-1, 1]) b.add(fin([[0.33, 0], [0.2, 0.012], [0.21, -0.01]], 'xz', { y: -0.03, z: s * 0.04 }), { col: C('#d6c24a'), def: x => [0.5 - x, 0.2, s] });
  return { b, deform: { lat: 0.05, k: 6, flap: 0.003 }, mat: { roughness: 0.3 } };
};

M.lantern = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.05], [0.06, 0.1], [0.25, 0.11], [0.6, 0.075], [0.85, 0.035], [1, 0.03]]), w: curve([[0, 0.04], [0.2, 0.06], [0.6, 0.045], [1, 0.015]]) };
  const env = t => lerp(0.1, 1, t * t);
  b.add(loft({ ...prof, n: 2.2 }), { col: counter(C('#1a2433'), C('#8b8f86'), C('#c9cdd0'), 0.0), def: fishDef(env) });
  eyes(b, { t: 0.1, prof, r: 0.045, ry: 0.15, rz: 0.55, iris: '#8fa3a8' });
  b.add(fin([[0.02, 0.1], [-0.08, 0.18], [-0.16, 0.08]], 'xy'), { col: C('#3a4450'), def: fishDef(env) });
  b.add(fin([[-0.44, 0.0], [-0.58, 0.14], [-0.52, 0.0], [-0.58, -0.14]], 'xy'), { col: C('#4b5560'), def: fishDef(env) });
  /* fotóforos: duas filas ventrais e alguns laterais — azul-esverdeado */
  const G = [0.4, 2.4, 3.2];
  for (const s of [-1, 1]) for (let k = 0; k < 13; k++) { const t = 0.12 + k * 0.06, x = 0.5 - t, H = prof.h(t), W = prof.w(t);
    b.add(sphere([x, -H * 0.82, s * W * 0.55], 0.012, 6, 5), { col: C('#d8e8ff'), em: G, def: [t, env(t), 0] });
    if (k % 3 === 1) b.add(sphere([x, -H * 0.2, s * W * 0.98], 0.011, 6, 5), { col: C('#d8e8ff'), em: G, def: [t, env(t), 0] }); }
  return { b, deform: { lat: 0.06, k: 6, flap: 0 }, mat: { roughness: 0.35 }, glow: true };
};

M.hatchet = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.06], [0.08, 0.2], [0.3, 0.3], [0.5, 0.26], [0.68, 0.07], [0.8, 0.045], [1, 0.05]]), w: curve([[0, 0.03], [0.3, 0.07], [0.6, 0.05], [1, 0.012]]), yc: curve([[0, 0.05], [0.3, -0.04], [0.55, -0.06], [0.75, 0], [1, 0]]) };
  const env = t => lerp(0.05, 1, Math.pow(t, 3));
  b.add(loft({ ...prof, n: 2.4 }), { col: (x, y) => mix3(C('#3a4a5c'), C('#dde4ea'), smooth(0.12, 0.0, y)), def: fishDef(env) });
  /* olhos tubulares virados para cima */
  for (const s of [-1, 1]) b.add(sphere([0.36, 0.17, s * 0.05], 0.05, 10, 8), { col: (px, py) => (py > 0.2 ? C('#060708') : C('#c0cad0')), def: [0.14, 0.05, 0] });
  b.add(fin([[0.1, 0.24], [-0.05, 0.3], [-0.1, 0.2]], 'xy'), { col: C('#9aa7b0'), def: fishDef(env) });
  b.add(fin([[-0.45, 0.0], [-0.58, 0.12], [-0.52, 0.0], [-0.58, -0.12]], 'xy'), { col: C('#b5bec4'), def: fishDef(env) });
  const G = [0.35, 1.3, 2.2];
  for (const s of [-1, 1]) for (let k = 0; k < 12; k++) { const t = 0.12 + k * 0.045, x = 0.5 - t, H = prof.h(t), Y = prof.yc(t);
    b.add(sphere([x, Y - H * 0.93, s * prof.w(t) * 0.45], 0.016, 6, 5), { col: C('#e8f0ff'), em: G, def: [t, env(t), 0] }); }
  return { b, deform: { lat: 0.03, k: 5, flap: 0 }, mat: { roughness: 0.18 }, glow: true };
};

M.bristle = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.02], [0.08, 0.055], [0.3, 0.06], [0.7, 0.045], [1, 0.02]]), w: curve([[0, 0.015], [0.3, 0.03], [1, 0.008]]) };
  const env = t => lerp(0.15, 1, t);
  b.add(loft({ ...prof, n: 2.2 }), { col: C('#0d0d10'), def: fishDef(env) });
  eyes(b, { t: 0.06, prof, r: 0.012, ry: 0.3, rz: 0.7 });
  b.add(fin([[-0.45, 0], [-0.57, 0.07], [-0.53, 0], [-0.57, -0.07]], 'xy'), { col: C('#1a1a1e'), def: fishDef(env) });
  for (const s of [-1, 1]) for (let k = 0; k < 14; k++) { const t = 0.1 + k * 0.055; b.add(sphere([0.5 - t, -prof.h(t) * 0.8, s * prof.w(t) * 0.6], 0.007, 5, 4), { col: C('#556'), em: [0.15, 0.8, 1.2], def: [t, env(t), 0] }); }
  return { b, deform: { lat: 0.05, k: 8, flap: 0 }, mat: { roughness: 0.6 }, glow: true };
};

M.angler = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.17], [0.08, 0.3], [0.3, 0.34], [0.55, 0.27], [0.78, 0.09], [0.9, 0.05], [1, 0.045]]), w: curve([[0, 0.18], [0.25, 0.27], [0.55, 0.2], [0.8, 0.05], [1, 0.02]]), yc: curve([[0, 0.06], [0.3, 0], [1, 0.02]]) };
  const env = t => lerp(0.02, 1, Math.pow(t, 3));
  const black = (x, y, z) => { const t = 0.5 - x; return t < 0.05 && y > -0.05 && y < 0.17 ? C('#0a0204') : mix3(C('#120d10'), C('#1e171a'), vnoise(x * 50, y * 50 + z * 30)); };
  b.add(loft({ ...prof, n: 2 }), { col: black, def: fishDef(env) });
  /* boca enorme virada para cima: interior escuro e dentes finos */
  b.add(fin([[0.5, 0.18], [0.44, 0.3], [0.38, 0.0], [0.5, -0.05]], 'xy', { z: 0 }), { col: C('#050102'), def: [0, 0, 0] });
  for (let k = 0; k < 14; k++) { const a = k / 13, z = lerp(-0.15, 0.15, a), up = Math.cos(a * Math.PI - Math.PI / 2);
    b.add(cone([0.49, -0.04 + 0.01 * up, z], 0.006, 0.05 + 0.03 * up, [0.2, 1, 0]), { col: C('#d8d0c0'), def: [0, 0, 0] });
    b.add(cone([0.46, 0.22, z * 0.85], 0.005, 0.035, [0.3, -1, 0]), { col: C('#d8d0c0'), def: [0, 0, 0] }); }
  eyes(b, { t: 0.14, prof, r: 0.02, ry: 0.55, rz: 0.55 });
  /* ilício com a isca luminosa (bactérias simbióticas) */
  b.add(tube([[0.32, 0.32, 0], [0.42, 0.43, 0], [0.55, 0.44, 0], [0.62, 0.38, 0]], t => 0.008 * (1 - t * 0.5)), { col: C('#2a2024'), def: [0, 0, 0] });
  b.add(sphere([0.63, 0.37, 0], 0.03, 10, 8), { col: C('#e9f0ea'), em: [1.2, 2.6, 2.4], def: [0, 0, 0] });
  b.add(fin([[-0.3, 0.2], [-0.4, 0.27], [-0.42, 0.12]], 'xy'), { col: C('#160f12'), def: fishDef(env) });
  b.add(fin([[-0.42, 0.02], [-0.58, 0.12], [-0.6, -0.08], [-0.42, -0.03]], 'xy'), { col: C('#160f12'), def: fishDef(env) });
  for (const s of [-1, 1]) b.add(fin([[0.05, 0], [-0.1, 0.06], [-0.1, -0.06]], 'xy', { z: s * 0.2 }), { col: C('#1a1316'), def: x => [0.5 - x, 0.3, s] });
  return { b, deform: { lat: 0.02, k: 5, flap: 0.008, flapF: 1.5 }, mat: { roughness: 0.85 }, glow: true };
};

M.gulper = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.02], [0.05, 0.045], [0.15, 0.036], [0.5, 0.018], [1, 0.003]]), w: curve([[0, 0.016], [0.1, 0.026], [0.5, 0.012], [1, 0.002]]) };
  const env = t => lerp(0.2, 1, t);
  b.add(loft({ ...prof, n: 2, nt: 90, na: 10 }), { col: (x, y, z) => mix3(C('#0d0b10'), C('#1d1820'), vnoise(x * 60, y * 90)), def: fishDef(env) });
  /* mandíbula-saco gigante */
  const jaw = [[0.45, 0.03], [0.6, 0.11], [0.7, 0.09], [0.72, -0.02], [0.62, -0.16], [0.45, -0.03]];
  for (const s of [-1, 1]) b.add(fin(jaw, 'xy', { z: s * 0.012 }), { col: (x, y) => mix3(C('#0b090d'), C('#241820'), smooth(0.62, 0.72, x)), def: [0, 0.02, 0] });
  b.add(sphere([0.47, 0.035, 0], 0.006, 6, 5), { col: C('#080808'), def: [0, 0, 0] });
  for (let k = 0; k < 24; k++) { const t = k / 23; b.add(sphere([lerp(0.47, 0.71, t), lerp(0.04, 0.1, Math.sin(t * Math.PI)) - t * 0.06, 0], 0.003, 4, 3), { col: C('#3a2a30'), def: [0, 0.02, 0] }); }
  b.add(sphere([-0.5, 0, 0], 0.01, 8, 6), { col: C('#ffb0c0'), em: [2.6, 0.6, 0.9], def: [1, 1, 0] });
  return { b, deform: { lat: 0.035, k: 13, flap: 0 }, mat: { roughness: 0.7 }, glow: true };
};

M.fangtooth = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.12], [0.1, 0.24], [0.3, 0.25], [0.6, 0.16], [0.85, 0.06], [1, 0.05]]), w: curve([[0, 0.1], [0.2, 0.15], [0.5, 0.11], [1, 0.02]]) };
  const env = t => lerp(0.05, 1, Math.pow(t, 2.5));
  b.add(loft({ ...prof, n: 2.2 }), { col: (x, y, z) => mix3(C('#1d1410'), C('#3a2a20'), vnoise(x * 40, y * 40 + z * 40)), def: fishDef(env) });
  eyes(b, { t: 0.17, prof, r: 0.022, ry: 0.4, rz: 0.75 });
  for (const s of [-1, 1]) { b.add(cone([0.47, -0.05, s * 0.05], 0.012, 0.15, [0.15, 1, 0]), { col: C('#efe7d6'), def: [0, 0, 0] }); b.add(cone([0.45, 0.06, s * 0.06], 0.009, 0.09, [0.2, -1, 0]), { col: C('#efe7d6'), def: [0, 0, 0] }); }
  b.add(fin([[-0.05, 0.2], [-0.25, 0.25], [-0.32, 0.1]], 'xy'), { col: C('#21160f'), def: fishDef(env) });
  b.add(fin([[-0.44, 0], [-0.6, 0.15], [-0.55, 0], [-0.6, -0.15]], 'xy'), { col: C('#21160f'), def: fishDef(env) });
  return { b, deform: { lat: 0.04, k: 5, flap: 0 }, mat: { roughness: 0.75 } };
};

M.grenadier = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.02], [0.06, 0.09], [0.18, 0.12], [0.35, 0.09], [0.7, 0.03], [1, 0.003]]), w: curve([[0, 0.02], [0.15, 0.1], [0.35, 0.07], [0.7, 0.02], [1, 0.002]]) };
  const env = t => lerp(0.05, 1, Math.pow(t, 1.5));
  b.add(loft({ ...prof, n: 2.2, nt: 60 }), { col: (x, y) => mix3(C('#6c6a68'), C('#a39f98'), smooth(0.06, -0.04, y)), def: fishDef(env) });
  eyes(b, { t: 0.1, prof, r: 0.04, ry: 0.25, rz: 0.6, iris: '#4b6a6a' });
  b.add(fin([[0.28, 0.1], [0.24, 0.24], [0.18, 0.11]], 'xy'), { col: C('#5a5856'), def: fishDef(env) });
  b.add(fin([[0.15, 0.09], [-0.48, 0.006], [0.12, 0.07]], 'xy'), { col: C('#6f6b66'), def: fishDef(env) });
  b.add(fin([[0.1, -0.08], [-0.49, -0.004], [0.06, -0.06]], 'xy'), { col: C('#6f6b66'), def: fishDef(env) });
  return { b, deform: { lat: 0.05, k: 7, flap: 0 }, mat: { roughness: 0.6 } };
};

M.tripod = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.02], [0.08, 0.06], [0.3, 0.07], [0.7, 0.045], [1, 0.02]]), w: curve([[0, 0.02], [0.3, 0.05], [1, 0.01]]) };
  b.add(loft({ ...prof, n: 2.3 }), { col: counter(C('#4a4744'), C('#8a857e'), C('#b2aca2'), 0), def: [0, 0, 0] });
  eyes(b, { t: 0.07, prof, r: 0.01, ry: 0.4, rz: 0.7 });
  const R = '#c9c1b3';
  for (const s of [-1, 1]) b.add(tube([[0.1, -0.06, s * 0.03], [0.02, -0.35, s * 0.1], [0.0, -0.6, s * 0.15]], 0.004, { seg: 10, rs: 4 }), { col: C(R), def: [0, 0, 0] });
  b.add(tube([[-0.48, -0.01, 0], [-0.55, -0.3, 0], [-0.56, -0.6, 0]], 0.004, { seg: 10, rs: 4 }), { col: C(R), def: [0, 0, 0] });
  for (const s of [-1, 1]) b.add(tube([[0.3, 0.02, s * 0.05], [0.6, 0.15, s * 0.2], [0.9, 0.2, s * 0.25]], 0.0025, { seg: 12, rs: 3 }), { col: C(R), def: [0, 0, 0] });
  b.add(fin([[-0.42, 0.0], [-0.54, 0.08], [-0.52, -0.06]], 'xy'), { col: C('#5b5650'), def: [0, 0, 0] });
  return { b, deform: null, mat: { roughness: 0.6 } };
};

M.snailfish = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.06], [0.08, 0.12], [0.25, 0.13], [0.55, 0.08], [0.85, 0.03], [1, 0.005]]), w: curve([[0, 0.07], [0.15, 0.12], [0.4, 0.08], [0.8, 0.03], [1, 0.004]]) };
  const env = t => lerp(0.1, 1, t);
  const pink = (x, y, z) => mix3(C('#e9c9c4'), C('#f4e6e2'), vnoise(x * 30, y * 30 + z * 20) * 0.6 + smooth(0, -0.08, y) * 0.4);
  b.add(loft({ ...prof, n: 2, nt: 50 }), { col: pink, def: fishDef(env) });
  eyes(b, { t: 0.08, prof, r: 0.018, ry: 0.35, rz: 0.75, iris: '#2a2a2e' });
  b.add(fin([[0.15, 0.11], [-0.2, 0.12], [-0.5, 0.01], [-0.3, 0.06]], 'xy'), { col: C('#ead8d4'), def: fishDef(env) });
  b.add(fin([[0.05, -0.1], [-0.25, -0.1], [-0.5, -0.01], [-0.3, -0.05]], 'xy'), { col: C('#ead8d4'), def: fishDef(env) });
  for (const s of [-1, 1]) b.add(fin([[0.32, -0.02], [0.18, 0.06], [0.1, 0.0], [0.16, -0.08]], 'xy', { z: s * 0.11 }), { col: C('#efdcd8'), def: x => [0.5 - x, 0.2, s * 0.8] });
  return { b, deform: { lat: 0.045, k: 8, flap: 0.01, flapF: 1.3 }, mat: { roughness: 0.25, transparent: true, opacity: 0.85 }, translucent: true, fresnel: true };
};

M.whale = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.07], [0.03, 0.095], [0.15, 0.105], [0.32, 0.105], [0.45, 0.11], [0.62, 0.085], [0.8, 0.045], [0.92, 0.025], [1, 0.012]]),
    w: curve([[0, 0.05], [0.04, 0.075], [0.2, 0.082], [0.42, 0.09], [0.62, 0.07], [0.8, 0.035], [0.92, 0.012], [1, 0.006]]),
    yc: curve([[0, 0.02], [0.3, 0.01], [0.6, 0.0], [1, 0.0]]) };
  const env = t => smooth(0.35, 1, t);
  const skin = (x, y, z) => { const t = 0.5 - x; const w = vnoise(t * 90, y * 40 + z * 40) * 0.5 + vnoise(t * 300, z * 200) * 0.25; let c = mix3(C('#3d3935'), C('#59534c'), w); if (y < -0.07 && t < 0.3) c = mix3(c, C('#8c877f'), 0.3); return c; };
  b.add(loft({ ...prof, n: (t) => (t < 0.32 ? 3 : 2.2), nt: 60, na: 22 }), { col: skin, def: x => [0.5 - x, 0, env(0.5 - x)] });
  /* mandíbula estreita por baixo da cabeça */
  b.add(loft({ h: curve([[0, 0.006], [0.2, 0.012], [1, 0.015]]), w: curve([[0, 0.008], [0.3, 0.02], [1, 0.03]]), x0: 0.46, x1: 0.2, nt: 12, na: 10 }).translate(0, -0.09, 0), { col: C('#a29c92'), def: [0.1, 0, 0] });
  for (let k = 0; k < 8; k++) b.add(cone([0.43 - k * 0.028, -0.08, 0], 0.003, 0.012, [0, 1, 0]), { col: C('#eee6d6'), def: [0.1, 0, 0] });
  eyes(b, { t: 0.31, prof, r: 0.006, ry: -0.35, rz: 0.97 });
  b.add(fin([[-0.47, 0], [-0.5, 0.12], [-0.6, 0.15], [-0.56, 0.0], [-0.6, -0.15], [-0.5, -0.12]], 'xz'), { col: C('#36322e'), def: x => [0.5 - x, 0, env(0.5 - x)] });
  for (const s of [-1, 1]) b.add(fin([[0.18, 0], [0.12, 0.05], [0.09, 0.0]], 'xz', { y: -0.07, z: s * 0.08 }), { col: C('#3a3632'), def: [0.32, 0, 0.1] });
  b.add(fin([[-0.05, 0.1], [-0.1, 0.135], [-0.16, 0.095]], 'xy'), { col: C('#3d3935'), def: x => [0.5 - x, 0, env(0.5 - x)] });
  return { b, deform: { flap: 0.04, flapF: 1, lat: 0, k: 1 }, mat: { roughness: 0.55 } };
};

M.vampire = () => {
  const b = new Builder();
  /* manto à frente (+x), braços com membrana atrás */
  const prof = { h: curve([[0, 0.02], [0.1, 0.12], [0.35, 0.16], [0.5, 0.15], [0.62, 0.12]]), w: curve([[0, 0.02], [0.1, 0.12], [0.35, 0.16], [0.5, 0.15], [0.62, 0.12]]) };
  const red = (x, y, z) => mix3(C('#3a0a10'), C('#6b1a1c'), vnoise(x * 30, y * 30 + z * 30));
  b.add(loft({ ...prof, x0: 0.5, x1: -0.12, nt: 26, na: 18 }), { col: red, def: [0, 0, 0] });
  for (const s of [-1, 1]) {
    b.add(fin([[0.32, 0], [0.26, 0.12], [0.18, 0.1], [0.2, 0]], 'xz', { z: s * 0.13 }).scale(1, 1, s), { col: C('#4a1216'), def: [0, 0, 1] });
    b.add(sphere([0.22, 0, s * 0.17], 0.025, 8, 6), { col: C('#c8d8ff'), em: [0.8, 1.4, 2.6], def: [0, 0, 0.6] });           /* fotóforos das barbatanas */
    b.add(sphere([-0.02, 0.09, s * 0.11], 0.04, 12, 10), { col: (px, py, pz) => (Math.abs(pz) > 0.135 ? C('#1b3d6a') : C('#7a2a26')), def: [0, 0, 0] });
  }
  /* oito braços em sombrinha + membrana */
  const arms = 8, L = 0.62;
  for (let k = 0; k < arms; k++) {
    const a = k / arms * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const pts = [[-0.1, ca * 0.1, sa * 0.1], [-0.3, ca * 0.2, sa * 0.2], [-0.5, ca * 0.26, sa * 0.26], [-0.12 - L, ca * 0.24, sa * 0.24]];
    const g = tube(pts, t => 0.02 * (1 - t * 0.8), { seg: 14, rs: 5 }), tf = g.userData.tOf;
    b.add(g, { col: C('#2e080c'), def: (x, y, z, i) => [tf(i) * 2, 0, tf(i)] });
    b.add(sphere([-0.12 - L, ca * 0.24, sa * 0.24], 0.012, 6, 5), { col: C('#d0e0ff'), em: [0.5, 1.2, 2.5], def: [2, 0, 1] });
  }
  const web = new THREE.LatheGeometry([new THREE.Vector2(0.1, 0), new THREE.Vector2(0.2, -0.2), new THREE.Vector2(0.26, -0.4), new THREE.Vector2(0.2, -0.55)], 24);
  web.rotateZ(Math.PI / 2); web.translate(-0.1, 0, 0);
  b.add(web, { col: C('#250609'), def: x => [(-0.1 - x) * 4, 0, smooth(-0.1, -0.6, x)] });
  return { b, deform: { flap: 0.03, flapF: 1, lat: 0, k: 1 }, mat: { roughness: 0.8, side: THREE.DoubleSide }, glow: true };
};

M.dumbo = () => {
  const b = new Builder();
  /* corpo vertical: manto em cima (+y), braços com membrana em baixo; nada para +x */
  const bell = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0.38), new THREE.Vector2(0.12, 0.34), new THREE.Vector2(0.2, 0.22), new THREE.Vector2(0.22, 0.05), new THREE.Vector2(0.18, -0.08)], 22);
  const pale = (x, y, z) => mix3(C('#d98f6e'), C('#efb89a'), vnoise(x * 20, y * 20 + z * 20) * 0.7 + smooth(0.0, 0.35, y) * 0.3);
  b.add(bell, { col: pale, def: [0, 0, 0] });
  for (const s of [-1, 1]) {
    b.add(fin([[0.0, -0.06], [0.0, 0.06], [0.1, 0.14], [0.2, 0.1], [0.22, -0.02], [0.12, -0.08]], 'xy').rotateY(-s * Math.PI / 2).rotateX(s * 0.5).translate(0, 0.26, s * 0.17), { col: C('#e3a283'), def: [0, 0, 1] });
    b.add(sphere([0.15, 0.08, s * 0.13], 0.04, 10, 8), { col: (px, py, pz) => (px > 0.17 ? C('#0a0a0c') : C('#e8c0a8')), def: [0, 0, 0] });
  }
  const skirt = new THREE.LatheGeometry([new THREE.Vector2(0.18, -0.08), new THREE.Vector2(0.32, -0.2), new THREE.Vector2(0.42, -0.3), new THREE.Vector2(0.4, -0.36)], 32);
  b.add(skirt, { col: C('#c98466'), def: (x, y) => [0, 0, smooth(-0.1, -0.36, y)] });
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.add(tube([[Math.cos(a) * 0.17, -0.08, Math.sin(a) * 0.17], [Math.cos(a) * 0.3, -0.18, Math.sin(a) * 0.3], [Math.cos(a) * 0.42, -0.34, Math.sin(a) * 0.42]], 0.018, { seg: 8, rs: 5 }), { col: C('#b8735a'), def: (x, y) => [0, 0, smooth(-0.1, -0.36, y)] }); }
  return { b, deform: { flap: 0.05, flapF: 1, lat: 0, k: 1 }, mat: { roughness: 0.55, side: THREE.DoubleSide }, translucent: true };
};

M.atolla = () => {
  const b = new Builder();
  const lap = 22;
  const prof = [];
  for (let i = 0; i <= 14; i++) { const u = i / 14; prof.push(new THREE.Vector2(0.5 * Math.sin(u * Math.PI / 2) ** 0.8, 0.16 * Math.cos(u * Math.PI / 2) - (u > 0.55 && u < 0.7 ? 0.02 : 0))); }
  const bell = new THREE.LatheGeometry(prof, lap * 3);
  /* lapelas na margem */
  const p = bell.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r > 0.42) { const a = Math.atan2(z, x), m = 1 + 0.06 * Math.abs(Math.sin(a * lap / 2)); p.setX(i, x * m); p.setZ(i, z * m); p.setY(i, p.getY(i) - 0.03 * Math.abs(Math.sin(a * lap / 2))); } }
  bell.computeVertexNormals();
  const col = (x, y, z) => { const r = Math.hypot(x, z); return r < 0.2 ? C('#3a0309') : mix3(C('#6a0a16'), C('#8c1d28'), smooth(0.25, 0.5, r)); };
  const em = (x, y, z) => { const r = Math.hypot(x, z); return r > 0.38 && r < 0.47 ? [0.3, 1.0, 2.6] : K0; };
  b.add(bell, { col, em, def: (x, y, z) => [Math.atan2(z, x) / (Math.PI * 2) + 0.5, 0, smooth(0.15, 0.5, Math.hypot(x, z))] });
  for (let k = 0; k < lap; k++) {
    const a = k / lap * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), L = k === 0 ? 1.1 : 0.22;
    const pts = k === 0 ? [[c * 0.5, -0.02, s * 0.5], [c * 0.6, -0.3, s * 0.6], [c * 0.4, -0.8, s * 0.5], [c * 0.2, -L, s * 0.3]] : [[c * 0.5, -0.02, s * 0.5], [c * 0.62, 0.05, s * 0.62], [c * 0.66, 0.15, s * 0.66]];
    const g = tube(pts, k === 0 ? 0.006 : 0.006, { seg: k === 0 ? 20 : 6, rs: 4 }), tf = g.userData.tOf;
    b.add(g, { col: C('#7a1824'), def: (x, y, z, i) => [tf(i) * 4, tf(i) * (k === 0 ? 1 : 0.3), 0.2] });
  }
  b.add(sphere([0, -0.02, 0], 0.16, 14, 8).scale(1, 0.4, 1), { col: C('#5c0712'), def: [0, 0, 0.2] });
  return { b, deform: { flap: 0.07, flapF: 1, lat: 0.05, k: 2, pulse: true }, mat: { roughness: 0.3, transparent: true, opacity: 0.9, side: THREE.DoubleSide }, glow: true, fresnel: true, pinwheel: true, axis: 'y' };
};

M.siphono = () => {
  const b = new Builder();
  /* colónia: sino de nectóforos à frente, haste comprida, cormídios com tentáculos */
  const pale = C('#dfe9ef');
  for (let k = 0; k < 7; k++) { const x = 0.5 - k * 0.012, s = k % 2 ? 1 : -1; b.add(sphere([x, 0.006 * s, s * 0.008], 0.012, 10, 8).scale(1.3, 1, 1), { col: pale, def: [0, 0, 0.3] }); }
  b.add(tube([[0.42, 0, 0], [0.1, 0.004, 0], [-0.2, -0.003, 0], [-0.5, 0, 0]], 0.0016, { seg: 60, rs: 4 }), { col: C('#f0c8a0'), def: x => [0.5 - x, 1, 0] });
  for (let k = 0; k < 26; k++) {
    const x = 0.4 - k * 0.034;
    b.add(sphere([x, -0.004, 0], 0.005, 6, 5).scale(1.4, 0.8, 1), { col: C('#f2b48a'), em: k % 2 ? [0.15, 0.7, 1.6] : K0, def: [0.5 - x, 1, 0] });
    b.add(fin([[x + 0.008, 0.002], [x - 0.004, 0.012], [x - 0.012, 0.002]], 'xy', { z: 0.004 }), { col: pale, def: [0.5 - x, 1, 0] });
    const L = 0.06 + 0.05 * Math.sin(k * 1.7) ** 2;
    const g = tube([[x, -0.004, 0], [x - 0.01, -L * 0.5, 0.004], [x - 0.02, -L, 0]], 0.0007, { seg: 8, rs: 3 });
    b.add(g, { col: C('#f6d2b8'), def: (px, py) => [0.5 - x + py * 3, 1, 0] });
  }
  return { b, deform: { lat: 0.012, k: 9, flap: 0 }, mat: { roughness: 0.2, transparent: true, opacity: 0.55, side: THREE.DoubleSide }, glow: true, fresnel: true };
};

M.physalia = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.02], [0.1, 0.1], [0.5, 0.15], [0.9, 0.1], [1, 0.03]]), w: curve([[0, 0.02], [0.1, 0.09], [0.5, 0.14], [0.9, 0.09], [1, 0.02]]) };
  const float = (x, y) => mix3(C('#6e8fd8'), C('#c9a8e8'), smooth(-0.05, 0.12, y));
  b.add(loft({ ...prof, n: 2, nt: 30, na: 16 }), { col: float, def: [0, 0, 0] });
  b.add(fin([[0.35, 0.1], [0.25, 0.27], [-0.1, 0.32], [-0.38, 0.12]], 'xy'), { col: (x, y) => mix3(C('#a89be0'), C('#e7a2c9'), smooth(0.18, 0.3, y)), def: [0, 0, 0] });
  /* pólipos e tentáculos (dezenas de vezes o tamanho do flutuador) */
  for (let k = 0; k < 14; k++) {
    const x = lerp(0.3, -0.35, k / 13), z = Math.sin(k * 2.3) * 0.06, L = 1.5 + 4 * ((k * 7) % 5) / 5;
    b.add(sphere([x, -0.12, z], 0.035, 6, 5), { col: C('#4d5fb8'), def: [0, 0, 0] });
    const g = tube([[x, -0.12, z], [x - 0.1, -L * 0.33, z], [x + 0.05, -L * 0.66, z + 0.05], [x - 0.05, -L, z]], 0.006, { seg: 24, rs: 3 }), tf = g.userData.tOf;
    b.add(g, { col: C('#3a49a8'), def: (px, py, pz, i) => [tf(i) * 6, tf(i), 0] });
  }
  return { b, deform: { lat: 0.15, k: 2, flap: 0 }, mat: { roughness: 0.15, transparent: true, opacity: 0.85, side: THREE.DoubleSide }, fresnel: true, translucent: true };
};

M.psychro = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.04], [0.1, 0.1], [0.5, 0.12], [0.9, 0.09], [1, 0.03]]), w: curve([[0, 0.05], [0.15, 0.16], [0.5, 0.18], [0.9, 0.14], [1, 0.04]]), yc: () => 0.05 };
  const vio = (x, y, z) => mix3(C('#4e2a5e'), C('#9c6a9a'), vnoise(x * 25, y * 25 + z * 25) * 0.6 + smooth(0.0, 0.12, y) * 0.4);
  b.add(loft({ ...prof, n: 2.6, nt: 34, na: 18 }), { col: vio, def: fishDef(t => 0.3 + 0.7 * t) });
  /* apêndice dorsal posterior, comprido */
  b.add(tube([[-0.35, 0.14, 0], [-0.45, 0.35, 0], [-0.62, 0.55, 0], [-0.82, 0.6, 0]], t => 0.07 * (1 - t * 0.7), { seg: 16, rs: 10 }), { col: C('#7a4c86'), def: x => [0.5 - x, 0.6, 0] });
  for (let k = 0; k < 16; k++) { const t = 0.06 + k * 0.055, x = 0.5 - t; for (const s of [-1, 1]) b.add(cone([x, 0.0, s * prof.w(t) * 0.97], 0.012, 0.04, [0, -0.6, s]), { col: C('#5b3468'), def: [t, 0.3, 0] }); }
  return { b, deform: { lat: 0.01, k: 4, flap: 0 }, mat: { roughness: 0.35, transparent: true, opacity: 0.93 }, translucent: true, fresnel: true };
};

M.cucumber = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.05], [0.12, 0.17], [0.5, 0.2], [0.88, 0.16], [1, 0.05]]), w: curve([[0, 0.05], [0.12, 0.17], [0.5, 0.2], [0.88, 0.16], [1, 0.05]]), yc: () => 0.16 };
  const pk = (x, y, z) => mix3(C('#d69a98'), C('#f0c8c0'), vnoise(x * 18, y * 18 + z * 18) * 0.5 + smooth(0.0, 0.3, y) * 0.5);
  b.add(loft({ ...prof, n: 2.3, nt: 30, na: 16 }), { col: pk, def: fishDef(t => 0.4 + 0.6 * t) });
  for (let k = 0; k < 6; k++) { const t = 0.1 + k * 0.15, x = 0.5 - t; for (const s of [-1, 1]) b.add(tube([[x, 0.05, s * 0.1], [x + 0.02, -0.02, s * 0.15], [x, -0.04, s * 0.17]], 0.03, { seg: 4, rs: 6 }), { col: C('#e3aaa6'), def: [t, 0.2, 0] }); }
  for (let k = 0; k < 4; k++) b.add(tube([[0.4 - k * 0.04, 0.32, 0], [0.45 - k * 0.04, 0.42, 0.02 * k], [0.52 - k * 0.05, 0.48, 0.03 * k]], 0.015, { seg: 5, rs: 5 }), { col: C('#efc8c0'), def: [0.1, 0.3, 0] });
  return { b, deform: { lat: 0.008, k: 4, flap: 0 }, mat: { roughness: 0.4, transparent: true, opacity: 0.9 }, translucent: true, fresnel: true };
};

M.xeno = () => {
  const g = new THREE.IcosahedronGeometry(0.4, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = vnoise(v.x * 8 + 3, v.y * 8 + v.z * 5) * 0.55 + vnoise(v.x * 20, v.z * 20 + v.y * 7) * 0.25; v.multiplyScalar(0.7 + n * 0.6); v.y = Math.max(v.y, -0.05) * 1.1; p.setXYZ(i, v.x, v.y + 0.15, v.z); }
  g.computeVertexNormals();
  const b = new Builder().add(g, { col: (x, y, z) => mix3(C('#a39176'), C('#d6c7a8'), vnoise(x * 30, y * 30 + z * 30)), def: [0, 0, 0] });
  return { b, deform: null, mat: { roughness: 0.95 } };
};

M.shrimp = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.05], [0.08, 0.17], [0.35, 0.17], [0.45, 0.11], [0.75, 0.07], [1, 0.03]]), w: curve([[0, 0.05], [0.1, 0.16], [0.35, 0.15], [0.5, 0.09], [1, 0.03]]), yc: curve([[0, 0.02], [0.4, 0.04], [0.8, 0.0], [1, -0.04]]) };
  const c = (x, y) => mix3(C('#e9b79a'), C('#f6e2d2'), smooth(-0.05, 0.1, y));
  b.add(loft({ ...prof, n: 2.2, nt: 30, na: 12 }), { col: c, def: fishDef(t => smooth(0.4, 1, t) * 0.5) });
  b.add(fin([[-0.45, -0.03], [-0.6, 0.06], [-0.62, -0.12]], 'xz'), { col: C('#f0cdb8'), def: [1, 0.5, 0] });
  for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { const x = 0.32 - k * 0.07; b.add(tube([[x, -0.08, s * 0.08], [x + 0.02, -0.18, s * 0.16], [x - 0.02, -0.26, s * 0.2]], 0.008, { seg: 4, rs: 3 }), { col: C('#e8c0a8'), def: [0.3, 0, 0] }); }
  for (const s of [-1, 1]) b.add(tube([[0.5, 0.03, s * 0.03], [0.75, 0.1, s * 0.12], [1.0, 0.0, s * 0.2]], 0.004, { seg: 8, rs: 3 }), { col: C('#f2d0b8'), def: [0, 0, 0] });
  return { b, deform: { lat: 0.04, k: 4, flap: 0.02, flapF: 2.5 }, mat: { roughness: 0.4 } };
};

M.amphipod = () => {
  const b = new Builder();
  const prof = { h: curve([[0, 0.08], [0.2, 0.17], [0.6, 0.16], [1, 0.07]]), w: curve([[0, 0.06], [0.3, 0.12], [0.7, 0.1], [1, 0.04]]), yc: t => -0.25 * (t - 0.5) * (t - 0.5) + 0.06 };
  b.add(loft({ ...prof, n: 2.4, nt: 24, na: 10 }), { col: (x, y, z) => (Math.sin((0.5 - x) * 70) > 0.75 ? C('#b89888') : C('#d8c6ba')), def: fishDef(t => 0.3) });
  for (let k = 0; k < 7; k++) for (const s of [-1, 1]) { const x = 0.35 - k * 0.1; b.add(tube([[x, -0.05, s * 0.06], [x + 0.03, -0.18, s * 0.1], [x + 0.05, -0.25, s * 0.12]], 0.007, { seg: 3, rs: 3 }), { col: C('#efdcd0'), def: [0.4, 0, 0] }); }
  for (const s of [-1, 1]) b.add(tube([[0.48, 0.12, s * 0.03], [0.65, 0.22, s * 0.08], [0.78, 0.18, s * 0.1]], 0.005, { seg: 6, rs: 3 }), { col: C('#efdcd0'), def: [0, 0, 0] });
  return { b, deform: { lat: 0.02, k: 3, flap: 0.03, flapF: 3 }, mat: { roughness: 0.8 } };
};

M.mussel = () => {
  const b = new Builder();
  for (const s of [-1, 1]) {
    const g = loft({ h: curve([[0, 0.04], [0.2, 0.17], [0.6, 0.2], [1, 0.07]]), w: curve([[0, 0.02], [0.3, 0.12], [0.7, 0.13], [1, 0.03]]), n: 2, nt: 16, na: 12 });
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { p.setZ(i, s * Math.max(0, s * p.getZ(i)) + s * 0.004); }
    g.computeVertexNormals();
    b.add(g, { col: (x, y, z) => mix3(C('#4a3a1e'), C('#8d7a3c'), smooth(-0.3, 0.4, x) * 0.6 + vnoise(x * 40, y * 40) * 0.4), def: [0, 0, 0] });
  }
  return { b, deform: null, mat: { roughness: 0.35, side: THREE.DoubleSide } };
};

M.crab = () => {
  const b = new Builder();
  const cara = sphere([0, 0.08, 0], 0.22, 14, 10).scale(1, 0.45, 1.25);
  b.add(cara, { col: (x, y, z) => mix3(C('#d9d2c4'), C('#f2ece0'), vnoise(x * 20, z * 20)), def: [0, 0, 0] });
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const x = 0.1 - k * 0.09; b.add(tube([[x, 0.06, s * 0.22], [x + 0.03, 0.14, s * 0.42], [x + 0.06, -0.04, s * 0.58]], 0.018, { seg: 6, rs: 4 }), { col: C('#e6dfd0'), def: [0, 0, 0] }); }
  for (const s of [-1, 1]) { b.add(tube([[0.18, 0.06, s * 0.15], [0.34, 0.1, s * 0.22], [0.44, 0.06, s * 0.14]], 0.035, { seg: 6, rs: 6 }), { col: C('#efe8da'), def: [0, 0, 0] }); }
  return { b, deform: null, mat: { roughness: 0.5 } };
};

/* submersível de investigação (desenho próprio, genérico): esfera tripulada + flutuação + propulsores + faróis */
export function buildSub() {
  const b = new Builder();
  const foam = (x, y) => (y > 0.1 ? C('#e8e2d0') : C('#d2c9b2'));
  b.add(new THREE.CapsuleGeometry(0.34, 1.5, 8, 18).rotateZ(Math.PI / 2).scale(1, 1, 1.15).translate(-0.25, 0.22, 0), { col: foam });
  b.add(new THREE.BoxGeometry(1.2, 0.05, 0.05).translate(-0.3, 0.58, 0), { col: C('#3c3f44') });
  b.add(sphere([0.55, -0.2, 0], 0.38, 24, 18), { col: (x, y, z) => (x > 0.75 && Math.abs(z) < 0.14 && y > -0.3 && y < -0.05 ? C('#0a1420') : C('#d36b1e')) });
  b.add(new THREE.TorusGeometry(0.13, 0.025, 8, 24).rotateY(Math.PI / 2).translate(0.9, -0.18, 0), { col: C('#2a2c30') });
  for (const s of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 16, 1, true).rotateZ(Math.PI / 2).translate(-0.95, 0.1, s * 0.42), { col: C('#2f3236') });
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12).rotateZ(Math.PI / 2).translate(0.85, -0.42, s * 0.38), { col: C('#9aa0a6'), em: [2, 2, 1.9] });
    b.add(tube([[0.7, -0.55, s * 0.2], [0.95, -0.6, s * 0.3], [1.1, -0.5, s * 0.33]], 0.03, { seg: 6, rs: 5 }), { col: C('#6d7277') });
  }
  b.add(new THREE.BoxGeometry(1.8, 0.08, 0.9).translate(0, -0.62, 0), { col: C('#3c3f44') });
  const m = waterify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }), { glow: true });
  const mesh = new THREE.Mesh(b.geometry(), m);
  mesh.scale.setScalar(1.6); mesh.rotation.order = 'YXZ';
  return mesh;
}

const cache = new Map();
/** devolve { geo, mat, info } para um modelo; o material já está preparado para a água */
export function getModel(key) {
  if (cache.has(key)) return cache.get(key);
  const r = M[key]();
  const geo = r.b.geometry();
  if (r.axis === 'y') { /* medusas: o eixo do sino é y; a "frente" fica a ser +x */ }
  const mat = waterify(new THREE.MeshStandardMaterial({ vertexColors: true, ...r.mat }), {
    glow: !!r.glow, translucent: !!r.translucent, fresnel: !!r.fresnel, deform: r.deform || null, inst: true, pinwheel: !!r.pinwheel });
  if (r.pinwheel) mat.defines.WATER_PINWHEEL = '';
  const out = { geo, mat, info: r };
  cache.set(key, out);
  return out;
}
export const MODEL_KEYS = Object.keys(M);
