/* ══════════════════════════════════════════════════════════════════════
   Universo observável — Via Láctea, Grupo Local e galáxias com nome.

   MODELO (não é uma imagem): a Via Láctea é um volume integrado por raio
   (raymarching) a partir de um mapa de densidade calculado no GPU:
     • disco antigo exponencial (Rd = 2,6 kpc), escala vertical 0,3 kpc;
     • braços: espirais logarítmicas com "joelho" de Reid et al. (2019,
       ApJ 885, 131, tabela 2), R₀ = 8,15 kpc; fora do intervalo de azimute
       medido, o braço é EXTRAPOLADO e vai-se apagando;
     • barra a 27° da linha Sol–centro, bojo e poeira (camada fina);
     • a integração vertical é analítica (sech²), por isso a faixa de poeira
       vista de perfil não depende do número de passos.
   OBSERVADO por cima do modelo: masers com paralaxe (Reid+2019), enxames
   globulares (Harris 2010), enxames abertos (Dias+2002).
   Andrómeda, Triângulo e Nuvens de Magalhães usam o mesmo motor com
   parâmetros genéricos e orientação medida (inclinação/PA).
   Galáxias do Grupo Local: posições e raios de meia-luz de McConnachie
   (2012). Galáxias RC3: orientação (PA, b/a) e diâmetro D25 medidos; a
   textura é uma das 6 imagens-tipo geradas por este mesmo modelo.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, KPC, MPC, PC, D2R, radec, band, fetchJSON, LOGDEPTH_V, LOGDEPTH_V_MAIN, LOGDEPTH_F, LOGDEPTH_F_MAIN } from './u-core.mjs';
import { makeLine } from './u-near.mjs';

const R0 = 8.15;
export const GC_POS = [R0 * KPC, 0, 0];

/* ── mapa face-on (gerado uma vez no GPU) ── */
const BAKE_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BAKE_F = `precision highp float;
varying vec2 vUv;
uniform float mode; uniform float rMax; uniform float seed;
uniform vec4 armA[7]; uniform vec4 armB[7];
uniform float nArms; uniform float pitch; uniform float rIn; uniform float rOut; uniform float ringR; uniform float flocc;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21) + seed); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
const float TAU = 6.2831853;
/* braços de Reid+2019: devolve (intensidade, intensidade deslocada para dentro p/ poeira) */
vec2 reidArms(float R, float beta){
  float best = 0.0, dust = 0.0;
  for (int k = 0; k < 7; k++){
    vec4 A = armA[k]; vec4 B = armB[k];   /* A: βk, Rk, tanψ<, tanψ>   B: largura, βmin, βmax, peso */
    for (int w = -1; w <= 1; w++){
      float bt = beta + float(w) * TAU;
      float tp = bt <= A.x ? A.z : A.w;
      float Ra = A.y * exp(-(bt - A.x) * tp);
      if (Ra < 2.2 || Ra > 19.0) continue;
      float cp = cos(atan(tp));
      float width = (B.x + 0.042 * (R - A.y)) * 1.9 + 0.12;
      float d = (R - Ra) * cp;
      float ext = bt < B.y ? (B.y - bt) : (bt > B.z ? bt - B.z : 0.0);
      float fade = exp(-ext / 1.25) * B.w;
      best = max(best, exp(-d*d / (2.0*width*width)) * fade);
      float dd = (R - Ra + 0.22) * cp;
      dust = max(dust, exp(-dd*dd / (2.0*0.45*width*width)) * fade);
    }
  }
  return vec2(best, dust);
}
vec2 genericArms(float R, float th){
  float best = 0.0, dust = 0.0;
  float tp = tan(pitch);
  for (int k = 0; k < 4; k++){
    if (float(k) >= nArms) break;
    float th0 = float(k) * TAU / nArms;
    float lr = log(max(R, 0.05));
    float ph = th - th0 - lr / tp;
    float s = cos(ph * 1.0);
    float m = pow(max(s, 0.0), 6.0);
    best = max(best, m);
    float sd = cos(ph + 0.35); dust = max(dust, pow(max(sd, 0.0), 10.0));
  }
  float win = smoothstep(rIn * 0.7, rIn, R) * (1.0 - smoothstep(rOut * 0.8, rOut * 1.15, R));
  return vec2(best, dust) * win;
}
void main(){
  vec2 p = (vUv * 2.0 - 1.0) * rMax;
  float R = length(p);
  vec2 arms; float th;
  if (mode < 0.5) { float beta = atan(p.y, -p.x); arms = reidArms(R, beta); }
  else { th = atan(p.y, p.x); arms = genericArms(R, th); }
  float n1 = fbm(p * 1.3), n2 = fbm(p * 4.0 + 7.0), n3 = fbm(p * 11.0 + 3.0);
  float clump = smoothstep(0.35, 0.85, n1 * 0.55 + n2 * 0.45);
  float young = arms.x * (0.35 + 1.1 * clump) * (0.6 + 0.8 * n3) * (1.0 - smoothstep(11.0, 17.0, R) * 0.85);
  float hii = arms.x * pow(smoothstep(0.55, 0.95, n2 * 0.6 + n3 * 0.5), 2.0) * 1.6;
  float dust = arms.y * (0.35 + 0.95 * smoothstep(0.3, 0.8, n1 * 0.6 + n3 * 0.4)) + 0.22 * smoothstep(0.35, 0.75, n2) * exp(-R / 6.0);
  float ring = ringR > 0.0 ? exp(-pow((R - ringR) / 1.6, 2.0)) : 0.0;
  if (mode > 1.5) { /* irregular: blob com barra deslocada e grumos */
    young = smoothstep(0.45, 0.9, n1 * 0.7 + n2 * 0.5) * exp(-R / (rOut * 0.45));
    hii = young * pow(n3, 3.0) * 2.2; dust = young * 0.5 * n2;
  } else if (mode > 0.5) {
    young = young * (1.0 - flocc) + flocc * smoothstep(0.5, 0.95, n2 * 0.6 + n3 * 0.5) * exp(-R / rOut) * 1.4 + ring * (0.6 + 0.6 * clump);
    dust += ring * 0.9 * (0.5 + n2);
    hii += ring * pow(n3, 3.0) * 1.5;
  }
  float edge = 1.0 - smoothstep(rMax * 0.82, rMax * 0.98, R);
  float inner = mode < 0.5 ? smoothstep(2.4, 3.6, R) : 1.0;
  /* a formação estelar segue o gás: cai para fora dos ~4,5 kpc (escala ~3 kpc) */
  float sfr = mode < 0.5 ? exp(-max(R - 4.5, 0.0) / 3.0) : 1.0;
  gl_FragColor = vec4(young * inner * edge * sfr, hii * inner * edge * sfr, dust * edge, (1.0 + 0.35 * arms.x * inner - 0.15 * n2) * edge);
}`;

/* ── volume: integração por raio ── */
const VOL_V = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const VOL_F = `precision highp float;
varying vec3 vW;
uniform sampler2D map; uniform mat4 invM; uniform vec3 halfExt; uniform float rMax; uniform float steps;
uniform float Rd; uniform float hOld; uniform float hYoung; uniform float hDust; uniform float kDust;
uniform vec3 cOld; uniform vec3 cYoung; uniform vec3 cHII; uniform vec3 cBulge;
uniform float bOld; uniform float bYoung; uniform float bHII; uniform float bBulge;
uniform vec2 barDir; uniform vec3 barSz; uniform float bulgeR; uniform float exposure; uniform float opacity; uniform float rRes;
vec2 box(vec3 ro, vec3 rd, vec3 b){ vec3 m = 1.0 / rd, n = m * ro, k = abs(m) * b; vec3 t1 = -n - k, t2 = -n + k; return vec2(max(max(t1.x, t1.y), t1.z), min(min(t2.x, t2.y), t2.z)); }
float colz(float za, float zb, float h, float ds){
  float dz = abs(zb - za);
  if (dz < 1e-4 * h) { float s = 1.0 / cosh(0.5 * (za + zb) / h); return s * s / (2.0 * h) * ds; }
  return abs(tanh(zb / h) - tanh(za / h)) * 0.5 * ds / dz;
}
float bulge(vec3 p){
  float a = dot(p.xy, barDir), b = dot(p.xy, vec2(-barDir.y, barDir.x));
  float bar = exp(-2.2 * sqrt(pow(a / barSz.x, 2.0) + pow(b / barSz.y, 2.0) + pow(p.z / barSz.z, 2.0)));
  float lbar = exp(-(pow(a / (barSz.x * 3.0), 4.0) + pow(b / (barSz.y * 0.8), 2.0) + pow(p.z / 0.16, 2.0))) * 0.35;
  float core = exp(-length(p) / bulgeR) * 1.6;
  return bar + lbar + core;
}
void main(){
  vec3 ro = (invM * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 rd = normalize((invM * vec4(vW, 1.0)).xyz - ro);
  vec2 t = box(ro, rd, halfExt);
  if (t.y <= max(t.x, 0.0)) discard;
  float t0 = max(t.x, 0.0), t1 = t.y;
  float N = steps, ds = (t1 - t0) / N;
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 L = vec3(0.0); float T = 1.0;
  for (int i = 0; i < 160; i++){
    if (float(i) >= N) break;
    float tm = t0 + (float(i) + j) * ds;
    vec3 p = ro + rd * tm;
    float za = p.z - rd.z * ds * 0.5, zb = p.z + rd.z * ds * 0.5;
    vec2 uv = p.xy / (2.0 * rMax) + 0.5;
    vec4 m = texture2D(map, uv);
    float R = length(p.xy);
    float old = exp(-R / Rd) * m.a * bOld;
    vec3 E = cOld * old * colz(za, zb, hOld, ds)
           + cYoung * m.r * bYoung * colz(za, zb, hYoung, ds)
           + cHII * m.g * bHII * colz(za, zb, hYoung * 0.7, ds)
           + cBulge * bulge(p) * bBulge * ds;
    /* vista de dentro: o que está a menos de rRes kpc já aparece como estrelas individuais — não somar como névoa */
    if (rRes > 0.0) E *= smoothstep(rRes * 0.25, rRes, tm);
    float tau = (m.b + 0.1 * exp(-R / (Rd * 1.6))) * kDust * colz(za, zb, hDust, ds);
    L += T * E * (tau > 1e-4 ? (1.0 - exp(-tau)) / tau : 1.0);
    T *= exp(-tau);
    if (T < 0.004) break;
  }
  gl_FragColor = vec4(L * exposure * opacity, mix(1.0, T, opacity));
}`;
const COMP_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.99999, 1.0); }`;
const COMP_F = `uniform sampler2D tVol; varying vec2 vUv; void main(){ vec4 v = texture2D(tVol, vUv); gl_FragColor = vec4(v.rgb, v.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.a = v.a;
}`;

/* parâmetros por tipo de galáxia (kpc) */
const GAL_TYPES = {
  mw:   { mode: 0, rMax: 18, half: [18, 18, 2.6], Rd: 2.6, hOld: 0.3, hYoung: 0.1, hDust: 0.1, kDust: 2.4, bOld: 0.8, bYoung: 1.25, bHII: 1.1, bBulge: 1.6, barAng: 27, barSz: [1.9, 0.62, 0.42], bulgeR: 0.3 },
  m31:  { mode: 1, rMax: 26, half: [26, 26, 3], Rd: 5.3, hOld: 0.45, hYoung: 0.15, hDust: 0.12, kDust: 6.0, bOld: 0.75, bYoung: 0.55, bHII: 0.5, bBulge: 2.0, barAng: 0, barSz: [2.2, 1.6, 1.3], bulgeR: 0.5, nArms: 2, pitch: 7, rIn: 4, rOut: 18, ringR: 10, flocc: 0.4 },
  m33:  { mode: 1, rMax: 10, half: [10, 10, 1.4], Rd: 1.6, hOld: 0.2, hYoung: 0.09, hDust: 0.07, kDust: 3.5, bOld: 0.8, bYoung: 1.3, bHII: 1.4, bBulge: 0.25, barAng: 0, barSz: [0.4, 0.4, 0.3], bulgeR: 0.15, nArms: 2, pitch: 24, rIn: 0.6, rOut: 7, ringR: 0, flocc: 0.55 },
  lmc:  { mode: 2, rMax: 6, half: [6, 6, 1.0], Rd: 1.5, hOld: 0.35, hYoung: 0.18, hDust: 0.1, kDust: 2.0, bOld: 0.7, bYoung: 1.6, bHII: 1.6, bBulge: 0.5, barAng: 20, barSz: [1.5, 0.45, 0.35], bulgeR: 0.2, rOut: 5 },
  smc:  { mode: 2, rMax: 4, half: [4, 4, 2.0], Rd: 1.0, hOld: 0.8, hYoung: 0.5, hDust: 0.3, kDust: 1.0, bOld: 0.7, bYoung: 1.4, bHII: 1.2, bBulge: 0.2, barAng: 0, barSz: [0.6, 0.6, 0.6], bulgeR: 0.3, rOut: 3.2 },
};
const COLORS = { cOld: [1.0, 0.78, 0.55], cYoung: [0.72, 0.8, 1.0], cHII: [1.0, 0.38, 0.52], cBulge: [1.0, 0.74, 0.46] };

function bakeMap(renderer, type, arms, size) {
  const P = GAL_TYPES[type];
  const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
  const armA = [], armB = [];
  for (let k = 0; k < 7; k++) {
    const a = arms?.[k];
    if (a) { armA.push(new THREE.Vector4(a[3] * D2R, a[4], Math.tan(a[5] * D2R), Math.tan(a[6] * D2R))); armB.push(new THREE.Vector4(a[7], a[1] * D2R, a[2] * D2R, a[0] === '3-kpc' ? 0.6 : 1)); }
    else { armA.push(new THREE.Vector4(0, 1, 0.1, 0.1)); armB.push(new THREE.Vector4(0.1, 0, 0, 0)); }
  }
  const mat = new THREE.ShaderMaterial({ vertexShader: BAKE_V, fragmentShader: BAKE_F, uniforms: {
    mode: { value: P.mode }, rMax: { value: P.rMax }, seed: { value: { mw: 0.13, m31: 0.71, m33: 0.37, lmc: 0.53, smc: 0.91 }[type] ?? 0.2 },
    armA: { value: armA }, armB: { value: armB }, nArms: { value: P.nArms || 2 }, pitch: { value: (P.pitch || 12) * D2R }, rIn: { value: P.rIn || 1 }, rOut: { value: P.rOut || 10 }, ringR: { value: P.ringR || 0 }, flocc: { value: P.flocc || 0 } } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const sc = new THREE.Scene(); sc.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.setRenderTarget(prev);
  mat.dispose(); quad.geometry.dispose();
  return rt;
}

function volumeMaterial(map, type) {
  const P = GAL_TYPES[type];
  const a = P.barAng * D2R;
  return new THREE.ShaderMaterial({
    vertexShader: VOL_V, fragmentShader: VOL_F, side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.SrcAlphaFactor,
    uniforms: {
      map: { value: map }, invM: { value: new THREE.Matrix4() }, halfExt: { value: new THREE.Vector3(...P.half) }, rMax: { value: P.rMax }, steps: { value: 96 },
      Rd: { value: P.Rd }, hOld: { value: P.hOld }, hYoung: { value: P.hYoung }, hDust: { value: P.hDust }, kDust: { value: P.kDust },
      cOld: { value: new THREE.Vector3(...COLORS.cOld) }, cYoung: { value: new THREE.Vector3(...COLORS.cYoung) }, cHII: { value: new THREE.Vector3(...COLORS.cHII) }, cBulge: { value: new THREE.Vector3(...COLORS.cBulge) },
      bOld: { value: P.bOld }, bYoung: { value: P.bYoung }, bHII: { value: P.bHII }, bBulge: { value: P.bBulge },
      barDir: { value: new THREE.Vector2(-Math.cos(a), Math.sin(a)) }, barSz: { value: new THREE.Vector3(...P.barSz) }, bulgeR: { value: P.bulgeR },
      exposure: { value: 1.6 }, opacity: { value: 1 }, rRes: { value: 0 },
    },
  });
}

/** orientação de um disco pela inclinação e PA medidos (ambiguidade do lado próximo resolvida ao acaso) */
export function diskQuat(ra, dec, inclDeg, paDeg) {
  const los = new THREE.Vector3(...radec(ra, dec)).normalize();
  const north0 = new THREE.Vector3(...radec(0, 90));
  const north = north0.clone().addScaledVector(los, -north0.dot(los)).normalize();
  const east = new THREE.Vector3().crossVectors(north, los).normalize().negate();
  const pa = paDeg * D2R, inc = inclDeg * D2R;
  const major = north.clone().multiplyScalar(Math.cos(pa)).addScaledVector(east, Math.sin(pa)).normalize();
  const minorSky = north.clone().multiplyScalar(-Math.sin(pa)).addScaledVector(east, Math.cos(pa)).normalize();
  const nrm = los.clone().negate().multiplyScalar(Math.cos(inc)).addScaledVector(minorSky, Math.sin(inc)).normalize();
  const y = new THREE.Vector3().crossVectors(nrm, major).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(major, y, nrm));
}

/* ═════════════════════ camada: galáxias em volume ═════════════════════ */
export function createVolumeLayer(engine, mw) {
  const volScene = new THREE.Scene();
  const group = new THREE.Group();   /* só o quad de composição vai para a cena principal */
  const scale = engine.mobile ? 0.42 : 0.6;
  let rt = null;
  const comp = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: COMP_V, fragmentShader: COMP_F, uniforms: { tVol: { value: null } }, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }));
  comp.frustumCulled = false; comp.renderOrder = 10; group.add(comp);
  const gals = [];
  function addGalaxy(type, originM, quat, sMax) {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), null);
    mesh.scale.set(...GAL_TYPES[type].half);
    mesh.frustumCulled = false;
    g.add(mesh); if (quat) g.quaternion.copy(quat);
    volScene.add(g);
    gals.push({ type, g, mesh, origin: originM, sMax, baked: false });
  }
  addGalaxy('mw', GC_POS, null, 23.4);
  const m31 = radec(10.6847, 41.2687, 765 * KPC);
  addGalaxy('m31', m31, diskQuat(10.6847, 41.2687, 77, 38), 23.6);
  addGalaxy('m33', radec(23.4621, 30.6599, 809 * KPC), diskQuat(23.4621, 30.6599, 55, 22), 23.2);
  addGalaxy('lmc', radec(80.894, -69.756, 50.6 * KPC), diskQuat(80.894, -69.756, 30, 150), 22.6);
  addGalaxy('smc', radec(13.187, -72.829, 64 * KPC), diskQuat(13.187, -72.829, 60, 45), 22.6);

  const layer = {
    id: 'volume', name: 'Discos galácticos (Via Láctea, Andrómeda, Triângulo, Nuvens)', kind: 'model', source: 'Modelo próprio: braços de Reid et al. 2019, barra, disco exponencial; orientações medidas',
    group, range: [6.5, 24.0], fade: 0.5, gals,
    resize(ctx) { if (rt) { rt.setSize(Math.round(ctx.w * ctx.dpr * scale), Math.round(ctx.h * ctx.dpr * scale)); } },
    update(ctx, op) {
      if (!rt) {
        rt = new THREE.WebGLRenderTarget(Math.round(ctx.w * ctx.dpr * scale), Math.round(ctx.h * ctx.dpr * scale), { type: THREE.HalfFloatType, depthBuffer: false });
        comp.material.uniforms.tVol.value = rt.texture;
      }
      this._op = op;
      for (const G of gals) {
        const vis = ctx.s < G.sMax + 0.4 && (G.type === 'mw' || ctx.s > 19.2);
        G.g.visible = vis;
        if (!vis) continue;
        if (!G.baked) {
          G.baked = true;
          const map = bakeMap(engine.renderer, G.type, G.type === 'mw' ? mw?.arms : null, engine.mobile ? 1024 : 2048).texture;
          G.mesh.material = volumeMaterial(map, G.type);
          G.mesh.material.uniforms.steps.value = engine.mobile ? 56 : 96;
        }
        engine.setGroup(G.g, G.origin, KPC);
        const fadeOut = 1 - THREE.MathUtils.smoothstep(ctx.s, G.sMax - 0.3, G.sMax + 0.4);
        G.mesh.material.uniforms.opacity.value = op * fadeOut;
        /* vista de dentro: o céu entre as estrelas tem ~23 mag/arcsec² — quase negro.
           A exposição de "fora" tornaria o céu leitoso; baixa-se até só a faixa se ver. */
        G.mesh.material.uniforms.exposure.value = 1.6 * (G.type === 'mw' ? THREE.MathUtils.lerp(0.045, 1, THREE.MathUtils.smoothstep(ctx.s, 18.9, 20.4)) : 1);
        G.mesh.material.uniforms.rRes.value = G.type === 'mw' ? 0.9 * (1 - THREE.MathUtils.smoothstep(ctx.s, 19.4, 20.4)) : 0;
        G.mesh.updateMatrixWorld(true);
        G.mesh.material.uniforms.invM.value.copy(G.g.matrixWorld).invert();
      }
    },
    prepare(renderer, ctx) {
      if (!rt) return;
      const prev = renderer.getRenderTarget(), tm = renderer.toneMapping;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.render(volScene, engine.camera);
      renderer.toneMapping = tm;
      renderer.setRenderTarget(prev);
      renderer.setClearColor(0x000000, 1);
    },
    dispose() { rt?.dispose(); },
  };
  return layer;
}

/* ═════════════════════ Via Láctea observada ═════════════════════ */
const PT_V = `${LOGDEPTH_V}
attribute vec3 color; attribute float size; uniform float dpr; uniform float opacity; varying vec3 vC;
void main(){ vC = color * opacity; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * dpr; ${LOGDEPTH_V_MAIN} }`;
const PT_F = `${LOGDEPTH_F}
varying vec3 vC; uniform float ring;
void main(){ ${LOGDEPTH_F_MAIN} vec2 c = gl_PointCoord*2.0-1.0; float r = length(c); if (r > 1.0) discard;
  float a = ring > 0.5 ? smoothstep(1.0,0.8,r) * (0.35 + 0.65*smoothstep(0.35,0.7,r)) : exp(-r*r*3.5);
  gl_FragColor = vec4(vC * a, 1.0);
  #include <colorspace_fragment>
}`;
export function pointsObject(positions, colors, sizes, ring = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const m = new THREE.ShaderMaterial({ vertexShader: PT_V, fragmentShader: PT_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { dpr: { value: 1 }, opacity: { value: 1 }, ring: { value: ring ? 1 : 0 } } });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 20;
  return p;
}

export function createTracerLayer(engine, mw) {
  const group = new THREE.Group();
  const objs = { gcs: [], masers: [], ocs: [] };
  /* masers (kpc, heliocêntrico) */
  const mPos = [], mCol = [], mSz = [];
  for (const m of mw.masers) { mPos.push(m[2], m[3], m[4]); mCol.push(0.35, 0.95, 1.0); mSz.push(m[6] < 0.2 ? 6 : 4.5); objs.masers.push({ id: 'maser:' + m[0], name: m[1] ? `${m[1]} (${m[0]})` : m[0], cat: 'Região de formação estelar (maser)', kind: 'obs', layer: 'tracers', maser: { arm: m[5], err: m[6] }, view: 19.2, getPos: () => [m[2] * KPC, m[3] * KPC, m[4] * KPC] }); }
  const masers = pointsObject(mPos, mCol, mSz, true);
  /* enxames globulares */
  const gPos = [], gCol = [], gSz = [];
  for (const g of mw.gcs) { gPos.push(g[2], g[3], g[4]); gCol.push(1.0, 0.8, 0.4); gSz.push(Math.max(3, Math.min(9, 3 + (-g[6] - 5) * 1.2))); objs.gcs.push({ id: 'gc:' + g[0], name: g[0] + (g[1] ? ` (${g[1]})` : ''), cat: 'Enxame globular', kind: 'obs', layer: 'tracers', gc: { feh: g[5], mv: g[6] }, view: 19.0, getPos: () => [g[2] * KPC, g[3] * KPC, g[4] * KPC] }); }
  const gcs = pointsObject(gPos, gCol, gSz, false);
  /* enxames abertos (pc → kpc) */
  const oPos = [], oCol = [], oSz = [];
  for (const o of mw.ocs) { oPos.push(o[1] / 1e3, o[2] / 1e3, o[3] / 1e3); const young = o[4] && o[4] < 7.5; oCol.push(young ? 0.7 : 0.55, young ? 0.85 : 0.65, 1.0); oSz.push(2.6); objs.ocs.push({ id: 'oc:' + o[0], name: o[0], cat: 'Enxame aberto', kind: 'obs', layer: 'tracers', oc: { logAge: o[4], diam: o[5] }, view: 18.2, getPos: () => [o[1] * PC, o[2] * PC, o[3] * PC] }); }
  const ocs = pointsObject(oPos, oCol, oSz, false);
  group.add(ocs, masers, gcs);
  /* linhas centrais dos braços: medido (forte) e extrapolado (fraco) */
  const armLines = new THREE.Group();
  for (const a of mw.arms) {
    if (a[0] === '3-kpc') continue;
    const [name, bmin, bmax, bk, Rk, p1, p2] = a;
    const pts = [], fade = [];
    for (let b = bmin - 110; b <= bmax + 110; b += 1) {
      const tp = Math.tan((b <= bk ? p1 : p2) * D2R);
      const R = Rk * Math.exp(-(b - bk) * D2R * tp);
      if (R < 2.6 || R > 17.5) continue;
      pts.push([R0 - R * Math.cos(b * D2R), R * Math.sin(b * D2R), 0]);
      fade.push(b >= bmin && b <= bmax ? 1 : 0.22);
    }
    const L = makeLine(pts, '#7fb2ff', 0.5, false, fade); L.userData.name = name;
    L.renderOrder = 19; armLines.add(L);
  }
  group.add(armLines);
  const armLabels = mw.arms.filter(a => a[0] !== '3-kpc').map(a => { const b = (a[1] + a[2]) / 2; const tp = Math.tan((b <= a[3] ? a[5] : a[6]) * D2R); const R = a[4] * Math.exp(-(b - a[3]) * D2R * tp); return { name: 'Braço ' + (a[0] === 'Exterior' ? 'Exterior' : a[0] === 'Local' ? 'Local' : 'de ' + a[0]), pos: [(R0 - R * Math.cos(b * D2R)) * KPC, R * Math.sin(b * D2R) * KPC, 0] }; });
  const sunObj = { id: 'here', name: 'Sol (estás aqui)', getPos: () => [0, 0, 0], noLabelObj: true };
  const gcObj = { id: 'gcenter', name: 'Centro galáctico', getPos: () => GC_POS };
  const layer = {
    id: 'tracers', name: 'Via Láctea medida: masers, enxames globulares e abertos', kind: 'obs', source: 'Reid et al. 2019 (199 masers) · Harris 2010 (157 globulares) · Dias et al. 2002 (2039 abertos)',
    group, range: [18.0, 22.4], fade: 0.5, objs,
    show: { masers: true, gcs: true, ocs: true, arms: true },
    update(ctx, op) {
      engine.setGroup(group, [0, 0, 0], KPC);
      for (const [k, o] of [['masers', masers], ['gcs', gcs], ['ocs', ocs]]) {
        o.visible = this.show[k];
        o.material.uniforms.dpr.value = ctx.dpr;
        o.material.uniforms.opacity.value = op * (k === 'ocs' ? band(ctx.s, 18, 20.8, 0.4) * 0.7 : k === 'gcs' ? 1 : band(ctx.s, 18.4, 21.6, 0.4));
      }
      armLines.visible = this.show.arms;
      const af = band(ctx.s, 19.4, 22.0, 0.4) * op;
      armLines.children.forEach(L => { L.material.uniforms.opacity.value = 0.5 * af; });
    },
    labels(ctx, out, op) {
      if (ctx.s > 19.3 && ctx.s < 22.2) out.push({ text: 'Sol · estás aqui', pos: [0, 0, 0], prio: 95, cls: 'is-here', alpha: op });
      if (ctx.s > 19.6) out.push({ text: 'Centro galáctico', pos: GC_POS, prio: 80, cls: 'is-region', alpha: op, obj: this.gcRef });
      if (this.show.arms && ctx.s > 20.0 && ctx.s < 21.9) for (const a of armLabels) out.push({ text: a.name, pos: a.pos, prio: 50, cls: 'is-arm', alpha: op });
      if (ctx.s < 20.6) for (const g of objs.gcs) { if (g.gc.mv < -8.8) out.push({ text: g.name.split(' (')[0], pos: g.getPos(), prio: 25, obj: g, cls: 'is-gc', alpha: op }); }
    },
    pick(ctx, x, y) {
      const list = [];
      if (this.show.gcs) list.push(...objs.gcs);
      if (this.show.masers) list.push(...objs.masers);
      if (this.show.ocs && ctx.s < 20.6) list.push(...objs.ocs);
      return engine.pickNear(list, x, y, 9);
    },
    sunObj, gcObj,
  };
  return layer;
}

/* ═════════════════════ galáxias em "impostor" (Grupo Local + RC3) ═════════════════════ */
const BB_V = `${LOGDEPTH_V}
attribute vec2 corner; attribute vec3 iPos; attribute vec3 iAx1; attribute vec3 iAx2; attribute vec4 iCol; attribute float iTex;
uniform float pxPerRad; uniform float minPx; uniform float opacity; uniform float tiles;
varying vec2 vUv; varying vec4 vCol; varying float vTex; varying float vDot;
void main(){
  vec4 c = modelViewMatrix * vec4(iPos, 1.0);
  float dist = max(-c.z, 1e-12);
  vec3 a1, a2;
  if (iTex < 0.0) { float r1 = length(mat3(modelViewMatrix) * iAx1), r2 = length(mat3(modelViewMatrix) * iAx2); a1 = vec3(r1, 0.0, 0.0); a2 = vec3(0.0, r2, 0.0); }
  else { a1 = mat3(modelViewMatrix) * iAx1; a2 = mat3(modelViewMatrix) * iAx2; }
  float rpx = max(length(a1), length(a2)) / dist * pxPerRad;
  float k = max(1.0, minPx / max(rpx, 1e-6));
  vDot = clamp((k - 1.0) * 0.6, 0.0, 1.0);
  if (k > 1.0) { a1 = vec3(length(a1) * k, 0.0, 0.0); a2 = vec3(0.0, length(a1), 0.0); }
  vec3 v = c.xyz + corner.x * a1 + corner.y * a2;
  vUv = corner * 0.5 + 0.5; vTex = iTex;
  /* abaixo do tamanho mínimo: o fluxo total conserva-se (brilho ∝ área real/área desenhada) */
  vCol = vec4(iCol.rgb, iCol.a * opacity * (k > 1.0 ? max(1.0 / (k * k), 0.06) : 1.0));
  gl_Position = projectionMatrix * vec4(v, 1.0);
  ${LOGDEPTH_V_MAIN}
}`;
const BB_F = `${LOGDEPTH_F}
uniform sampler2D atlas; uniform float tiles;
varying vec2 vUv; varying vec4 vCol; varying float vTex; varying float vDot;
void main(){ ${LOGDEPTH_F_MAIN}
  vec2 c = vUv * 2.0 - 1.0; float r2 = dot(c, c); if (r2 > 1.0) discard;
  vec3 col;
  float blob = exp(-r2 * 4.5);
  if (vTex < 0.0 || vDot > 0.5) col = vCol.rgb * blob;
  else { vec2 uv = (vUv + vec2(mod(vTex, tiles), floor(vTex / tiles))) / tiles; col = texture2D(atlas, uv).rgb * vCol.rgb; col = mix(col, vCol.rgb * blob, vDot); }
  gl_FragColor = vec4(col * vCol.a, 1.0);
  #include <colorspace_fragment>
}`;
/** atlas 3×2 de imagens-tipo face-on (Sa, Sb, Sc, SB, Irr, S0) renderizadas pelo mesmo modelo */
function bakeAtlas(renderer) {
  const tiles = 3, T = 256;
  const rt = new THREE.WebGLRenderTarget(T * tiles, T * 2, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const kinds = [
    { mode: 1, nArms: 2, pitch: 9, rIn: 0.12, rOut: 0.75, bulge: 0.9, young: 0.55 },
    { mode: 1, nArms: 2, pitch: 14, rIn: 0.1, rOut: 0.8, bulge: 0.55, young: 0.9 },
    { mode: 1, nArms: 3, pitch: 22, rIn: 0.08, rOut: 0.85, bulge: 0.25, young: 1.2, flocc: 0.4 },
    { mode: 1, nArms: 2, pitch: 16, rIn: 0.32, rOut: 0.85, bulge: 0.5, young: 0.9, bar: 1 },
    { mode: 2, rOut: 0.8, bulge: 0.1, young: 1.3 },
    { mode: 1, nArms: 0, pitch: 10, rIn: 0.1, rOut: 0.7, bulge: 1.0, young: 0.0 },
  ];
  const atlasMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `precision highp float; varying vec2 vUv;
      uniform float mode, nArms, pitch, rIn, rOut, bulge, young, flocc, bar, seed;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21) + seed); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5;} return s; }
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float R = length(p), th = atan(p.y, p.x);
        float n1 = fbm(p * 5.0), n2 = fbm(p * 14.0 + 3.0);
        float arms = 0.0;
        for (int k = 0; k < 3; k++){ if (float(k) >= nArms) break; float ph = th - float(k) * 6.2831853 / nArms - log(max(R, 0.02)) / tan(pitch); arms = max(arms, pow(max(cos(ph), 0.0), 5.0)); }
        arms *= smoothstep(rIn * 0.7, rIn, R) * (1.0 - smoothstep(rOut * 0.85, rOut * 1.1, R));
        if (mode > 1.5) arms = smoothstep(0.45, 0.85, n1 * 0.8 + n2 * 0.3) * exp(-R / 0.35);
        float disk = exp(-R / 0.22) * (1.0 - smoothstep(0.8, 1.0, R));
        float bul = exp(-R / 0.07) * bulge + (bar > 0.5 ? exp(-pow(abs(p.x) / 0.32, 2.0) - pow(abs(p.y) / 0.07, 2.0)) * 0.8 : 0.0);
        float y = arms * (0.5 + 0.8 * n1) * young * mix(1.0, n2 * 1.6, flocc);
        float dust = arms * smoothstep(0.4, 0.8, n2) * 0.5;
        vec3 col = vec3(1.0, 0.82, 0.62) * disk * 0.9 + vec3(0.62, 0.75, 1.0) * y * 0.9 + vec3(1.0, 0.4, 0.55) * y * pow(n2, 3.0) * 1.8 + vec3(1.0, 0.78, 0.52) * bul;
        col *= 1.0 - dust * 0.6;
        col *= 1.0 - smoothstep(0.88, 1.0, R);
        gl_FragColor = vec4(col, 1.0);
      }`,
    uniforms: { mode: { value: 1 }, nArms: { value: 2 }, pitch: { value: 0.2 }, rIn: { value: 0.1 }, rOut: { value: 0.8 }, bulge: { value: 0.5 }, young: { value: 1 }, flocc: { value: 0 }, bar: { value: 0 }, seed: { value: 0.3 } },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), atlasMat);
  const sc = new THREE.Scene(); sc.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  kinds.forEach((k, i) => {
    const U = atlasMat.uniforms;
    U.mode.value = k.mode; U.nArms.value = k.nArms ?? 2; U.pitch.value = (k.pitch || 12) * D2R; U.rIn.value = k.rIn ?? 0.1; U.rOut.value = k.rOut ?? 0.8;
    U.bulge.value = k.bulge; U.young.value = k.young; U.flocc.value = k.flocc || 0; U.bar.value = k.bar || 0; U.seed.value = 0.17 + i * 0.13;
    rt.viewport.set((i % tiles) * T, Math.floor(i / tiles) * T, T, T);
    renderer.setRenderTarget(rt); renderer.render(sc, cam);
  });
  rt.viewport.set(0, 0, T * tiles, T * 2);
  renderer.setRenderTarget(prev);
  return { tex: rt.texture, tiles };
}
/** estádio de Hubble T → índice no atlas (−1 = elíptica: mancha sem textura) */
export function typeTile(T, morph = '') {
  if (T <= -3.5) return -1;
  if (T < 0.5) return 5;
  if (/B/.test(morph.slice(0, 3)) && T < 7) return 3;
  if (T < 2.5) return 0;
  if (T < 4.5) return 1;
  if (T < 8.5) return 2;
  return 4;
}

export function createImpostorLayer(engine, { id, name, kind, source, range, unit, origin = [0, 0, 0], items, minPx = 1.6 }) {
  /* items: [{pos (unidade), ax1, ax2 (unidade), col [r,g,b,a], tex}] */
  const N = items.length;
  const base = new THREE.PlaneGeometry(2, 2);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('corner', new THREE.Float32BufferAttribute([-1, 1, 1, 1, -1, -1, 1, -1], 2));
  g.setAttribute('position', base.attributes.position);
  const f = (k, n) => new THREE.InstancedBufferAttribute(new Float32Array(N * n), n);
  const P = f('p', 3), A1 = f('a', 3), A2 = f('b', 3), CL = f('c', 4), TX = f('t', 1);
  items.forEach((it, i) => { P.setXYZ(i, ...it.pos); A1.setXYZ(i, ...it.ax1); A2.setXYZ(i, ...it.ax2); CL.setXYZW(i, ...it.col); TX.setX(i, it.tex); });
  g.setAttribute('iPos', P); g.setAttribute('iAx1', A1); g.setAttribute('iAx2', A2); g.setAttribute('iCol', CL); g.setAttribute('iTex', TX);
  g.instanceCount = N;
  const mat = new THREE.ShaderMaterial({ vertexShader: BB_V, fragmentShader: BB_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { pxPerRad: { value: 1 }, minPx: { value: minPx }, opacity: { value: 1 }, atlas: { value: null }, tiles: { value: 3 } } });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 4;
  const group = new THREE.Group(); group.add(mesh);
  return {
    id, name, kind, source, group, range, fade: 0.45, mat,
    update(ctx, op) {
      if (!mat.uniforms.atlas.value) { if (!engine._atlas) engine._atlas = bakeAtlas(engine.renderer); mat.uniforms.atlas.value = engine._atlas.tex; }
      engine.setGroup(group, origin, unit);
      mat.uniforms.pxPerRad.value = ctx.pxPerRad * ctx.dpr; mat.uniforms.minPx.value = minPx * ctx.dpr; mat.uniforms.opacity.value = op;
    },
  };
}

/** eixos de um disco (unidades da camada) a partir de RA/Dec, PA, b/a e raio */
export function diskAxes(ra, dec, pa, ba, r) {
  const inc = Math.acos(Math.max(0.12, Math.min(1, ba))) * 180 / Math.PI;
  const q = diskQuat(ra, dec, inc, pa);
  const x = new THREE.Vector3(1, 0, 0).applyQuaternion(q).multiplyScalar(r), y = new THREE.Vector3(0, 1, 0).applyQuaternion(q).multiplyScalar(r);
  return [x.toArray(), y.toArray()];
}

export async function loadGalaxyData() {
  const [lg, gal] = await Promise.all([fetchJSON('/data/universe/lg.json'), fetchJSON('/data/universe/galaxies.json')]);
  return { lg: lg.galaxies, gal: gal.galaxies };
}
export { MPC };
