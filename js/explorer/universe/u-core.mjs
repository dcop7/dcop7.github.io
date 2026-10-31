/* ══════════════════════════════════════════════════════════════════════
   Universo observável — núcleo: unidades, referenciais, cosmologia,
   formatação de distâncias e utilitários de shaders.

   Referencial do mundo: GALÁCTICO heliocêntrico, em METROS (doubles no JS).
     x → centro galáctico (l=0°), y → l=90° (sentido da rotação),
     z → polo norte galáctico.
   O GPU nunca vê metros: cada frame tudo é posto relativo à câmara e
   dividido pela escala de visão (ver u-engine.mjs).
   ══════════════════════════════════════════════════════════════════════ */
export * as THREE from 'https://esm.sh/three@0.160.0';
import * as THREE from 'https://esm.sh/three@0.160.0';

export const AU = 1.495978707e11;
export const LY = 9.4607304725808e15;
export const PC = 3.0856775814913673e16;
export const KPC = PC * 1e3, MPC = PC * 1e6, GPC = PC * 1e9;
export const KM = 1e3;
export const MSUN = 1.989e30;
export const C_KMS = 299792.458;
export const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** opacidade de uma camada visível em [a,b] com rampas de largura w (em décadas) */
export const band = (s, a, b, w = 0.35) => smooth(a - w, a + w * 0.2, s) * (1 - smooth(b - w * 0.2, b + w, s));

/* ── matrizes de referencial (aplicadas a vetores-coluna) ── */
const EG = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [+0.4941094279, -0.4448296300, +0.7469822445],
  [-0.8676661490, -0.1980763734, +0.4559837762],
];
const EPS = 23.4392911 * D2R;
export function eqToGal(v) {
  return [EG[0][0] * v[0] + EG[0][1] * v[1] + EG[0][2] * v[2], EG[1][0] * v[0] + EG[1][1] * v[1] + EG[1][2] * v[2], EG[2][0] * v[0] + EG[2][1] * v[1] + EG[2][2] * v[2]];
}
export function eclToEq(v) { const c = Math.cos(EPS), s = Math.sin(EPS); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; }
export const eclToGal = v => eqToGal(eclToEq(v));
export function radec(ra, dec, d = 1) {
  const cr = Math.cos(ra * D2R), sr = Math.sin(ra * D2R), cd = Math.cos(dec * D2R), sd = Math.sin(dec * D2R);
  return eqToGal([d * cd * cr, d * cd * sr, d * sd]);
}
/** matriz 3×3 (THREE.Matrix3) eclíptica→galáctica, para shaders */
export function eclToGalMat3() {
  const cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(eclToGal);
  return new THREE.Matrix3().set(cols[0][0], cols[1][0], cols[2][0], cols[0][1], cols[1][1], cols[2][1], cols[0][2], cols[1][2], cols[2][2]);
}
/** base de um referencial cujo "norte" é o polo dado (gal), para orientar a câmara */
export function frameFromPole(pole, ref) {
  const z = new THREE.Vector3(...pole).normalize();
  const x = new THREE.Vector3(...ref).projectOnPlane(z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
export const POLE_ECL = eclToGal([0, 0, 1]);
export const POLE_GAL = [0, 0, 1];
export const VERNAL = eclToGal([1, 0, 0]);

/* ── cosmologia: ΛCDM plano, Planck 2018 ── */
export const H0 = 67.66, OM = 0.3111;
export const DH = C_KMS / H0; /* Mpc */
const ZT = (() => { const N = 4000, ZMAX = 12, t = new Float64Array(N + 1); let acc = 0, prev = 1; for (let i = 1; i <= N; i++) { const z = ZMAX * i / N; const f = 1 / Math.sqrt(OM * (1 + z) ** 3 + (1 - OM)); acc += (prev + f) / 2 * (ZMAX / N); prev = f; t[i] = acc * DH; } return t; })();
export function comovingMpc(z) { const f = clamp(z, 0, 12) / 12 * 4000, i = Math.min(3999, Math.floor(f)); return ZT[i] + (ZT[i + 1] - ZT[i]) * (f - i); }
/** tempo de viagem da luz (mil milhões de anos) para um redshift */
export function lookbackGyr(z) {
  const N = 400, tH = 977.8 / H0; let acc = 0;
  for (let i = 0; i < N; i++) { const zz = (i + 0.5) / N * z; acc += 1 / ((1 + zz) * Math.sqrt(OM * (1 + zz) ** 3 + (1 - OM))); }
  return acc * z / N * tH;
}
export const AGE_GYR = 13.79;

/* ── formatação (pt-PT) ── */
const nf = (x, d = 0) => x.toLocaleString('pt-PT', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export function sig(x, n = 3) {
  if (!isFinite(x)) return '—';
  if (x === 0) return '0';
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(x))));
  return nf(+x.toFixed(Math.min(d, 6)), Math.min(d, 6));
}
/** número grande em palavras: 2,5 milhões / 13,8 mil milhões */
export function words(x, n = 3) {
  const a = Math.abs(x);
  if (a >= 1e18) return sig(x / 1e18, n) + ' triliões';
  if (a >= 1e12) return sig(x / 1e12, n) + ' biliões';
  if (a >= 1e9) return sig(x / 1e9, n) + ' mil milhões';
  if (a >= 1e6) return sig(x / 1e6, n) + (a < 2e6 ? ' milhão' : ' milhões');
  if (a >= 1e4) return nf(Math.round(x));
  return sig(x, n);
}
/** distância em metros → texto na unidade mais natural */
export function fmtDist(m, n = 3) {
  const a = Math.abs(m);
  if (a < 1e3) return sig(m, n) + ' m';
  if (a < 0.05 * AU) return words(m / 1e3, n) + ' km';
  if (a < 0.05 * LY) return sig(m / AU, n) + ' UA';
  const ly = m / LY;
  return words(ly, n) + (ly >= 1.5 && ly < 2 ? ' anos-luz' : ly < 1.5 && ly >= 1 ? ' ano-luz' : ' anos-luz');
}
/** distância em metros → várias unidades (para o painel) */
export function distLines(m) {
  const out = [];
  if (m < 0.2 * LY) out.push(words(m / 1e3, 4) + ' km');
  if (m > 1e9 && m < 2000 * LY) out.push(sig(m / AU, 4) + ' UA');
  if (m > 0.01 * LY) out.push(words(m / LY, 4) + ' anos-luz');
  if (m > 0.5 * PC && m < 0.5 * MPC) out.push(sig(m / PC, 4) + ' pc');
  if (m >= 0.5 * MPC) out.push(sig(m / MPC, 4) + ' Mpc');
  return out;
}
export function fmtLightTime(m) {
  const s = m / 299792458;
  if (s < 90) return sig(s, 3) + ' s';
  if (s < 5400) return sig(s / 60, 3) + ' min';
  if (s < 2 * 86400) return sig(s / 3600, 3) + ' h';
  if (s < 365.25 * 86400) return sig(s / 86400, 3) + ' dias';
  return words(s / 31557600, 3) + ' anos';
}
export function fmtMass(kg) {
  const ms = kg / MSUN;
  if (ms >= 0.01) return words(ms, 3) + ' massas solares';
  const me = kg / 5.972e24;
  if (me >= 0.001) return sig(me, 3) + ' massas terrestres';
  return sig(kg, 3).replace(/e\+?/, '×10^') + ' kg';
}

/* ── escala de visão: s = log10(distância da câmara ao foco, em metros) ── */
export const S_MIN = 6.9, S_MAX = 27.6;
const SCALE_UNITS = [
  [1e3, 'km', 1e3], [AU, 'UA', AU], [LY, 'ano-luz', LY],
];
/** comprimento "redondo" (1-2-5) para a barra de escala */
export function niceLength(m) {
  let unit = 1, name = 'm', plural = 'm';
  if (m >= 0.3 * LY) { unit = LY; name = 'ano-luz'; plural = 'anos-luz'; }
  else if (m >= 0.3 * AU) { unit = AU; name = 'UA'; plural = 'UA'; }
  else if (m >= 300) { unit = 1e3; name = 'km'; plural = 'km'; }
  const x = m / unit, p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
  const k = f >= 5 ? 5 : f >= 2 ? 2 : 1;
  const v = k * p;
  return { meters: v * unit, text: words(v, 3) + ' ' + (v === 1 ? name : plural) };
}
void SCALE_UNITS;

/* ── cor de estrela: B−V → temperatura → RGB linear (aprox. corpo negro) ── */
export function bvToKelvin(bv) { bv = clamp(bv, -0.4, 2.0); return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)); }
export function kelvinToRGB(T) {
  const t = T / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708 * Math.log(t) - 161.1196; b = t <= 19 ? 0 : 138.5177 * Math.log(t - 10) - 305.0448; }
  else { r = 329.6987 * Math.pow(t - 60, -0.1332); g = 288.1222 * Math.pow(t - 60, -0.0755); b = 255; }
  const c = v => Math.pow(clamp(v, 0, 255) / 255, 2.2);
  const R = c(r), G = c(g), B = c(b), L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  return [R / L, G / L, B / L];
}

/* ── shaders: profundidade logarítmica (o renderer usa logarithmicDepthBuffer) ── */
export const LOGDEPTH_V = ['#include <common>', '#include <logdepthbuf_pars_vertex>'].join('\n');
/* (os #include têm de ficar em linhas próprias) */
export const LOGDEPTH_V_MAIN = '\n#include <logdepthbuf_vertex>\n';
export const LOGDEPTH_F = '\n#include <logdepthbuf_pars_fragment>\n';
export const LOGDEPTH_F_MAIN = '\n#include <logdepthbuf_fragment>\n';

/** textura de brilho radial (sprites) */
export function glowTexture(size = 128, falloff = 2.2) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1, r = Math.hypot(dx, dy);
    const v = r >= 1 ? 0 : Math.pow(1 - r, falloff) * 0.85 + Math.exp(-r * r * 60) * 0.15;
    const i = (y * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(v * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

export async function fetchJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }
export async function fetchBin(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); }
export const isMobile = () => matchMedia('(max-width: 820px), (pointer: coarse)').matches;
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9*+ ]/g, ' ').replace(/\s+/g, ' ').trim();
export const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
