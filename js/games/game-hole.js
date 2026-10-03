/* ══════════════════════════════════════════════════════════════════
   Buraco Guloso (Hole.io) — em 3D (three.js, vendorizado e carregado a
   pedido). És um buraco — ou um aspirador-robô — que engole tudo o que
   for mais pequeno e cresce com isso.

   Escolha em 3 passos: CENÁRIO (cidade, aldeia, aeroporto, praia, casa)
   → TAMANHO do mapa (6×6 … 30×30 quarteirões) → MODO (batalha, último
   de pé, contra-relógio, passeio). O id do modo é "cenário-tamanho-modo".

   Como o buraco é "de verdade": cada buraco escreve 1 no stencil; o chão
   só é pintado onde o stencil ≠ 1 (fica recortado) e o poço escuro só
   onde = 1. Os objetos engolidos tombam para dentro e descem abaixo do
   chão — fora do buraco o chão tapa-os, dentro vêem-se a cair.

   Desempenho: cada tipo de objeto é um InstancedMesh (geometria
   procedural fundida com cores por vértice + uma 2.ª malha "pintável"
   com cor por instância), um por tipo e por "pedaço" do mapa — o que
   está fora da câmara nem é desenhado, e só se animam peões e carros
   perto dela. Assim um 30×30 (~30 mil objetos) continua fluido.
   Controlo: setas/WASD; rato só com o botão premido; toque = joystick.
══════════════════════════════════════════════════════════════════ */
const HoleGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2;
  const SRC = 'js/vendor/three.min.js';
  const BUCKET = 120, RMAX = 260;
  const DIFF = { easy: { tm: 1.25, ai: .8, spd: 1.08 }, medium: { tm: 1, ai: 1, spd: 1 }, hard: { tm: .85, ai: 1.14, spd: .97 } };

  /* ── cenários ── */
  const SCEN = {
    city:    { icon: '🏙️', name: 'Cidade', art: 'a', desc: 'Arranha-céus, bairros, parques, fábricas e muito trânsito.',
               sky: '#9ed1f5', outer: '#6aa84f', road: '#4b5563', dash: '#f8fafc', side: '#cbd5e1', cross: true, zones: [], walkers: 5, furn: 'city', startR: 16, density: .75, per: 50,
               traffic: [['car', 50, 11], ['taxi', 12, 11], ['bus', 10, 20], ['truck', 10, 17], ['van', 12, 13], ['police', 6, 11]] },
    village: { icon: '🏡', name: 'Aldeia', art: 'a', desc: 'Igreja, casinhas, quintas, campos, moinhos e muitos animais.',
               sky: '#a5d8f3', outer: '#5f9e3a', road: '#9c8a6b', dash: null, side: '#b8ad8f', zones: ['field', 'pasture', 'orchard', 'forest', 'pond', 'mill'], mainRoads: true, walkers: 2, furn: 'village', startR: 14, density: .35, per: 50,
               traffic: [['tractor', 35, 12], ['car', 35, 11], ['van', 15, 13], ['bike', 15, 5]] },
    airport: { icon: '✈️', name: 'Aeroporto', art: 'o', desc: 'Pistas com aviões a rolar, terminais, hangares e bagagens.',
               sky: '#b6dcf5', outer: '#5f8f3e', road: '#57534e', dash: '#facc15', side: '#9ca3af', zones: ['runway', 'grass'], walkers: 1, furn: 'airport', startR: 16, density: .45, per: 30,
               traffic: [['bagcart', 30, 12], ['fueltruck', 12, 16], ['stairs', 12, 12], ['van', 15, 13], ['bus', 10, 20], ['car', 11, 11], ['jet', 10, 28]] },
    beach:   { icon: '🏖️', name: 'Praia', art: 'a', desc: 'Mar com barcos e iates, areal cheio de chapéus-de-sol e hotéis.',
               sky: '#8fd3ff', outer: '#6aa84f', north: '#1683c7', road: '#4b5563', dash: '#f8fafc', side: '#e7d3a8', cross: true, zones: ['sea', 'sand'], walkers: 4, furn: 'beach', startR: 14, density: .55, per: 36,
               traffic: [['car', 45, 11], ['taxi', 10, 11], ['bus', 10, 20], ['van', 15, 13], ['bike', 20, 5]] },
    house:   { icon: '🧹', name: 'Casa', art: 'a', desc: 'És um aspirador-robô numa casa com 5 divisões (tamanho fixo).', vac: true, fixed: true },
  };
  const SIZES = [6, 8, 12, 18, 24, 30];
  const SIZE_NAME = { 6: 'Pequeno', 8: 'Normal', 12: 'Grande', 18: 'Enorme', 24: 'Gigante', 30: 'Colossal' };
  const TYPES = {
    battle: { icon: '⚔️', name: 'Batalha' },
    royale: { icon: '👑', name: 'Último de pé' },
    timed:  { icon: '⏱️', name: 'Contra-relógio' },
    zen:    { icon: '🌿', name: 'Passeio' },
  };
  const RIVN = { 6: 4, 8: 6, 12: 8, 18: 10, 24: 12, 30: 14 };
  const TIME = { 6: 90, 8: 120, 12: 150, 18: 180, 24: 240, 30: 300 };
  const RIVALS = [['Gula', '#ef4444'], ['Vórtice', '#a855f7'], ['Tornado', '#f59e0b'], ['Ruído', '#06b6d4'], ['Abismo', '#ec4899'], ['Cratera', '#84cc16'], ['Sombra', '#64748b'], ['Poço', '#f97316'], ['Eclipse', '#3b82f6'],
    ['Remoinho', '#14b8a6'], ['Voragem', '#e11d48'], ['Funil', '#8b5cf6'], ['Cova', '#65a30d'], ['Fosso', '#0ea5e9'], ['Túnel', '#d946ef'], ['Glutão', '#eab308'], ['Buraco Negro', '#475569']];
  const round5 = s => Math.round(s / 5) * 5;
  /* regras de cada combinação (o que muda com o tamanho: tempo, rivais e objetivo) */
  function modeCfg(scen, size, type, diff) {
    const vac = !!SCEN[scen].vac, n = vac ? 8 : size, tm = (DIFF[diff] || DIFF.medium).tm;
    const t0 = vac ? 120 : TIME[n], base = round5(t0 * tm), rv = vac ? 3 : RIVN[n];
    return {
      battle: { rivals: rv, respawn: true, time: base },
      royale: { rivals: vac ? 5 : Math.min(RIVALS.length - 1, rv + 3), respawn: false, time: base * 2 },
      timed:  { rivals: 0, time: base, goal: vac ? 50 : Math.min(60, Math.round(50 * (t0 / 120) * 64 / (n * n))) },
      zen:    { rivals: 0, time: Infinity },
    }[type];
  }
  const modeId = (s, n, t) => `${s}-${SCEN[s] && SCEN[s].fixed ? 8 : n}-${t}`;
  /* ids antigos (antes do seletor em 3 passos) continuam a funcionar */
  const LEGACY = { city: 'city-8-battle', royale: 'city-8-royale', solo: 'city-8-timed', zen: 'city-8-zen', vacuum: 'house-8-battle', clean: 'house-8-zen' };
  function parseMode(m) {
    const [s, n, t] = String(LEGACY[m] || m || 'city-8-battle').split('-');
    return { scen: SCEN[s] ? s : 'city', size: SIZES.includes(+n) ? +n : 8, type: TYPES[t] ? t : 'battle' };
  }
  const fmtT = s => (!isFinite(s) ? 'sem relógio' : s % 60 ? (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`) : `${s / 60} min`);

  const SKINS = [
    { id: 'green', name: 'Clássico', lvl: 1, c: '#22c55e' }, { id: 'ocean', name: 'Oceano', lvl: 2, c: '#38bdf8' },
    { id: 'lava', name: 'Lava', lvl: 3, c: '#f97316' }, { id: 'violet', name: 'Violeta', lvl: 4, c: '#a855f7' },
    { id: 'gold', name: 'Ouro', lvl: 6, c: '#fbbf24' }, { id: 'rainbow', name: 'Arco-íris', lvl: 8, c: 'rainbow' },
  ];
  const store = () => (typeof GameProgress !== 'undefined' ? GameProgress.store('hole') : { getPref: (k, d) => d, setPref: () => {} });
  const levelOf = xp => 1 + Math.floor(Math.sqrt(xp / 400));
  const xpFor = lv => 400 * (lv - 1) * (lv - 1);

  let _threeP = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve();
    if (_threeP) return _threeP;
    return (_threeP = new Promise((res, rej) => {
      const ex = document.querySelector(`script[src="${SRC}"]`);
      if (ex) { if (window.THREE) return res(); ex.addEventListener('load', res); ex.addEventListener('error', rej); return; }
      const s = Object.assign(document.createElement('script'), { src: SRC });
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    }));
  }

  /* ════════════════════════════════════════════════════════════════
     MODELOS PROCEDURAIS — partes simples fundidas numa geometria.
     c = cor fixa; 'P' = parte "pintável" (cor por instância).
  ════════════════════════════════════════════════════════════════ */
  function part(g, c, x, y, z, rx, ry, rz, sx, sy, sz) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || 1, sz || 1));
    return { g, c, m };
  }
  /* caixa com a base em y0 */
  const B = (w, h, d, c, x, z, y0, ry) => part(new THREE.BoxGeometry(w, h, d), c, x, (y0 || 0) + h / 2, z, 0, ry);
  const C = (rt, rb, h, c, x, z, y0, seg, rx, rz) => part(new THREE.CylinderGeometry(rt, rb, h, seg || 12), c, x, (y0 || 0) + h / 2, z, rx, 0, rz);
  const S = (r, c, x, y, z, sx, sy, sz) => part(new THREE.SphereGeometry(r, 10, 8), c, x, y, z, 0, 0, 0, sx, sy, sz);
  const K = (r, h, c, x, z, y0, seg, ry) => part(new THREE.ConeGeometry(r, h, seg || 10), c, x, (y0 || 0) + h / 2, z, 0, ry || 0);
  /* esfera de poucos polígonos, para pormenores pequenos que existem aos milhares */
  const SL = (r, c, x, y, z, sx, sy, sz) => part(new THREE.SphereGeometry(r, 6, 4), c, x, y, z, 0, 0, 0, sx, sy, sz);
  const WHEEL = (x, z, r) => part(new THREE.CylinderGeometry(r, r, 1.4, 12), '#111827', x, r, z, Math.PI / 2);
  /* cilindro deitado ao longo de x (r1 do lado −x, r2 do lado +x); y = centro */
  const CX = (r1, r2, len, c, x, y, z, seg) => part(new THREE.CylinderGeometry(r1, r2, len, seg || 12), c, x, y, z, 0, 0, Math.PI / 2);
  /* telhado de duas águas: prisma triangular com a base em y0, cumeeira ao longo de z (ou de x) */
  function GABLE(len, w, h, c, x, z, y0, alongX) {
    let g = new THREE.CylinderGeometry(1, 1, len, 3);
    g.rotateX(-Math.PI / 2); g.scale(w / 1.732, h / 1.5, 1); g.translate(0, h / 3, 0);
    if (alongX) g.rotateY(Math.PI / 2);
    g = g.toNonIndexed(); g.computeVertexNormals();
    return part(g, c, x, y0 || 0, z);
  }
  /* meia-cana (hangar): arco para cima, ao longo de z (ou de x) */
  function ARCH(len, r, c, x, z, y0, alongX) {
    const g = new THREE.CylinderGeometry(r, r, len, 16, 1, false, -Math.PI / 2, Math.PI);
    g.rotateX(-Math.PI / 2); if (alongX) g.rotateY(Math.PI / 2);
    return part(g, c, x, y0 || 0, z);
  }

  function merge(parts) {
    const out = { base: null, paint: null };
    ['base', 'paint'].forEach(kind => {
      const list = parts.filter(p => (kind === 'paint') === (p.c === 'P'));
      if (!list.length) return;
      let n = 0;
      const gs = list.map(p => { const g = (p.g.index ? p.g.toNonIndexed() : p.g.clone()); g.applyMatrix4(p.m); n += g.attributes.position.count; return [g, p.c]; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), tmp = new THREE.Color();
      let o = 0;
      gs.forEach(([g, c]) => {
        const cnt = g.attributes.position.count;
        pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
        tmp.set(c === 'P' ? '#ffffff' : c);
        for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = tmp.r; col[(o + i) * 3 + 1] = tmp.g; col[(o + i) * 3 + 2] = tmp.b; }
        o += cnt; g.dispose();
      });
      list.forEach(p => p.g.dispose());
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      out[kind] = geo;
    });
    return out;
  }

  /* r0 = raio de ocupação de referência (o que conta para "caber");
     cada instância escala por r/r0 (e sy na altura, p/ prédios). */
  const TPL = {
    /* ── cidade: miúdos ── */
    person: { r0: 3.5, b: () => [B(2.4, 4, 1.4, '#1f2937', 0, 0, 0), B(3, 4.2, 2, 'P', 0, 0, 4), B(.8, 3.6, .8, 'P', 1.9, 0, 4.4), B(.8, 3.6, .8, 'P', -1.9, 0, 4.4), S(1.45, '#f1c27d', 0, 9.8, 0), S(1.5, '#3f2a1a', 0, 10.6, -.2, 1, .6, 1)] },
    dog: { r0: 3, b: () => [B(5, 2.4, 2, 'P', 0, 0, 1.8), B(2.2, 2, 1.8, 'P', 2.9, 0, 2.8), B(1, .8, 1, '#111827', 3.9, 0, 3.2), ...[[1.8, .7], [1.8, -.7], [-1.8, .7], [-1.8, -.7]].map(([x, z]) => B(.6, 1.8, .6, '#3f2a1a', x, z, 0)), B(.5, .5, 2, 'P', -2.8, 0, 3.6, .4)] },
    cone: { r0: 2.5, b: () => [B(4.2, .5, 4.2, '#ea580c', 0, 0, 0), K(1.8, 5.5, '#f97316', 0, 0, .5), C(1.05, 1.25, 1, '#f8fafc', 0, 0, 2.3)] },
    hydrant: { r0: 2.5, b: () => [C(1.3, 1.5, 4.2, '#dc2626', 0, 0, 0), S(1.3, '#dc2626', 0, 4.3, 0), C(.5, .5, 3.4, '#b91c1c', 0, 0, 2.5, 8, 0, Math.PI / 2)] },
    bollard: { r0: 1.8, b: () => [C(.9, 1, 4, '#374151', 0, 0, 0), C(.95, .95, .6, '#facc15', 0, 0, 3)] },
    bin: { r0: 3, b: () => [C(2.2, 1.9, 5, '#15803d', 0, 0, 0), C(2.4, 2.4, .6, '#14532d', 0, 0, 5)] },
    mailbox: { r0: 3, b: () => [B(.8, 3.5, .8, '#374151', 0, 0, 0), B(3.2, 3, 2.4, '#dc2626', 0, 0, 3.5), C(1.2, 1.2, 3.2, '#dc2626', 0, 0, 5.2, 10, 0, Math.PI / 2)] },
    lamp: { r0: 2.5, b: () => [C(.6, .9, 28, '#334155', 0, 0, 0), B(7, .7, .7, '#334155', 3.2, 0, 27.4), B(3, 1.2, 2, '#fef3c7', 6, 0, 26.2), C(1.3, 1.5, 1.5, '#475569', 0, 0, 0)] },
    traffic: { r0: 2.5, b: () => [C(.6, .7, 20, '#1f2937', 0, 0, 0), B(2.6, 7, 2.6, '#111827', 0, 1.4, 19), S(.8, '#ef4444', 0, 24.2, 2.7), S(.8, '#facc15', 0, 22.3, 2.7), S(.8, '#22c55e', 0, 20.4, 2.7)] },
    bench: { r0: 6, b: () => [B(11, 1, 3.6, '#a16207', 0, 0, 2.6), B(11, 3.2, .8, '#a16207', 0, -1.6, 3.6), B(.8, 2.6, 3.2, '#1f2937', -4.6, 0, 0), B(.8, 2.6, 3.2, '#1f2937', 4.6, 0, 0)] },
    bike: { r0: 5, b: () => [part(new THREE.TorusGeometry(2, .35, 6, 14), '#111827', -3, 2.2, 0), part(new THREE.TorusGeometry(2, .35, 6, 14), '#111827', 3, 2.2, 0), B(6, .6, .6, 'P', 0, 0, 3.8), B(.6, 3, .6, 'P', -.6, 0, 2.2, 0), B(2, .5, 1.2, '#111827', -1, 0, 5.2), B(.5, 1.6, 2.4, '#374151', 2.8, 0, 4.4)] },
    bush: { r0: 6, b: () => [S(5, 'P', 0, 3.6, 0, 1, .8, 1), S(3.4, 'P', 2.4, 4.6, 1, 1, .9, 1), S(3, 'P', -2.2, 4.2, -1.2)] },
    flower: { r0: 7, b: () => [B(12, 2.6, 6, '#78350f', 0, 0, 0), B(11, .4, 5, '#3f6212', 0, 0, 2.6), ...[-4, -2, 0, 2, 4].map((x, i) => S(1.1, ['#ef4444', '#facc15', '#f472b6', '#a855f7', '#fb923c'][i], x, 4, (i % 2 ? 1 : -1)))] },
    treeR: { r0: 11, b: () => [C(1.3, 2, 13, '#78350f', 0, 0, 0), S(9, 'P', 0, 18, 0), S(6.5, 'P', 3.5, 22, 2), S(6, 'P', -3.8, 21, -1.5)] },
    pine: { r0: 9, b: () => [C(1.1, 1.6, 8, '#78350f', 0, 0, 0), K(8, 14, 'P', 0, 0, 6), K(6.2, 11, 'P', 0, 0, 14), K(4.2, 9, 'P', 0, 0, 22)] },
    fence: { r0: 8, b: () => [...[-7, 0, 7].map(x => B(.9, 5, .9, '#f8fafc', x, 0, 0)), B(16, .8, .6, '#f8fafc', 0, 0, 3.8), B(16, .8, .6, '#f8fafc', 0, 0, 1.8)] },
    parasol: { r0: 8, b: () => [C(3.5, 3.5, .6, '#f8fafc', 0, 0, 5), C(.5, .5, 5, '#374151', 0, 0, 0), C(.3, .3, 10, '#374151', 0, 0, 5), K(8, 3, 'P', 0, 0, 13.5, 8)] },
    cart: { r0: 9, b: () => [B(14, 7, 7, 'P', 0, 0, 3), B(15, .8, 8, '#f8fafc', 0, 0, 10), WHEEL(-4.5, 3.6, 2.4), WHEEL(4.5, 3.6, 2.4), C(.3, .3, 9, '#374151', 5, 0, 10), K(7, 3, '#fde047', 5, 0, 17, 8)] },
    busStop: { r0: 11, b: () => [B(20, 1, 7, '#1e293b', 0, 0, 12), B(20, 10, .5, '#93c5fd', 0, -3, 2), B(.8, 12, .8, '#475569', -9.5, -3, 0), B(.8, 12, .8, '#475569', 9.5, -3, 0), B(14, 1, 3, '#64748b', 0, -1.5, 3), B(1, 9, 5, '#2563eb', 10.5, 0, 2)] },
    car: { r0: 11, b: () => [WHEEL(-6.5, 5, 2.4), WHEEL(6.5, 5, 2.4), WHEEL(-6.5, -5, 2.4), WHEEL(6.5, -5, 2.4), B(21, 5, 10, 'P', 0, 0, 2), B(11, 4, 9.4, 'P', -1, 0, 7), B(11.3, 2.4, 9.6, '#1e3a5f', -1, 0, 7.8), B(.6, 1.4, 2.4, '#fef3c7', 10.5, 3.2, 4.2), B(.6, 1.4, 2.4, '#fef3c7', 10.5, -3.2, 4.2), B(.6, 1.2, 2.2, '#dc2626', -10.5, 3.2, 4.4), B(.6, 1.2, 2.2, '#dc2626', -10.5, -3.2, 4.4)] },
    taxi: { r0: 11, b: () => [...TPL.car.b().map(p => (p.c === 'P' ? Object.assign(p, { c: '#facc15' }) : p)), B(4, 1.6, 2, '#111827', -1, 0, 11), B(3.6, 1.2, 1.6, '#fef9c3', -1, 0, 11.2)] },
    police: { r0: 11, b: () => [...TPL.car.b().map(p => (p.c === 'P' ? Object.assign(p, { c: '#f8fafc' }) : p)), B(21.2, 1.6, 10.2, '#1e3a8a', 0, 0, 3.5), B(2, 1.4, 3, '#ef4444', -1, 2, 11), B(2, 1.4, 3, '#3b82f6', -1, -2, 11)] },
    van: { r0: 13, b: () => [WHEEL(-7.5, 5.4, 2.6), WHEEL(7.5, 5.4, 2.6), WHEEL(-7.5, -5.4, 2.6), WHEEL(7.5, -5.4, 2.6), B(24, 10, 11, 'P', 0, 0, 2), B(1, 4, 9, '#1e3a5f', 12, 0, 7), B(.6, 1.6, 2.4, '#fef3c7', 12.2, 3.6, 3.6)] },
    truck: { r0: 17, b: () => [...[-11, -4, 10].flatMap(x => [WHEEL(x, 5.6, 2.8), WHEEL(x, -5.6, 2.8)]), B(8, 11, 11.4, 'P', 11, 0, 2), B(1, 4, 9, '#1e3a5f', 15.1, 0, 8), B(26, 13, 11.4, '#e5e7eb', -5, 0, 3), B(26.2, 2, 11.6, 'P', -5, 0, 9)] },
    bus: { r0: 20, b: () => [...[-13, 13].flatMap(x => [WHEEL(x, 6, 3), WHEEL(x, -6, 3)]), B(42, 12, 12.4, 'P', 0, 0, 2.2), B(40, 4, 12.6, '#0f172a', 0, 0, 8.2), B(1, 6, 10, '#0f172a', 21.1, 0, 6), B(42.2, 1, 12.6, '#f8fafc', 0, 0, 13.4)] },
    kiosk: { r0: 11, b: () => [B(16, 11, 12, '#f5f5f4', 0, 0, 0), B(14, 5, .6, '#1e293b', 0, 6.4, 4), B(19, 1.5, 15, 'P', 0, 0, 11), B(18, 3, .6, 'P', 0, 7.4, 8)] },
    fountain: { r0: 26, b: () => [C(24, 25, 4, '#94a3b8', 0, 0, 0, 24), C(21.5, 21.5, 3.6, '#38bdf8', 0, 0, .8, 24), C(3, 4, 12, '#cbd5e1', 0, 0, 0), C(8, 5, 2, '#cbd5e1', 0, 0, 12, 16), C(6.5, 6.5, 1.8, '#7dd3fc', 0, 0, 12.4, 16), S(2.4, '#e0f2fe', 0, 17, 0, 1, 1.6, 1)] },
    statue: { r0: 14, b: () => [B(16, 8, 16, '#9ca3af', 0, 0, 0), B(18, 1.4, 18, '#6b7280', 0, 0, 0), C(2.6, 3.4, 12, '#a16207', 0, 0, 8), S(2.6, '#a16207', 0, 22.6, 0), B(1.6, 9, 1.6, '#a16207', 3.4, 0, 16, -.5)] },
    slide: { r0: 16, b: () => [B(8, 12, 8, 'P', -8, 0, 0), B(9, 1, 9, '#f8fafc', -8, 0, 12), part(new THREE.BoxGeometry(22, 1.4, 6), '#facc15', 5, 6.8, 0, 0, 0, -.52), B(1.2, 13, 7, '#94a3b8', -12.6, 0, 0)] },
    billboard: { r0: 16, b: () => [B(1.4, 22, 1.4, '#475569', -8, 0, 0), B(1.4, 22, 1.4, '#475569', 8, 0, 0), B(30, 14, 1.6, 'P', 0, 0, 22), B(31, 15, 1, '#1f2937', 0, -.9, 21.5)] },
    goal: { r0: 10, b: () => [B(.8, 8, .8, '#f8fafc', 0, -9, 0), B(.8, 8, .8, '#f8fafc', 0, 9, 0), B(.8, .8, 18.8, '#f8fafc', 0, 0, 8), B(5, .4, 18, '#e2e8f0', -2.6, 0, 7.8)] },
    bleacher: { r0: 26, b: () => [0, 1, 2, 3].map(i => B(46, (i + 1) * 3.5, 6, i % 2 ? '#94a3b8' : '#cbd5e1', 0, -9 + i * 6, 0)) },
    container: { r0: 16, b: () => [B(30, 12, 12, 'P', 0, 0, 0), ...[-12, -6, 0, 6, 12].map(x => B(.6, 12.2, 12.3, '#1f2937', x, 0, 0))] },
    /* ── cidade: grandes ── */
    houseA: { r0: 30, b: () => house('#b91c1c') }, houseB: { r0: 30, b: () => house('#374151') }, houseC: { r0: 30, b: () => house('#92400e') },
    shop: { r0: 28, b: () => [B(46, 20, 34, 'P', 0, 0, 0), B(42, 9, .6, '#0f172a', 0, 17.2, 2), B(46, .8, 8, '#ef4444', 0, 20, 13.5), part(new THREE.BoxGeometry(46, .6, 9), '#f8fafc', 0, 12.5, 20, .35), B(18, 4, .8, '#fde047', 0, 17.5, 15), B(46.4, 1.2, 34.4, '#e2e8f0', 0, 0, 20)] },
    apart: { r0: 40, b: () => [B(54, 66, 50, 'P', 0, 0, 0), ...[0, 1, 2, 3, 4, 5].map(i => B(55, 3.4, 51, '#1e293b', 0, 0, 8 + i * 10)), B(56, 2, 52, '#e2e8f0', 0, 0, 66), B(10, 6, 10, '#94a3b8', 12, 8, 68), B(12, 10, 1, '#0f172a', 0, 25.4, 0)] },
    office: { r0: 48, b: () => [B(64, 100, 64, 'P', 0, 0, 0), ...Array.from({ length: 9 }, (_, i) => B(64.8, 1.3, 64.8, '#e2e8f0', 0, 0, 10 + i * 10)), B(66, 3, 66, '#cbd5e1', 0, 0, 100), B(14, 8, 12, '#94a3b8', -12, 10, 103), C(1, 1, 18, '#64748b', 14, -14, 103, 6)] },
    tower: { r0: 60, b: () => [B(84, 20, 84, '#94a3b8', 0, 0, 0), B(64, 170, 64, 'P', 0, 0, 20), ...Array.from({ length: 12 }, (_, i) => B(64.8, 1.4, 64.8, '#f1f5f9', 0, 0, 32 + i * 13.5)), B(48, 20, 48, 'P', 0, 0, 190), B(50, 2, 50, '#e2e8f0', 0, 0, 210), C(1, 1.4, 40, '#e5e7eb', 0, 0, 212, 6), S(1.6, '#ef4444', 0, 253, 0)] },
    waterTower: { r0: 20, b: () => [...[[7, 7], [-7, 7], [7, -7], [-7, -7]].map(([x, z]) => B(1.4, 34, 1.4, '#78350f', x, z, 0)), C(12, 12, 16, 'P', 0, 0, 34, 16), K(13, 8, '#57534e', 0, 0, 50, 16)] },
    gas: { r0: 36, b: () => [B(62, 3, 42, '#ef4444', 0, 0, 18), B(62.4, 1, 42.4, '#f8fafc', 0, 0, 17.4), ...[[-24, 14], [24, 14], [-24, -14], [24, -14]].map(([x, z]) => B(2, 18, 2, '#e5e7eb', x, z, 0)), ...[-10, 10].map(x => B(4, 8, 6, '#1f2937', x, 0, 0)), B(20, 13, 14, '#f8fafc', 0, -30, 0), B(20.4, 3, 14.4, '#ef4444', 0, -30, 13)] },
    factory: { r0: 55, b: () => [B(90, 30, 70, '#a8a29e', 0, 0, 0), ...[-30, -10, 10, 30].map(x => part(new THREE.BoxGeometry(18, 12, 70), '#78716c', x, 34, 0, 0, 0, .5)), C(5, 6.5, 62, '#7f1d1d', 36, 26, 0, 12), C(5.4, 5.4, 3, '#f8fafc', 36, 26, 50, 12), C(10, 10, 24, '#e7e5e4', -34, 30, 0, 16), B(20, 14, .6, '#0f172a', -20, 35.3, 0)] },
    crane: { r0: 30, b: () => [B(6, 84, 6, '#f59e0b', 0, 0, 0), ...Array.from({ length: 8 }, (_, i) => B(6.4, .6, 6.4, '#b45309', 0, 0, 6 + i * 10)), B(72, 4, 4, '#f59e0b', 18, 0, 84), B(10, 7, 7, '#57534e', -16, 0, 81), B(5, 5, 5, '#1e293b', 4, 0, 78), B(.4, 30, .4, '#111827', 48, 0, 54), B(8, 5, 8, '#64748b', 48, 0, 49)] },
    rock: { r0: 6, b: () => [S(5, '#a8a29e', 0, 2, 0, 1.3, .75, 1), S(3, '#78716c', 3.4, 1.8, 1.4)] },
    shroom: { r0: 1.5, b: () => [C(.4, .5, 1.4, '#f5f5f4', 0, 0, 0, 6), SL(1.1, '#dc2626', 0, 1.6, 0, 1, .6, 1)] },
    deer: { r0: 7, b: () => [B(10, 5, 4, '#a16207', 0, 0, 7), B(2.6, 6, 2.4, '#a16207', 5.4, 0, 10), B(4, 2.6, 2.4, '#92400e', 7, 0, 15), ...[[3.6, 1.2], [3.6, -1.2], [-3.6, 1.2], [-3.6, -1.2]].map(([x, z]) => B(1, 7, 1, '#78350f', x, z, 0)), B(.4, 4, .4, '#e7e5e4', 6, 1, 17.6), B(.4, 4, .4, '#e7e5e4', 6, -1, 17.6), B(2.4, .4, .4, '#e7e5e4', 6.8, 1, 20), B(2.4, .4, .4, '#e7e5e4', 6.8, -1, 20), S(.8, '#f5f5f4', -5.2, 11, 0)] },
    /* ── aldeia ── */
    vhouse: { r0: 26, b: () => [B(36.4, 2, 28.4, '#d6d3d1', 0, 0, 0), B(36, 20, 28, 'P', 0, 0, 0), GABLE(40, 32, 12, '#c2410c', 0, 0, 20, true), B(4.5, 10, 4.5, '#e7e5e4', 10, -6, 26), B(6, 11, .8, '#78350f', 0, 14.2, 0), ...[-11, 11].map(x => B(6, 6, .8, '#1e3a5f', x, 14.2, 9)), ...[-11, 11].map(x => B(8, 1, 1.6, '#57534e', x, 14.6, 8.2))] },
    vhouse2: { r0: 24, b: () => [B(26, 32, 24, 'P', 0, 0, 0), GABLE(30, 28, 10, '#b45309', 0, 0, 32, true), B(20, 1.2, 5, '#78716c', 0, 14.5, 15), B(20, 3.4, .5, '#1f2937', 0, 16.8, 16.2), B(5, 10, .8, '#78350f', 0, 12.2, 0), B(6, 8, .8, '#1e3a5f', 0, 12.2, 17), ...[-8, 8].flatMap(x => [B(4.4, 5, .8, '#1e3a5f', x, 12.2, 22), B(4.4, 5, .8, '#1e3a5f', x, 12.2, 5)])] },
    church: { r0: 58, b: () => [B(48, 2, 82, '#d6d3d1', 0, -8, 0), B(46, 36, 80, '#f5f5f4', 0, -8, 0), GABLE(84, 50, 20, '#9a3412', 0, -8, 36), B(26, 72, 26, '#fafaf9', 0, 40, 0), B(26.6, 2, 26.6, '#d6d3d1', 0, 40, 54), B(26.4, 9, 10, '#1f2937', 0, 40, 60), B(10, 9, 26.4, '#1f2937', 0, 40, 60), K(19, 24, '#9a3412', 0, 40, 72, 4, Math.PI / 4), B(1.6, 12, 1.6, '#fbbf24', 0, 40, 96), B(7, 1.6, 1.6, '#fbbf24', 0, 40, 103), B(10, 16, .8, '#78350f', 0, 53.2, 0), C(4.5, 4.5, .8, '#60a5fa', 0, 53.2, 38, 16, Math.PI / 2), ...[-30, -12, 6].flatMap(z => [B(.8, 14, 6, '#60a5fa', 23.2, z, 14), B(.8, 14, 6, '#60a5fa', -23.2, z, 14)])] },
    barn: { r0: 44, b: () => [B(56, 30, 40, '#b91c1c', 0, 0, 0), GABLE(60, 44, 18, '#44403c', 0, 0, 30, true), B(20, 22, .8, '#f5f5f4', 0, 20.2, 0), B(17, 20, 1, '#991b1b', 0, 20.4, 0), part(new THREE.BoxGeometry(22, 1.2, .6), '#f5f5f4', 0, 10, 20.9, 0, 0, .78), part(new THREE.BoxGeometry(22, 1.2, .6), '#f5f5f4', 0, 10, 20.9, 0, 0, -.78), B(.8, 9, 9, '#f5f5f4', 28.3, 0, 31), B(1, 7, 7, '#78350f', 28.6, 0, 32)] },
    silo: { r0: 13, b: () => [C(12, 12, 56, '#d6d3d1', 0, 0, 0, 16), S(12, '#94a3b8', 0, 56, 0, 1, .7, 1), ...[12, 24, 36, 48].map(y => C(12.4, 12.4, 1.2, '#a8a29e', 0, 0, y, 16)), B(1.4, 56, 2, '#78716c', 12.4, 0, 0)] },
    windmill: { r0: 22, b: () => [C(11, 15, 46, '#fafaf9', 0, 0, 0, 12), K(13, 14, '#78350f', 0, 0, 46, 12), B(5, 9, 1, '#78350f', 0, 14.6, 0), B(4, 4, 1, '#1e3a5f', 0, 12.4, 26), S(2.4, '#44403c', 0, 46, 12.6), ...[0, 1, 2, 3].map(i => { const t = i * Math.PI / 2 + .3; return part(new THREE.BoxGeometry(4.5, 32, .6), '#f5f5f4', -Math.sin(t) * 17, 46 + Math.cos(t) * 17, 13, 0, 0, t); })] },
    tractor: { r0: 12, b: () => [B(11, 6, 8, 'P', 4, 0, 4), B(9, 9, 10, 'P', -4, 0, 4), B(8.4, 7, 9.4, '#bfdbfe', -4, 0, 13), B(10, 1, 11, 'P', -4, 0, 20), WHEEL(-5, 5.8, 5.2), WHEEL(-5, -5.8, 5.2), WHEEL(6, 4.8, 3), WHEEL(6, -4.8, 3), C(.5, .5, 7, '#374151', 7, 2, 10, 6), B(1, 2, 6, '#fef3c7', 9.6, 0, 7)] },
    hay: { r0: 6, b: () => [part(new THREE.CylinderGeometry(5, 5, 7, 14), '#eab308', 0, 5, 0, Math.PI / 2), part(new THREE.CylinderGeometry(3.4, 3.4, 7.2, 12), '#ca8a04', 0, 5, 0, Math.PI / 2)] },
    haystack: { r0: 9, b: () => [C(9, 9, 3, '#ca8a04', 0, 0, 0, 12), K(9, 14, '#eab308', 0, 0, 3, 12)] },
    cow: { r0: 10, b: () => [B(14, 7, 7, 'P', 0, 0, 6), S(2.4, '#111827', -3, 10.4, 3.3, 1, .9, .35), S(2, '#111827', 3, 9, -3.3, 1, .9, .35), S(1.8, '#111827', 1, 12.8, 0, 1, .3, 1), B(5, 5, 5, 'P', 9, 0, 9), B(2.4, 2.6, 4, '#fda4af', 12.2, 0, 9.4), ...[[5, 2.4], [5, -2.4], [-5, 2.4], [-5, -2.4]].map(([x, z]) => B(1.6, 6, 1.6, 'P', x, z, 0)), B(.6, 2, .6, '#fef3c7', 9, 2, 14), B(.6, 2, .6, '#fef3c7', 9, -2, 14), B(.6, 5, .6, 'P', -7.3, 0, 7.5)] },
    sheep: { r0: 5, b: () => [S(3.6, '#f5f5f4', 0, 6, 0, 1.35, .95, 1.05), S(2.4, '#fafaf9', 2.2, 7.6, 0), S(2.2, '#fafaf9', -2.4, 7.2, 1), B(2.4, 2.8, 2.2, '#1f2937', 5.2, 0, 5.4), ...[[2.4, 1.5], [2.4, -1.5], [-2.4, 1.5], [-2.4, -1.5]].map(([x, z]) => B(.8, 3.4, .8, '#1f2937', x, z, 0))] },
    pig: { r0: 5, b: () => [S(3.6, '#f9a8d4', 0, 5, 0, 1.4, 1, 1), C(1.4, 1.4, 1.2, '#f472b6', 5.4, 0, 4.4, 10, 0, Math.PI / 2), ...[[2.4, 1.5], [2.4, -1.5], [-2.4, 1.5], [-2.4, -1.5]].map(([x, z]) => B(1.1, 2.4, 1.1, '#f9a8d4', x, z, 0)), K(.9, 1.6, '#f472b6', 3.6, 1.6, 7.4, 4), K(.9, 1.6, '#f472b6', 3.6, -1.6, 7.4, 4)] },
    chicken: { r0: 2.2, b: () => [SL(1.7, 'P', 0, 2.6, 0, 1.25, 1, 1), SL(1.1, 'P', 1.6, 4.2, 0), B(.4, .9, .5, '#ef4444', 1.7, 0, 5), K(.35, .9, '#f59e0b', 2.8, 0, 3.8, 4), SL(1, 'P', -1.9, 3.4, 0, .7, 1.2, 1), B(.3, 1.1, .3, '#f59e0b', 0, .6, 0), B(.3, 1.1, .3, '#f59e0b', 0, -.6, 0)] },
    horse: { r0: 11, b: () => [B(15, 7, 6, 'P', 0, 0, 9), part(new THREE.BoxGeometry(3.6, 9, 3.4), 'P', 7.4, 18, 0, 0, 0, -.45), B(6.4, 3.6, 3.4, 'P', 10.6, 0, 20.4), ...[[5.6, 2], [5.6, -2], [-5.6, 2], [-5.6, -2]].map(([x, z]) => B(1.6, 9, 1.6, 'P', x, z, 0)), part(new THREE.BoxGeometry(1.2, 8, 1.2), '#1f2937', -8.4, 12, 0, 0, 0, -.4)] },
    scarecrow: { r0: 5, b: () => [B(.8, 14, .8, '#78350f', 0, 0, 0), B(12, .8, .8, '#78350f', 0, 0, 10), B(5, 6, 3, '#2563eb', 0, 0, 6.4), S(2, '#fde68a', 0, 13.4, 0), C(3.4, 3.4, .4, '#a16207', 0, 0, 14.6, 12), K(2, 2.6, '#a16207', 0, 0, 14.8, 10)] },
    wheat: { r0: 7, b: () => [B(13, 1, 13, '#8b6d3f', 0, 0, 0), ...Array.from({ length: 9 }, (_, i) => K(1.5, 7, '#eab308', -4 + (i % 3) * 4, -4 + Math.floor(i / 3) * 4, 1, 5))] },
    corn: { r0: 6, b: () => [B(11, 1, 11, '#78350f', 0, 0, 0), ...[[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]].flatMap(([x, z]) => [C(.4, .5, 13, '#65a30d', x, z, 1, 5), K(2, 7, '#4d7c0f', x, z, 5, 5), SL(.8, '#facc15', x + .9, 9, z, 1, 2, 1)])] },
    veg: { r0: 3, b: () => [SL(2.6, '#4ade80', 0, 2.2, 0, 1, .8, 1), SL(1.6, '#86efac', 0, 3.4, 0)] },
    pumpkin: { r0: 3.5, b: () => [SL(3.2, '#f97316', 0, 2.8, 0, 1.2, .8, 1.2), C(.4, .4, 1.6, '#15803d', 0, 0, 4.8, 5)] },
    well: { r0: 7, b: () => [C(6, 6.4, 5, '#a8a29e', 0, 0, 0, 12), C(4.8, 4.8, .3, '#0c4a6e', 0, 0, 4.9, 12), B(.8, 12, .8, '#78350f', -5, 0, 5), B(.8, 12, .8, '#78350f', 5, 0, 5), GABLE(14, 9, 4, '#9a3412', 0, 0, 16, true), CX(.6, .6, 10, '#78350f', 0, 13, 0, 6)] },
    woodpile: { r0: 6, b: () => [[1.3, -2.6], [1.3, 0], [1.3, 2.6], [3.5, -1.3], [3.5, 1.3], [5.7, 0]].map(([y, z]) => CX(1.3, 1.3, 11, '#92400e', 0, y, z, 8)) },
    tomb: { r0: 3, b: () => [B(5, 1, 3.4, '#78716c', 0, 0, 0), B(3.8, 5, 1.2, '#a8a29e', 0, -1, 1), S(1.9, '#a8a29e', 0, 6, -1, 1, 1, .32)] },
    tombX: { r0: 3, b: () => [B(5, 1, 7, '#57534e', 0, 1.4, 0), B(1, 7, 1, '#d6d3d1', 0, -1.6, 1), B(4, 1, 1, '#d6d3d1', 0, -1.6, 5.4)] },
    fruitTree: { r0: 10, b: () => [C(1.1, 1.6, 9, '#78350f', 0, 0, 0), S(7.5, 'P', 0, 14, 0, 1, .9, 1), ...[[3, 15, 5.4], [-4.6, 13, 3.4], [1, 18.4, -4.4], [-2.4, 11.6, -5.6], [5.8, 12, -1.4], [-5, 16, -2]].map(([x, y, z]) => SL(1.05, '#f97316', x, y, z))] },
    cypress: { r0: 5, b: () => [C(.6, .8, 3, '#78350f', 0, 0, 0), S(4.2, '#14532d', 0, 13, 0, .8, 2.6, .8)] },
    duck: { r0: 1.8, b: () => [SL(1.4, '#f5f5f4', 0, 1.3, 0, 1.4, .8, 1), SL(.8, '#15803d', 1.6, 2.5, 0), B(1, .3, .6, '#f59e0b', 2.5, 0, 2.3)] },
    reeds: { r0: 4, b: () => [[0, 0], [1.6, 1], [-1.4, .8], [.6, -1.6], [-1, -1.2]].map(([x, z], i) => K(.45, 7 + i, '#4d7c0f', x, z, 0, 4)) },
    cafe: { r0: 7, b: () => [C(3.4, 3.4, .5, '#f8fafc', 0, 0, 7, 12), C(.4, .4, 7, '#374151', 0, 0, 0, 6), ...[-5.5, 5.5].flatMap(x => [B(3.4, 4.4, 3.4, 'P', x, 0, 0), B(.6, 4.4, 3.4, 'P', x + Math.sign(x) * 1.5, 0, 4.4)])] },
    /* ── aeroporto ── */
    airliner: { r0: 70, b: () => [CX(6.5, 6.5, 96, '#f8fafc', 0, 12, 0, 16), S(6.5, '#f8fafc', 48, 12, 0, 1.7, 1, 1), CX(1.6, 6.5, 22, '#f8fafc', -59, 13.6, 0, 16), B(96, 2.2, 13.3, 'P', 0, 0, 7.6), B(84, 1.3, 13.2, '#1e293b', -2, 0, 14.2), B(5, 2.2, 10, '#0f172a', 53, 0, 14.4),
      part(new THREE.BoxGeometry(22, 1.4, 58), '#e5e7eb', -2.6, 9, 29, 0, -.3, 0), part(new THREE.BoxGeometry(22, 1.4, 58), '#e5e7eb', -2.6, 9, -29, 0, .3, 0),
      CX(3.4, 3.4, 13, '#cbd5e1', 2, 5.6, 20, 12), CX(3.4, 3.4, 13, '#cbd5e1', 2, 5.6, -20, 12), CX(2.8, 2.8, 1, '#1f2937', 8.7, 5.6, 20, 12), CX(2.8, 2.8, 1, '#1f2937', 8.7, 5.6, -20, 12),
      part(new THREE.BoxGeometry(12, 1, 22), '#e5e7eb', -62, 14, 11, 0, -.35, 0), part(new THREE.BoxGeometry(12, 1, 22), '#e5e7eb', -62, 14, -11, 0, .35, 0), part(new THREE.BoxGeometry(20, 24, 1.4), 'P', -60, 26, 0, 0, 0, .45),
      C(.7, .7, 5.5, '#374151', 38, 0, 0, 6), WHEEL(38, 0, 1.4), ...[-1, 1].flatMap(s => [C(.8, .8, 5, '#374151', -2, s * 5, 0, 6), WHEEL(-2, s * 5, 2)])] },
    jet: { r0: 28, b: () => [CX(3.2, 3.2, 34, '#f8fafc', 0, 7, 0, 12), S(3.2, '#f8fafc', 17, 7, 0, 2, 1, 1), CX(1, 3.2, 12, '#f8fafc', -23, 7.6, 0, 12), B(2.6, 1.2, 5, '#0f172a', 19, 0, 7.6), B(30, .9, 6.5, 'P', -1, 0, 5.2),
      part(new THREE.BoxGeometry(8, .8, 20), '#e5e7eb', -3, 5.6, 10.5, 0, -.35, 0), part(new THREE.BoxGeometry(8, .8, 20), '#e5e7eb', -3, 5.6, -10.5, 0, .35, 0), CX(1.7, 1.7, 8, '#cbd5e1', -14, 9.6, 4.6, 10), CX(1.7, 1.7, 8, '#cbd5e1', -14, 9.6, -4.6, 10),
      part(new THREE.BoxGeometry(9, 11, .8), 'P', -25, 14, 0, 0, 0, .5), part(new THREE.BoxGeometry(5, .6, 15), 'P', -28.5, 19.4, 0), WHEEL(12, 0, 1), WHEEL(-3, 2.4, 1.2), WHEEL(-3, -2.4, 1.2)] },
    propPlane: { r0: 16, b: () => [CX(2.3, 2.6, 20, 'P', 0, 5, 0, 10), CX(2.6, 1.2, 3, '#e5e7eb', 11.4, 5, 0, 10), B(.4, 9, 1.2, '#111827', 13.2, 0, .6), S(.8, '#111827', 13.4, 5, 0), B(6, .7, 30, '#f8fafc', 1, 0, 7.6), CX(1, 2.3, 8, 'P', -13, 5.6, 0, 8), part(new THREE.BoxGeometry(5, 6, .5), 'P', -16, 9, 0, 0, 0, .4), B(4, .5, 11, '#f8fafc', -16, 0, 6), B(4, 1.4, 4.8, '#1e3a5f', 4, 0, 6.2), WHEEL(5, 2.4, 1.3), WHEEL(5, -2.4, 1.3), WHEEL(-14, 0, .7)] },
    heli: { r0: 16, b: () => [S(4.6, 'P', 0, 7, 0, 1.35, 1, 1), S(3.2, '#1e3a5f', 3.2, 7.8, 0, 1, .9, 1.2), CX(.7, 1.6, 13, 'P', -11, 8, 0, 8), part(new THREE.BoxGeometry(4, 5, .4), 'P', -17.4, 10, 0, 0, 0, .4), C(.5, .5, 3, '#374151', 0, 0, 11.4, 6), B(34, .3, 1.4, '#1f2937', 0, 0, 14.4), B(1.4, .3, 34, '#1f2937', 0, 0, 14.4), ...[-1, 1].flatMap(s => [B(15, .6, .8, '#374151', 0, s * 3.4, 0), B(.5, 2.8, .5, '#374151', 3, s * 3.4, .6), B(.5, 2.8, .5, '#374151', -3, s * 3.4, .6)]), C(2.2, 2.2, .2, '#1f2937', -17.4, .4, 11.6, 10, Math.PI / 2)] },
    ctower: { r0: 26, b: () => [B(30, 18, 30, '#d6d3d1', 0, 0, 0), C(8, 11, 92, '#e5e7eb', 0, 0, 0, 12), C(15, 9, 12, '#cbd5e1', 0, 0, 92, 12), C(16, 16, 12, '#1e3a5f', 0, 0, 104, 14), C(17, 17, 3, '#94a3b8', 0, 0, 116, 14), C(1, 1, 14, '#e5e7eb', 0, 0, 119, 6), S(1.4, '#ef4444', 0, 134, 0), B(8, 12, .8, '#1e293b', 0, 15.2, 0)] },
    terminal: { r0: 100, b: () => [B(180, 30, 84, '#e2e8f0', 0, 0, 0), B(180.6, 16, 84.6, '#1e3a5f', 0, 0, 10), B(190, 3, 94, '#94a3b8', 0, 0, 30), ARCH(94, 12, '#cbd5e1', -45, 0, 33), ARCH(94, 12, '#cbd5e1', 45, 0, 33),
      ...[-60, 0, 60].flatMap(x => [B(9, 8, 44, '#cbd5e1', x, -64, 14), B(12, 12, 10, '#94a3b8', x, -86, 10), C(1.2, 1.2, 14, '#64748b', x, -80, 0, 6)]),
      B(70, 8, .8, '#0f172a', 0, 42.4, 20), B(60, 3, .9, '#fde047', 0, 42.5, 22.5), B(60, 1.5, 16, '#cbd5e1', 0, 50, 14), ...[-28, 28].map(x => C(.8, .8, 14, '#94a3b8', x, 56, 0, 6))] },
    hangar: { r0: 60, b: () => [ARCH(96, 40, '#94a3b8', 0, 0, 0), B(52, 28, .8, '#334155', 0, 48.2, 0), ...[-18, -6, 6, 18].map(x => B(.6, 28, 1, '#1e293b', x, 48.6, 0)), B(22, 14, 18, '#e5e7eb', 46, 26, 0), B(20, 4, .6, '#dc2626', 0, 48.8, 31)] },
    radar: { r0: 10, b: () => [C(1, 1.4, 18, '#e5e7eb', 0, 0, 0, 8), C(3, 3, 3, '#94a3b8', 0, 0, 17, 10), part(new THREE.BoxGeometry(20, 6, 1.2), '#f8fafc', 0, 22.5, 0, -.35)] },
    windsock: { r0: 3, b: () => [C(.4, .4, 14, '#e5e7eb', 0, 0, 0, 6), CX(1.4, 1.1, 4, '#f97316', 2.4, 13, 0, 8), CX(1.1, .8, 4, '#f8fafc', 6.4, 12.6, 0, 8)] },
    elight: { r0: 1.5, b: () => [C(.5, .6, 1.6, '#374151', 0, 0, 0, 6), S(.7, 'P', 0, 1.9, 0)] },
    bagcart: { r0: 12, b: () => [B(6, 4, 5, '#f59e0b', 8, 0, 1.6), B(3, 3, 4.4, '#1e293b', 6.6, 0, 5.6), WHEEL(9.6, 2.6, 1.3), WHEEL(9.6, -2.6, 1.3), WHEEL(6, 2.6, 1.3), WHEEL(6, -2.6, 1.3),
      ...[0, -9].flatMap((x, n) => [B(8, .8, 5.4, '#475569', x, 0, 2), WHEEL(x + 2.6, 2.8, 1), WHEEL(x + 2.6, -2.8, 1), WHEEL(x - 2.6, 2.8, 1), WHEEL(x - 2.6, -2.8, 1), B(2.6, 3, 4, n ? '#16a34a' : '#2563eb', x - 2, 0, 2.8), B(2.6, 2.4, 3.8, n ? '#7c3aed' : '#dc2626', x + 1.2, 0, 2.8), B(2.2, 1.6, 3.4, '#0f172a', x + 1, 0, 5.2)])] },
    stairs: { r0: 12, b: () => [B(12, 5, 7, 'P', 3, 0, 2), B(4, 4, 6.4, '#1e3a5f', 7, 0, 7), part(new THREE.BoxGeometry(17, 1, 4), '#e5e7eb', -2, 10, 0, 0, 0, -.55), B(1, 3, 4, '#e5e7eb', -9.6, 0, 14), WHEEL(6.5, 3.6, 1.8), WHEEL(6.5, -3.6, 1.8), WHEEL(-1, 3.6, 1.8), WHEEL(-1, -3.6, 1.8)] },
    fueltruck: { r0: 16, b: () => [B(24, 1.4, 8, '#374151', 0, 0, 2), B(7, 9, 9, '#f8fafc', 10, 0, 2), B(1, 4, 7.6, '#1e3a5f', 13.6, 0, 6.4), CX(4.6, 4.6, 22, '#e5e7eb', -4, 7.6, 0, 14), B(22.2, 1.8, 9.3, 'P', -4, 0, 6.6), ...[-12, -4, 10].flatMap(x => [WHEEL(x, 4.4, 2.4), WHEEL(x, -4.4, 2.4)])] },
    gpu: { r0: 4, b: () => [B(7, 4.4, 4.4, '#f59e0b', 0, 0, 1.2), B(7.2, .6, 4.6, '#1f2937', 0, 0, 5.6), WHEEL(2.4, 2.4, 1.1), WHEEL(2.4, -2.4, 1.1), WHEEL(-2.4, 2.4, 1.1), WHEEL(-2.4, -2.4, 1.1)] },
    forklift: { r0: 7, b: () => [B(7, 4, 5, '#facc15', 0, 0, 1.4), B(1, 12, 4.6, '#374151', 4, 0, 0), B(5, .5, 1, '#374151', 6.6, 1.6, .6), B(5, .5, 1, '#374151', 6.6, -1.6, .6), ...[[1.6, 2], [1.6, -2], [-4, 2], [-4, -2]].map(([x, z]) => B(.4, 6, .4, '#1f2937', x, z, 5.4)), B(6, .4, 4.6, '#1f2937', -1.2, 0, 11.4), B(3, 1, 3, '#111827', -1, 0, 5.4), WHEEL(2.4, 2.6, 1.4), WHEEL(2.4, -2.6, 1.4), WHEEL(-2.4, 2.6, 1.2), WHEEL(-2.4, -2.6, 1.2)] },
    suitcase: { r0: 3, b: () => [B(3, 4.4, 1.6, 'P', 0, 0, .6), B(.4, 1.4, .4, '#1f2937', 0, 0, 5), B(1.6, .3, .4, '#1f2937', 0, 0, 6.3), S(.4, '#111827', 1, .4, 0), S(.4, '#111827', -1, .4, 0)] },
    tank: { r0: 23, b: () => [C(22, 22, 26, '#e5e7eb', 0, 0, 0, 20), C(22.4, 22.4, 1.2, '#94a3b8', 0, 0, 25.6, 20), C(20, 22, 3, '#d6d3d1', 0, 0, 26.2, 20), B(1, 26, 2.4, '#64748b', 22.2, 0, 0), B(12, 5, .4, '#dc2626', 0, 22.1, 12)] },
    /* ── praia ── */
    palm: { r0: 10, b: () => [...[0, 1, 2, 3].map(i => part(new THREE.CylinderGeometry(1 - i * .1, 1.25 - i * .1, 6.6, 7), '#a16207', i * 1.3, 3.3 + i * 6.2, 0, 0, 0, -.1 - i * .07)),
      ...Array.from({ length: 7 }, (_, n) => { const a = n / 7 * TAU; return part(new THREE.BoxGeometry(12, .4, 3.2), 'P', 5.2 + Math.cos(a) * 5.4, 24.6, Math.sin(a) * 5.4, 0, -a, -.35); }),
      SL(1, '#78350f', 5.6, 24, 1), SL(1, '#78350f', 4.4, 24, -1), SL(1, '#78350f', 5.8, 23.8, -1.2)] },
    lounger: { r0: 7, b: () => [B(12, 1, 5, 'P', 1.5, 0, 2.6), part(new THREE.BoxGeometry(5.4, 1, 5), 'P', -6.4, 5, 0, 0, 0, -.8), ...[[5.6, 2], [5.6, -2], [-3.4, 2], [-3.4, -2]].map(([x, z]) => B(.6, 2.6, .6, '#e5e7eb', x, z, 0))] },
    towel: { r0: 5, b: () => [B(10, .35, 5.4, 'P', 0, 0, 0), B(10.05, .38, 1, '#f8fafc', 0, 1.4, 0), B(10.05, .38, 1, '#f8fafc', 0, -1.4, 0)] },
    sandcastle: { r0: 6, b: () => [B(9, 4, 9, '#e7c98f', 0, 0, 0), ...[[-3.8, -3.8], [3.8, -3.8], [-3.8, 3.8], [3.8, 3.8]].map(([x, z]) => C(1.8, 2.2, 6.4, '#e7c98f', x, z, 0, 8)), C(2.6, 3, 9, '#d6b877', 0, 0, 3, 8), K(2.8, 3, '#d6b877', 0, 0, 12, 8), B(.2, 3, .2, '#374151', 0, 0, 15), B(1.8, 1.1, .2, '#ef4444', .9, 0, 16.8)] },
    bucket: { r0: 2.2, b: () => [C(1.8, 1.4, 2.6, 'P', 0, 0, 0, 10)] },
    surfboard: { r0: 10, b: () => [S(2, 'P', 0, .6, 0, 5.2, .22, 1.3), B(14, .12, .4, '#f8fafc', 0, 0, 1.02)] },
    lifeguard: { r0: 13, b: () => [...[[5, 5], [-5, 5], [5, -5], [-5, -5]].map(([x, z]) => B(1, 14, 1, '#f8fafc', x, z, 0)), B(13, 1, 13, '#e5e7eb', 0, 0, 13.4), B(11, 8, 11, '#ef4444', 0, 0, 14.4), B(7, 4, .5, '#1e3a5f', 0, 5.6, 17.4), GABLE(14, 14, 4, '#f8fafc', 0, 0, 22.4), part(new THREE.BoxGeometry(4, 17, .8), '#f8fafc', 0, 7.6, 9.6, -.55), C(.2, .2, 9, '#374151', 5.2, -5.2, 26, 6), B(3, 2, .2, '#facc15', 6.8, -5.2, 32.6)] },
    hut: { r0: 10, b: () => [B(14, 14, 12, 'P', 0, 0, 0), ...[3, 7, 11].map(y => B(14.1, 1.6, 12.1, '#f8fafc', 0, 0, y)), GABLE(16, 15, 5, '#f8fafc', 0, 0, 14, true), B(5, 10, .6, '#78350f', 0, 6.2, 0)] },
    volley: { r0: 10, b: () => [C(.5, .5, 12, '#e5e7eb', 0, 9, 0, 6), C(.5, .5, 12, '#e5e7eb', 0, -9, 0, 6), B(.3, 4.4, 18, '#f8fafc', 0, 0, 7), B(.35, .6, 18.2, '#1f2937', 0, 0, 11.4), S(1.3, '#facc15', 5, 9, 2)] },
    boat: { r0: 9, b: () => [B(13, 3.2, 6.2, 'P', -1, 0, -.8), B(4.4, 3.2, 4.4, 'P', 5.4, 0, -.8, Math.PI / 4), B(12, .3, 5, '#78350f', -1, 0, 2.35), B(1.4, .6, 6, '#a16207', -1, 0, 2.5), B(1.4, .6, 6, '#a16207', -5, 0, 2.5), part(new THREE.BoxGeometry(.5, .4, 16), '#a16207', -1, 3.2, 0, 0, .3, 0)] },
    sailboat: { r0: 16, b: () => [B(22, 3.6, 8.4, '#f8fafc', -2, 0, -1), B(6, 3.6, 6, '#f8fafc', 9, 0, -1, Math.PI / 4), B(22.2, .8, 8.6, 'P', -2, 0, 1.2), B(20, .3, 7.4, '#a16207', -2, 0, 2.65), C(.5, .5, 30, '#e5e7eb', -3, 0, 2.6, 6), GABLE(.4, 15, 26, '#f8fafc', -10.4, 0, 4), GABLE(.4, 9, 20, 'P', 1.6, 0, 4), B(6, 3, 5, '#e5e7eb', -8, 0, 2.6)] },
    yacht: { r0: 32, b: () => [B(50, 8, 16, '#f8fafc', -4, 0, -2), B(11.3, 8, 11.3, '#f8fafc', 21, 0, -2, Math.PI / 4), B(50.2, 1.4, 16.2, '#0f172a', -4, 0, 3), B(46, .3, 14, '#d6b48a', -4, 0, 6), B(30, 6, 13, '#f8fafc', -8, 0, 6.3), B(30.2, 2.2, 13.2, '#0f172a', -8, 0, 8.6), B(18, 5, 11, '#f8fafc', -10, 0, 12.3), B(18.2, 1.8, 11.2, '#0f172a', -10, 0, 13.6), B(20, .8, 12, '#e5e7eb', -11, 0, 17.3), C(.4, .4, 8, '#e5e7eb', -12, 0, 18, 6), B(3, 1, 1, '#e5e7eb', -12, 0, 24)] },
    jetski: { r0: 5, b: () => [B(8, 2, 3.4, 'P', 0, 0, -.4), B(3, 2, 3, 'P', 4, 0, -.4, Math.PI / 4), B(3, 1.2, 2.2, '#111827', -1, 0, 1.6), B(1, 1.6, 3.4, '#1f2937', 2.4, 0, 1.6)] },
    buoy: { r0: 2, b: () => [C(1.6, 1.8, 2.6, '#f97316', 0, 0, -.8, 10), C(.3, .3, 3, '#e5e7eb', 0, 0, 1.8, 6), S(.6, '#f97316', 0, 5, 0)] },
    ring: { r0: 3, b: () => [part(new THREE.TorusGeometry(2.3, .9, 8, 16), 'P', 0, .5, 0, Math.PI / 2)] },
    pier: { r0: 44, b: () => [B(12, 1.6, 90, '#a16207', 0, 0, 3.4), ...Array.from({ length: 8 }, (_, i) => [-5.4, 5.4].map(x => C(.8, .8, 5, '#78350f', x, -40 + i * 11.4, 0, 6))).flat(), ...[-5.8, 5.8].map(x => B(.4, 2.4, 90, '#78350f', x, 0, 5)), C(.3, .3, 10, '#1f2937', 5, -42, 5, 6), B(1.6, 1.4, 1.6, '#fef3c7', 5, -42, 14)] },
    lighthouse: { r0: 16, b: () => [C(12, 14, 6, '#57534e', 0, 0, 0, 10), C(6.5, 7.5, 50, '#f8fafc', 0, 0, 6, 14), ...[14, 30, 46].map(y => C(7.65 - (y + 1) / 50, 7.65 - (y - 6) / 50, 7, '#dc2626', 0, 0, y, 14)), C(7.6, 7.6, 1, '#1f2937', 0, 0, 56, 14), C(4.8, 4.8, 6, '#fde047', 0, 0, 57, 10), K(6.2, 5, '#dc2626', 0, 0, 63, 10)] },
    crab: { r0: 1.6, b: () => [SL(1.2, '#ef4444', 0, .9, 0, 1.3, .6, 1), SL(.5, '#dc2626', 1.4, .9, .9), SL(.5, '#dc2626', 1.4, .9, -.9), B(.2, .6, .2, '#111827', .8, .3, 1.4), B(.2, .6, .2, '#111827', .8, -.3, 1.4)] },
    gull: { r0: 1.6, b: () => [SL(1, '#f8fafc', 0, 1.6, 0, 1.6, .8, .8), SL(.6, '#f8fafc', 1.3, 2.4, 0), B(.7, .2, .3, '#f59e0b', 2, 0, 2.3), B(1.6, .2, 4, '#94a3b8', -.4, 0, 1.9), B(.2, 1, .2, '#f59e0b', 0, 0, 0)] },
    hotel: { r0: 50, b: () => [B(70, 110, 46, 'P', 0, 0, 0), ...Array.from({ length: 10 }, (_, i) => B(71, 1.2, 52, '#f8fafc', 0, 0, 9 + i * 10)), ...Array.from({ length: 10 }, (_, i) => B(70.4, 2.2, 51.4, '#93c5fd', 0, 0, 10.2 + i * 10)), B(72, 2, 48, '#e2e8f0', 0, 0, 110), B(28, .5, 16, '#38bdf8', 0, 4, 112), B(36, 7, .6, '#0f172a', 0, 26, 96), B(30, 2, .7, '#fde047', 0, 26.1, 98.6)] },
    pool: { r0: 30, b: () => [B(56, 1, 32, '#e2e8f0', 0, 0, 0), B(50, 1.05, 26, '#38bdf8', 0, 0, .02), B(1, 3, 3, '#cbd5e1', 24, 13.6, 1)] },
    /* ── casa: mobília ── */
    sofa: { r0: 56, b: () => [B(110, 18, 48, 'P', 0, 0, 4), B(110, 30, 12, 'P', 0, -18, 4), B(12, 26, 48, 'P', -49, 0, 4), B(12, 26, 48, 'P', 49, 0, 4), ...[-30, 0, 30].map(x => B(28, 6, 34, 'P', x, 4, 22)), ...[[-50, 20], [50, 20], [-50, -20], [50, -20]].map(([x, z]) => B(4, 4, 4, '#1f2937', x, z, 0))] },
    armchair: { r0: 26, b: () => [B(48, 16, 44, 'P', 0, 0, 4), B(48, 28, 10, 'P', 0, -17, 4), B(9, 24, 44, 'P', -19.5, 0, 4), B(9, 24, 44, 'P', 19.5, 0, 4), B(30, 6, 30, 'P', 0, 4, 20)] },
    ctable: { r0: 38, b: () => [C(36, 36, 3, '#78350f', 0, 0, 22, 28), ...[0, 1, 2, 3].map(i => C(1.6, 1.6, 22, '#451a03', Math.cos(i * 1.57 + .78) * 26, Math.sin(i * 1.57 + .78) * 26, 0, 6)), C(6, 6, 6, '#16a34a', 8, 6, 25, 10), B(12, 2, 8, '#f8fafc', -12, -8, 25)] },
    tv: { r0: 30, b: () => [B(60, 18, 20, '#44403c', 0, 0, 0), B(52, 30, 3, '#0f172a', 0, 0, 22), B(48, 26, 3.4, '#1d4ed8', 0, .2, 24), B(8, 4, 6, '#0f172a', 0, 0, 18)] },
    shelf: { r0: 30, b: () => [B(56, 70, 16, '#92400e', 0, 0, 0), ...[0, 1, 2, 3].map(i => B(52, 2, 15, '#78350f', 0, .5, 4 + i * 17)), ...Array.from({ length: 14 }, (_, i) => B(3, 11 + (i % 3), 11, ['#dc2626', '#2563eb', '#16a34a', '#facc15', '#7c3aed'][i % 5], -24 + (i % 7) * 7, 1, 6 + Math.floor(i / 7) * 17))] },
    bed: { r0: 64, b: () => [B(90, 14, 124, '#92400e', 0, 0, 0), B(90, 36, 8, '#78350f', 0, -62, 0), B(84, 10, 116, '#f8fafc', 0, 2, 14), B(86, 6, 76, 'P', 0, 20, 22), B(32, 8, 20, '#e0e7ff', -20, -44, 23), B(32, 8, 20, '#e0e7ff', 20, -44, 23)] },
    wardrobe: { r0: 52, b: () => [B(96, 100, 36, 'P', 0, 0, 0), B(1, 96, 1, '#1f2937', 0, 18.2, 2), B(2, 12, 2, '#d4d4d8', -4, 18.8, 44), B(2, 12, 2, '#d4d4d8', 4, 18.8, 44)] },
    desk: { r0: 34, b: () => [B(66, 3, 34, '#a16207', 0, 0, 30), ...[[-30, 14], [30, 14], [-30, -14], [30, -14]].map(([x, z]) => B(3, 30, 3, '#78350f', x, z, 0)), B(26, 18, 2, '#0f172a', 4, -8, 33), B(22, 14, 2.4, '#38bdf8', 4, -7.8, 35), C(2, 3, 18, '#374151', -24, -8, 33, 8), B(22, 1, 8, '#1f2937', 4, 6, 33)] },
    chair: { r0: 16, b: () => [B(22, 3, 22, 'P', 0, 0, 18), B(22, 24, 3, 'P', 0, -9.5, 21), ...[[-9, 9], [9, 9], [-9, -9], [9, -9]].map(([x, z]) => B(2.4, 18, 2.4, '#44403c', x, z, 0))] },
    dtable: { r0: 40, b: () => [B(80, 3.4, 52, '#d6d3d1', 0, 0, 28), ...[[-36, 22], [36, 22], [-36, -22], [36, -22]].map(([x, z]) => B(3, 28, 3, '#57534e', x, z, 0)), C(5, 5, 12, '#f8fafc', 0, 0, 31.4, 10), S(6, '#ef4444', 0, 45, 0)] },
    fridge: { r0: 36, b: () => [B(56, 120, 50, '#e5e7eb', 0, 0, 0), B(1, 118, 1, '#9ca3af', 0, 25.2, 42), B(56.4, 1, 50.4, '#9ca3af', 0, 0, 80), B(2, 20, 2, '#6b7280', 20, 26, 90), B(2, 20, 2, '#6b7280', 20, 26, 50)] },
    stove: { r0: 30, b: () => [B(50, 62, 46, '#e5e7eb', 0, 0, 0), B(50.4, 2, 46.4, '#111827', 0, 0, 62), ...[[-12, -10], [12, -10], [-12, 10], [12, 10]].map(([x, z]) => C(7, 7, 1, '#374151', x, z, 64, 14)), B(36, 22, 1, '#0f172a', 0, 23.4, 20)] },
    counter: { r0: 40, b: () => [B(90, 60, 42, '#f5f5f4', 0, 0, 0), B(92, 3, 44, '#57534e', 0, 0, 60), ...[-28, 0, 28].map(x => B(24, 50, 1, '#d6d3d1', x, 21.4, 5)), C(9, 9, 1, '#94a3b8', 20, 0, 63, 12)] },
    bath: { r0: 48, b: () => [B(66, 36, 120, '#f8fafc', 0, 0, 0), B(54, 4, 106, '#7dd3fc', 0, 0, 30), C(2, 2, 16, '#cbd5e1', 0, -52, 36, 8)] },
    toilet: { r0: 18, b: () => [C(9, 10, 26, '#f8fafc', 0, 4, 0, 14), C(9.4, 9.4, 2, '#e5e7eb', 0, 4, 26, 14), B(24, 26, 10, '#f8fafc', 0, -12, 14)] },
    sinkB: { r0: 18, b: () => [B(34, 50, 26, '#f8fafc', 0, 0, 0), C(9, 7, 4, '#bae6fd', 0, 2, 50, 12), C(1.4, 1.4, 10, '#cbd5e1', 0, -9, 50, 8)] },
    washer: { r0: 22, b: () => [B(40, 52, 40, '#f8fafc', 0, 0, 0), C(12, 12, 1, '#1e293b', 0, 20.3, 22, 20, Math.PI / 2), C(9, 9, 1.2, '#38bdf8', 0, 20.5, 22, 20, Math.PI / 2)] },
    plant: { r0: 17, b: () => [C(9, 7, 16, '#c2410c', 0, 0, 0, 12), S(9, '#16a34a', 0, 26, 0), S(6.5, '#22c55e', 5, 32, 3), S(6, '#15803d', -5, 30, -3), S(5, '#22c55e', 1, 37, -2)] },
    flamp: { r0: 12, b: () => [C(8, 9, 2, '#1f2937', 0, 0, 0, 14), C(1, 1, 80, '#1f2937', 0, 0, 2, 8), C(9, 13, 16, '#fef3c7', 0, 0, 76, 14)] },
    piano: { r0: 60, b: () => [B(120, 70, 60, '#0f172a', 0, 0, 0), B(112, 3, 18, '#f8fafc', 0, 22, 62), B(112, 2, 6, '#111827', 0, 16, 64), B(122, 3, 62, '#1e293b', 0, 0, 70)] },
    rack: { r0: 22, b: () => [B(44, 30, 16, '#57534e', 0, 0, 0), ...[-14, -4, 6, 16].map((x, i) => B(8, 5, 12, ['#111827', '#dc2626', '#f8fafc', '#2563eb'][i], x, 0, 31))] },
    dogbed: { r0: 20, b: () => [C(18, 20, 8, 'P', 0, 0, 0, 20), C(13, 13, 2, '#fde68a', 0, 0, 7, 20)] },
    basket: { r0: 14, b: () => [C(12, 10, 22, '#d6d3d1', 0, 0, 0, 14), S(8, '#f472b6', 2, 22, 0), S(6, '#60a5fa', -4, 23, 3)] },
    box: { r0: 18, b: () => [B(30, 24, 26, '#d6a064', 0, 0, 0), B(30.4, 1, 6, '#b45309', 0, 0, 24)] },
    rug: { r0: 1, b: () => [B(300, .6, 190, 'P', 0, 0, 0), B(280, .8, 170, '#fbbf24', 0, 0, .1), B(270, .9, 160, 'P', 0, 0, .15)] },
    /* ── casa: miúdos ── */
    crumb: { r0: 2.5, b: () => [B(4, 1.6, 3, '#d6b48a', 0, 0, 0)] },
    dust: { r0: 4, b: () => [S(3.2, '#94a3b8', 0, 2.4, 0, 1, .7, 1), S(2.2, '#cbd5e1', 2, 2.8, 1)] },
    coin: { r0: 3, b: () => [C(3, 3, .8, '#fbbf24', 0, 0, 0, 14)] },
    lego: { r0: 4.5, b: () => [B(8, 3.4, 4, 'P', 0, 0, 0), ...[-3, -1, 1, 3].map(x => C(.8, .8, 1, 'P', x, 0, 3.4, 8))] },
    sock: { r0: 6.5, b: () => [B(9, 2, 3.4, 'P', 0, 0, 0), B(3.4, 2, 6, 'P', 4, 2.2, 0), B(9.2, 2.2, 1, '#f8fafc', -2, 0, 0)] },
    toycar: { r0: 7.5, b: () => [WHEEL(-3.8, 3, 1.4), WHEEL(3.8, 3, 1.4), WHEEL(-3.8, -3, 1.4), WHEEL(3.8, -3, 1.4), B(12, 3.4, 6, 'P', 0, 0, 1), B(6, 2.4, 5.4, '#bfdbfe', -1, 0, 4.4)] },
    ball: { r0: 8, b: () => [S(7, 'P', 0, 7, 0), S(7.1, '#f8fafc', 0, 7, 0, 1, .18, 1)] },
    paper: { r0: 5, b: () => [S(4, '#f5f5f4', 0, 3.4, 0, 1, .85, 1.1)] },
    pencil: { r0: 5, b: () => [C(.7, .7, 12, '#facc15', 0, 0, -5.3, 6, 0, Math.PI / 2), part(new THREE.ConeGeometry(.7, 2, 6), '#f1c27d', -7, .7, 0, 0, 0, Math.PI / 2)] },
    remote: { r0: 7, b: () => [B(12, 1.6, 4, '#1f2937', 0, 0, 0), B(1.4, .4, 1.4, '#ef4444', 4, 0, 1.6)] },
    keys: { r0: 3.5, b: () => [part(new THREE.TorusGeometry(1.6, .35, 6, 12), '#d4d4d8', 0, .4, 0, Math.PI / 2), B(4, .5, 1, '#d4d4d8', 3, 0, .2)] },
    shoe: { r0: 9.5, b: () => [B(17, 4, 7, 'P', 0, 0, 0), B(7, 6, 7, 'P', -5, 0, 3), B(17.4, 1.4, 7.4, '#f8fafc', 0, 0, 0)] },
    book: { r0: 10.5, b: () => [B(17, 3.4, 12, 'P', 0, 0, 0), B(16, 2.6, 11.4, '#f8fafc', .6, 0, .4)] },
    cushion: { r0: 14, b: () => [B(22, 7, 22, 'P', 0, 0, 0), S(3, 'P', 0, 7, 0)] },
    teddy: { r0: 15, b: () => [S(8, '#a16207', 0, 8, 0), S(6, '#a16207', 0, 19, 0), S(2.2, '#a16207', -4.6, 23.6, 0), S(2.2, '#a16207', 4.6, 23.6, 0), S(2, '#fde68a', 0, 18.2, 5), S(3, '#a16207', -7, 12, 2), S(3, '#a16207', 7, 12, 2)] },
    blocks: { r0: 6, b: () => [B(5, 5, 5, '#ef4444', -2.6, 0, 0), B(5, 5, 5, '#2563eb', 2.6, 0, 0), B(5, 5, 5, '#facc15', 0, 0, 5)] },
    slipper: { r0: 8, b: () => [B(14, 2.4, 6, 'P', 0, 0, 0), B(6, 3, 6.4, 'P', 3, 0, 2)] },
    cat: { r0: 16, b: () => [B(20, 9, 9, 'P', 0, 0, 6), B(9, 8, 8, 'P', 13, 0, 11), K(2, 4, 'P', 13, 2.6, 19, 4), K(2, 4, 'P', 13, -2.6, 19, 4), B(1.4, 1.4, 12, 'P', -12, 0, 13, .5), ...[[7, 3], [7, -3], [-7, 3], [-7, -3]].map(([x, z]) => B(2, 6, 2, 'P', x, z, 0)), S(1, '#22c55e', 17.6, 14.6, 2), S(1, '#22c55e', 17.6, 14.6, -2)] },
    pet: { r0: 22, b: () => [B(28, 12, 12, 'P', 0, 0, 8), B(12, 11, 11, 'P', 18, 0, 14), B(6, 5, 7, '#1f2937', 25, 0, 16), B(3, 6, 3, 'P', 14, 5, 23), B(3, 6, 3, 'P', 14, -5, 23), B(2, 2, 10, 'P', -16, 0, 17, .7), ...[[10, 4], [10, -4], [-10, 4], [-10, -4]].map(([x, z]) => B(3, 8, 3, 'P', x, z, 0))] },
  };
  function house(roof) {
    return [B(40, 22, 36, 'P', 0, 0, 0), K(31, 17, roof, 0, 0, 22, 4, Math.PI / 4), B(5, 12, 5, '#57534e', 10, -8, 26), B(7, 12, .8, '#78350f', 0, 18.2, 0), ...[-12, 12].map(x => B(7, 6, .8, '#bfdbfe', x, 18.2, 9)), ...[-8, 8].map(z => B(.8, 6, 7, '#bfdbfe', 20.2, z, 9))];
  }
  const _geoCache = {};
  function tplGeo(k) {
    if (_geoCache[k]) return _geoCache[k];
    const g = merge(TPL[k].b());
    let top = 0; ['base', 'paint'].forEach(p => { if (g[p]) { g[p].computeBoundingBox(); top = Math.max(top, g[p].boundingBox.max.y); } });
    g.h = top;
    return (_geoCache[k] = g);
  }

  /* ════════════════════════════════════════════════════════════════
     MUNDOS — grelha NB×NB de quarteirões (BS) separados por ruas (RD).
     Cada cenário diz o tipo de cada célula; as células "zona" (mar,
     areal, pistas, campos…) não têm ruas à volta: fundem-se com as
     vizinhas e tapam a rua que haveria entre elas.
  ════════════════════════════════════════════════════════════════ */
  const BS = 260, RD = 64, CELL = BS + RD;
  function add(G, k, x, y, r, extra) {
    const o = Object.assign({ k, x, y, r, a: Math.random() * TAU, sy: 1, y3: 0 }, extra || {});
    o.id = G.objs.length; G.objs.push(o);
    if (G.occ && r >= 16 && !o.mv) G.occ.push([x, y, r]);            /* ocupa espaço: o resto não se põe em cima */
    return o;
  }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const PAINT = {
    person: ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f8fafc', '#0f172a'],
    crew: ['#f97316', '#facc15', '#f97316', '#1e3a8a', '#f8fafc'],
    car: ['#ef4444', '#2563eb', '#f8fafc', '#111827', '#16a34a', '#f59e0b', '#94a3b8', '#7c3aed'],
    house: ['#fef3c7', '#f5f5f4', '#bfdbfe', '#fecaca', '#d9f99d', '#fde68a'],
    vhouse: ['#fafaf9', '#fafaf9', '#fef3c7', '#fde68a', '#fed7aa', '#e0f2fe'],
    tree: ['#15803d', '#16a34a', '#166534', '#4d7c0f', '#65a30d'],
    bldg: ['#93c5fd', '#a5b4fc', '#cbd5e1', '#99f6e4', '#fcd34d', '#fca5a5', '#e2e8f0'],
    fun: ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'],
    beach: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#a855f7', '#14b8a6', '#facc15', '#f8fafc'],
    air: ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0f172a', '#0891b2'],
    tractor: ['#16a34a', '#dc2626', '#2563eb', '#f59e0b'],
    cow: ['#f8fafc', '#f8fafc', '#a16207', '#78350f'],
    horse: ['#78350f', '#a16207', '#1f2937', '#d6d3d1'],
    dog: ['#a16207', '#f5f5f4', '#1f2937'],
  };
  /* cor do chão de cada tipo de célula */
  const KC = {
    park: '#65a30d', res: '#84cc16', down: '#e7e5e4', office: '#d6d3d1', apart: '#a3e635', shops: '#e7e5e4', plaza: '#fde68a', lot: '#374151', gas: '#6b7280', factory: '#a8a29e', sport: '#16a34a', forest: '#3f6212',
    church: '#d6d3d1', vsquare: '#e7e5e4', vres: '#84cc16', cemetery: '#65a30d', farm: '#a3a35c', field: '#a0793d', pasture: '#6da83a', orchard: '#5b8f2a', pond: '#5f9e3a', mill: '#b08d4a',
    runway: '#6aa84f', apron: '#a8a29e', terminal: '#d6d3d1', ctower: '#d6d3d1', hangar: '#9ca3af', cargo: '#a8a29e', grass: '#6aa84f', fuel: '#a8a29e', helipad: '#9ca3af', ahotel: '#d6d3d1',
    sea: '#1683c7', sand: '#ecd9a4', prom: '#eee6d6', hotel: '#d6d3d1', pool: '#e5e7eb', villa: '#84cc16',
  };

  /* ── disposição de cada cenário ── */
  function centersOf(NB, n) {
    const c = [[(NB - 1) / 2, (NB - 1) / 2]]; let tries = 0;
    while (c.length < n && tries++ < 500) { const p = [Math.round(U.rand(1, NB - 2)), Math.round(U.rand(1, NB - 2))]; if (c.every(q => Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) >= NB / 3.2)) c.push(p); }
    return c;
  }
  /* distância (em quarteirões) ao centro mais perto; os centros secundários contam como um anel mais longe */
  const ringOf = (cs, i, j) => Math.min(...cs.map((q, n) => Math.max(Math.abs(i - q[0]), Math.abs(j - q[1])) + (n ? 1 : 0)));
  function sprinkle(K, NB, k, n, ok) {
    const idx = []; for (let c = 0; c < K.length; c++) if (ok(K[c], (c / NB) | 0, c % NB)) idx.push(c);
    for (let t = 0; t < n && idx.length; t++) K[idx.splice(Math.floor(Math.random() * idx.length), 1)[0]] = k;
  }
  const LAYOUT = {
    city(NB) {
      const cs = centersOf(NB, 1 + Math.floor((NB - 6) / 6)), K = [];
      for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
        const d = ringOf(cs, i, j);
        K.push(d < 1 ? pick(['down', 'down', 'office']) : d < 2 ? pick(['office', 'apart', 'shops', 'plaza', 'park']) : d < 3 ? pick(['apart', 'shops', 'park', 'lot', 'res', 'res'])
          : d < 5 ? pick(['res', 'res', 'res', 'park', 'factory', 'lot']) : pick(['res', 'res', 'forest', 'park', 'factory', 'res']));
      }
      const far = (k, i, j) => ringOf(cs, i, j) >= 1.5;
      sprinkle(K, NB, 'sport', Math.max(1, Math.round(NB * NB / 30)), far);
      sprinkle(K, NB, 'gas', Math.max(1, Math.round(NB * NB / 24)), far);
      return K;
    },
    village(NB) {
      const cs = centersOf(NB, 1 + Math.floor(NB / 9)), K = [];
      for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
        const d = ringOf(cs, i, j);
        K.push(d < 1 ? pick(['vres', 'vres', 'vsquare']) : d < 2 ? pick(['vres', 'vres', 'vres', 'farm', 'orchard']) : d < 3 ? pick(['farm', 'orchard', 'field', 'pasture', 'vres'])
          : pick(['field', 'field', 'pasture', 'pasture', 'forest', 'orchard', 'farm']));
      }
      cs.forEach(([ci, cj]) => { K[Math.round(ci) * NB + Math.round(cj)] = 'church'; });
      const core = (k, i, j) => k === 'vres' && ringOf(cs, i, j) < 2.2;
      sprinkle(K, NB, 'cemetery', cs.length, core);
      sprinkle(K, NB, 'vsquare', 1, core);
      sprinkle(K, NB, 'mill', Math.max(1, Math.round(NB * NB / 22)), k => k === 'field' || k === 'pasture');
      sprinkle(K, NB, 'pond', Math.max(1, Math.round(NB * NB / 30)), (k, i, j) => k !== 'church' && ringOf(cs, i, j) >= 2);
      return K;
    },
    /* pistas numa fila a cada 6; placas de estacionamento dos aviões encostadas; terminais e hangares no meio */
    airport(NB) {
      const K = [];
      for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
        const r = j % 6, edge = i === 0 || i === NB - 1;
        K.push(r === 1 ? 'runway' : r === 0 || r === 2 ? (edge ? 'grass' : pick(['apron', 'apron', 'apron', 'grass']))
          : r === 3 ? pick(['terminal', 'terminal', 'hangar', 'cargo']) : r === 4 ? pick(['lot', 'terminal', 'ahotel', 'fuel', 'grass']) : pick(['hangar', 'cargo', 'grass', 'helipad', 'apron']));
      }
      sprinkle(K, NB, 'ctower', Math.max(1, Math.round(NB / 8)), (k, i, j) => j % 6 === 3 || j % 6 === 4);
      return K;
    },
    /* de cima para baixo: mar, areal, passeio marítimo e a vila */
    beach(NB, G) {
      const sea = Math.max(1, Math.round(NB * .22)), sand = Math.max(1, Math.round(NB * .2)), prom = sea + sand, K = [];
      G.lay = { sea, prom };
      for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
        const t = j - prom;
        K.push(j < sea ? 'sea' : j < prom ? 'sand' : t === 0 ? 'prom' : t <= 2 ? pick(['hotel', 'hotel', 'apart', 'shops', 'pool', 'plaza']) : pick(['villa', 'villa', 'apart', 'park', 'lot', 'shops', 'gas', 'pool', 'res']));
      }
      return K;
    },
  };

  /* há rua neste troço? (vert = rua vertical nº line; seg = fila/coluna ao longo dela) */
  function roadAt(G, vert, line, seg) {
    const NB = G.NB;
    if (G.S.mainRoads && line % 6 === Math.round(NB / 2) % 6) return true;       /* estradas principais da aldeia */
    const a = vert ? [line - 1, seg] : [seg, line - 1], b = vert ? [line, seg] : [seg, line];
    const roaded = ([i, j]) => i < 0 || j < 0 || i >= NB || j >= NB || !G.zone[i * NB + j];
    return roaded(a) && roaded(b);
  }
  /* quanto uma zona se estende por cima da rua que não existe desse lado */
  function spread(G, vert, line, seg, ni, nj) {
    if (roadAt(G, vert, line, seg)) return 0;
    if (ni < 0 || nj < 0 || ni >= G.NB || nj >= G.NB) return RD;
    return G.zone[ni * G.NB + nj] ? RD / 2 : RD - 16;
  }

  function buildWorld(G) {
    const S = G.S, NB = G.NB;
    G.W = G.H = NB * CELL + RD;
    const K = LAYOUT[G.scen](NB, G);
    G.zone = K.map(k => S.zones.includes(k));
    G.blocks = []; G.decals = [];
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const b = { x: RD + i * CELL, y: RD + j * CELL, w: BS, h: BS, kind: K[i * NB + j], i, j, zone: G.zone[i * NB + j] };
      if (b.zone) b.e = [spread(G, true, i, j, i - 1, j), spread(G, false, j, i, i, j - 1), spread(G, true, i + 1, j, i + 1, j), spread(G, false, j + 1, i, i, j + 1)];
      G.blocks.push(b);
    }
    G.blocks.forEach(b => { fillCell(G, b); if (!b.zone) sidewalk(G, b); });
    if (G.scen === 'airport') runways(G);
    if (G.scen === 'beach') { const yl = G.lay.sea * CELL + RD / 2; G.decals.push(['r', -4000, yl - 4, G.W + 4000, yl + 3, '#e0f2fe', .62], ['r', -4000, yl + 3, G.W + 4000, yl + 14, '#d9c48c', .62]); }
    traffic(G);
    G.startR = S.startR;
  }

  /* ── passeios: candeeiros, papeleiras, semáforos, peões ── */
  const MISC = {
    city: [['bin', 3], ['hydrant', 3], ['mailbox', 3], ['bin', 3]],
    village: [['bin', 3], ['flower', 7], ['bench', 6], ['bush', 6, PAINT.tree]],
    airport: [['cone', 2.5], ['cone', 2.5], ['suitcase', 3, PAINT.fun]],
    beach: [['bin', 3], ['bench', 6], ['flower', 7], ['bike', 5, PAINT.fun]],
  };
  function sidewalk(G, b) {
    const { x, y } = b, f = G.S.furn;
    for (let side = 0; side < 4; side++) {
      const spots = f === 'airport' ? [[.15, 'elight'], [.5, 'elight'], [.85, 'elight'], [.32, 'misc']] : [[.5, 'lamp'], [.22, 'misc']];
      spots.forEach(([u, k]) => {
        if (k === 'misc' && Math.random() < (f === 'city' ? .45 : .6)) return;
        if (k === 'lamp' && f === 'village' && Math.random() < .5) return;
        const px = side < 2 ? x + u * BS : (side === 2 ? x - 8 : x + BS + 8), py = side < 2 ? (side === 0 ? y - 8 : y + BS + 8) : y + u * BS;
        const a = side < 2 ? (side === 0 ? Math.PI / 2 : -Math.PI / 2) : (side === 2 ? Math.PI : 0);
        if (k === 'misc') { const m = pick(MISC[f]); add(G, m[0], px, py, m[1], { a, paint: pick(m[2] || PAINT.fun) }); }
        else add(G, k, px, py, k === 'lamp' ? 2.5 : 1.5, { a, paint: '#60a5fa' });
      });
    }
    if (f === 'city') {
      [[x - 8, y - 8], [x + BS + 8, y - 8], [x - 8, y + BS + 8], [x + BS + 8, y + BS + 8]].forEach(([px, py], n) => { if ((b.i + b.j + n) % 2 === 0) add(G, 'traffic', px, py, 2.5, { a: n * Math.PI / 2 }); });
      if (Math.random() < .3 && roadAt(G, false, b.j, b.i)) add(G, 'busStop', x + BS / 2, y - 20, 11, { a: 0 });
    }
    /* peões a circular no passeio à volta do quarteirão */
    for (let t = 0; t < G.S.walkers; t++) add(G, 'person', x, y, 3.5, { mv: 'walk', blk: b, u: Math.random(), dir: Math.random() < .5 ? 1 : -1, v: U.rand(12, 20), paint: pick(f === 'airport' ? PAINT.crew : PAINT.person) });
  }

  /* ── trânsito: em cada troço contínuo de rua, nos dois sentidos; no fim dá a volta ── */
  function traffic(G) {
    const S = G.S, NB = G.NB, tot = S.traffic.reduce((a, t) => a + t[1], 0);
    const kindOf = () => { let r = Math.random() * tot; for (const t of S.traffic) if ((r -= t[1]) <= 0) return t; return S.traffic[0]; };
    const run = (vert, line, a, b) => {
      const c = line * CELL + RD / 2, lo = a * CELL + RD / 2, hi = (b + 1) * CELL + RD / 2, n = Math.round((b - a + 1) * S.density + Math.random() * .8);
      for (let t = 0; t < n; t++) {
        const [k, , r] = kindOf(), dir = t % 2 ? 1 : -1, v = U.rand(55, 90) * (k === 'tractor' || k === 'bike' ? .45 : k === 'jet' ? .4 : 1), p = U.rand(lo, hi);
        const o = { mv: 'car', ax: vert ? 'y' : 'x', dir, v, lo, hi, c, lane: 14, paint: pick(k === 'tractor' ? PAINT.tractor : k === 'jet' ? PAINT.air : k === 'bike' ? PAINT.fun : PAINT.car) };
        if (vert) add(G, k, c - dir * 14, p, r, Object.assign(o, { a: dir > 0 ? -Math.PI / 2 : Math.PI / 2 }));
        else add(G, k, p, c + dir * 14, r, Object.assign(o, { a: dir > 0 ? 0 : Math.PI }));
      }
    };
    for (const vert of [false, true]) for (let line = 0; line <= NB; line++) {
      let s0 = -1;
      for (let seg = 0; seg <= NB; seg++) {
        const ok = seg < NB && roadAt(G, vert, line, seg);
        if (ok && s0 < 0) s0 = seg;
        if (!ok && s0 >= 0) { run(vert, line, s0, seg - 1); s0 = -1; }
      }
    }
  }

  /* ── aeroporto: pistas pintadas, luzes e aviões a rolar ── */
  function runways(G) {
    for (let j = 1; j < G.NB; j += 6) {
      const cy = RD + j * CELL + BS / 2, x0 = 40, x1 = G.W - 40, D = G.decals;
      D.push(['r', x0, cy - 62, x1, cy + 62, '#34343a', .6], ['r', x0, cy - 56, x1, cy - 54, '#f8fafc', .66], ['r', x0, cy + 54, x1, cy + 56, '#f8fafc', .66]);
      for (let x = x0 + 120; x < x1 - 120; x += 64) D.push(['r', x, cy - 1.5, x + 34, cy + 1.5, '#f8fafc', .66]);
      [x0 + 12, x1 - 60].forEach(tx => { for (let k = -5; k <= 5; k++) if (k) D.push(['r', tx, cy + k * 9 - 3, tx + 48, cy + k * 9 + 3, '#f8fafc', .66]); });
      for (let x = x0 + 10; x < x1; x += 52) { add(G, 'elight', x, cy - 68, 1.5, { paint: '#fde047' }); add(G, 'elight', x, cy + 68, 1.5, { paint: '#fde047' }); }
      const n = Math.max(1, Math.round(G.NB / 6));
      for (let t = 0; t < n; t++) {
        const big = Math.random() < .6, dir = t % 2 ? 1 : -1;
        add(G, big ? 'airliner' : 'jet', U.rand(x0 + 200, x1 - 200), cy, big ? U.rand(62, 70) : 28, { mv: 'car', ax: 'x', dir, v: U.rand(70, 120), lo: x0 + 90, hi: x1 - 90, c: cy, lane: 0, a: dir > 0 ? 0 : Math.PI, paint: pick(PAINT.air) });
      }
    }
  }

  function fillCell(G, b) {
    const { x, y } = b, W = BS, R = (a, bb) => U.rand(a, bb);
    G.occ = [];
    const at = (u, v) => [x + u * W, y + v * W];
    const put = (k, u, v, r, extra) => add(G, k, x + u * W, y + v * W, r, extra);
    const free = (px, py, r) => G.occ.every(q => Math.hypot(px - q[0], py - q[1]) > q[2] + r);
    const val = (v, ...a) => (typeof v === 'function' ? v(...a) : v);
    const scatter = (k, n, r, pad, extra) => {
      for (let i = 0; i < n; i++) {
        const rr = val(r); let px, py, t = 0;
        do { px = x + R(pad, W - pad); py = y + R(pad, W - pad); } while (t++ < 12 && !free(px, py, rr));
        add(G, val(k), px, py, rr, val(extra));
      }
    };
    const grid = (k, nx, ny, r, pad, extra, jit) => {
      for (let a = 0; a < nx; a++) for (let c = 0; c < ny; c++) {
        const px = x + pad + (W - 2 * pad) * (nx > 1 ? a / (nx - 1) : .5) + R(-(jit || 0), jit || 0), py = y + pad + (W - 2 * pad) * (ny > 1 ? c / (ny - 1) : .5) + R(-(jit || 0), jit || 0);
        const rr = val(r); if (free(px, py, rr * .6)) add(G, val(k, a, c), px, py, rr, val(extra, a, c));
      }
    };
    const walkers = (k, n, r, paint, wsp, extra) => scatter(k, n, r, 12, () => Object.assign({ mv: 'wander', blk: b, wsp, paint: pick(paint) }, extra || {}));
    const people = n => walkers('person', n, 3.5, PAINT.person, 14);
    const trees = n => scatter(Math.random() < .5 ? 'treeR' : 'pine', n, () => R(9, 13), 14, () => ({ paint: pick(PAINT.tree) }));
    const rect = (x0, y0, x1, y1, c, yy) => G.decals.push(['r', x0, y0, x1, y1, c, yy || .7]);
    const disc = (cx, cy, r, c, yy) => G.decals.push(['d', cx, cy, r, c, yy || .7, 32]);
    const fenceRing = () => { for (let s = 18; s < W - 10; s += 18) [[x + s, y + 6, 0], [x + s, y + W - 6, 0], [x + 6, y + s, Math.PI / 2], [x + W - 6, y + s, Math.PI / 2]].forEach(([px, py, a]) => add(G, 'fence', px, py, 8, { a })); };
    const forest = () => { trees(16); trees(14); scatter('bush', 6, 6, 12, () => ({ paint: pick(PAINT.tree) })); scatter('rock', 4, () => R(5, 8), 16); scatter('shroom', 8, 1.5, 12); walkers('deer', 3, 7, ['#a16207'], 12); };
    switch (b.kind) {
      /* ─── cidade ─── */
      case 'down': {
        put('tower', .5, .5, R(56, 64), { sy: R(.85, 1.25), paint: pick(PAINT.bldg), a: 0 });
        [[.14, .14], [.86, .14], [.14, .86], [.86, .86]].forEach(([u, v]) => put(pick(['flower', 'bench', 'bush']), u, v, 7, { a: 0, paint: pick(PAINT.tree) }));
        people(12); scatter('bollard', 6, 1.8, 20); put('billboard', .5, .92, 16, { a: 0, paint: pick(PAINT.fun) });
        break;
      }
      case 'office': [[.3, .3], [.7, .7]].forEach(([u, v]) => put('office', u, v, R(44, 50), { sy: R(.7, 1.2), paint: pick(PAINT.bldg), a: 0 })); trees(6); people(10); scatter('bench', 3, 6, 20); break;
      case 'apart': [[.28, .28], [.72, .28], [.28, .72], [.72, .72]].forEach(([u, v]) => { if (Math.random() < .85) put('apart', u, v, R(36, 42), { sy: R(.7, 1.3), paint: pick(PAINT.house), a: 0 }); }); trees(5); people(8); scatter('car', 3, 11, 20, () => ({ paint: pick(PAINT.car) })); break;
      case 'res': case 'villa': {
        const villa = b.kind === 'villa';
        [[.25, .25], [.75, .25], [.25, .75], [.75, .75]].forEach(([u, v]) => {
          const [hx, hy] = at(u, v);
          add(G, pick(['houseA', 'houseB', 'houseC']), hx, hy, R(26, 31), { a: pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), paint: villa ? pick(['#fafaf9', '#fef3c7', '#f5f5f4']) : pick(PAINT.house) });
          add(G, 'mailbox', hx + 34, hy + 34, 3, { a: 0 });
          if (Math.random() < .6) add(G, 'car', hx - 36, hy + 30, 11, { a: Math.PI / 2, paint: pick(PAINT.car) });
          if (villa) add(G, 'palm', hx + 36, hy - 34, 10, { paint: pick(PAINT.tree) });
          else if (Math.random() < .5) add(G, 'fence', hx, hy + 48, 8, { a: 0 });
        });
        if (villa) { put('pool', .5, .5, 18, { a: 0 }); scatter('lounger', 3, 7, 30, () => ({ paint: pick(PAINT.beach) })); } else trees(10);
        scatter('bush', 6, 6, 12, () => ({ paint: pick(PAINT.tree) })); people(5);
        walkers('dog', 2, 3, PAINT.dog, 14);
        scatter('bike', 2, 5, 16, () => ({ paint: pick(PAINT.fun) }));
        break;
      }
      case 'park': {
        const [cx, cy] = at(.5, .5);
        rect(cx - 10, y, cx + 10, y + W, '#d6b48a'); rect(x, cy - 10, x + W, cy + 10, '#d6b48a');
        put(Math.random() < .6 ? 'fountain' : 'statue', .5, .5, 26, { a: 0 });
        trees(18); scatter('bench', 6, 6, 20); scatter('flower', 4, 7, 20); scatter('lamp', 4, 2.5, 20);
        put('slide', .2, .8, 16, { paint: pick(PAINT.fun) }); people(16);
        walkers('dog', 3, 3, PAINT.dog, 14);
        break;
      }
      case 'plaza': put('statue', .5, .5, 14, { a: 0 }); scatter('parasol', 8, 8, 24, () => ({ paint: pick(PAINT.fun) })); scatter('cart', 3, 9, 30, () => ({ paint: pick(PAINT.fun) })); scatter('flower', 5, 7, 20); people(22); scatter('bench', 4, 6, 20); break;
      case 'shops':
        [.2, .5, .8].forEach(u => add(G, 'shop', x + u * W, y + 40, R(26, 29), { a: 0, paint: pick(PAINT.house) }));
        [.2, .5, .8].forEach(u => add(G, 'shop', x + u * W, y + W - 40, R(26, 29), { a: Math.PI, paint: pick(PAINT.house) }));
        put('kiosk', .5, .5, 11, { paint: pick(PAINT.fun) }); scatter('cart', 2, 9, 60, () => ({ paint: pick(PAINT.fun) })); people(18); scatter('bin', 3, 3, 20);
        break;
      case 'lot':
        for (let a = 0; a < 3; a++) for (let c = 0; c <= 5; c++) rect(x + 13 + c * 47, y + 28 + a * 80, x + 15 + c * 47, y + 72 + a * 80, '#f8fafc');
        for (let a = 0; a < 3; a++) for (let c = 0; c < 5; c++) if (Math.random() < .72) add(G, Math.random() < .12 ? 'van' : 'car', x + 36 + c * 47, y + 50 + a * 80, Math.random() < .12 ? 13 : 11, { a: Math.PI / 2, paint: pick(PAINT.car) });
        scatter('cone', 6, 2.5, 12); people(3); break;
      case 'gas': put('gas', .5, .45, 36, { a: 0 }); scatter('car', 3, 11, 30, () => ({ paint: pick(PAINT.car) })); put('billboard', .8, .85, 16, { a: 0, paint: pick(PAINT.fun) }); trees(4); scatter('cone', 4, 2.5, 20); break;
      case 'factory': put('factory', .35, .35, 55, { a: 0 }); put('waterTower', .8, .2, 20, { paint: '#94a3b8' }); put('crane', .78, .72, 30, { a: 0 }); scatter('container', 5, 16, 30, () => ({ paint: pick(['#dc2626', '#2563eb', '#16a34a', '#f59e0b']), a: pick([0, Math.PI / 2]) })); scatter('cone', 8, 2.5, 14); people(4); break;
      case 'sport': {
        const [cx, cy] = at(.5, .5);
        rect(x + 18, y + 50, x + W - 18, y + W - 50, '#22c55e'); rect(cx - 1, y + 50, cx + 1, y + W - 50, '#f8fafc', .9);
        add(G, 'goal', cx - 100, cy, 10, { a: 0 }); add(G, 'goal', cx + 100, cy, 10, { a: Math.PI });
        add(G, 'bleacher', cx, y + 22, 26, { a: 0 }); add(G, 'bleacher', cx, y + W - 22, 26, { a: Math.PI });
        walkers('person', 16, 3.5, ['#ef4444', '#2563eb'], 14);
        add(G, 'ball', cx, cy, 3, { paint: '#f8fafc' });
        break;
      }
      case 'forest': forest(); break;
      /* ─── aldeia ─── */
      case 'church':
        put('church', .5, .42, 58, { a: 0 }); put('statue', .5, .9, 12, { a: 0 });
        scatter('cypress', 6, 5, 16); scatter('bench', 4, 6, 20); scatter('flower', 4, 7, 20); scatter('lamp', 3, 2.5, 20); people(10);
        break;
      case 'vsquare':
        rect(x + 20, y + 20, x + W - 20, y + W - 20, '#d6d3d1');
        put('fountain', .5, .5, 24, { a: 0 }); scatter('cafe', 7, 7, 30, () => ({ paint: pick(PAINT.fun) })); scatter('parasol', 3, 8, 30, () => ({ paint: pick(PAINT.fun) }));
        scatter('bench', 4, 6, 20); scatter('flower', 5, 7, 20); scatter('lamp', 4, 2.5, 20); put('cart', .8, .8, 9, { paint: pick(PAINT.fun) }); people(18); walkers('dog', 2, 3, PAINT.dog, 14);
        break;
      case 'vres':
        [.2, .5, .8].forEach(u => add(G, pick(['vhouse', 'vhouse', 'vhouse2']), x + u * W, y + .17 * W, R(24, 27), { a: Math.PI, paint: pick(PAINT.vhouse) }));
        [.2, .5, .8].forEach(u => add(G, pick(['vhouse', 'vhouse', 'vhouse2']), x + u * W, y + .83 * W, R(24, 27), { a: 0, paint: pick(PAINT.vhouse) }));
        scatter('veg', 10, 3, 60); scatter(() => pick(['fruitTree', 'fruitTree', 'treeR']), 4, 10, 40, () => ({ paint: pick(PAINT.tree) }));
        walkers('chicken', 6, 2.2, ['#f8fafc', '#b45309', '#fde68a'], 10);
        scatter('well', 1, 7, 70); scatter('woodpile', 1, 6, 60); scatter('bush', 4, 6, 20, () => ({ paint: pick(PAINT.tree) })); scatter('flower', 3, 7, 30);
        if (Math.random() < .5) scatter('car', 1, 11, 60, () => ({ paint: pick(PAINT.car) })); else scatter('tractor', 1, 12, 60, () => ({ paint: pick(PAINT.tractor) }));
        walkers('cat', 1, 2.4, ['#f59e0b', '#6b7280', '#f8fafc', '#1f2937'], 16); people(4);
        break;
      case 'farm':
        put('barn', .3, .3, 44, { a: 0 }); put('silo', .64, .18, 13, { a: 0 }); put('silo', .8, .18, 12, { a: 0 }); put('vhouse', .75, .72, 26, { a: 0, paint: pick(PAINT.vhouse) });
        put('tractor', .5, .62, 12, { a: R(0, TAU), paint: pick(PAINT.tractor) });
        scatter('hay', 6, 6, 20); scatter('haystack', 2, 9, 30); scatter('woodpile', 1, 6, 30); scatter('well', 1, 7, 30);
        walkers('pig', 4, 5, ['#f9a8d4'], 8); walkers('chicken', 8, 2.2, ['#f8fafc', '#b45309', '#fde68a'], 10); walkers('cow', 2, 10, PAINT.cow, 5); people(3);
        break;
      case 'field': case 'mill': {
        const crop = Math.random() < .5 ? 'wheat' : 'corn', mill = b.kind === 'mill';
        if (mill) { G.occ.push([x + W / 2, y + W / 2, 30]); put('windmill', .5, .5, 22, { a: pick([0, Math.PI / 2, Math.PI]) }); }
        else { G.occ.push([x + W / 2, y + W / 2, 8]); put('scarecrow', .5, .5, 5, { a: 0 }); }
        grid(crop, 6, 6, 9, 26, null, 3);
        scatter('hay', 4, 6, 16); scatter('pumpkin', 4, 3.5, 14); walkers('gull', 2, 1.6, ['#f8fafc'], 8);
        break;
      }
      case 'pasture':
        fenceRing(); walkers('cow', 5, 10, PAINT.cow, 5); walkers('sheep', 10, 5, ['#f5f5f4'], 7); walkers('horse', 2, 11, PAINT.horse, 8);
        trees(2); scatter('hay', 2, 6, 30); scatter('haystack', 1, 9, 40);
        break;
      case 'orchard':
        grid('fruitTree', 5, 5, 10, 28, () => ({ paint: pick(PAINT.tree) }), 4);
        scatter('basket', 4, 3, 20); scatter('pumpkin', 3, 3.5, 20); people(2); walkers('chicken', 3, 2.2, ['#f8fafc', '#b45309'], 10);
        break;
      case 'pond': {
        const [cx, cy] = at(.5, .5);
        disc(cx, cy, 96, '#a3a35c', .65); disc(cx, cy, 86, '#2563eb', .7); disc(cx, cy, 60, '#1d4ed8', .72);
        G.occ.push([cx, cy, 86]);
        for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + R(0, .4); add(G, 'reeds', cx + Math.cos(a) * 90, cy + Math.sin(a) * 90, 4); }
        for (let k = 0; k < 7; k++) { const a = R(0, TAU), d = R(10, 60); add(G, 'duck', cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.8, { mv: 'wander', wsp: 8, pond: [cx, cy, 70] }); }
        add(G, 'boat', cx + 20, cy - 20, 9, { paint: '#a16207', mv: 'boat', wsp: 3, pond: [cx, cy, 60] });
        trees(6); scatter('bench', 2, 6, 14);
        break;
      }
      case 'cemetery':
        grid(() => pick(['tomb', 'tomb', 'tombX']), 6, 5, 3, 40, { a: 0 }, 2);
        for (let k = 0; k < 8; k++) add(G, 'cypress', x + 14 + k * 33, y + 14, 5); scatter('flower', 4, 7, 20); scatter('bench', 1, 6, 20); people(2);
        break;
      /* ─── aeroporto ─── */
      case 'runway': {                                                   /* a pista é pintada em runways(); aqui só a relva à volta */
        const band = () => y + (Math.random() < .5 ? R(10, 52) : R(W - 52, W - 10));
        for (let k = 0; k < 5; k++) add(G, pick(['bush', 'bush', 'rock']), x + R(10, W - 10), band(), R(5, 7), { paint: pick(PAINT.tree) });
        if (Math.random() < .35) add(G, 'windsock', x + R(30, W - 30), band(), 3, { a: 0 });
        if (Math.random() < .2) add(G, 'radar', x + R(30, W - 30), band(), 10, { a: R(0, TAU) });
        for (let k = 0; k < 3; k++) add(G, 'gull', x + R(10, W - 10), band(), 1.6, { mv: 'wander', blk: b, wsp: 8 });
        break;
      }
      case 'grass':
        if (Math.random() < .6) put('windsock', R(.2, .8), R(.2, .8), 3, { a: 0 });
        if (Math.random() < .4) put('radar', .5, .5, 10, { a: R(0, TAU) });
        scatter('bush', 5, 6, 20, () => ({ paint: pick(PAINT.tree) })); scatter('rock', 2, 6, 20); walkers('gull', 3, 1.6, ['#f8fafc'], 8);
        break;
      case 'apron': {
        const ya = pick([Math.PI / 2, -Math.PI / 2]);
        rect(x + 128, y + 10, x + 132, y + W - 10, '#facc15');
        put('airliner', .5, .5, R(62, 70), { a: ya, paint: pick(PAINT.air) });
        put('stairs', .66, .38, 12, { a: Math.PI, paint: '#f8fafc' }); put('fueltruck', .28, .62, 16, { a: Math.PI / 2, paint: pick(['#dc2626', '#16a34a']) });
        scatter('bagcart', 2, 12, 24, () => ({ a: pick([0, Math.PI]) })); scatter('gpu', 2, 4, 20); scatter('cone', 6, 2.5, 16); scatter('suitcase', 8, 3, 16, () => ({ paint: pick(PAINT.fun) }));
        walkers('person', 4, 3.5, PAINT.crew, 12);
        break;
      }
      case 'terminal':
        put('terminal', .5, .45, R(96, 100), { a: 0 });
        scatter('taxi', 3, 11, 20, () => ({ a: 0, paint: '#facc15' })); scatter('bench', 3, 6, 16); scatter('lamp', 3, 2.5, 16);
        walkers('person', 18, 3.5, PAINT.person, 12); scatter('suitcase', 8, 3, 16, () => ({ paint: pick(PAINT.fun) }));
        break;
      case 'ctower':
        put('ctower', .5, .45, 26, { a: 0 }); put('radar', .18, .2, 10, { a: R(0, TAU) }); put('windsock', .82, .18, 3, { a: 0 });
        scatter('car', 5, 11, 20, () => ({ paint: pick(PAINT.car), a: Math.PI / 2 })); scatter('bush', 4, 6, 14, () => ({ paint: pick(PAINT.tree) })); people(4);
        break;
      case 'hangar':
        put('hangar', .5, .38, R(56, 60), { a: 0 });
        put('propPlane', .22, .82, 16, { a: R(0, TAU), paint: pick(PAINT.air) }); put('propPlane', .5, .86, 15, { a: R(0, TAU), paint: pick(PAINT.air) });
        put(Math.random() < .5 ? 'jet' : 'heli', .8, .8, Math.random() < .5 ? 28 : 16, { a: R(0, TAU), paint: pick(PAINT.air) });
        scatter('forklift', 2, 7, 16, () => ({ a: R(0, TAU) })); scatter('box', 6, 5, 16); scatter('cone', 4, 2.5, 16); walkers('person', 3, 3.5, PAINT.crew, 12);
        break;
      case 'cargo':
        grid('container', 3, 3, 16, 50, () => ({ paint: pick(['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#64748b']), a: 0 }), 4);
        scatter('forklift', 3, 7, 16, () => ({ a: R(0, TAU) })); scatter('truck', 2, 17, 20, () => ({ paint: pick(PAINT.car), a: pick([0, Math.PI / 2]) })); scatter('box', 8, 5, 12); walkers('person', 3, 3.5, PAINT.crew, 12);
        break;
      case 'fuel':
        [[.3, .3], [.7, .3], [.3, .72]].forEach(([u, v]) => put('tank', u, v, R(21, 24), { a: 0 }));
        put('fueltruck', .72, .72, 16, { a: 0, paint: '#dc2626' }); scatter('cone', 6, 2.5, 14); people(2);
        break;
      case 'helipad':
        [[.3, .5], [.72, .5]].forEach(([u, v]) => { const [cx, cy] = at(u, v); disc(cx, cy, 44, '#475569'); disc(cx, cy, 38, '#f8fafc', .72); disc(cx, cy, 35, '#475569', .74); rect(cx - 14, cy - 16, cx - 9, cy + 16, '#f8fafc', .76); rect(cx + 9, cy - 16, cx + 14, cy + 16, '#f8fafc', .76); rect(cx - 9, cy - 2.5, cx + 9, cy + 2.5, '#f8fafc', .76); G.occ.push([cx, cy, 40]); });
        put('heli', .3, .5, 16, { a: R(0, TAU), paint: pick(PAINT.air) }); if (Math.random() < .6) put('heli', .72, .5, 16, { a: R(0, TAU), paint: pick(PAINT.air) });
        put('windsock', .5, .12, 3, { a: 0 }); scatter('cone', 4, 2.5, 14); people(2);
        break;
      case 'ahotel':
        put('hotel', .5, .4, R(46, 50), { a: 0, sy: R(.6, .8), paint: pick(PAINT.bldg) }); scatter('car', 5, 11, 20, () => ({ paint: pick(PAINT.car), a: Math.PI / 2 })); trees(4); people(8); scatter('suitcase', 4, 3, 16, () => ({ paint: pick(PAINT.fun) }));
        break;
      /* ─── praia ─── */
      case 'sea': {
        const shallow = b.j === G.lay.sea - 1;
        for (let k = 0; k < 7; k++) { const wx = x + R(0, W - 60), wy = y + R(10, W - 10); rect(wx, wy, wx + R(30, 70), wy + 2.2, '#4fb3e8', .6); }
        if (shallow) {
          if (b.i === G.NB - 1) put('lighthouse', .7, .78, 16, { a: 0 });
          else if (b.i % 3 === 1) { G.occ.push([x + W / 2, y + W * .7, 40]); put('pier', .5, .72, 44, { a: 0 }); }
          walkers('person', 8, 3.5, PAINT.person, 5, { by: -6 }); walkers('ring', 4, 3, PAINT.beach, 4);
          grid('buoy', 5, 1, 2, 30, null, 0);
          walkers('jetski', 2, 5, PAINT.beach, 40, { mv: 'boat' }); walkers('boat', 1, 9, PAINT.beach, 8, { mv: 'boat' });
        } else {
          walkers('sailboat', 2, () => R(14, 16), PAINT.beach, 10, { mv: 'boat' }); if (Math.random() < .6) walkers('yacht', 1, () => R(28, 32), ['#f8fafc'], 8, { mv: 'boat' });
          walkers('boat', 2, 9, PAINT.beach, 8, { mv: 'boat' }); walkers('jetski', 1, 5, PAINT.beach, 40, { mv: 'boat' }); scatter('buoy', 2, 2, 20);
        }
        break;
      }
      case 'sand': {
        const nearSea = b.j === G.lay.sea, nearProm = b.j === G.lay.prom - 1;
        if (nearSea && b.i % 3 === 1) put('lifeguard', .5, .12, 13, { a: 0 });
        if (nearProm) [.14, .38, .62, .86].forEach(u => add(G, 'hut', x + u * W, y + W - 22, 10, { a: 0, paint: pick(PAINT.beach) }));
        for (let a = 0; a < 4; a++) for (let c = 0; c < 3; c++) {
          const px = x + 32 + a * 64 + R(-6, 6), py = y + (nearSea ? 70 : 40) + c * (nearProm ? 52 : 70) + R(-6, 6);
          if (Math.random() < .15) continue;
          add(G, 'parasol', px, py, 8, { paint: pick(PAINT.beach) });
          add(G, Math.random() < .5 ? 'towel' : 'lounger', px + 14, py + 4, Math.random() < .5 ? 5 : 7, { a: pick([0, Math.PI]), paint: pick(PAINT.beach) });
        }
        walkers('person', 10, 3.5, PAINT.person, 6); scatter('sandcastle', 2, 6, 20); scatter('bucket', 3, 2.2, 20, () => ({ paint: pick(PAINT.beach) })); scatter('ball', 2, 3, 20, () => ({ paint: pick(PAINT.beach) }));
        scatter('surfboard', 2, 10, 20, () => ({ paint: pick(PAINT.beach) })); walkers('crab', 3, 1.6, ['#ef4444'], 6); walkers('gull', 4, 1.6, ['#f8fafc'], 9);
        if (Math.random() < .35) put('volley', R(.3, .7), R(.3, .7), 10, { a: 0 });
        if (Math.random() < .35) put('cart', R(.2, .8), .5, 9, { paint: pick(PAINT.fun) });
        break;
      }
      case 'prom':
        rect(x, y + W / 2 - 14, x + W, y + W / 2 + 14, '#d9a38a');
        for (let k = 0; k < 6; k++) { add(G, 'palm', x + 22 + k * 43, y + W / 2 - 30, 10, { paint: pick(PAINT.tree) }); }
        scatter('bench', 4, 6, 20); put('kiosk', .3, .8, 11, { paint: pick(PAINT.beach) }); scatter('cafe', 4, 7, 20, () => ({ paint: pick(PAINT.beach) })); scatter('bike', 3, 5, 16, () => ({ paint: pick(PAINT.fun) }));
        put('cart', .75, .72, 9, { paint: pick(PAINT.fun) }); people(16); walkers('dog', 2, 3, PAINT.dog, 14);
        break;
      case 'hotel':
        put('hotel', .5, .36, R(46, 50), { a: 0, sy: R(.8, 1.15), paint: pick(['#f8fafc', '#fef3c7', '#e0f2fe', '#fce7f3']) });
        put('pool', .5, .82, 26, { a: 0 }); scatter('lounger', 4, 7, 16, () => ({ paint: pick(PAINT.beach) })); scatter('palm', 3, 10, 16, () => ({ paint: pick(PAINT.tree) })); people(6);
        break;
      case 'pool':
        put('pool', .5, .5, 30, { a: 0 }); scatter('lounger', 8, 7, 20, () => ({ paint: pick(PAINT.beach) })); scatter('parasol', 4, 8, 20, () => ({ paint: pick(PAINT.beach) })); scatter('palm', 4, 10, 16, () => ({ paint: pick(PAINT.tree) }));
        put('kiosk', .15, .15, 11, { paint: pick(PAINT.beach) }); people(8);
        break;
    }
  }

  /* ── casa ── */
  const HOUSE = {
    W: 1600, H: 1160,
    rooms: [
      { id: 'sala', name: 'SALA', r: [[0, 0, 900, 600]], floor: 'wood' },
      { id: 'cozinha', name: 'COZINHA', r: [[900, 0, 1600, 500]], floor: 'tile' },
      { id: 'hall', name: 'CORREDOR', r: [[900, 500, 1600, 600], [1180, 600, 1600, 1160]], floor: 'wood2' },
      { id: 'quarto', name: 'QUARTO', r: [[0, 600, 800, 1160]], floor: 'carpet' },
      { id: 'wc', name: 'CASA DE BANHO', r: [[800, 600, 1180, 1160]], floor: 'blue' },
    ],
    /* paredes: [x0,z0,x1,z1] (espessura incluída) */
    walls: [
      [-8, -8, 1608, 6], [-8, 1154, 1608, 1168], [-8, -8, 6, 1168], [1594, -8, 1608, 1168],
      [894, -8, 906, 240], [894, 340, 906, 500], [900, 494, 1080, 506], [1180, 494, 1600, 506],
      [-8, 594, 380, 606], [500, 594, 1000, 606], [1100, 594, 1186, 606],
      [794, 600, 806, 1160], [1174, 600, 1186, 850], [1174, 950, 1186, 1160],
    ],
    doors: [['sala', 'cozinha', 900, 290], ['sala', 'hall', 900, 550], ['cozinha', 'hall', 1130, 500], ['sala', 'quarto', 440, 600], ['hall', 'wc', 1050, 600], ['wc', 'hall', 1180, 900]],
  };
  const roomOf = (x, y) => (HOUSE.rooms.find(rm => rm.r.some(([a, b, c, d]) => x >= a && x < c && y >= b && y < d)) || HOUSE.rooms[0]).id;

  function buildHouse(G) {
    G.W = HOUSE.W; G.H = HOUSE.H;
    const P = (k, x, y, r, a, extra) => add(G, k, x, y, r, Object.assign({ a: a || 0 }, extra || {}));
    P('rug', 360, 330, 1, 0, { deco: true, paint: '#991b1b' });
    P('sofa', 330, 130, 56, 0, { paint: '#475569' }); P('armchair', 640, 200, 26, -.6, { paint: '#64748b' }); P('ctable', 360, 360, 38);
    P('tv', 360, 560, 30, Math.PI); P('shelf', 800, 120, 30, -Math.PI / 2); P('plant', 60, 60, 17); P('plant', 840, 540, 16); P('flamp', 90, 520, 12);
    P('dogbed', 700, 520, 20, 0, { paint: '#2563eb' }); P('basket', 150, 60, 14);
    P('fridge', 1540, 70, 36, -Math.PI / 2); P('stove', 1390, 40, 30, 0); P('counter', 1230, 40, 40, 0); P('dtable', 1200, 290, 40);
    [[1135, 250, Math.PI / 2], [1265, 250, Math.PI / 2], [1135, 330, -Math.PI / 2], [1265, 330, -Math.PI / 2]].forEach(([x, y, a]) => P('chair', x, y, 16, a, { paint: '#a16207' }));
    P('washer', 1540, 420, 22, -Math.PI / 2); P('box', 960, 440, 18, .3);
    P('bed', 250, 860, 64, 0, { paint: '#6366f1' }); P('wardrobe', 660, 650, 52, 0, { paint: '#92400e' }); P('desk', 620, 1100, 34, Math.PI); P('chair', 620, 1060, 16, Math.PI, { paint: '#2563eb' }); P('plant', 60, 1110, 16); P('shelf', 40, 1000, 30, Math.PI / 2);
    P('bath', 1110, 700, 48, 0); P('toilet', 880, 1110, 18, Math.PI); P('sinkB', 1110, 1120, 18, Math.PI); P('basket', 850, 660, 14);
    P('piano', 1470, 1060, 60, Math.PI); P('rack', 1300, 560, 22, 0); P('plant', 1560, 560, 16); P('box', 1300, 700, 18, -.4);
    /* lixo e brinquedos, espalhados pelas divisões */
    const small = [['crumb', 2.5, 220], ['dust', 4, 110], ['coin', 3, 40], ['lego', 4.5, 70], ['keys', 3.5, 8], ['sock', 6.5, 40], ['paper', 5, 40], ['pencil', 5, 24], ['remote', 7, 8], ['toycar', 7.5, 24], ['blocks', 6, 18], ['slipper', 8, 14], ['ball', 8, 10], ['shoe', 9.5, 18], ['book', 10.5, 18], ['cushion', 14, 10], ['teddy', 15, 6], ['box', 18, 5]];
    small.forEach(([k, r, n]) => { for (let i = 0; i < n; i++) { let x, y, tries = 0; do { x = U.rand(20, G.W - 20); y = U.rand(20, G.H - 20); } while (tries++ < 20 && HOUSE.walls.some(w => x > w[0] - r && x < w[2] + r && y > w[1] - r && y < w[3] + r)); P(k, x, y, r * U.rand(.85, 1.15), Math.random() * TAU, { paint: pick(PAINT.fun) }); } });
    P('cat', 500, 900, 16, 0, { mv: 'pet', paint: '#f59e0b' }); P('cat', 1350, 250, 16, 0, { mv: 'pet', paint: '#6b7280' }); P('pet', 700, 380, 22, 0, { mv: 'pet', paint: '#a16207' });
    G.startR = 13;
  }

  /* ════════════════════════════════════════════════════════════════
     PARTIDA
  ════════════════════════════════════════════════════════════════ */
  function newHole(G, name, color, ai) {
    return { name, color, ai, x: U.rand(200, G.W - 200), y: U.rand(200, G.H - 200), R: G.startR, Rv: G.startR, area: Math.PI * G.startR * G.startR, score: 0, eaten: 0, holes: 0, vx: 0, vy: 0, dead: 0, out: false, target: null, think: 0, pulse: 0, stuck: 0 };
  }
  /* lugar livre para (re)nascer: longe dos outros buracos */
  function spawnSpot(G, h) {
    if (G.vac) return pick([[450, 420], [1250, 250], [400, 900], [1400, 850], [990, 850]]);
    let x, y, t = 0;
    do { x = U.rand(200, G.W - 200); y = U.rand(200, G.H - 200); }
    while (t++ < 40 && G.holes.some(o => o !== h && !o.out && U.dist(x, y, o.x, o.y) < (o === G.me ? Math.min(700, G.W * .25) : 300) + o.R));
    return [x, y];
  }

  function setup(api, o) {
    const pm = parseMode(o.mode), S = SCEN[pm.scen], cfg = DIFF[o.diff] || DIFF.medium, M = modeCfg(pm.scen, pm.size, pm.type, o.diff);
    const skin = SKINS.find(s => s.id === store().getPref('skin', 'green')) || SKINS[0];
    const G = { mode: modeId(pm.scen, pm.size, pm.type), scen: pm.scen, S, NB: S.fixed ? 0 : pm.size, type: pm.type, M, vac: !!S.vac, cfg, objs: [], t: 0, time: M.time, time0: M.time,
      joy: null, keys: [0, 0], falls: [], over: false, count: M.rivals ? 3.2 : 0, feed: [], combo: 0, comboT: 0, bestCombo: 0, skin, api, r3: null, fail: null, goneN: 0, wobs: new Set(), holes: [] };
    if (G.vac) buildHouse(G); else buildWorld(G);
    G.occ = null;
    G.total = G.objs.filter(q => !q.deco).length;
    G.movers = G.objs.filter(q => q.mv);
    G.me = newHole(G, 'Tu', skin.c === 'rainbow' ? '#ffffff' : skin.c, false);
    if (G.vac) { G.me.x = 450; G.me.y = 420; } else { const L = Math.round(G.NB / 2); G.me.x = L * CELL + RD / 2; G.me.y = L * CELL + RD / 2 + CELL / 2; }
    G.holes.push(G.me);
    const used = new Set([skin.c]);
    RIVALS.filter(([, c]) => !used.has(c)).slice(0, M.rivals).forEach(([n, c], i) => {
      const h = newHole(G, n, c, true);
      if (G.vac) { const spots = [[1250, 250], [400, 900], [1400, 850], [990, 850], [1450, 120]]; [h.x, h.y] = spots[i % spots.length]; }
      else [h.x, h.y] = spawnSpot(G, h);
      G.holes.push(h);
    });
    G.cam = { x: G.me.x, y: G.me.y, d: 1 };
    hashAll(G);
    if (!G.vac) buildMini(G);
    loadThree().then(() => { try { build3D(G, api); } catch (e) { G.fail = e; console.warn('[buraco] 3D falhou', e); } })
      .catch(e => { G.fail = e; });
    return G;
  }

  /* ── grelha espacial, mantida aos bocadinhos (só muda o que se mexe) ── */
  const bkey = (x, y) => ((x / BUCKET) | 0) * 4096 + ((y / BUCKET) | 0);
  function hashIns(G, o) { const k = bkey(o.x, o.y); o.hk = k; let a = G.hash.get(k); if (!a) G.hash.set(k, a = []); a.push(o); }
  function hashDel(G, o) { const a = G.hash.get(o.hk); if (a) { const i = a.indexOf(o); if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); } } o.hk = null; }
  function hashMove(G, o) { if (o.hk !== null && bkey(o.x, o.y) !== o.hk) { hashDel(G, o); hashIns(G, o); } }
  function hashAll(G) { G.hash = new Map(); for (const o of G.objs) if (!o.deco) hashIns(G, o); else o.hk = null; }
  function near(G, x, y, rad, fn) {
    const x0 = ((x - rad) / BUCKET) | 0, x1 = ((x + rad) / BUCKET) | 0, y0 = ((y - rad) / BUCKET) | 0, y1 = ((y + rad) / BUCKET) | 0;
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const a = G.hash.get(i * 4096 + j); if (a) for (const o of a) fn(o); }
  }
  const canEat = (h, o) => o.r < h.R * .92;
  /* velocidade gradual: começa a ~55% e chega à velocidade normal quando o buraco
     tem ~6× o tamanho inicial; daí para a frente ainda ganha um pouco (até +40%) */
  const speedOf = (G, h) => {
    const g = U.clamp((h.R - G.startR) / (G.startR * 5), 0, 1);
    return (h.ai ? 165 * G.cfg.ai : 185 * G.cfg.spd) * (.55 + .45 * g) * (1 + Math.min(.4, Math.max(0, h.R - G.startR * 6) / 380)) * (G.vac ? .85 : 1 + Math.max(0, G.NB - 8) * .014);
  };
  const alive = G => G.holes.filter(h => !h.out);

  function grow(G, h, gain, api) {
    const before = h.R;
    /* a partir de certo tamanho cresce mais devagar (e há um teto: senão a câmara via o mapa todo) */
    h.area = Math.min(Math.PI * RMAX * RMAX, h.area + gain * (h.R > 100 ? 100 / h.R : 1)); h.R = Math.sqrt(h.area / Math.PI);
    if (!h.ai) {
      const step = G.vac ? 8 : 12, lv = Math.floor((h.R - G.startR) / step);
      if (lv > (G.lvl || 0)) {
        G.lvl = lv; api.banner(G.vac ? 'Potência ' + (lv + 1) : 'Tamanho ' + (lv + 1), lv % 3 === 0 ? 'Cada vez maior!' : '');
        api.sfx.arp([523, 659, 784, 1047], .05, .1, 'triangle', .06); api.vibe(20); h.pulse = 1;
      }
    }
    return before;
  }

  /* navegação na casa: porta seguinte até à divisão do alvo */
  function viaDoor(from, to) {
    if (from === to) return null;
    const q = [[from, null]], seen = new Set([from]);
    while (q.length) {
      const [rm, first] = q.shift();
      for (const d of HOUSE.doors) {
        const nxt = d[0] === rm ? d[1] : d[1] === rm ? d[0] : null;
        if (!nxt || seen.has(nxt)) continue;
        const f = first || d; if (nxt === to) return f;
        seen.add(nxt); q.push([nxt, f]);
      }
    }
    return null;
  }

  function aiThink(G, h) {
    h.think = U.rand(.3, .55);
    let fx = 0, fy = 0, flee = false;
    for (const o of G.holes) {
      if (o === h || o.dead || o.out) continue;
      const d = U.dist(h.x, h.y, o.x, o.y) || 1;
      if (o.R > h.R * 1.15 && d < 200 + o.R) { fx += (h.x - o.x) / d; fy += (h.y - o.y) / d; flee = true; }
    }
    let tgt = null;
    if (flee) tgt = { x: U.clamp(h.x + fx * 260, 60, G.W - 60), y: U.clamp(h.y + fy * 260, 60, G.H - 60) };
    if (!tgt) {
      /* no último de pé, com o tempo a passar, vão à caça de mais longe */
      const hunt = !G.M.respawn && isFinite(G.time0) ? 320 + (1 - G.time / G.time0) * 1400 : 320;
      const prey = G.holes.filter(o => o !== h && !o.dead && !o.out && o.R * 1.2 < h.R && U.dist(h.x, h.y, o.x, o.y) < hunt)[0];
      if (prey) tgt = prey;
    }
    if (!tgt) {
      let best = null, bv = 0;
      near(G, h.x, h.y, 440, o => { if (o.fall || !canEat(h, o)) return; const v = (o.r * o.r) / (U.dist(h.x, h.y, o.x, o.y) + 60); if (v > bv) { bv = v; best = o; } });
      tgt = best ? { x: best.x, y: best.y } : { x: U.clamp(h.x + U.rand(-900, 900), 150, G.W - 150), y: U.clamp(h.y + U.rand(-900, 900), 150, G.H - 150) };
    }
    if (G.vac) {
      const d = viaDoor(roomOf(h.x, h.y), roomOf(tgt.x, tgt.y));
      if (d) tgt = { x: d[2], y: d[3], door: true };
    }
    h.target = tgt;
  }

  function wallPush(G, h) {
    if (!G.vac) return;
    const rr = h.R * .9;
    for (const [a, b, c, d] of HOUSE.walls) {
      const cx = U.clamp(h.x, a, c), cy = U.clamp(h.y, b, d), dx = h.x - cx, dy = h.y - cy, dd = Math.hypot(dx, dy);
      if (dd < rr) {
        if (dd > .001) { h.x = cx + dx / dd * rr; h.y = cy + dy / dd * rr; }
        else { /* centro dentro da parede: sai pelo lado mais curto */ const opts = [[a - rr, h.y, h.x - a], [c + rr, h.y, c - h.x], [h.x, b - rr, h.y - b], [h.x, d + rr, d - h.y]].sort((p, q) => p[2] - q[2]); h.x = opts[0][0]; h.y = opts[0][1]; }
      }
    }
  }

  function kill(G, api, eater, victim) {
    eater.holes++;
    grow(G, eater, victim.area * .5, api);
    eater.score += Math.round(victim.area / 40);
    G.feed.unshift({ t: 3.5, txt: `${eater.name} engoliu ${victim.name}` });
    if (G.M.respawn) victim.dead = 3; else victim.out = true;
    if (victim === G.me) {
      api.shake(12, .4); api.vibe([60, 40, 60]); api.sfx.lose();
      if (!G.M.respawn) { finish(G, api, 'eaten'); return; }
      api.banner('Foste engolido!', 'por ' + eater.name + ' · renasces já');
    } else if (eater === G.me) { api.banner('Engoliste ' + victim.name + '!', '+' + Math.round(victim.area / 40)); api.sfx.win(); }
    if (!G.M.respawn && alive(G).length === 1 && !G.me.out) finish(G, api, 'last');
  }

  function update(G, dt, api) {
    if (!G.r3) return;                         /* à espera do 3D */
    G.t += dt;
    G.feed.forEach(f => { f.t -= dt; }); G.feed = G.feed.filter(f => f.t > 0).slice(0, 4);
    if (G.count > 0) { const c0 = Math.ceil(G.count); G.count -= dt; if (Math.ceil(G.count) !== c0 && G.count > 0) api.sfx.tone(520, .12, 'square', .05); if (G.count <= 0) { api.sfx.tone(1040, .25, 'square', .07); api.banner('Já!', ''); } animateWorld(G, dt); return; }
    if (isFinite(G.time)) {
      G.time -= dt;
      if (Math.ceil(G.time) === 10 && Math.ceil(G.time + dt) === 11) { api.banner('10 segundos!', ''); api.sfx.tone(880, .1, 'square', .05); }
      if (G.time <= 0) { G.time = 0; finish(G, api, 'time'); return; }
    }
    G.comboT -= dt; if (G.comboT <= 0 && G.combo) { if (G.combo >= 6) { const b = G.combo * 3; G.me.score += b; api.float(api.W / 2, api.H * .36, `Combo ×${G.combo} +${b}`, '#fde047', 22); } G.combo = 0; }
    animateWorld(G, dt);

    for (const h of G.holes) {
      if (h.out) continue;
      if (h.dead > 0) {
        h.dead -= dt;
        if (h.dead <= 0) {
          /* FIX: repor a 0 — um valor negativo continuava "verdadeiro" e o buraco ficava invisível e imune */
          h.dead = 0; h.R = h.Rv = G.startR; h.area = Math.PI * h.R * h.R; h.pulse = 1;
          [h.x, h.y] = spawnSpot(G, h);
          if (h === G.me) { G.cam.x = h.x; G.cam.y = h.y; }
        }
        continue;
      }
      let dx = 0, dy = 0;
      if (h.ai) {
        h.think -= dt;
        if (h.think <= 0 || !h.target || h.target.dead || h.target.out) aiThink(G, h);
        dx = h.target.x - h.x; dy = h.target.y - h.y;
        const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        if (d < 10) { dx = dy = 0; h.think = 0; }
        /* preso numa parede? escolhe outra coisa */
        h.stuck = Math.hypot(h.vx, h.vy) < 20 ? h.stuck + dt : 0; if (h.stuck > .8) { h.stuck = 0; h.target = { x: U.clamp(h.x + U.rand(-600, 600), 100, G.W - 100), y: U.clamp(h.y + U.rand(-600, 600), 100, G.H - 100) }; h.think = 1.2; }
      } else {
        if (G.keys[0] || G.keys[1]) { dx = G.keys[0]; dy = G.keys[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
        else if (G.joy) { dx = G.joy.dx; dy = G.joy.dy; }
      }
      const sp = speedOf(G, h);
      h.vx = U.lerp(h.vx, dx * sp, Math.min(1, dt * 8)); h.vy = U.lerp(h.vy, dy * sp, Math.min(1, dt * 8));
      h.x = U.clamp(h.x + h.vx * dt, h.R * .6, G.W - h.R * .6); h.y = U.clamp(h.y + h.vy * dt, h.R * .6, G.H - h.R * .6);
      wallPush(G, h);
      h.Rv = U.lerp(h.Rv, h.R, Math.min(1, dt * 5));
      h.pulse = Math.max(0, h.pulse - dt * 2);
      const pull = G.vac ? h.R * 1.9 : h.R + 30;
      near(G, h.x, h.y, pull + 70, o => {
        if (o.gone || o.fall) return;
        const d = U.dist(h.x, h.y, o.x, o.y);
        if (canEat(h, o)) {
          if (G.vac && d < pull && d > 1) { const k = 160 * (1 - d / pull) * dt; o.x += (h.x - o.x) / d * k; o.y += (h.y - o.y) / d * k; o.moved = true; hashMove(G, o); }
          if (d < h.R - o.r * .35) {
            o.fall = { h, t: 0, x0: o.x, y0: o.y };
            hashDel(G, o); G.falls.push(o);
            grow(G, h, Math.PI * o.r * o.r * (G.vac ? .42 : .5), api);
            const val = Math.round(o.r * o.r / 3) + 1;
            h.score += val; h.eaten++;
            if (!h.ai) {
              G.combo++; G.comboT = .7; G.bestCombo = Math.max(G.bestCombo, G.combo);
              api.sfx.tone(Math.max(80, 820 - o.r * 10), .08, G.vac ? 'sawtooth' : 'sine', G.vac ? .03 : .05, 0, Math.max(50, 480 - o.r * 7));
              if (o.r > 16) { api.float(api.W / 2, api.H * .42, '+' + val, '#fde047', 20 + Math.min(14, o.r / 6)); api.shake(Math.min(10, o.r / 7), .2); api.vibe(15); if (o.r > 30) { api.sfx.noise(.5, .12, 0, 260, 'lowpass'); dust(G, o, 18); } }
            }
          }
        } else if (!G.vac && d < h.R + o.r * .6) { o.wob = .25; G.wobs.add(o); }   /* grande demais: abana à beira */
      });
      for (const o of G.holes) {
        if (o === h || o.dead || o.out || h.dead || h.out) continue;
        const d = U.dist(h.x, h.y, o.x, o.y);
        if (h.R > o.R * 1.15 && d < h.R - o.R * .5) kill(G, api, h, o);
        if (G.over) return;
      }
    }
    /* quedas */
    for (let i = G.falls.length - 1; i >= 0; i--) {
      const o = G.falls[i], f = o.fall, h = f.h; f.t += dt;
      const k = Math.min(1, f.t / (G.vac ? .3 : .45));
      o.x = U.lerp(f.x0, h.x, k); o.y = U.lerp(f.y0, h.y, k);
      if (G.vac) { o.y3 = 3 + k * 5; o.shrink = 1 - k; o.a += dt * 14; if (k >= 1) { o.gone = true; G.goneN++; G.falls.splice(i, 1); } }
      else {
        const heavy = 1 / (1 + o.r / 35);
        o.y3 = -(Math.max(0, f.t - .06) ** 2) * 520 * heavy;
        o.tilt = Math.min(1.5, f.t * (3 + heavy * 2));
        o.tdx = h.x - f.x0; o.tdy = h.y - f.y0;
        if (o.y3 < -(o.r * 3 * (o.sy || 1) + 60) || f.t > 2.5) { o.gone = true; G.goneN++; G.falls.splice(i, 1); }
      }
      o.moved = true;
    }
    /* sozinho: quando não sobra nada, acabou */
    if (!G.M.rivals && pct(G) >= 100) finish(G, api, 'clean');
  }
  const pct = G => Math.min(100, Math.round(100 * G.goneN / Math.max(1, G.total)));

  /* movimento de peões, carros, animais e barcos — só perto da câmara (o resto nem se vê) */
  function animateWorld(G, dt) {
    G.wobs.forEach(o => { o.wob = Math.max(0, o.wob - dt); o.moved = true; if (!o.wob) G.wobs.delete(o); });
    const cx = G.cam.x, cy = G.cam.y, sim = G.cam.d * 2.8 + 600, sim2 = sim * sim;
    for (const o of G.movers) {
      if (o.gone || o.fall) continue;
      const ex = o.x - cx, ey = o.y - cy;
      if (ex * ex + ey * ey > sim2) continue;
      o.moved = true;
      if (o.mv === 'car') {
        const p = o.ax, q = p === 'x' ? 'y' : 'x';
        o[p] += o.dir * o.v * dt;
        if (o[p] < o.lo || o[p] > o.hi) {                   /* fim da rua: dá a volta e troca de faixa */
          o[p] = U.clamp(o[p], o.lo, o.hi); o.dir = -o.dir;
          o[q] = o.c + (p === 'x' ? o.dir : -o.dir) * o.lane;
          o.a = p === 'x' ? (o.dir > 0 ? 0 : Math.PI) : (o.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
        hashMove(G, o); continue;
      }
      if (o.mv === 'boat') o.y3 = Math.sin(G.t * 1.7 + o.id) * .7;
      /* fogem de buracos maiores que estejam perto */
      let fled = false;
      for (const h of G.holes) {
        if (h.dead || h.out || !canEat(h, o)) continue;
        const d = U.dist(h.x, h.y, o.x, o.y);
        if (d < h.R + 55 && d > 1) { const s = (o.mv === 'pet' ? 70 : 34) * dt; o.x += (o.x - h.x) / d * s; o.y += (o.y - h.y) / d * s; o.a = Math.atan2(-(o.y - h.y), o.x - h.x); fled = true; break; }
      }
      if (!fled) {
        if (o.mv === 'walk') {
          const b = o.blk, per = 4 * (BS + 16);
          o.u = (o.u + o.dir * o.v * dt / per + 1) % 1;
          const L = o.u * per, side = Math.floor(L / (BS + 16)), t = L % (BS + 16) - 8;
          const x0 = b.x - 8, y0 = b.y - 8, e = BS + 16;
          const pts = [[x0 + t + 8, y0, 0], [x0 + e, y0 + t + 8, -Math.PI / 2], [x0 + e - t - 8, y0 + e, Math.PI], [x0, y0 + e - t - 8, Math.PI / 2]][side];
          o.x = pts[0]; o.y = pts[1]; o.a = pts[2] + (o.dir < 0 ? Math.PI : 0);
        } else {
          o.wt = (o.wt || 0) - dt;
          if (o.wt <= 0) { o.wt = U.rand(1, 3.5); o.wa = Math.random() * TAU; o.ws = Math.random() < .25 ? 0 : (o.wsp || (o.mv === 'pet' ? 30 : 14)); }
          const nx = o.x + Math.cos(o.wa) * o.ws * dt, ny = o.y + Math.sin(o.wa) * o.ws * dt;
          const inside = o.pond ? Math.hypot(nx - o.pond[0], ny - o.pond[1]) < o.pond[2]
            : o.blk ? (nx > o.blk.x + 6 && nx < o.blk.x + BS - 6 && ny > o.blk.y + 6 && ny < o.blk.y + BS - 6)
            : (nx > 20 && nx < G.W - 20 && ny > 20 && ny < G.H - 20 && !(G.vac && HOUSE.walls.some(w => nx > w[0] - o.r && nx < w[2] + o.r && ny > w[1] - o.r && ny < w[3] + o.r)));
          if (inside) { o.x = nx; o.y = ny; if (o.ws) o.a = Math.atan2(-Math.sin(o.wa), Math.cos(o.wa)); } else o.wt = 0;
        }
      }
      hashMove(G, o);
    }
  }

  function finish(G, api, why) {
    if (G.over) return; G.over = true;
    const rk = ranking(G), pos = rk.indexOf(G.me) + 1, p = pct(G), S = G.S;
    const solo = !G.M.rivals, goalOk = G.type === 'timed' && p >= G.M.goal;
    const won = solo ? (G.type === 'timed' ? goalOk : true) : pos === 1;
    /* XP, skins e cenários visitados */
    const xp0 = store().getPref('xp', 0), xp1 = xp0 + G.me.score, lv0 = levelOf(xp0), lv1 = levelOf(xp1);
    store().setPref('xp', xp1);
    const seen = new Set(store().getPref('seen', [])); seen.add(G.scen); store().setPref('seen', [...seen]);
    const newSkins = SKINS.filter(s => s.lvl > lv0 && s.lvl <= lv1).map(s => s.name);
    const place = G.vac ? `Casa ${p}% limpa` : `${S.name} ${p}% ${S.art === 'o' ? 'engolido' : 'engolida'}`;
    api.over({ score: G.me.score, won, delay: why === 'eaten' ? 900 : 350,
      icon: why === 'eaten' ? '🕳️' : solo ? (G.type === 'timed' ? (goalOk ? '🎯' : '⏱️') : S.icon) : pos === 1 ? '👑' : '🏅',
      title: why === 'eaten' ? `Foste engolido — ${pos}.º lugar` : solo ? place : pos === 1 ? 'És o maior!' : `Ficaste em ${pos}.º lugar`,
      sub: (G.type === 'timed' ? (goalOk ? `Objetivo cumprido (${G.M.goal}%)! · ` : `Objetivo: ${G.M.goal}% · `) : '') + `+${G.me.score} XP · nível ${lv1}` + (newSkins.length ? ` · <b style="color:#fde047">nova skin: ${newSkins.join(', ')}</b>` : ''),
      html: solo ? '' : `<div style="margin-top:10px;display:grid;gap:4px;font-size:.82rem;max-height:190px;overflow:auto">${rk.map((h, i) => `<div style="display:flex;justify-content:space-between;padding:4px 10px;border-radius:8px;background:${h === G.me ? 'rgba(34,197,94,.18)' : 'rgba(255,255,255,.05)'};${h.out ? 'opacity:.55' : ''}"><span>${i + 1}. <b style="color:${h.color}">●</b> ${h.name}${h.out ? ' ✕' : ''}</span><b>${h.score}</b></div>`).join('')}</div>`,
      stats: [['Tamanho', Math.round(G.me.R * 2)], ['Coisas engolidas', G.me.eaten], solo ? [G.vac ? 'Casa limpa' : 'Mapa engolido', p + '%'] : ['Buracos engolidos', G.me.holes], ['Melhor combo', '×' + G.bestCombo]],
      meta: { pos, R: G.me.R, clean: p, vac: G.vac, scen: G.scen, size: G.NB, type: G.type, goalOk, seen: seen.size } });
  }
  function ranking(G) { return G.holes.slice().sort((a, b) => (a.out - b.out) || (b.score - a.score)); }

  /* ════════════════════════════════════════════════════════════════
     3D
  ════════════════════════════════════════════════════════════════ */
  let R3 = null;                                  /* renderer único, reutilizado entre partidas */
  const coarse = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  function floorTex(kind) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    if (kind === 'wood' || kind === 'wood2') {
      const base = kind === 'wood' ? ['#b7825a', '#a8744d', '#c08c62'] : ['#caa27a', '#bb9169', '#d4ae86'];
      for (let i = 0; i < 8; i++) { x.fillStyle = base[i % 3]; x.fillRect(0, i * 32, 256, 32); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, i * 32, 256, 2); x.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32); }
    } else if (kind === 'tile' || kind === 'blue') {
      x.fillStyle = kind === 'tile' ? '#f1f5f9' : '#bae6fd'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = kind === 'tile' ? '#cbd5e1' : '#7dd3fc'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 64, j * 64, 64, 64);
      x.strokeStyle = 'rgba(0,0,0,.15)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); }
    } else {
      x.fillStyle = '#7c6fb0'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},.06)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }

  /* chão: milhares de retângulos/discos escritos diretamente num só BufferGeometry */
  function quadGeo(Q) {
    let n = 0; Q.forEach(q => { n += q[0] === 'r' ? 6 : q[6] * 3; });
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), nor = new Float32Array(n * 3), tc = new THREE.Color();
    let o = 0;
    const v = (x, y, z) => { const k = o * 3; pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; nor[k + 1] = 1; col[k] = tc.r; col[k + 1] = tc.g; col[k + 2] = tc.b; o++; };
    Q.forEach(q => {
      if (q[0] === 'r') { const [, x0, z0, x1, z1, c, y] = q; tc.set(c); v(x0, y, z0); v(x0, y, z1); v(x1, y, z0); v(x1, y, z0); v(x0, y, z1); v(x1, y, z1); }
      else { const [, cx, cz, r, c, y, seg] = q; tc.set(c); for (let k = 0; k < seg; k++) { const a0 = k / seg * TAU, a1 = (k + 1) / seg * TAU; v(cx, y, cz); v(cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r); v(cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r); } }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }

  /* minimapa pintado uma vez (os buracos vão por cima a cada frame) */
  function buildMini(G) {
    const c = document.createElement('canvas'), n = 184; c.width = n; c.height = Math.round(n * G.H / G.W);
    const x = c.getContext('2d'), s = n / G.W;
    x.fillStyle = G.S.road; x.fillRect(0, 0, c.width, c.height);
    G.blocks.forEach(b => { const e = b.e || [0, 0, 0, 0]; x.fillStyle = KC[b.kind] || '#84cc16'; x.fillRect((b.x - e[0]) * s, (b.y - e[1]) * s, (BS + e[0] + e[2]) * s, (BS + e[1] + e[3]) * s); });
    G.decals.forEach(d => {
      x.fillStyle = d[5 - (d[0] === 'd' ? 1 : 0)];
      if (d[0] === 'r' && (d[3] - d[1]) * (d[4] - d[2]) > 4000) x.fillRect(d[1] * s, d[2] * s, (d[3] - d[1]) * s, (d[4] - d[2]) * s);
      else if (d[0] === 'd' && d[3] > 30) { x.beginPath(); x.arc(d[1] * s, d[2] * s, d[3] * s, 0, TAU); x.fill(); }
    });
    G.mini = c;
  }

  function build3D(G, api) {
    if (!R3) {
      const renderer = new THREE.WebGLRenderer({ antialias: !coarse(), stencil: true, powerPreference: 'high-performance' });
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      renderer.domElement.className = 'hole3d';
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0';
      R3 = { renderer };
    }
    const { renderer } = R3;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse() ? 1.5 : 2));
    const stage = api.stage;
    stage.insertBefore(renderer.domElement, stage.firstChild);
    const cv2d = stage.querySelector('.ak-cv'); if (cv2d) { cv2d.style.position = 'absolute'; cv2d.style.zIndex = '1'; }

    const scene = new THREE.Scene();
    const sky = new THREE.Color(G.vac ? '#1e293b' : G.S.sky);
    scene.background = sky;
    scene.fog = new THREE.Fog(sky, 900, 3200);
    const cam = new THREE.PerspectiveCamera(46, 1, 2, 5000);
    scene.add(new THREE.HemisphereLight(G.vac ? '#fff7ed' : '#e0f2fe', G.vac ? '#78716c' : '#4d7c0f', G.vac ? 1.1 : 1.2));
    const sun = new THREE.DirectionalLight(G.vac ? '#fff1dc' : '#fff6e0', G.vac ? 1.9 : 2.3);
    sun.castShadow = true; const sm = coarse() ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
    sun.shadow.bias = -.0006; sun.shadow.normalBias = .6;
    scene.add(sun); scene.add(sun.target);

    const mats = [];
    const lam = o => { const m = new THREE.MeshLambertMaterial(o); mats.push(m); return m; };
    const groundMat = lam({ vertexColors: true, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc });
    const objMat = lam({ vertexColors: true });

    /* ── chão ── */
    const Q = [], extra = [];
    const rect = (x0, z0, x1, z1, c, y) => Q.push(['r', x0, z0, x1, z1, c, y || 0]);
    if (!G.vac) {
      const S = G.S;
      rect(-4000, -4000, G.W + 4000, G.H + 4000, S.outer, -.5);
      if (S.north) rect(-4000, -4000, G.W + 4000, 2, S.north, -.45);
      rect(-10, -10, G.W + 10, G.H + 10, S.road, 0);
      if (S.dash) for (const vert of [false, true]) for (let line = 0; line <= G.NB; line++) for (let seg = 0; seg < G.NB; seg++) {
        if (!roadAt(G, vert, line, seg)) continue;
        const c = line * CELL + RD / 2, s0 = seg * CELL + RD / 2 + 12, s1 = (seg + 1) * CELL + RD / 2 - 12;
        for (let s = s0; s < s1; s += 44) { const e = Math.min(s + 22, s1); if (vert) rect(c - 1, s, c + 1, e, S.dash, .15); else rect(s, c - 1, e, c + 1, S.dash, .15); }
      }
      G.blocks.forEach(b => {
        if (b.zone) { const e = b.e; rect(b.x - e[0], b.y - e[1], b.x + BS + e[2], b.y + BS + e[3], KC[b.kind], .5); return; }
        rect(b.x - 16, b.y - 16, b.x + BS + 16, b.y + BS + 16, S.side, .3);
        rect(b.x, b.y, b.x + BS, b.y + BS, KC[b.kind] || '#84cc16', .5);
        if (S.cross && roadAt(G, false, b.j, b.i)) for (let k = 0; k < 5; k++) rect(b.x + 20 + k * 8, b.y - 58, b.x + 24 + k * 8, b.y - 22, '#f8fafc', .2);
      });
      G.decals.forEach(d => Q.push(d));
    } else {
      rect(-1200, -1200, G.W + 1200, G.H + 1200, '#3f6212', -.4);
      HOUSE.rooms.forEach(rm => rm.r.forEach(([a, b, c, d]) => {
        const geo = new THREE.PlaneGeometry(c - a, d - b); const tex = floorTex(rm.floor); tex.repeat.set((c - a) / 180, (d - b) / 180);
        const m = new THREE.MeshLambertMaterial({ map: tex }); mats.push(m);
        const mesh = new THREE.Mesh(geo, m); mesh.rotation.x = -Math.PI / 2; mesh.position.set((a + c) / 2, 0, (b + d) / 2); mesh.receiveShadow = true; scene.add(mesh); extra.push(mesh);
      }));
      const wp = HOUSE.walls.map(([a, b, c, d]) => B(c - a, 34, d - b, '#f5efe6', (a + c) / 2, (b + d) / 2, 0)).concat(HOUSE.walls.map(([a, b, c, d]) => B(c - a + .4, 2, d - b + .4, '#d6c7b0', (a + c) / 2, (b + d) / 2, 34)));
      const wg = merge(wp).base; const wm = new THREE.Mesh(wg, objMat); wm.castShadow = true; wm.receiveShadow = true; scene.add(wm); extra.push(wm);
    }
    const ground = new THREE.Mesh(quadGeo(Q), groundMat);
    ground.receiveShadow = true; ground.renderOrder = -1; scene.add(ground); extra.push(ground);
    G.decals = null;

    /* ── objetos: um InstancedMesh por tipo (+ camada pintável). Só vão para a
          GPU as instâncias à volta da câmara (ver cull): num 30×30 há ~45 mil
          objetos, mas desenham-se umas centenas — o custo não cresce com o mapa. ── */
    const byType = new Map();
    G.objs.forEach(o => { let l = byType.get(o.k); if (!l) byType.set(o.k, l = []); l.push(o); });
    const inst = [], tint = new THREE.Color(), N = G.objs.length;
    G.mtx = new Float32Array(N * 16); G.pcol = new Float32Array(N * 3);
    byType.forEach((list, k) => {
      const geo = tplGeo(k), r0 = TPL[k].r0;
      const meshes = ['base', 'paint'].filter(p => geo[p]).map(p => {
        const m = new THREE.InstancedMesh(geo[p], objMat, list.length);
        m.frustumCulled = false; m.count = 0; m.visible = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.castShadow = r0 >= 4 && k !== 'rug' && k !== 'coin' && k !== 'crumb' && k !== 'towel'; m.receiveShadow = r0 > 20;
        if (p === 'paint') m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
        scene.add(m); return m;
      });
      list.forEach(o => { o.inst = -1; o.meshes = meshes; o.s = o.r / r0; o.moved = true; tint.set(o.paint || '#e5e7eb'); G.pcol[o.id * 3] = tint.r; G.pcol[o.id * 3 + 1] = tint.g; G.pcol[o.id * 3 + 2] = tint.b; });
      inst.push({ k, list, meshes, paint: meshes.find(m => m.instanceColor), sz: Math.max(geo.h, r0) * list[0].s });
    });

    /* ── buracos / aspiradores ── */
    const holeObjs = [];
    const maskMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    const wellGeo = (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 48, 6, true); const col = []; const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) + .5; const v = .0015 + t * t * t * .045; col.push(v, v, v * 1.25);   /* lineares: muito escuros no fundo */ } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; })();
    const wellMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, fog: false, toneMapped: false });
    const floorMat = new THREE.MeshBasicMaterial({ color: '#020203', stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, fog: false });
    mats.push(maskMat, wellMat, floorMat);
    const vacGeo = merge([C(1, 1, .32, '#1f2937', 0, 0, 0, 36), C(.94, .98, .12, '#f1f5f9', 0, 0, .32, 36), C(.2, .22, .12, '#0f172a', .1, 0, .44, 16), B(.3, .24, 1.4, '#374151', .82, 0, .06)]).base;
    const vacAccent = merge([part(new THREE.TorusGeometry(.8, .06, 6, 36), 'P', 0, .45, 0, Math.PI / 2), S(.07, 'P', .62, .46, .3)]).paint;
    const brushGeo = merge([B(.9, .02, .06, '#111827', 0, 0, .02), B(.06, .02, .9, '#111827', 0, 0, .02)]).base;
    G.holes.forEach(h => {
      const grp = new THREE.Group(); scene.add(grp);
      const o = { h, grp };
      if (!G.vac) {
        const mask = new THREE.Mesh(new THREE.CircleGeometry(1, 48), maskMat); mask.rotation.x = -Math.PI / 2; mask.position.y = .9; mask.renderOrder = -2;
        const well = new THREE.Mesh(wellGeo, wellMat); well.renderOrder = 1;
        const bottom = new THREE.Mesh(new THREE.CircleGeometry(1, 32), floorMat); bottom.rotation.x = -Math.PI / 2; bottom.renderOrder = 1;
        const rimMat = new THREE.MeshBasicMaterial({ color: h.color, transparent: true, opacity: .95 }); mats.push(rimMat);
        const rim = new THREE.Mesh(new THREE.RingGeometry(.97, 1.06, 64), rimMat); rim.rotation.x = -Math.PI / 2; rim.position.y = 1.1;
        grp.add(mask, well, bottom, rim); Object.assign(o, { mask, well, bottom, rim, rimMat });
      } else {
        const accMat = new THREE.MeshLambertMaterial({ color: h.color, emissive: h.color, emissiveIntensity: .35 }); mats.push(accMat);
        const body = new THREE.Mesh(vacGeo, objMat); body.castShadow = true;
        const acc = new THREE.Mesh(vacAccent, accMat);
        const b1 = new THREE.Mesh(brushGeo, objMat), b2 = new THREE.Mesh(brushGeo, objMat); b1.position.set(.7, 0, .55); b2.position.set(.7, 0, -.55);
        const ringMat = new THREE.MeshBasicMaterial({ color: h.color, transparent: true, opacity: .14, depthWrite: false }); mats.push(ringMat);
        const suck = new THREE.Mesh(new THREE.RingGeometry(.2, 1, 48), ringMat); suck.rotation.x = -Math.PI / 2; suck.position.y = .3;
        const inner = new THREE.Group(); inner.add(body, acc, b1, b2); grp.add(inner, suck);
        Object.assign(o, { inner, b1, b2, suck, accMat, ringMat });
      }
      holeObjs.push(o);
    });

    /* pó quando caem prédios */
    const DUST = 240, dpos = new Float32Array(DUST * 3).fill(-9999);
    const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    const dmat = new THREE.PointsMaterial({ color: '#d6d3d1', size: 9, transparent: true, opacity: .55, depthWrite: false }); mats.push(dmat);
    const dpts = new THREE.Points(dgeo, dmat); dpts.frustumCulled = false; scene.add(dpts);

    const ghostMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: .22, depthWrite: false }); mats.push(ghostMat);
    G.r3 = { cullAt: null, renderer, ghostMat, ghosts: new Map(), scene, cam, sun, inst, holeObjs, extra, mats, dgeo, dpos, dust: [], lastW: 0, lastH: 0, tmp: new THREE.Object3D(), q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), ax: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), v: new THREE.Vector3() };
  }

  function dust(G, o, n) {
    if (!G.r3) return;
    for (let i = 0; i < n; i++) G.r3.dust.push({ x: o.x + U.rand(-o.r, o.r), y: U.rand(2, 20), z: o.y + U.rand(-o.r, o.r), vx: U.rand(-20, 20), vy: U.rand(18, 40), vz: U.rand(-20, 20), t: U.rand(.8, 1.4) });
    if (G.r3.dust.length > 240) G.r3.dust.splice(0, G.r3.dust.length - 240);
  }

  /* Prédios entre a câmara e o buraco do jogador ficam fantasma (como no
     Hole.io): a instância esconde-se e aparece uma cópia translúcida. */
  function ghosts(G) {
    const r = G.r3, me = G.me, want = new Set();
    if (!me.dead) {
      near(G, me.x, me.y + 160, 260, o => {
        if (o.gone || o.fall || o.deco || !o.meshes) return;
        const hgt = tplGeo(o.k).h * o.s * (o.sy || 1);
        if (hgt < 26 || o.y <= me.y - o.r * .3) return;              /* só o que está a sul (entre câmara e buraco) */
        if (Math.abs(o.x - me.x) > o.r * 1.1 + me.Rv + 12) return;
        if (o.y - o.r - me.y > hgt * .75 + me.Rv) return;               /* longe demais para tapar */
        want.add(o);
      });
    }
    const cp = r.cam.position;
    const inside = o => { const g = tplGeo(o.k); return Math.hypot(cp.x - o.x, cp.z - o.y) < o.r * 1.2 && cp.y < g.h * o.s * (o.sy || 1) + 20; };
    const drop = o => { const e = r.ghosts.get(o); e.meshes.forEach(m => { r.scene.remove(m); if (m.material !== r.ghostMat) m.material.dispose(); }); r.ghosts.delete(o); };
    /* saiu do conjunto → volta a ser sólido; mudou entre "fantasma" e
       "câmara lá dentro" → refaz (reavaliado a cada frame) */
    [...r.ghosts.keys()].forEach(o => {
      if (!want.has(o) || o.gone) { drop(o); o.ghost = false; o.moved = true; }
      else if (r.ghosts.get(o).inside !== inside(o)) drop(o);
    });
    want.forEach(o => {
      if (r.ghosts.has(o)) return;
      const g = tplGeo(o.k), meshes = [], ins = inside(o);
      /* câmara dentro do prédio: esconde-o de todo (um fantasma à frente da lente só embaciava tudo) */
      if (!ins) ['base', 'paint'].forEach(k => {
        if (!g[k]) return;
        const m = new THREE.Mesh(g[k], k === 'paint' ? r.ghostMat.clone() : r.ghostMat);
        if (k === 'paint') m.material.color.set(o.paint || '#e5e7eb');
        m.position.set(o.x, 0, o.y); m.rotation.y = o.a || 0; m.scale.set(o.s, o.s * (o.sy || 1), o.s);
        m.renderOrder = 5; r.scene.add(m); meshes.push(m);
      });
      o.ghost = true; o.moved = true; r.ghosts.set(o, { meshes, inside: ins });
    });
  }

  function sync3D(G, dt) {
    const r = G.r3, T = r.tmp;
    /* instâncias que mexeram */
    const dirty = new Set(), M = G.mtx;
    for (const o of G.objs) {
      if (!o.moved || !o.meshes) continue;
      o.moved = false;
      if (o.gone || o.ghost) T.scale.set(0, 0, 0);
      else {
        const s = o.s * (o.shrink != null ? Math.max(0, o.shrink) : 1);
        T.scale.set(s, s * (o.sy || 1), s);
      }
      T.position.set(o.x, (o.y3 || 0) + (o.by || 0), o.y);
      r.q2.setFromAxisAngle(r.up, o.a || 0);
      let tilt = o.tilt || 0, ax = 0, az = 0;
      if (tilt && o.fall) { const d = Math.hypot(o.tdx, o.tdy) || 1; ax = o.tdy / d; az = -o.tdx / d; }
      if (o.wob > 0) { tilt = Math.sin(G.t * 34 + o.id) * .05; ax = 1; az = 0; }
      if (tilt) { r.ax.set(ax, 0, az).normalize(); r.q1.setFromAxisAngle(r.ax, tilt); T.quaternion.copy(r.q1).multiply(r.q2); } else T.quaternion.copy(r.q2);
      T.updateMatrix();
      M.set(T.matrix.elements, o.id * 16);
      if (o.inst >= 0) o.meshes.forEach(m => { m.instanceMatrix.array.set(T.matrix.elements, o.inst * 16); dirty.add(m); });
    }
    dirty.forEach(m => { m.instanceMatrix.addUpdateRange(0, m.count * 16); m.instanceMatrix.needsUpdate = true; });
    ghosts(G);
    /* buracos / aspiradores */
    r.holeObjs.forEach(ho => {
      const h = ho.h, vis = !h.dead && !h.out;
      ho.grp.visible = vis; if (!vis) return;
      const Rr = h.Rv * (1 + h.pulse * .12);
      ho.grp.position.set(h.x, 0, h.y);
      if (!G.vac) {
        const depth = Rr * 3 + 80;
        ho.mask.scale.set(Rr, Rr, 1); ho.well.scale.set(Rr, depth, Rr); ho.well.position.y = -depth / 2 + 1;
        ho.bottom.scale.set(Rr, Rr, 1); ho.bottom.position.y = -depth + 1;
        ho.rim.scale.set(Rr, Rr, 1);
        if (h === G.me && G.skin.c === 'rainbow') ho.rimMat.color.setHSL((G.t * .2) % 1, .9, .6);
      } else {
        const sc = Rr; ho.inner.scale.set(sc, sc * .9, sc);
        ho.inner.rotation.y = Math.atan2(-h.vy, h.vx) || ho.inner.rotation.y;
        ho.b1.rotation.y += dt * 18; ho.b2.rotation.y -= dt * 18;
        ho.suck.scale.set(Rr * 1.9, Rr * 1.9, 1); ho.ringMat.opacity = .14 + Math.sin(G.t * 6) * .06;
        if (h === G.me && G.skin.c === 'rainbow') { ho.accMat.color.setHSL((G.t * .2) % 1, .9, .6); ho.accMat.emissive.copy(ho.accMat.color); }
      }
    });
    /* pó */
    const dp = r.dpos; let n = 0;
    r.dust.forEach(p => { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; });
    r.dust = r.dust.filter(p => p.t > 0);
    for (let i = 0; i < 240; i++) { const p = r.dust[i]; if (p) { dp[n++] = p.x; dp[n++] = p.y; dp[n++] = p.z; } else { dp[n++] = 0; dp[n++] = -9999; dp[n++] = 0; } }
    r.dgeo.attributes.position.needsUpdate = true;
  }

  /* Escolhe as instâncias a desenhar: as que estão na zona que a câmara vê
     (com folga para prédios altos e sombras), sem as minúsculas quando se
     está muito alto. Refeito quando a câmara anda ~¼ do seu afastamento. */
  function cull(G) {
    const r = G.r3, d = G.cam.d, cx = G.cam.x, cy = G.cam.y, M = G.mtx, C3 = G.pcol;
    const x0 = cx - d * 1.5 - 280, x1 = cx + d * 1.5 + 280, y0 = cy - d * 1.25 - 440, y1 = cy + d * .8 + 320;
    const lod = Math.max(0, d - 400) * .012;
    for (const g of r.inst) {
      let n = 0;
      const show = g.sz >= lod, ms = g.meshes, pc = g.paint;
      for (const o of g.list) {
        if (!show || o.gone || o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) { o.inst = -1; continue; }
        o.inst = n;
        const a = o.id * 16, b = n * 16;
        for (const m of ms) { const dst = m.instanceMatrix.array; for (let q = 0; q < 16; q++) dst[b + q] = M[a + q]; }
        if (pc) { const dst = pc.instanceColor.array, a3 = o.id * 3, b3 = n * 3; dst[b3] = C3[a3]; dst[b3 + 1] = C3[a3 + 1]; dst[b3 + 2] = C3[a3 + 2]; }
        n++;
      }
      for (const m of ms) { m.count = n; m.visible = n > 0; if (n) { m.instanceMatrix.addUpdateRange(0, n * 16); m.instanceMatrix.needsUpdate = true; } }
      if (pc && n) { pc.instanceColor.addUpdateRange(0, n * 3); pc.instanceColor.needsUpdate = true; }
    }
    r.cullAt = { x: cx, y: cy, d, t: G.t };
  }

  function render3D(G, dt, W, H, api) {
    const r = G.r3, { renderer } = R3, stage = api.stage;
    const cw = stage.clientWidth, ch = stage.clientHeight;
    if (cw !== r.lastW || ch !== r.lastH) { r.lastW = cw; r.lastH = ch; renderer.setSize(cw, ch, false); r.cam.aspect = cw / Math.max(1, ch); r.cam.updateProjectionMatrix(); }
    sync3D(G, dt);
    const me = G.me, Rr = me.Rv;
    G.cam.x = U.lerp(G.cam.x, me.x, Math.min(1, dt * 5)); G.cam.y = U.lerp(G.cam.y, me.y, Math.min(1, dt * 5));
    const portrait = r.cam.aspect < .8 ? 1.3 : 1;
    const dist = (G.vac ? (70 + Rr * 5.2) : (110 + Rr * 5)) * portrait;
    G.cam.d = U.lerp(G.cam.d, dist, Math.min(1, dt * 2));
    const d = G.cam.d;
    /* ecrãs ao alto: câmara mais a pique (menos prédios à frente) */
    const tilt = portrait > 1 ? .55 : .82;
    r.cam.position.set(G.cam.x, d * 1.12, G.cam.y + d * tilt);
    r.cam.lookAt(G.cam.x, 0, G.cam.y + d * .05);
    /* o nevoeiro esconde o horizonte — e tudo o que está para lá dele nem é desenhado */
    r.scene.fog.near = d * 2.1; r.scene.fog.far = d * 3.4 + 1000;
    /* o plano próximo cresce com a distância: com near fixo em 2, ao afastar a
       câmara as camadas do chão (estrada, passadeiras, passeios, quarteirões,
       heliportos — separadas por décimas) perdiam precisão e piscavam */
    r.cam.near = Math.max(2, d * .06);
    r.cam.far = d * 3.6 + 1200; r.cam.updateProjectionMatrix();
    const ca = r.cullAt;
    if (!ca || Math.hypot(G.cam.x - ca.x, G.cam.y - ca.y) > d * .25 + 20 || Math.abs(d - ca.d) > ca.d * .12 || G.t - ca.t > .8) cull(G);
    /* sol e sombras seguem a câmara */
    const ext = d * 1.6;
    r.sun.position.set(G.cam.x + d * .8, d * 2.6 + 200, G.cam.y + d * .5); r.sun.target.position.set(G.cam.x, 0, G.cam.y);
    const sc = r.sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 10; sc.far = d * 6 + 900; sc.updateProjectionMatrix();
    renderer.render(r.scene, r.cam);
  }

  function destroy(G) {
    const r = G.r3; if (!r) return;
    r.scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && !Object.values(_geoCache).some(c => c.base === o.geometry || c.paint === o.geometry)) o.geometry.dispose(); });
    r.mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    if (R3) { R3.renderer.renderLists.dispose(); R3.renderer.domElement.remove(); }
    G.r3 = null;
  }

  /* ════════════════════════════════════════════════════════════════
     DESENHO (3D + sobreposição 2D)
  ════════════════════════════════════════════════════════════════ */
  const _v = { x: 0, y: 0 };
  function toScreen(G, x, y3, z, W, H) {
    const v = G.r3.v.set(x, y3, z).project(G.r3.cam);
    _v.x = (v.x * .5 + .5) * W; _v.y = (1 - (v.y * .5 + .5)) * H; _v.vis = v.z < 1 && v.z > -1;
    return _v;
  }

  function draw(G, ctx, W, H, api) {
    const dt = Math.min(.05, api.t - (G.lastDraw || api.t)); G.lastDraw = api.t;
    if (G.fail) {
      ctx.fillStyle = 'rgba(8,10,20,.92)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = "700 18px 'Space Grotesk', system-ui"; ctx.textAlign = 'center';
      ctx.fillText('Este jogo precisa de 3D (WebGL).', W / 2, H / 2 - 10); ctx.font = '14px system-ui'; ctx.fillStyle = '#cbd5e1'; ctx.fillText('Experimenta noutro browser ou ativa a aceleração gráfica.', W / 2, H / 2 + 16);
      return;
    }
    if (!G.r3) { ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#e2e8f0'; ctx.font = "700 18px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.fillText(G.vac ? 'A arrumar a casa em 3D…' : `A construir ${G.S.art} ${G.S.name.toLowerCase()} em 3D…`, W / 2, H / 2); return; }
    render3D(G, dt, W, H, api);
    /* nomes por cima dos buracos */
    ctx.textAlign = 'center';
    const leader = G.M.rivals ? ranking(G)[0] : null;
    G.holes.forEach(h => {
      if (h.dead || h.out) return;
      const p = toScreen(G, h.x, G.vac ? h.Rv * .9 + 8 : 6, h.y - h.Rv * 1.05, W, H); if (!p.vis || p.x < -60 || p.x > W + 60 || p.y < -20 || p.y > H + 20) return;
      const lead = leader === h;
      ctx.font = `800 ${h === G.me ? 14 : 12}px system-ui`; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)';
      const label = (lead ? '👑 ' : '') + h.name;
      ctx.strokeText(label, p.x, p.y - 8); ctx.fillStyle = h === G.me ? '#fff' : h.color; ctx.fillText(label, p.x, p.y - 8);
    });
    /* classificação ao vivo */
    if (G.M.rivals) {
      const rk = ranking(G), show = rk.slice(0, 5); if (!show.includes(G.me)) show.push(G.me);
      const bw = 132, bh = 14 + show.length * 17;
      ctx.fillStyle = 'rgba(0,0,0,.42)'; U.rr(ctx, W - bw - 8, 64, bw, bh, 10); ctx.fill();
      show.forEach((h, i) => { const pos = rk.indexOf(h) + 1; ctx.globalAlpha = h.out ? .45 : 1; ctx.fillStyle = h === G.me ? '#86efac' : '#e5e7eb'; ctx.font = `${h === G.me ? 800 : 600} 12px system-ui`; ctx.textAlign = 'left'; ctx.fillText(`${pos}. ${h.name}`, W - bw, 82 + i * 17); ctx.textAlign = 'right'; ctx.fillText(h.score, W - 16, 82 + i * 17); });
      ctx.globalAlpha = 1;
      if (!G.M.respawn) { ctx.fillStyle = '#fde68a'; ctx.font = '700 12px system-ui'; ctx.textAlign = 'right'; ctx.fillText(`Restam ${alive(G).length}`, W - 16, 64 + bh + 16); }
    }
    /* minimapa */
    const mw = 92, mh = mw * G.H / G.W, mx = 10, my = H - mh - 12, sx = mw / G.W;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; U.rr(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
    if (G.mini) { ctx.globalAlpha = .75; ctx.drawImage(G.mini, mx, my, mw, mh); ctx.globalAlpha = 1; }
    else { ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; HOUSE.walls.forEach(([a, b, c, d]) => ctx.strokeRect(mx + a * sx, my + b * sx, (c - a) * sx, (d - b) * sx)); }
    G.holes.forEach(h => { if (h.dead || h.out) return; ctx.fillStyle = h === G.me ? '#fff' : h.color; ctx.beginPath(); ctx.arc(mx + h.x * sx, my + h.y * sx, Math.max(2, h.R * sx * 1.2) + (h === G.me ? 1 : 0), 0, TAU); ctx.fill(); if (h === G.me) { ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); } });
    /* barra de progresso (sozinho) — no contra-relógio, com a marca do objetivo */
    if (!G.M.rivals) {
      const k = pct(G) / 100, bx = mx + mw + 14, bw = W - mw - 40;
      ctx.fillStyle = 'rgba(0,0,0,.4)'; U.rr(ctx, bx, H - 22, bw, 10, 5); ctx.fill(); ctx.fillStyle = G.vac ? '#22d3ee' : '#86efac'; U.rr(ctx, bx, H - 22, Math.max(10, bw * k), 10, 5); ctx.fill();
      if (G.M.goal) { const gx = bx + bw * G.M.goal / 100; ctx.fillStyle = '#fde047'; ctx.fillRect(gx - 1.5, H - 26, 3, 18); ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🎯 ' + G.M.goal + '%', gx, H - 30); }
    }
    /* feed */
    G.feed.forEach((f, i) => { ctx.globalAlpha = Math.min(1, f.t); ctx.font = '700 12px system-ui'; ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(f.txt, 12, 78 + i * 17); ctx.fillStyle = '#fde68a'; ctx.fillText(f.txt, 12, 78 + i * 17); });
    ctx.globalAlpha = 1;
    /* contagem, renascer, dicas */
    if (G.count > 0) { const c = Math.ceil(G.count), k = G.count - Math.floor(G.count); ctx.globalAlpha = .4 + k * .6; ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(70 + k * 30)}px 'Space Grotesk', system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeText(c, W / 2, Math.max(110, H * .22)); ctx.fillText(c, W / 2, Math.max(110, H * .22));   /* acima do buraco e da etiqueta "Tu" */ ctx.globalAlpha = 1; }
    if (G.me.dead > 0) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = "800 22px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.fillText('A renascer… ' + Math.ceil(G.me.dead), W / 2, H / 2); }
    if (G.t < 5 && G.count <= 0 && !G.over) { ctx.globalAlpha = Math.min(1, (5 - G.t)); ctx.fillStyle = 'rgba(0,0,0,.45)'; const msg = G.touch ? 'Põe o dedo no ecrã e arrasta para te mexeres' : 'Setas / WASD para te mexeres (ou mantém o botão do rato)'; ctx.font = '600 13px system-ui'; const tw = ctx.measureText(msg).width + 24; U.rr(ctx, W / 2 - tw / 2, H - 58, tw, 26, 13); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, H - 40); ctx.globalAlpha = 1; }
    if (G.joy && G.joy.touch) { ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(G.joy.x0, G.joy.y0, 42, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(G.joy.x0 + G.joy.dx * 36, G.joy.y0 + G.joy.dy * 36, 16, 0, TAU); ctx.fill(); }
  }

  /* ════════════════════════════════════════════════════════════════
     ENTRADA
     • teclado manda; enquanto há setas premidas o rato não conta
     • rato: só com o botão premido (direção do buraco no ecrã → cursor)
     • toque: joystick flutuante onde se põe o dedo
  ════════════════════════════════════════════════════════════════ */
  /* o ecrã está rodado em relação ao mundo (câmara a olhar de sul): direita = +x, cima = −z */
  function mouseSteer(G, x, y, api) {
    if (!G.r3) return;
    const p = toScreen(G, G.me.x, 0, G.me.y, api.W, api.H);
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    G.joy = d < 12 ? { dx: 0, dy: 0 } : { dx: dx / d * Math.min(1, d / 80), dy: dy / d * Math.min(1, d / 80) };
  }
  function down(G, x, y, api, e) {
    if (e.pointerType === 'mouse') { if (G.keys[0] || G.keys[1]) return; G.mouseHeld = true; mouseSteer(G, x, y, api); return; }
    G.touch = true; G.joy = { touch: true, x0: x, y0: y, dx: 0, dy: 0 };
  }
  function move(G, x, y, api, e, isDown) {
    if (e.pointerType === 'mouse') { if (G.mouseHeld && isDown && !(G.keys[0] || G.keys[1])) mouseSteer(G, x, y, api); return; }
    if (!isDown || !G.joy) return;
    const dx = x - G.joy.x0, dy = y - G.joy.y0, d = Math.hypot(dx, dy), m = Math.min(1, d / 42);
    if (d > 4) { G.joy.dx = dx / d * m; G.joy.dy = dy / d * m; }
  }
  function up(G, x, y, api, e) { if (e.pointerType === 'mouse') G.mouseHeld = false; G.joy = null; }

  const KEYMAP = { ArrowLeft: [0, -1], a: [0, -1], A: [0, -1], ArrowRight: [0, 1], d: [0, 1], D: [0, 1], ArrowUp: [1, -1], w: [1, -1], W: [1, -1], ArrowDown: [1, 1], s: [1, 1], S: [1, 1] };

  /* ════════════════════════════════════════════════════════════════
     MENU — 1 · cenário → 2 · tamanho → 3 · modo → Jogar
  ════════════════════════════════════════════════════════════════ */
  const pickGet = () => { const p = store().getPref('pick', null) || {}; return { s: SCEN[p.s] ? p.s : 'city', n: SIZES.includes(p.n) ? p.n : 8, t: TYPES[p.t] ? p.t : 'battle' }; };
  const pickSet = ch => store().setPref('pick', Object.assign(pickGet(), ch));
  const diffNow = () => (typeof GameHost !== 'undefined' && GameHost.diffGet ? GameHost.diffGet('hole', 'medium') : 'medium');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const approx = n => (n < 1000 ? `${Math.round(n / 100) * 100}` : `${Math.round(n / 1000)} mil`);
  function typeDesc(s, n, t) {
    const c = modeCfg(s, n, t, diffNow()), vac = SCEN[s].vac, who = vac ? 'aspiradores' : 'buracos';
    return {
      battle: `${fmtT(c.time)} contra ${c.rivals} ${who}. Quem é engolido renasce.`,
      royale: `${c.rivals + 1} ${who} e ninguém renasce. Ganha o último — ou o maior aos ${fmtT(c.time)}.`,
      timed: `Sozinho, ${fmtT(c.time)}. Objetivo: ${vac ? 'limpar' : 'engolir'} ${c.goal}% ${vac ? 'da casa' : 'do mapa'}.`,
      zen: `Sozinho e sem relógio, com calma. Terminas quando quiseres (na pausa).`,
    }[t];
  }
  function pickerHTML(bestOf) {
    const p = pickGet(), S = SCEN[p.s];
    const scen = Object.keys(SCEN).map(k => `<button type="button" class="ak-mode${k === p.s ? ' on' : ''}" data-scen="${k}" aria-pressed="${k === p.s}">
        <span class="ak-mode-ico">${SCEN[k].icon}</span><span class="ak-mode-body"><b>${SCEN[k].name}</b><small>${esc(SCEN[k].desc)}</small></span></button>`).join('');
    const sizes = SIZES.map(n => `<button type="button" class="ak-chip${!S.fixed && n === p.n ? ' on' : ''}" data-size="${n}" aria-pressed="${!S.fixed && n === p.n}" ${S.fixed ? 'disabled' : ''} style="flex-direction:column;gap:0;min-width:74px;padding:7px 12px;border-radius:12px">
        <b style="font-size:.95rem">${n}×${n}</b><small style="font-size:.64rem;opacity:.75">${SIZE_NAME[n]}</small></button>`).join('');
    const note = S.fixed ? 'A casa tem sempre o mesmo tamanho: sala, cozinha, corredor, quarto e casa de banho.'
      : `${p.n * p.n} quarteirões · ≈ ${approx(p.n * p.n * S.per)} coisas para engolir${p.n >= 24 ? ' · mapa muito grande: em telemóveis mais fracos pode ficar pesado' : ''}`;
    const types = Object.keys(TYPES).map(t => {
      const b = bestOf(modeId(p.s, p.n, t));
      return `<button type="button" class="ak-mode${t === p.t ? ' on' : ''}" data-type="${t}" aria-pressed="${t === p.t}">
        <span class="ak-mode-ico">${TYPES[t].icon}</span><span class="ak-mode-body"><b>${TYPES[t].name}</b><small>${esc(typeDesc(p.s, p.n, t))}</small></span>
        <span class="ak-mode-best">Recorde<b>${b != null ? b : '—'}</b></span></button>`;
    }).join('');
    return `<div class="ak-h3" style="margin-top:4px">1 · Cenário</div><div class="ak-modes">${scen}</div>
      <div class="ak-h3">2 · Tamanho do mapa</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${sizes}</div>
      <div style="font-size:.74rem;color:var(--muted,#9aa);margin-top:8px">${note}</div>
      <div class="ak-h3">3 · Modo</div><div class="ak-modes">${types}</div>
      <button type="button" class="ak-play" data-go>▶ Jogar · ${S.name}${S.fixed ? '' : ` ${p.n}×${p.n}`} · ${TYPES[p.t].name}</button>`;
  }
  function pickerWire(el, start, bestOf) {
    const re = () => { el.innerHTML = pickerHTML(bestOf); pickerWire(el, start, bestOf); };
    el.querySelectorAll('[data-scen]').forEach(b => b.addEventListener('click', () => { pickSet({ s: b.dataset.scen }); re(); }));
    el.querySelectorAll('[data-size]:not([disabled])').forEach(b => b.addEventListener('click', () => { pickSet({ n: +b.dataset.size }); re(); }));
    el.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { pickSet({ t: b.dataset.type }); re(); }));
    el.querySelector('[data-go]').addEventListener('click', () => { const p = pickGet(); start(modeId(p.s, p.n, p.t)); });
  }

  function menuHTML() {
    const xp = store().getPref('xp', 0), lv = levelOf(xp), cur = store().getPref('skin', 'green');
    const a = xpFor(lv), b = xpFor(lv + 1), k = Math.round(100 * (xp - a) / Math.max(1, b - a));
    return `<div class="ak-h3" style="margin-top:4px">Nível ${lv} · ${xp} XP</div>
      <div style="height:8px;border-radius:99px;background:rgba(255,255,255,.08);margin-top:6px;overflow:hidden"><span style="display:block;height:100%;width:${k}%;background:linear-gradient(90deg,#22c55e,#22d3ee)"></span></div>
      <div style="font-size:.72rem;color:var(--muted,#9aa);margin-top:4px">${b - xp} XP para o nível ${lv + 1}. Cada ponto que fazes conta como XP.</div>
      <div class="ak-h3">Skin do buraco / aspirador</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;margin-top:8px">${SKINS.map(s => {
        const own = lv >= s.lvl, on = s.id === cur, bg = s.c === 'rainbow' ? 'conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)' : s.c;
        return `<button type="button" class="ak-chip${on ? ' on' : ''}" data-skin="${s.id}" ${own ? '' : 'disabled'} style="flex-direction:column;justify-content:center;padding:8px 4px;border-radius:12px;${own ? '' : 'opacity:.45;cursor:not-allowed'}">
          <span style="width:24px;height:24px;border-radius:50%;background:#0b0b12;box-shadow:0 0 0 3px ${s.c === 'rainbow' ? '#f59e0b' : s.c};display:block;${s.c === 'rainbow' ? `outline:3px solid transparent;background:radial-gradient(#0b0b12 55%,transparent 56%),${bg}` : ''}"></span>
          <span style="font-size:.74rem">${s.name}</span><small style="font-size:.62rem;opacity:.75">${own ? (on ? 'escolhida' : 'livre') : 'nível ' + s.lvl}</small></button>`; }).join('')}</div>`;
  }

  const meta = c => (c.result && c.result.meta) || {};
  return ArcadeKit.create({
    id: 'hole', title: 'Buraco Guloso', icon: '🕳️',
    accent: '#22c55e', accent2: '#22d3ee', bg: '#0b1220', aspect: 'wide', transparent: true,
    tagline: 'Cidades, aldeias, aeroportos e praias em 3D — ou uma casa — para engolir. Quanto mais comes, maior ficas.',
    view: { w: 560 },
    picker: { html: pickerHTML, wire: pickerWire },
    noDiff: m => /-zen$/.test(m || ''),
    how: [
      'Escolhe o <b>cenário</b>, o <b>tamanho do mapa</b> (de 6×6 a 30×30 quarteirões) e o <b>modo</b>: Batalha, Último de pé, Contra-relógio ou Passeio (sozinho e sem relógio).',
      '<b>PC:</b> setas ou WASD (ou mantém o botão do rato premido e aponta). Enquanto usas as setas, o rato não interfere. <b>Telemóvel:</b> põe o dedo em qualquer lado e arrasta — é um joystick.',
      'Só cabe o que for mais pequeno do que tu: pessoas e galinhas, depois carros e árvores, casas, aviões, prédios… Nas batalhas, quem for bem maior engole os outros buracos. Os pontos dão XP e desbloqueiam skins.',
    ],
    controls: ['⌨️ Setas / WASD', '🖱️ Botão premido + apontar', '👆 Joystick'],
    ready: { title: 'Toca para começar', hint: 'Engole o que for mais pequeno do que tu e cresce.' },
    menuHTML, menuWire: (el, rerender) => el.querySelectorAll('[data-skin]:not([disabled])').forEach(b => b.addEventListener('click', () => { store().setPref('skin', b.dataset.skin); rerender(); })),
    pauseButtons: (G, api) => (!G.M.rivals && !G.over ? [{ label: '🏁 Terminar e ver pontuação', fn: () => { api.resume(); finish(G, api, 'manual'); } }] : []),
    setup, update, draw, down, move, up, destroy,
    key: (G, e) => { const m = KEYMAP[e.key]; if (m) { G.keys[m[0]] = m[1]; G.joy = null; G.mouseHeld = false; return true; } },
    keyup: (G, e) => { const m = KEYMAP[e.key]; if (m && G.keys[m[0]] === m[1]) G.keys[m[0]] = 0; },
    hud: G => [isFinite(G.time) ? ['Tempo', Math.ceil(G.time) + 's', G.time < 11 ? 'hot' : ''] : [G.vac ? 'Limpo' : 'Engolido', pct(G) + '%'], ['Pontos', G.me.score], G.M.rivals ? ['Lugar', (ranking(G).indexOf(G.me) + 1) + '.º'] : G.M.goal ? [G.vac ? 'Limpo' : 'Engolido', pct(G) + '%'] : ['Tamanho', Math.round(G.me.R * 2)]],
    achievements: [
      { id: 'ho.win',    name: 'O Maior Buraco',   icon: '🕳️', desc: 'Acaba em 1.º lugar numa Batalha (fora da casa).', test: c => meta(c).type === 'battle' && !meta(c).vac && meta(c).pos === 1 },
      { id: 'ho.royale', name: 'Último de Pé',     icon: '👑', desc: 'Ganha um Último de pé.', test: c => meta(c).type === 'royale' && meta(c).pos === 1 },
      { id: 'ho.vac',    name: 'Aspirador de Ouro', icon: '🧹', desc: 'Ganha uma batalha de aspiradores.', test: c => meta(c).vac && meta(c).type === 'battle' && meta(c).pos === 1 },
      { id: 'ho.city',   name: 'Mapa Engolido',    icon: '🌆', desc: 'Engole 80% de um cenário no Passeio.', test: c => meta(c).type === 'zen' && !meta(c).vac && (meta(c).clean || 0) >= 80 },
      { id: 'ho.clean',  name: 'Casa a Brilhar',   icon: '✨', desc: 'Deixa a casa 80% limpa.', test: c => meta(c).vac && (meta(c).clean || 0) >= 80 },
      { id: 'ho.goal',   name: 'Contra o Relógio', icon: '🎯', desc: 'Cumpre o objetivo de um Contra-relógio.', test: c => meta(c).type === 'timed' && meta(c).goalOk },
      { id: 'ho.travel', name: 'Volta ao Mundo',   icon: '🧭', desc: 'Joga em todos os cenários.', test: c => (meta(c).seen || 0) >= Object.keys(SCEN).length },
      { id: 'ho.giant',  name: 'Buraco Negro',     icon: '🌌', desc: 'Chega a tamanho 300 num mapa de 18×18 ou maior.', test: c => (meta(c).size || 0) >= 18 && (meta(c).R || 0) * 2 >= 300 },
    ],
  });
})();
