/* ══════════════════════════════════════════════════════════════════
   Worker da mesa de trabalho (laboratório e mesa de revelação).

   O motor de píxeis (photo-lab.js) é o MESMO das lições — aqui só muda o
   sítio onde corre. Na página, um arrasto a 1100px custava ~380 ms por
   fotograma e prendia os cursores; aqui a interface fica livre e a página
   só recebe a imagem pronta e o histograma.

   Mensagens →  { type:'image', key, w, h, buf }            fotografia de trabalho
                { type:'matte', key, buf }                  recorte do sujeito (Float32 0..1)
                { type:'render', id, gen, key, mode, scene, st, params }
             ←  { type:'done', id, key, w, h, buf, hist, ms }
   ══════════════════════════════════════════════════════════════════ */
importScripts('/photography/js/photo-lab.js', '/photography/js/ph-sim.js');

const images = new Map();    // key → ImageData-like { width, height, data }
const mattes = new Map();    // key → Float32Array
const cache = new Map();     // máscaras e mapas de base por cena+tamanho

function memo(k, make) {
  if (!cache.has(k)) { if (cache.size > 40) cache.clear(); cache.set(k, make()); }
  return cache.get(k);
}

/* Estado da câmara → parâmetros do motor. */
function simParams(img, key, scene, st) {
  const w = img.width, h = img.height;
  const pl = PhSim.plan(scene, st);
  const matte = mattes.get(key) || null;
  const tag = scene.id + '@' + key;
  const needWarm = (scene.motion || []).some(m => m.region && m.region.key) || ((scene.depth && scene.depth.objects) || []).some(o => o.key);
  const warm = needWarm ? memo(tag + ':warm', () => PhSim.warmMap(img.data, w, h)) : null;
  const par = { exposure: pl.exposure, noise: pl.noise, noiseStable: true };

  /* o que se move na cena */
  const motions = [];
  (scene.motion || []).forEach((m, i) => {
    const extra = Math.max(0, m.speed * (st.t - scene.t));        // só o que a fotografia ainda não tem
    const len = Math.min(extra * w, w * 0.16);
    if (len < 1) return;
    /* panning: a câmara acompanha o sujeito, por isso é o FUNDO que arrasta */
    const mk = m.mask === 'matte' && st.pan ? 'bg' : m.mask;
    const mask = mk === 'matte' ? matte
      : mk === 'bg' ? (matte ? memo(tag + ':bg', () => matte.map(v => 1 - v)) : null)
      : memo(tag + ':m' + i, () => PhSim.regionMask(m.region, w, h, warm));
    if (m.mask && !mask) return;
    motions.push({ len, angle: m.angle || 0, mask, silk: m.silk ? Math.min(len * 0.3, 12) : 0,
      layer: mk === 'matte' ? 'fg' : mk === 'bg' ? 'bg' : null });
  });
  /* o tremido da câmara: a imagem toda */
  const sh = Math.min(pl.shake * w, w * 0.12);
  if (sh >= 1) motions.push({ len: sh, angle: 28, mask: null });
  if (motions.length) par.motions = motions;

  /* a ótica: desfoque por píxel, em relação ao que a fotografia já tinha */
  if (scene.depth) {
    const pre = memo(tag + ':pre', () => PhSim.depthPre(scene, w, h, warm));
    const base = memo(tag + ':base' + (matte ? 'm' : ''), () => PhSim.blurMap(scene, PhSim.shotOf(scene), w, h, pre, matte).map);
    const now = PhSim.blurMap(scene, st, w, h, pre, matte);
    let max = 0;
    for (let i = 0; i < now.map.length; i++) {
      const r = Math.sqrt(Math.max(0, now.map[i] * now.map[i] - base[i] * base[i]));
      now.map[i] = r; if (r > max) max = r;
    }
    const cap = Math.min(w, h) * 0.06;                             // um desfoque maior já não acrescenta leitura
    if (max > cap) { for (let i = 0; i < now.map.length; i++) if (now.map[i] > cap) now.map[i] = cap; max = cap; }
    if (max >= 0.7) { par.blurMap = now.map; par.blurMax = max; }
  }
  return par;
}

/* Receita da mesa de revelação: só falta transformar os pontos em LUT. */
function devParams(p) {
  const par = Object.assign({}, p);
  if (par.curvePts) { par.curve = PhotoLab.curveLUT(par.curvePts); delete par.curvePts; }
  return par;
}

/* Seda: a água a longa exposição não fica só arrastada, fica lisa. */
function silkPass(img, motions) {
  /* aplicado dentro do motor não dá (a caixa é global): faz-se aqui, antes,
     sobre uma cópia, e o motor recebe a fotografia já alisada na zona. */
  let S = img.data;
  const w = img.width, h = img.height;
  for (const m of motions) {
    if (!m.silk || m.silk < 1 || !m.mask) continue;
    const B = PhotoLab.boxBlur(S, w, h, Math.round(m.silk));
    const out = new Uint8ClampedArray(S.length);
    for (let i = 0, p = 0; i < S.length; i += 4, p++) {
      const k = m.mask[p];
      out[i] = S[i] + (B[i] - S[i]) * k; out[i + 1] = S[i + 1] + (B[i + 1] - S[i + 1]) * k;
      out[i + 2] = S[i + 2] + (B[i + 2] - S[i + 2]) * k; out[i + 3] = S[i + 3];
    }
    S = out;
  }
  return S === img.data ? img : { width: w, height: h, data: S };
}

self.onmessage = e => {
  const m = e.data;
  if (m.type === 'image') {
    images.set(m.key, { width: m.w, height: m.h, data: new Uint8ClampedArray(m.buf) });
    mattes.delete(m.key);
    for (const k of [...cache.keys()]) if (k.endsWith('@' + m.key) || k.includes('@' + m.key + ':')) cache.delete(k);
    return;
  }
  if (m.type === 'matte') { mattes.set(m.key, new Float32Array(m.buf)); return; }
  if (m.type === 'drop') { images.delete(m.key); mattes.delete(m.key); return; }
  if (m.type !== 'render') return;

  const t0 = performance.now();
  let src = images.get(m.key);
  if (!src) { self.postMessage({ type: 'done', id: m.id, gen: m.gen, key: m.key, error: 'no-image' }); return; }
  try {
    const par = m.mode === 'sim' ? simParams(src, m.key, m.scene, m.st) : devParams(m.params);
    if (par.motions && par.motions.some(x => x.silk)) src = silkPass(src, par.motions);
    const dst = { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data.length) };
    PhotoLab.process(src, dst, par);
    const hist = PhotoLab.histogram(dst);
    self.postMessage({ type: 'done', id: m.id, gen: m.gen, key: m.key, w: dst.width, h: dst.height, buf: dst.data.buffer, hist,
      ms: Math.round(performance.now() - t0) }, [dst.data.buffer]);
  } catch (err) {
    self.postMessage({ type: 'done', id: m.id, gen: m.gen, key: m.key, error: String(err && err.message || err) });
  }
};
