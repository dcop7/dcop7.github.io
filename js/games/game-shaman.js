/* ══════════════════════════════════════════════════════════════════
   Terra dos Xamãs — jogo de deus e estratégia em 3D (out/2026)
   Uma xamã guia a sua tribo por 6 ilhas: os aldeões cortam madeira e
   erguem cabanas, quartéis, templos do fogo e torres; a tribo cresce e
   gera mana; a xamã gasta-a em feitiços que mudam a própria terra —
   pontes de terra, terramotos, tornados e vulcões — para vencer as tribos
   rivais. Níveis curtos (5–10 min). Inspirado no género "god game" dos
   anos 90, com mundo, nomes, tribos e feitiços próprios.

   Técnica: terreno deformável (grelha 128×128 de 3 m) com A* sobre as
   células; unidades em InstancedMesh (corpo + túnica com a cor da tribo);
   céu, água e partículas reaproveitados de sky-ace-world.js.
   Comandos: clique esquerdo seleciona (arrastar = caixa), direito dá
   ordens; WASD/setas move a câmara, Q/E roda, roda do rato aproxima;
   1–8 feitiços, Espaço = xamã. No toque: toque seleciona/ordena, arrastar
   move, dois dedos aproximam e rodam.
══════════════════════════════════════════════════════════════════ */
const ShamanGame = (function () {
  'use strict';
  const Ut = ArcadeKit.U, TAU = Math.PI * 2;
  const clamp = Ut.clamp, lerp = Ut.lerp, rand = Ut.rand;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const W = () => SkyAceWorld;
  const ID = 'shaman';
  const S = 384, N = 128, CELL = S / N, H0 = -S / 2;

  /* ════════════════════════════════════════════════════════════════
     tribos, unidades, edifícios, feitiços
  ════════════════════════════════════════════════════════════════ */
  const TRIBES = [
    { name: 'Tribo da Aurora', short: 'Aurora', color: '#3b82f6', light: '#93c5fd' },
    { name: 'Tribo do Basalto', short: 'Basalto', color: '#dc2626', light: '#fca5a5' },
    { name: 'Tribo do Âmbar', short: 'Âmbar', color: '#eab308', light: '#fde68a' },
    { name: 'Tribo do Musgo', short: 'Musgo', color: '#16a34a', light: '#86efac' },
  ];
  const WILD_COLOR = '#b08a5a';
  const UT = {
    brave: { name: 'Aldeão', hp: 55, spd: 5.2, dmg: 2.5, rate: 1, range: 1.8 },
    warrior: { name: 'Guerreiro', hp: 130, spd: 5.6, dmg: 11, rate: .85, range: 1.9, cost: 60 },
    fire: { name: 'Arqueiro de fogo', hp: 70, spd: 5.4, dmg: 13, rate: 1.7, range: 17, cost: 85, ranged: 1 },
    shaman: { name: 'Xamã', hp: 160, spd: 5.8, dmg: 5, rate: 1, range: 1.9 },
    wild: { name: 'Nómada', hp: 40, spd: 3.6, dmg: 0, rate: 1, range: 1.5 },
  };
  const BT = {
    hut: { name: 'Cabana', wood: 4, hp: 240, r: 3.6, foot: 1, pop: 4, desc: 'Abriga 4 pessoas e faz nascer aldeões.' },
    barracks: { name: 'Quartel', wood: 6, hp: 320, r: 4.6, foot: 2, desc: 'Treina guerreiros (60 de mana).' },
    temple: { name: 'Templo do Fogo', wood: 7, hp: 300, r: 4.4, foot: 2, desc: 'Treina arqueiros de fogo (85 de mana).' },
    tower: { name: 'Torre', wood: 4, hp: 280, r: 2.4, foot: 1, desc: 'Atira contra inimigos próximos.' },
    stone: { name: 'Pedra do Renascer', wood: 0, hp: 450, r: 4.2, foot: 2, desc: 'Enquanto existir, a xamã renasce.' },
  };
  const SP = {
    blast: { name: 'Sopro', cost: 35, range: 34, r: 7, key: 1, desc: 'Rajada que empurra e fere inimigos.' },
    bolt: { name: 'Raio', cost: 75, range: 40, r: 3.5, key: 2, desc: 'Um raio fulmina um alvo.' },
    convert: { name: 'Converter', cost: 45, range: 30, r: 9, key: 3, desc: 'Nómadas (e aldeões inimigos fracos) juntam-se a ti.' },
    swarm: { name: 'Enxame', cost: 70, range: 36, r: 10, key: 4, desc: 'Insetos põem os inimigos em fuga.' },
    bridge: { name: 'Ponte de terra', cost: 110, range: 60, r: 0, key: 5, desc: 'Ergue uma faixa de terra até ao ponto escolhido.' },
    quake: { name: 'Terramoto', cost: 170, range: 44, r: 16, key: 6, desc: 'Racha o chão e derruba edifícios.' },
    tornado: { name: 'Tornado', cost: 200, range: 44, r: 10, key: 7, desc: 'Um ciclone arrasa tudo no caminho.' },
    volcano: { name: 'Vulcão', cost: 330, range: 46, r: 22, key: 8, desc: 'Ergue uma montanha de lava.' },
  };
  const SP_ORDER = ['blast', 'bolt', 'convert', 'swarm', 'bridge', 'quake', 'tornado', 'volcano'];

  /* ════════════════════════════════════════════════════════════════
     níveis — ilhas como "bolhas" [x, z, raio, altura]
  ════════════════════════════════════════════════════════════════ */
  const LEVELS = [
    { id: 'L1', name: 'Primeira Luz', sky: 'morning', seed: 3, islands: [[0, 0, 150, 9]],
      tribes: [{ t: 0, x: -70, z: 50, braves: 4 }], wild: [{ n: 12, x: 60, z: -50, r: 45 }],
      spells: ['blast', 'convert'], goal: { kind: 'grow', convert: 8, huts: 3 },
      brief: 'Converte nómadas e ergue a tua aldeia: 8 conversões e 3 cabanas.',
      tips: ['Seleciona a xamã (Espaço) e usa Converter (3) junto dos nómadas.', 'Com aldeões selecionados, escolhe Cabana e clica no chão para construir.'] },
    { id: 'L2', name: 'Vizinhos Hostis', sky: 'noon', seed: 11, islands: [[0, 0, 170, 10]],
      tribes: [{ t: 0, x: -95, z: 70, braves: 6 }, { t: 1, x: 95, z: -75, braves: 6, ai: { lvl: 1, wave: 130, army: 4, build: ['hut', 'hut', 'barracks', 'hut'] } }],
      wild: [{ n: 8, x: 0, z: 0, r: 50 }], spells: ['blast', 'bolt', 'convert'], goal: { kind: 'conquer' },
      brief: 'A Tribo do Basalto partilha a ilha. Cresce, treina guerreiros e expulsa-os.',
      tips: ['Constrói um Quartel e treina guerreiros (botão Treinar).', 'Clique direito num inimigo para atacar; o Raio (2) fulmina-os.'] },
    { id: 'L3', name: 'Além do Estreito', sky: 'afternoon', seed: 21, islands: [[-95, 55, 115, 9], [110, -70, 100, 10], [20, 140, 40, 5]],
      tribes: [{ t: 0, x: -105, z: 60, braves: 7 }, { t: 1, x: 115, z: -75, braves: 7, ai: { lvl: 2, wave: 150, army: 5, build: ['hut', 'barracks', 'hut', 'tower', 'hut'] } }],
      wild: [{ n: 6, x: 20, z: 140, r: 20 }], spells: ['blast', 'bolt', 'convert', 'swarm', 'bridge'], goal: { kind: 'conquer' },
      brief: 'O inimigo está noutra ilha. Ergue uma ponte de terra e leva a guerra até lá.',
      tips: ['Ponte de terra (5): a xamã faz uma faixa de terra até onde clicares.', 'O Enxame (4) desorganiza grupos de inimigos.'] },
    { id: 'L4', name: 'Terra Tremida', sky: 'overcast', seed: 33, islands: [[-60, 60, 140, 10], [100, -90, 95, 12]],
      tribes: [{ t: 0, x: -90, z: 90, braves: 8 }, { t: 2, x: 105, z: -95, braves: 8, ai: { lvl: 3, wave: 120, army: 6, fire: 1, shaman: 1, build: ['hut', 'barracks', 'temple', 'hut', 'tower', 'hut', 'tower'] } }],
      wild: [{ n: 6, x: 10, z: -10, r: 40 }], spells: ['blast', 'bolt', 'convert', 'swarm', 'bridge', 'quake'], goal: { kind: 'conquer' },
      brief: 'A Tribo do Âmbar tem arqueiros de fogo e uma xamã. Os terramotos derrubam muralhas.',
      tips: ['Templo do Fogo treina arqueiros de fogo — atacam de longe.', 'O Terramoto (6) derruba edifícios inimigos.'] },
    { id: 'L5', name: 'Ventos de Guerra', sky: 'sunset', seed: 47, islands: [[-110, 90, 95, 9], [110, 90, 90, 10], [0, -100, 110, 11]],
      tribes: [{ t: 0, x: 0, z: -110, braves: 9 }, { t: 1, x: -115, z: 95, braves: 6, ai: { lvl: 2, wave: 170, army: 6, fire: 1, build: ['hut', 'barracks', 'hut', 'temple'] } }, { t: 3, x: 115, z: 95, braves: 6, ai: { lvl: 3, wave: 190, army: 7, shaman: 1, build: ['hut', 'barracks', 'hut', 'tower'] } }],
      wild: [{ n: 5, x: 0, z: 60, r: 30 }], spells: ['blast', 'bolt', 'convert', 'swarm', 'bridge', 'quake', 'tornado'], goal: { kind: 'conquer' },
      brief: 'Duas tribos ao mesmo tempo. Os tornados são a tua melhor arma.',
      tips: ['O Tornado (7) avança e arrasa cabanas pelo caminho.'] },
    { id: 'L6', name: 'Coração de Fogo', sky: 'night', seed: 59, islands: [[-80, 80, 125, 10], [95, -85, 120, 12], [120, 110, 45, 6]],
      tribes: [{ t: 0, x: -95, z: 100, braves: 10 }, { t: 1, x: 100, z: -95, braves: 10, ai: { lvl: 4, wave: 110, army: 8, fire: 1, shaman: 1, build: ['hut', 'barracks', 'temple', 'hut', 'tower', 'hut', 'tower', 'hut'] } }],
      wild: [{ n: 8, x: 120, z: 110, r: 25 }], spells: SP_ORDER, goal: { kind: 'conquer' },
      brief: 'A batalha final, sob as estrelas. Tens todos os feitiços — incluindo o Vulcão.',
      tips: ['O Vulcão (8) ergue uma montanha de lava no meio da base inimiga.'] },
  ];

  /* ── gravação ── */
  const SAVE = 'shaman:save';
  const save = () => { try { return Object.assign({ u: 1, best: {} }, JSON.parse(localStorage.getItem(SAVE)) || {}); } catch (e) { return { u: 1, best: {} }; } };
  const putSave = v => { try { localStorage.setItem(SAVE, JSON.stringify(v)); } catch (e) {} };

  /* ════════════════════════════════════════════════════════════════
     terreno: alturas nos vértices (N+1)², células N²
  ════════════════════════════════════════════════════════════════ */
  function genTerrain(L) {
    const Wd = W(), n1 = Wd.perlin(L.seed), n2 = Wd.perlin(L.seed + 7), n3 = Wd.perlin(L.seed + 13);
    const h = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = H0 + i * CELL, z = H0 + j * CELL;
      let best = -6;
      L.islands.forEach(([cx, cz, r, hh]) => {
        const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
        const rr = r * (1 + n1(Math.cos(a) * 1.3 + cx * .01, Math.sin(a) * 1.3 + cz * .01) * .22);
        const k = 1 - sstep(.5, 1.02, d / rr);
        const ridge = 1 - Math.abs(n3(x / 70 + cx * .01, z / 70)); const hill = Math.max(0, n2(x / 55, z / 55)) * 9 + ridge * ridge * ridge * 10 * sstep(.15, .5, k);
        const v = -6 + k * (hh + 6) + k * (hill + n3(x / 16, z / 16) * 1.1);
        if (v > best) best = v;
      });
      h[j * (N + 1) + i] = best;
    }
    /* planaltos nas bases das tribos (sítio para construir) */
    L.tribes.forEach(tb => flattenAt(h, tb.x, tb.z, 34, null));
    return h;
  }
  function flattenAt(h, x, z, r, target) {
    let sum = 0, n = 0;
    forVerts(x, z, r, (k, d) => { if (d < r * .5) { sum += h[k]; n++; } });
    const t = target != null ? target : Math.max(2.2, n ? sum / n : 3);
    forVerts(x, z, r, (k, d) => { const w = 1 - sstep(r * .55, r, d); h[k] = lerp(h[k], t, w); });
  }
  function forVerts(x, z, r, fn) {
    const i0 = Math.max(0, Math.floor((x - r - H0) / CELL)), i1 = Math.min(N, Math.ceil((x + r - H0) / CELL));
    const j0 = Math.max(0, Math.floor((z - r - H0) / CELL)), j1 = Math.min(N, Math.ceil((z + r - H0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const vx = H0 + i * CELL, vz = H0 + j * CELL, d = Math.hypot(vx - x, vz - z); if (d <= r) fn(j * (N + 1) + i, d, vx, vz); }
  }
  function hAt(G, x, z) {
    const gx = clamp((x - H0) / CELL, 0, N - 1e-4), gz = clamp((z - H0) / CELL, 0, N - 1e-4), i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, h = G.h, w = N + 1, k = j * w + i;
    return lerp(lerp(h[k], h[k + 1], fx), lerp(h[k + w], h[k + w + 1], fx), fz);
  }
  const cellOf = (x, z) => [clamp(Math.floor((x - H0) / CELL), 0, N - 1), clamp(Math.floor((z - H0) / CELL), 0, N - 1)];
  const cellC = (i, j) => [H0 + (i + .5) * CELL, H0 + (j + .5) * CELL];
  function cellH(G, i, j) { const h = G.h, w = N + 1, k = j * w + i; return (h[k] + h[k + 1] + h[k + w] + h[k + w + 1]) / 4; }
  function walk(G, i, j) { return i >= 0 && j >= 0 && i < N && j < N && G.land[j * N + i] && !G.block[j * N + i]; }
  function updLand(G, i0, j0, i1, j1) {
    for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) G.land[j * N + i] = cellH(G, i, j) > .35 ? 1 : 0;
  }

  /* malha do terreno (refeita quando a terra muda) */
  const TCOL = { sand: '#d8c690', grass: '#6c9a3e', grass2: '#86a94a', dirt: '#8a6a45', rock: '#7d756b', deep: '#1c5566', burnt: '#2f2622', lava: '#ff5a1a' };
  function buildTerrainMesh(G) {
    const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
    const col = new Float32Array(geo.attributes.position.count * 3); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tex = W().canvasTex(128, 128, (x) => { const img = x.createImageData(128, 128), d = img.data; for (let k = 0; k < d.length; k += 4) { const v = 215 + Math.random() * 40; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255; } x.putImageData(img, 0, 0); });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(70, 70);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: .95, metalness: 0, envMapIntensity: .3 });
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true;
    G.tm = m; G.tcol = {}; Object.keys(TCOL).forEach(k => { G.tcol[k] = new THREE.Color(TCOL[k]); });
    refreshTerrain(G);
    return m;
  }
  function refreshTerrain(G) {
    const geo = G.tm.geometry, pos = geo.attributes.position, col = geo.attributes.color, C = G.tcol, c = new THREE.Color(), n1 = G.noise;
    for (let k = 0; k < pos.count; k++) pos.setY(k, Math.max(G.h[k], -6.5));
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    for (let k = 0; k < pos.count; k++) {
      const y = G.h[k], ny = nor.getY(k), x = pos.getX(k), z = pos.getZ(k), v = n1(x / 40, z / 40) * .5 + .5;
      if (y < .6) c.copy(C.sand).lerp(C.deep, sstep(.2, -4, y));
      else { c.copy(C.grass).lerp(C.grass2, v); c.lerp(C.dirt, sstep(.62, .78, n1(x / 9, z / 9) * .5 + .5) * .35); if (y < 1.4) c.lerp(C.sand, sstep(1.4, .6, y)); c.lerp(C.rock, Math.min(1, sstep(.86, .66, ny) * .95 + sstep(11, 19, y) * .7)); }
      const sc = G.scorch[k]; if (sc > 0) c.lerp(C.burnt, Math.min(1, sc));
      const lv = G.lava[k]; if (lv > 0) c.lerp(C.lava, Math.min(1, lv));
      col.setXYZ(k, c.r, c.g, c.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true; geo.computeBoundingSphere();
    G.dirtyT = false;
  }

  /* ════════════════════════════════════════════════════════════════
     A* sobre as células (8 direções), com caminho alisado
  ════════════════════════════════════════════════════════════════ */
  let _open = null, _g = null, _came = null, _closed = null, _stamp = 0;
  function nearestWalk(G, i, j, maxR) {
    if (walk(G, i, j)) return [i, j];
    for (let r = 1; r <= (maxR || 12); r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; if (walk(G, i + di, j + dj)) return [i + di, j + dj]; }
    return null;
  }
  function findPath(G, x0, z0, x1, z1) {
    const M = N * N;
    if (!_g) { _g = new Float32Array(M); _came = new Int32Array(M); _closed = new Uint32Array(M); _open = new Uint32Array(M); }
    _stamp++;
    let [si, sj] = cellOf(x0, z0), [gi, gj] = cellOf(x1, z1);
    const s0 = nearestWalk(G, si, sj, 4); if (!s0) return null; [si, sj] = s0;
    const g0 = nearestWalk(G, gi, gj, 10); if (!g0) return null; [gi, gj] = g0;
    const start = sj * N + si, goal = gj * N + gi;
    if (start === goal) return [[x1, z1]];
    /* heap binário de índices, prioridade f guardada à parte */
    const f = G._f || (G._f = new Float32Array(M)), heap = _open; let hn = 0;
    const push = id => { let k = hn++; heap[k] = id; while (k > 0) { const p = (k - 1) >> 1; if (f[heap[p]] <= f[heap[k]]) break; const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; } };
    const pop = () => { const top = heap[0]; heap[0] = heap[--hn]; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < hn && f[heap[l]] < f[heap[m]]) m = l; if (r < hn && f[heap[r]] < f[heap[m]]) m = r; if (m === k) break; const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m; } return top; };
    const seen = G._seen || (G._seen = new Uint32Array(M));
    const hh = (i, j) => { const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return (dx + dz) + (1.414 - 2) * Math.min(dx, dz); };
    _g[start] = 0; seen[start] = _stamp; _came[start] = -1; f[start] = hh(si, sj); push(start);
    let found = false, iter = 0;
    while (hn && iter++ < 20000) {
      const cur = pop(); if (_closed[cur] === _stamp) continue; _closed[cur] = _stamp;
      if (cur === goal) { found = true; break; }
      const ci = cur % N, cj = (cur / N) | 0;
      for (let d = 0; d < 8; d++) {
        const di = [1, -1, 0, 0, 1, 1, -1, -1][d], dj = [0, 0, 1, -1, 1, -1, 1, -1][d], ni = ci + di, nj = cj + dj;
        if (!walk(G, ni, nj)) continue;
        if (di && dj && (!walk(G, ci + di, cj) || !walk(G, ci, cj + dj))) continue;
        const id = nj * N + ni; if (_closed[id] === _stamp) continue;
        const ng = _g[cur] + (di && dj ? 1.414 : 1) + Math.abs(cellH(G, ni, nj) - cellH(G, ci, cj)) * .15;
        if (seen[id] !== _stamp || ng < _g[id]) { seen[id] = _stamp; _g[id] = ng; _came[id] = cur; f[id] = ng + hh(ni, nj); push(id); }
      }
    }
    if (!found) return null;
    const cells = []; for (let c = goal; c !== -1; c = _came[c]) cells.push(c); cells.reverse();
    /* alisar: saltar pontos com linha de vista */
    const pts = cells.map(c => cellC(c % N, (c / N) | 0)), out = [];
    let a = 0;
    while (a < pts.length - 1) { let b = pts.length - 1; while (b > a + 1 && !los(G, pts[a], pts[b])) b--; out.push(pts[b]); a = b; }
    if (out.length) out[out.length - 1] = walk(G, ...cellOf(x1, z1)) ? [x1, z1] : out[out.length - 1];
    return out;
  }
  function los(G, a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / (CELL * .5));
    for (let k = 1; k < n; k++) { const t = k / n, [i, j] = cellOf(lerp(a[0], b[0], t), lerp(a[1], b[1], t)); if (!walk(G, i, j)) return false; }
    return true;
  }

  /* ════════════════════════════════════════════════════════════════
     modelos
  ════════════════════════════════════════════════════════════════ */
  function personGeos(kind) {
    const Wd = W(), M4 = Wd.M4, base = [], tint = [];
    const skin = kind === 'wild' ? '#c69a6a' : '#d9a77c', dark = '#4a3424';
    /* pernas, braços, cabeça */
    base.push([new THREE.CylinderGeometry(.17, .14, .95, 6), dark, M4(-.2, .48, 0)], [new THREE.CylinderGeometry(.17, .14, .95, 6), dark, M4(.2, .48, 0)]);
    base.push([new THREE.SphereGeometry(.34, 10, 8), skin, M4(0, 2.08, 0)]);
    base.push([new THREE.CylinderGeometry(.12, .1, .85, 6), skin, M4(-.52, 1.38, 0, 0, 0, .25)], [new THREE.CylinderGeometry(.12, .1, .85, 6), skin, M4(.52, 1.38, 0, 0, 0, -.25)]);
    base.push([new THREE.SphereGeometry(.36, 10, 6, 0, TAU, 0, Math.PI / 2), kind === 'wild' ? '#6b4a2a' : '#2a1a10', M4(0, 2.14, -.02)]);
    /* túnica (cor da tribo) */
    tint.push([new THREE.CylinderGeometry(.42, .58, 1.15, 8), '#ffffff', M4(0, 1.42, 0)]);
    if (kind === 'warrior') {
      tint.push([new THREE.CylinderGeometry(.55, .55, .12, 12), '#ffffff', M4(-.6, 1.4, .25, Math.PI / 2, 0, 0)]);
      base.push([new THREE.SphereGeometry(.4, 10, 6, 0, TAU, 0, Math.PI / 2), '#8a8f96', M4(0, 2.18, 0)]);
      base.push([new THREE.CylinderGeometry(.07, .12, 1.4, 6), '#6b4a2a', M4(.62, 1.6, .2, .5, 0, 0)]);
    } else if (kind === 'fire') {
      tint.push([new THREE.TorusGeometry(.33, .07, 6, 12), '#ffffff', M4(0, 2.2, 0, Math.PI / 2, 0, 0)]);
      base.push([new THREE.ConeGeometry(.16, .5, 6), '#ff7a1a', M4(.6, 2.0, .15)]);
      base.push([new THREE.CylinderGeometry(.05, .05, .9, 5), '#5a3a22', M4(.6, 1.5, .15)]);
    } else if (kind === 'shaman') {
      tint.push([new THREE.CylinderGeometry(.44, .8, 1.9, 10), '#ffffff', M4(0, 1.05, 0)]);
      for (let i = 0; i < 7; i++) { const a = (i - 3) * .28; tint.push([new THREE.ConeGeometry(.1, .9, 4), '#ffffff', M4(Math.sin(a) * .35, 2.6, -.12 + Math.cos(a) * .05 - .05, 0, 0, -a)]); }
      base.push([new THREE.CylinderGeometry(.06, .07, 2.8, 6), '#6b4a2a', M4(.7, 1.4, .1)]);
      base.push([new THREE.IcosahedronGeometry(.22, 0), '#7df9ff', M4(.7, 2.9, .1)]);
    } else if (kind === 'wild') {
      base.push([new THREE.CylinderGeometry(.05, .05, 1.6, 5), '#5a3a22', M4(.55, 1.2, 0)]);
    }
    const S1 = 1.55;
    const g1 = Wd.mergeGeos(base), g2 = Wd.mergeGeos(tint);
    g1.scale(S1, S1, S1); g2.scale(S1, S1, S1);
    return [g1, g2];
  }

  function buildingMesh(G, k, tribe) {
    const Wd = W(), env = G.r3.env, g = new THREE.Group();
    const col = tribe >= 0 ? TRIBES[tribe].color : '#999999';
    const wood = Wd.plainMat('#8a5e3a', env, { metalness: 0, roughness: .85 }), straw = Wd.plainMat('#c9a35a', env, { metalness: 0, roughness: .9 }), stone = Wd.plainMat('#9a958c', env, { metalness: 0, roughness: .9 }), tc = Wd.plainMat(col, env, { metalness: .05, roughness: .6 }), dark = Wd.plainMat('#2a1d14', env, { metalness: 0, roughness: 1 });
    const add = (geo, mat, x, y, z, o) => Wd.addMesh(g, geo, mat, x, y, z, o);
    if (k === 'hut') {
      add(new THREE.CylinderGeometry(3, 3.2, 2.8, 12), wood, 0, 1.4, 0);
      add(new THREE.ConeGeometry(3.9, 3.4, 12), straw, 0, 4.4, 0);
      add(new THREE.PlaneGeometry(1.3, 1.9), dark, 0, .95, 3.12);
      add(new THREE.CylinderGeometry(.08, .08, 2.2, 5), wood, 0, 6.7, 0);
      add(new THREE.PlaneGeometry(1.4, .8), tc, .7, 7.3, 0, { ry: 0 }).material.side = THREE.DoubleSide;
      add(new THREE.TorusGeometry(3.3, .12, 6, 20), tc, 0, 2.75, 0, { rx: Math.PI / 2 });
    } else if (k === 'barracks') {
      add(new THREE.BoxGeometry(9, 3.2, 6), wood, 0, 1.6, 0);
      const roof = new THREE.CylinderGeometry(4.2, 4.2, 9.6, 3, 1); roof.rotateZ(Math.PI / 2); roof.scale(1, .55, 1);
      add(roof, straw, 0, 4.2, 0);
      [-2.8, 0, 2.8].forEach(x => add(new THREE.CylinderGeometry(.8, .8, .14, 12), tc, x, 1.9, 3.08, { rx: Math.PI / 2 }));
      add(new THREE.PlaneGeometry(1.6, 2.2), dark, 0, 1.1, 3.02);
      add(new THREE.CylinderGeometry(.18, .2, 2.4, 6), wood, 5.6, 1.2, 2);
    } else if (k === 'temple') {
      add(new THREE.BoxGeometry(9, 1.6, 9), stone, 0, .8, 0); add(new THREE.BoxGeometry(6.6, 1.6, 6.6), stone, 0, 2.4, 0); add(new THREE.BoxGeometry(4.2, 1.6, 4.2), stone, 0, 4, 0);
      add(new THREE.CylinderGeometry(1.4, .9, .8, 10), dark, 0, 5.2, 0);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(.9, 2.2, 8), Wd.glowM('#ff8a2a', .85)); fl.position.set(0, 6.6, 0); fl.name = 'flame'; g.add(fl);
      [[4.6, 0], [-4.6, 0], [0, 4.6], [0, -4.6]].forEach(([x, z]) => add(new THREE.BoxGeometry(x ? .1 : 2, 2.4, z ? .1 : 2), tc, x, 2, z));
    } else if (k === 'tower') {
      [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(([x, z]) => add(new THREE.CylinderGeometry(.2, .25, 8, 6), wood, x, 4, z));
      add(new THREE.BoxGeometry(3.6, .4, 3.6), wood, 0, 7.8, 0);
      add(new THREE.ConeGeometry(2.8, 2.4, 4), tc, 0, 9.4, 0, { ry: Math.PI / 4 });
      add(new THREE.BoxGeometry(3.4, .9, .15), wood, 0, 8.4, 1.7); add(new THREE.BoxGeometry(3.4, .9, .15), wood, 0, 8.4, -1.7);
    } else if (k === 'stone') {
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; add(new THREE.BoxGeometry(1, 3.6 + (i % 2) * .8, .7), stone, Math.cos(a) * 3.6, 1.8, Math.sin(a) * 3.6, { ry: -a }); }
      add(new THREE.CylinderGeometry(1.6, 1.8, .5, 14), stone, 0, .25, 0);
      const o = new THREE.Mesh(new THREE.IcosahedronGeometry(.9, 1), Wd.glowM(TRIBES[Math.max(0, tribe)].light)); o.position.y = 2.2; o.name = 'orb'; g.add(o);
    } else if (k === 'ruin') {
      for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(rand(.8, 2.2), rand(.3, .9), rand(.8, 2)), dark, rand(-2.5, 2.5), .3, rand(-2.5, 2.5), { ry: rand(0, 3) });
    }
    return g;
  }

  /* ════════════════════════════════════════════════════════════════
     construção da partida
  ════════════════════════════════════════════════════════════════ */
  function setup(api, o) {
    const li = Math.max(0, LEVELS.findIndex(l => l.id === o.mode)), L = LEVELS[li];
    const G = {
      li, L, api, t: 0, time: 0, ok: false, won: false, lost: false, endT: 0,
      units: [], builds: [], trees: [], fx: [], projs: [], storms: [], uid: 1,
      tribes: L.tribes.map(tb => ({ idx: tb.t, mana: 120, conv: 0, kills: 0, alive: true, ai: tb.ai ? Object.assign({ tick: 0, waveT: tb.ai.wave, bi: 0, castT: 6 }, tb.ai) : null, base: [tb.x, tb.z], shamanT: 0 })),
      sel: new Set(), mode: null, ptr: { x: 0, y: 0, wx: 0, wz: 0, ok: false }, keys: {}, msg: [], tipT: 0, tipI: 0,
      cam: { x: L.tribes[0].x, z: L.tribes[0].z, yaw: Math.atan2(L.tribes[0].x, L.tribes[0].z), dist: 80, tdist: 80 },
      shake: 0, touch: false, tp: new Map(),
    };
    G.player = G.tribes[0];
    if (typeof SkyAceWorld === 'undefined' || !(SkyAceWorld.V >= 3)) { G.fail3d = true; G.failMsg = 'O browser usou uma versão antiga do jogo — recarrega a página (Ctrl+Shift+R).'; return G; }
    Arcade3D.load().then(() => { try { build(G, api); } catch (e) { console.warn('[xamãs] 3D falhou', e); G.fail3d = true; G.failMsg = 'Erro: ' + (e && e.message || e); } }).catch(() => { G.fail3d = true; G.failMsg = 'Não foi possível carregar o motor 3D.'; });
    return G;
  }
  const tribeOf = (G, t) => G.tribes.find(x => x.idx === t);

  function build(G, api) {
    const Wd = W(), L = G.L, sky = Object.assign({}, Wd.SKIES[L.sky]);
    sky.fogNear = 260; sky.fogFar = 1100;
    const coarse = Arcade3D.coarse();
    const renderer = Arcade3D.attach(api.stage); renderer.toneMappingExposure = sky.exp;
    const scene = new THREE.Scene(), env = Wd.skyEnv(renderer, sky); scene.environment = env;
    scene.fog = new THREE.Fog(sky.hor, sky.fogNear, sky.fogFar);
    const hemi = new THREE.HemisphereLight(sky.hemiSky, sky.hemiGnd, sky.hemi * 1.05), sun = new THREE.DirectionalLight(sky.sun, sky.sunI);
    sun.castShadow = true; sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048); sun.shadow.bias = -.0005; sun.shadow.normalBias = .4;
    scene.add(hemi, sun, sun.target);
    const flash = new THREE.PointLight('#ffd08a', 0, 120, 1.5); scene.add(flash);
    const cam = new THREE.PerspectiveCamera(45, 1, .5, 4000);
    const skyM = Wd.skyMesh(sky); scene.add(skyM);
    G.r3 = { renderer, scene, cam, sun, sunDir: new THREE.Vector3(...sky.sunDir).normalize(), env, sky, skyM, flash, coarse, inst: {}, dpr: 0, w: 0, h: 0 };
    G.noise = Wd.perlin(L.seed + 99);
    G.h = genTerrain(L);
    const NV = (N + 1) * (N + 1);
    G.scorch = new Float32Array(NV); G.lava = new Float32Array(NV);
    G.land = new Uint8Array(N * N); G.block = new Uint8Array(N * N);
    updLand(G, 0, 0, N - 1, N - 1);
    scene.add(buildTerrainMesh(G));
    /* água */
    const water = Wd.buildWater({ water: L.sky === 'night' ? '#0e2c44' : '#1d6a80' }, env);
    water.material.normalMap.repeat.set(9000, 9000); water.material.opacity = .86; water.position.y = 0; scene.add(water); G.r3.water = water;
    /* nuvens baixas (ficam por cima da ilha) */
    const clouds = Wd.buildClouds(sky, L.seed, coarse ? .5 : 1, { area: 1400, alt: [120, 220], R: [30, 70], n: 26 }); scene.add(clouds.mesh); G.r3.clouds = clouds;
    G.r3.smoke = Wd.particles(scene, coarse ? 2500 : 5000, false, sky); G.r3.fire = Wd.particles(scene, coarse ? 1800 : 3500, true, sky);
    G.r3.smoke.mat.uniforms.uLight.value.set(sky.stars ? .5 : 1, sky.stars ? .55 : 1, sky.stars ? .7 : 1);
    /* árvores */
    const tg = Wd.treeGeo(L.sky === 'night' ? 'pine' : L.seed % 2 ? 'leaf' : 'pine');
    const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true, envMapIntensity: .3 });
    const TMAX = 700, tim = new THREE.InstancedMesh(tg, tmat, TMAX); tim.castShadow = true; tim.receiveShadow = true; tim.frustumCulled = false;
    const rn = Wd.rng(L.seed * 7 + 1), tc = new THREE.Color();
    for (let k = 0; k < 5000 && G.trees.length < TMAX; k++) {
      const x = (rn() - .5) * S * .95, z = (rn() - .5) * S * .95, y = hAt(G, x, z);
      if (y < 1.2 || y > 17 || G.noise(x / 46, z / 46) + G.noise(x / 13, z / 13) * .25 < .12) continue;
      if (L.tribes.some(tb => Math.hypot(tb.x - x, tb.z - z) < 26)) continue;
      const tr = { i: G.trees.length, x, z, wood: 3, max: 3, s: rand(.42, .66), alive: true, regrow: 0, fall: 0 };
      G.trees.push(tr); tc.set('#3f7a2e').lerp(new THREE.Color('#8fb04a'), rn() * .6); tim.setColorAt(tr.i, tc);
    }
    tim.count = G.trees.length; scene.add(tim); G.r3.trees = tim; treesDirty(G);
    /* unidades: 2 malhas instanciadas por tipo (corpo + túnica) */
    const umat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75, metalness: 0, envMapIntensity: .4 }), umat2 = umat.clone();
    Object.keys(UT).forEach(k => {
      const [g1, g2] = personGeos(k), cap = k === 'shaman' ? 8 : 400;
      const a = new THREE.InstancedMesh(g1, umat, cap), b = new THREE.InstancedMesh(g2, umat2, cap);
      [a, b].forEach(m => { m.castShadow = true; m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); });
      b.setColorAt(0, new THREE.Color('#fff'));
      G.r3.inst[k] = [a, b];
    });
    /* anéis de seleção */
    const ring = new THREE.InstancedMesh(new THREE.TorusGeometry(1.25, .1, 5, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7df9ff', toneMapped: false, transparent: true, opacity: .9 }), 400);
    ring.count = 0; ring.frustumCulled = false; scene.add(ring); G.r3.ring = ring;
    /* marcador do alvo / feitiço */
    const tgt = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7df9ff', toneMapped: false, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }));
    tgt.visible = false; tgt.renderOrder = 9; scene.add(tgt); G.r3.tgt = tgt;
    /* tribos iniciais */
    L.tribes.forEach((tb, n) => {
      const T = G.tribes[n];
      addBuild(G, 'stone', tb.t, tb.x, tb.z, 1);
      const a0 = Math.atan2(-tb.x, -tb.z);
      addBuild(G, 'hut', tb.t, tb.x + Math.sin(a0) * 12, tb.z + Math.cos(a0) * 12, 1);
      if (n > 0) addBuild(G, 'hut', tb.t, tb.x + Math.sin(a0 + 1.6) * 12, tb.z + Math.cos(a0 + 1.6) * 12, 1);
      T.shaman = addUnit(G, 'shaman', tb.t, tb.x + Math.sin(a0) * 6, tb.z + Math.cos(a0) * 6 + 2);
      for (let i = 0; i < tb.braves; i++) addUnit(G, 'brave', tb.t, tb.x + rand(-8, 8), tb.z + rand(-8, 8));
      if (n > 0 && tb.ai && tb.ai.lvl >= 2) for (let i = 0; i < tb.ai.lvl; i++) addUnit(G, 'warrior', tb.t, tb.x + rand(-6, 6), tb.z + rand(-6, 6));
    });
    (L.wild || []).forEach(w => { for (let i = 0; i < w.n; i++) { const a = rand(0, TAU), r = rand(0, w.r); const x = w.x + Math.cos(a) * r, z = w.z + Math.sin(a) * r; if (hAt(G, x, z) > .8) { const u = addUnit(G, 'wild', -1, x, z); u.home = [w.x, w.z, w.r]; } } });
    G.cam.yaw = Math.atan2(G.cam.x, G.cam.z);
    G.sel.clear(); G.sel.add(G.player.shaman);
    say(G, L.name, L.brief, 4.5);
    G.ok = true;
  }
  function treesDirty(G) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    G.trees.forEach(t => {
      const k = t.alive ? t.s * (.55 + .45 * t.wood / t.max) : 0;
      e.set(t.fall * 1.4, t.x * 7 % 6, 0); q.setFromEuler(e);
      s.setScalar(Math.max(.0001, k)); p.set(t.x, hAt(G, t.x, t.z) - .3, t.z); m.compose(p, q, s); G.r3.trees.setMatrixAt(t.i, m);
    });
    G.r3.trees.instanceMatrix.needsUpdate = true; if (G.r3.trees.instanceColor) G.r3.trees.instanceColor.needsUpdate = true;
  }

  function addUnit(G, k, t, x, z) {
    const T = UT[k];
    const u = { id: G.uid++, k, T, t, x, z, y: hAt(G, x, z), hp: T.hp, alive: true, state: 'idle', path: null, pi: 0, tgt: null, job: null, wood: 0, cd: rand(0, 1), face: rand(0, TAU), anim: rand(0, 6), vx: 0, vz: 0, vy: 0, fly: 0, stun: 0, idleT: rand(0, 3), repath: 0 };
    G.units.push(u);
    return u;
  }
  function addBuild(G, k, t, x, z, done) {
    const T = BT[k];
    const b = { id: G.uid++, k, T, t, x, z, y: hAt(G, x, z), prog: done ? 1 : 0, wood: done ? T.wood : 0, hp: T.hp * (done ? 1 : .35), alive: true, burn: 0, spawnT: rand(8, 14), cd: 0, cells: [], workers: 0 };
    b.mesh = buildingMesh(G, k, t); b.mesh.position.set(x, b.y, z); b.mesh.rotation.y = Math.atan2(-x, -z);
    b.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    G.r3.scene.add(b.mesh);
    if (!done) { b.scaff = scaffold(G, T.r); b.scaff.position.copy(b.mesh.position); G.r3.scene.add(b.scaff); }
    /* bloquear células */
    const [ci, cj] = cellOf(x, z), f = T.foot;
    for (let j = cj - f + 1; j <= cj + f - 1; j++) for (let i = ci - f + 1; i <= ci + f - 1; i++) if (i >= 0 && j >= 0 && i < N && j < N) { G.block[j * N + i]++; b.cells.push(j * N + i); }
    G.builds.push(b);
    syncBuild(b);
    return b;
  }
  function scaffold(G, r) {
    const g = new THREE.Group(), m = W().plainMat('#a37a4c', G.r3.env, { metalness: 0, roughness: .9 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; W().addMesh(g, new THREE.CylinderGeometry(.1, .1, 5, 5), m, Math.cos(a) * r, 2.5, Math.sin(a) * r); }
    W().addMesh(g, new THREE.TorusGeometry(r, .08, 4, 18), m, 0, 3.6, 0, { rx: Math.PI / 2 });
    return g;
  }
  function syncBuild(b) {
    const p = b.prog;
    b.mesh.scale.set(1, Math.max(.06, p), 1);
    if (b.scaff) b.scaff.visible = p < 1;
  }
  function validSite(G, k, x, z) {
    const T = BT[k], [ci, cj] = cellOf(x, z), f = T.foot + 1;
    let hmin = 99, hmax = -99;
    for (let j = cj - f; j <= cj + f; j++) for (let i = ci - f; i <= ci + f; i++) {
      if (i < 0 || j < 0 || i >= N || j >= N || !G.land[j * N + i] || G.block[j * N + i]) return false;
      const hh = cellH(G, i, j); hmin = Math.min(hmin, hh); hmax = Math.max(hmax, hh);
    }
    if (hmax - hmin > 3.2) return false;
    if (G.trees.some(t => t.alive && Math.hypot(t.x - x, t.z - z) < T.r + .5)) return false;
    return true;
  }
  function freeBuild(G, b) { b.cells.forEach(c => { G.block[c] = Math.max(0, G.block[c] - 1); }); b.cells = []; }

  /* ════════════════════════════════════════════════════════════════
     ordens
  ════════════════════════════════════════════════════════════════ */
  function goTo(G, u, x, z, state) {
    const p = findPath(G, u.x, u.z, x, z);
    u.path = p; u.pi = 0; u.state = state || 'move'; u.repath = 1.2;
    return !!p;
  }
  function orderAttack(G, u, tgt) { u.tgt = tgt; u.job = null; u.state = 'attack'; u.path = null; u.repath = 0; }
  function orderBuild(G, u, b) { if (u.k !== 'brave') return; u.job = b; u.tgt = null; u.state = 'job'; u.path = null; u.repath = 0; }
  function orderTrain(G, u, b) { if (u.k !== 'brave') return false; u.job = b; u.state = 'train'; u.path = null; u.repath = 0; return true; }
  function orderChop(G, u, tree) { if (u.k !== 'brave') return; u.job = null; u.tree = tree; u.state = 'chopfree'; u.path = null; u.repath = 0; }

  /* comando contextual (clique direito / toque com seleção) */
  function command(G, wx, wz, hitU, hitB, hitT) {
    const list = [...G.sel].filter(u => u.alive && u.t === 0);
    if (!list.length) return;
    sfx(G, 'cmd');
    if (hitU && hitU.t !== 0) { list.forEach(u => { if (u.k !== 'wild') { orderAttack(G, u, hitU); u.amove = hitU; } }); marker(G, hitU.x, hitU.z, '#ff5a4a'); return; }
    if (hitB && hitB.t !== 0) { list.forEach(u => { orderAttack(G, u, hitB); u.amove = hitB; }); marker(G, hitB.x, hitB.z, '#ff5a4a'); return; }
    if (hitB && hitB.t === 0) {
      if (hitB.prog < 1) { list.forEach(u => { if (u.k === 'brave') orderBuild(G, u, hitB); else goTo(G, u, hitB.x + rand(-4, 4), hitB.z + rand(-4, 4)); }); marker(G, hitB.x, hitB.z, '#7dff9a'); return; }
      if (hitB.k === 'barracks' || hitB.k === 'temple') { let n = 0; list.forEach(u => { if (orderTrain(G, u, hitB)) n++; }); if (n) { marker(G, hitB.x, hitB.z, '#ffd34d'); return; } }
    }
    if (hitT && hitT.alive) { list.forEach(u => { if (u.k === 'brave') orderChop(G, u, hitT); }); }
    /* mover em formação */
    const n = list.length, cols = Math.ceil(Math.sqrt(n));
    list.forEach((u, i) => { const ox = (i % cols - (cols - 1) / 2) * 2.2, oz = (Math.floor(i / cols) - (cols - 1) / 2) * 2.2; u.tgt = null; u.job = null; u.tree = null; u.amove = (u.k === 'warrior' || u.k === 'fire') ? { pt: [wx + ox, wz + oz] } : null; goTo(G, u, wx + ox, wz + oz); });
    marker(G, wx, wz, '#7df9ff');
  }
  function marker(G, x, z, c) { G.fx.push({ k: 'mark', x, z, t: 0, life: .6, c }); }

  /* ════════════════════════════════════════════════════════════════
     simulação das unidades
  ════════════════════════════════════════════════════════════════ */
  const isFoe = (a, b) => a.t !== b.t && a.t !== -1 && b.t !== -1;
  function unitsStep(G, dt) {
    /* grelha espacial para vizinhos */
    const grid = new Map(), key = (x, z) => ((Math.floor((x - H0) / 8)) * 512 + Math.floor((z - H0) / 8));
    G.units.forEach(u => { if (!u.alive || u.inside) return; const k = key(u.x, u.z); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(u); });
    G.near = (x, z, r, fn) => { const r8 = Math.ceil(r / 8); const i0 = Math.floor((x - H0) / 8), j0 = Math.floor((z - H0) / 8); for (let i = i0 - r8; i <= i0 + r8; i++) for (let j = j0 - r8; j <= j0 + r8; j++) { const a = grid.get(i * 512 + j); if (a) for (const u of a) if (u.alive && Math.hypot(u.x - x, u.z - z) <= r) fn(u); } };
    for (const u of G.units) {
      if (!u.alive) continue;
      u.anim += dt; u.cd -= dt; u.repath -= dt;
      if (u.inside) { u.inside -= dt; if (u.inside <= 0) finishTrain(G, u); continue; }
      /* voo (tornado, sopro) */
      if (u.fly) {
        u.vy -= 20 * dt; u.x += u.vx * dt; u.z += u.vz * dt; u.y += u.vy * dt;
        u.face += dt * 9;
        const gy = Math.max(hAt(G, u.x, u.z), -.5);
        if (u.y <= gy) { u.y = gy; const v = -u.vy; u.fly = 0; u.vx = u.vz = u.vy = 0; if (v > 14) hurt(G, u, (v - 14) * 6, null); u.path = null; if (u.state !== 'attack') u.state = 'idle'; }
        clampWorld(u);
        continue;
      }
      if (u.vx || u.vz) { u.x += u.vx * dt; u.z += u.vz * dt; u.vx *= Math.max(0, 1 - dt * 5); u.vz *= Math.max(0, 1 - dt * 5); if (Math.abs(u.vx) + Math.abs(u.vz) < .1) u.vx = u.vz = 0; }
      if (u.stun > 0) { u.stun -= dt; const a = u.anim * 3 + u.id; moveStep(G, u, u.x + Math.cos(a) * 5, u.z + Math.sin(a) * 5, dt * .8); afterMove(G, u); continue; }
      /* afogamento: na água funda, nada até terra (ou afunda) */
      if (hAt(G, u.x, u.z) < -.2 && !u.fly) {
        u.swim = (u.swim || 0) + dt;
        if (u.swim > 14) { hurt(G, u, 999, null); continue; }
        if (!u.path && u.state !== 'cast') { const [i, j] = cellOf(u.x, u.z), c = nearestWalk(G, i, j, 10); if (c) { const [cx, cz] = cellC(c[0], c[1]); u.path = [[cx, cz]]; u.pi = 0; u.state = 'move'; } }
      } else u.swim = 0;
      think(G, u, dt);
      afterMove(G, u);
    }
  }
  function clampWorld(u) { u.x = clamp(u.x, H0 + 2, -H0 - 2); u.z = clamp(u.z, H0 + 2, -H0 - 2); }
  function afterMove(G, u) {
    /* separação suave */
    let px = 0, pz = 0;
    G.near(u.x, u.z, 1.6, o => { if (o === u || o.fly) return; const dx = u.x - o.x, dz = u.z - o.z, d = Math.hypot(dx, dz) || .01; if (d < 1.4) { px += dx / d * (1.4 - d); pz += dz / d * (1.4 - d); } });
    u.x += px * .35; u.z += pz * .35;
    clampWorld(u);
    u.y = lerp(u.y, Math.max(hAt(G, u.x, u.z), -1.2), .5);
  }
  function moveStep(G, u, tx, tz, dt) {
    const dx = tx - u.x, dz = tz - u.z, d = Math.hypot(dx, dz);
    if (d < .05) return true;
    const sp = u.T.spd * (u.wood ? .85 : 1) * (hAt(G, u.x, u.z) < .2 ? .5 : 1);
    const st = Math.min(d, sp * dt); u.x += dx / d * st; u.z += dz / d * st;
    const fa = Math.atan2(dx, dz); let df = fa - u.face; df = Math.atan2(Math.sin(df), Math.cos(df)); u.face += df * Math.min(1, dt * 10);
    u.moving = .2;
    return d <= st + .05;
  }
  function follow(G, u, dt) {
    if (!u.path || u.pi >= u.path.length) return true;
    const p = u.path[u.pi];
    if (moveStep(G, u, p[0], p[1], dt)) { u.pi++; if (u.pi >= u.path.length) { u.path = null; return true; } }
    return false;
  }
  function distTo(u, o) { return Math.hypot(u.x - o.x, u.z - o.z) - (o.T && o.T.r ? o.T.r : 0); }

  function think(G, u, dt) {
    if (u.moving > 0) u.moving -= dt;
    const tribe = u.t >= 0 ? tribeOf(G, u.t) : null;
    switch (u.state) {
      case 'move':
        if (follow(G, u, dt)) { u.state = 'idle'; if (u.amove && u.amove.pt) u.amove = null; }
        if (u.k !== 'brave' && u.k !== 'wild' && u.k !== 'shaman' && G.time % 1 < dt) { const e = seek(G, u, 9); if (e && u.t !== 0) orderAttack(G, u, e); }
        break;
      case 'attack': {
        const t = u.tgt;
        if (!t || !t.alive || (t.T && t.inside)) { u.tgt = null; u.state = 'idle'; break; }
        const d = distTo(u, t), rng = u.T.range;
        if (d > rng) {
          if (u.repath <= 0 || !u.path) {
            if (!goTo(G, u, t.x, t.z, 'attack')) { u.fails = (u.fails || 0) + 1; u.repath = 2; u.state = 'attack'; u.tgt = t; if (u.fails > 3) { u.fails = 0; u.state = 'idle'; u.tgt = null; if (u.amove === t) u.amove = null; } break; }
            u.fails = 0; u.state = 'attack'; u.tgt = t; u.repath = 1 + Math.random();
          }
          follow(G, u, dt);
        } else {
          u.path = null;
          const fa = Math.atan2(t.x - u.x, t.z - u.z); u.face = fa;
          if (u.cd <= 0) {
            u.cd = u.T.rate;
            if (u.T.ranged) fireball(G, u, t);
            else { const dmg = u.T.dmg * (t.T && t.T.wood != null ? .6 : 1); if (t.T && t.T.wood != null) hurtB(G, t, dmg, u); else hurt(G, t, dmg, u); u.swing = .25; sfx(G, 'hit', u); }
          }
        }
        break;
      }
      case 'job': {
        const b = u.job;
        if (!b || !b.alive || b.prog >= 1) { u.job = null; u.state = 'idle'; break; }
        if (b.wood >= b.T.wood) {
          /* toda a madeira entregue: martelar até terminar */
          if (distTo(u, b) > 1.6) { if (!u.path || u.repath <= 0) goTo(G, u, b.x, b.z, 'job'); u.state = 'job'; follow(G, u, dt); }
          else { u.path = null; u.swing = (u.anim % .5) < .25 ? .2 : 0; b.prog = Math.min(1, b.prog + dt * .07); b.hp = Math.min(b.T.hp, b.hp + dt * b.T.hp * .07); syncBuild(b); if (b.prog >= 1) completeBuild(G, b); }
          break;
        }
        if (u.wood) {
          if (distTo(u, b) > 1.6) { if (!u.path || u.repath <= 0) goTo(G, u, b.x, b.z, 'job'); u.state = 'job'; follow(G, u, dt); }
          else { u.wood = 0; b.wood++; b.prog = Math.max(b.prog, b.wood / b.T.wood * .8); syncBuild(b); sfx(G, 'wood', u); }
          break;
        }
        /* buscar madeira */
        if (!u.tree || !u.tree.alive || u.tree.wood <= 0) u.tree = nearestTree(G, b.x, b.z, u);
        if (!u.tree) { u.state = 'idle'; break; }
        chop(G, u, dt, 'job');
        break;
      }
      case 'chopfree': {
        if (!u.tree || !u.tree.alive || u.tree.wood <= 0) { u.tree = nearestTree(G, u.x, u.z, u); if (!u.tree) { u.state = 'idle'; break; } }
        if (u.wood) {
          /* leva para a construção mais próxima por acabar */
          const site = G.builds.filter(b => b.alive && b.t === u.t && b.prog < 1 && b.wood < b.T.wood).sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z))[0];
          if (site) { u.job = site; u.state = 'job'; } else u.state = 'idle';
          break;
        }
        chop(G, u, dt, 'chopfree');
        break;
      }
      case 'train': {
        const b = u.job;
        if (!b || !b.alive || b.prog < 1) { u.state = 'idle'; u.job = null; break; }
        const cost = b.k === 'barracks' ? UT.warrior.cost : UT.fire.cost;
        if (distTo(u, b) > 1.8) { if (!u.path || u.repath <= 0) goTo(G, u, b.x, b.z, 'train'); u.state = 'train'; follow(G, u, dt); }
        else {
          if (tribe.mana < cost) { u.state = 'idle'; u.job = null; if (u.t === 0) say(G, 'Falta mana', `Treinar custa ${cost} de mana.`, 1.6); break; }
          tribe.mana -= cost; u.inside = 6; u.trainAs = b.k === 'barracks' ? 'warrior' : 'fire'; u.trainAt = b; u.state = 'inside';
        }
        break;
      }
      case 'cast': {
        const s = u.cast; if (!s) { u.state = 'idle'; break; }
        const d = Math.hypot(s.x - u.x, s.z - u.z);
        if (d > SP[s.k].range) {
          if (!u.path) {
            if (u.castNear) {
              /* não dá para chegar mais perto (água): a ponte lança-se daqui, até ao alcance */
              if (s.k === 'bridge') { const k = Math.min(1, SP.bridge.range / d); castNow(G, u, { k: 'bridge', x: u.x + (s.x - u.x) * k, z: u.z + (s.z - u.z) * k }); }
              else if (u.t === 0) say(G, 'Fora de alcance', 'A xamã não consegue chegar lá.', 1.5);
              u.cast = null; u.state = 'idle'; u.castNear = false; break;
            }
            u.castNear = true;
            if (!goTo(G, u, s.x, s.z, 'cast')) for (let t = .9; t > .05; t -= .1) if (goTo(G, u, lerp(u.x, s.x, t), lerp(u.z, s.z, t), 'cast')) break;
            u.state = 'cast';
          }
          follow(G, u, dt);
        } else { u.path = null; u.castNear = false; u.face = Math.atan2(s.x - u.x, s.z - u.z); castNow(G, u, s); u.cast = null; u.state = 'idle'; }
        break;
      }
      case 'idle':
      default: {
        u.idleT -= dt;
        if (u.k === 'wild') {
          if (u.idleT <= 0) { u.idleT = rand(3, 7); const [hx, hz, hr] = u.home || [u.x, u.z, 10]; const a = rand(0, TAU), r = rand(0, hr); goTo(G, u, hx + Math.cos(a) * r, hz + Math.sin(a) * r); u.state = 'move'; }
          break;
        }
        /* autodefesa / agressão */
        if (u.k !== 'brave' || u.t !== 0) {
          const e = seek(G, u, u.k === 'brave' ? 5 : u.k === 'shaman' ? 3 : u.T.ranged ? 18 : 13);
          if (e && (u.k !== 'brave' || e.T.dmg)) { orderAttack(G, u, e); break; }
        }
        /* retomar o objetivo depois do combate */
        if (u.amove) {
          const a = u.amove;
          if (a.pt) { if (Math.hypot(a.pt[0] - u.x, a.pt[1] - u.z) > 4) { goTo(G, u, a.pt[0], a.pt[1]); break; } u.amove = null; }
          else if (a.alive) { orderAttack(G, u, a); break; }
          else {
            /* objetivo destruído: o próximo alvo inimigo perto */
            const nx = G.builds.filter(b => b.alive && b.t >= 0 && b.t !== u.t && u.t >= 0 && Math.hypot(b.x - a.x, b.z - a.z) < 60).sort((p, q) => Math.hypot(p.x - u.x, p.z - u.z) - Math.hypot(q.x - u.x, q.z - u.z))[0];
            u.amove = nx || null; if (nx) { orderAttack(G, u, nx); break; }
          }
        }
        if (u.k === 'brave' && u.t === 0 && u.idleT <= 0) {
          /* aldeões da tribo do jogador: ajudam nas obras por acabar */
          u.idleT = rand(2, 4);
          const site = G.builds.find(b => b.alive && b.t === 0 && b.prog < 1 && b.workers < 3 && Math.hypot(b.x - u.x, b.z - u.z) < 70);
          if (site) { orderBuild(G, u, site); break; }
          if (Math.random() < .5) { const s = G.builds.find(b => b.alive && b.t === 0 && b.k === 'hut') || { x: u.x, z: u.z }; goTo(G, u, s.x + rand(-12, 12), s.z + rand(-12, 12)); }
        }
        break;
      }
    }
  }
  function chop(G, u, dt, back) {
    const tr = u.tree;
    if (Math.hypot(tr.x - u.x, tr.z - u.z) > 1.8) { if (!u.path || u.repath <= 0) goTo(G, u, tr.x, tr.z, back); u.state = back; follow(G, u, dt); return; }
    u.path = null; u.face = Math.atan2(tr.x - u.x, tr.z - u.z);
    u.chopT = (u.chopT || 0) + dt; u.swing = (u.anim % .6) < .3 ? .25 : 0;
    if (u.chopT > 2.2) { u.chopT = 0; tr.wood--; u.wood = 1; if (tr.wood <= 0) { tr.alive = false; tr.regrow = rand(70, 120); } treesDirty(G); sfx(G, 'chop', u); }
  }
  function nearestTree(G, x, z, u) {
    let best = null, bd = 1e9;
    for (const t of G.trees) { if (!t.alive || t.wood <= 0) continue; const d = Math.hypot(t.x - x, t.z - z) + (u ? Math.hypot(t.x - u.x, t.z - u.z) * .3 : 0); if (d < bd) { bd = d; best = t; } }
    return bd < 160 ? best : null;
  }
  function seek(G, u, r) {
    let best = null, bd = r;
    G.near(u.x, u.z, r, o => { if (!isFoe(u, o) || o.inside) return; const d = Math.hypot(o.x - u.x, o.z - u.z); if (d < bd) { bd = d; best = o; } });
    if (!best && (u.k === 'warrior' || u.k === 'fire')) G.builds.forEach(b => { if (b.alive && b.t !== u.t && b.t >= 0 && u.t >= 0) { const d = Math.hypot(b.x - u.x, b.z - u.z) - b.T.r; if (d < bd) { bd = d; best = b; } } });
    return best;
  }
  function finishTrain(G, u) {
    const b = u.trainAt; u.inside = 0;
    if (!b || !b.alive) { u.state = 'idle'; return; }
    u.k = u.trainAs; u.T = UT[u.k]; u.hp = u.T.hp; u.state = 'idle'; u.job = null;
    u.x = b.x + Math.sin(b.mesh.rotation.y) * (b.T.r + 1.5); u.z = b.z + Math.cos(b.mesh.rotation.y) * (b.T.r + 1.5);
    burst(G, u.x, u.y + 1.5, u.z, '#ffd34d', 14);
    if (u.t === 0) { G.sel.add(u); sfx(G, 'train', u); }
  }
  function completeBuild(G, b) {
    b.prog = 1; b.hp = b.T.hp; syncBuild(b);
    if (b.scaff) { G.r3.scene.remove(b.scaff); b.scaff = null; }
    burst(G, b.x, b.y + 4, b.z, '#fff2b0', 20);
    G.units.forEach(u => { if (u.job === b && u.state === 'job') { u.job = null; u.state = 'idle'; } });
    if (b.t === 0) { sfx(G, 'built'); say(G, BT[b.k].name + ' construída', '', 1.6); }
  }

  /* dano e morte */
  function hurt(G, u, dmg, by) {
    if (!u.alive) return;
    u.hp -= dmg; u.hitT = .3;
    if (by && by.t !== u.t && u.state !== 'attack' && u.k !== 'wild' && u.k !== 'shaman' && (u.k !== 'brave' || u.t !== 0)) orderAttack(G, u, by);
    if (u.hp <= 0) die(G, u, by);
  }
  function die(G, u, by) {
    u.alive = false; G.sel.delete(u);
    burst(G, u.x, u.y + 1, u.z, '#e9e2d0', 10);
    smoke(G, u.x, u.y + 1, u.z, 3, '#ddd6c8');
    if (by && by.t >= 0) { const T = tribeOf(G, by.t); if (T) T.kills++; }
    if (u.k === 'shaman' && u.t >= 0) { const T = tribeOf(G, u.t); T.shaman = null; T.shamanT = 12; if (u.t === 0) say(G, 'A xamã caiu!', G.builds.some(b => b.alive && b.t === 0 && b.k === 'stone') ? 'Vai renascer na Pedra do Renascer.' : 'Já não há Pedra do Renascer…', 3); else say(G, 'Xamã inimiga derrotada', '', 2); }
  }
  function hurtB(G, b, dmg, by) {
    if (!b.alive) return;
    b.hp -= dmg;
    if (b.hp <= 0) destroyB(G, b);
  }
  function destroyB(G, b) {
    b.alive = false; G.r3.scene.remove(b.mesh); if (b.scaff) G.r3.scene.remove(b.scaff); freeBuild(G, b);
    for (let i = 0; i < 4; i++) smoke(G, b.x + rand(-3, 3), b.y + 2, b.z + rand(-3, 3), 8, '#5a524a');
    burst(G, b.x, b.y + 3, b.z, '#ffb070', 26);
    const r = buildingMesh(G, 'ruin', b.t); r.position.set(b.x, b.y, b.z); G.r3.scene.add(r); b.ruin = r;
    shake(G, b, 5);
    sfx(G, 'crash', b);
    G.units.forEach(u => { if (u.inside && u.trainAt === b) { u.inside = 0; u.state = 'idle'; u.x = b.x + 4; } });
    if (b.t === 0) say(G, BT[b.k].name + ' destruída', '', 1.5);
  }
  function fireball(G, u, t) {
    G.projs.push({ x: u.x, y: u.y + 2.4, z: u.z, t, from: u, life: 2 });
    sfx(G, 'fire', u);
  }

  /* ════════════════════════════════════════════════════════════════
     feitiços
  ════════════════════════════════════════════════════════════════ */
  function canCast(G, T, k) { return T.shaman && T.shaman.alive && T.mana >= SP[k].cost; }
  function cast(G, T, k, x, z) {
    if (!canCast(G, T, k)) return false;
    const u = T.shaman;
    u.cast = { k, x, z }; u.state = 'cast'; u.path = null; u.repath = 0; u.castNear = false;
    return true;
  }
  function castNow(G, u, s) {
    const T = tribeOf(G, u.t), P = SP[s.k];
    if (T.mana < P.cost) { if (u.t === 0) say(G, 'Falta mana', '', 1.2); return; }
    T.mana -= P.cost; G.castLog = G.castLog || {}; const ck = u.t + ':' + s.k; G.castLog[ck] = (G.castLog[ck] || 0) + 1;
    const x = s.x, z = s.z, y = hAt(G, x, z);
    sfx(G, 'cast', u);
    burst(G, u.x, u.y + 3, u.z, '#9ef3ff', 12);
    switch (s.k) {
      case 'blast': {
        ringFx(G, x, z, P.r * 1.6, '#ffd08a'); fireP(G, x, y + 1, z, 30, 10, '#ffcf7a');
        G.near(x, z, P.r, o => { if (o.t === u.t) return; const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz) || .1; o.fly = 1; o.vx = dx / d * 14; o.vz = dz / d * 14; o.vy = 9; hurt(G, o, 18, u); });
        G.builds.forEach(b => { if (b.alive && b.t !== u.t && Math.hypot(b.x - x, b.z - z) < P.r + b.T.r) hurtB(G, b, 30, u); });
        shake(G, { x, z }, 3);
        break;
      }
      case 'bolt': {
        G.fx.push({ k: 'bolt', x, z, y, t: 0, life: .45, seed: Math.random() });
        G.r3.flash.position.set(x, y + 20, z); G.r3.flash.intensity = 900;
        G.near(x, z, P.r, o => { if (o.t !== u.t) hurt(G, o, 140, u); });
        G.builds.forEach(b => { if (b.alive && b.t !== u.t && Math.hypot(b.x - x, b.z - z) < P.r + b.T.r) { hurtB(G, b, 110, u); b.burn = Math.max(b.burn, 6); } });
        fireP(G, x, y + 1, z, 24, 6, '#bfe8ff'); shake(G, { x, z }, 6);
        sfx(G, 'thunder', { x, z });
        break;
      }
      case 'convert': {
        ringFx(G, x, z, P.r, '#9ef3ff');
        let n = 0;
        G.near(x, z, P.r, o => {
          if (o.t === u.t) return;
          if (o.k === 'wild' || (o.k === 'brave' && Math.random() < .25)) {
            o.t = u.t; o.k = 'brave'; o.T = UT.brave; o.hp = UT.brave.hp; o.state = 'idle'; o.tgt = null; o.job = null; o.path = null; n++;
            burst(G, o.x, o.y + 1.5, o.z, '#9ef3ff', 10);
          }
        });
        T.conv += n;
        if (u.t === 0) say(G, n ? `+${n} convertidos` : 'Ninguém para converter aqui', '', 1.4);
        break;
      }
      case 'swarm': {
        G.fx.push({ k: 'swarm', x, z, y, t: 0, life: 8, by: u.t });
        G.near(x, z, P.r, o => { if (o.t !== u.t && o.k !== 'shaman') { o.stun = 7; o.path = null; } });
        break;
      }
      case 'bridge': {
        /* faixa de terra da xamã até ao ponto */
        const x0 = u.x, z0 = u.z, d = Math.hypot(x - x0, z - z0), n = Math.ceil(d / 1.5);
        G.fx.push({ k: 'raise', pts: Array.from({ length: n + 1 }, (_, i) => [lerp(x0, x, i / n), lerp(z0, z, i / n)]), t: 0, life: 2.4, w: 5.5, target: 1.6 });
        break;
      }
      case 'quake': {
        G.fx.push({ k: 'quake', x, z, t: 0, life: 4, r: P.r });
        G.builds.forEach(b => { if (b.alive && b.t !== u.t && Math.hypot(b.x - x, b.z - z) < P.r + 4) { hurtB(G, b, b.T.hp * .85, u); b.burn = Math.max(b.burn, 4); } });
        G.near(x, z, P.r, o => { if (o.t !== u.t) { o.stun = 2; hurt(G, o, 15, u); } });
        sfx(G, 'quake', { x, z });
        break;
      }
      case 'tornado': {
        const dir = Math.atan2(x - u.x, z - u.z);
        G.storms.push({ k: 'tornado', x, z, a: dir, t: 0, life: 13, by: u.t, mesh: tornadoMesh(G) });
        sfx(G, 'wind', { x, z });
        break;
      }
      case 'volcano': {
        G.fx.push({ k: 'volcano', x, z, t: 0, life: 16, by: u.t, r: P.r });
        sfx(G, 'quake', { x, z });
        break;
      }
    }
  }
  function tornadoMesh(G) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#d8d2c4', transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(2 + i * 1.6, 1 + i * 1.5, 6, 18, 1, true), mat); m.position.y = 3 + i * 5.2; g.add(m); }
    G.r3.scene.add(g);
    return g;
  }

  /* efeitos com efeito no mundo (terra a subir, sismo, vulcão, enxame) */
  function fxStep(G, dt) {
    let terr = false;
    for (let i = G.fx.length - 1; i >= 0; i--) {
      const f = G.fx[i]; f.t += dt;
      if (f.k === 'raise') {
        const k = Math.min(1, f.t / f.life);
        f.pts.forEach(([x, z]) => forVerts(x, z, f.w, (vk, d) => { const tgt = f.target + (1 - d / f.w) * 1.2; if (G.h[vk] < tgt) G.h[vk] = lerp(G.h[vk], tgt, k * .2 * (1 - d / f.w * .5)); }));
        if (Math.random() < .5) { const p = f.pts[Math.floor(Math.random() * f.pts.length)]; smoke(G, p[0], .5, p[1], 3, '#c9b48a'); }
        terr = true;
        if (f.t >= f.life) { const xs = f.pts.map(p => p[0]), zs = f.pts.map(p => p[1]); landDirty(G, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), 8); }
      } else if (f.k === 'quake') {
        if (f.t < 2.6) {
          forVerts(f.x, f.z, f.r, (vk, d) => { if (G.h[vk] > -3) G.h[vk] += (Math.random() - .5) * dt * 6 * (1 - d / f.r) - dt * .5 * (1 - d / f.r); });
          terr = true; G.shake = Math.max(G.shake, 6 * (1 - f.t / 2.6));
          if (Math.random() < .7) smoke(G, f.x + rand(-f.r, f.r), hAt(G, f.x, f.z) + 1, f.z + rand(-f.r, f.r), 6, '#8a7a66');
        }
        if (f.t >= f.life) landDirty(G, f.x - f.r, f.z - f.r, f.x + f.r, f.z + f.r, 2);
      } else if (f.k === 'volcano') {
        if (f.t < 4) {
          forVerts(f.x, f.z, f.r, (vk, d) => { const tgt = 26 * Math.pow(1 - d / f.r, 1.6) + (d < 3 ? -4 : 0); G.h[vk] = Math.max(G.h[vk], lerp(G.h[vk], tgt, dt * .9)); G.scorch[vk] = Math.max(G.scorch[vk], (1 - d / f.r) * f.t / 4); });
          terr = true; G.shake = Math.max(G.shake, 4);
        } else {
          /* lava a descer pelas encostas e bombas de lava */
          const top = hAt(G, f.x, f.z) + 2;
          for (let k = 0; k < 4; k++) G.r3.fire.spawn({ x: f.x, y: top, z: f.z, vx: rand(-8, 8), vy: rand(14, 30), vz: rand(-8, 8), life: rand(1.2, 2.2), s0: 3, s1: 1.4, c0: '#fff0b0', c1: '#ff3a0a', k: 1.8, grav: 18 });
          if (Math.random() < .6) smoke(G, f.x, top + 4, f.z, 14, '#2c2622');
          forVerts(f.x, f.z, f.r * 1.15, (vk, d) => { G.lava[vk] = Math.max(G.lava[vk], (1 - d / (f.r * 1.15)) * Math.min(1, (f.t - 4) / 5) * (f.t < f.life - 3 ? 1 : (f.life - f.t) / 3)); });
          if (G.fxFrame % 10 === 0) terr = true;
        }
        if (f.t > 2) {
          G.near(f.x, f.z, f.r, o => { if (o.t !== f.by) hurt(G, o, 40 * dt, null); });
          G.builds.forEach(b => { if (b.alive && b.t !== f.by && Math.hypot(b.x - f.x, b.z - f.z) < f.r + 3) { hurtB(G, b, 60 * dt, null); b.burn = Math.max(b.burn, 3); } });
          G.trees.forEach(t => { if (t.alive && Math.hypot(t.x - f.x, t.z - f.z) < f.r) { t.alive = false; t.regrow = 200; G.treeDirty = 1; fireP(G, t.x, hAt(G, t.x, t.z) + 3, t.z, 8, 4, '#ff8a3a'); } });
        }
        if (f.t >= f.life) { G.lava.fill(0); landDirty(G, f.x - f.r, f.z - f.r, f.x + f.r, f.z + f.r, 2); terr = true; }
      } else if (f.k === 'swarm') {
        for (let k = 0; k < 3; k++) { const a = rand(0, TAU), r = rand(0, 9); G.r3.smoke.spawn({ x: f.x + Math.cos(a) * r, y: f.y + rand(1, 5), z: f.z + Math.sin(a) * r, vx: rand(-6, 6), vy: rand(-1, 1), vz: rand(-6, 6), life: .7, s0: .5, s1: .5, c0: '#1a1a12', a: .9 }); }
        if (G.fxFrame % 20 === 0) G.near(f.x, f.z, 10, o => { if (o.t !== f.by && o.k !== 'shaman') o.stun = Math.max(o.stun, 1.5); });
      }
      if (f.t >= f.life) G.fx.splice(i, 1);
    }
    if (terr) G.dirtyT = true;
    /* tornados */
    for (let i = G.storms.length - 1; i >= 0; i--) {
      const s = G.storms[i]; s.t += dt;
      s.a += Math.sin(s.t * .9 + i) * dt * .8; s.x += Math.sin(s.a) * 5 * dt; s.z += Math.cos(s.a) * 5 * dt;
      s.x = clamp(s.x, H0 + 10, -H0 - 10); s.z = clamp(s.z, H0 + 10, -H0 - 10);
      const y = Math.max(0, hAt(G, s.x, s.z));
      s.mesh.position.set(s.x, y, s.z); s.mesh.rotation.y += dt * 6; s.mesh.children.forEach((c, k) => { c.rotation.y += dt * (2 + k); c.position.x = Math.sin(s.t * 3 + k) * k * .4; });
      const fade = Math.min(1, s.t, s.life - s.t); s.mesh.scale.setScalar(Math.max(.05, fade));
      for (let k = 0; k < 3; k++) { const a = rand(0, TAU), h = rand(0, 30), r = 2 + h * .35; G.r3.smoke.spawn({ x: s.x + Math.cos(a) * r, y: y + h, z: s.z + Math.sin(a) * r, vx: -Math.sin(a) * 14, vy: 4, vz: Math.cos(a) * 14, life: 1.2, s0: 3, s1: 7, c0: '#b8ac98', a: .45 }); }
      G.near(s.x, s.z, 10, o => { if (o.t !== s.by && !o.fly) { const a = Math.atan2(o.z - s.z, o.x - s.x) + 1.4; o.fly = 1; o.vx = Math.cos(a) * 16; o.vz = Math.sin(a) * 16; o.vy = rand(14, 22); o.y += 1; hurt(G, o, 12, null); } });
      G.builds.forEach(b => { if (b.alive && b.t !== s.by && Math.hypot(b.x - s.x, b.z - s.z) < 9 + b.T.r) hurtB(G, b, 120 * dt, null); });
      G.trees.forEach(t => { if (t.alive && Math.hypot(t.x - s.x, t.z - s.z) < 8) { t.alive = false; t.regrow = 120; G.treeDirty = 1; } });
      if (s.t >= s.life) { G.r3.scene.remove(s.mesh); G.storms.splice(i, 1); }
    }
    /* bolas de fogo */
    for (let i = G.projs.length - 1; i >= 0; i--) {
      const p = G.projs[i]; p.life -= dt;
      const t = p.t, ty = (t.y || hAt(G, t.x, t.z)) + (t.T && t.T.wood != null ? 3 : 1.4);
      const dx = t.x - p.x, dy = ty - p.y, dz = t.z - p.z, d = Math.hypot(dx, dy, dz), sp = 32 * dt;
      if (d < sp || !t.alive || p.life <= 0) {
        if (t.alive && p.life > 0) { if (t.T && t.T.wood != null) { hurtB(G, t, p.from.T.dmg * .8, p.from); t.burn = Math.max(t.burn, 3); } else hurt(G, t, p.from.T.dmg, p.from); fireP(G, t.x, ty, t.z, 8, 4, '#ffb04a'); }
        G.projs.splice(i, 1); continue;
      }
      p.x += dx / d * sp; p.y += dy / d * sp + Math.sin(p.life * 6) * .05; p.z += dz / d * sp;
      G.r3.fire.spawn({ x: p.x, y: p.y, z: p.z, life: .25, s0: 1.4, s1: .3, c0: '#ffd08a', c1: '#ff4a10', k: 1.6 });
    }
  }
  function landDirty(G, x0, z0, x1, z1, pad) {
    const [i0, j0] = cellOf(x0 - pad, z0 - pad), [i1, j1] = cellOf(x1 + pad, z1 + pad);
    updLand(G, i0, j0, i1, j1);
    /* unidades e edifícios assentam no novo chão */
    G.builds.forEach(b => { if (b.alive) { b.y = hAt(G, b.x, b.z); b.mesh.position.y = b.y; } });
    G.trees.forEach(t => { if (t.alive && hAt(G, t.x, t.z) < .4) { t.alive = false; t.regrow = 999; } });
    G.treeDirty = 1;
  }

  /* ════════════════════════════════════════════════════════════════
     edifícios (nascimentos, torres, fogo) e tribos (mana, IA)
  ════════════════════════════════════════════════════════════════ */
  function buildsStep(G, dt) {
    G.builds.forEach(b => {
      if (!b.alive) return;
      if (b.burn > 0) { b.burn -= dt; hurtB(G, b, 9 * dt, null); if (Math.random() < .5) { fireP(G, b.x + rand(-2, 2), b.y + rand(2, 5), b.z + rand(-2, 2), 1, 3, '#ff8a3a'); smoke(G, b.x, b.y + 5, b.z, 4, '#3a3530'); } }
      if (b.prog < 1) return;
      const T = tribeOf(G, b.t); if (!T) return;
      if (b.k === 'hut') {
        b.spawnT -= dt;
        if (b.spawnT <= 0) {
          b.spawnT = rand(16, 22) * (b.t === 0 ? 1 : 1.35);
          const pop = G.units.filter(u => u.alive && u.t === b.t).length, cap = G.builds.filter(x => x.alive && x.t === b.t && x.k === 'hut' && x.prog >= 1).length * BT.hut.pop + (b.t === 0 ? 6 : 3);
          if (pop < cap) { const a = b.mesh.rotation.y; const u = addUnit(G, 'brave', b.t, b.x + Math.sin(a) * 5, b.z + Math.cos(a) * 5); burst(G, u.x, u.y + 1, u.z, TRIBES[b.t].light, 8); }
        }
      } else if (b.k === 'tower') {
        b.cd -= dt;
        if (b.cd <= 0) {
          let best = null, bd = 24;
          G.near(b.x, b.z, 24, o => { if (o.t !== b.t && o.t >= 0) { const d = Math.hypot(o.x - b.x, o.z - b.z); if (d < bd) { bd = d; best = o; } } });
          if (best) { b.cd = 1.4; G.projs.push({ x: b.x, y: b.y + 9, z: b.z, t: best, from: { T: { dmg: 9 }, t: b.t }, life: 2 }); }
          else b.cd = .5;
        }
      } else if (b.k === 'temple' && b.mesh.getObjectByName('flame')) { const f = b.mesh.getObjectByName('flame'); f.scale.set(1, 1 + Math.sin(G.t * 9 + b.id) * .15, 1); }
      else if (b.k === 'stone') { const o = b.mesh.getObjectByName('orb'); if (o) { o.position.y = 2.2 + Math.sin(G.t * 2 + b.id) * .3; o.rotation.y += dt; } }
    });
    /* árvores voltam a crescer */
    G.trees.forEach(t => { if (!t.alive && t.regrow < 900) { t.regrow -= dt; if (t.regrow <= 0 && hAt(G, t.x, t.z) > 1) { t.alive = true; t.wood = 1; t.grow = 1; G.treeDirty = 1; } } else if (t.alive && t.wood < t.max && t.grow) { t.grow += dt; if (t.grow > 25) { t.wood++; t.grow = 1; G.treeDirty = 1; } } });
  }
  function tribesStep(G, dt) {
    G.tribes.forEach(T => {
      const us = G.units.filter(u => u.alive && u.t === T.idx);
      const bs = G.builds.filter(b => b.alive && b.t === T.idx);
      /* sem edifícios, a tribo está vencida: quem sobra dispersa e torna-se nómada */
      if (T.idx !== 0 && T.alive && !bs.length && G.time > 5) {
        us.forEach(u => { if (u.k === 'shaman') { die(G, u, null); return; } u.t = -1; u.k = 'wild'; u.T = UT.wild; u.hp = Math.min(u.hp, UT.wild.hp); u.state = 'idle'; u.tgt = null; u.job = null; u.home = [u.x, u.z, 14]; });
        say(G, `${TRIBES[T.idx].name} foi vencida`, 'Os sobreviventes dispersam como nómadas.', 3, TRIBES[T.idx].color);
        T.alive = false; T.pop = 0; return;
      }
      T.alive = us.length > 0 || bs.length > 0;
      T.pop = us.length;
      if (!T.alive) return;
      const mk = T.idx === 0 ? [2, .3, .5] : [.9, .15, .22];
      T.mana = Math.min(999, T.mana + dt * (mk[0] + us.filter(u => u.k === 'brave').length * mk[1] + bs.filter(b => b.k === 'hut' && b.prog >= 1).length * mk[2]));
      /* renascer da xamã */
      if (!T.shaman || !T.shaman.alive) {
        const st = bs.find(b => b.k === 'stone');
        if (st) { T.shamanT -= dt; if (T.shamanT <= 0) { T.shaman = addUnit(G, 'shaman', T.idx, st.x + 5, st.z); burst(G, st.x, st.y + 3, st.z, TRIBES[T.idx].light, 30); if (T.idx === 0) { say(G, 'A xamã renasceu', '', 1.6); G.sel.add(T.shaman); } } }
      }
      if (T.ai) aiStep(G, T, dt, us, bs);
    });
  }

  /* IA das tribos rivais */
  function aiStep(G, T, dt, us, bs) {
    const A = T.ai; A.tick -= dt; A.castT -= dt;
    if (A.tick > 0) return;
    A.tick = 1;
    const braves = us.filter(u => u.k === 'brave'), idle = braves.filter(u => u.state === 'idle' || (u.state === 'move' && !u.path));
    const army = us.filter(u => u.k === 'warrior' || u.k === 'fire');
    /* obras: cada obra por acabar recebe até 3 aldeões */
    const sites = bs.filter(b => b.prog < 1);
    sites.forEach(s => { const n = braves.filter(u => u.job === s).length; for (let k = n; k < 3 && idle.length; k++) orderBuild(G, idle.pop(), s); });
    /* nova obra pela ordem de construção */
    if (!sites.length && braves.length >= 3) {
      const want = A.build[A.bi % A.build.length], huts = bs.filter(b => b.k === 'hut').length;
      if (A.bi < A.build.length || (huts < 2 + A.lvl && Math.random() < .2)) {
        const k = A.bi < A.build.length ? want : 'hut';
        const spot = findSite(G, k, T.base[0], T.base[1]);
        if (spot) { const s = addBuild(G, k, T.idx, spot[0], spot[1], 0); A.bi++; for (let i = 0; i < 3 && idle.length; i++) orderBuild(G, idle.pop(), s); }
      }
    }
    /* treino */
    const bar = bs.find(b => b.k === 'barracks' && b.prog >= 1), tem = bs.find(b => b.k === 'temple' && b.prog >= 1);
    const armyCap = 3 + A.lvl * 2;
    if (army.length < armyCap && idle.length > 1) {
      const useFire = A.fire && tem && Math.random() < .45;
      const b = useFire ? tem : bar, cost = useFire ? UT.fire.cost : UT.warrior.cost;
      if (b && T.mana >= cost + 20) orderTrain(G, idle.pop(), b);
    }
    /* converter nómadas próximos */
    if (T.shaman && T.shaman.alive && T.mana > 120 && A.castT <= 0) {
      const w = G.units.find(u => u.alive && u.k === 'wild' && Math.hypot(u.x - T.base[0], u.z - T.base[1]) < 90);
      if (w) { cast(G, T, 'convert', w.x, w.z); A.castT = 8; }
    }
    /* defesa da base */
    const intr = G.units.find(u => u.alive && u.t === 0 && Math.hypot(u.x - T.base[0], u.z - T.base[1]) < 45);
    if (intr) army.forEach(u => { if (u.state !== 'attack') orderAttack(G, u, intr); });
    /* vagas de ataque */
    A.waveT -= 1;
    if (A.waveT <= 0 && army.length >= A.army) {
      A.waveT = A.wave * rand(.8, 1.1);
      const tgt = playerTarget(G, T);
      if (tgt) {
        let ok = 0;
        army.forEach(u => { if (goTo(G, u, tgt.x + rand(-6, 6), tgt.z + rand(-6, 6), 'move')) ok++; u.tgt = null; u.amove = tgt; });
        if (!ok && T.shaman && T.shaman.alive) {
          /* sem caminho: a xamã ergue uma ponte em direção ao inimigo */
          const sx = T.base[0] + (tgt.x - T.base[0]) * .25, sz = T.base[1] + (tgt.z - T.base[1]) * .25;
          T.mana = Math.max(T.mana, SP.bridge.cost); goTo(G, T.shaman, sx, sz); cast(G, T, 'bridge', tgt.x - (tgt.x - T.base[0]) * .2, tgt.z - (tgt.z - T.base[1]) * .2);
          A.waveT = 25;
        } else if (ok) say(G, `${TRIBES[T.idx].name} ataca!`, `${army.length} guerreiros a caminho`, 2.5, TRIBES[T.idx].color);
        A.attacking = tgt;
        if (A.shaman && T.shaman && T.shaman.alive && ok) goTo(G, T.shaman, tgt.x - (tgt.x - T.base[0]) * .25, tgt.z - (tgt.z - T.base[1]) * .25);
      }
    }
    /* xamã inimiga lança feitiços em combate */
    if (A.shaman && T.shaman && T.shaman.alive && T.shaman.state !== 'cast' && A.castT <= 0) {
      const sh = T.shaman; let foe = null, n = 0;
      G.near(sh.x, sh.z, 36, o => { if (o.t === 0) { n++; if (!foe || o.k === 'shaman') foe = o; } });
      if (foe) {
        if (foe.k === 'shaman' && T.mana > SP.bolt.cost) cast(G, T, 'bolt', foe.x, foe.z);
        else if (n >= 4 && A.lvl >= 3 && T.mana > SP.swarm.cost && Math.random() < .4) cast(G, T, 'swarm', foe.x, foe.z);
        else if (T.mana > SP.blast.cost) cast(G, T, 'blast', foe.x, foe.z);
        A.castT = 11 - A.lvl;
      } else if (A.lvl >= 3 && T.mana > SP.quake.cost + 60) {
        const pb = G.builds.find(b => b.alive && b.t === 0 && Math.hypot(b.x - sh.x, b.z - sh.z) < 44);
        if (pb) { cast(G, T, A.lvl >= 4 && T.mana > SP.tornado.cost + 80 && Math.random() < .5 ? 'tornado' : 'quake', pb.x, pb.z); A.castT = 20; }
      }
    }
  }
  function playerTarget(G, T) {
    const opts = G.builds.filter(b => b.alive && b.t === 0).concat(G.units.filter(u => u.alive && u.t === 0 && u.k !== 'wild'));
    return opts.sort((a, b) => Math.hypot(a.x - T.base[0], a.z - T.base[1]) - Math.hypot(b.x - T.base[0], b.z - T.base[1]))[0] || null;
  }
  function findSite(G, k, x, z) {
    for (let r = 10; r < 60; r += 3) for (let a = 0; a < TAU; a += .45) { const px = x + Math.cos(a + r) * r, pz = z + Math.sin(a + r) * r; if (validSite(G, k, px, pz)) return [px, pz]; }
    return null;
  }

  /* ════════════════════════════════════════════════════════════════
     objetivos
  ════════════════════════════════════════════════════════════════ */
  function goalText(G) {
    const g = G.L.goal, P = G.player;
    if (g.kind === 'grow') { const huts = G.builds.filter(b => b.alive && b.t === 0 && b.k === 'hut' && b.prog >= 1).length; return `Converte nómadas ${Math.min(P.conv, g.convert)}/${g.convert} · Cabanas ${Math.min(huts, g.huts)}/${g.huts}`; }
    const foes = G.tribes.filter(t => t.idx !== 0 && t.alive);
    return foes.length ? `Derrota ${foes.map(t => TRIBES[t.idx].short).join(' e ')}` : 'Vitória!';
  }
  function checkEnd(G, api) {
    if (G.won || G.lost) return;
    const g = G.L.goal, P = G.player;
    if (g.kind === 'grow') { const huts = G.builds.filter(b => b.alive && b.t === 0 && b.k === 'hut' && b.prog >= 1).length; if (P.conv >= g.convert && huts >= g.huts) win(G, api); }
    else if (G.tribes.every(t => t.idx === 0 || !t.alive)) win(G, api);
    const hasStone = G.builds.some(b => b.alive && b.t === 0 && b.k === 'stone');
    const sham = P.shaman && P.shaman.alive;
    const any = G.units.some(u => u.alive && u.t === 0);
    if ((!sham && !hasStone) || !any && !G.builds.some(b => b.alive && b.t === 0 && b.k === 'hut')) lose(G, api, !sham && !hasStone ? 'A xamã caiu e a Pedra do Renascer foi destruída.' : 'A tua tribo desapareceu.');
  }
  function win(G, api) { G.won = true; G.endT = 0; say(G, 'VITÓRIA', 'A ilha é da Tribo da Aurora', 4, '#9dffbe'); sfx(G, 'win'); }
  function lose(G, api, why) { G.lost = why; G.endT = 0; say(G, 'DERROTA', why, 4, '#ff6b5a'); sfx(G, 'lose'); }
  function finish(G, api) {
    const L = G.L, sv = save(), t = Math.round(G.time);
    if (G.won) {
      const stars = t < 300 ? 3 : t < 540 ? 2 : 1, prev = sv.best[L.id] || {};
      sv.best[L.id] = { t: prev.t ? Math.min(prev.t, t) : t, s: Math.max(prev.s || 0, stars) }; sv.u = Math.max(sv.u || 1, G.li + 2); putSave(sv);
      const score = Math.max(100, 3000 - t * 3 + G.player.kills * 20 + G.player.conv * 30);
      try { GameProgress.record(ID, { won: true, score, mode: L.id, meta: { level: G.li + 1, all: G.li + 1 >= LEVELS.length, stars } }); } catch (e) {}
      const next = LEVELS[G.li + 1];
      api.panel({ icon: '🌋', title: `${L.name} — vitória!`, big: score, stars,
        stats: [['Tempo', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')], ['Inimigos vencidos', G.player.kills], ['Convertidos', G.player.conv], ['População', G.player.pop]],
        buttons: [...(next ? [{ label: '▶ Próxima ilha', primary: true, fn: () => api.play(next.id) }] : []), { label: '↺ Repetir', primary: !next, fn: () => api.play(L.id) }, { label: 'Mapa das ilhas', fn: () => api.menu() }] });
    } else {
      try { GameProgress.record(ID, { won: false, score: 0, mode: L.id, meta: {} }); } catch (e) {}
      api.panel({ icon: '🪶', title: 'A tribo foi vencida', sub: G.lost, buttons: [{ label: '↺ Tentar outra vez', primary: true, fn: () => api.play(L.id) }, { label: 'Mapa das ilhas', fn: () => api.menu() }] });
    }
  }

  /* ════════════════════════════════════════════════════════════════
     ciclo
  ════════════════════════════════════════════════════════════════ */
  function update(G, dt, api) {
    G.t += dt;
    if (!G.ok) return;
    dt = Math.min(dt, .05);
    G.time += dt; G.fxFrame = (G.fxFrame || 0) + 1;
    camKeys(G, dt);
    unitsStep(G, dt);
    buildsStep(G, dt);
    tribesStep(G, dt);
    fxStep(G, dt);
    if (G.dirtyT && G.fxFrame % 3 === 0) refreshTerrain(G);
    if (G.treeDirty) { G.treeDirty = 0; treesDirty(G); }
    G.r3.smoke.update(dt); G.r3.fire.update(dt);
    G.r3.flash.intensity *= Math.max(0, 1 - dt * 9);
    if (G.fxFrame % 30 === 0) checkEnd(G, api);
    G.builds.forEach(b => { b.workers = 0; }); G.units.forEach(u => { if (u.alive && u.job && u.state === 'job') u.job.workers++; });
    if (G.won || G.lost) { G.endT += dt; if (G.endT > 3.2 && !G.sent) { G.sent = 1; finish(G, api); } }
    G.shake = Math.max(0, G.shake - dt * 8);
    G.msg.forEach(m => { m.life -= dt; }); G.msg = G.msg.filter(m => m.life > 0);
    G.tipT += dt;
  }
  function camKeys(G, dt) {
    const k = G.keys, c = G.cam, sp = c.dist * 1.1 * dt;
    let mx = 0, mz = 0;
    if (k.KeyW || k.ArrowUp) mz -= 1; if (k.KeyS || k.ArrowDown) mz += 1; if (k.KeyA || k.ArrowLeft) mx -= 1; if (k.KeyD || k.ArrowRight) mx += 1;
    if (k.KeyQ) c.yaw += dt * 1.6; if (k.KeyE) c.yaw -= dt * 1.6;
    if (k.Equal || k.NumpadAdd) c.tdist = Math.max(40, c.tdist - dt * 120); if (k.Minus || k.NumpadSubtract) c.tdist = Math.min(320, c.tdist + dt * 120);
    if (mx || mz) { const s = Math.sin(c.yaw), co = Math.cos(c.yaw); c.x += (mx * co + mz * s) * sp; c.z += (-mx * s + mz * co) * sp; }
    c.x = clamp(c.x, H0 + 20, -H0 - 20); c.z = clamp(c.z, H0 + 20, -H0 - 20);
    c.dist = lerp(c.dist, c.tdist, Math.min(1, dt * 6));
    if (c.follow && c.follow.alive) { c.x = lerp(c.x, c.follow.x, Math.min(1, dt * 4)); c.z = lerp(c.z, c.follow.z, Math.min(1, dt * 4)); }
  }

  /* ════════════════════════════════════════════════════════════════
     desenho
  ════════════════════════════════════════════════════════════════ */
  const _m = { m: null, q: null, s: null, p: null, e: null };
  function draw(G, ctx, Wl, Hl, api) {
    const k = pxK(api);
    if (!G.ok) {
      ctx.save(); ctx.scale(k, k); const w = Wl / k, h = Hl / k;
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#16233a'); g.addColorStop(1, '#3a5a4a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff'; ctx.font = "700 16px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.fillText(G.fail3d ? 'Não foi possível arrancar o 3D' : 'A erguer as ilhas…', w / 2, h / 2);
      if (G.fail3d) { ctx.font = "500 13px 'Space Grotesk', system-ui"; ctx.fillStyle = '#ffd9b0'; ctx.fillText(G.failMsg || 'Este jogo precisa de WebGL (3D).', w / 2, h / 2 + 26); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('Se o erro persistir, recarrega a página com Ctrl+Shift+R.', w / 2, h / 2 + 46); }
      ctx.restore(); return;
    }
    if (!_m.m) { _m.m = new THREE.Matrix4(); _m.q = new THREE.Quaternion(); _m.s = new THREE.Vector3(); _m.p = new THREE.Vector3(); _m.e = new THREE.Euler(); }
    const r3 = G.r3, cam = r3.cam, c = G.cam;
    fit(G, api);
    /* câmara: mais perto = mais rasante */
    const pitch = lerp(.5, 1.05, sstep(40, 320, c.dist)), gy = Math.max(0, hAt(G, c.x, c.z));
    const sh = G.shake * .15;
    cam.position.set(c.x + Math.sin(c.yaw) * Math.cos(pitch) * c.dist + rand(-sh, sh), gy + Math.sin(pitch) * c.dist + rand(-sh, sh), c.z + Math.cos(c.yaw) * Math.cos(pitch) * c.dist);
    const cmin = Math.max(0, hAt(G, cam.position.x, cam.position.z)) + 6; if (cam.position.y < cmin) cam.position.y = cmin;
    cam.lookAt(c.x, gy + 2, c.z);
    cam.updateMatrixWorld();
    r3.skyM.position.copy(cam.position); r3.skyM.material.uniforms.uTime.value = G.t;
    r3.sun.position.set(c.x + r3.sunDir.x * 300, r3.sunDir.y * 300 + 20, c.z + r3.sunDir.z * 300); r3.sun.target.position.set(c.x, 0, c.z);
    const sc = r3.sun.shadow.camera, ext = Math.min(170, c.dist * .9 + 30); sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 10; sc.far = 800; sc.updateProjectionMatrix();
    const nm = r3.water.material.normalMap; nm.offset.x = (G.t * .01) % 1; nm.offset.y = (G.t * .007) % 1;
    if ((G.fxFrame || 0) % 15 === 0) r3.clouds.sort(cam);
    drawUnits(G);
    drawFx(G);
    const ppu = r3.renderer.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
    r3.smoke.mat.uniforms.uScale.value = ppu; r3.fire.mat.uniforms.uScale.value = ppu;
    r3.renderer.render(r3.scene, cam);
    hud(G, ctx, Wl, Hl, api);
  }
  function fit(G, api) {
    const r3 = G.r3, st = api.stage, w = st.clientWidth || 1, h = st.clientHeight || 1, dpr = Math.min(window.devicePixelRatio || 1, r3.coarse ? 1.5 : 2);
    if (w !== r3.w || h !== r3.h || dpr !== r3.dpr) { r3.w = w; r3.h = h; r3.dpr = dpr; r3.renderer.setPixelRatio(dpr); r3.renderer.setSize(w, h, false); r3.cam.aspect = w / h; r3.cam.updateProjectionMatrix(); }
  }
  function drawUnits(G) {
    const { m, q, s, p, e } = _m, r3 = G.r3, cnt = {}, col = new THREE.Color(), selC = [];
    Object.keys(r3.inst).forEach(k => { cnt[k] = 0; });
    G.units.forEach(u => {
      if (!u.alive || u.inside) return;
      const [a, b] = r3.inst[u.k], i = cnt[u.k]++;
      if (i >= a.instanceMatrix.count) return;
      const mv = u.moving > 0 || u.fly, bob = mv ? Math.abs(Math.sin(u.anim * 10)) * .25 : 0;
      const lean = u.swing ? -u.swing * 1.5 : mv ? .08 : 0;
      e.set(lean + (u.fly ? u.anim * 4 : 0), u.face, u.stun > 0 ? Math.sin(u.anim * 12) * .2 : 0, 'YXZ'); q.setFromEuler(e);
      s.setScalar(u.k === 'shaman' ? 1.12 : 1);
      p.set(u.x, u.y + bob, u.z); m.compose(p, q, s);
      a.setMatrixAt(i, m); b.setMatrixAt(i, m);
      col.set(u.t >= 0 ? TRIBES[u.t].color : WILD_COLOR); if (u.hitT > 0) col.lerp(new THREE.Color('#ffffff'), .6);
      b.setColorAt(i, col);
      if (G.sel.has(u)) selC.push(u);
      if (u.swing) u.swing = Math.max(0, u.swing - .016);
      if (u.hitT > 0) u.hitT -= .016;
    });
    Object.keys(r3.inst).forEach(k => { const [a, b] = r3.inst[k]; a.count = b.count = cnt[k]; a.instanceMatrix.needsUpdate = b.instanceMatrix.needsUpdate = true; if (b.instanceColor) b.instanceColor.needsUpdate = true; });
    const ring = r3.ring; ring.count = Math.min(400, selC.length);
    selC.slice(0, 400).forEach((u, i) => { q.identity(); s.setScalar(u.k === 'shaman' ? 1.4 : 1); p.set(u.x, u.y + .15, u.z); m.compose(p, q, s); ring.setMatrixAt(i, m); });
    ring.instanceMatrix.needsUpdate = true;
  }
  function drawFx(G) {
    const r3 = G.r3;
    /* raios */
    if (!r3.boltLines) { r3.boltLines = []; }
    r3.boltLines.forEach(l => { r3.scene.remove(l); l.geometry.dispose(); }); r3.boltLines = [];
    G.fx.forEach(f => {
      if (f.k === 'bolt' && Math.floor(f.t * 20) % 2 === 0) {
        const pts = [], rn = W().rng(Math.floor(f.seed * 1e6) + Math.floor(f.t * 10));
        let x = f.x + rand(-6, 6), z = f.z + rand(-6, 6);
        for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(lerp(x, f.x, t) + (rn() - .5) * 3 * (1 - t), lerp(f.y + 70, f.y + .5, t), lerp(z, f.z, t) + (rn() - .5) * 3 * (1 - t))); }
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), r3.boltMat || (r3.boltMat = new THREE.LineBasicMaterial({ color: '#e6f6ff', toneMapped: false })));
        r3.scene.add(l); r3.boltLines.push(l);
      }
    });
    /* marcador de ordens / alvo do feitiço */
    const t = r3.tgt, mk = G.fx.find(f => f.k === 'mark');
    if (G.mode && G.mode.spell && G.ptr.ok) { const P = SP[G.mode.spell]; t.visible = true; t.position.set(G.ptr.wx, Math.max(0, hAt(G, G.ptr.wx, G.ptr.wz)) + .4, G.ptr.wz); t.scale.setScalar(Math.max(2, P.r || 3)); t.material.color.set(canCast(G, G.player, G.mode.spell) ? '#7df9ff' : '#ff6b5a'); }
    else if (mk) { t.visible = true; t.position.set(mk.x, Math.max(0, hAt(G, mk.x, mk.z)) + .4, mk.z); t.scale.setScalar(1 + mk.t * 4); t.material.color.set(mk.c); t.material.opacity = 1 - mk.t / mk.life; mk.t += .016; if (mk.t > mk.life) G.fx.splice(G.fx.indexOf(mk), 1); }
    else t.visible = false;
    if (!(G.mode && G.mode.spell)) t.material.opacity = Math.max(.2, t.material.opacity); else t.material.opacity = .85;
    /* fantasma do edifício a construir */
    if (G.mode && G.mode.build && G.ptr.ok) {
      if (!r3.ghost || r3.ghost.k !== G.mode.build) {
        if (r3.ghost) r3.scene.remove(r3.ghost.g);
        const g = buildingMesh(G, G.mode.build, 0), gm = new THREE.MeshBasicMaterial({ color: '#7dff9a', transparent: true, opacity: .45, depthWrite: false });
        g.traverse(o => { if (o.isMesh) o.material = gm; }); r3.scene.add(g); r3.ghost = { k: G.mode.build, g, gm };
      }
      const ok = validSite(G, G.mode.build, G.ptr.wx, G.ptr.wz);
      r3.ghost.g.visible = true; r3.ghost.g.position.set(G.ptr.wx, hAt(G, G.ptr.wx, G.ptr.wz), G.ptr.wz); r3.ghost.g.rotation.y = Math.atan2(-G.ptr.wx, -G.ptr.wz); r3.ghost.gm.color.set(ok ? '#7dff9a' : '#ff6b5a');
    } else if (r3.ghost) r3.ghost.g.visible = false;
  }

  /* ════════════════════════════════════════════════════════════════
     HUD (canvas 2D em px CSS) e botões
  ════════════════════════════════════════════════════════════════ */
  const pxK = api => api.W / ((api.stage && api.stage.clientWidth) || api.W);
  const FONT = "'Space Grotesk', system-ui, sans-serif";
  function layout(G, api) {
    const k = pxK(api), w = api.W / k, h = api.H / k, sm = w < 640;
    const bs = sm ? 40 : 48, gap = 6, L = G.L.spells.length;
    const spells = G.L.spells.map((s, i) => ({ id: 'sp:' + s, x: w / 2 - (L * (bs + gap) - gap) / 2 + i * (bs + gap), y: h - bs - (sm ? 10 : 14), w: bs, h: bs, spell: s }));
    const cb = sm ? 34 : 40, col = [];
    const cmds = [['sel:shaman', 'Xamã'], ['sel:army', 'Exército'], ['sel:all', 'Todos'], ['build:hut', 'Cabana'], ['build:barracks', 'Quartel'], ['build:temple', 'Templo'], ['build:tower', 'Torre'], ['train:warrior', 'Guerreiro'], ['train:fire', 'Arqueiro']];
    const avail = cmds.filter(([id]) => !(id === 'build:temple' && G.li < 3) && !(id === 'train:fire' && G.li < 3) && !(id === 'build:tower' && G.li < 2) && !((id === 'build:barracks' || id === 'train:warrior') && G.li < 1));
    const perCol = sm ? 5 : 9;
    avail.forEach(([id, label], i) => col.push({ id, label, x: 10 + Math.floor(i / perCol) * (cb + 30 + 4), y: (sm ? 64 : 76) + (i % perCol) * (cb + 4), w: cb + 30, h: cb }));
    const mm = sm ? 96 : 140;
    return { w, h, sm, spells, cmds: col, mini: { x: w - mm - 12, y: h - mm - (sm ? 12 : 16), s: mm } };
  }
  function hud(G, ctx, Wl, Hl, api) {
    const k = pxK(api); ctx.save(); ctx.scale(k, k);
    const Lo = layout(G, api), { w, h, sm } = Lo, P = G.player;
    ctx.textBaseline = 'alphabetic';
    /* barras de vida (unidades feridas / selecionadas, edifícios) */
    const v = new THREE.Vector3(), cam = G.r3.cam;
    const sc = (x, y, z) => { v.set(x, y, z).project(cam); return v.z < 1 ? [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h] : null; };
    G.units.forEach(u => { if (!u.alive || u.inside || (u.hp >= u.T.hp && !G.sel.has(u))) return; const p = sc(u.x, u.y + 3.4, u.z); if (!p) return; bar(ctx, p[0] - 9, p[1], 18, 3, u.hp / u.T.hp, u.t >= 0 ? TRIBES[u.t].color : WILD_COLOR); });
    G.builds.forEach(b => { if (!b.alive) return; const p = sc(b.x, b.y + (b.k === 'tower' ? 11 : 8), b.z); if (!p) return; if (b.prog < 1) { bar(ctx, p[0] - 16, p[1], 32, 4, b.prog, '#e8d9a8'); ctx.font = `600 10px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`🪵 ${b.wood}/${b.T.wood}`, p[0], p[1] - 4); } else if (b.hp < b.T.hp) bar(ctx, p[0] - 16, p[1], 32, 4, b.hp / b.T.hp, TRIBES[Math.max(0, b.t)].color); });
    /* painel da tribo */
    const pw = sm ? 170 : 230;
    const top = sm ? 54 : 60;
    ctx.fillStyle = 'rgba(8,12,20,.55)'; Ut.rr(ctx, w - pw - 10, top, pw, sm ? 58 : 74, 12); ctx.fill();
    ctx.font = `700 ${sm ? 11 : 12}px ${FONT}`; ctx.fillStyle = '#9ec5ff'; ctx.textAlign = 'left';
    ctx.fillText(`✦ Mana ${Math.floor(P.mana)}`, w - pw, top + 18);
    bar(ctx, w - pw, top + 24, pw - 20, 6, P.mana / 999, '#5aa8ff');
    const cnt = k2 => G.units.filter(u => u.alive && u.t === 0 && u.k === k2).length;
    ctx.fillStyle = '#e6edf7'; ctx.font = `600 ${sm ? 10 : 11}px ${FONT}`;
    ctx.fillText(`Aldeões ${cnt('brave')} · Guerreiros ${cnt('warrior')} · Arqueiros ${cnt('fire')}`, w - pw, top + (sm ? 46 : 50));
    if (!sm) ctx.fillText(`Cabanas ${G.builds.filter(b => b.alive && b.t === 0 && b.k === 'hut' && b.prog >= 1).length} · Pop. ${P.pop}`, w - pw, top + 66);
    /* objetivo */
    ctx.font = `700 ${sm ? 11 : 13}px ${FONT}`; ctx.fillStyle = '#ffd34d'; ctx.textAlign = 'center';
    ctx.fillText('▸ ' + goalText(G), w / 2, sm ? 70 : 78);
    /* botões de comando */
    Lo.cmds.forEach(b => {
      const on = (G.mode && G.mode.id === b.id), en = cmdEnabled(G, b.id);
      ctx.globalAlpha = en ? 1 : .45;
      ctx.fillStyle = on ? 'rgba(125,249,255,.32)' : 'rgba(8,12,20,.62)'; Ut.rr(ctx, b.x, b.y, b.w, b.h, 9); ctx.fill();
      ctx.strokeStyle = on ? '#7df9ff' : 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${sm ? 10 : 11}px ${FONT}`; ctx.textAlign = 'left';
      const [kind, what] = b.id.split(':');
      const ic = kind === 'sel' ? (what === 'shaman' ? '✦' : what === 'army' ? '⚔' : '●') : kind === 'build' ? '▲' : '+';
      ctx.fillText(ic + ' ' + b.label, b.x + 8, b.y + b.h / 2 + 4);
      if (kind === 'build') { ctx.fillStyle = '#e8d9a8'; ctx.font = `600 9px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText('🪵' + BT[what].wood, b.x + b.w - 5, b.y + b.h - 5); }
      if (kind === 'train') { ctx.fillStyle = '#9ec5ff'; ctx.font = `600 9px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText('✦' + UT[what].cost, b.x + b.w - 5, b.y + b.h - 5); }
      ctx.globalAlpha = 1;
    });
    /* feitiços */
    Lo.spells.forEach((b, i) => {
      const s = SP[b.spell], can = canCast(G, P, b.spell), on = G.mode && G.mode.spell === b.spell;
      ctx.fillStyle = on ? 'rgba(125,249,255,.35)' : 'rgba(8,12,20,.66)'; Ut.rr(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
      ctx.strokeStyle = on ? '#7df9ff' : can ? 'rgba(158,197,255,.55)' : 'rgba(255,255,255,.12)'; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
      ctx.globalAlpha = can ? 1 : .4; spellIcon(ctx, b.spell, b.x + b.w / 2, b.y + b.h / 2 - 4, b.w * .3); ctx.globalAlpha = 1;
      ctx.fillStyle = can ? '#9ec5ff' : '#7a8496'; ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(s.cost, b.x + b.w / 2, b.y + b.h - 5);
      if (!sm) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(String(i + 1), b.x + 4, b.y + 11); }
      if (P.mana < s.cost) { ctx.fillStyle = 'rgba(90,168,255,.25)'; ctx.fillRect(b.x + 2, b.y + b.h - 3, (b.w - 4) * P.mana / s.cost, 2); }
    });
    /* dica do botão sob o ponteiro */
    const hv = hoverBtn(G, api, Lo);
    if (hv) {
      let t1 = '', t2 = '';
      if (hv.spell) { t1 = SP[hv.spell].name + ` (${SP[hv.spell].cost} mana)`; t2 = SP[hv.spell].desc; }
      else { const [kind, what] = hv.id.split(':'); if (kind === 'build') { t1 = BT[what].name + ` (${BT[what].wood} madeira)`; t2 = BT[what].desc; } else if (kind === 'train') { t1 = 'Treinar ' + UT[what].name; t2 = `Um aldeão livre entra no ${what === 'warrior' ? 'Quartel' : 'Templo do Fogo'} (${UT[what].cost} mana).`; } }
      if (t1) { ctx.font = `700 12px ${FONT}`; const tw = Math.max(ctx.measureText(t1).width, ctx.measureText(t2).width) + 20, tx = clamp(hv.x, 8, w - tw - 8), ty = hv.y - 48; ctx.fillStyle = 'rgba(8,12,20,.85)'; Ut.rr(ctx, tx, ty, tw, 40, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(t1, tx + 10, ty + 16); ctx.font = `500 11px ${FONT}`; ctx.fillStyle = '#c9d4e3'; ctx.fillText(t2, tx + 10, ty + 32); }
    }
    /* minimapa */
    minimap(G, ctx, Lo.mini);
    /* caixa de seleção */
    if (G.box) { ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.strokeRect(Math.min(G.box.x0, G.box.x1), Math.min(G.box.y0, G.box.y1), Math.abs(G.box.x1 - G.box.x0), Math.abs(G.box.y1 - G.box.y0)); ctx.setLineDash([]); ctx.fillStyle = 'rgba(125,249,255,.08)'; ctx.fillRect(Math.min(G.box.x0, G.box.x1), Math.min(G.box.y0, G.box.y1), Math.abs(G.box.x1 - G.box.x0), Math.abs(G.box.y1 - G.box.y0)); }
    /* mensagens */
    G.msg.slice(-2).forEach((m, i) => {
      const a = Math.min(1, m.life * 2), y = h * .26 + i * 52;
      ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.font = `800 ${m.big ? (sm ? 24 : 34) : (sm ? 16 : 20)}px ${FONT}`; ctx.fillStyle = m.c || '#fff'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8;
      ctx.fillText(m.t, w / 2, y);
      if (m.s) { ctx.font = `600 ${sm ? 12 : 14}px ${FONT}`; ctx.fillStyle = '#eef3fa'; ctx.fillText(m.s, w / 2, y + 22); }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    });
    /* dicas do nível */
    const tips = G.L.tips || [];
    if (G.tipT < tips.length * 9 + 4 && G.tipT > 4) {
      const t = tips[Math.min(tips.length - 1, Math.floor((G.tipT - 4) / 9))];
      ctx.font = `600 ${sm ? 11 : 12}px ${FONT}`; const tw = Math.min(w - 40, ctx.measureText('💡 ' + t).width + 24);
      ctx.fillStyle = 'rgba(8,12,20,.7)'; Ut.rr(ctx, w / 2 - tw / 2, Lo.spells[0].y - 40, tw, 28, 10); ctx.fill();
      ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.fillText('💡 ' + t, w / 2, Lo.spells[0].y - 21);
    }
    if (G.mode) {
      ctx.font = `700 12px ${FONT}`; ctx.fillStyle = '#7df9ff'; ctx.textAlign = 'center';
      ctx.fillText(G.mode.spell ? `${SP[G.mode.spell].name}: escolhe o alvo (clique direito cancela)` : G.mode.build ? `${BT[G.mode.build].name}: escolhe o sítio (clique direito cancela)` : '', w / 2, Lo.spells[0].y - 50);
    }
    ctx.restore();
  }
  function bar(ctx, x, y, w, h, f, c) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = c; ctx.fillRect(x, y, w * clamp(f, 0, 1), h); }
  function spellIcon(ctx, k, x, y, r) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#cfe8ff'; ctx.fillStyle = '#cfe8ff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (k === 'blast') { for (let i = 0; i < 3; i++) { ctx.moveTo(-r + i * 3, -r * .6 + i * r * .6); ctx.quadraticCurveTo(0, -r * .9 + i * r * .6, r, -r * .4 + i * r * .6); } ctx.stroke(); }
    else if (k === 'bolt') { ctx.moveTo(r * .3, -r); ctx.lineTo(-r * .35, r * .1); ctx.lineTo(r * .15, r * .1); ctx.lineTo(-r * .3, r); ctx.stroke(); }
    else if (k === 'convert') { ctx.arc(0, 0, r * .75, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * .25, 0, TAU); ctx.fill(); }
    else if (k === 'swarm') { for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 2.3) * r * .7, Math.sin(i * 1.7) * r * .7, 1.8, 0, TAU); ctx.fill(); } }
    else if (k === 'bridge') { ctx.moveTo(-r, r * .5); ctx.quadraticCurveTo(0, -r * .7, r, r * .5); ctx.moveTo(-r, r * .8); ctx.lineTo(r, r * .8); ctx.stroke(); }
    else if (k === 'quake') { ctx.moveTo(-r, -r * .2); ctx.lineTo(-r * .4, r * .3); ctx.lineTo(0, -r * .4); ctx.lineTo(r * .4, r * .4); ctx.lineTo(r, -r * .1); ctx.moveTo(-r, r * .8); ctx.lineTo(r, r * .8); ctx.stroke(); }
    else if (k === 'tornado') { for (let i = 0; i < 4; i++) { const ww = r * (1 - i * .22); ctx.moveTo(-ww, -r * .8 + i * r * .5); ctx.lineTo(ww, -r * .8 + i * r * .5); } ctx.stroke(); }
    else if (k === 'volcano') { ctx.moveTo(-r, r * .8); ctx.lineTo(-r * .3, -r * .3); ctx.lineTo(r * .3, -r * .3); ctx.lineTo(r, r * .8); ctx.stroke(); ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(0, -r * .7, r * .25, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function minimap(G, ctx, M) {
    if (!G.mini || G.fxFrame % 60 === 0 || G.dirtyMini) {
      const c = G.mini || (G.mini = document.createElement('canvas')); c.width = c.height = 128; const x = c.getContext('2d'), img = x.createImageData(128, 128);
      for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) { const hh = cellH(G, i, j), k2 = (j * 128 + i) * 4; if (hh < .35) { img.data[k2] = 22; img.data[k2 + 1] = 70 + hh * 3; img.data[k2 + 2] = 100; } else { const v = clamp(hh / 20, 0, 1); img.data[k2] = 80 + v * 90; img.data[k2 + 1] = 130 + v * 40; img.data[k2 + 2] = 60 + v * 60; } img.data[k2 + 3] = 255; }
      x.putImageData(img, 0, 0); G.dirtyMini = false;
    }
    ctx.save(); ctx.fillStyle = 'rgba(8,12,20,.6)'; Ut.rr(ctx, M.x - 4, M.y - 4, M.s + 8, M.s + 8, 10); ctx.fill();
    ctx.imageSmoothingEnabled = true; ctx.drawImage(G.mini, M.x, M.y, M.s, M.s);
    const toM = (x, z) => [M.x + (x - H0) / S * M.s, M.y + (z - H0) / S * M.s];
    G.builds.forEach(b => { if (!b.alive) return; const [x, y] = toM(b.x, b.z); ctx.fillStyle = TRIBES[Math.max(0, b.t)].color; ctx.fillRect(x - 2.5, y - 2.5, 5, 5); ctx.strokeStyle = '#fff'; ctx.lineWidth = .6; ctx.strokeRect(x - 2.5, y - 2.5, 5, 5); });
    G.units.forEach(u => { if (!u.alive || u.inside) return; const [x, y] = toM(u.x, u.z); ctx.fillStyle = u.t >= 0 ? TRIBES[u.t].light : '#e8d0a8'; ctx.fillRect(x - 1, y - 1, u.k === 'shaman' ? 3.5 : 2, u.k === 'shaman' ? 3.5 : 2); });
    G.storms.forEach(s => { const [x, y] = toM(s.x, s.z); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.stroke(); });
    /* vista da câmara */
    const c = G.cam, [cx, cy] = toM(c.x, c.z), vr = c.dist * .55 / S * M.s;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1; ctx.save(); ctx.translate(cx, cy); ctx.rotate(-c.yaw); ctx.strokeRect(-vr, -vr * .7, vr * 2, vr * 1.4); ctx.restore();
    ctx.restore();
  }
  function cmdEnabled(G, id) {
    const [kind, what] = id.split(':'), P = G.player;
    if (kind === 'build') return G.units.some(u => u.alive && u.t === 0 && u.k === 'brave');
    if (kind === 'train') { const b = G.builds.find(x => x.alive && x.t === 0 && x.prog >= 1 && x.k === (what === 'warrior' ? 'barracks' : 'temple')); return !!b && P.mana >= UT[what].cost && G.units.some(u => u.alive && u.t === 0 && u.k === 'brave'); }
    if (what === 'shaman') return !!(P.shaman && P.shaman.alive);
    return true;
  }
  function hoverBtn(G, api, Lo) {
    if (G.touch || !G.ptr.in) return null;
    const x = G.ptr.cx, y = G.ptr.cy;
    return Lo.spells.concat(Lo.cmds).find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  }
  function say(G, t, s, life, c) { G.msg.push({ t, s, life: life || 2, c, big: t === 'VITÓRIA' || t === 'DERROTA' }); if (G.msg.length > 4) G.msg.shift(); }

  /* ════════════════════════════════════════════════════════════════
     entrada
  ════════════════════════════════════════════════════════════════ */
  function pickGround(G, cx, cy, api) {
    const k = pxK(api), w = api.W / k, h = api.H / k, cam = G.r3.cam;
    const v = new THREE.Vector3((cx / w) * 2 - 1, -(cy / h) * 2 + 1, .5).unproject(cam).sub(cam.position).normalize();
    const o = cam.position;
    let t = 0, prev = 0;
    for (let i = 0; i < 400; i++) { t += 2.5; const x = o.x + v.x * t, y = o.y + v.y * t, z = o.z + v.z * t; if (y < Math.max(hAt(G, x, z), 0)) { let a = prev, b = t; for (let k2 = 0; k2 < 12; k2++) { const m = (a + b) / 2, xm = o.x + v.x * m, ym = o.y + v.y * m, zm = o.z + v.z * m; if (ym < Math.max(hAt(G, xm, zm), 0)) b = m; else a = m; } return [o.x + v.x * b, o.z + v.z * b]; } prev = t; }
    return null;
  }
  function pickThing(G, cx, cy, api) {
    const k = pxK(api), w = api.W / k, h = api.H / k, cam = G.r3.cam, v = new THREE.Vector3();
    let best = null, bd = 18;
    G.units.forEach(u => { if (!u.alive || u.inside) return; v.set(u.x, u.y + 1.4, u.z).project(cam); if (v.z > 1) return; const d = Math.hypot((v.x + 1) / 2 * w - cx, (1 - v.y) / 2 * h - cy); if (d < bd) { bd = d; best = { u }; } });
    if (!best) {
      bd = 40;
      G.builds.forEach(b => { if (!b.alive) return; v.set(b.x, b.y + 3, b.z).project(cam); if (v.z > 1) return; const d = Math.hypot((v.x + 1) / 2 * w - cx, (1 - v.y) / 2 * h - cy); if (d < bd) { bd = d; best = { b }; } });
    }
    return best || {};
  }
  function uiHit(G, api, cx, cy) {
    const Lo = layout(G, api);
    const b = Lo.spells.concat(Lo.cmds).find(b => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
    if (b) return { btn: b };
    const M = Lo.mini; if (cx >= M.x && cx <= M.x + M.s && cy >= M.y && cy <= M.y + M.s) return { mini: [H0 + (cx - M.x) / M.s * S, H0 + (cy - M.y) / M.s * S] };
    return null;
  }
  function pressBtn(G, api, b) {
    sfx(G, 'ui');
    if (b.spell) { if (G.mode && G.mode.spell === b.spell) G.mode = null; else G.mode = { spell: b.spell, id: b.id }; return; }
    const [kind, what] = b.id.split(':'), P = G.player;
    if (kind === 'sel') {
      G.sel.clear(); G.mode = null;
      G.units.forEach(u => { if (!u.alive || u.t !== 0) return; if (what === 'all' || (what === 'army' && (u.k === 'warrior' || u.k === 'fire')) || (what === 'shaman' && u.k === 'shaman')) G.sel.add(u); });
      if (what === 'shaman' && P.shaman && P.shaman.alive) { G.cam.x = P.shaman.x; G.cam.z = P.shaman.z; }
      return;
    }
    if (kind === 'build') { if (!cmdEnabled(G, b.id)) return; G.mode = G.mode && G.mode.build === what ? null : { build: what, id: b.id }; return; }
    if (kind === 'train') {
      if (!cmdEnabled(G, b.id)) { say(G, 'Não é possível treinar', what === 'warrior' ? 'Precisas de um Quartel pronto, mana e um aldeão.' : 'Precisas de um Templo do Fogo pronto, mana e um aldeão.', 2); return; }
      const bk = what === 'warrior' ? 'barracks' : 'temple', bld = G.builds.filter(x => x.alive && x.t === 0 && x.prog >= 1 && x.k === bk)[0];
      const sel = [...G.sel].filter(u => u.alive && u.k === 'brave'), pool = sel.length ? sel : G.units.filter(u => u.alive && u.t === 0 && u.k === 'brave' && (u.state === 'idle' || u.state === 'move')).sort((a, c) => Math.hypot(a.x - bld.x, a.z - bld.z) - Math.hypot(c.x - bld.x, c.z - bld.z));
      const u = pool[0] || G.units.find(x => x.alive && x.t === 0 && x.k === 'brave');
      if (u) { orderTrain(G, u, bld); marker(G, bld.x, bld.z, '#ffd34d'); }
    }
  }
  function leftAt(G, api, cx, cy, shift) {
    const ui = uiHit(G, api, cx, cy);
    if (ui) { if (ui.btn) pressBtn(G, api, ui.btn); else { G.cam.x = ui.mini[0]; G.cam.z = ui.mini[1]; } return; }
    const gp = pickGround(G, cx, cy, api);
    if (G.mode && G.mode.spell) {
      if (!gp) return;
      if (!canCast(G, G.player, G.mode.spell)) { say(G, G.player.shaman && G.player.shaman.alive ? 'Falta mana' : 'A xamã não está disponível', '', 1.3); return; }
      cast(G, G.player, G.mode.spell, gp[0], gp[1]); marker(G, gp[0], gp[1], '#9ef3ff');
      if (!shift) G.mode = null; return;
    }
    if (G.mode && G.mode.build) {
      if (!gp) return;
      if (!validSite(G, G.mode.build, gp[0], gp[1])) { say(G, 'Aqui não dá para construir', 'Precisa de chão plano, livre e longe da água.', 1.6); sfx(G, 'no'); return; }
      const b = addBuild(G, G.mode.build, 0, gp[0], gp[1], 0);
      let sel = [...G.sel].filter(u => u.alive && u.k === 'brave');
      if (!sel.length) sel = G.units.filter(u => u.alive && u.t === 0 && u.k === 'brave' && u.state !== 'job').sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z)).slice(0, 3);
      sel.forEach(u => orderBuild(G, u, b));
      sfx(G, 'place');
      if (!shift) G.mode = null; return;
    }
    const th = pickThing(G, cx, cy, api);
    if (!shift) G.sel.clear();
    if (th.u && th.u.t === 0) { if (G.sel.has(th.u) && shift) G.sel.delete(th.u); else G.sel.add(th.u); sfx(G, 'sel'); }
  }
  function rightAt(G, api, cx, cy) {
    if (G.mode) { G.mode = null; return; }
    const gp = pickGround(G, cx, cy, api); if (!gp) return;
    const th = pickThing(G, cx, cy, api);
    const tree = !th.u && !th.b ? G.trees.find(t => t.alive && Math.hypot(t.x - gp[0], t.z - gp[1]) < 2.5) : null;
    command(G, gp[0], gp[1], th.u, th.b, tree);
  }
  function down(G, x, y, api, e) {
    if (!G.ok) return;
    const k = pxK(api), cx = x / k, cy = y / k, id = e && e.pointerId != null ? e.pointerId : 1;
    if (e && e.pointerType === 'mouse') {
      if (e.button === 2) { G.rdown = { cx, cy, yaw: G.cam.yaw, moved: false }; return; }
      if (e.button === 1) { G.mdown = { cx, yaw: G.cam.yaw }; return; }
      G.ldown = { cx, cy, shift: e.shiftKey, t: performance.now() };
      return;
    }
    G.touch = true;
    G.tp.set(id, { x: cx, y: cy, x0: cx, y0: cy, t: performance.now() });
    if (G.tp.size === 2) { const [a, b] = [...G.tp.values()]; G.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), dist: G.cam.tdist, yaw: G.cam.yaw }; }
  }
  function move(G, x, y, api, e, isDown) {
    if (!G.ok) return;
    const k = pxK(api), cx = x / k, cy = y / k, id = e && e.pointerId != null ? e.pointerId : 1;
    G.ptr.cx = cx; G.ptr.cy = cy; G.ptr.in = true;
    if (!G.touch || (e && e.pointerType === 'mouse')) { const gp = pickGround(G, cx, cy, api); G.ptr.ok = !!gp; if (gp) { G.ptr.wx = gp[0]; G.ptr.wz = gp[1]; } }
    if (e && e.pointerType === 'mouse') {
      if (G.ldown && !G.mode && Math.hypot(cx - G.ldown.cx, cy - G.ldown.cy) > 6) G.box = { x0: G.ldown.cx, y0: G.ldown.cy, x1: cx, y1: cy };
      if (G.rdown && Math.abs(cx - G.rdown.cx) > 6) { G.rdown.moved = true; G.cam.yaw = G.rdown.yaw - (cx - G.rdown.cx) * .008; }
      if (G.mdown) G.cam.yaw = G.mdown.yaw - (cx - G.mdown.cx) * .008;
      return;
    }
    const t = G.tp.get(id); if (!t) return;
    const dx = cx - t.x, dy = cy - t.y; t.x = cx; t.y = cy;
    if (G.tp.size >= 2 && G.pinch) {
      const [a, b] = [...G.tp.values()], d = Math.hypot(a.x - b.x, a.y - b.y), an = Math.atan2(b.y - a.y, b.x - a.x);
      G.cam.tdist = clamp(G.pinch.dist * G.pinch.d / Math.max(20, d), 40, 320); G.cam.yaw = G.pinch.yaw - (an - G.pinch.a);
      t.moved = true; return;
    }
    if (Math.hypot(cx - t.x0, cy - t.y0) > 10) t.moved = true;
    if (t.moved && !(G.mode && G.mode.build)) {
      const s = G.cam.dist * .0035, sn = Math.sin(G.cam.yaw), co = Math.cos(G.cam.yaw);
      G.cam.x -= (dx * co + dy * sn) * s; G.cam.z -= (-dx * sn + dy * co) * s; G.cam.follow = null;
    }
  }
  function up(G, x, y, api, e) {
    if (!G.ok) return;
    const k = pxK(api), cx = x / k, cy = y / k, id = e && e.pointerId != null ? e.pointerId : 1;
    if (e && e.pointerType === 'mouse') {
      if (e.button === 2 && G.rdown) { if (!G.rdown.moved) rightAt(G, api, cx, cy); G.rdown = null; return; }
      if (e.button === 1) { G.mdown = null; return; }
      if (G.ldown) {
        if (G.box) {
          const b = G.box, x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1), w = api.W / k, h = api.H / k, v = new THREE.Vector3();
          if (!G.ldown.shift) G.sel.clear();
          G.units.forEach(u => { if (!u.alive || u.t !== 0 || u.inside) return; v.set(u.x, u.y + 1, u.z).project(G.r3.cam); const sx = (v.x + 1) / 2 * w, sy = (1 - v.y) / 2 * h; if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) G.sel.add(u); });
          if (G.sel.size) sfx(G, 'sel');
        } else leftAt(G, api, G.ldown.cx, G.ldown.cy, G.ldown.shift);
        G.box = null; G.ldown = null;
      }
      return;
    }
    const t = G.tp.get(id); G.tp.delete(id);
    if (G.tp.size < 2) G.pinch = null;
    if (!t || t.moved || G.tp.size) return;
    /* toque curto: botão, feitiço/obra, selecionar ou dar ordem */
    if (uiHit(G, api, cx, cy) || G.mode) { leftAt(G, api, cx, cy, false); return; }
    const th = pickThing(G, cx, cy, api);
    if (th.u && th.u.t === 0) { if (G.sel.has(th.u)) G.sel.delete(th.u); else G.sel.add(th.u); sfx(G, 'sel'); return; }
    if (G.sel.size) rightAt(G, api, cx, cy);
  }
  function wheel(G, e) { G.cam.tdist = clamp(G.cam.tdist * (e.deltaY > 0 ? 1.12 : .89), 40, 320); }
  function key(G, e, api) {
    const c = e.code || ''; G.keys[c] = true;
    if (!e.repeat) {
      const n = parseInt(c.replace('Digit', ''), 10);
      if (c.startsWith('Digit') && n >= 1 && n <= 8) { const s = SP_ORDER[n - 1]; if (G.L.spells.includes(s)) { G.mode = G.mode && G.mode.spell === s ? null : { spell: s, id: 'sp:' + s }; sfx(G, 'ui'); } }
      if (c === 'Space') { const P = G.player; if (P.shaman && P.shaman.alive) { G.sel.clear(); G.sel.add(P.shaman); G.cam.x = P.shaman.x; G.cam.z = P.shaman.z; } }
      if (c === 'KeyH') { const s = G.builds.find(b => b.alive && b.t === 0) ; if (s) { G.cam.x = s.x; G.cam.z = s.z; } }
      if (c === 'KeyF') { const u = [...G.sel][0]; G.cam.follow = G.cam.follow ? null : u || null; }
      if (c === 'KeyB') { G.mode = G.mode && G.mode.build === 'hut' ? null : { build: 'hut', id: 'build:hut' }; }
    }
    if (c === 'Escape' && G.mode) { G.mode = null; return true; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c)) return true;
  }
  function keyup(G, e) { if (!e.code) { G.keys = {}; return; } G.keys[e.code] = false; }

  /* ════════════════════════════════════════════════════════════════
     efeitos e som
  ════════════════════════════════════════════════════════════════ */
  function burst(G, x, y, z, c, n) { const F = G.r3 && G.r3.fire; if (!F) return; for (let i = 0; i < n; i++) F.spawn({ x, y, z, vx: rand(-5, 5), vy: rand(1, 8), vz: rand(-5, 5), life: rand(.5, 1), s0: 1.2, s1: .3, c0: c, k: 1.5, drag: 1.5, grav: 4 }); }
  function fireP(G, x, y, z, n, sp, c) { const F = G.r3.fire; for (let i = 0; i < n; i++) F.spawn({ x, y, z, vx: rand(-sp, sp), vy: rand(0, sp * 1.4), vz: rand(-sp, sp), life: rand(.4, .9), s0: 2.6, s1: 5, c0: c, c1: '#ff3a0a', k: 1.7, drag: 2 }); }
  function smoke(G, x, y, z, s, c) { const P = G.r3 && G.r3.smoke; if (!P) return; P.spawn({ x, y, z, vx: rand(-1, 1), vy: rand(1, 3), vz: rand(-1, 1), life: rand(2, 3.5), s0: s * .5, s1: s * 1.6, c0: c, c1: '#555049', a: .7, drag: .6, grav: -1, rotv: rand(-.5, .5) }); }
  function ringFx(G, x, z, r, c) { for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; G.r3.fire.spawn({ x: x + Math.cos(a), y: Math.max(0, hAt(G, x, z)) + .6, z: z + Math.sin(a), vx: Math.cos(a) * r * 2.2, vy: .5, vz: Math.sin(a) * r * 2.2, life: .5, s0: 2.4, s1: .6, c0: c, k: 1.5, drag: 3 }); } }
  function shake(G, at, m) { const c = G.cam, d = Math.hypot(at.x - c.x, at.z - c.z); G.shake = Math.max(G.shake, m * clamp(1 - d / 160, .2, 1)); }
  function sfx(G, k, at) {
    const s = G.api.sfx; let v = 1;
    if (at) { const d = Math.hypot(at.x - G.cam.x, at.z - G.cam.z); v = clamp(1 - d / (G.cam.dist * 2.2), 0, 1); if (v <= .05) return; }
    if (k === 'cmd') s.tone(660, .05, 'triangle', .03);
    else if (k === 'sel') s.tone(880, .04, 'sine', .03);
    else if (k === 'ui') s.tone(520, .04, 'square', .02);
    else if (k === 'no') s.tone(180, .15, 'sawtooth', .04);
    else if (k === 'place') s.arp([392, 523], .06, .1, 'triangle', .04);
    else if (k === 'built') s.arp([523, 659, 784], .08, .14, 'triangle', .05);
    else if (k === 'train') s.arp([440, 660], .07, .12, 'triangle', .04);
    else if (k === 'chop') s.noise(.06, .03 * v, 0, 1600);
    else if (k === 'wood') s.tone(300, .05, 'triangle', .03 * v);
    else if (k === 'hit') s.noise(.05, .025 * v, 0, 900);
    else if (k === 'fire') s.noise(.2, .03 * v, 0, 700, 'lowpass');
    else if (k === 'cast') s.arp([660, 990, 1320], .05, .2, 'sine', .05);
    else if (k === 'thunder') { s.noise(1.2, .14 * v, 0, 400, 'lowpass'); s.tone(70, .8, 'sine', .08 * v, 0, 30); }
    else if (k === 'quake') { s.noise(2.4, .12 * v, 0, 160, 'lowpass'); s.tone(45, 1.6, 'sine', .1 * v, 0, 30); }
    else if (k === 'wind') s.noise(3, .07 * v, 0, 500, 'bandpass');
    else if (k === 'crash') s.noise(.8, .1 * v, 0, 300, 'lowpass');
    else if (k === 'win') s.arp([523, 659, 784, 1047, 1319], .12, .3, 'triangle', .07);
    else if (k === 'lose') s.arp([440, 349, 262], .16, .3, 'triangle', .06);
  }

  /* ════════════════════════════════════════════════════════════════
     menu e registo no kit
  ════════════════════════════════════════════════════════════════ */
  const picker = {
    html() {
      const sv = save(), SKY = { morning: ['#f2c38a', '#3f86c4'], noon: ['#b9d4ee', '#2d7a3a'], afternoon: ['#f1cfa3', '#2f6fb0'], overcast: ['#b5bec6', '#4a5a6c'], sunset: ['#ff9a5a', '#26336c'], night: ['#3bd18a', '#030616'] };
      return `<style>
.sh-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:4px 0}
.sh-c{position:relative;border:0;border-radius:18px;padding:16px 14px 14px;cursor:pointer;color:#fff;font:inherit;text-align:left;min-height:130px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.25);transition:transform .15s}
.sh-c:hover:not([disabled]){transform:translateY(-3px)}.sh-c[disabled]{opacity:.45;cursor:not-allowed}
.sh-c::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 25%,rgba(0,0,0,.55));pointer-events:none}.sh-c>*{position:relative;z-index:1}
.sh-c small{display:block;font:700 .66rem 'Space Grotesk',system-ui;letter-spacing:.12em;text-transform:uppercase;opacity:.85}
.sh-c b{display:block;font:800 1.08rem 'Space Grotesk',system-ui;margin:2px 0 5px;text-shadow:0 2px 8px rgba(0,0,0,.4)}
.sh-c p{margin:0;font-size:.78rem;line-height:1.32;opacity:.94}
.sh-c i{position:absolute;right:12px;top:10px;font-style:normal;letter-spacing:1px;color:#fde047;text-shadow:0 1px 4px rgba(0,0,0,.5)}
.sh-sp{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.sh-sp span{font:700 .62rem 'Space Grotesk',system-ui;background:rgba(0,0,0,.3);border-radius:999px;padding:3px 7px}
</style><div class="sh-grid">${LEVELS.map((l, i) => { const lock = i + 1 > (sv.u || 1), b = sv.best[l.id], c = SKY[l.sky], foes = l.tribes.slice(1).map(t => TRIBES[t.t].short).join(' + ') || 'Sem rivais';
        return `<button class="sh-c" data-lv="${l.id}" ${lock ? 'disabled' : ''} style="background:linear-gradient(150deg,${c[0]},${c[1]})"><small>Ilha ${i + 1} · ${foes}</small><b>${lock ? '🔒 ' : ''}${l.name}</b><p>${l.brief}</p><div class="sh-sp">${l.spells.map(s => `<span>${SP[s].name}</span>`).join('')}</div>${b ? `<i>${'★'.repeat(b.s)}${'☆'.repeat(3 - b.s)}</i>` : ''}</button>`; }).join('')}</div>`;
    },
    wire(el, start) { el.querySelectorAll('[data-lv]').forEach(b => b.addEventListener('click', () => start(b.dataset.lv))); },
  };
  let curLv = 'L1';
  const spec = {
    id: ID, title: 'Terra dos Xamãs', icon: '🌋', accent: '#7df9ff', accent2: '#ffb36b', bg: '#16233a', aspect: 'wide', transparent: true, diff: false,
    tagline: 'Guia a tua tribo com a magia de uma xamã: constrói, converte e molda a terra com pontes, terramotos, tornados e vulcões.',
    view: { w: 960 }, picker, cursor: 'default',
    get ready() { const L = LEVELS.find(l => l.id === curLv) || LEVELS[0]; return { title: `Ilha ${LEVELS.indexOf(L) + 1} · ${L.name}`, hint: L.brief + ' Toca ou carrega em Espaço para começar.' }; },
    how: [
      '<b>Clique esquerdo</b> seleciona (arrasta para uma caixa), <b>clique direito</b> dá ordens: andar, atacar, construir, cortar madeira ou treinar num Quartel/Templo.',
      'Os <b>aldeões</b> cortam madeira e erguem as obras; cada <b>cabana</b> faz nascer mais gente, e mais gente dá mais <b>mana</b>. Botões à esquerda: selecionar, construir e treinar.',
      'A <b>xamã</b> (Espaço) lança os feitiços (teclas <b>1–8</b>): sopro, raio, converter, enxame, ponte de terra, terramoto, tornado e vulcão. <b>WASD</b> move a câmara, <b>Q/E</b> roda, roda do rato aproxima.',
    ],
    controls: ['🖱️ esquerdo seleciona · direito ordena', '⌨️ WASD Q E · 1–8 · Espaço', '👆 toque: tocar, arrastar, pinça'],
    setup: (api, o) => { curLv = o.mode || 'L1'; const G = setup(api, o); wireWheel(G, api); return G; },
    update, draw, down, move, up, key, keyup,
    begin: G => { if (matchMedia('(pointer: coarse)').matches) G.touch = true; },
    destroy: G => { if (G._wheel) G._wheel(); if (G.r3) { G.r3.renderer.toneMappingExposure = 1.08; Arcade3D.disposeOwn(G.r3.scene); G.r3.env && G.r3.env.dispose(); Arcade3D.detach(); G.r3 = null; } },
    hud: G => [['Ilha', (G.li + 1) + '/' + LEVELS.length], ['Mana', Math.floor(G.player.mana)], ['Tempo', Math.floor(G.time / 60) + ':' + String(Math.floor(G.time % 60)).padStart(2, '0')]],
    pauseButtons: (G, api) => [{ label: 'Ecrã inteiro', fn: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else api.stage.requestFullscreen && api.stage.requestFullscreen().catch(() => {}); } catch (e) {} api.resume(); } }, { label: 'Mapa das ilhas', fn: () => api.menu() }],
    achievements: [
      { id: 'shaman.1', name: 'Primeira Aldeia', icon: '🛖', desc: 'Conclui a primeira ilha da Terra dos Xamãs.', test: c => ((c.result.meta || {}).level || 0) >= 1 },
      { id: 'shaman.all', name: 'Senhora das Ilhas', icon: '🌋', desc: 'Conclui as 6 ilhas da Terra dos Xamãs.', test: c => !!(c.result.meta || {}).all },
      { id: 'shaman.3', name: 'Ventania Rápida', icon: '🌪️', desc: 'Vence uma ilha com 3 estrelas.', test: c => (c.result.meta || {}).stars === 3 },
    ],
  };
  /* roda do rato (o kit não a passa) */
  function wireWheel(G, api) {
    const st = api.stage; if (!st) return;
    const fn = e => { if (!G.ok) return; e.preventDefault(); wheel(G, e); };
    st.addEventListener('wheel', fn, { passive: false });
    G._wheel = () => st.removeEventListener('wheel', fn);
    st.addEventListener('pointerleave', () => { G.ptr.in = false; });
  }
  const KIT = ArcadeKit.create(spec);
  KIT._dbg = { LEVELS, SP, castNow, cast, addUnit, addBuild, command, findPath, hAt };
  return KIT;
})();
