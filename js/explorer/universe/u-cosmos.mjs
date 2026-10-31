/* ══════════════════════════════════════════════════════════════════════
   Universo observável — escalas cósmicas.

   • ZCAT (CfA, Huchra et al.): 37 600 galáxias com redshift, quase todo o
     céu fora do plano da Via Láctea — é aqui que se vê a Grande Muralha.
   • SDSS DR18: 261 000 galáxias com z < 0,2 (1 fibra em cada 3), 72 000
     galáxias vermelhas 0,2–0,8 e 90 000 quasares até z ≈ 7.
   • Distância = distância comóvel calculada a partir do redshift (ΛCDM,
     Planck 2018). Por isso há "dedos de Deus" (enxames esticados na linha de
     visão) — é um efeito real dos mapas em redshift, explicado no painel.
   • As cunhas e faixas são a parte do céu coberta pelos levantamentos.
   • Fundo cósmico: WMAP 9 anos (mapa ILC), numa esfera à distância comóvel
     da última difusão (z ≈ 1090).
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, MPC, LY, GPC, comovingMpc, band, words, fetchBin, fetchJSON, LOGDEPTH_V, LOGDEPTH_V_MAIN, LOGDEPTH_F, LOGDEPTH_F_MAIN } from './u-core.mjs';
import { makeLine } from './u-near.mjs';

const GAL_V = `${LOGDEPTH_V}
attribute float qw; uniform float qScale; uniform float dpr; uniform float opacity; uniform float size; uniform float mode; uniform float nSplit;
varying vec3 vC;
void main(){
  vec3 p = position * qScale;
  float W = qw * 32767.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * dpr;
  if (mode < 0.5) {        /* ZCAT: cor pelo tipo morfológico T */
    float T = W;
    vC = T > 50.0 ? vec3(0.85, 0.85, 0.8) : (T < -0.5 ? vec3(1.0, 0.72, 0.45) : mix(vec3(0.95, 0.85, 0.7), vec3(0.6, 0.75, 1.0), clamp(T / 8.0, 0.0, 1.0)));
  } else if (mode < 1.5) { /* SDSS z<0.2: cor suave pela distância */
    float z = W / 150000.0;
    vC = mix(vec3(1.0, 0.86, 0.62), vec3(0.62, 0.78, 1.0), clamp(z / 0.2, 0.0, 1.0));
  } else {                 /* profundo: galáxias vermelhas e quasares */
    vC = float(gl_VertexID) < nSplit ? vec3(1.0, 0.5, 0.32) : vec3(0.62, 0.55, 1.0);
  }
  vC *= opacity;
  ${LOGDEPTH_V_MAIN}
}`;
const GAL_F = `${LOGDEPTH_F}
varying vec3 vC;
void main(){ ${LOGDEPTH_F_MAIN} vec2 c = gl_PointCoord*2.0-1.0; float r2 = dot(c,c); if (r2 > 1.0) discard;
  gl_FragColor = vec4(vC * exp(-r2 * 3.0), 1.0);
  #include <colorspace_fragment>
}`;

function galaxyPoints(buf, scale, mode, nSplit = 0, limit = Infinity) {
  const q = new Int16Array(buf);
  const N = Math.min(q.length / 4, limit);
  const g = new THREE.BufferGeometry();
  const ib = new THREE.InterleavedBuffer(q.subarray(0, N * 4), 4);
  g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0, true));
  g.setAttribute('qw', new THREE.InterleavedBufferAttribute(ib, 1, 3, true));
  const m = new THREE.ShaderMaterial({ vertexShader: GAL_V, fragmentShader: GAL_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { qScale: { value: scale }, dpr: { value: 1 }, opacity: { value: 1 }, size: { value: 2 }, mode: { value: mode }, nSplit: { value: nSplit } } });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 1;
  return { points: p, q, N, scale };
}

export function createGalaxyCloudLayer(engine, { id, name, source, file, scale, mode, range, size, gain, nSplit, limit }) {
  const group = new THREE.Group();
  let P = null, loading = false;
  const layer = {
    id, name, kind: 'obs', source, group, range, fade: 0.45,
    async load() {
      if (loading) return; loading = true;
      const buf = await fetchBin(file);
      const meta = mode === 2 ? await fetchJSON('/data/universe/deep-meta.json').catch(() => null) : null;
      P = galaxyPoints(buf, scale, mode, meta?.nGal ?? nSplit ?? 0, engine.mobile ? (limit ?? Infinity) : Infinity);
      group.add(P.points);
      engine.invalidate();
    },
    update(ctx, op) {
      if (!P) { this.load(); return; }
      engine.setGroup(group, [0, 0, 0], MPC);
      const u = P.points.material.uniforms;
      u.dpr.value = ctx.dpr; u.opacity.value = op * gain; u.size.value = size;
    },
    /** escolhe a galáxia mais próxima do clique (projeção em JS) */
    pick(ctx, x, y) {
      if (!P) return null;
      const m4 = new THREE.Matrix4().multiplyMatrices(engine.camera.projectionMatrix, engine.camera.matrixWorldInverse).multiply(group.matrixWorld).elements;
      const q = P.q, k = P.scale / 32767; let best = -1, bd = 64;
      for (let i = 0; i < P.N; i++) {
        const px = q[i * 4] * k, py = q[i * 4 + 1] * k, pz = q[i * 4 + 2] * k;
        const w = m4[3] * px + m4[7] * py + m4[11] * pz + m4[15]; if (w <= 0) continue;
        const sx = ((m4[0] * px + m4[4] * py + m4[8] * pz + m4[12]) / w + 1) / 2 * ctx.w, sy = (1 - (m4[1] * px + m4[5] * py + m4[9] * pz + m4[13]) / w) / 2 * ctx.h;
        const d2 = (sx - x) ** 2 + (sy - y) ** 2; if (d2 < bd) { bd = d2; best = i; }
      }
      if (best < 0) return null;
      const pos = [q[best * 4] * k * MPC, q[best * 4 + 1] * k * MPC, q[best * 4 + 2] * k * MPC];
      const w4 = q[best * 4 + 3];
      const z = mode === 0 ? null : mode === 1 ? w4 / 150000 : w4 / 4000;
      const isQ = mode === 2 && best >= (P.points.material.uniforms.nSplit.value);
      const dMpc = Math.hypot(...pos) / MPC;
      const zz = z ?? zFromComoving(dMpc);
      return { d2: bd, obj: { id: id + ':' + best, name: isQ ? 'Quasar' : mode === 0 ? 'Galáxia (ZCAT)' : 'Galáxia (SDSS)', cat: isQ ? 'Quasar' : mode === 2 ? 'Galáxia vermelha luminosa' : 'Galáxia', kind: 'obs', layer: id, z: zz, survey: mode === 0 ? 'CfA ZCAT' : 'SDSS DR18', getPos: () => pos, view: Math.log10(dMpc * MPC) - 1.2, point: true } };
    },
  };
  return layer;
}
function zFromComoving(d) { let lo = 0, hi = 12; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (comovingMpc(m) < d) lo = m; else hi = m; } return (lo + hi) / 2; }

/* ═════════════════════ enxames de Abell ═════════════════════ */
export function createClusterLayer(engine) {
  const group = new THREE.Group();
  const objs = [];
  let loaded = false;
  const RING_V = `${LOGDEPTH_V}
  attribute float rich; uniform float dpr; uniform float opacity; varying float vA;
  void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (5.0 + rich * 1.5) * dpr; vA = opacity; ${LOGDEPTH_V_MAIN} }`;
  const RING_F = `${LOGDEPTH_F}
  varying float vA;
  void main(){ ${LOGDEPTH_F_MAIN} vec2 c = gl_PointCoord*2.0-1.0; float r = length(c); float a = smoothstep(1.0,0.86,r)*smoothstep(0.62,0.8,r); if (a < 0.02) discard;
    gl_FragColor = vec4(vec3(1.0,0.62,0.85) * a * vA, 1.0);
    #include <colorspace_fragment>
  }`;
  let mat;
  const layer = {
    id: 'clusters', name: 'Enxames de galáxias (Abell)', kind: 'obs', source: 'Catálogo de Abell com redshifts medidos (Andernach, via NASA HEASARC)', group, range: [23.3, 25.35], fade: 0.4, objs,
    async load() {
      if (loaded) return; loaded = true;
      const d = await fetchJSON('/data/universe/clusters.json');
      const pos = [], rich = [];
      for (const c of d.clusters) {
        pos.push(c[1], c[2], c[3]); rich.push(c[5]);
        objs.push({ id: 'abell:' + c[0], name: c[0], cat: 'Enxame de galáxias', kind: 'obs', layer: 'clusters', z: c[4], rich: c[5], view: Math.log10(Math.hypot(c[1], c[2], c[3]) * MPC) - 1.3, getPos: () => [c[1] * MPC, c[2] * MPC, c[3] * MPC] });
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('rich', new THREE.Float32BufferAttribute(rich, 1));
      mat = new THREE.ShaderMaterial({ vertexShader: RING_V, fragmentShader: RING_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { dpr: { value: 1 }, opacity: { value: 1 } } });
      const p = new THREE.Points(g, mat); p.frustumCulled = false; p.renderOrder = 6; group.add(p);
      engine.invalidate();
    },
    update(ctx, op) {
      if (!mat) { this.load(); return; }
      engine.setGroup(group, [0, 0, 0], MPC);
      mat.uniforms.dpr.value = ctx.dpr; mat.uniforms.opacity.value = op * 0.3;
    },
    pick(ctx, x, y) { return engine.pickNear(objs, x, y, 9); },
  };
  return layer;
}

/* ═════════════════════ anéis de distância (no plano galáctico, centrados em nós) ═════════════════════ */
export function createRingsLayer(engine) {
  const group = new THREE.Group();
  const RADII = [];
  for (const k of [3, 4, 5, 6, 7, 8, 9, 10]) for (const m of [1, 3]) RADII.push(m * Math.pow(10, k));
  RADII.push(4.65e10);
  const rings = RADII.map(ly => {
    const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push([Math.cos(a), Math.sin(a), 0]); }
    const L = makeLine(pts, ly === 4.65e10 ? '#ffb36b' : '#8aa4c8', 0.35); L.userData.ly = ly; L.renderOrder = 21; group.add(L); return L;
  });
  const layer = {
    id: 'rings', name: 'Anéis de distância (anos-luz)', kind: 'calc', source: 'Distâncias desde o Sol, no plano da Via Láctea', group, range: [18.4, 27.7], fade: 0.3,
    update(ctx, op) {
      group.position.set(-ctx.C[0] * ctx.k, -ctx.C[1] * ctx.k, -ctx.C[2] * ctx.k);
      group.scale.setScalar(1); group.updateMatrixWorld(true);
      for (const L of rings) {
        const r = L.userData.ly * LY;
        const rel = r / ctx.R;
        const f = THREE.MathUtils.smoothstep(rel, 0.12, 0.35) * (1 - THREE.MathUtils.smoothstep(rel, 2.2, 4.0));
        L.visible = f > 0.01;
        L.scale.setScalar(r * ctx.k); L.updateMatrixWorld(true);
        L.material.uniforms.opacity.value = f * op * (L.userData.ly === 4.65e10 ? 0.7 : 0.32);
      }
    },
    labels(ctx, out, op) {
      for (const L of rings) {
        if (!L.visible) continue;
        const r = L.userData.ly * LY;
        const dir = [ctx.viewDir.x, ctx.viewDir.y, 0]; const n = Math.hypot(dir[0], dir[1]) || 1;
        /* rótulo no ponto do anel mais perto da câmara, um pouco de lado */
        const a = Math.atan2(dir[1] / n, dir[0] / n) + 0.35;
        out.push({ text: L.userData.ly === 4.65e10 ? '46,5 mil milhões de anos-luz' : words(L.userData.ly) + ' anos-luz', pos: [r * Math.cos(a), r * Math.sin(a), 0], prio: 12, cls: 'is-ring', alpha: op * 0.9 });
      }
    },
  };
  return layer;
}

/* ═════════════════════ fundo cósmico de micro-ondas (WMAP) ═════════════════════ */
const CMB_V = `${LOGDEPTH_V}
varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); ${LOGDEPTH_V_MAIN} }`;
const CMB_F = `${LOGDEPTH_F}
uniform sampler2D map; uniform float opacity; varying vec3 vDir;
void main(){ ${LOGDEPTH_F_MAIN}
  vec3 d = normalize(vDir);
  float l = atan(d.y, d.x); float b = asin(clamp(d.z, -1.0, 1.0));
  vec2 uv = vec2(fract(l / 6.2831853 + 1.0), 0.5 + b / 3.14159265);
  vec3 c = texture2D(map, uv).rgb;
  gl_FragColor = vec4(c * opacity * 0.9, 1.0);
  #include <colorspace_fragment>
}`;
/* distância comóvel à última difusão (z ≈ 1090), Planck 2018 com radiação:
   ≈ 13 870 Mpc (≈ 45,2 mil milhões de anos-luz). A tabela de comovingMpc só
   vai até z = 12 (onde a radiação ainda é desprezável). */
export const CMB_R = 13870 * MPC;
export function createCMBLayer(engine) {
  const group = new THREE.Group();
  const tex = new THREE.TextureLoader().load(engine.mobile ? '/data/universe/cmb-lo.webp' : '/data/universe/cmb.webp', () => engine.invalidate());
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  const mat = new THREE.ShaderMaterial({ vertexShader: CMB_V, fragmentShader: CMB_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { map: { value: tex }, opacity: { value: 1 } } });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), mat); mesh.frustumCulled = false; mesh.renderOrder = -1;
  group.add(mesh);
  return {
    id: 'cmb', name: 'Radiação cósmica de fundo (WMAP, 9 anos)', kind: 'obs', source: 'NASA / WMAP Science Team, mapa ILC (LAMBDA) · paleta própria', group, range: [26.35, 28.5], fade: 0.45,
    update(ctx, op) {
      engine.setGroup(group, [0, 0, 0], CMB_R);
      const inside = Math.hypot(...ctx.C) < CMB_R;
      mat.side = inside ? THREE.BackSide : THREE.FrontSide;
      mat.uniforms.opacity.value = op * (inside ? 0.18 : 0.62);
    },
  };
}
export { GPC };
