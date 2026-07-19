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

  /* ── processamento principal ──────────────────────────────────────── */
  function process(src, dst, p) {
    const w = src.width, h = src.height;
    const S = src.data, D = dst.data;
    const par = Object.assign(defaults(), p || {});

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

      D[i] = clamp255(r); D[i + 1] = clamp255(g); D[i + 2] = clamp255(b); D[i + 3] = S[i + 3];
    }
    return dst;
  }

  return { process, curveLUT, defaults, BANDS, boxBlur };
})();
