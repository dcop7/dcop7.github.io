/* ══════════════════════════════════════════════════════════════════════
   Estúdio virtual — revelação da fotografia (pós-processamento próprio).

   A câmara fotográfica renderiza para um alvo HDR linear com profundidade.
   Este passe aplica, por esta ordem:
     1. profundidade de campo com o círculo de confusão da ótica fina
        (focal, abertura, distância de foco, tamanho do sensor)
     2. exposição: X = π·ISO / (250·N²)  — a mesma constante do fotómetro
     3. obturador acima da velocidade de sincronização → faixa sem flash
     4. ruído de ISO (mais visível nas sombras)
     5. curva de tons ACES + sRGB
   É uma simulação didática: não modela difração, aberrações, vinhetagem
   real da objetiva nem a forma exata do bokeh.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE } from './st-core.mjs';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function createPost() {
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const develop = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null }, tDepth: { value: null },
      near: { value: 0.1 }, far: { value: 50 },
      res: { value: new THREE.Vector2(1, 1) },
      cocK: { value: 0 },          // A·f/(s−f) em píxeis·m (ver dof())
      focusD: { value: 2 },
      maxCoc: { value: 18 },
      exposure: { value: 1 },
      band: { value: 1 }, bandAmb: { value: 0.03 },
      noise: { value: 0 }, seed: { value: 0.37 },
      dofOn: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      #include <tonemapping_pars_fragment>
      uniform sampler2D tColor, tDepth;
      uniform float near, far, cocK, focusD, maxCoc, exposure, band, bandAmb, noise, seed, dofOn;
      uniform vec2 res;
      varying vec2 vUv;
      float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
      float coc(vec2 uv){ float z = lin(texture2D(tDepth, uv).x); return min(maxCoc, abs(cocK * (z - focusD) / max(z, 1e-3))); }
      float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main(){
        vec3 col = texture2D(tColor, vUv).rgb;
        if (dofOn > 0.5) {
          float c0 = coc(vUv);
          if (c0 > 0.6) {
            vec3 acc = col; float wsum = 1.0;
            const float GA = 2.39996323;
            for (int i = 1; i < 48; i++) {
              float r = sqrt(float(i) / 48.0) * c0;
              float a = float(i) * GA;
              vec2 uv = vUv + vec2(cos(a), sin(a)) * r / res;
              float cs = coc(uv);
              /* a amostra só conta se o seu próprio disco cobre este píxel:
                 o sujeito nítido não "sangra" para o fundo desfocado */
              float w = clamp(cs - r + 1.0, 0.0, 1.0);
              acc += texture2D(tColor, uv).rgb * w; wsum += w;
            }
            col = acc / wsum;
          }
        }
        col *= exposure;
        /* cortina do obturador acima da sincronização: só uma faixa recebe o flash */
        if (vUv.y < 1.0 - band) col *= bandAmb;
        /* ruído de ISO: grão de luminância + crominância leve, pior nas sombras */
        if (noise > 0.0) {
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float n1 = h12(gl_FragCoord.xy + seed * 91.7) - 0.5;
          vec3 nc = vec3(h12(gl_FragCoord.xy * 1.37 + 3.1), h12(gl_FragCoord.xy * 0.91 + 7.7), h12(gl_FragCoord.xy * 1.13 + 5.3)) - 0.5;
          float amp = noise * (0.35 + 0.65 * inversesqrt(max(l, 0.002) * 40.0 + 1.0));
          col = max(vec3(0.0), col + (n1 * 0.85 + nc * 0.35) * amp * (sqrt(l) * 0.25 + 0.02));
        }
        col = ACESFilmicToneMapping(col);
        gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  develop.toneMapped = false;

  /* apresentação: atual | instantâneo, separados por uma linha arrastável */
  const present = new THREE.ShaderMaterial({
    uniforms: { tA: { value: null }, tB: { value: null }, split: { value: -1 }, res: { value: new THREE.Vector2(1, 1) }, zebra: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D tA, tB; uniform float split, zebra; uniform vec2 res; varying vec2 vUv;
      void main(){
        vec3 a = texture2D(tA, vUv).rgb;
        if (split >= 0.0 && vUv.x < split) a = texture2D(tB, vUv).rgb;
        if (split >= 0.0 && abs(vUv.x - split) * res.x < 1.0) a = vec3(1.0);
        if (zebra > 0.5 && max(a.r, max(a.g, a.b)) > 0.985) {
          float s = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 10.0));
          a = mix(a, vec3(s), 0.65);
        }
        gl_FragColor = vec4(a, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  return {
    develop, present,
    run(renderer, mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene, cam); },
  };
}

/** Círculo de confusão em píxeis: c(z) = A·f·|z−s| / (z·(s−f)), A = f/N.
 *  Devolve k tal que c = k·|z−s|/z, já convertido para píxeis da imagem. */
export function cocFactor({ focal, fnum, focus, sensorH, imageH }) {
  const f = focal / 1000, A = f / fnum, s = Math.max(focus, f * 1.5);
  const cMeters = A * f / (s - f);          // no plano do sensor
  return cMeters / (sensorH / 1000) * imageH;
}
