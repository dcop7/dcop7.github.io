/* ══════════════════════════════════════════════════════════════════════
   PhotoLab — motor de revelação em canvas.

   Existe para que as demonstrações da secção Edição sejam VERDADEIRAS: cada
   cursor aplica mesmo o ajuste aos píxeis, em vez de trocar duas imagens
   pré-cozinhadas. Quem mexe no cursor de Realces está a ver realces a serem
   recuperados, não uma animação.

   Tudo é local (canvas + ImageData), sem dependências e sem rede. As imagens
   vêm de assets/photo/ (mesma origem, por isso não há problema de CORS ao
   ler os píxeis).

   API:
     PhotoLab.process(src, dst, params)   → aplica params (ImageData → ImageData)
     PhotoLab.curveLUT(points)            → LUT 256 a partir de pontos de controlo
     PhotoLab.defaults()                  → objeto de parâmetros neutro

   Ordem interna (a mesma que a secção Edição ensina): balanço de brancos →
   exposição/tonalidade → curva → cor → detalhe → ruído.
   ════════════════════════════════════════════════════════════════════ */
const PhotoLab = (function () {
  'use strict';

  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

  function defaults() {
    return {
      exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
      temp: 0, tint: 0, saturation: 0, vibrance: 0,
      clarity: 0, texture: 0, dehaze: 0, sharpen: 0,
      noise: 0, denoise: 0,
      // ── primitivas de "look" (estilos e técnicas criativas) ──────────
      // Existem porque um estilo não se explica com exposição e contraste: o
      // que o define são estas decisões. Todas neutras a 0, por isso nada do
      // que já existia muda de comportamento.
      fade: 0,              // pretos levantados (matte/film): 0..100
      grain: 0,             // grão de filme (luminância, estável entre frames)
      grainSize: 1,         // 1 = fino, 2..3 = grosso (ISO alto / 35mm push)
      bloom: 0,             // halo difuso a partir das altas luzes
      halation: 0,          // o mesmo halo, tingido de vermelho (filme)
      vignette: 0,          // -100 (cantos claros) .. 100 (cantos escuros)
      // ── primitivas GEOMÉTRICAS (cheatsheets de velocidade e abertura) ──
      motion: 0,            // arrasto direcional: 0..100 (∝ tempo de exposição)
      motionAngle: 0,       // direção do arrasto, em graus (0 = horizontal)
      defocus: 0,           // desfoque fora do plano de foco: 0..100 (∝ ∅ da abertura)
      defocusCx: 0.5, defocusCy: 0.55,   // onde está focado, em fração da imagem
      defocusR: 0.24,       // raio nítido (fração da meia-diagonal)
      defocusFeather: 0.55, // quão depressa o desfoque cresce a partir daí
      curve: null,          // LUT (Uint8Array 256) ou null
      hsl: null,            // { redHue, redSat, redLum, ... } por banda
      splitShadow: null, splitHigh: null,  // color grading: [r,g,b] -1..1
    };
  }

  /* ── curva de tons: spline monótona por pontos de controlo ────────── */
  function curveLUT(points) {
    const pts = (points || []).slice().sort((a, b) => a[0] - b[0]);
    if (pts.length < 2) return null;
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      let j = 0;
      while (j < pts.length - 2 && pts[j + 1][0] < x) j++;
      const [x0, y0] = pts[j], [x1, y1] = pts[j + 1];
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      // smoothstep entre pontos: sem picos e sem inversões
      const s = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
      lut[i] = clamp255(Math.round((y0 + (y1 - y0) * s) * 255));
    }
    return lut;
  }

  /* ── desfoque de caixa (base para clarity/dehaze/nitidez/ruído) ────
     Duas passagens separáveis com soma corrente: O(n) por raio. */
  function boxBlur(src, w, h, r) {
    if (r < 1) return new Uint8ClampedArray(src);
    const tmp = new Uint8ClampedArray(src.length);
    const out = new Uint8ClampedArray(src.length);
    const win = r * 2 + 1;
    for (let y = 0; y < h; y++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        const row = y * w * 4;
        for (let i = -r; i <= r; i++) sum += src[row + clamp(i, 0, w - 1) * 4 + c];
        for (let x = 0; x < w; x++) {
          tmp[row + x * 4 + c] = sum / win;
          sum -= src[row + clamp(x - r, 0, w - 1) * 4 + c];
          sum += src[row + clamp(x + r + 1, 0, w - 1) * 4 + c];
        }
      }
    }
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += tmp[clamp(i, 0, h - 1) * w * 4 + x * 4 + c];
        for (let y = 0; y < h; y++) {
          out[y * w * 4 + x * 4 + c] = sum / win;
          sum -= tmp[clamp(y - r, 0, h - 1) * w * 4 + x * 4 + c];
          sum += tmp[clamp(y + r + 1, 0, h - 1) * w * 4 + x * 4 + c];
        }
      }
    }
    return out;
  }

  /* ── desfoques GEOMÉTRICOS (cheatsheets de velocidade e de abertura) ──
     Os cursores todos acima são tonais: mudam a cor de cada píxel no sítio
     onde ele está. Estes dois mudam PARA ONDE a luz vai — que é exatamente
     o que a velocidade e a abertura fazem à imagem — e por isso correm
     ANTES do resto do pipeline, sobre a fotografia crua.

     `motion`  — arrasto direcional: média ao longo de uma reta. É o que
                 acontece quando o sujeito (ou a câmara) percorre pixels
                 enquanto o obturador está aberto: o comprimento do rasto é
                 proporcional ao TEMPO de exposição, e é essa proporção que
                 torna a progressão 1/1000 → 1/30 honesta e não decorativa.
     `defocus` — desfoque que CRESCE com a distância ao plano de foco. Não
                 há mapa de profundidade numa fotografia já feita, por isso
                 o plano é declarado (centro + raio, em fração da imagem):
                 dentro do raio fica nítido, fora vai abrindo. Aproximação
                 assumida — serve para ver a relação abertura ⇄ fundo, não
                 para medir bokeh. */

  // Mistura por píxel entre três níveis de nitidez (0 = nítido, 1 = máximo).
  function blendLevels(S, A, B, mask, n) {
    const out = new Uint8ClampedArray(S.length);
    for (let i = 0, p = 0; p < n; p++, i += 4) {
      const m = mask[p];
      if (m <= 0) { out[i] = S[i]; out[i + 1] = S[i + 1]; out[i + 2] = S[i + 2]; out[i + 3] = S[i + 3]; continue; }
      let lo, hi, t;
      if (m < 0.5) { lo = S; hi = A; t = m * 2; } else { lo = A; hi = B; t = (m - 0.5) * 2; }
      out[i] = lo[i] + (hi[i] - lo[i]) * t;
      out[i + 1] = lo[i + 1] + (hi[i + 1] - lo[i + 1]) * t;
      out[i + 2] = lo[i + 2] + (hi[i + 2] - lo[i + 2]) * t;
      out[i + 3] = S[i + 3];
    }
    return out;
  }

  function motionBlur(S, w, h, amount, angleDeg) {
    // comprimento do rasto em píxeis, relativo à largura (0..100 → 0..18%)
    const len = Math.max(1, Math.round((amount / 100) * w * 0.18));
    const a = (angleDeg || 0) * Math.PI / 180;
    const dx = Math.cos(a), dy = Math.sin(a);
    const taps = Math.min(48, Math.max(3, len));
    const out = new Uint8ClampedArray(S.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0;
        for (let t = 0; t < taps; t++) {
          const f = taps === 1 ? 0 : (t / (taps - 1) - 0.5) * len;
          const sx = clamp(Math.round(x + dx * f), 0, w - 1);
          const sy = clamp(Math.round(y + dy * f), 0, h - 1);
          const j = (sy * w + sx) * 4;
          r += S[j]; g += S[j + 1]; b += S[j + 2];
        }
        const i = (y * w + x) * 4;
        out[i] = r / taps; out[i + 1] = g / taps; out[i + 2] = b / taps; out[i + 3] = S[i + 3];
      }
    }
    return out;
  }

  function defocusBlur(S, w, h, p) {
    const amt = p.defocus / 100;
    const rMax = Math.max(2, Math.round(Math.min(w, h) * 0.09 * amt));
    const A = boxBlur(S, w, h, Math.max(1, Math.round(rMax * 0.45)));
    const B = boxBlur(S, w, h, rMax);
    const cx = (p.defocusCx == null ? 0.5 : p.defocusCx) * w;
    const cy = (p.defocusCy == null ? 0.55 : p.defocusCy) * h;
    const inner = (p.defocusR == null ? 0.24 : p.defocusR) * Math.hypot(w, h) / 2;
    const outer = inner + (p.defocusFeather == null ? 0.55 : p.defocusFeather) * Math.hypot(w, h) / 2;
    const mask = new Float32Array(w * h);
    for (let y = 0, k = 0; y < h; y++) {
      for (let x = 0; x < w; x++, k++) {
        const d = Math.hypot(x - cx, y - cy);
        const t = d <= inner ? 0 : d >= outer ? 1 : (d - inner) / (outer - inner);
        mask[k] = t * t * (3 - 2 * t);           // smoothstep: sem aresta visível
      }
    }
    return blendLevels(S, A, B, mask, w * h);
  }

  const LUMA = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  /* ── HSL por banda de matiz ───────────────────────────────────────── */
  const BANDS = [
    { id: 'red', c: 0 }, { id: 'orange', c: 30 }, { id: 'yellow', c: 60 },
    { id: 'green', c: 120 }, { id: 'aqua', c: 180 }, { id: 'blue', c: 240 },
    { id: 'purple', c: 280 }, { id: 'magenta', c: 320 },
  ];
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    const l = (mx + mn) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  // Peso de uma banda para um matiz: triangular, com sobreposição suave.
  function bandWeight(h, centre) {
    let d = Math.abs(h - centre);
    if (d > 180) d = 360 - d;
    return d >= 45 ? 0 : 1 - d / 45;
  }

  /* ── grão determinístico ──────────────────────────────────────────────
     Um `Math.random()` por píxel faz a imagem "ferver" a cada re-render, o
     que num cursor de dose lê-se como avaria e não como grão. Esta hash dá
     sempre o mesmo valor para o mesmo píxel: mexer no cursor muda a
     quantidade de grão, não o desenho dele. */
  /* Math.imul e não `*`: a multiplicação normal passa por double e perde os
     bits baixos acima de 2^53, o que enviesa a distribuição — o grão saía com
     média negativa e escurecia a imagem em vez de só a texturar. */
  function grainAt(x, y, size) {
    const gx = size > 1 ? (x / size) | 0 : x, gy = size > 1 ? (y / size) | 0 : y;
    let n = Math.imul(gx, 374761393) + Math.imul(gy, 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (((n ^ (n >>> 16)) >>> 0) / 4294967295) - 0.5;   // -0.5 .. 0.5
  }

  /* Máscara de altas luzes desfocada — a base do bloom e da halação. O halo
     de filme nasce da luz a espalhar-se DENTRO da emulsão a partir das zonas
     mais claras, por isso primeiro isola-se o que é claro e só depois se
     desfoca; desfocar a imagem toda daria neblina, não halo. */
  function highlightGlow(S, w, h, thresh) {
    const m = new Uint8ClampedArray(S.length);
    const t = thresh * 255, span = 255 - t || 1;
    for (let i = 0; i < S.length; i += 4) {
      const L = LUMA(S[i], S[i + 1], S[i + 2]);
      const k = L <= t ? 0 : Math.pow((L - t) / span, 1.6);
      m[i] = S[i] * k; m[i + 1] = S[i + 1] * k; m[i + 2] = S[i + 2] * k; m[i + 3] = 255;
    }
    return boxBlur(m, w, h, Math.max(3, Math.round(Math.min(w, h) / 26)));
  }

  /* ── processamento principal ──────────────────────────────────────── */
  function process(src, dst, p) {
    const w = src.width, h = src.height;
    let S = src.data;
    const D = dst.data;
    const par = Object.assign(defaults(), p || {});

    /* Geometria primeiro: o arrasto e o desfoque acontecem na ótica, antes
       de qualquer decisão de revelação. Feito depois, a nitidez e o grão
       seriam aplicados a uma imagem que ainda ia ser borrada — e o grão de
       ISO alto ficaria borrado com ela, que é o contrário do que se vê. */
    if (par.motion > 0) S = motionBlur(S, w, h, par.motion, par.motionAngle);
    if (par.defocus > 0) S = defocusBlur(S, w, h, par);

    // Pré-cálculos que dependem da imagem inteira
    const needBlur = par.clarity || par.dehaze || par.sharpen || par.texture || par.denoise;
    const blurBig = (par.clarity || par.dehaze) ? boxBlur(S, w, h, Math.max(4, Math.round(Math.min(w, h) / 40))) : null;
    const blurSmall = (par.sharpen || par.texture) ? boxBlur(S, w, h, 1) : null;
    const blurDen = par.denoise ? boxBlur(S, w, h, 2) : null;

    const expK = Math.pow(2, par.exposure);
    const conK = 1 + par.contrast / 100;
    const satK = 1 + par.saturation / 100;
    const vibK = par.vibrance / 100;
    const tempK = par.temp / 100, tintK = par.tint / 100;
    const hiK = par.highlights / 100, shK = par.shadows / 100;
    const whK = par.whites / 100, blK = par.blacks / 100;
    const clK = par.clarity / 100, txK = par.texture / 100;
    const dhK = par.dehaze / 100, shpK = par.sharpen / 100;
    const dnK = par.denoise / 100, nzK = par.noise / 100;
    const hsl = par.hsl, curve = par.curve;
    const ss = par.splitShadow, sh2 = par.splitHigh;

    // primitivas de look
    const fadeK = par.fade / 100, grK = par.grain / 100, grSz = Math.max(1, par.grainSize | 0);
    const blK2 = par.bloom / 100, haK = par.halation / 100, vgK = par.vignette / 100;
    const glow = (blK2 || haK) ? highlightGlow(S, w, h, 0.62) : null;
    // raio da vinheta em coordenadas normalizadas (1 = canto)
    const cx = w / 2, cy = h / 2, maxD = Math.hypot(cx, cy) || 1;

    for (let i = 0; i < S.length; i += 4) {
      let r = S[i], g = S[i + 1], b = S[i + 2];

      // 1. redução de ruído (mistura com versão desfocada, guardando bordas)
      if (dnK) {
        const br = blurDen[i], bg = blurDen[i + 1], bb = blurDen[i + 2];
        const edge = Math.min(1, (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb)) / 90);
        const k = dnK * (1 - edge * 0.75);
        r += (br - r) * k; g += (bg - g) * k; b += (bb - b) * k;
      }

      // 2. balanço de brancos
      if (tempK) { r *= 1 + tempK * 0.35; b *= 1 - tempK * 0.35; }
      if (tintK) { g *= 1 - tintK * 0.28; r *= 1 + tintK * 0.10; b *= 1 + tintK * 0.10; }

      // 3. exposição
      if (expK !== 1) { r *= expK; g *= expK; b *= expK; }

      // 4. realces / sombras / brancos / pretos (pesados por luminância)
      if (hiK || shK || whK || blK) {
        const L = LUMA(r, g, b) / 255;
        let mul = 1, add = 0;
        if (hiK) { const wgt = Math.max(0, (L - 0.45) / 0.55); add += hiK * wgt * 70; }
        if (shK) { const wgt = Math.max(0, (0.55 - L) / 0.55); add += shK * wgt * 70; }
        if (whK) { const wgt = Math.pow(Math.max(0, (L - 0.6) / 0.4), 0.7); add += whK * wgt * 60; }
        if (blK) { const wgt = Math.pow(Math.max(0, (0.4 - L) / 0.4), 0.7); add += blK * wgt * 60; }
        r += add; g += add; b += add;
        r *= mul; g *= mul; b *= mul;
      }

      // 5. contraste (em torno do cinzento médio)
      if (conK !== 1) {
        r = (r - 128) * conK + 128; g = (g - 128) * conK + 128; b = (b - 128) * conK + 128;
      }

      // 6. contraste local: clarity (raio grande), texture (raio pequeno), dehaze
      if (clK && blurBig) {
        r += (r - blurBig[i]) * clK * 1.4;
        g += (g - blurBig[i + 1]) * clK * 1.4;
        b += (b - blurBig[i + 2]) * clK * 1.4;
      }
      if (txK && blurSmall) {
        r += (r - blurSmall[i]) * txK * 1.8;
        g += (g - blurSmall[i + 1]) * txK * 1.8;
        b += (b - blurSmall[i + 2]) * txK * 1.8;
      }
      if (dhK && blurBig) {
        // neblina = componente de baixa frequência e baixo contraste: puxa o
        // ponto preto e reforça o contraste local ao mesmo tempo.
        r += (r - blurBig[i]) * dhK * 1.1 - dhK * 26;
        g += (g - blurBig[i + 1]) * dhK * 1.1 - dhK * 24;
        b += (b - blurBig[i + 2]) * dhK * 1.1 - dhK * 18;
      }

      // 7. nitidez (máscara de contraste de raio 1)
      if (shpK && blurSmall) {
        r += (r - blurSmall[i]) * shpK * 2.2;
        g += (g - blurSmall[i + 1]) * shpK * 2.2;
        b += (b - blurSmall[i + 2]) * shpK * 2.2;
      }

      // 8. curva de tons
      if (curve) { r = curve[clamp255(r) | 0]; g = curve[clamp255(g) | 0]; b = curve[clamp255(b) | 0]; }

      // 9. saturação e vibrância
      if (satK !== 1 || vibK) {
        const L = LUMA(r, g, b);
        let k = satK;
        if (vibK) {
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          const cur = mx === 0 ? 0 : (mx - mn) / mx;      // saturação atual
          k += vibK * (1 - cur) * 1.5;                     // poupa o que já é saturado
        }
        r = L + (r - L) * k; g = L + (g - L) * k; b = L + (b - L) * k;
      }

      // 10. HSL por banda
      if (hsl) {
        const [H, Sx, Lx] = rgb2hsl(clamp255(r), clamp255(g), clamp255(b));
        if (Sx > 0.04) {
          let dH = 0, kS = 1, dL = 0, tot = 0;
          for (const bd of BANDS) {
            const wgt = bandWeight(H, bd.c);
            if (!wgt) continue;
            tot += wgt;
            dH += (hsl[bd.id + 'Hue'] || 0) * wgt;
            kS += ((hsl[bd.id + 'Sat'] || 0) / 100) * wgt;
            dL += ((hsl[bd.id + 'Lum'] || 0) / 100) * wgt;
          }
          if (tot) {
            let nh = (H + dH) % 360; if (nh < 0) nh += 360;
            const ns = clamp(Sx * kS, 0, 1);
            const nl = clamp(Lx + dL * 0.35, 0, 1);
            const c = hsl2rgb(nh, ns, nl);
            r = c[0]; g = c[1]; b = c[2];
          }
        }
      }

      // 11. color grading (tonalidade separada em sombras e altas luzes)
      if (ss || sh2) {
        const L = LUMA(r, g, b) / 255;
        if (ss) { const wgt = Math.max(0, 1 - L * 1.8); r += ss[0] * wgt * 45; g += ss[1] * wgt * 45; b += ss[2] * wgt * 45; }
        if (sh2) { const wgt = Math.max(0, (L - 0.45) / 0.55); r += sh2[0] * wgt * 45; g += sh2[1] * wgt * 45; b += sh2[2] * wgt * 45; }
      }

      // 12. ruído sintético (para demonstrar ISO alto)
      if (nzK) {
        const n = (Math.random() - 0.5) * nzK * 110;
        const nc = (Math.random() - 0.5) * nzK * 55;   // ruído de cor
        r += n + nc; g += n; b += n - nc;
      }

      /* ── camada de LOOK ───────────────────────────────────────────────
         Vem no fim de propósito: um estilo aplica-se a uma imagem já
         revelada. É também a ordem em que a Edição o ensina. */

      // 13. halo das altas luzes: bloom (neutro) e halação (tingida)
      if (glow) {
        const gr = glow[i], gg = glow[i + 1], gb = glow[i + 2];
        if (blK2) { r += gr * blK2 * 0.55; g += gg * blK2 * 0.55; b += gb * blK2 * 0.55; }
        // halação: a camada vermelha do filme é a que mais espalha, por isso
        // o halo é quente — é esse desequilíbrio que o torna reconhecível.
        if (haK) { const L = (gr + gg + gb) / 3; r += L * haK * 0.85; g += L * haK * 0.30; b += L * haK * 0.12; }
      }

      // 14. pretos levantados (matte / film): o preto deixa de ser preto
      if (fadeK) { const lift = fadeK * 46; r = lift + r * (1 - lift / 255); g = lift + g * (1 - lift / 255); b = lift + b * (1 - lift / 255); }

      // 15. vinheta: escurece (ou clareia) os cantos para prender o olhar
      if (vgK) {
        const px = (i >> 2) % w, py = (i >> 2) / w | 0;
        const d = Math.hypot(px - cx, py - cy) / maxD;
        const k = 1 - vgK * Math.pow(Math.max(0, (d - 0.35) / 0.65), 1.8) * 0.85;
        r *= k; g *= k; b *= k;
      }

      // 16. grão: máximo nos meios-tons, quase ausente nos pretos e brancos
      //     — é assim no filme e é o que impede o grão de sujar as luzes.
      if (grK) {
        const px = (i >> 2) % w, py = (i >> 2) / w | 0;
        const L = LUMA(r, g, b) / 255;
        const wgt = 1 - Math.abs(L - 0.5) * 1.55;
        if (wgt > 0) { const n = grainAt(px, py, grSz) * grK * 78 * wgt; r += n; g += n; b += n; }
      }

      D[i] = clamp255(r); D[i + 1] = clamp255(g); D[i + 2] = clamp255(b); D[i + 3] = S[i + 3];
    }
    return dst;
  }

  /* ── histograma ───────────────────────────────────────────────────
     A distribuição tonal é a melhor forma de VER o que um ajuste faz: a
     exposição desloca o monte, o contraste alarga-o, os realces comprimem
     a ponta direita. Amostra de 4 em 4 píxeis (chega para a forma). */
  function histogram(img) {
    const r = new Uint32Array(256), g = new Uint32Array(256), b = new Uint32Array(256), l = new Uint32Array(256);
    const D = img.data;
    for (let i = 0; i < D.length; i += 16) {
      r[D[i]]++; g[D[i + 1]]++; b[D[i + 2]]++;
      l[Math.min(255, LUMA(D[i], D[i + 1], D[i + 2]) | 0)]++;
    }
    let mx = 0;
    for (let i = 1; i < 255; i++) { if (l[i] > mx) mx = l[i]; if (r[i] > mx) mx = r[i]; if (g[i] > mx) mx = g[i]; if (b[i] > mx) mx = b[i]; }
    // recorte: fração de píxeis encostados às pontas (avisos de estouro)
    const total = l.reduce((a, v) => a + v, 0) || 1;
    return { r, g, b, l, max: mx || 1, clipLow: (l[0] + l[1]) / total, clipHigh: (l[254] + l[255]) / total };
  }

  /* Desenha o histograma num canvas. `ref` (opcional) desenha o original
     por baixo, a tracejado, para se ver o antes e o depois ao mesmo tempo. */
  function drawHistogram(cv, h, ref) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const path = (arr, max) => {
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * W, H - Math.min(1, arr[i] / max) * (H - 2));
      ctx.lineTo(W, H); ctx.closePath();
    };
    if (ref) {                      // silhueta do original
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      path(ref.l, ref.max); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    [['r', 'rgba(239,68,68,.55)'], ['g', 'rgba(34,197,94,.55)'], ['b', 'rgba(59,130,246,.55)']].forEach(([k, col]) => {
      ctx.fillStyle = col; path(h[k], h.max); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * W, y = H - Math.min(1, h.l[i] / h.max) * (H - 2);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    // marcas de recorte nas pontas
    if (h.clipHigh > 0.002) { ctx.fillStyle = 'rgba(248,113,113,.9)'; ctx.fillRect(W - 3, 0, 3, H); }
    if (h.clipLow > 0.002) { ctx.fillStyle = 'rgba(96,165,250,.9)'; ctx.fillRect(0, 0, 3, H); }
  }

  return { process, curveLUT, defaults, BANDS, boxBlur, histogram, drawHistogram };
})();
