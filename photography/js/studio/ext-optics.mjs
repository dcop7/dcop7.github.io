/* ══════════════════════════════════════════════════════════════════════
   Exterior — ótica e revelação.

   Cada fotografia é a MÉDIA de várias subexposições (progressivas, algumas
   por frame): em cada uma os carros estão no instante correspondente do
   obturador, a câmara treme se for à mão e a amostragem do píxel varia
   (antisserrilhado). Por subexposição:
     1. render HDR linear com profundidade
     2. profundidade de campo: desfoque por recolha (círculo de confusão da
        ótica fina) para o que não é muito brilhante...
     3. ...e "bokeh" por dispersão: cada ponto muito brilhante e desfocado
        vira um disco com a forma do diafragma (círculo aberto, polígono de
        lâminas quando se fecha, "olho de gato" nas bordas a f/1,4–2,8),
        com a energia conservada
   Depois: balanço de brancos, exposição X = π·ISO·t/(250·N²)/K, ruído de
   ISO (fixo por disparo), curva ACES e sRGB.
   Não modela difração, aberrações nem o perfil de ruído de um sensor real.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE } from './st-core.mjs';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const DEPTH = `
  uniform sampler2D tDepth; uniform float near, far, cocK, focusD, maxCoc;
  float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
  float cocAt(float z){ return min(maxCoc, cocK * abs(z - focusD) / max(z, 1e-3)); }`;

export function createOptics(renderer, { mobile = false } = {}) {
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const gl = renderer.getContext();
  const maxPt = Math.min(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64, 512);
  const SAMPLES = mobile ? 40 : 64;

  const common = () => ({ tDepth: { value: null }, near: { value: 0.1 }, far: { value: 1500 }, cocK: { value: 0 }, focusD: { value: 3 }, maxCoc: { value: 40 } });

  /* 2) recolha — só a parte "baixa" de cada amostra (os realces vão para a dispersão) */
  const gather = new THREE.ShaderMaterial({
    uniforms: { ...common(), tColor: { value: null }, res: { value: new THREE.Vector2() }, thr: { value: 1 }, rot: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: `${DEPTH}
      uniform sampler2D tColor; uniform vec2 res; uniform float thr, rot; varying vec2 vUv;
      vec3 low(vec3 c, float k){ float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return c * mix(1.0, min(1.0, thr / max(l, 1e-6)), smoothstep(1.0, 2.5, k)); }
      float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main(){
        float c0 = cocAt(lin(texture2D(tDepth, vUv).x));
        vec3 col = low(texture2D(tColor, vUv).rgb, c0);
        if (c0 > 0.6) {
          vec3 acc = col; float ws = 1.0;
          float a0 = rot + h12(gl_FragCoord.xy) * 6.2831853;
          for (int i = 1; i < ${SAMPLES}; i++) {
            float r = sqrt((float(i) + 0.5) / ${SAMPLES}.0) * c0;
            float a = a0 + float(i) * 2.39996323;
            vec2 uv = vUv + vec2(cos(a), sin(a)) * r / res;
            float cs = cocAt(lin(texture2D(tDepth, uv).x));
            /* só conta se o disco da própria amostra chega a este píxel:
               o sujeito nítido não "sangra" para o fundo desfocado */
            float w = clamp(cs - r + 1.0, 0.0, 1.0);
            acc += low(texture2D(tColor, uv).rgb, cs) * w; ws += w;
          }
          col = acc / ws;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  /* 3) dispersão — um ponto por texel da grelha (meia/quarta resolução) */
  const scatter = new THREE.ShaderMaterial({
    uniforms: { ...common(), tColor: { value: null }, res: { value: new THREE.Vector2() }, thr: { value: 1 }, texel: { value: 4 }, maxPt: { value: maxPt },
      blades: { value: 7 }, bladeMix: { value: 0 }, bladeRot: { value: 0.3 }, cat: { value: 0 }, aspect: { value: 1.5 } },
    vertexShader: `${DEPTH}
      uniform sampler2D tColor; uniform vec2 res; uniform float thr, texel, maxPt;
      varying vec3 vCol; varying float vC, vZ, vSize; varying vec2 vUvS;
      void main(){
        vec2 uv = position.xy;
        float z = lin(texture2D(tDepth, uv).x);
        float c = cocAt(z);
        vec3 col = texture2D(tColor, uv).rgb;
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        vec3 hi = col * max(0.0, 1.0 - thr / max(l, 1e-6)) * smoothstep(1.0, 2.5, c);
        vSize = min(2.0 * c + 1.0, maxPt);
        float rr = vSize * 0.5;
        vCol = hi * texel / (3.14159265 * rr * rr);
        vC = c; vZ = z; vUvS = uv;
        gl_Position = (max(hi.r, max(hi.g, hi.b)) <= 0.0) ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(uv * 2.0 - 1.0, 0.0, 1.0);
        gl_PointSize = vSize;
      }`,
    fragmentShader: `${DEPTH}
      uniform vec2 res; uniform float blades, bladeMix, bladeRot, cat, aspect;
      varying vec3 vCol; varying float vC, vZ, vSize; varying vec2 vUvS;
      void main(){
        vec2 p = gl_PointCoord * 2.0 - 1.0; p.y = -p.y;
        float d = length(p);
        /* diafragma: círculo aberto → polígono de lâminas ao fechar */
        float a = atan(p.y, p.x) + bladeRot, seg = 6.2831853 / blades;
        float poly = d * cos(mod(a, seg) - seg * 0.5) / cos(seg * 0.5);
        float dd = mix(d, poly, bladeMix);
        /* olho de gato: vinhetagem mecânica nas bordas com a objetiva aberta */
        vec2 off = (vUvS - 0.5) * vec2(aspect, 1.0) * 2.0;
        float ce = length(p + off * cat * 0.55);
        float edge = 1.5 / max(vSize, 2.0);
        float m = (1.0 - smoothstep(1.0 - edge, 1.0, dd)) * (1.0 - smoothstep(1.0 - edge, 1.0, ce));
        if (m <= 0.0) discard;
        /* bolha de sabão: rebordo ligeiramente mais claro */
        m *= 0.86 + 0.3 * smoothstep(0.55, 0.98, dd);
        /* um objeto nítido mais perto tapa o bokeh que está atrás */
        float zd = lin(texture2D(tDepth, gl_FragCoord.xy / res).x);
        if (zd < vZ * 0.85 && cocAt(zd) < vC * 0.35) discard;
        gl_FragColor = vec4(vCol * m, 1.0);
      }`,
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
  const ptScene = new THREE.Scene();
  let points = null;

  /* 4) acumulação: média corrida */
  const accum = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, a: { value: 1 } }, vertexShader: VERT,
    fragmentShader: `uniform sampler2D tSrc; uniform float a; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, a); }`,
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });

  /* 5) revelação */
  const develop = new THREE.ShaderMaterial({
    uniforms: { tAcc: { value: null }, exposure: { value: 1 }, wb: { value: new THREE.Vector3(1, 1, 1) }, noise: { value: 0 }, seed: { value: 0.37 }, res: { value: new THREE.Vector2() } },
    vertexShader: VERT,
    fragmentShader: `
      #include <tonemapping_pars_fragment>
      uniform sampler2D tAcc; uniform float exposure, noise, seed; uniform vec3 wb; uniform vec2 res; varying vec2 vUv;
      float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main(){
        vec3 col = texture2D(tAcc, vUv).rgb * wb * exposure;
        if (noise > 0.0) {
          /* grão de luminância + crominância, pior nas sombras (ilustrativo) */
          vec2 px = floor(vUv * res);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float n1 = h12(px + seed * 91.7) + h12(px * 1.7 + seed * 13.1) - 1.0;
          vec3 nc = vec3(h12(px * 1.37 + 3.1 + seed), h12(px * 0.91 + 7.7 + seed), h12(px * 1.13 + 5.3 + seed)) - 0.5;
          float amp = noise * (0.3 + 0.7 * inversesqrt(max(l, 0.002) * 30.0 + 1.0));
          col = max(vec3(0.0), col + (n1 * 0.8 + nc * 0.55) * amp * (sqrt(max(l, 0.0)) * 0.3 + 0.025));
        }
        col = ACESFilmicToneMapping(col);
        gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  develop.toneMapped = false;

  /* 6) apresentação: A | B, zebras e "zona nítida" (o que está dentro da profundidade de campo) */
  const present = new THREE.ShaderMaterial({
    uniforms: { ...common(), tA: { value: null }, tB: { value: null }, split: { value: -1 }, res: { value: new THREE.Vector2() }, zebra: { value: 0 }, peak: { value: 0 }, dofN: { value: 0 }, dofF: { value: 1e9 } },
    vertexShader: VERT,
    fragmentShader: `${DEPTH}
      uniform sampler2D tA, tB; uniform float split, zebra, peak, dofN, dofF; uniform vec2 res; varying vec2 vUv;
      void main(){
        vec3 a = texture2D(tA, vUv).rgb;
        bool right = !(split >= 0.0 && vUv.x < split);
        if (!right) a = texture2D(tB, vUv).rgb;
        if (split >= 0.0 && abs(vUv.x - split) * res.x < 1.0) a = vec3(1.0);
        if (right && peak > 0.5) {
          /* dentro da profundidade de campo (círculo de 0,03 mm) — os mesmos limites da explicação */
          float z = lin(texture2D(tDepth, vUv).x);
          if (z >= dofN && z <= dofF) a = mix(a, vec3(0.25, 1.0, 0.55), 0.38);
        }
        if (zebra > 0.5 && max(a.r, max(a.g, a.b)) > 0.985) {
          float s = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 10.0));
          a = mix(a, vec3(s), 0.65);
        }
        gl_FragColor = vec4(a, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  let W = 0, H = 0, rtScene = null, rtDof = null, rtAcc = null, rtOut = null, rtSnap = null;
  const run = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); };

  function resize(w, h) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (w === W && h === H) return false;
    W = w; H = h;
    for (const t of [rtScene, rtDof, rtAcc, rtOut]) t?.dispose();
    const depth = new THREE.DepthTexture(W, H); depth.type = THREE.UnsignedIntType;
    rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthTexture: depth });
    rtDof = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
    rtAcc = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
    rtOut = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
    rtSnap?.dispose(); rtSnap = null;
    /* grelha da dispersão */
    const step = mobile ? 4 : 2, gw = Math.ceil(W / step), gh = Math.ceil(H / step);
    const pos = new Float32Array(gw * gh * 3);
    for (let y = 0, i = 0; y < gh; y++) for (let x = 0; x < gw; x++, i += 3) { pos[i] = (x * step + step / 2) / W; pos[i + 1] = (y * step + step / 2) / H; }
    if (points) { ptScene.remove(points); points.geometry.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    points = new THREE.Points(g, scatter); points.frustumCulled = false; ptScene.add(points);
    scatter.uniforms.texel.value = step * step;
    return true;
  }

  /** p: { exposure, cocK, focusD, maxCoc, fnum, near, far } */
  function setLens(p) {
    for (const m of [gather, scatter, present]) {
      const u = m.uniforms;
      u.cocK.value = p.cocK; u.focusD.value = p.focusD; u.maxCoc.value = p.maxCoc; u.near.value = p.near; u.far.value = p.far;
    }
    /* acima de ~1 depois da exposição: realce que se espalha como disco de bokeh */
    gather.uniforms.thr.value = scatter.uniforms.thr.value = 1.2 / Math.max(p.exposure, 1e-9);
    /* lâminas: redondo até f/2, polígono a partir de ~f/5,6 */
    scatter.uniforms.bladeMix.value = Math.min(1, Math.max(0, (Math.log2(p.fnum) - 1) / 1.6));
    scatter.uniforms.cat.value = Math.max(0, 1 - (Math.log2(p.fnum) - 0.5) / 1.5);
    scatter.uniforms.aspect.value = W / H;
  }

  /** desenha UMA subexposição (a cena já está no instante certo) e soma-a à média */
  function subframe(scene, camera, k) {
    renderer.setRenderTarget(rtScene);
    renderer.setClearColor(0x000000, 1); renderer.clear();
    renderer.render(scene, camera);
    const tex = rtScene.texture, dep = rtScene.depthTexture;
    gather.uniforms.tColor.value = tex; gather.uniforms.tDepth.value = dep; gather.uniforms.res.value.set(W, H);
    gather.uniforms.rot.value = k * 2.39996323;
    run(gather, rtDof);
    scatter.uniforms.tColor.value = tex; scatter.uniforms.tDepth.value = dep; scatter.uniforms.res.value.set(W, H);
    renderer.setRenderTarget(rtDof); renderer.render(ptScene, camera);
    accum.uniforms.tSrc.value = rtDof.texture; accum.uniforms.a.value = 1 / (k + 1);
    run(accum, rtAcc);
  }

  function developTo({ exposure, wb, noise, seed }) {
    const d = develop.uniforms;
    d.tAcc.value = rtAcc.texture; d.exposure.value = exposure; d.wb.value.set(...wb); d.noise.value = noise; d.seed.value = seed; d.res.value.set(W, H);
    const prev = renderer.toneMappingExposure; renderer.toneMappingExposure = 1;
    run(develop, rtOut);
    renderer.toneMappingExposure = prev;
  }

  function presentTo(rect, { split = -1, zebra = false, peak = false, dof = [0, 1e9] } = {}) {
    const p = present.uniforms;
    p.tA.value = rtOut.texture; p.tB.value = rtSnap ? rtSnap.texture : rtOut.texture;
    p.split.value = rtSnap ? split : -1; p.res.value.set(rect.w, rect.h);
    p.zebra.value = zebra ? 1 : 0; p.peak.value = peak ? 1 : 0; p.dofN.value = dof[0]; p.dofF.value = isFinite(dof[1]) ? dof[1] : 1e9;
    p.tDepth.value = rtScene.depthTexture;
    renderer.setRenderTarget(null);
    renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
    renderer.setScissor(rect.x, rect.y, rect.w, rect.h); renderer.setScissorTest(true);
    quad.material = present; renderer.render(qScene, qCam);
    renderer.setScissorTest(false);
  }

  const copyMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: VERT, fragmentShader: `uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }`, depthTest: false, depthWrite: false });
  function snapshot() {
    if (!rtSnap) rtSnap = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
    copyMat.uniforms.t.value = rtOut.texture; run(copyMat, rtSnap);
  }
  function clearSnap() { rtSnap?.dispose(); rtSnap = null; }

  function read(maxW = 120) {
    const buf = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(rtOut, 0, 0, W, H, buf);
    return { buf, w: W, h: H, step: Math.max(1, Math.floor(W / maxW)) };
  }

  function dispose() { for (const t of [rtScene, rtDof, rtAcc, rtOut, rtSnap]) t?.dispose(); points?.geometry.dispose(); }

  return { resize, setLens, subframe, developTo, presentTo, snapshot, clearSnap, read, dispose, get size() { return [W, H]; }, get hasSnap() { return !!rtSnap; }, maxPt };
}
