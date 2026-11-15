/* ══════════════════════════════════════════════════════════════════
   PhSim — o modelo físico da câmara do laboratório.

   Parte de uma fotografia JÁ TIRADA, com as definições reais (EXIF), e
   responde a "e se eu tivesse disparado de outra maneira?". Não inventa
   efeitos: cada consequência sai de uma conta que se pode verificar.

     exposição   ΔEV = log2(t/t0) − 2·log2(N/N0) + log2(ISO/ISO0) − ND
     prof. campo círculo de desfoque  c = f²/N · |d − s| / (d·(s − f))
                 (f focal real, s distância focada, d distância do ponto)
     tremido     sem tripé, o arrasto cresce com t · focal equivalente
                 (a regra 1/focal é onde ele começa a ver-se)
     movimento   uma zona declarada da cena percorre v·t do enquadramento
     ruído       cresce com √ISO e com o tamanho do sensor

   A profundidade de cada píxel vem de um modelo DECLARADO por cena (não há
   mapa de profundidade numa fotografia): chão plano até ao horizonte,
   objetos a uma distância, ou um recorte do sujeito à frente de um fundo.

   Corre na página (leituras: fotómetro, régua de DOF, avisos) e no Worker
   (píxeis), por isso não toca no DOM. Carregado com <script> e com
   importScripts().
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ── escalas em terços de stop ── */
  const APERTURES = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
  const SHUTTERS = [1 / 8000, 1 / 6400, 1 / 5000, 1 / 4000, 1 / 3200, 1 / 2500, 1 / 2000, 1 / 1600, 1 / 1250, 1 / 1000, 1 / 800, 1 / 640, 1 / 500,
    1 / 400, 1 / 320, 1 / 250, 1 / 200, 1 / 160, 1 / 125, 1 / 100, 1 / 80, 1 / 60, 1 / 50, 1 / 40, 1 / 30, 1 / 25, 1 / 20, 1 / 15, 1 / 13, 1 / 10,
    1 / 8, 1 / 6, 1 / 5, 1 / 4, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.3, 1.6, 2, 2.5, 3.2, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30, 60, 120, 240];
  const ISOS = [50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400,
    8000, 10000, 12800, 16000, 20000, 25600];
  const ND_STOPS = [0, 3, 6, 10, 15];

  /* ── sensores: crop, círculo de confusão (mm) e ruído relativo ── */
  const SENSORS = {
    phone: { name: 'Telemóvel', crop: 6, coc: 0.005, noise: 11, is: 3 },
    mft:   { name: 'Micro 4/3', crop: 2, coc: 0.015, noise: 5, is: 4 },
    apsc:  { name: 'APS-C', crop: 1.6, coc: 0.019, noise: 4, is: 0 },
    ff:    { name: 'Full Frame', crop: 1, coc: 0.03, noise: 2.6, is: 4 },
  };

  const log2 = Math.log2;
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const nearest = (list, v) => list.reduce((b, x) => Math.abs(log2(x / v)) < Math.abs(log2(b / v)) ? x : b, list[0]);
  const idx = (list, v) => list.indexOf(nearest(list, v));

  function fmtShutter(t) {
    if (!(t > 0)) return '—';
    if (t >= 60) return (t / 60) + ' min';
    if (t >= 1) return (Math.round(t * 10) / 10).toString().replace('.', ',') + ' s';
    if (t >= 0.3) return (Math.round(t * 10) / 10).toString().replace('.', ',') + ' s';
    /* o EXIF traz tempos "crus" (1/355, 1/2776): mostra-se o valor da escala
       quando está a menos de um sexto de stop, como a câmara faria */
    const n = nearest(SHUTTERS, t);
    return '1/' + Math.round(1 / (Math.abs(log2(n / t)) < 0.17 ? n : t));
  }
  const fmtAperture = N => 'f/' + (N >= 10 ? Math.round(N) : (Math.round(N * 10) / 10).toString().replace('.', ','));
  function fmtDist(m) {
    if (!isFinite(m) || m > 5000) return '∞';
    if (m < 1) return Math.round(m * 100) + ' cm';
    if (m < 10) return (Math.round(m * 10) / 10).toString().replace('.', ',') + ' m';
    return Math.round(m) + ' m';
  }
  const fmtEV = ev => (ev > 0.04 ? '+' : ev < -0.04 ? '−' : '±') + Math.abs(Math.round(ev * 10) / 10).toFixed(1).replace('.', ',') + ' EV';

  /* EV100 da exposição: quanta luz a cena tinha, pelo que o autor escolheu. */
  const ev100 = (N, t, iso) => log2(N * N / t) - log2(iso / 100);

  /* Estado inicial de uma cena: exatamente como foi tirada. */
  function shotOf(scene) {
    return {
      N: scene.f, t: scene.t, iso: scene.iso, nd: 0, tripod: !!scene.tripod,
      focus: scene.focus || 20, sensor: scene.cls || 'apsc', mode: 'M', comp: 0, pan: false,
    };
  }

  /* A câmara com que se está a "disparar": a da cena, ou outra com o MESMO
     enquadramento (mesma focal equivalente, focal real diferente). */
  function camera(scene, st) {
    const own = st.sensor === (scene.cls || 'apsc');
    const s = SENSORS[st.sensor] || SENSORS.apsc;
    const crop = own && scene.crop ? scene.crop : s.crop;
    const coc = own && scene.crop ? 0.03 / scene.crop : s.coc;
    const f35 = scene.focal35 || 35;
    return { crop, coc, f35, f: f35 / crop, noise: s.noise, is: scene.is != null && own ? scene.is : s.is, name: own ? scene.camera : s.name };
  }

  /* Os valores gravados nas câmaras são NOMINAIS: 1/125 é na verdade 1/128,
     1/60 é 1/64, f/5,6 é f/5,657. Para a conta de stops usam-se os valores
     exatos (terços de stop), senão 1/125 → 1/60 dava +1,06 EV e não +1. */
  const stT = t => Math.round(3 * log2(t)) / 3;
  const stN = N => Math.round(6 * log2(N)) / 3;            // 2·log2(N), em terços
  const stI = iso => Math.round(3 * log2(iso / 100)) / 3;

  /* ΔEV em relação à exposição com que a fotografia foi tirada. */
  function deltaEV(scene, st) {
    return (stT(st.t) - stT(scene.t)) - (stN(st.N) - stN(scene.f)) + (stI(st.iso) - stI(scene.iso)) - (st.nd || 0);
  }

  /* Modos A e S: a câmara compensa o que o fotógrafo não escolheu, até ao
     limite da escala. Devolve o estado ajustado (ΔEV → compensação pedida). */
  function settle(scene, st) {
    const s = Object.assign({}, st);
    const want = s.comp || 0;
    if (s.mode === 'A') {
      const t = scene.t * Math.pow(2, want + 2 * log2(s.N / scene.f) - log2(s.iso / scene.iso) + (s.nd || 0));
      s.t = clamp(nearest(SHUTTERS, t), SHUTTERS[0], SHUTTERS[SHUTTERS.length - 1]);
    } else if (s.mode === 'S') {
      const N = scene.f * Math.pow(2, (log2(s.t / scene.t) + log2(s.iso / scene.iso) - (s.nd || 0) - want) / 2);
      s.N = clamp(nearest(APERTURES, N), APERTURES[0], APERTURES[APERTURES.length - 1]);
    }
    return s;
  }

  /* Profundidade de campo para a distância focada. */
  function dof(scene, st) {
    const cam = camera(scene, st);
    const f = cam.f, s = st.focus * 1000;
    const H = f * f / (st.N * cam.coc) + f;
    const near = s * (H - f) / (H + s - 2 * f);
    const far = s >= H ? Infinity : s * (H - f) / (H - s);
    return { near: near / 1000, far: far / 1000, H: H / 1000, total: (far - near) / 1000, f, coc: cam.coc };
  }

  /* Diâmetro do círculo de desfoque (mm no sensor) de um ponto a d metros. */
  function blurCircle(f, N, sM, dM) {
    const s = sM * 1000;
    if (!isFinite(dM)) return f * f / (N * (s - f));
    const d = dM * 1000;
    return Math.abs(f * f / N * (d - s) / (d * (s - f)));
  }

  /* Tremido sem tripé: fração da largura percorrida durante a exposição.
     Calibrado para ser ~1 píxel em 1100 (um círculo de confusão) quando
     t = 1/focal equivalente — é isso que a regra quer dizer com "seguro". */
  function shake(scene, st) {
    if (st.tripod) return 0;
    const cam = camera(scene, st);
    const tEff = st.t / Math.pow(2, cam.is || 0);
    return (1 / 1100) * tEff * cam.f35;
  }
  /* Velocidade mínima "segura" à mão, com a estabilização da câmara. */
  function handheldLimit(scene, st) {
    const cam = camera(scene, st);
    return Math.pow(2, cam.is || 0) / cam.f35;
  }

  /* Ruído acrescentado em relação ao da fotografia original (0..100). */
  function noise(scene, st) {
    const cam = camera(scene, st);
    const base = SENSORS[scene.cls || 'apsc'].noise * (Math.sqrt(scene.iso / 100) - 1);
    return clamp(cam.noise * (Math.sqrt(st.iso / 100) - 1) - Math.max(0, base), 0, 100);
  }

  /* Difração: o disco de Airy (2,44·λ·N, λ = 0,55 µm) passa o círculo de
     confusão — a partir daí fechar mais já não dá nitidez, tira-a. */
  function diffraction(scene, st) {
    const cam = camera(scene, st);
    const airy = 2.44 * 0.00055 * st.N;
    return { airy, soft: airy > cam.coc * 0.9, limitN: cam.coc * 0.9 / (2.44 * 0.00055) };
  }

  /* ── profundidade por píxel ─────────────────────────────────────────
     depth(x, y) em metres para coordenadas normalizadas (0..1). */
  function depthFn(scene) {
    const D = scene.depth || { type: 'far' };
    const objs = D.objects || [];
    const base = D.type === 'ground'
      ? (x, y) => {
          const hz = D.horizon + (D.tilt || 0) * (x - 0.5);
          if (y <= hz + 0.004) return D.sky == null ? Infinity : D.sky;
          return Math.max(D.near || 1, (D.near || 1) * (1 - hz) / (y - hz));
        }
      : () => (D.dist == null ? Infinity : D.dist);
    return (x, y) => {
      let d = base(x, y);
      for (const o of objs) {
        const inside = o.shape === 'ellipse'
          ? Math.pow((x - o.x) / (o.w / 2), 2) + Math.pow((y - o.y) / (o.h / 2), 2) <= 1
          : x >= o.x - o.w / 2 && x <= o.x + o.w / 2 && y >= o.y - o.h / 2 && y <= o.y + o.h / 2;
        if (inside) d = o.dist;
      }
      return d;
    };
  }

  /* ── máscaras ───────────────────────────────────────────────────────
     Peso 0..1 de uma zona (retângulo ou elipse com esbatido). `key` restringe
     a zona pela COR da própria fotografia — 'cool' fica só com o que é neutro
     ou azulado (água, espuma, céu), 'warm' só com o que é quente (rocha,
     areia). É o que impede a "seda" de alisar as rochas que estão dentro do
     retângulo do mar. `warm` = mapa de calor (R−B)/máx por píxel. */
  function regionMask(reg, w, h, warm) {
    const m = new Float32Array(w * h);
    const fe = Math.max(0.001, reg.feather == null ? 0.08 : reg.feather);
    const key = warm && reg.key ? (reg.key === 'warm' ? 1 : -1) : 0;
    const k0 = reg.keyLo == null ? 0.05 : reg.keyLo, k1 = reg.keyHi == null ? 0.2 : reg.keyHi;
    for (let y = 0, k = 0; y < h; y++) {
      const ny = (y + 0.5) / h;
      for (let x = 0; x < w; x++, k++) {
        const nx = (x + 0.5) / w;
        let t;
        if (reg.shape === 'ellipse') {
          const d = Math.hypot((nx - reg.x) / (reg.w / 2), (ny - reg.y) / (reg.h / 2));
          t = 1 - (d - 1) / (fe * 4);
        } else {
          const dx = Math.min(nx - (reg.x - reg.w / 2), (reg.x + reg.w / 2) - nx);
          const dy = Math.min(ny - (reg.y - reg.h / 2), (reg.y + reg.h / 2) - ny);
          t = Math.min(dx, dy) / fe + 0.5;
        }
        if (t <= 0) continue;
        t = t >= 1 ? 1 : t * t * (3 - 2 * t);
        if (key) {
          let c = clamp((warm[k] - k0) / (k1 - k0), 0, 1);
          c = c * c * (3 - 2 * c);
          t *= key > 0 ? c : 1 - c;
        }
        m[k] = t;
      }
    }
    return m;
  }

  /* Mapa de calor de uma imagem RGBA: (R − B) / máx, suavizado para a
     máscara não ficar aos grãos. */
  function warmMap(data, w, h) {
    const a = new Float32Array(w * h);
    for (let i = 0, k = 0; k < a.length; i += 4, k++) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      a[k] = (r - b) / Math.max(r, g, b, 24);
    }
    /* média 5×5 separável */
    const t = new Float32Array(a.length), R = 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let d = -R; d <= R; d++) { const xx = x + d; if (xx >= 0 && xx < w) { s += a[y * w + xx]; n++; } }
      t[y * w + x] = s / n;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let d = -R; d <= R; d++) { const yy = y + d; if (yy >= 0 && yy < h) { s += t[yy * w + x]; n++; } }
      a[y * w + x] = s / n;
    }
    return a;
  }

  /* O que NÃO depende das definições: a distância de base de cada píxel e o
     peso de cada objeto. Calcula-se uma vez por cena e tamanho. */
  function depthPre(scene, w, h, warm) {
    const D = scene.depth || { type: 'far' };
    const base = depthFn(Object.assign({}, scene, { depth: Object.assign({}, D, { objects: [] }) }));
    const depth = new Float32Array(w * h);
    for (let y = 0, k = 0; y < h; y++) for (let x = 0; x < w; x++, k++) depth[k] = base((x + 0.5) / w, (y + 0.5) / h);
    const objs = (D.objects || []).map(o => ({ dist: o.dist, w: regionMask(Object.assign({ feather: 0.03 }, o), w, h, warm) }));
    return { depth, objs };
  }

  /* Raio de desfoque por píxel (em píxeis da imagem w×h) + o máximo.
     `matte` (opcional, Float32 0..1) = recorte do sujeito: o que está dentro
     fica à distância do sujeito. Os objetos e o sujeito misturam-se em RAIO
     de desfoque, não em distância: é isso que dá uma orla macia em vez de um
     degrau. */
  function blurMap(scene, st, w, h, pre, matte) {
    const cam = camera(scene, st);
    const subj = scene.depth && scene.depth.subject;
    const sensorW = (w >= h ? 36 : 24) / cam.crop;          // mm ao longo da largura da imagem
    const k0 = (w / sensorW) / 2;
    const f = cam.f, N = st.N, s = st.focus;
    const rInf = blurCircle(f, N, s, Infinity) * k0;
    const objR = pre.objs.map(o => blurCircle(f, N, s, o.dist) * k0);
    const subjR = subj != null ? blurCircle(f, N, s, subj) * k0 : 0;
    const map = new Float32Array(w * h);
    let max = 0;
    for (let k = 0; k < map.length; k++) {
      const d = pre.depth[k];
      let r = d === Infinity ? rInf : blurCircle(f, N, s, d) * k0;
      for (let j = 0; j < objR.length; j++) { const a = pre.objs[j].w[k]; if (a > 0) r += (objR[j] - r) * a; }
      if (matte && subj != null) { const a = matte[k]; if (a > 0) r += (subjR - r) * a; }
      map[k] = r;
      if (r > max) max = r;
    }
    return { map, max };
  }

  /* Tudo o que o motor de píxeis precisa para um estado. As máscaras são
     pedidas a quem chama (o Worker guarda-as em cache por cena). */
  function plan(scene, st) {
    const dEV = deltaEV(scene, st);
    return {
      /* ganho em luz LINEAR: num JPEG (gama ~2,2) um stop não é ×2 no valor
         do píxel, é ×2^(1/2,2). Sem isto +1 EV queimava a imagem inteira. */
      exposure: clamp(dEV, -7, 7) / 2.2,
      noise: noise(scene, st),
      shake: shake(scene, st),
      motions: (scene.motion || []).map(m => ({ frac: m.speed * st.t - (m.baked ? m.speed * scene.t : 0), angle: m.angle || 0 })),
      dEV,
    };
  }

  const api = {
    APERTURES, SHUTTERS, ISOS, ND_STOPS, SENSORS,
    nearest, idx, fmtShutter, fmtAperture, fmtDist, fmtEV,
    ev100, shotOf, camera, deltaEV, settle, dof, blurCircle, shake, handheldLimit, noise, diffraction,
    depthFn, depthPre, warmMap, blurMap, regionMask, plan,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhSim = api;
})(typeof self !== 'undefined' ? self : this);
