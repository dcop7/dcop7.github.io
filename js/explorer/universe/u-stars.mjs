/* ══════════════════════════════════════════════════════════════════════
   Universo observável — estrelas vizinhas, constelações e exoplanetas.

   Cada estrela é desenhada com o brilho que teria vista DA CÂMARA:
   m = Mv + 5·log10(d/10 pc). Perto da Terra reconhece-se o céu real; ao
   viajar, as estrelas próximas acendem-se e as figuras desfazem-se.
   A "exposição" sobe com a escala para a bolha continuar visível de fora —
   isso é uma escolha de visualização e está dito na legenda.
   Distâncias: paralaxe (CNS3 / BSC5), literatura recente (estrelas famosas)
   ou estimativa espectroscópica (tipo MK → magnitude absoluta), marcadas.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, PC, LY, bvToKelvin, kelvinToRGB, band, fetchBin, fetchJSON, LOGDEPTH_V, LOGDEPTH_V_MAIN, LOGDEPTH_F, LOGDEPTH_F_MAIN } from './u-core.mjs';

const STAR_V = `${LOGDEPTH_V}
attribute float mv; attribute vec3 color; attribute float src;
uniform float dpr; uniform float rToPc; uniform float lim; uniform float opacity; uniform float srcMode; uniform float hideSun;
varying vec3 vC; varying float vA; varying float vCore;
void main(){
  vec4 mvp = modelViewMatrix * vec4(position, 1.0);
  float dpc = max(length(mvp.xyz) * rToPc, 1e-7);
  float m = mv + 5.0 * log(dpc) / log(10.0) - 5.0;
  float f = pow(10.0, -0.4 * (m - lim));
  vA = clamp(f, 0.0, 1.0) * opacity;
  if (hideSun > 0.5 && mv > 4.82 && mv < 4.84 && dot(position, position) < 1e-12) vA = 0.0;
  float sz = 1.5 + 1.6 * log(1.0 + f * 0.3);
  gl_PointSize = clamp(sz, 1.5, 9.0) * dpr;
  vCore = clamp(f * 0.12, 0.0, 1.0);
  vC = color;
  if (srcMode > 0.5) vC = src < 0.5 ? vec3(0.35,0.85,1.0) : src < 1.5 ? vec3(0.45,1.0,0.55) : vec3(1.0,0.72,0.3);
  gl_Position = projectionMatrix * mvp;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  ${LOGDEPTH_V_MAIN}
}`;
const STAR_F = `${LOGDEPTH_F}
varying vec3 vC; varying float vA; varying float vCore;
void main(){ ${LOGDEPTH_F_MAIN}
  vec2 c = gl_PointCoord * 2.0 - 1.0; float r2 = dot(c, c); if (r2 > 1.0) discard;
  float psf = exp(-r2 * 5.5) + 0.18 * exp(-r2 * 1.6) * vCore;
  vec3 col = mix(vC, vec3(1.0), exp(-r2 * 14.0) * 0.55);
  gl_FragColor = vec4(col * psf * vA * 1.5, 1.0);
  #include <colorspace_fragment>
}`;

const GREEK = { Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η', The: 'θ', Iot: 'ι', Kap: 'κ', Lam: 'λ', Mu: 'μ', Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ', Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω' };
export function prettyBSC(s) {
  const m = /^(\d+)?\s*([A-Z][a-z]{1,2})?(\d)?\s*([A-Z][A-Za-z]{2})$/.exec((s || '').trim());
  if (!m) return (s || '').trim();
  const [, fl, by, sup, con] = m;
  if (by && GREEK[by]) return GREEK[by] + (sup ? '<sup>' + sup + '</sup>' : '') + ' ' + con;
  return (fl ? fl + ' ' : '') + con;
}
const plain = s => s.replace(/<sup>(\d)<\/sup>/g, '$1');

export function createStarLayer(engine) {
  const group = new THREE.Group();
  let data = null, mat = null, lineMat = null, lines = null;
  const objs = [];
  let srcMode = 0, consOn = true;
  const layer = {
    id: 'stars', name: 'Estrelas', kind: 'obs', source: 'Gliese & Jahreiß CNS3 (1991) + Yale Bright Star Catalogue 5 (via NASA HEASARC)',
    group, range: [6.5, 20.5], fade: 0.5, objs,
    get srcMode() { return srcMode; }, set srcMode(v) { srcMode = v ? 1 : 0; engine.invalidate(); },
    get consOn() { return consOn; }, set consOn(v) { consOn = v; engine.invalidate(); },
    async load() {
      if (this._loading) return this._loading;
      return (this._loading = (async () => {
        const [buf, meta] = await Promise.all([fetchBin('/data/universe/stars.bin'), fetchJSON('/data/universe/stars.json')]);
        const all = new Float32Array(buf);
        const N0 = meta.n, N = engine.mobile ? Math.min(N0, 7000) : N0;
        const pos = new Float32Array((N + 1) * 3), mv = new Float32Array(N + 1), col = new Float32Array((N + 1) * 3), src = new Float32Array(N + 1);
        for (let i = 0; i < N; i++) {
          pos.set(all.subarray(i * 5, i * 5 + 3), i * 3);
          mv[i] = all[i * 5 + 3];
          col.set(kelvinToRGB(bvToKelvin(all[i * 5 + 4])), i * 3);
          const s = meta.meta[i]?.[4]; src[i] = s === 'p' ? 0 : s === 'k' ? 1 : 2;
        }
        /* o Sol, como estrela, para quando saímos do Sistema Solar */
        mv[N] = 4.83; col.set(kelvinToRGB(5772), N * 3); src[N] = 1;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('mv', new THREE.BufferAttribute(mv, 1));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setAttribute('src', new THREE.BufferAttribute(src, 1));
        mat = new THREE.ShaderMaterial({ vertexShader: STAR_V, fragmentShader: STAR_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          uniforms: { dpr: { value: 1 }, rToPc: { value: 1 }, lim: { value: 6.5 }, opacity: { value: 1 }, srcMode: { value: 0 }, hideSun: { value: 1 } } });
        const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 12;
        group.add(pts);
        /* constelações: segmentos entre posições 3D reais */
        const seg = [];
        for (const pairs of Object.values(meta.lines)) for (const [a, b] of pairs) if (a < N && b < N) seg.push(...pos.subarray(a * 3, a * 3 + 3), ...pos.subarray(b * 3, b * 3 + 3));
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
        lineMat = new THREE.ShaderMaterial({
          vertexShader: `${LOGDEPTH_V}\nvoid main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); ${LOGDEPTH_V_MAIN} }`,
          fragmentShader: `${LOGDEPTH_F}\nuniform float opacity; void main(){ ${LOGDEPTH_F_MAIN} gl_FragColor = vec4(vec3(0.45,0.62,0.95)*opacity, 1.0);\n#include <colorspace_fragment>\n}`,
          uniforms: { opacity: { value: 0.3 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        lines = new THREE.LineSegments(lg, lineMat); lines.frustumCulled = false; lines.renderOrder = 12; group.add(lines);
        /* objetos com nome (pesquisa / rótulos) */
        for (let i = 0; i < N; i++) {
          const m = meta.meta[i]; if (!m) continue;
          const pt = meta.names[i];
          const desig = prettyBSC(m[0]);
          if (!pt && !(all[i * 5 + 3] < 1.2) && !(m[3] < 3.2) && !(Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]) < 5.5)) { objs.push({ i, lite: true, meta: m }); continue; }
          const p = [pos[i * 3] * PC, pos[i * 3 + 1] * PC, pos[i * 3 + 2] * PC];
          objs.push({ i, id: 'star' + i, name: pt || plain(desig), desig, aka: [m[0].trim(), m[1], m[5] ? 'HR ' + m[5] : ''].filter(Boolean), cat: 'Estrela', kind: 'obs', layer: 'stars', star: { mv: all[i * 5 + 3], bv: all[i * 5 + 4], sp: m[2], V: m[3], src: m[4], hr: m[5], gl: m[1] || (m[0].startsWith('Gl') ? m[0] : '') }, view: 16.6, getPos: () => p, named: !!pt });
        }
        data = { meta, all, N, pos };
        engine.invalidate();
      })());
    },
    get data() { return data; },
    starObj(i) {
      const o = objs.find(x => x.i === i);
      if (o && !o.lite) return o;
      const m = data.meta.meta[i] || ['', '', '', 0, 's', 0];
      const p = [data.pos[i * 3] * PC, data.pos[i * 3 + 1] * PC, data.pos[i * 3 + 2] * PC];
      return { id: 'star' + i, name: plain(prettyBSC(m[0])) || 'Estrela', desig: prettyBSC(m[0]), cat: 'Estrela', kind: 'obs', layer: 'stars', star: { mv: data.all[i * 5 + 3], bv: data.all[i * 5 + 4], sp: m[2], V: m[3], src: m[4], hr: m[5], gl: m[1] }, view: 16.6, getPos: () => p };
    },
    findHR(hr) { if (!data) return null; for (const [i, m] of Object.entries(data.meta.meta)) if (m[5] === hr) return this.starObj(+i); return null; },
    findGl(gl) { if (!data) return null; for (const [i, m] of Object.entries(data.meta.meta)) if (m[0].trim() === gl || m[1].trim() === gl) return this.starObj(+i); return null; },
    update(ctx, op) {
      if (!mat) { this.load(); return; }
      engine.setGroup(group, [0, 0, 0], PC);
      mat.uniforms.dpr.value = ctx.dpr;
      mat.uniforms.rToPc.value = ctx.R / PC;
      /* "exposição": magnitude limite 6,5 (olho humano) perto do Sol, mais alta ao afastar */
      mat.uniforms.lim.value = 6.6 + Math.max(0, ctx.s - 16.3) * 1.5;
      mat.uniforms.opacity.value = op;
      mat.uniforms.srcMode.value = srcMode;
      mat.uniforms.hideSun.value = ctx.s < 14.6 ? 1 : 0;
      const cf = consOn ? band(ctx.s, 6.5, 17.7, 0.5) : 0;
      lines.visible = cf > 0.01; lineMat.uniforms.opacity.value = 0.32 * cf * op;
    },
    labels(ctx, out, op) {
      if (!data) return;
      const C = ctx.C, lim = 6.6 + Math.max(0, ctx.s - 16.3) * 1.5;
      for (const o of objs) {
        if (o.lite || (!o.named && ctx.s < 15.5)) continue;
        const p = o.getPos();
        const dpc = Math.hypot(p[0] - C[0], p[1] - C[1], p[2] - C[2]) / PC;
        const m = o.star.mv + 5 * Math.log10(Math.max(dpc, 1e-6)) - 5;
        if (m > lim - 3.2) continue;
        out.push({ text: o.name, pos: p, prio: 30 + (lim - m) * 2 + (o.named ? 8 : 0), obj: o, cls: 'is-star', alpha: op });
      }
    },
    pick(ctx, x, y) {
      if (!data) return null;
      const g = group.children[0]; if (!g) return null;
      const m4 = new THREE.Matrix4().multiplyMatrices(engine.camera.projectionMatrix, engine.camera.matrixWorldInverse).multiply(group.matrixWorld);
      const e = m4.elements, P = data.pos, lim = mat.uniforms.lim.value, rToPc = ctx.R / PC;
      const mv4 = new THREE.Matrix4().multiplyMatrices(engine.camera.matrixWorldInverse, group.matrixWorld).elements;
      let best = null;
      for (let i = 0; i < data.N; i++) {
        const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
        const w = e[3] * px + e[7] * py + e[11] * pz + e[15]; if (w <= 0) continue;
        const sx = ((e[0] * px + e[4] * py + e[8] * pz + e[12]) / w + 1) / 2 * ctx.w, sy = (1 - (e[1] * px + e[5] * py + e[9] * pz + e[13]) / w) / 2 * ctx.h;
        const d2 = (sx - x) ** 2 + (sy - y) ** 2; if (d2 > 144) continue;
        const vx = mv4[0] * px + mv4[4] * py + mv4[8] * pz + mv4[12], vy = mv4[1] * px + mv4[5] * py + mv4[9] * pz + mv4[13], vz = mv4[2] * px + mv4[6] * py + mv4[10] * pz + mv4[14];
        const mag = data.all[i * 5 + 3] + 5 * Math.log10(Math.max(Math.hypot(vx, vy, vz) * rToPc, 1e-6)) - 5;
        if (mag > lim) continue;
        const score = d2 + mag * 6;
        if (!best || score < best.score) best = { i, d2, score };
      }
      return best ? { obj: this.starObj(best.i), d2: best.d2 } : null;
    },
  };
  return layer;
}

/* ═════════════════════ sistemas com exoplanetas ═════════════════════ */
const EXO_V = `${LOGDEPTH_V}
uniform float dpr; uniform float opacity; varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 9.0 * dpr; vA = opacity; ${LOGDEPTH_V_MAIN} }`;
const EXO_F = `${LOGDEPTH_F}
varying float vA;
void main(){ ${LOGDEPTH_F_MAIN} vec2 c = gl_PointCoord*2.0-1.0; float r = length(c); float a = smoothstep(1.0,0.85,r)*smoothstep(0.55,0.72,r); if (a < 0.02) discard;
  gl_FragColor = vec4(vec3(0.45,1.0,0.7)*a*vA, 1.0);
  #include <colorspace_fragment>
}`;
export function createExoLayer(engine) {
  const group = new THREE.Group();
  let data = null, mat = null;
  const objs = [];
  const layer = {
    id: 'exo', name: 'Estrelas com planetas conhecidos', kind: 'obs', source: 'NASA Exoplanet Archive (tabela PSCompPars)', enabled: false,
    group, range: [15.2, 20.6], fade: 0.5, objs,
    async load() {
      if (this._loading) return this._loading;
      return (this._loading = (async () => {
        const [buf, meta] = await Promise.all([fetchBin('/data/universe/exo.bin'), fetchJSON('/data/universe/exo.json')]);
        const pos = new Float32Array(buf);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        mat = new THREE.ShaderMaterial({ vertexShader: EXO_V, fragmentShader: EXO_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { dpr: { value: 1 }, opacity: { value: 1 } } });
        const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 13; group.add(pts);
        meta.hosts.forEach((h, i) => {
          const p = [pos[i * 3] * PC, pos[i * 3 + 1] * PC, pos[i * 3 + 2] * PC];
          objs.push({ id: 'exo:' + h[0], name: h[0], cat: h[3].length > 1 ? `Sistema com ${h[3].length} planetas` : 'Estrela com planeta', kind: 'obs', layer: 'exo', exo: { teff: h[1], dpc: h[2], planets: h[3], methods: meta.methods }, view: 16.4, getPos: () => p, near: h[2] < 15 });
        });
        data = { meta, pos };
        engine.invalidate();
      })());
    },
    find(name) { return objs.find(o => o.name === name); },
    update(ctx, op) {
      if (!mat) { if (this.enabled) this.load(); return; }
      engine.setGroup(group, [0, 0, 0], PC);
      mat.uniforms.dpr.value = ctx.dpr; mat.uniforms.opacity.value = op * 0.8;
    },
    labels(ctx, out, op) {
      for (const o of objs) {
        if (!o.near && o.name !== 'TRAPPIST-1') continue;
        const d = engine.distTo(o.getPos()) / LY;
        if (d > Math.pow(10, ctx.s) / LY * 3) continue;
        out.push({ text: o.name, pos: o.getPos(), prio: 18, obj: o, cls: 'is-exo', alpha: op });
      }
    },
    pick(ctx, x, y) { return objs.length ? engine.pickNear(objs, x, y, 10) : null; },
  };
  return layer;
}
