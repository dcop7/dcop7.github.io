/* ══════════════════════════════════════════════════════════════════════
   Oceano profundo — a água: iluminação injetada nos materiais, fundo
   (coluna de água + superfície vista de baixo), neve marinha e o
   pós-processamento (feixes volumétricos, bloom, exposição, ACES).

   A cena NÃO tem luzes do three.js: cada material recebe por injeção
   a luz solar à sua cota (com cáusticas perto da superfície), a luz
   ambiente da água, os faróis do submersível (atenuados por canal ao
   longo do caminho) e a perda de contraste até à câmara. Assim o número
   de programas é fixo e nada recompila durante a descida.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, WATER_PARS } from './o-core.mjs';

/* uniforms partilhados por TODOS os materiais (por referência) */
export const WU = {
  uTime: { value: 0 }, uCaus: { value: 1 }, uHLon: { value: 0 }, uHLpow: { value: 6 },
  uExt: { value: new THREE.Vector3(0.4, 0.09, 0.05) }, uSun: { value: new THREE.Vector3(3, 3, 3) },
  uSunDir: { value: new THREE.Vector3(0.25, 0.95, 0.15).normalize() }, uSunAir: { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() },
  uHLv0: { value: new THREE.Vector3() }, uHLv1: { value: new THREE.Vector3() }, uHLdirV: { value: new THREE.Vector3(0, 0, -1) }, uHLdir1: { value: new THREE.Vector3(0, 0, -1) },
  uCamDepth: { value: 0 }, uSpark: { value: 0 }, uGlowK: { value: 1 },
};

const LIGHT = /* glsl */`
{
  vec3 pw = vWRel; float dd = length(pw); vec3 dir = pw / max(dd, 1e-4);
  float yw = cameraPosition.y + pw.y;
  vec3 col = gl_FragColor.rgb;
  vec3 alb = diffuseColor.rgb;
#ifndef WATER_NOLIGHT
  vec3 nw = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 ed = edAt(yw);
  float cs = uCaus > 0.0 ? causticAt((cameraPosition + pw).xz, uTime) * uCaus * exp(yw / 22.0) : 0.0;
  float ndl = dot(nw, uSunDir);
  vec3 lit = ed * (max(ndl, 0.0) * 0.30 * (1.0 + cs) + (0.035 + 0.20 * (nw.y * 0.5 + 0.5)) * vec3(0.6, 0.88, 1.0));
#ifdef WATER_TRANSLUCENT
  lit += ed * max(-ndl, 0.0) * 0.18;
#endif
  col += alb * lit + headlight(-vViewPosition, normal, alb, roughnessFactor);
#endif
#ifdef WATER_FRESNEL
  float fr = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
  gl_FragColor.a = clamp(gl_FragColor.a * (0.35 + 1.6 * fr), 0.0, 1.0);
  col += alb * fr * (edAt(yw) * 0.08 + headlight(-vViewPosition, normal, vec3(0.5), 0.6) * 0.25);
#endif
#ifdef WATER_GLOW
  col += vEm * vGlow;
#endif
  vec3 T = exp(-uExt * dd);
#ifdef WATER_ADD
  col *= T;
#else
  col = col * T + veilAt(dir, yw) * (1.0 - T);
#endif
  gl_FragColor.rgb = col;
}
`;

/**
 * Prepara um MeshStandardMaterial para a água.
 * opts: { glow, translucent, fresnel, additive, nolight, deform:{flap,flapF,lat,k,pulse}, inst }
 * Atributos opcionais da geometria: aDef (t, peso lateral, peso de bater), aEm (cor emissiva).
 * Atributo de instância aInst: (fase, intensidade da luz própria, frequência, livre).
 */
export function waterify(mat, o = {}) {
  const defs = mat.defines = mat.defines || {};
  if (o.glow) defs.WATER_GLOW = '';
  if (o.translucent) defs.WATER_TRANSLUCENT = '';
  if (o.fresnel) defs.WATER_FRESNEL = '';
  if (o.additive) defs.WATER_ADD = '';
  if (o.nolight) defs.WATER_NOLIGHT = '';
  if (o.deform) defs.WATER_DEF = '';
  if (o.deform?.pulse) defs.WATER_PULSE = '';
  if (o.inst) defs.WATER_INST = '';
  const sw = new THREE.Vector4(o.deform?.flap || 0, o.deform?.flapF || 1, o.deform?.lat || 0, o.deform?.k || 6);
  mat.userData.sw = sw;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, WU, { uSw: { value: sw } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vWRel;
uniform float uTime, uGlowK; uniform vec4 uSw;
#ifdef WATER_DEF
attribute vec3 aDef;
#endif
#ifdef WATER_INST
attribute vec4 aInst;
#endif
#ifdef WATER_GLOW
attribute vec3 aEm; varying vec3 vEm; varying float vGlow;
#endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef WATER_INST
  float ph = aInst.x + uTime * aInst.z;
#else
  float ph = uTime * 3.0;
#endif
#ifdef WATER_DEF
  transformed.z += uSw.z * aDef.y * sin(aDef.x * uSw.w - ph);
#ifdef WATER_PULSE
  transformed.xz *= 1.0 + uSw.x * aDef.z * sin(ph);
  transformed.y -= uSw.x * aDef.z * sin(ph) * 0.5 * abs(transformed.y);
#else
  transformed.y += uSw.x * aDef.z * sin(ph * uSw.y - aDef.x * 2.5);
#endif
#endif
#ifdef WATER_GLOW
  vEm = aEm;
#ifdef WATER_INST
  vGlow = aInst.y * uGlowK;
#else
  vGlow = uGlowK;
#endif
#if defined(WATER_PINWHEEL) && defined(WATER_DEF)
  vGlow *= 0.12 + 2.2 * pow(0.5 + 0.5 * sin(aDef.x * 12.566 - uTime * 6.0), 8.0);
#endif
#endif`)
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n  vWRel = transpose(mat3(viewMatrix)) * mvPosition.xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWRel;
#ifdef WATER_GLOW
varying vec3 vEm; varying float vGlow;
#endif
${WATER_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
${o.colorFrag || ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${o.normalFrag || ''}`)
      .replace('#include <fog_fragment>', LIGHT);
    if (o.fragPars) sh.fragmentShader = sh.fragmentShader.replace('varying vec3 vWRel;', `varying vec3 vWRel;
${o.fragPars}`);
  };
  mat.customProgramCacheKey = () => 'water:' + Object.keys(defs).sort().join(',') + (o.key || '');
  return mat;
}

/* ── fundo: a água ao "infinito" e a superfície vista de baixo (janela de Snell) ── */
export function makeBackdrop() {
  const m = new THREE.ShaderMaterial({
    uniforms: WU, depthWrite: false, depthTest: false, side: THREE.BackSide,
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`varying vec3 vDir; uniform vec3 uSunAir;
${WATER_PARS}
float wh(vec2 p, float t){ return sin(p.x*0.21+t*0.9)*0.5 + sin(p.y*0.17-t*0.7)*0.5 + sin((p.x+p.y)*0.43+t*1.6)*0.25 + sin((p.x-p.y*1.3)*0.9-t*2.1)*0.12; }
void main(){
  vec3 dir = normalize(vDir);
  float y = cameraPosition.y;
  vec3 col = veilAt(dir, y);
  if (dir.y > 0.02 && y > -500.0) {
    float ds = -y / dir.y;
    vec2 sp = cameraPosition.xz + dir.xz * ds;
    float e = 0.6, t = uTime;
    vec2 g = vec2(wh(sp + vec2(e, 0.0), t) - wh(sp - vec2(e, 0.0), t), wh(sp + vec2(0.0, e), t) - wh(sp - vec2(0.0, e), t)) / (2.0 * e);
    vec3 n = normalize(vec3(-g.x * 0.3, 1.0, -g.y * 0.3));
    vec3 rd = refract(dir, -n, 1.333);
    float win = dot(rd, rd) > 0.0 ? 1.0 : 0.0;
    vec3 sky = uSun * (vec3(0.5, 0.72, 1.0) * (0.05 + 0.07 * rd.y) + vec3(1.0, 0.95, 0.85) * 12.0 * pow(max(dot(rd, uSunAir), 0.0), 900.0) + vec3(1.0, 0.9, 0.7) * 0.25 * pow(max(dot(rd, uSunAir), 0.0), 12.0));
    vec3 refl = veilAt(reflect(dir, -n), y) * 0.8;
    float edge = smoothstep(0.0, 0.18, length(rd.xz) > 0.0 ? 1.0 - length(rd.xz) : 1.0);
    vec3 surf = win > 0.5 ? mix(refl, sky, 0.25 + 0.75 * edge) : refl;
    vec3 T = exp(-uExt * ds);
    col = surf * T + col * (1.0 - T);
  }
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), m);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return mesh;
}

/* ── neve marinha: quads instanciados num cubo que acompanha a câmara ── */
export function makeSnow({ count, box, size, sink, spark = 0, seed = 1 }) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const a = new Float32Array(count * 4);
  let s = seed * 9301 + 49297;
  const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count * 4; i++) a[i] = R();
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = count;
  const u = { ...WU, uBox: { value: box }, uSize: { value: size }, uSink: { value: sink }, uVel: { value: new THREE.Vector3() }, uSparkF: { value: spark }, uAmb: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`attribute vec4 aSeed; uniform float uBox, uSize, uSink, uSparkF, uAmb, uGlowK; uniform vec3 uVel;
${WATER_PARS}
varying vec2 vQ; varying vec3 vCol;
void main(){
  vec3 p = aSeed.xyz * uBox;
  p.y -= uTime * uSink * (0.4 + aSeed.w);
  p.x += sin(uTime * 0.13 + aSeed.w * 40.0) * 0.4;
  p.z += cos(uTime * 0.11 + aSeed.w * 23.0) * 0.4;
  vec3 rel = mod(p - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5;
  vec4 mv = viewMatrix * vec4(cameraPosition + rel, 1.0);
  float d = length(mv.xyz);
  float sz = uSize * (0.35 + aSeed.w * aSeed.w * 1.4);
  vec3 vv = mat3(viewMatrix) * (-uVel) * 0.045;
  vec2 st = vv.xy; float sl = length(st);
  vec2 ax = sl > 1e-4 ? st / sl : vec2(0.0, 1.0);
  vec2 px = vec2(-ax.y, ax.x);
  vQ = position.xy;
  mv.xy += px * position.x * sz + ax * position.y * (sz + sl * 0.5);
  mv.xy += st * 0.5 * position.y;
  gl_Position = projectionMatrix * mv;
  /* luz: faróis (dispersão para trás) + luz ambiente à cota */
  vec3 wl = vec3(0.0);
  if (uHLon > 0.01) for (int i = 0; i < 2; i++) {
    vec3 lp = i == 0 ? uHLv0 : uHLv1; vec3 l = lp - mv.xyz; float dl = length(l);
    wl += smoothstep(0.55, 0.9, dot(-l / dl, i == 0 ? uHLdirV : uHLdir1)) * exp(-uExt * dl) / (dl * dl + 2.0);
  }
  float yw = cameraPosition.y + rel.y;
  vec3 c = wl * uHLpow * uHLon * 0.5 + edAt(yw) * 0.05 * uAmb;
  float sp = step(1.0 - uSparkF, fract(aSeed.w * 7.31));
  float fl = sp * pow(max(sin(uTime * (0.6 + aSeed.x + uSpark * 2.0) + aSeed.y * 60.0), 0.0), mix(60.0, 18.0, uSpark)) * (1.0 + uSpark * 3.0);
  c += vec3(0.15, 0.75, 1.0) * fl * 3.0 * uGlowK;
  float fade = smoothstep(uBox * 0.5, uBox * 0.3, length(rel)) * smoothstep(0.15, 0.6, d);
  vCol = c * exp(-uExt * d) * fade / (1.0 + sl / sz * 0.5);
}`,
    fragmentShader: /* glsl */`varying vec2 vQ; varying vec3 vCol; void main(){ float r = length(vQ); if (r > 1.0) discard; gl_FragColor = vec4(vCol * (1.0 - r * r), 1.0); }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false; mesh.renderOrder = 5;
  mesh.userData.u = u;
  return mesh;
}

/* ── pós-processamento ── */
const QV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
export function makePost(mobile) {
  const steps = mobile ? 10 : 20;
  const vol = new THREE.ShaderMaterial({
    vertexShader: QV,
    uniforms: { ...WU, tColor: { value: null }, tDepth: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamW: { value: new THREE.Matrix4() }, uNear: { value: 0.05 }, uFar: { value: 2000 }, uShaft: { value: 1 }, uBeam: { value: 1 } },
    fragmentShader: /* glsl */`#include <packing>
uniform sampler2D tColor, tDepth; uniform mat4 uInvProj, uCamW; uniform float uNear, uFar, uShaft, uBeam;
varying vec2 vUv;
${WATER_PARS}
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float shaft(vec3 p){
  vec2 q = p.xz - uSunDir.xz * (p.y / uSunDir.y);
  float c = causticAt(q * 0.35, uTime * 0.6);
  return c;
}
void main(){
  vec3 base = texture2D(tColor, vUv).rgb;
  float dz = texture2D(tDepth, vUv).x;
  vec4 vp = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 dv = normalize(vp.xyz / vp.w);
  float vz = perspectiveDepthToViewZ(dz, uNear, uFar);
  float dist = dz >= 0.9999 ? 1e4 : vz / dv.z;
  vec3 dw = mat3(uCamW) * dv; vec3 cw = uCamW[3].xyz;
  vec3 acc = vec3(0.0);
  float tMax = min(dist, 70.0);
  float j = ign(gl_FragCoord.xy);
  float dt = tMax / float(${steps});
  bool sun = uShaft > 0.01 && cw.y > -300.0;
  bool hl = uHLon > 0.01 && uBeam > 0.01;
  if (sun || hl) for (int i = 0; i < ${steps}; i++) {
    float t = (float(i) + j) * dt;
    vec3 T = exp(-uExt * t);
    if (hl) {
      vec3 pv = dv * t;
      for (int k = 0; k < 2; k++) {
        vec3 lp = k == 0 ? uHLv0 : uHLv1; vec3 l = pv - lp; float dl = length(l); l /= dl;
        float cone = smoothstep(0.55, 0.92, dot(l, k == 0 ? uHLdirV : uHLdir1));
        acc += cone * exp(-uExt * dl) / (dl * dl + 4.0) * hgPhase(dot(l, -dv), 0.35) * T * uHLpow * uBeam * 0.03 * dt;
      }
    }
    if (sun) {
      vec3 pw = cw + dw * t;
      float s = shaft(pw) - 0.6;
      acc += edAt(pw.y) * s * hgPhase(dot(dw, uSunDir), 0.75) * T * 0.035 * uShaft * dt * exp(pw.y / 60.0);
    }
  }
  gl_FragColor = vec4(base + max(acc, vec3(-0.5) * base), 1.0);
}`,
  });
  const bright = new THREE.ShaderMaterial({ vertexShader: QV, uniforms: { t: { value: null }, texel: { value: new THREE.Vector2() }, thr: { value: 1 } },
    fragmentShader: 'uniform sampler2D t; uniform vec2 texel; uniform float thr; varying vec2 vUv; void main(){ vec3 c = vec3(0.0); for (int i=-1;i<=1;i++) for (int j=-1;j<=1;j++) c += texture2D(t, vUv + vec2(i,j)*texel).rgb; c /= 9.0; float l = max(max(c.r,c.g),c.b); gl_FragColor = vec4(c * smoothstep(thr * 0.6, thr * 2.5, l), 1.0); }' });
  const blur = new THREE.ShaderMaterial({ vertexShader: QV, uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } },
    fragmentShader: 'uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227; c += (texture2D(t, vUv + dir*1.385).rgb + texture2D(t, vUv - dir*1.385).rgb) * 0.316; c += (texture2D(t, vUv + dir*3.231).rgb + texture2D(t, vUv - dir*3.231).rgb) * 0.070; gl_FragColor = vec4(c, 1.0); }' });
  const final = new THREE.ShaderMaterial({ vertexShader: QV,
    uniforms: { t: { value: null }, b1: { value: null }, b2: { value: null }, bloom: { value: 0.6 }, exposure: { value: 1 }, grain: { value: 0 }, uTime: WU.uTime, vig: { value: 0.35 }, wb: { value: new THREE.Vector3(1, 1, 1) } },
    fragmentShader: `uniform sampler2D t, b1, b2; uniform float bloom, exposure, grain, uTime, vig; uniform vec3 wb; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c = texture2D(t, vUv).rgb + (texture2D(b1, vUv).rgb * 0.7 + texture2D(b2, vUv).rgb * 1.1) * bloom;
  c *= exposure * wb;
  vec2 q = vUv - 0.5; c *= 1.0 - vig * dot(q, q) * 2.2;
  c += (h(gl_FragCoord.xy + fract(uTime) * 517.0) - 0.5) * grain * vec3(0.6, 0.8, 1.0);
  gl_FragColor = vec4(max(c, 0.0), 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}` });
  return { vol, bright, blur, final };
}
