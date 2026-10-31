/* ══════════════════════════════════════════════════════════════════════
   Estúdio virtual — sujeito do retrato a partir de assets MakeHuman (CC0).

   Faz, sem a aplicação MakeHuman, o que ela faria ao exportar:
     1. malha base hm08 (corpo + geometria auxiliar) ← targets macro
     2. esqueleto: articulações = média dos vértices auxiliares "joint-*"
     3. pose: braços caídos ao longo do corpo (skinning linear com os pesos
        oficiais do rig por omissão)
     4. proxies .mhclo (roupa, cabelo, olhos, sobrancelhas, pestanas): cada
        vértice = combinação baricêntrica de 3 vértices do corpo + desvio
        escalado; pesos herdados dos mesmos 3 vértices → seguem a pose
     5. esconde o corpo por baixo da roupa (delete_verts)
     6. escreve um GLB só com geometria (os materiais são montados no
        browser) + texturas WebP redimensionadas

   uso: node fetch.mjs && node build-subject.mjs
   saída: assets/models/studio/subject.glb + assets/models/studio/tex/*.webp
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';

const SRC = path.resolve('_src');
const OUT = path.resolve('../../assets/models/studio');
const M = p => path.join(SRC, 'main', p);
const S = p => path.join(SRC, 'sys', p);
const DM = 0.1;                       // MakeHuman trabalha em decímetros

/* ── leitura ─────────────────────────────────────────────────────────── */
function readObj(file) {
  const v = [], vt = [], faces = [];   // faces: {v:[...], t:[...], g}
  let g = '';
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('v ')) { const a = line.split(/\s+/); v.push([+a[1], +a[2], +a[3]]); }
    else if (line.startsWith('vt ')) { const a = line.split(/\s+/); vt.push([+a[1], +a[2]]); }
    else if (line.startsWith('g ')) g = line.slice(2).trim();
    else if (line.startsWith('f ')) {
      const fv = [], ft = [];
      for (const tok of line.slice(2).trim().split(/\s+/)) {
        const [a, b] = tok.split('/');
        fv.push(+a - 1); ft.push(b ? +b - 1 : -1);
      }
      faces.push({ v: fv, t: ft, g });
    }
  }
  return { v, vt, faces };
}

function readTarget(file) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line[0] === '#') continue;
    const a = line.trim().split(/\s+/);
    if (a.length === 4) out.push([+a[0], +a[1], +a[2], +a[3]]);
  }
  return out;
}

function readMhclo(file) {
  const txt = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const r = { refs: [], scale: {}, del: new Set(), obj: null };
  let mode = '';
  for (const raw of txt) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const a = line.split(/\s+/);
    if (a[0] === 'verts') { mode = 'verts'; continue; }
    if (a[0] === 'delete_verts') { mode = 'del'; continue; }
    if (/^[a-z_]+$/i.test(a[0])) {         // palavras-chave podem surgir depois de "verts 0"
      if (a[0] === 'obj_file') r.obj = a[1];
      else if (/^[xyz]_scale$/.test(a[0])) r.scale[a[0][0]] = [+a[1], +a[2], +a[3]];
      continue;
    }
    if (mode === 'verts') {
      if (a.length === 1) r.refs.push({ i: [+a[0], +a[0], +a[0]], w: [1, 0, 0], d: [0, 0, 0] });
      else r.refs.push({ i: [+a[0], +a[1], +a[2]], w: [+a[3], +a[4], +a[5]], d: [+a[6], +a[7], +a[8]] });
    } else if (mode === 'del') {
      for (let k = 0; k < a.length; k++) {
        if (a[k + 1] === '-') { for (let n = +a[k]; n <= +a[k + 2]; n++) r.del.add(n); k += 2; }
        else r.del.add(+a[k]);
      }
    }
  }
  return r;
}

/* ── 1. corpo + targets ──────────────────────────────────────────────── */
const base = readObj(M('3dobjs/base.obj'));
const coords = base.v.map(p => p.slice());
for (const [file, w] of [
  ['targets/macrodetails/universal-female-young-averagemuscle-averageweight.target', 1],
  ['targets/macrodetails/caucasian-female-young.target', 1],
]) for (const [i, dx, dy, dz] of readTarget(M(file))) {
  coords[i][0] += w * dx; coords[i][1] += w * dy; coords[i][2] += w * dz;
}
const NV = coords.length;

/* ── 2. esqueleto ────────────────────────────────────────────────────── */
const skel = JSON.parse(fs.readFileSync(M('rigs/default.mhskel'), 'utf8'));
const jointPos = {};
for (const [name, ids] of Object.entries(skel.joints)) {
  const p = [0, 0, 0];
  for (const i of ids) { p[0] += coords[i][0]; p[1] += coords[i][1]; p[2] += coords[i][2]; }
  jointPos[name] = p.map(x => x / ids.length);
}
const bones = {};
for (const [name, b] of Object.entries(skel.bones)) bones[name] = { name, parent: b.parent, head: jointPos[b.head], tail: jointPos[b.tail] };

/* pesos do corpo: vértice → [[osso, peso]] (normalizados) */
const mhw = JSON.parse(fs.readFileSync(M('rigs/default_weights.mhw'), 'utf8'));
const vw = Array.from({ length: NV }, () => []);
for (const [bn, list] of Object.entries(mhw.weights)) for (const [i, w] of list) if (i < NV) vw[i].push([bn, w]);
for (const l of vw) { const s = l.reduce((a, x) => a + x[1], 0); if (s > 0) l.forEach(x => (x[1] /= s)); }

/* ── 3. pose ─────────────────────────────────────────────────────────── */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
function axisAngle(ax, ang) {               // matriz 3×3 linha-a-linha
  const [x, y, z] = norm(ax), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y,
          t * x * y + s * z, t * y * y + c, t * y * z - s * x,
          t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
const mul3 = (A, B) => { const R = new Array(9).fill(0); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) R[r * 3 + c] += A[r * 3 + k] * B[k * 3 + c]; return R; };
const app3 = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];

/* ângulo de repouso do braço (A-pose) medido, não assumido */
const ua = bones['upperarm01.L'], la = bones['lowerarm01.L'];
const armDir = norm(sub(bones['upperarm02.L'].tail, ua.head));
const restDeg = Math.atan2(-armDir[1], Math.abs(armDir[0])) * 180 / Math.PI;
console.log('braço em repouso: %s° abaixo da horizontal', restDeg.toFixed(1));

/* Pose por DIREÇÃO-ALVO: o rig em repouso tem o braço a ~48° e o antebraço
   já dobrado para a frente, por isso rotações relativas fixas não chegam.
   Para cada osso listado em AIM roda-se a direção atual (já com a pose dos
   pais) até coincidir com a direção pedida; os restantes herdam. */
const rotFromTo = (a, b) => {
  a = norm(a); b = norm(b);
  const ax = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const s = Math.hypot(...ax), c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return s < 1e-8 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : axisAngle(ax, Math.atan2(s, c));
};
const AIM = {}, REL = {};
for (const s of ['L', 'R']) {
  const sx = Math.sign(bones['upperarm01.' + s].head[0]);
  REL['shoulder01.' + s] = axisAngle([0, 0, 1], -sx * 5 * Math.PI / 180);
  AIM['upperarm01.' + s] = [sx * 0.17, -1, -0.03];        // braço quase vertical, ligeiramente afastado
  AIM['lowerarm01.' + s] = [sx * 0.06, -1, 0.2];          // cotovelo levemente dobrado
}
const order = [], seen = new Set();
const visit = n => { if (seen.has(n)) return; const p = bones[n].parent; if (p) visit(p); seen.add(n); order.push(n); };
Object.keys(bones).forEach(visit);
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const G = {};                              // {R, t}: p' = R p + t
const apply = (g, p) => { const q = app3(g.R, p); return [q[0] + g.t[0], q[1] + g.t[1], q[2] + g.t[2]]; };
for (const n of order) {
  const b = bones[n];
  const P = b.parent ? G[b.parent] : { R: I3, t: [0, 0, 0] };
  const H = apply(P, b.head);                                 // cabeça do osso já posada
  let Rw = I3;                                                // rotação extra, em torno de H
  if (AIM[n]) Rw = rotFromTo(app3(P.R, sub(b.tail, b.head)), AIM[n]);
  else if (REL[n]) Rw = REL[n];
  /* G(p) = Rw (P(p) − H) + H */
  const R = mul3(Rw, P.R), t = sub(H, app3(Rw, H)), pt = app3(Rw, P.t);
  G[n] = { R, t: [pt[0] + t[0], pt[1] + t[1], pt[2] + t[2]] };
}
function skin(p, weights) {
  if (!weights.length) return p.slice();
  const o = [0, 0, 0];
  for (const [bn, w] of weights) {
    const g = G[bn]; if (!g) continue;
    const q = app3(g.R, p);
    o[0] += w * (q[0] + g.t[0]); o[1] += w * (q[1] + g.t[1]); o[2] += w * (q[2] + g.t[2]);
  }
  return o;
}

/* ── 4. proxies ──────────────────────────────────────────────────────── */
function fitProxy(clo) {
  const sc = {};
  for (const ax of ['x', 'y', 'z']) {
    const k = { x: 0, y: 1, z: 2 }[ax], [a, b, den] = clo.scale[ax];
    sc[ax] = Math.abs(coords[a][k] - coords[b][k]) / den;
  }
  return clo.refs.map(r => {
    const p = [0, 0, 0], wts = new Map();
    for (let j = 0; j < 3; j++) {
      const c = coords[r.i[j]], w = r.w[j];
      p[0] += w * c[0]; p[1] += w * c[1]; p[2] += w * c[2];
      for (const [bn, bw] of vw[r.i[j]]) wts.set(bn, (wts.get(bn) || 0) + bw * w);
    }
    p[0] += r.d[0] * sc.x; p[1] += r.d[1] * sc.y; p[2] += r.d[2] * sc.z;
    const wl = [...wts].filter(x => x[1] > 1e-4);
    const s = wl.reduce((a, x) => a + x[1], 0) || 1;
    return skin(p, wl.map(([bn, w]) => [bn, w / s]));
  });
}

/* ── geometria → buffers glTF (separa vértices por par v/vt) ─────────── */
function buildMesh(obj, positions, faceFilter = () => true, flip = false) {
  const map = new Map(), pos = [], uv = [], idx = [], src = [];
  const key = (vi, ti) => vi * 1e6 + ti + 1;
  const vert = (vi, ti) => {
    const k = key(vi, ti);
    let n = map.get(k);
    if (n === undefined) {
      n = pos.length / 3; map.set(k, n);
      const p = positions[vi]; pos.push(p[0] * DM, p[1] * DM, p[2] * DM);
      const t = ti >= 0 ? obj.vt[ti] : [0, 0]; uv.push(t[0], 1 - t[1]);
      src.push(vi);
    }
    return n;
  };
  for (const f of obj.faces) {
    if (!faceFilter(f)) continue;
    const ids = f.v.map((vi, k) => vert(vi, f.t[k]));
    for (let k = 1; k + 1 < ids.length; k++) flip ? idx.push(ids[0], ids[k + 1], ids[k]) : idx.push(ids[0], ids[k], ids[k + 1]);
  }
  /* normais suaves por POSIÇÃO de origem (sem costuras de UV visíveis) */
  const acc = new Map();
  for (let k = 0; k < idx.length; k += 3) {
    const [a, b, c] = [idx[k], idx[k + 1], idx[k + 2]];
    const pa = pos.slice(a * 3, a * 3 + 3), pb = pos.slice(b * 3, b * 3 + 3), pc = pos.slice(c * 3, c * 3 + 3);
    const u = sub(pb, pa), v = sub(pc, pa);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const q of [a, b, c]) {
      const s = src[q], o = acc.get(s) || [0, 0, 0];
      o[0] += n[0]; o[1] += n[1]; o[2] += n[2]; acc.set(s, o);
    }
  }
  const nrm = [];
  for (let q = 0; q < src.length; q++) { const n = norm(acc.get(src[q]) || [0, 1, 0]); nrm.push(...n); }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), idx: new Uint32Array(idx) };
}

/* ── montagem ────────────────────────────────────────────────────────── */
const posed = coords.map((p, i) => skin(p, vw[i]));
const PARTS = [];

const cloSpecs = [
  ['clothes', S('clothes/female_casualsuit01/female_casualsuit01.mhclo')],
  ['shoes', S('clothes/shoes06/shoes06.mhclo')],
  ['hair', S('hair/ponytail01/ponytail01.mhclo')],
  ['eyes', M('eyes/high-poly/high-poly.mhclo')],
  ['brows', S('eyebrows/eyebrow001/eyebrow001.mhclo')],
  ['lashes', S('eyelashes/eyelashes01/eyelashes01.mhclo')],
];
const hidden = new Set();
for (const [name, file] of cloSpecs) {
  const clo = readMhclo(file);
  clo.del.forEach(i => hidden.add(i));
  const obj = readObj(path.join(path.dirname(file), clo.obj));
  if (obj.v.length !== clo.refs.length) throw new Error(`${name}: ${obj.v.length} vértices vs ${clo.refs.length} refs`);
  const fitted = fitProxy(clo);
  if (name === 'eyes') {
    /* o olho MakeHuman = globo (círculos grandes do atlas) + córnea (círculo
       pequeno no canto, transparente na textura). Separadas: a córnea vira
       uma camada só de reflexo especular — é dela que vêm os catchlights */
    const isCornea = f => { const t = f.t.map(i => obj.vt[i]); const u = t.reduce((a, x) => a + x[0], 0) / t.length, v = t.reduce((a, x) => a + x[1], 0) / t.length; return u > 0.85 && v < 0.15; };
    PARTS.push(['eyes', buildMesh(obj, fitted, f => !isCornea(f))]);
    PARTS.push(['cornea', buildMesh(obj, fitted, isCornea)]);
  } else PARTS.push([name, buildMesh(obj, fitted)]);
}
PARTS.unshift(['body', buildMesh(base, posed, f => f.g === 'body' && !f.v.some(i => hidden.has(i)))]);

/* couro cabeludo: onde o cabelo cobre a cabeça, a pele por baixo passa a
   castanho-escuro. Sem isto, as falhas entre as madeixas mostram pele
   clara e a linha do cabelo parece a borda de um capacete. Peso por
   vértice = proximidade ao cabelo (só acima das sobrancelhas). */
const scalpW = (() => {
  const body = PARTS.find(p => p[0] === 'body')[1], hair = PARTS.find(p => p[0] === 'hair')[1];
  const eyeY = skin(jointPos['eye.L____head'], [['eye.L', 1]])[1] * DM;
  const nb = body.pos.length / 3, nh = hair.pos.length / 3, w = new Float32Array(nb);
  for (let i = 0; i < nb; i++) {
    const x = body.pos[i * 3], y = body.pos[i * 3 + 1], z = body.pos[i * 3 + 2];
    if (y < eyeY + 0.02) continue;
    let best = 1;
    for (let j = 0; j < nh; j++) {
      const dx = hair.pos[j * 3] - x, dy = hair.pos[j * 3 + 1] - y, dz = hair.pos[j * 3 + 2] - z;
      const d = dx * dx + dy * dy + dz * dz; if (d < best) best = d;
    }
    const d = Math.sqrt(best), t = Math.min(1, Math.max(0, (d - 0.006) / 0.018));
    w[i] = 1 - t * t * (3 - 2 * t);
  }
  return w;
})();

/* pés no chão (y=0) e centrado em x/z pelo corpo */
let minY = Infinity, cx = 0, cz = 0, n = 0;
for (const [name, m] of PARTS) for (let k = 0; k < m.pos.length; k += 3) {
  minY = Math.min(minY, m.pos[k + 1]);
  if (name === 'body') { cx += m.pos[k]; cz += m.pos[k + 2]; n++; }
}
cx /= n; cz /= n;
for (const [, m] of PARTS) for (let k = 0; k < m.pos.length; k += 3) { m.pos[k] -= cx; m.pos[k + 1] -= minY; m.pos[k + 2] -= cz; }

/* pontos de referência úteis no browser (metros, já recentrados) */
const P = name => { const p = jointPos[name]; return [+(p[0] * DM - cx).toFixed(4), +(p[1] * DM - minY).toFixed(4), +(p[2] * DM - cz).toFixed(4)]; };
const eyeL = skin(jointPos['eye.L____head'], [['eye.L', 1]]), eyeR = skin(jointPos['eye.R____head'], [['eye.R', 1]]);
const ref = {
  eyeL: [eyeL[0] * DM - cx, eyeL[1] * DM - minY, eyeL[2] * DM - cz].map(x => +x.toFixed(4)),
  eyeR: [eyeR[0] * DM - cx, eyeR[1] * DM - minY, eyeR[2] * DM - cz].map(x => +x.toFixed(4)),
  head: P('head____head'), neck: P('neck01____head'),
};

const doc = new Document();
const buf = doc.createBuffer();
const scene = doc.createScene('subject');
let tris = 0;
for (const [name, m] of PARTS) {
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(m.nrm).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(m.uv).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.idx).setBuffer(buf));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  tris += m.idx.length / 3;
  console.log(name.padEnd(8), (m.pos.length / 3) + ' v', (m.idx.length / 3) + ' t');
}
scene.setExtras({ ref });
fs.mkdirSync(path.join(OUT, 'tex'), { recursive: true });
await new NodeIO().write(path.join(OUT, 'subject.glb'), doc);
console.log('subject.glb', (fs.statSync(path.join(OUT, 'subject.glb')).size / 1024).toFixed(0) + ' KB', tris + ' triângulos', JSON.stringify(ref));

/* ── texturas ────────────────────────────────────────────────────────── */
const TEX = [
  ['skin', S('skins/young_caucasian_female/young_lightskinned_female_diffuse.png'), 2048, 84],
  ['eye', M('eyes/materials/brown_eye.png'), 512, 88],
  ['hair', S('hair/ponytail01/ponytail01_diffuse.png'), 1024, 88, true],
  ['brows', S('eyebrows/eyebrow001/eyebrow001.png'), 512, 90, true],
  ['lashes', S('eyelashes/eyelashes01/eyelashes01.png'), 256, 90, true],
  ['clothes-n', S('clothes/female_casualsuit01/female_casualsuit01_normal.png'), 1024, 90],
  ['clothes-ao', S('clothes/female_casualsuit01/female_casualsuit01_ao.png'), 1024, 85],
  ['shoes', S('clothes/shoes06/shoes06_diffuse.png'), 512, 85],
];
/* pele com o couro cabeludo pintado (rasteriza os triângulos do corpo no espaço UV) */
{
  const SZ = 2048;
  const { data } = await sharp(S('skins/young_caucasian_female/young_lightskinned_female_diffuse.png')).removeAlpha().resize(SZ, SZ).raw().toBuffer({ resolveWithObject: true });
  const hairRaw = await sharp(S('hair/ponytail01/ponytail01_diffuse.png')).resize(256, 256).raw().toBuffer();
  let hr = 0, hg = 0, hb = 0, hn = 0;
  for (let i = 0; i < hairRaw.length; i += 4) if (hairRaw[i + 3] > 200) { hr += hairRaw[i]; hg += hairRaw[i + 1]; hb += hairRaw[i + 2]; hn++; }
  const HC = [hr / hn * 0.5, hg / hn * 0.5, hb / hn * 0.5];
  const body = PARTS.find(p => p[0] === 'body')[1], o = Buffer.from(data);
  const wmap = new Float32Array(SZ * SZ);
  for (let k = 0; k < body.idx.length; k += 3) {
    const ids = [body.idx[k], body.idx[k + 1], body.idx[k + 2]];
    const ws = ids.map(i => scalpW[i]); if (Math.max(...ws) <= 0) continue;
    const P2 = ids.map(i => [body.uv[i * 2] * SZ, body.uv[i * 2 + 1] * SZ]);
    const x0 = Math.max(0, Math.floor(Math.min(...P2.map(p => p[0])))), x1 = Math.min(SZ - 1, Math.ceil(Math.max(...P2.map(p => p[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...P2.map(p => p[1])))), y1 = Math.min(SZ - 1, Math.ceil(Math.max(...P2.map(p => p[1]))));
    const [a, b, c] = P2, den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den;
      const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den, l3 = 1 - l1 - l2;
      if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue;
      const w = Math.max(0, l1 * ws[0] + l2 * ws[1] + l3 * ws[2]);
      wmap[y * SZ + x] = Math.max(wmap[y * SZ + x], w);
    }
  }
  for (let i = 0; i < SZ * SZ; i++) { const w = wmap[i] * 0.92; if (w <= 0) continue; for (let c = 0; c < 3; c++) o[i * 3 + c] = o[i * 3 + c] * (1 - w) + HC[c] * w; }
  await sharp(o, { raw: { width: SZ, height: SZ, channels: 3 } }).webp({ quality: 84 }).toFile(path.join(OUT, 'tex', 'skin.webp'));
}
for (const [id, file, size, q, alpha] of TEX.filter(t => t[0] !== 'skin')) {
  await sharp(file).resize(size, size).webp({ quality: q, alphaQuality: alpha ? 90 : undefined }).toFile(path.join(OUT, 'tex', id + '.webp'));
}

/* t-shirt sem o logótipo MakeHuman: a metade de cima do atlas (t-shirt) e
   as mangas passam a malha lisa; as calças de ganga ficam como estão */
{
  const file = S('clothes/female_casualsuit01/female_casualsuit01_diffuse.png');
  const { data, info } = await sharp(file).removeAlpha().resize(1024, 1024).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, o = Buffer.from(data);
  const isBg = (r, g, b) => Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r > 150;   // fundo cinzento do atlas
  let seed = 7; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const shirt = y < H * 0.46 || (x > W * 0.7 && y > H * 0.55 && y < H * 0.9);
    if (!shirt) continue;
    const k = (y * W + x) * 3, r = data[k], g = data[k + 1], b = data[k + 2];
    if (isBg(r, g, b)) continue;
    /* malha de algodão: tom grafite com um fio fino vertical e grão leve */
    const rib = (x % 3 === 0 ? -5 : 0) + (rnd() - 0.5) * 6;
    o[k] = Math.max(0, Math.min(255, 52 + rib)); o[k + 1] = Math.max(0, Math.min(255, 54 + rib)); o[k + 2] = Math.max(0, Math.min(255, 60 + rib));
  }
  await sharp(o, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 86 }).toFile(path.join(OUT, 'tex', 'clothes.webp'));
}
console.log('texturas em', path.join(OUT, 'tex'));
