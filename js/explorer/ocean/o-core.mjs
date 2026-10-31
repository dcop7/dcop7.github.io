/* ══════════════════════════════════════════════════════════════════════
   Oceano profundo — núcleo: three.js, ótica da água, física, utilitários.

   Mundo em METROS: y para cima, superfície em y = 0, profundidade = −y.
   x = este, z = sul (a grelha GMRT tem a linha 0 a norte).

   Ótica (modelo, não medição): a luz solar que desce atenua-se com Kd
   (água oceânica muito límpida, Morel et al. 2007: o vermelho some em
   poucos metros, o azul chega mais longe). Na horizontal a imagem perde
   contraste com c = a + b (absorção + dispersão) e ganha "véu" — a mesma
   formação de imagem subaquática usada em visão computacional.
   ══════════════════════════════════════════════════════════════════════ */
export * as THREE from 'https://esm.sh/three@0.160.0';
import * as THREE from 'https://esm.sh/three@0.160.0';

export const D2R = Math.PI / 180;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const isMobile = () => matchMedia('(pointer: coarse)').matches || innerWidth < 760;
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export async function fetchJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }
export async function fetchI16(u) { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return new Int16Array(await r.arrayBuffer()); }

/* números em pt-PT: espaço fino como separador de milhares */
export const fmt = (x, d = 0) => (isFinite(x) ? Number(x).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

/* ── aleatório determinístico ── */
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
export const hash2 = (x, z) => { let h = (x * 374761393 + z * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/* ruído de valor 2D suave (CPU), para relevo de pormenor */
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
}
export function fbm(x, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * (vnoise(x * f, z * f) * 2 - 1); f *= 2.03; a *= 0.5; } return s; }

/* ── ótica da água ── */
export const KD = [0.38, 0.068, 0.022];          /* m⁻¹: atenuação difusa da luz descendente (vermelho, verde, azul) */
export const SUN_LUX = 100000;                    /* iluminância típica ao meio-dia à superfície */
/** fração da luz solar da superfície que chega a d metros, no azul (o canal que vai mais fundo) */
export const lightFrac = d => Math.exp(-KD[2] * d);
/** extinção horizontal (m⁻¹): mais plâncton (verde) perto da superfície, neve marinha em baixo */
export function extinction(d, out = [0, 0, 0]) {
  const k = smooth(0, 160, d);
  out[0] = lerp(0.42, 0.27, k); out[1] = lerp(0.095, 0.065, k); out[2] = lerp(0.06, 0.04, k);
  return out;
}

/* ── água do mar: Saunders (1981) e UNESCO 1983 ── */
export function pressureDbar(z, lat) {
  const c1 = (5.92 + 5.25 * Math.sin(lat * D2R) ** 2) * 1e-3;
  return ((1 - c1) - Math.sqrt((1 - c1) ** 2 - 8.84e-6 * z)) / 4.42e-6;
}
/** perfil → valor interpolado em z */
export function profAt(prof, z, k) {
  if (z <= prof[0].z) return prof[0][k];
  for (let i = 1; i < prof.length; i++) if (prof[i].z >= z) {
    const a = prof[i - 1], b = prof[i], t = (z - a.z) / (b.z - a.z);
    return a[k] + (b[k] - a[k]) * t;
  }
  return prof[prof.length - 1][k];
}

/* ── GLSL partilhado: modelo ótico da água ── */
export const WATER_PARS = /* glsl */`
uniform float uCamDepth, uTime, uCaus, uHLon, uHLpow, uSpark;
uniform vec3 uExt, uSun, uSunDir, uHLv0, uHLv1, uHLdirV, uHLdir1;
const vec3 KD = vec3(${KD.join(', ')});
vec3 edAt(float y) { return uSun * exp(-KD * max(-y, 0.0)); }
float hgPhase(float c, float g) { float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
/* radiância da água "ao infinito" na direção dir, a uma cota y: muito mais clara para cima,
   com um brilho para o lado do Sol (dispersão para a frente) */
vec3 veilAt(vec3 dir, float y) {
  vec3 e = edAt(y);
  float up = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  return e * (0.010 + 0.16 * up * up * up + 0.55 * hgPhase(dot(dir, uSunDir), 0.82)) * vec3(0.55, 0.85, 1.0);
}
/* luz dos faróis do submersível num ponto em coordenadas de vista (atenuação por canal) */
vec3 headlight(vec3 pv, vec3 n, vec3 albedo, float rough) {
  vec3 acc = vec3(0.0);
  if (uHLon < 0.01) return acc;
  vec3 V = normalize(-pv);
  for (int i = 0; i < 2; i++) {
    vec3 lp = i == 0 ? uHLv0 : uHLv1;
    vec3 l = lp - pv; float dl = length(l); l /= dl;
    float cone = smoothstep(0.55, 0.9, dot(-l, i == 0 ? uHLdirV : uHLdir1));
    float ndl = max(dot(n, l), 0.0);
    vec3 att = exp(-uExt * dl) / (dl * dl + 4.0);
    vec3 H = normalize(l + V);
    float spec = pow(max(dot(n, H), 0.0), mix(80.0, 6.0, rough)) * (1.0 - rough) * (1.0 - rough) * 0.25;
    acc += (albedo * ndl + spec) * att * cone;
  }
  return acc * uHLpow * uHLon;
}
float causticAt(vec2 p, float t) {
  vec2 q = p * 0.55;
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    q = mat2(1.6, 1.2, -1.2, 1.6) * q + vec2(t * 0.11, -t * 0.07);
    c += abs(sin(q.x + sin(q.y * 1.3 + t * 0.4)) * cos(q.y * 0.9 - t * 0.3));
  }
  return pow(1.0 - c / 3.0, 5.0) * 6.0;
}
`;
