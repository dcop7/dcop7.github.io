/* ══════════════════════════════════════════════════════════════════════
   Universo observável — escalas próximas: Terra e Lua, Sistema Solar.

   Posições: SkyAstro (elementos keplerianos JPL de Standish para os
   planetas; teoria lunar simplificada para a Lua) — o mesmo motor do
   "Céu Esta Noite". Asteroides/TNO: elementos osculadores reais (JPL SBDB)
   propagados por Kepler no vertex shader. Sondas: estado da JPL Horizons
   (1 jan 2026) extrapolado em linha reta (erro desprezável à escala).
   Todos os corpos têm o tamanho REAL; quando ficam abaixo de ~2 px é
   desenhado um marcador (e a legenda avisa que os marcadores não estão à
   escala).
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, AU, KM, D2R, eclToGal, eqToGal, radec, eclToGalMat3, band, smooth, glowTexture, fetchBin, fetchJSON, LOGDEPTH_V, LOGDEPTH_V_MAIN, LOGDEPTH_F, LOGDEPTH_F_MAIN } from './u-core.mjs';

const TEX = '/assets/planets/';
const SA = () => (typeof SkyAstro !== 'undefined' ? SkyAstro : null);
const jdToDate = jd => new Date((jd - 2440587.5) * 86400000);

/* polos de rotação (IAU, RA/Dec J2000) e períodos de rotação (dias) */
const BODIES = [
  { id: 'sun', r: 695700e3, tex: 'sun.jpg', pole: [286.13, 63.87], rot: 25.38, color: '#ffd27a', emissive: true },
  { id: 'mercury', r: 2439.7e3, tex: 'mercury_1024.jpg', pole: [281.01, 61.45], rot: 58.65, color: '#b8a99a', per: 87.969 },
  { id: 'venus', r: 6051.8e3, tex: 'venus_2048.jpg', pole: [272.76, 67.16], rot: -243.0, color: '#e8cf9a', per: 224.701 },
  { id: 'earth', r: 6371e3, tex: 'earth-day-2k.jpg', night: 'earth-lights-2k.jpg', pole: [0, 90], rot: 0.99727, color: '#6fa8ff', per: 365.256, atmo: [0.35, 0.6, 1.0] },
  { id: 'moon', r: 1737.4e3, tex: 'moon.jpg', pole: [270, 66.54], rot: 27.3217, color: '#cfcfcf' },
  { id: 'mars', r: 3389.5e3, tex: 'mars_1024.jpg', pole: [317.68, 52.89], rot: 1.02596, color: '#e07a4f', per: 686.98, atmo: [0.9, 0.55, 0.4] },
  { id: 'jupiter', r: 69911e3, tex: 'jupiter_2048.jpg', pole: [268.06, 64.5], rot: 0.41354, color: '#e3b98a', per: 4332.59 },
  { id: 'saturn', r: 58232e3, tex: 'saturn_2048.jpg', pole: [40.59, 83.54], rot: 0.444, color: '#ead39c', per: 10759.22, ring: [74500e3, 136780e3] },
  { id: 'uranus', r: 25362e3, tex: 'uranus_2048.jpg', pole: [257.31, -15.18], rot: -0.71833, color: '#a6e1e8', per: 30688.5 },
  { id: 'neptune', r: 24622e3, tex: 'neptune_2048.jpg', pole: [299.36, 43.46], rot: 0.6713, color: '#6c8cff', per: 60182 },
];
export const BODY_IDS = BODIES.map(b => b.id);

/* ── posições (m, galáctico heliocêntrico) ── */
const _cache = new Map();
export function bodyPos(id, jd) {
  const k = id + ':' + jd; const c = _cache.get(k); if (c) return c;
  let p = [0, 0, 0];
  const sa = SA();
  if (id !== 'sun' && sa) {
    const d = jdToDate(jd);
    if (id === 'moon') {
      const e = bodyPos('earth', jd), g = sa.moonGeo(d);
      const v = radec(g.ra, g.dec, g.dist * 6378.14e3);
      p = [e[0] + v[0], e[1] + v[1], e[2] + v[2]];
    } else {
      const h = sa.helio(id, d);
      p = eclToGal([h.x * AU, h.y * AU, h.z * AU]);
    }
  }
  if (_cache.size > 400) _cache.clear();
  _cache.set(k, p);
  return p;
}

/* ── shaders ── */
const PLANET_V = `${LOGDEPTH_V}
varying vec3 vN; varying vec3 vP; varying vec2 vUv;
void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp; ${LOGDEPTH_V_MAIN} }`;
const PLANET_F = `${LOGDEPTH_F}
uniform sampler2D map; uniform sampler2D night; uniform float hasNight; uniform vec3 sunPos; uniform float emissive; uniform vec3 atmo; uniform float hasAtmo; uniform float opacity;
varying vec3 vN; varying vec3 vP; varying vec2 vUv;
void main(){ ${LOGDEPTH_F_MAIN}
  vec3 tex = texture2D(map, vUv).rgb;
  vec3 N = normalize(vN), L = normalize(sunPos - vP), V = normalize(-vP);
  float nl = dot(N, L);
  vec3 col;
  if (emissive > 0.5) { col = tex * 2.6; }
  else {
    float d = max(nl, 0.0);
    col = tex * (d * 1.15 + 0.012);
    if (hasNight > 0.5) col += texture2D(night, vUv).rgb * vec3(1.0,0.85,0.6) * 0.55 * smoothstep(0.08, -0.18, nl);
    if (hasAtmo > 0.5) { float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6); col += atmo * rim * smoothstep(-0.25, 0.4, nl) * 0.75; }
  }
  gl_FragColor = vec4(col, opacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const MARK_V = `${LOGDEPTH_V}
attribute vec3 color; attribute float size; varying vec3 vC; uniform float dpr;
void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * dpr; ${LOGDEPTH_V_MAIN} }`;
const MARK_F = `${LOGDEPTH_F}
varying vec3 vC; uniform float opacity;
void main(){ ${LOGDEPTH_F_MAIN} vec2 c = gl_PointCoord*2.0-1.0; float r = length(c);
  float ring = smoothstep(1.0,0.82,r) * smoothstep(0.45,0.62,r); float core = smoothstep(0.42,0.0,r);
  float a = max(ring*0.9, core); if (a < 0.01) discard; gl_FragColor = vec4(vC * (0.6 + core*0.8), a*opacity);
  #include <colorspace_fragment>
}`;

const LINE_V = `${LOGDEPTH_V}
uniform vec3 uColor; varying float vFade; attribute float fade;
void main(){ vFade = fade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); ${LOGDEPTH_V_MAIN} }`;
const LINE_F = `${LOGDEPTH_F}
uniform vec3 uColor; uniform float opacity; varying float vFade;
void main(){ ${LOGDEPTH_F_MAIN} gl_FragColor = vec4(uColor, opacity * vFade);
  #include <colorspace_fragment>
}`;
export function lineMaterial(color, opacity = 0.5) {
  return new THREE.ShaderMaterial({ vertexShader: LINE_V, fragmentShader: LINE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, opacity: { value: opacity } } });
}
/** linha a partir de pontos [x,y,z]...; fade opcional por vértice */
export function makeLine(pts, color, opacity, loop = false, fades) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
  g.setAttribute('fade', new THREE.Float32BufferAttribute(fades || pts.map(() => 1), 1));
  const L = new (loop ? THREE.LineLoop : THREE.Line)(g, lineMaterial(color, opacity));
  L.frustumCulled = false;
  return L;
}

function poleQuat(pole, spinRad) {
  /* base local de THREE.SphereGeometry: +Y = polo, +X = longitude 0, −Z = longitude 90° E */
  const P = new THREE.Vector3(...radec(pole[0], pole[1])).normalize();
  const node = new THREE.Vector3().crossVectors(new THREE.Vector3(...eqToGal([0, 0, 1])), P);
  if (node.lengthSq() < 1e-8) node.set(...eqToGal([1, 0, 0]));
  node.normalize();
  const x = node.clone().applyAxisAngle(P, spinRad);
  const z = new THREE.Vector3().crossVectors(x, P);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, P, z));
}
function earthQuat(jd) {
  /* GMST (IAU 1982) → longitude 0 da Terra no referencial equatorial */
  const T = (jd - 2451545.0) / 36525;
  const g = (280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T) * D2R;
  const x = new THREE.Vector3(...eqToGal([Math.cos(g), Math.sin(g), 0]));
  const P = new THREE.Vector3(...eqToGal([0, 0, 1]));
  const z = new THREE.Vector3().crossVectors(x, P);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, P, z));
}

/* ═════════════════════ camada: corpos do Sistema Solar ═════════════════════ */
export function createSolarLayer(engine) {
  const group = new THREE.Group();
  const loader = new THREE.TextureLoader();
  const meshes = {};
  const objs = {};
  const tex = f => { const t = loader.load(TEX + f, () => engine.invalidate()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const sphere = new THREE.SphereGeometry(1, 96, 64);
  for (const b of BODIES) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: PLANET_V, fragmentShader: PLANET_F, transparent: false,
      uniforms: { map: { value: null }, night: { value: null }, hasNight: { value: b.night ? 1 : 0 }, sunPos: { value: new THREE.Vector3() }, emissive: { value: b.emissive ? 1 : 0 }, atmo: { value: new THREE.Vector3(...(b.atmo || [0, 0, 0])) }, hasAtmo: { value: b.atmo ? 1 : 0 }, opacity: { value: 1 } },
    });
    const m = new THREE.Mesh(sphere, mat);
    m.frustumCulled = false; m.visible = false;
    m.userData = { b, loaded: false };
    group.add(m); meshes[b.id] = m;
    if (b.ring) {
      const rg = new THREE.RingGeometry(b.ring[0] / b.r, b.ring[1] / b.r, 160, 1);
      const pos = rg.attributes.position, uv = rg.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - b.ring[0] / b.r) / ((b.ring[1] - b.ring[0]) / b.r), 0.5); }
      const rt = loader.load(TEX + 'saturn-ring.png', () => engine.invalidate()); rt.colorSpace = THREE.SRGBColorSpace;
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xd8ccb4 }));
      ring.rotation.x = -Math.PI / 2; /* RingGeometry está em XY; o equador local é XZ */
      ring.frustumCulled = false; ring.renderOrder = 15;
      m.add(ring);
    }
    objs[b.id] = { id: b.id, r: b.r, color: b.color, getPos: jd => bodyPos(b.id, jd), layer: 'solar' };
  }
  /* sol: brilho */
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(256, 2.6), color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.frustumCulled = false; glow.renderOrder = 15; group.add(glow);

  /* marcadores (um ponto por corpo, tamanho em píxeis) */
  const N = BODIES.length;
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  mg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(BODIES.flatMap(b => new THREE.Color(b.color).toArray())), 3));
  mg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N), 1));
  const markMat = new THREE.ShaderMaterial({ vertexShader: MARK_V, fragmentShader: MARK_F, transparent: true, depthWrite: false, uniforms: { dpr: { value: 1 }, opacity: { value: 1 } } });
  const marks = new THREE.Points(mg, markMat); marks.frustumCulled = false; marks.renderOrder = 16; group.add(marks);

  /* órbitas (UA, origem no Sol) */
  const orbits = new THREE.Group(); group.add(orbits);
  let orbitJd = null;
  function buildOrbits(jd) {
    orbits.clear(); orbitJd = jd;
    for (const b of BODIES) {
      if (!b.per) continue;
      const pts = [];
      for (let i = 0; i <= 360; i++) { const p = bodyPos(b.id, jd + b.per * i / 360); pts.push([p[0] / AU, p[1] / AU, p[2] / AU]); }
      const L = makeLine(pts, b.color, b.id === 'earth' ? 0.55 : 0.32);
      L.userData.body = b.id; L.renderOrder = 14; orbits.add(L);
    }
  }
  /* órbita da Lua (km, origem na Terra) */
  let moonOrbit = null, moonJd = null;
  function buildMoonOrbit(jd) {
    if (moonOrbit) { group.remove(moonOrbit); moonOrbit.geometry.dispose(); }
    moonJd = jd;
    const e0 = bodyPos('earth', jd), pts = [];
    for (let i = 0; i <= 200; i++) { const t = jd + 27.3217 * i / 200; const m = bodyPos('moon', t), e = bodyPos('earth', t); pts.push([(m[0] - e[0]) / KM, (m[1] - e[1]) / KM, (m[2] - e[2]) / KM]); }
    void e0;
    moonOrbit = makeLine(pts, '#9fb4d8', 0.45); moonOrbit.renderOrder = 14;
    group.add(moonOrbit);
  }

  const layer = {
    id: 'solar', name: 'Sol, planetas e Lua', kind: 'calc', source: 'Elementos orbitais JPL · texturas NASA e Solar System Scope (CC BY 4.0)',
    group, range: [6.5, 16.2], fade: 0.5, objs,
    update(ctx, op) {
      const jd = ctx.jd;
      if (!SA()) return;
      if (orbitJd == null || Math.abs(jd - orbitJd) > 30) buildOrbits(jd);
      if (moonJd == null || Math.abs(jd - moonJd) > 1) buildMoonOrbit(jd);
      const sunR = engine.toRender([0, 0, 0]);
      const pos = mg.attributes.position, size = mg.attributes.size;
      BODIES.forEach((b, i) => {
        const p = bodyPos(b.id, jd), m = meshes[b.id];
        const rp = engine.toRender(p);
        const distM = engine.distTo(p);
        const px = b.r / distM * ctx.pxPerRad;
        if (!m.userData.loaded && (px > 1.2 || b.id === 'earth' || b.id === 'moon')) {
          m.userData.loaded = true;
          m.material.uniforms.map.value = tex(b.tex);
          if (b.night) m.material.uniforms.night.value = tex(b.night);
        }
        m.visible = px > 0.6 && m.userData.loaded;
        m.position.copy(rp); m.scale.setScalar(b.r * ctx.k);
        m.quaternion.copy(b.id === 'earth' ? earthQuat(jd) : b.id === 'moon' ? moonQuat(jd) : poleQuat(b.pole, 2 * Math.PI * ((jd % Math.abs(b.rot)) / b.rot)));
        m.material.uniforms.sunPos.value.copy(sunR);
        pos.setXYZ(i, rp.x, rp.y, rp.z);
        /* o marcador desaparece quando o corpo real já se vê */
        const isMoonFar = b.id === 'moon' && ctx.s > 10.4;
        size.setX(i, px > 3.5 || isMoonFar ? 0 : (b.id === 'sun' ? 9 : 7));
      });
      pos.needsUpdate = true; size.needsUpdate = true;
      markMat.uniforms.dpr.value = ctx.dpr; markMat.uniforms.opacity.value = op;
      /* brilho do Sol: tamanho angular fixo enquanto estamos no Sistema Solar */
      glow.position.copy(sunR);
      const sunPx = 695700e3 / engine.distTo([0, 0, 0]) * ctx.pxPerRad;
      const gpx = Math.max(sunPx * 5, 26 + 30 * band(ctx.s, 9, 15.5, 1));
      const sc = gpx / ctx.pxPerRad * sunR.length() * 2;
      glow.scale.setScalar(sc); glow.material.opacity = op * (ctx.s < 15.6 ? 1 : 0.6);
      engine.setGroup(orbits, [0, 0, 0], AU);
      const oFade = band(ctx.s, 9.6, 14.6, 0.6);
      orbits.children.forEach(L => { L.material.uniforms.opacity.value = (L.userData.body === 'earth' ? 0.55 : 0.32) * oFade * op; L.visible = oFade > 0.01; });
      if (moonOrbit) { engine.setGroup(moonOrbit, bodyPos('earth', jd), KM); moonOrbit.material.uniforms.opacity.value = 0.5 * band(ctx.s, 7.6, 10.4, 0.5) * op; }
    },
    labels(ctx, out, op) {
      for (const b of BODIES) {
        const p = bodyPos(b.id, ctx.jd);
        if (b.id === 'moon' && ctx.s > 10.6) continue;
        if (b.id !== 'sun' && b.id !== 'earth' && ctx.s > 14.4) continue;
        out.push({ text: NAMES[b.id], pos: p, prio: b.id === 'earth' || b.id === 'sun' ? 90 : 70, obj: objs[b.id], cls: 'is-body', alpha: op });
      }
    },
    pick(ctx, x, y) { return engine.pickNear(Object.values(objs).filter(o => !(o.id === 'moon' && ctx.s > 10.6)), x, y, 16); },
  };
  return layer;
}
const NAMES = { sun: 'Sol', mercury: 'Mercúrio', venus: 'Vénus', earth: 'Terra', moon: 'Lua', mars: 'Marte', jupiter: 'Júpiter', saturn: 'Saturno', uranus: 'Úrano', neptune: 'Neptuno' };
function moonQuat(jd) {
  /* rotação síncrona: a face visível (longitude 0) aponta para a Terra */
  const m = bodyPos('moon', jd), e = bodyPos('earth', jd);
  const x = new THREE.Vector3(e[0] - m[0], e[1] - m[1], e[2] - m[2]).normalize();
  const P0 = new THREE.Vector3(...eclToGal([0, 0, 1]));
  const P = P0.clone().addScaledVector(x, -P0.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, P);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, P, z));
}

/* ═════════════════════ camada: asteroides e TNO (JPL SBDB) ═════════════════════ */
const SB_V = `${LOGDEPTH_V}
attribute float a; attribute vec4 el; attribute float m0; attribute vec2 hc;
uniform float uDays; uniform mat3 eclGal; uniform float dpr; uniform float opacity; uniform float innerK;
varying vec3 vC; varying float vA;
const float TAU = 6.28318530718;
vec3 classColor(float c){
  if (c < 3.5) return vec3(0.85,0.78,0.66);
  if (c < 7.5) return vec3(1.0,0.45,0.35);
  if (c < 8.5) return vec3(0.55,0.95,0.6);
  if (c < 9.5) return vec3(0.85,0.6,1.0);
  if (c < 10.5) return vec3(0.55,0.78,1.0);
  return vec3(1.0,0.9,0.5);
}
void main(){
  float e = el.x, inc = el.y * 3.14159265, Om = el.z * TAU, w = el.w * TAU;
  float n = 0.01720209895 / (a * sqrt(a));
  float M = mod(m0 * TAU + n * uDays, TAU);
  float E = M + e * sin(M);
  for (int k = 0; k < 5; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float xp = a * (cos(E) - e), yp = a * sqrt(1.0 - e * e) * sin(E);
  float cw = cos(w), sw = sin(w), cO = cos(Om), sO = sin(Om), ci = cos(inc), si = sin(inc);
  vec3 p = vec3((cw*cO - sw*sO*ci)*xp + (-sw*cO - cw*sO*ci)*yp,
                (cw*sO + sw*cO*ci)*xp + (-sw*sO + cw*cO*ci)*yp,
                (sw*si)*xp + (cw*si)*yp);
  vec4 mv = modelViewMatrix * vec4(eclGal * p, 1.0);
  gl_Position = projectionMatrix * mv;
  float H = hc.x * 0.1;
  vA = clamp(0.12 + (15.5 - H) * 0.05, 0.08, 0.8) * opacity * (hc.y < 3.5 ? 0.55 : 1.0) * (hc.y < 8.5 ? innerK : 1.0);
  gl_PointSize = (1.4 + clamp((12.0 - H) * 0.25, 0.0, 2.2)) * dpr;
  vC = classColor(hc.y);
  ${LOGDEPTH_V_MAIN}
}`;
const SB_F = `${LOGDEPTH_F}
varying vec3 vC; varying float vA;
void main(){ ${LOGDEPTH_F_MAIN} vec2 c = gl_PointCoord*2.0-1.0; float r = dot(c,c); if (r > 1.0) discard;
  gl_FragColor = vec4(vC * vA * (1.0 - r*0.6), 1.0);
  #include <colorspace_fragment>
}`;

export function createSmallBodyLayer(engine) {
  const group = new THREE.Group();
  let mat = null, meta = null, loading = false;
  const craftObjs = [];
  const layer = {
    id: 'smallbody', name: 'Asteroides, troianos e objetos transneptunianos', kind: 'obs', source: 'JPL Small-Body Database (H < 15,2): 55 800 órbitas reais',
    group, range: [10.3, 14.6], fade: 0.45, craftObjs,
    async load() {
      if (loading) return; loading = true;
      const [buf, m] = await Promise.all([fetchBin('/data/universe/smallbody.bin'), fetchJSON('/data/universe/smallbody.json')]);
      meta = m; const N = m.n;
      const fa = new Float32Array(buf, 0, N), q = new Uint16Array(buf, N * 4, N * 5), h = new Uint8Array(buf, N * 4 + N * 10, N * 2);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      g.setAttribute('a', new THREE.BufferAttribute(fa, 1));
      const ib = new THREE.InterleavedBuffer(q, 5);
      g.setAttribute('el', new THREE.InterleavedBufferAttribute(ib, 4, 0, true));
      g.setAttribute('m0', new THREE.InterleavedBufferAttribute(ib, 1, 4, true));
      g.setAttribute('hc', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(h, 2), 2, 0, false));
      mat = new THREE.ShaderMaterial({ vertexShader: SB_V, fragmentShader: SB_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uDays: { value: 0 }, eclGal: { value: eclToGalMat3() }, dpr: { value: 1 }, opacity: { value: 1 }, innerK: { value: 1 } } });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 14;
      group.add(pts);
      this._el = { fa, q };
      for (const c of m.craft) craftObjs.push({ id: 'craft' + c.id, name: c.name.replace(' (spacecraft)', ''), cat: 'Sonda espacial', kind: 'obs', layer: 'smallbody', getPos: jd => { const t = jd - c.jd; return eclToGal([(c.pos[0] + c.vel[0] * t) * AU, (c.pos[1] + c.vel[1] * t) * AU, (c.pos[2] + c.vel[2] * t) * AU]); } });
      engine.invalidate();
    },
    get named() { return meta?.named || []; },
    /** posição (m) do corpo i — o mesmo Kepler do shader, em JS */
    posOf(i, jd) {
      if (!this._el) return [0, 0, 0];
      const { fa, q } = this._el, TAU = Math.PI * 2;
      const a = fa[i], e = q[i * 5] / 65535, inc = q[i * 5 + 1] / 65535 * Math.PI, Om = q[i * 5 + 2] / 65535 * TAU, w = q[i * 5 + 3] / 65535 * TAU;
      const M = ((q[i * 5 + 4] / 65535 * TAU + 0.01720209895 / Math.pow(a, 1.5) * (jd - meta.epoch)) % TAU + TAU) % TAU;
      let E = M + e * Math.sin(M); for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(inc), si = Math.sin(inc);
      return eclToGal([((cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp) * AU, ((cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp) * AU, ((sw * si) * xp + (cw * si) * yp) * AU]);
    },
    update(ctx, op) {
      if (!mat) { this.load(); return; }
      engine.setGroup(group, [0, 0, 0], AU);
      mat.uniforms.uDays.value = ctx.jd - meta.epoch;
      mat.uniforms.dpr.value = ctx.dpr; mat.uniforms.opacity.value = op;
      /* de longe, 50 mil asteroides somados em poucos píxeis viram uma mancha: atenuar a cintura e os troianos */
      mat.uniforms.innerK.value = 1 - smooth(11.9, 13.3, ctx.s) * 0.82;
    },
    labels(ctx, out, op) {
      for (const c of craftObjs) out.push({ text: c.name, pos: c.getPos(ctx.jd), prio: 40, obj: c, cls: 'is-craft', alpha: op });
    },
    pick(ctx, x, y) { return engine.pickNear(craftObjs, x, y, 14); },
  };
  return layer;
}

/* ═════════════════════ camada: heliopausa (esquema) e Nuvem de Oort (hipotética) ═════════════════════ */
const SHELL_V = `${LOGDEPTH_V}
varying vec3 vP; varying vec3 vC;
void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xyz; vC = (modelMatrix * vec4(0.,0.,0.,1.)).xyz; gl_Position = projectionMatrix * viewMatrix * wp; ${LOGDEPTH_V_MAIN} }`;
const SHELL_F = `${LOGDEPTH_F}
uniform vec3 uColor; uniform float opacity; uniform float rIn; uniform float rOut;
varying vec3 vP; varying vec3 vC;
/* comprimento do raio dentro de uma casca esférica [rIn,rOut] (unidades do raio exterior) */
vec2 sph(vec3 ro, vec3 rd, float r){ float b = dot(ro, rd); float c = dot(ro, ro) - r*r; float h = b*b - c; if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b-h, -b+h); }
void main(){ ${LOGDEPTH_F_MAIN}
  vec3 rd = normalize(vP); vec3 ro = -vC;
  vec2 o = sph(ro, rd, rOut); if (o.y < 0.0) discard;
  float t0 = max(o.x, 0.0), t1 = o.y, len = t1 - t0;
  vec2 i = sph(ro, rd, rIn);
  if (i.y > 0.0) len -= max(0.0, min(i.y, t1) - max(i.x, t0));
  float a = clamp(len / (2.0 * rOut), 0.0, 1.0);
  gl_FragColor = vec4(uColor * a * opacity, 1.0);
  #include <colorspace_fragment>
}`;
export function createShellLayer(engine, { id, name, kind, source, rIn, rOut, color, range, strength }) {
  const mat = new THREE.ShaderMaterial({ vertexShader: SHELL_V, fragmentShader: SHELL_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, opacity: { value: 1 }, rIn: { value: 1 }, rOut: { value: 1 } } });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat); mesh.frustumCulled = false; mesh.renderOrder = 11;
  const group = new THREE.Group(); group.add(mesh);
  return {
    id, name, kind, source, group, range, fade: 0.6,
    update(ctx, op) {
      engine.setGroup(group, [0, 0, 0], rOut);
      const k = rOut * ctx.k;
      mat.uniforms.rOut.value = k; mat.uniforms.rIn.value = rIn * ctx.k; mat.uniforms.opacity.value = op * strength;
    },
  };
}
