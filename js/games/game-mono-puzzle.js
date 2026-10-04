/* ══════════════════════════════════════════════════════════════════
   Torres Impossíveis — puzzle 3D de perspetiva isométrica. Guia a viajante Lia até à porta de luz de cada nível.

   O truque: a câmara é ortográfica e isométrica (olha na direção
   (−1,−1,−1)). Dois sítios que diferem de k·(1,1,1) caem no MESMO ponto
   do ecrã — por isso, se o topo de um bloco PARECE encostado ao topo de
   outro, a Lia pode passar de um para o outro, mesmo que no "mundo real"
   estejam longe. Só conta se a aresta entre os dois estiver à vista
   (nada à frente a tapar). Rodar estruturas (manivelas), deslizar
   blocos (puxadores) e pisar botões muda o que se alinha.

   Grafo de caminho: nós = células vazias com um bloco por baixo (ou
   escadas); arestas = vizinhos reais + vizinhos "de ilusão" visíveis.
   Toca num sítio para a Lia lá ir (BFS). Os níveis estão no fim do
   ficheiro e cada um foi verificado por um "solucionador" (procura em
   largura sobre os estados das manivelas/puxadores).
══════════════════════════════════════════════════════════════════ */
const MonoPuzzleGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2;
  const K = (x, y, z) => x + ',' + y + ',' + z;
  const HD = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

  /* ════════════════════════════════════════════════════════════════
     modelo (sem three.js — usado também pelo solucionador)
  ════════════════════════════════════════════════════════════════ */
  /* rodar um ponto inteiro (centro de célula) em quartos de volta à volta de um pivô (centro de célula) */
  function rotP(p, pv, axis, q) {
    let [x, y, z] = [p[0] - pv[0], p[1] - pv[1], p[2] - pv[2]];
    for (let i = 0; i < ((q % 4) + 4) % 4; i++) {
      if (axis === 'y') [x, z] = [z, -x];
      else if (axis === 'x') [y, z] = [-z, y];
      else [x, y] = [-y, x];
    }
    return [x + pv[0], y + pv[1], z + pv[2]];
  }

  function model(L) {
    /* blocos estáticos + grupos (rodam) + deslizantes; cada parte tem estado */
    const parts = [{ id: '_', kind: 'static', blocks: L.blocks, state: 0 }];
    (L.groups || []).forEach(g => parts.push(Object.assign({ kind: 'rot', state: g.state || 0 }, g)));
    (L.sliders || []).forEach(s => parts.push(Object.assign({ kind: 'slide', state: s.pos || 0 }, s)));
    (L.lifts || []).forEach(s => parts.push(Object.assign({ kind: 'lift', state: 0 }, s)));
    return { L, parts };
  }
  function partBlocks(part, state) {
    const st = state == null ? part.state : state;
    if (part.kind === 'rot') return part.blocks.map(b => [...rotP(b, part.pivot, part.axis, st), b[3], b[4]]);
    if (part.kind === 'slide' || part.kind === 'lift') { const d = part.dir || [0, 1, 0]; return part.blocks.map(b => [b[0] + d[0] * st, b[1] + d[1] * st, b[2] + d[2] * st, b[3], b[4]]); }
    return part.blocks;
  }
  function partStairs(part, state) {
    if (!part.stairs) return [];
    const st = state == null ? part.state : state;
    if (part.kind === 'rot') return part.stairs.map(s => { const p = rotP(s.at, part.pivot, part.axis, st), d = rotP([s.dir[0], s.dir[1], s.dir[2]], [0, 0, 0], part.axis, st); return Object.assign({}, s, { at: p, dir: d }); });
    if (part.kind === 'slide' || part.kind === 'lift') { const d = part.dir || [0, 1, 0]; return part.stairs.map(s => Object.assign({}, s, { at: [s.at[0] + d[0] * st, s.at[1] + d[1] * st, s.at[2] + d[2] * st] })); }
    return part.stairs;
  }

  /* grafo para um conjunto de estados */
  function graph(Mo, states) {
    const solid = new Map(), stairs = new Map();
    Mo.parts.forEach((pt, i) => {
      const st = states ? states[i] : pt.state;
      partBlocks(pt, st).forEach(b => solid.set(K(b[0], b[1], b[2]), { part: i, b }));
      partStairs(pt, st).forEach(s => stairs.set(K(...s.at), Object.assign({ part: i }, s)));
      (Mo.L.stairs && i === 0 ? Mo.L.stairs : []).forEach(s => stairs.set(K(...s.at), Object.assign({ part: 0 }, s)));
    });
    const isSolid = (x, y, z) => solid.has(K(x, y, z));
    const occupied = (x, y, z) => solid.has(K(x, y, z)) || stairs.has(K(x, y, z));
    const walk = (x, y, z) => !occupied(x, y, z) && isSolid(x, y - 1, z) && !(Mo.L.noWalk || []).some(n => n[0] === x && n[1] === y && n[2] === z);
    const nodes = new Map();
    /* blocos com decoração por cima (cúpula, árvore, bandeira) não se pisam */
    const DECO_TOP = { dome: 1, tree: 1, flag: 1 };
    solid.forEach((v, k) => { if (DECO_TOP[v.b[4]]) return; const [x, y, z] = k.split(',').map(Number); if (walk(x, y + 1, z)) nodes.set(K(x, y + 1, z), { x, y: y + 1, z, part: v.part }); });
    stairs.forEach((s, k) => { const [x, y, z] = s.at; nodes.set(k, { x, y, z, stair: s, part: s.part }); });
    const edges = new Map(); nodes.forEach((_, k) => edges.set(k, new Set()));
    const link = (a, b, ill) => { if (!edges.has(a) || !edges.has(b)) return; edges.get(a).add(b + (ill ? '|i' : '')); edges.get(b).add(a + (ill ? '|i' : '')); };
    /* visibilidade de um ponto (na direção da câmara, (1,1,1)) ignorando certas células */
    const visible = (px, py, pz, t0, skip) => {
      for (let t = t0 + .013; t < 26; t += .021) {
        const cx = Math.floor(px + t), cy = Math.floor(py + t), cz = Math.floor(pz + t), k = K(cx, cy, cz);
        if (skip.has(k)) continue;
        if (occupied(cx, cy, cz)) return false;
      }
      return true;
    };
    nodes.forEach((n, ka) => {
      if (n.stair) {
        const s = n.stair, lo = [n.x - s.dir[0], n.y, n.z - s.dir[2]], hi = [n.x + s.dir[0], n.y + 1, n.z + s.dir[2]];
        if (nodes.has(K(...lo)) && !nodes.get(K(...lo)).stair) link(ka, K(...lo));
        if (nodes.has(K(...hi)) && !nodes.get(K(...hi)).stair) link(ka, K(...hi));
        return;
      }
      HD.forEach(d => {
        /* vizinho real */
        const kb = K(n.x + d[0], n.y, n.z + d[2]);
        if (nodes.has(kb) && !nodes.get(kb).stair) link(ka, kb);
        /* vizinhos de ilusão: B = A + d + k(1,1,1), k ≠ 0, com a aresta à vista */
        for (let k = -8; k <= 8; k++) {
          if (!k) continue;
          const bx = n.x + d[0] + k, by = n.y + k, bz = n.z + d[2] + k, kb2 = K(bx, by, bz);
          const B = nodes.get(kb2); if (!B || B.stair) continue;
          /* a aresta do topo de A no lado d: 3 pontos ao longo dela, todos à vista
             desde o mais escondido dos dois (t = min(0, k)) até à câmara */
          const skip = new Set([K(n.x, n.y - 1, n.z), K(bx, by - 1, bz)]);
          const ok = [.2, .5, .8].every(sv => {
            const ex = d[0] ? n.x + (d[0] > 0 ? 1 : 0) : n.x + sv, ez = d[2] ? n.z + (d[2] > 0 ? 1 : 0) : n.z + sv;
            return visible(ex, n.y, ez, Math.min(0, k), skip);
          });
          if (ok) link(ka, kb2, true);
        }
      });
    });
    return { nodes, edges, solid, stairs, isSolid };
  }

  function bfs(Gr, from, to) {
    if (!Gr.nodes.has(from) || !Gr.nodes.has(to)) return null;
    const prev = new Map([[from, null]]), q = [from];
    while (q.length) {
      const a = q.shift(); if (a === to) break;
      Gr.edges.get(a).forEach(e => { const b = e.split('|')[0]; if (!prev.has(b)) { prev.set(b, a); q.push(b); } });
    }
    if (!prev.has(to)) return null;
    const path = []; let c = to; while (c) { path.unshift(c); c = prev.get(c); }
    return path;
  }

  /* ── solucionador: BFS sobre (estados das peças × nó da Lia) ── */
  function solve(L) {
    const Mo = model(L), n = Mo.parts.length;
    const maxSt = Mo.parts.map(p => p.kind === 'rot' ? (p.range ? p.range[1] - p.range[0] + 1 : (p.steps || 4)) : p.kind === 'slide' ? (p.max - (p.min || 0) + 1) : p.kind === 'lift' ? 2 : 1);
    const minSt = Mo.parts.map(p => p.kind === 'slide' ? (p.min || 0) : p.kind === 'rot' && p.range ? p.range[0] : 0);
    const start = K(...L.start), goal = K(...L.goal);
    const key = (st, node) => st.join('.') + '@' + node;
    const init = Mo.parts.map(p => p.state);
    const seen = new Set([key(init, start)]), q = [[init, start, 0]];
    const cache = new Map();
    const gr = st => { const k = st.join('.'); if (!cache.has(k)) cache.set(k, graph(Mo, st)); return cache.get(k); };
    while (q.length) {
      const [st, node, d] = q.shift();
      const Gr = gr(st);
      /* nós alcançáveis a andar */
      const reach = new Set([node]), qq = [node];
      while (qq.length) { const a = qq.shift(); (Gr.edges.get(a) || []).forEach(e => { const b = e.split('|')[0]; if (!reach.has(b)) { reach.add(b); qq.push(b); } }); }
      if (reach.has(goal)) return { ok: true, moves: d, states: cache.size };
      reach.forEach(nd => {
        /* botões (pisar) */
        (L.plates || []).forEach(pl => {
          if (K(...pl.node) !== nd) return;
          const ns = st.slice(); const pi = Mo.parts.findIndex(p => p.id === pl.act.id); if (pi < 0) return;
          ns[pi] = pl.act.to; const kk = key(ns, nd); if (!seen.has(kk)) { seen.add(kk); q.push([ns, nd, d + 1]); }
        });
        /* manivelas/puxadores (não se mexe a peça em que a Lia está, exceto rotação em y) */
        for (let i = 1; i < n; i++) {
          const p = Mo.parts[i]; if (p.kind === 'lift' || !p.handle) continue;   /* sem manivela/puxador só se mexe por botões */
          const on = Gr.nodes.get(nd) && Gr.nodes.get(nd).part === i;
          if (on && !((p.kind === 'rot' && p.axis === 'y') || p.kind === 'slide')) continue;
          for (let s = minSt[i]; s < minSt[i] + maxSt[i]; s++) {
            if (s === st[i]) continue;
            const ns = st.slice(); ns[i] = s;
            let nn = nd;
            if (on && p.kind === 'rot') { const [x, y, z] = nd.split(',').map(Number); const r = rotP([x, y - 1, z], p.pivot, 'y', s - st[i]); nn = K(r[0], r[1] + 1, r[2]); }
            if (on && p.kind === 'slide') { const [x, y, z] = nd.split(',').map(Number), dd = s - st[i]; nn = K(x + p.dir[0] * dd, y + p.dir[1] * dd, z + p.dir[2] * dd); }
            const kk = key(ns, nn); if (!seen.has(kk)) { seen.add(kk); q.push([ns, nn, d + 1]); }
          }
        }
      });
    }
    return { ok: false, states: cache.size };
  }

  /* ════════════════════════════════════════════════════════════════
     jogo
  ════════════════════════════════════════════════════════════════ */
  const SAVE = 'mono:save';
  const save = () => { try { return JSON.parse(localStorage.getItem(SAVE)) || { u: 1, s: {} }; } catch (e) { return { u: 1, s: {} }; } };
  const putSave = v => { try { localStorage.setItem(SAVE, JSON.stringify(v)); } catch (e) {} };

  function setup(api, o) {
    const li = Math.max(0, LEVELS.findIndex(l => l.id === o.mode));
    const L = LEVELS[li];
    const Mo = model(L);
    const G = { li, L, Mo, Gr: graph(Mo), node: K(...L.start), path: [], mv: null, t: 0, moves: 0, turns: 0, anim: null, won: false, winT: 0, hint: L.hint, hintT: 0, sel: null, drag: null, pressed: new Set(), hover: null };
    G.pos = nodePos(G, G.node);
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build3D(G, api); } catch (e) { console.warn('[torres] 3D falhou', e); G.fail = true; } }).catch(() => { G.fail = true; });
    return G;
  }

  function nodePos(G, k) {
    const n = G.Gr.nodes.get(k); if (!n) { const [x, y, z] = k.split(',').map(Number); return new Float32Array([x + .5, y, z + .5]); }
    return n.stair ? new Float32Array([n.x + .5, n.y + .5, n.z + .5]) : new Float32Array([n.x + .5, n.y, n.z + .5]);
  }

  /* ── three.js ── */
  const _mats = new Map();
  function faceMats(col) {
    if (_mats.has(col)) return _mats.get(col);
    const c = new THREE.Color(col), mk = k => new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(k), toneMapped: false });
    const top = mk(1.0), right = mk(.74), front = mk(.55), dark = mk(.4);
    /* ordem das faces do BoxGeometry: +x, −x, +y, −y, +z, −z */
    const arr = [right, dark, top, dark, front, dark];
    arr.forEach(m => { m.userData.shared = true; });
    _mats.set(col, arr); return arr;
  }
  let _box = null;
  const box = () => _box || (_box = (() => { const g = new THREE.BoxGeometry(1, 1, 1); g.userData.shared = true; return g; })());

  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    renderer.shadowMap.enabled = false;
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-5, 5, 5, -5, -100, 200);
    const R3 = { renderer, scene, cam, partObj: [], handles: [], deco: [], clouds: [] };
    G.r3 = R3;
    const L = G.L, pal = L.pal;
    /* centro do nível (para enquadrar) */
    const all = [];
    G.Mo.parts.forEach((p, i) => { [0, 1, 2, 3].forEach(s => { if (p.kind === 'static' && s) return; partBlocks(p, p.kind === 'slide' ? Math.min(p.max, (p.min || 0) + s) : s).forEach(b => all.push(b)); }); });
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    all.forEach(b => { for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], b[i]); mx[i] = Math.max(mx[i], b[i] + 1); } });
    R3.center = new THREE.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
    /* extensão no ecrã (X = x−z, Y = y − (x+z)/2) */
    let sx0 = 1e9, sx1 = -1e9, sy0 = 1e9, sy1 = -1e9;
    all.forEach(b => { for (const [dx, dy, dz] of [[0, 0, 0], [1, 1, 1], [1, 0, 0], [0, 1, 1], [0, 0, 1], [1, 1, 0], [0, 1, 0], [1, 0, 1]]) { const x = b[0] + dx, y = b[1] + dy, z = b[2] + dz, X = (x - z) * .7071, Y = (y - (x + z) / 2) * .8165; sx0 = Math.min(sx0, X); sx1 = Math.max(sx1, X); sy0 = Math.min(sy0, Y); sy1 = Math.max(sy1, Y); } });
    R3.ext = { w: sx1 - sx0, h: sy1 - sy0, cx: (sx0 + sx1) / 2, cy: (sy0 + sy1) / 2 };
    /* peças */
    G.Mo.parts.forEach((p, i) => {
      const grp = new THREE.Group();
      const pivot = new THREE.Group();
      if (p.kind === 'rot') { pivot.position.set(p.pivot[0] + .5, p.pivot[1] + .5, p.pivot[2] + .5); }
      scene.add(pivot); pivot.add(grp);
      if (p.kind === 'rot') grp.position.set(-(p.pivot[0] + .5), -(p.pivot[1] + .5), -(p.pivot[2] + .5));
      p.blocks.forEach(b => {
        const m = new THREE.Mesh(box(), faceMats(b[3] || pal.a));
        m.position.set(b[0] + .5, b[1] + .5, b[2] + .5);
        m.userData = { part: i, b };
        grp.add(m);
        /* decoração encostada à porta de saída sobrepunha-se a ela: cúpula vira janela */
        if (b[4]) { const gl = G.L.goal, nearGoal = Math.abs(b[0] - gl[0]) <= 1 && Math.abs(b[2] - gl[2]) <= 1 && b[1] >= gl[1] - 1 && b[1] <= gl[1] + 1; deco(G, grp, b, nearGoal && b[4] === 'dome' ? 'win' : b[4]); }
      });
      (p.stairs || []).forEach(s => grp.add(stairMesh(s, pal)));
      if (i === 0) (L.stairs || []).forEach(s => grp.add(stairMesh(s, pal)));
      R3.partObj[i] = { pivot, grp };
      if (p.kind !== 'static') applyPart(G, i, p.state, 1);
      if (p.handle) R3.handles.push(handleMesh(G, scene, i, p));
    });
    /* botões */
    (L.plates || []).forEach(pl => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.28, .32, .06, 24), new THREE.MeshBasicMaterial({ color: pal.plate || '#f9a8d4', toneMapped: false }));
      m.position.set(pl.node[0] + .5, pl.node[1] + .03, pl.node[2] + .5); scene.add(m); pl.mesh = m;
    });
    /* porta de luz (meta) */
    const gl = L.goal, door = new THREE.Group();
    const arch = new THREE.Mesh(new THREE.TorusGeometry(.32, .06, 10, 24, Math.PI), new THREE.MeshBasicMaterial({ color: pal.goal || '#fde68a', toneMapped: false }));
    arch.position.y = .55; door.add(arch);
    [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.BoxGeometry(.1, .55, .1), arch.material); c.position.set(s * .32, .27, 0); door.add(c); });
    /* interior da porta: véu de luz em arco (lê-se como passagem, não como uma bola) + degrau de pedra */
    const veil = new THREE.Shape(); veil.moveTo(-.27, 0); veil.lineTo(-.27, .55); veil.absarc(0, .55, .27, Math.PI, 0, true); veil.lineTo(.27, 0); veil.lineTo(-.27, 0);
    const vt = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.6, 'rgba(255,243,196,.75)'); g.addColorStop(1, 'rgba(255,214,120,.35)'); x.fillStyle = g; x.fillRect(0, 0, 8, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const vgeo = new THREE.ShapeGeometry(veil); vgeo.computeBoundingBox(); { const uv = vgeo.attributes.uv, pp = vgeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, .5, 1 - pp.getY(i) / .82); }
    [0, Math.PI].forEach(ry => { const vm = new THREE.Mesh(vgeo, new THREE.MeshBasicMaterial({ map: vt, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); vm.rotation.y = ry; door.add(vm); });
    const step = new THREE.Mesh(new THREE.BoxGeometry(.8, .06, .32), faceMats(pal.goal || '#fde68a')[2]); step.position.y = .03; door.add(step);
    const glow = new THREE.Sprite(Arcade3D.glowSprite('#fff3c4')); glow.scale.set(1.3, 1.3, 1); glow.position.y = .45; door.add(glow); R3.glow = glow;
    door.position.set(gl[0] + .5, gl[1], gl[2] + .5); door.rotation.y = Math.PI / 4; door.scale.setScalar(1.35);
    scene.add(door); R3.door = door;
    /* a Lia */
    R3.lia = liaMesh(pal); R3.lia.scale.setScalar(1.25);
    scene.add(R3.lia);
    /* nuvens decorativas */
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Sprite(Arcade3D.glowSprite('#ffffff')); c.material = c.material.clone(); c.material.opacity = .35; c.material.blending = THREE.NormalBlending;
      const s = 3 + Math.random() * 4; c.scale.set(s * 1.8, s * .7, 1);
      c.position.set(R3.center.x + (Math.random() - .5) * 18, R3.center.y - 4 - Math.random() * 6, R3.center.z + (Math.random() - .5) * 18);
      c.userData.v = .1 + Math.random() * .2; scene.add(c); R3.clouds.push(c);
    }
    api.stage.style.background = `linear-gradient(180deg, ${L.sky[0]} 0%, ${L.sky[1]} 100%)`;
    G.ready3 = true;
  }

  function stairMesh(s, pal) {
    /* escada: 4 degraus a subir na direção s.dir, dentro da célula s.at */
    const g = new THREE.Group(), mats = faceMats(s.c || pal.b || pal.a);
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(box(), mats); st.scale.set(1, (i + 1) / 4, .25); st.position.set(0, -.5 + (i + 1) / 8, -.375 + i * .25); g.add(st); }
    g.position.set(s.at[0] + .5, s.at[1] + .5, s.at[2] + .5);
    g.rotation.y = Math.atan2(s.dir[0], s.dir[2]);
    return g;
  }

  function deco(G, grp, b, kind) {
    const pal = G.L.pal, x = b[0] + .5, y = b[1] + .5, z = b[2] + .5;
    const dk = new THREE.MeshBasicMaterial({ color: new THREE.Color(b[3] || pal.a).multiplyScalar(.35), toneMapped: false });
    if (kind === 'win' || kind === 'winz') {
      /* janela em arco numa face visível */
      const sh = new THREE.Shape(); sh.moveTo(-.14, -.22); sh.lineTo(.14, -.22); sh.lineTo(.14, .06); sh.absarc(0, .06, .14, 0, Math.PI, false); sh.lineTo(-.14, -.22);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 10), dk);
      if (kind === 'win') { m.position.set(x + .501, y, z); m.rotation.y = Math.PI / 2; } else { m.position.set(x, y, z + .501); }
      grp.add(m);
    } else if (kind === 'dome') {
      const m = new THREE.Mesh(new THREE.SphereGeometry(.42, 24, 12, 0, TAU, 0, Math.PI / 2), faceMats(pal.d || '#f9a8d4')[2]);
      m.position.set(x, y + .5, z); grp.add(m);
      const sp = new THREE.Mesh(new THREE.ConeGeometry(.06, .4, 8), faceMats(pal.goal || '#fde68a')[2]); sp.position.set(x, y + 1.05, z); grp.add(sp);
    } else if (kind === 'tree') {
      const t = new THREE.Mesh(new THREE.ConeGeometry(.3, .8, 6), faceMats(pal.tree || '#86efac')[2]); t.position.set(x, y + .9, z); grp.add(t);
      const t2 = new THREE.Mesh(new THREE.ConeGeometry(.22, .55, 6), faceMats(pal.tree || '#86efac')[0]); t2.position.set(x, y + 1.25, z); grp.add(t2);
    } else if (kind === 'flag') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .9, 6), dk); pole.position.set(x, y + .95, z); grp.add(pole);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(.35, .2), new THREE.MeshBasicMaterial({ color: pal.goal || '#fde68a', side: THREE.DoubleSide, toneMapped: false })); f.position.set(x + .18, y + 1.3, z); f.rotation.y = Math.PI / 4; f.userData.flag = true; grp.add(f);
    } else if (kind === 'pillar') {
      [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1, 10), faceMats(pal.c || '#fff')[2]); c.position.set(x + s * .3, y, z + .3); grp.add(c); });
    }
  }

  function handleMesh(G, scene, i, p) {
    /* manivela: roda com raios + punho; puxador: esfera com setas */
    const pal = G.L.pal, h = new THREE.Group();
    const col = pal.handle || '#f472b6';
    if (p.kind === 'rot') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .07, 10, 28), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
      h.add(ring);
      for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.06, .8, .06), ring.material); sp.rotation.z = k * Math.PI / 4; h.add(sp); }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(.11, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff7ed', toneMapped: false })); knob.position.set(.42, 0, .1); h.add(knob);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .2, 16), new THREE.MeshBasicMaterial({ color: '#fff7ed', toneMapped: false })); hub.rotation.x = Math.PI / 2; h.add(hub);
      /* orientação: a roda fica perpendicular ao eixo de rotação */
      if (p.axis === 'y') h.rotation.x = -Math.PI / 2; else if (p.axis === 'x') h.rotation.y = Math.PI / 2;
    } else {
      const m = new THREE.Mesh(new THREE.SphereGeometry(.22, 18, 12), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
      h.add(m);
      const d = p.dir;
      [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.ConeGeometry(.1, .22, 10), new THREE.MeshBasicMaterial({ color: '#fff7ed', toneMapped: false })); c.position.set(d[0] * s * .4, d[1] * s * .4, d[2] * s * .4); c.lookAt(d[0] * s * 2, d[1] * s * 2, d[2] * s * 2); c.rotateX(Math.PI / 2); h.add(c); });
    }
    h.position.set(p.handle[0] + .5, p.handle[1] + .5, p.handle[2] + .5);
    h.traverse(o => { o.userData.handle = i; });
    const halo = new THREE.Sprite(Arcade3D.glowSprite(col)); halo.scale.set(1.6, 1.6, 1); halo.material = halo.material.clone(); halo.material.opacity = .45; h.add(halo); h.userData.halo = halo;
    /* o puxador acompanha a peça (deslizar); a manivela fica fixa */
    if (p.kind === 'slide') G.r3.partObj[i].grp.add(h); else scene.add(h);
    return h;
  }

  /* a Lia: capa turquesa com capuz redondo, cachecol coral e uma lanterna */
  function liaMesh(pal) {
    const g = new THREE.Group();
    const M = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const cloak = M('#14b8a6'), cloakD = M('#0f766e'), scarf = M('#fb7185'), skin = M('#fde2c8');
    /* capa em forma de sino (lathe), com o lado de trás mais escuro */
    const prof = [[0, 0], [.24, 0], [.23, .08], [.19, .25], [.15, .42], [.12, .5], [0, .52]].map(q => new THREE.Vector2(q[0], q[1]));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), cloak); g.add(body);
    const back = new THREE.Mesh(new THREE.LatheGeometry(prof, 24, Math.PI * .6, Math.PI * .8), cloakD); back.scale.setScalar(1.01); body.add(back);
    const sc = new THREE.Mesh(new THREE.TorusGeometry(.12, .045, 8, 20), scarf); sc.rotation.x = Math.PI / 2; sc.position.y = .5; body.add(sc);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(.06, .2, .03), scarf); tail.position.set(.07, .38, -.13); tail.rotation.z = .25; body.add(tail);
    /* capuz redondo com a cara à vista */
    const hood = new THREE.Mesh(new THREE.SphereGeometry(.15, 18, 14), cloak); hood.position.y = .64; body.add(hood);
    const face = new THREE.Mesh(new THREE.SphereGeometry(.105, 16, 12), skin); face.position.set(0, .63, .065); body.add(face);
    const eyes = M('#3b2d5a'); [-1, 1].forEach(k => { const e = new THREE.Mesh(new THREE.SphereGeometry(.014, 6, 4), eyes); e.position.set(k * .035, .645, .165); body.add(e); });
    /* lanterna na mão */
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .18, 6), cloakD); arm.position.set(.17, .36, .06); arm.rotation.z = .5; body.add(arm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), M('#fef3c7')); lamp.position.set(.23, .25, .08); body.add(lamp);
    const glow = new THREE.Sprite(Arcade3D.glowSprite('#fde68a').clone()); glow.scale.set(.45, .45, 1); glow.position.copy(lamp.position); body.add(glow);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.22, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .18, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .01; g.add(shadow);
    g.userData.body = [body];
    return g;
  }

  /* põe a peça i no estado `st` (k=1: já lá; k<1: a meio da animação, a partir de `from`) */
  function applyPart(G, i, st, k, from) {
    const p = G.Mo.parts[i], o = G.r3 && G.r3.partObj[i]; if (!o) return;
    const f = from == null ? st : from, cur = f + (st - f) * k;
    if (p.kind === 'rot') {
      /* quarto de volta no mesmo sentido do rotP (regra da mão direita) */
      o.pivot.rotation.set(0, 0, 0);
      o.pivot.rotation[p.axis] = cur * Math.PI / 2;
    } else { const d = p.dir || [0, 1, 0]; o.grp.position.set(d[0] * cur, d[1] * cur, d[2] * cur); }
  }

  /* ── ciclo ── */
  function update(G, dt, api) {
    G.t += dt;
    if (!G.r3) return;
    /* animação de peças */
    if (G.anim) {
      const a = G.anim; a.t += dt / a.d;
      const k = U.ease(Math.min(1, a.t));
      applyPart(G, a.i, a.to, k, a.from);
      if (a.rider) {
        /* a Lia roda com a plataforma (só rotações em y) */
        const p = G.Mo.parts[a.i], ang = (a.from + (a.to - a.from) * k) * Math.PI / 2, ang0 = a.st0 * Math.PI / 2;
        const pv = new THREE.Vector3(p.pivot[0] + .5, 0, p.pivot[2] + .5), v = new THREE.Vector3(a.rider[0] - pv.x, 0, a.rider[2] - pv.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang - ang0);
        G.pos[0] = pv.x + v.x; G.pos[2] = pv.z + v.z;
      }
      if (a.slideRider) {
        const d = G.Mo.parts[a.i].dir, c = a.from + (a.to - a.from) * k - a.st0;
        G.pos[0] = a.slideRider[0] + d[0] * c; G.pos[1] = a.slideRider[1] + d[1] * c; G.pos[2] = a.slideRider[2] + d[2] * c;
      }
      if (a.t >= 1) {
        G.Mo.parts[a.i].state = a.to; G.anim = null;
        if (a.slideRider) { const d = G.Mo.parts[a.i].dir, dd = a.to - a.st0, [x, y, z] = G.node.split(',').map(Number); G.node = K(x + d[0] * dd, y + d[1] * dd, z + d[2] * dd); }
        const old = G.node;
        G.Gr = graph(G.Mo);
        if (a.rider) { const [x, y, z] = old.split(',').map(Number); const r = rotP([x, y - 1, z], G.Mo.parts[a.i].pivot, 'y', a.to - a.st0); G.node = K(r[0], r[1] + 1, r[2]); }
        G.pos = nodePos(G, G.node);
        api.sfx.tone(330, .2, 'triangle', .06, 0, 392);
        checkGoal(G, api);
      }
    }
    /* caminhar */
    if (!G.mv && G.path.length && !G.anim) {
      const nx = G.path.shift();
      const ill = (G.Gr.edges.get(G.node) || new Set()).has(nx + '|i');
      const a = nodePos(G, G.node), b = nodePos(G, nx);
      G.mv = { from: G.node, to: nx, a, b, t: 0, ill, d: ill ? .42 : .32 };
      G.moves++;
    }
    if (G.mv) {
      const m = G.mv; m.t += dt / m.d;
      const k = Math.min(1, m.t);
      for (let i = 0; i < 3; i++) G.pos[i] = m.a[i] + (m.b[i] - m.a[i]) * k;
      G.face = Math.atan2(m.b[0] - m.a[0], m.b[2] - m.a[2]);
      if (m.t >= 1) {
        G.node = m.to; G.mv = null;
        api.sfx.tone(520 + (G.moves % 5) * 60, .05, 'sine', .03);
        /* botões */
        (G.L.plates || []).forEach(pl => {
          if (K(...pl.node) !== G.node || G.pressed.has(pl)) return;
          G.pressed.add(pl); pl.mesh && (pl.mesh.position.y -= .03);
          const pi = G.Mo.parts.findIndex(p => p.id === pl.act.id);
          if (pi >= 0) { G.path = []; G.anim = { i: pi, from: G.Mo.parts[pi].state, to: pl.act.to, t: 0, d: 1.1 }; api.sfx.arp([392, 523, 659], .08, .2, 'triangle', .06); }
        });
        checkGoal(G, api);
      }
    }
    if (G.won) { G.winT += dt; if (G.winT > 2.4 && !G.sent) { G.sent = true; finish(G, api); } }
    G.hintT += dt;
  }

  function checkGoal(G, api) {
    if (G.won || G.node !== K(...G.L.goal)) return;
    G.won = true; G.winT = 0; G.path = [];
    api.sfx.arp([523, 659, 784, 1047, 1319], .12, .3, 'sine', .07); api.vibe([30, 50, 30]);
  }

  function finish(G, api) {
    const L = G.L, par = L.par || 20;
    const stars = 1 + (G.turns <= (L.parTurns || 99) ? 1 : 0) + (G.moves <= par ? 1 : 0);
    const sv = save(); sv.s[L.id] = Math.max(sv.s[L.id] || 0, stars); sv.u = Math.max(sv.u || 1, G.li + 2); putSave(sv);
    try { if (typeof GameProgress !== 'undefined') GameProgress.record('mono-puzzle', { won: true, score: stars, mode: L.id, meta: { level: G.li + 1, stars } }); } catch (e) {}
    const next = LEVELS[G.li + 1];
    api.panel({
      icon: next ? '🗼' : '✨', title: next ? L.name : 'Chegaste ao topo do mundo!', stars,
      sub: L.outro || '',
      stats: [['Passos', G.moves], ['Mecanismos', G.turns]],
      buttons: [
        ...(next ? [{ label: '▶ Próximo nível', primary: true, fn: () => api.play(next.id) }] : []),
        { label: '↺ Repetir', primary: !next, fn: () => api.play(L.id) },
        { label: 'Níveis', fn: () => api.menu() },
      ],
    });
  }

  /* ── desenho ── */
  function draw(G, ctx, W, H, api) {
    const R3 = G.r3;
    if (!R3) {
      ctx.fillStyle = '#1e1b3a'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = "700 15px 'Space Grotesk', system-ui"; ctx.textAlign = 'center';
      ctx.fillText(G.fail ? 'Este puzzle precisa de WebGL (3D).' : 'A preparar o mundo…', W / 2, H / 2);
      return;
    }
    const aspect = Arcade3D.fit(api.stage, null), cam = R3.cam;
    /* enquadrar: deixa espaço para o HUD em cima e a dica em baixo */
    const padTop = 90 / H, padBot = 70 / H, fh = 1 - padTop - padBot;
    const half = Math.max(R3.ext.h / 2 / fh, R3.ext.w / 2 / aspect / .9) * 1.08;
    cam.left = -half * aspect; cam.right = half * aspect; cam.top = half; cam.bottom = -half;
    cam.updateProjectionMatrix();
    const c = R3.center, d = 30;
    /* alvo da câmara: centro da extensão no ecrã, deslocado para a zona livre */
    const right = new THREE.Vector3(1, 0, -1).normalize(), upS = new THREE.Vector3(-1, 2, -1).normalize();
    const cX = (c.x - c.z) * .7071, cY = (c.y - (c.x + c.z) / 2) * .8165;
    const target = c.clone().addScaledVector(right, R3.ext.cx - cX).addScaledVector(upS, R3.ext.cy - cY + (padTop - padBot) * half);
    cam.position.copy(target).add(new THREE.Vector3(d, d, d)); cam.up.set(0, 1, 0); cam.lookAt(target);
    /* a Lia */
    const lia = R3.lia;
    lia.position.set(G.pos[0], G.pos[1], G.pos[2]);
    const walking = !!G.mv;
    lia.userData.body.forEach(m => { m.position.y = m.position.y; });
    lia.children[0].position.y = (walking ? Math.abs(Math.sin(G.t * 14)) * .04 : Math.sin(G.t * 2) * .01);
    if (G.face != null) lia.rotation.y = G.face;
    /* em arestas de ilusão desenha-se por cima de tudo (como no original) */
    const ill = G.mv && G.mv.ill;
    lia.traverse(o => { if (o.material) { o.material.depthTest = !ill; o.renderOrder = ill ? 10 : 0; } });
    if (G.won) { lia.position.y += Math.min(.6, G.winT * .4); lia.rotation.y += G.winT * 4; }
    R3.glow.material.opacity = .6 + Math.sin(G.t * 3) * .25;
    R3.glow.scale.setScalar(1.2 + Math.sin(G.t * 2) * .12 + (G.won ? G.winT : 0));
    R3.clouds.forEach(cl => { cl.position.x += cl.userData.v * .016; if (cl.position.x > c.x + 14) cl.position.x = c.x - 14; });
    R3.handles.forEach(h => { const i = h.children[0].userData.handle; const busy = G.anim && G.anim.i === i; h.userData.halo.material.opacity = (G.drag && G.drag.i === i) || busy ? .8 : .35 + Math.sin(G.t * 2.5 + i) * .15; });
    R3.renderer.render(R3.scene, cam);
    /* sobreposições 2D */
    ctx.save();
    if (G.dest && !G.mv && !G.path.length) G.dest = null;
    if (G.tapFx) { const f = G.tapFx; f.t += .016; ctx.globalAlpha = Math.max(0, 1 - f.t * 2.5); ctx.strokeStyle = f.ok ? '#fff' : '#fda4af'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, 8 + f.t * 40, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; if (f.t > .5) G.tapFx = null; }
    const hint = G.hint && !G.won && G.hintT < 14 ? G.hint : null;
    ctx.textAlign = 'center'; ctx.font = "600 14px 'Space Grotesk', system-ui";
    if (hint) { ctx.globalAlpha = Math.min(1, G.hintT * 2, (14 - G.hintT) / 1.5); ctx.fillStyle = 'rgba(30,20,50,.55)'; const tw = Math.min(W - 30, ctx.measureText(hint).width + 30); U.rr(ctx, (W - tw) / 2, H - 52, tw, 32, 16); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(hint, W / 2, H - 31, W - 44); ctx.globalAlpha = 1; }
    ctx.font = "700 italic 17px 'Space Grotesk', Georgia, serif"; ctx.fillStyle = 'rgba(40,30,70,.55)';
    ctx.fillText(G.L.name, W / 2, 92);
    ctx.restore();
  }

  /* ── toque / rato ── */
  const _ray = { r: null, v: null };
  function pick(G, api, x, y) {
    const R3 = G.r3; if (!R3) return null;
    _ray.r = _ray.r || new THREE.Raycaster(); _ray.v = _ray.v || new THREE.Vector2();
    _ray.v.set(x / api.W * 2 - 1, -(y / api.H * 2 - 1));
    _ray.r.setFromCamera(_ray.v, R3.cam);
    const hs = _ray.r.intersectObjects(R3.handles, true);
    if (hs.length) { let o = hs[0].object; while (o && o.userData.handle == null) o = o.parent; if (o) return { handle: o.userData.handle }; }
    const meshes = []; R3.partObj.forEach(o => o.grp.traverse(m => { if (m.isMesh && m.userData.b) meshes.push(m); }));
    /* (o centro exato de uma face cai na diagonal entre os 2 triângulos: tenta também ao lado) */
    for (const [ox, oy] of [[0, 0], [.6, .3], [-.6, -.3], [.3, -.6]]) {
      _ray.v.set((x + ox) / api.W * 2 - 1, -((y + oy) / api.H * 2 - 1));
      _ray.r.setFromCamera(_ray.v, R3.cam);
      const h = _ray.r.intersectObjects(meshes, false).find(h => h.face);
      if (!h) continue;
      const nrm = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      /* o bloco real (a peça pode estar rodada/deslocada) */
      const wp = new THREE.Vector3(); h.object.getWorldPosition(wp);
      const bx = Math.round(wp.x - .5), by = Math.round(wp.y - .5), bz = Math.round(wp.z - .5);
      if (nrm.y > .7) return { node: K(bx, by + 1, bz) };
      break;
    }
    /* face lateral ou vazio: o nó do caminho mais perto no ecrã (escadas incluídas) */
    let best = null, bd = 1e9;
    G.Gr.nodes.forEach((n, k) => { const pp = nodePos(G, k), [sx, sy] = screenOf(G, api, pp[0], pp[1], pp[2]); const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = k; } });
    const tile = Math.abs(screenOf(G, api, 0, 0, 0)[0] - screenOf(G, api, 1, 0, 0)[0]) * 1.6;
    return best && bd < tile ? { node: best } : null;
  }

  function screenOf(G, api, wx, wy, wz) { const v = Arcade3D.toScreen(G.r3.cam, wx, wy, wz, api.W, api.H); return [v.x, v.y]; }

  function down(G, x, y, api) {
    if (!G.r3 || G.won) return;
    const pk = pick(G, api, x, y);
    if (pk && pk.handle != null) {
      const i = pk.handle, p = G.Mo.parts[i];
      if (G.anim) return;
      const hp = p.handle, [hx, hy] = screenOf(G, api, hp[0] + .5, hp[1] + .5, hp[2] + .5);
      G.drag = { i, x0: x, y0: y, hx, hy, a0: Math.atan2(y - hy, x - hx), st0: p.state, cur: p.state, moved: 0, sg: 1 };
      if (p.kind === 'rot') {
        /* sentido no ecrã de "mais um quarto de volta": arrastar no mesmo sentido roda a peça a acompanhar o dedo */
        const ax = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[p.axis], u = p.axis === 'y' ? [1, 0, 0] : [0, 1, 0];
        const pv = [p.pivot[0] + .5, p.pivot[1] + .5, p.pivot[2] + .5];
        const v = new THREE.Vector3(...u), v2 = v.clone().applyAxisAngle(new THREE.Vector3(...ax), .3);
        const [cx0, cy0] = screenOf(G, api, ...pv), [ax1, ay1] = screenOf(G, api, pv[0] + v.x, pv[1] + v.y, pv[2] + v.z), [ax2, ay2] = screenOf(G, api, pv[0] + v2.x, pv[1] + v2.y, pv[2] + v2.z);
        const cr = (ax1 - cx0) * (ay2 - cy0) - (ay1 - cy0) * (ax2 - cx0);
        G.drag.sg = cr >= 0 ? 1 : -1;
        const n = G.Gr.nodes.get(G.node);
        if (n && n.part === i && p.axis === 'y' && !G.mv) G.drag.rider = [G.pos[0], G.pos[1], G.pos[2]];
      }
      if (p.kind === 'slide') { const d = p.dir, [ax, ay] = screenOf(G, api, hp[0] + .5 + d[0], hp[1] + .5 + d[1], hp[2] + .5 + d[2]); G.drag.ax = ax - hx; G.drag.ay = ay - hy; }
      return;
    }
    G.tapStart = { x, y, pk };
  }
  function move(G, x, y, api, e, isDown) {
    const D = G.drag;
    if (!D || !isDown) { if (!isDown && G.r3 && e && e.pointerType === 'mouse') { const pk = pick(G, api, x, y); api.stage.style.cursor = pk && pk.handle != null ? 'grab' : pk && G.Gr.nodes.has(pk.node) ? 'pointer' : 'default'; } return; }
    const p = G.Mo.parts[D.i];
    D.moved = Math.max(D.moved, Math.hypot(x - D.x0, y - D.y0));
    if (p.kind === 'rot') {
      let da = Math.atan2(y - D.hy, x - D.hx) - D.a0; da = U.angDiff(da, 0);
      const q = D.sg * da / (Math.PI / 2);
      /* acompanha o dedo (sem passar dos limites) */
      D.cur = D.st0 + U.clamp(q, -1.4, 1.4);
      if (p.range) D.cur = U.clamp(D.cur, p.range[0] - .15, p.range[1] + .15);
      applyPart(G, D.i, D.cur, 1);
      if (D.rider) { const pv = new THREE.Vector3(p.pivot[0] + .5, 0, p.pivot[2] + .5), v = new THREE.Vector3(D.rider[0] - pv.x, 0, D.rider[2] - pv.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), (D.cur - D.st0) * Math.PI / 2); G.pos[0] = pv.x + v.x; G.pos[2] = pv.z + v.z; }
    } else {
      const L2 = D.ax * D.ax + D.ay * D.ay || 1, t = ((x - D.x0) * D.ax + (y - D.y0) * D.ay) / L2;
      D.cur = U.clamp(D.st0 + t, p.min || 0, p.max);
      applyPart(G, D.i, D.cur, 1);
      const n = G.Gr.nodes.get(G.node);
      if (n && n.part === D.i && !G.mv) { const b0 = nodePos(G, G.node), c = D.cur - D.st0; G.pos[0] = b0[0] + p.dir[0] * c; G.pos[1] = b0[1] + p.dir[1] * c; G.pos[2] = b0[2] + p.dir[2] * c; }
    }
  }
  function up(G, x, y, api) {
    const D = G.drag;
    if (D) {
      G.drag = null;
      const p = G.Mo.parts[D.i];
      let to = Math.round(D.cur);
      if (D.moved < 8) to = p.kind === 'rot' ? (p.range ? (D.st0 + 1 > p.range[1] ? p.range[0] : D.st0 + 1) : D.st0 + 1) : (D.st0 + 1 > p.max ? (p.min || 0) : D.st0 + 1);   /* toque = um passo */
      if (p.kind === 'rot' && p.range) to = U.clamp(to, p.range[0], p.range[1]);
      if (p.kind === 'rot') {
        /* a Lia em cima: só rotação em y, e leva-a */
        const n = G.Gr.nodes.get(G.node), riding = n && n.part === D.i;
        if (riding && p.axis !== 'y') { applyPart(G, D.i, D.st0, 1); api.sfx.tone(160, .12, 'square', .04); G.hint = 'A Lia está em cima desta peça — sai primeiro.'; G.hintT = 0; return; }
        if (G.mv || G.path.length) { G.path = []; }
        const steps = p.steps || 4;
        G.anim = { i: D.i, from: D.cur, to, st0: D.st0, t: 0, d: .45 + Math.abs(to - D.cur) * .25, rider: riding ? (D.rider || [G.pos[0], G.pos[1], G.pos[2]]) : null };
        if (to !== D.st0) G.turns++;
        /* normaliza estados de rotação para 0..steps−1 no fim */
        if (!p.range) G.anim.norm = s => ((s % steps) + steps) % steps;
      } else {
        const n = G.Gr.nodes.get(G.node), riding = n && n.part === D.i && !G.mv;
        if (G.mv || G.path.length) G.path = [];
        G.anim = { i: D.i, from: D.cur, to, st0: D.st0, t: 0, d: .3 + Math.abs(to - D.cur) * .2, slideRider: riding ? [G.pos[0], G.pos[1], G.pos[2]] : null };
        if (to !== D.st0) G.turns++;
      }
      api.sfx.tone(260, .12, 'triangle', .05, 0, 330);
      return;
    }
    const T = G.tapStart; G.tapStart = null;
    if (!T || Math.hypot(x - T.x, y - T.y) > 14 || !T.pk || T.pk.node == null) return;
    if (G.anim) return;
    let target = T.pk.node;
    if (!G.Gr.nodes.has(target)) { G.tapFx = { x, y, t: 0, ok: false }; api.sfx.tone(180, .08, 'sine', .03); return; }
    const from = G.mv ? G.mv.to : G.node;
    const path = bfs(G.Gr, from, target);
    if (!path) { G.tapFx = { x, y, t: 0, ok: false }; api.sfx.tone(180, .08, 'sine', .03); return; }
    path.shift(); G.path = path; G.tapFx = { x, y, t: 0, ok: true };
  }

  /* normalizar estados no fim de uma rotação */
  const _upd = update;
  function update2(G, dt, api) {
    const a = G.anim;
    _upd(G, dt, api);
    if (a && !G.anim && a.norm) { const p = G.Mo.parts[a.i]; p.state = a.norm(p.state); applyPart(G, a.i, p.state, 1); G.Gr = graph(G.Mo); G.pos = nodePos(G, G.node); }
  }

  /* ════════════════════════════════════════════════════════════════
     níveis
  ════════════════════════════════════════════════════════════════ */
  const LEVELS = typeof MONO_LEVELS !== 'undefined' ? MONO_LEVELS : [];

  const picker = {
    html(bestOf) {
      const sv = save();
      return `<style>
.mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:4px 0}
.mp-lv{border:0;border-radius:16px;padding:14px 10px;cursor:pointer;color:#3b2d5a;font:700 .85rem 'Space Grotesk',system-ui;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.18);transition:transform .15s}
.mp-lv:hover:not([disabled]){transform:translateY(-3px)}
.mp-lv[disabled]{opacity:.45;cursor:not-allowed}
.mp-lv b{display:block;font-size:1.25rem;margin-bottom:4px}.mp-lv i{display:block;font-style:normal;color:#b45309;margin-top:4px;letter-spacing:1px}
</style><div class="mp-grid">${LEVELS.map((l, i) => { const lock = i + 1 > (sv.u || 1), st = sv.s[l.id] || 0;
        return `<button class="mp-lv" data-lv="${l.id}" ${lock ? 'disabled' : ''} style="background:linear-gradient(160deg,${l.sky[0]},${l.sky[1]})"><b>${lock ? '🔒' : i + 1}</b>${l.name}<i>${lock ? '' : '★'.repeat(st) + '<span style="opacity:.3">' + '★'.repeat(3 - st) + '</span>'}</i></button>`; }).join('')}</div>`;
    },
    wire(el, start) { el.querySelectorAll('[data-lv]').forEach(b => b.addEventListener('click', () => start(b.dataset.lv))); },
  };

  const KIT = ArcadeKit.create({
    id: 'mono-puzzle', title: 'Torres Impossíveis', icon: '🗼', accent: '#f472b6', accent2: '#a78bfa', bg: '#f5d0e6', transparent: true, diff: false,
    destroy: G => { if (G.r3) { Arcade3D.disposeOwn(G.r3.scene); Arcade3D.detach(); G.r3 = null; } },
    tagline: 'Guia a Lia por torres onde a perspetiva engana. Roda, desliza e confia no que vês.',
    view: { w: 520 }, picker, ready: false,
    how: [
      '<b>Toca</b> num sítio para a Lia caminhar até lá (pelo caminho mais curto).',
      '<b>Arrasta</b> as manivelas cor-de-rosa para rodar as estruturas, ou os puxadores para as deslizar (um toque = um passo).',
      'O segredo: se dois caminhos <b>parecem</b> ligados no ecrã, estão mesmo. Muda a perspetiva das peças até o caminho até à porta de luz se formar.',
    ],
    controls: ['👆 Tocar e arrastar', '🖱️ Clicar e arrastar'],
    setup, update: update2, draw, down, move, up,
    hud: G => [['Nível', G.li + 1 + '/' + LEVELS.length], ['Passos', G.moves], ['Mecanismos', G.turns]],
    pauseButtons: (G, api) => [{ label: 'Escolher nível', fn: () => api.menu() }],
    achievements: [
      { id: 'mono.3', name: 'Arquiteta', icon: '🗼', desc: 'Conclui 3 níveis de Torres Impossíveis.', test: c => ((c.result.meta || {}).level || 0) >= 3 },
      { id: 'mono.all', name: 'Para Lá da Perspetiva', icon: '✨', desc: 'Conclui todos os níveis de Torres Impossíveis.', test: c => ((c.result.meta || {}).level || 0) >= LEVELS.length },
    ],
  });
  KIT._solve = solve; KIT._graph = graph; KIT._model = model; KIT._levels = LEVELS;
  return KIT;
})();
