/* ══════════════════════════════════════════════════════════════════
   O Que Mudou? — uma estante em 3D com objetos (caneca, candeeiro,
   pato, relógio…). Observa; a luz apaga-se por um instante e, quando
   volta, há uma coisa diferente: mudou de cor, desapareceu, apareceu,
   trocou de lugar com outra, rodou ou mudou de tamanho. Toca no sítio.
   Mais à frente há DUAS mudanças por ronda.
   Os objetos são geometria própria (primitivas do three.js), sem
   modelos de fora. Sem WebGL há uma versão 2D com ícones.
══════════════════════════════════════════════════════════════════ */
const WhatChangedGame = (function () {
  'use strict';
  const U = ArcadeKit.U, M = MemoKit;
  const PAL = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#f8fafc'];
  const PALN = ['vermelho', 'azul', 'verde', 'amarelo', 'roxo', 'laranja', 'rosa', 'turquesa', 'branco'];
  const TYPES = ['mug', 'apple', 'plant', 'lamp', 'books', 'clock', 'duck', 'donut', 'gift', 'candle', 'rocket', 'mushroom', 'cactus', 'ball', 'pawn', 'cube'];
  const ASYM = new Set(['mug', 'lamp', 'clock', 'duck', 'cactus', 'books']);
  const EMOJI = { mug: '☕', apple: '🍎', plant: '🪴', lamp: '💡', books: '📚', clock: '⏰', duck: '🦆', donut: '🍩', gift: '🎁', candle: '🕯️', rocket: '🚀', mushroom: '🍄', cactus: '🌵', ball: '⚽', pawn: '♟️', cube: '🧊' };
  const WALLS = ['#3b4a6b', '#5b3b52', '#2f5650', '#5a4a33', '#3e3f66', '#4a3a5e'];
  const LABEL = { color: 'Mudou de cor', gone: 'Desapareceu', add: 'Apareceu', swap: 'Trocaram de lugar', turn: 'Rodou', size: 'Mudou de tamanho' };
  const DIFF = {
    easy:   { look: 5.5, per: .25, two: 12 },
    medium: { look: 4.2, per: .2,  two: 9 },
    hard:   { look: 3.0, per: .15, two: 6 },
  };
  const CW = 1, CH = .95, CD = .8, T = .07;   /* cubículo: largura, altura, profundidade, espessura da madeira */

  /* ── objetos procedimentais ─────────────────────────────────── */
  function own(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .45, metalness: .05 }, o || {})); }
  const S = (c, o) => Arcade3D.std(c, o);
  function mesh(g, m, x, y, z) { const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; }

  function build(type, color) {
    const g = new THREE.Group(), main = [];
    const mm = o => { const m = own(color, o); main.push(m); return m; };
    switch (type) {
      case 'mug': {
        g.add(mesh(new THREE.CylinderGeometry(.17, .15, .34, 28), mm({ roughness: .3 }), 0, .17));
        g.add(mesh(new THREE.CircleGeometry(.15, 24), S('#3b2414', { roughness: .2 }), 0, .335).rotateX(-Math.PI / 2));
        const h = mesh(new THREE.TorusGeometry(.085, .025, 10, 24, Math.PI), main[0], .17, .18); h.rotation.z = -Math.PI / 2; g.add(h);
        break;
      }
      case 'apple': {
        const a = mesh(new THREE.SphereGeometry(.2, 28, 20), mm({ roughness: .35 }), 0, .19); a.scale.set(1, .9, 1); g.add(a);
        g.add(mesh(new THREE.CylinderGeometry(.012, .016, .1, 6), S('#5b3a1a'), 0, .4));
        const lf = mesh(new THREE.SphereGeometry(.06, 10, 8), S('#3f9a3a'), .05, .41); lf.scale.set(1, .25, .5); lf.rotation.z = -.5; g.add(lf);
        break;
      }
      case 'plant': {
        g.add(mesh(new THREE.CylinderGeometry(.16, .12, .22, 24), mm({ roughness: .6 }), 0, .11));
        g.add(mesh(new THREE.CylinderGeometry(.15, .15, .02, 20), S('#3a2a1c', { roughness: 1 }), 0, .215));
        [[0, .36, 0, .13], [.09, .31, .04, .1], [-.09, .32, -.03, .1], [.03, .44, -.05, .09], [-.05, .29, .08, .08]].forEach(([x, y, z, r]) => g.add(mesh(new THREE.IcosahedronGeometry(r, 1), S('#2f8a4a', { roughness: .7, flatShading: true }), x, y, z)));
        break;
      }
      case 'lamp': {
        g.add(mesh(new THREE.CylinderGeometry(.13, .15, .04, 24), mm({ metalness: .4, roughness: .3 }), 0, .02));
        const arm = mesh(new THREE.CylinderGeometry(.015, .015, .42, 8), S('#cbd5e1', { metalness: .7, roughness: .25 }), .06, .22); arm.rotation.z = -.32; g.add(arm);
        const sh = mesh(new THREE.ConeGeometry(.14, .17, 24, 1, true), mm({ side: THREE.DoubleSide, roughness: .35 }), .14, .43); sh.rotation.z = -1.1; g.add(sh);
        const b = mesh(new THREE.SphereGeometry(.04, 12, 10), Arcade3D.glowMat('#fff3c4'), .18, .38); b.castShadow = false; g.add(b);
        break;
      }
      case 'books': {
        g.add(mesh(new THREE.BoxGeometry(.42, .08, .3), mm({ roughness: .6 }), 0, .04));
        const b2 = mesh(new THREE.BoxGeometry(.36, .07, .27), S('#f1e6cf', { roughness: .7 }), .02, .115); b2.rotation.y = .12; g.add(b2);
        const b3 = mesh(new THREE.BoxGeometry(.38, .075, .28), mm({ roughness: .6 }), -.02, .19); b3.rotation.y = -.08; g.add(b3);
        g.add(mesh(new THREE.BoxGeometry(.08, .3, .22), mm({ roughness: .6 }), -.25, .15));
        break;
      }
      case 'clock': {
        const body = mesh(new THREE.CylinderGeometry(.17, .17, .1, 30), mm({ metalness: .3, roughness: .3 }), 0, .23); body.rotation.x = Math.PI / 2; g.add(body);
        const face = mesh(new THREE.CircleGeometry(.14, 30), S('#fbfaf5', { roughness: .4 }), 0, .23, .052); g.add(face);
        const hh = mesh(new THREE.BoxGeometry(.015, .08, .01), S('#111827'), 0, .26, .06); g.add(hh);
        const mh = mesh(new THREE.BoxGeometry(.012, .11, .01), S('#111827'), .04, .24, .062); mh.rotation.z = -1.1; g.add(mh);
        [-1, 1].forEach(s => { g.add(mesh(new THREE.SphereGeometry(.055, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), main[0], s * .1, .38)); g.add(mesh(new THREE.CylinderGeometry(.015, .02, .08, 6), S('#cbd5e1', { metalness: .8, roughness: .2 }), s * .1, .06)); });
        break;
      }
      case 'duck': {
        const b = mesh(new THREE.SphereGeometry(.17, 24, 18), mm({ roughness: .3 }), 0, .15); b.scale.set(1.25, .85, 1); g.add(b);
        g.add(mesh(new THREE.SphereGeometry(.11, 20, 16), main[0], .12, .32));
        const bk = mesh(new THREE.ConeGeometry(.045, .1, 12), S('#f97316', { roughness: .4 }), .25, .3); bk.rotation.z = -Math.PI / 2; g.add(bk);
        [-1, 1].forEach(s => g.add(mesh(new THREE.SphereGeometry(.018, 8, 6), S('#111827'), .19, .35, s * .065)));
        const tail = mesh(new THREE.ConeGeometry(.06, .1, 10), main[0], -.21, .24); tail.rotation.z = .9; g.add(tail);
        break;
      }
      case 'donut': {
        const d = mesh(new THREE.TorusGeometry(.14, .07, 16, 30), S('#d6a46a', { roughness: .7 }), 0, .07); d.rotation.x = -Math.PI / 2; g.add(d);
        const ic = mesh(new THREE.TorusGeometry(.14, .062, 14, 30, Math.PI * 2), mm({ roughness: .25 }), 0, .095); ic.rotation.x = -Math.PI / 2; ic.scale.z = .7; g.add(ic);
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + .2, r = .14 + (i % 3 - 1) * .035; const sp = mesh(new THREE.BoxGeometry(.03, .008, .01), S(['#fef08a', '#93c5fd', '#fff'][i % 3]), Math.cos(a) * r, .145, Math.sin(a) * r); sp.rotation.y = i; g.add(sp); }
        break;
      }
      case 'gift': {
        const box = mesh(Arcade3D.roundBox(.06), mm({ roughness: .35 }), 0, .15); box.scale.set(.38, .3, .38); g.add(box);
        const rib = S('#fde68a', { metalness: .6, roughness: .25 });
        g.add(mesh(new THREE.BoxGeometry(.39, .305, .06), rib, 0, .15));
        g.add(mesh(new THREE.BoxGeometry(.06, .305, .39), rib, 0, .15));
        [-1, 1].forEach(s => { const b = mesh(new THREE.TorusGeometry(.05, .016, 8, 18), rib, s * .045, .33); b.rotation.y = s * .6; g.add(b); });
        break;
      }
      case 'candle': {
        g.add(mesh(new THREE.CylinderGeometry(.08, .085, .34, 24), mm({ roughness: .55 }), 0, .17));
        g.add(mesh(new THREE.CylinderGeometry(.11, .13, .03, 24), S('#cbd5e1', { metalness: .8, roughness: .25 }), 0, .015));
        g.add(mesh(new THREE.CylinderGeometry(.006, .006, .04, 6), S('#1f2937'), 0, .36));
        const fl = new THREE.Sprite(Arcade3D.glowSprite('#ffb347')); fl.scale.set(.16, .24, 1); fl.position.set(0, .43, 0); fl.userData.flame = true; g.add(fl);
        const core = mesh(new THREE.SphereGeometry(.022, 10, 8), Arcade3D.glowMat('#fff7d6'), 0, .4); core.scale.y = 1.8; core.castShadow = false; g.add(core);
        break;
      }
      case 'rocket': {
        g.add(mesh(new THREE.CylinderGeometry(.09, .1, .3, 24), S('#f1f5f9', { metalness: .2, roughness: .3 }), 0, .23));
        g.add(mesh(new THREE.ConeGeometry(.09, .17, 24), mm({ roughness: .3 }), 0, .465));
        for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3, f = mesh(new THREE.BoxGeometry(.02, .14, .1), main[0], Math.cos(a) * .1, .1, Math.sin(a) * .1); f.rotation.y = -a; g.add(f); }
        g.add(mesh(new THREE.CircleGeometry(.035, 16), S('#38bdf8', { metalness: .5, roughness: .1 }), 0, .27, .1));
        break;
      }
      case 'mushroom': {
        g.add(mesh(new THREE.CylinderGeometry(.06, .08, .2, 16), S('#f5ecd7', { roughness: .7 }), 0, .1));
        const cap = mesh(new THREE.SphereGeometry(.19, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2), mm({ roughness: .4 }), 0, .19); cap.scale.y = .8; g.add(cap);
        [[0, .34, 0], [.11, .28, .06], [-.1, .28, .07], [.04, .27, -.12], [-.08, .3, -.08], [.13, .25, -.05]].forEach(p => g.add(mesh(new THREE.SphereGeometry(.025, 8, 6), S('#ffffff'), ...p)));
        break;
      }
      case 'cactus': {
        g.add(mesh(new THREE.CylinderGeometry(.12, .1, .14, 18), S('#c2683c', { roughness: .8 }), 0, .07));
        g.add(mesh(new THREE.CylinderGeometry(.065, .065, .3, 14), mm({ roughness: .55 }), 0, .29));
        g.add(mesh(new THREE.SphereGeometry(.065, 14, 10), main[0], 0, .44));
        const a1 = mesh(new THREE.CylinderGeometry(.035, .035, .1, 10), main[0], .09, .3); a1.rotation.z = Math.PI / 2; g.add(a1);
        g.add(mesh(new THREE.CylinderGeometry(.035, .035, .1, 10), main[0], .13, .35));
        g.add(mesh(new THREE.SphereGeometry(.035, 10, 8), main[0], .13, .4));
        g.add(mesh(new THREE.SphereGeometry(.03, 8, 6), S('#f472b6'), 0, .5));
        break;
      }
      case 'ball': {
        g.add(mesh(new THREE.SphereGeometry(.18, 30, 22), mm({ roughness: .25 }), 0, .18));
        const st = mesh(new THREE.TorusGeometry(.181, .025, 8, 40), S('#ffffff', { roughness: .3 }), 0, .18); st.rotation.y = .5; g.add(st);
        const st2 = mesh(new THREE.TorusGeometry(.181, .025, 8, 40), S('#ffffff', { roughness: .3 }), 0, .18); st2.rotation.x = Math.PI / 2; g.add(st2);
        break;
      }
      case 'pawn': {
        const pts = [[0, 0], [.15, 0], [.15, .03], [.12, .05], [.09, .09], [.06, .2], [.05, .26], [.09, .28], [.05, .3], [.075, .34], [.085, .38], [.07, .43], [.04, .455], [0, .46]].map(p => new THREE.Vector2(p[0], p[1]));
        g.add(mesh(new THREE.LatheGeometry(pts, 32), mm({ roughness: .2, metalness: .1 })));
        break;
      }
      case 'cube': {
        const rb = Arcade3D.roundBox(.12), m = mm({ roughness: .3 }), wh = S('#f8fafc', { roughness: .3 });
        for (let i = 0; i < 8; i++) { const x = (i & 1) - .5, y = ((i >> 1) & 1), z = ((i >> 2) & 1) - .5; const c = mesh(rb, (i % 3) ? m : wh, x * .15, y * .15 + .075, z * .15); c.scale.set(.14, .14, .14); g.add(c); }
        break;
      }
    }
    g.userData.main = main;
    return g;
  }

  /* ── cena: estante + parede ─────────────────────────────────── */
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun, hemi } = Arcade3D.stdScene({ sky: '#fff1dc', ground: '#4a3a2c', hemi: 1.25, sunI: 1.9, normalBias: .02 });
    hemi.position.set(0, 10, 0);
    const cam = new THREE.PerspectiveCamera(26, 1, .1, 100);
    const R3 = { renderer, scene, cam, sun, objs: new Map() };
    const cols = G.cols, rows = G.rows, SW = cols * CW + T, SH = rows * CH + T;
    /* madeira com veios (textura própria em vez de cor lisa) */
    const grain = (base, dark, knots) => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 256, 64); for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(${dark},${.12 + Math.random() * .18})`; x.lineWidth = .6 + Math.random() * 1.6; x.beginPath(); const y0 = Math.random() * 64; for (let X = 0; X <= 256; X += 8) x.lineTo(X, y0 + Math.sin(X * .03 + i) * 2.5); x.stroke(); } for (let k = 0; k < (knots || 0); k++) { const kx = 40 + Math.random() * 180, ky = 14 + Math.random() * 36; x.strokeStyle = `rgba(${dark},.35)`; for (let r = 2; r < 9; r += 2) { x.beginPath(); x.ellipse(kx, ky, r * 2.2, r * .8, 0, 0, 6.3); x.stroke(); } } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    const wood = new THREE.MeshStandardMaterial({ map: grain('#9a6740', '60,30,10', 1), roughness: .62 }), woodD = new THREE.MeshStandardMaterial({ map: grain('#6b4429', '30,15,5'), roughness: .75 });
    wood.map.repeat.set(2, 1); woodD.map.repeat.set(3, 6);
    const wallM = own(WALLS[0], { roughness: .95 }); R3.wallM = wallM;
    const wall = mesh(new THREE.PlaneGeometry(30, 20), wallM, 0, SH / 2, -CD / 2 - .02); wall.castShadow = false; scene.add(wall);
    const back = mesh(new THREE.BoxGeometry(SW, SH, .03), woodD, 0, SH / 2, -CD / 2 + .015); scene.add(back);
    for (let r = 0; r <= rows; r++) scene.add(mesh(new THREE.BoxGeometry(SW, T, CD), wood, 0, r * CH + T / 2, 0));
    for (let c = 0; c <= cols; c++) scene.add(mesh(new THREE.BoxGeometry(T, SH, CD), wood, -SW / 2 + c * CW + T / 2, SH / 2, 0));
    /* lâmpada quente por cima (luz de "museu") */
    const spot = new THREE.PointLight('#ffd9a0', 6, 8, 1.6); spot.position.set(0, SH + .6, 1.6); scene.add(spot);
    R3.SW = SW; R3.SH = SH;
    Arcade3D.sunAt(sun, 0, SH / 2, 0, Math.max(SW, SH) * .8, [-.3, .75, 1.5]);
    G.r3 = R3;
    syncScene(G, true);
  }
  const slotPos = (G, s) => { const c = s % G.cols, r = Math.floor(s / G.cols); return [-G.cols * CW / 2 + (c + .5) * CW + T / 2, (G.rows - 1 - r) * CH + T, .04]; };

  /* põe na cena o estado G.items (cria/remove/actualiza) */
  function syncScene(G, fresh) {
    const R3 = G.r3; if (!R3) return;
    const seen = new Set();
    G.items.forEach(it => {
      seen.add(it);
      let o = R3.objs.get(it);
      if (!o || o.userData.type !== it.type) {
        if (o) { R3.scene.remove(o); Arcade3D.disposeOwn(o); }
        o = build(it.type, PAL[it.col]); o.userData.type = it.type; o.userData.col = it.col;
        R3.scene.add(o); R3.objs.set(it, o);
        o.userData.born = fresh ? G.t + it.slot * .04 : G.t;
      }
      if (o.userData.col !== it.col) { o.userData.main.forEach(m => m.color.set(PAL[it.col])); o.userData.col = it.col; }
      const [x, y, z] = slotPos(G, it.slot);
      o.position.set(x, y, z);
      o.rotation.y = it.rot * Math.PI / 2 + it.yaw;
      o.userData.sc = it.sc;
    });
    R3.objs.forEach((o, it) => { if (!seen.has(it)) { R3.scene.remove(o); Arcade3D.disposeOwn(o); R3.objs.delete(it); } });
  }

  function destroy(G) {
    const R3 = G.r3; if (!R3) return;
    Arcade3D.disposeOwn(R3.scene);
    Arcade3D.detach();
    G.r3 = null;
  }

  /* ── rondas ─────────────────────────────────────────────────── */
  function newRound(G, api) {
    const c = G.cfg, n = Math.min(G.cols * G.rows - 2, 4 + G.level);
    const slots = M.shuffle([...Array(G.cols * G.rows).keys()]).slice(0, n);
    const types = M.shuffle(TYPES.slice());
    G.items = slots.map((s, i) => ({ slot: s, type: types[i % types.length], col: U.randi(0, PAL.length - 1), rot: 0, yaw: U.rand(-.35, .35), sc: 1 }));
    G.nch = G.level >= c.two ? 2 : 1;
    G.changes = []; G.found = []; G.wrong = null;
    G.phase = 'intro'; G.pt = 0;
    G.lookT = c.look + n * c.per + (G.nch - 1) * 1.2;
    G.wall = WALLS[G.level % WALLS.length];
    if (G.r3) { G.r3.wallM.color.set(G.wall); syncScene(G, true); }
  }

  /* escolhe e aplica uma mudança (sem repetir slots já mudados) */
  function makeChange(G) {
    const used = new Set(G.changes.flatMap(c => c.slots));
    const items = G.items.filter(it => !used.has(it.slot));
    const empty = [...Array(G.cols * G.rows).keys()].filter(s => !G.items.some(it => it.slot === s) && !used.has(s));
    const kinds = ['color', 'color', 'gone', 'gone', 'size'];
    if (empty.length) kinds.push('add', 'add');
    if (items.length >= 2) kinds.push('swap', 'swap');
    if (items.some(it => ASYM.has(it.type))) kinds.push('turn');
    const k = U.pick(kinds);
    if (k === 'color') { const it = U.pick(items); let c; do c = U.randi(0, PAL.length - 1); while (c === it.col); it.col = c; return { k, slots: [it.slot], extra: PALN[c] }; }
    if (k === 'gone') { const it = U.pick(items); G.items.splice(G.items.indexOf(it), 1); return { k, slots: [it.slot] }; }
    if (k === 'size') { const it = U.pick(items); it.sc = Math.random() < .5 ? .62 : 1.4; return { k, slots: [it.slot] }; }
    if (k === 'add') { const s = U.pick(empty), have = new Set(G.items.map(i => i.type)); const t = U.pick(TYPES.filter(x => !have.has(x))) || U.pick(TYPES); G.items.push({ slot: s, type: t, col: U.randi(0, PAL.length - 1), rot: 0, yaw: U.rand(-.35, .35), sc: 1 }); return { k, slots: [s] }; }
    if (k === 'turn') { const it = U.pick(items.filter(i => ASYM.has(i.type))); it.rot = (it.rot + (Math.random() < .5 ? 1 : 2)) % 4; return { k, slots: [it.slot] }; }
    /* swap: dois objetos de tipos diferentes */
    const a = U.pick(items), others = items.filter(i => i !== a && i.type !== a.type), b = U.pick(others.length ? others : items.filter(i => i !== a));
    const s = a.slot; a.slot = b.slot; b.slot = s;
    return { k: 'swap', slots: [a.slot, b.slot] };
  }

  function setup(api, o) {
    const portrait = api.W / api.H < .95;
    const G = Object.assign(M.base(api, o), { cfg: DIFF[o.diff] || DIFF.medium, cols: portrait ? 3 : 4, rows: portrait ? 4 : 3, items: [], rects: [], hover: -1, found: [], changes: [] });
    newRound(G, api);
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { if (G.dead3) return; try { build3D(G, api); } catch (e) { console.warn('[o-que-mudou] 3D falhou', e); } }).catch(() => {});
    return G;
  }

  function update(G, dt, api) {
    G.t += dt; G.pt += dt; M.fxStep(G, dt);
    if (G.phase === 'intro' && G.pt > .9) { G.phase = 'look'; G.pt = 0; }
    else if (G.phase === 'look' && G.pt > G.lookT) { G.phase = 'blink'; G.pt = 0; G.applied = false; api.sfx.noise(.25, .05, 0, 400, 'lowpass'); }
    else if (G.phase === 'blink') {
      if (!G.applied && G.pt > .45) {
        G.applied = true;
        for (let i = 0; i < G.nch; i++) G.changes.push(makeChange(G));
        syncScene(G, false);
      }
      if (G.pt > .95) { G.phase = 'find'; G.pt = 0; }
    }
    else if (G.phase === 'ok' && G.pt > 1.5) { G.level++; newRound(G, api); }
    else if (G.phase === 'fail' && G.pt > 2.2) {
      if (G.dead) { G.phase = 'end'; api.over({ score: G.level - 1, won: false, icon: '🔍', title: 'Escapou-te!',
        stats: [['Nível', G.level], ['Mudanças encontradas', G.total || 0]], meta: { level: G.level - 1 } }); }
      else newRound(G, api);
    }
  }

  function tap(G, slot, api) {
    if (G.phase !== 'find' || slot < 0) return;
    const r = G.rects[slot];
    const ch = G.changes.find(c => c.slots.includes(slot) && !G.found.includes(c));
    if (ch) {
      G.found.push(ch); G.total = (G.total || 0) + 1;
      M.pulse(G, r.cx, r.cy, '#4ade80', 10, r.w * .7, .45); M.note(api, 9 + G.found.length, .25);
      if (G.found.length === G.changes.length) {
        G.phase = 'ok'; G.pt = 0; G.streak++; G.score += 10 * G.level;
        M.good(api); api.burst(r.cx, r.cy, 22, { color: '#4ade80', speed: 200, life: .7, gravity: 0 });
      }
    } else if (!G.changes.some(c => G.found.includes(c) && c.slots.includes(slot))) {
      G.wrong = slot; G.phase = 'fail'; G.pt = 0;
      M.bad(api); M.pulse(G, r.cx, r.cy, '#f43f5e', 10, r.w * .8, .5);
      G.dead = M.miss(G, api);
    }
  }

  /* ── desenho ────────────────────────────────────────────────── */
  function layout2D(G, W, H) {
    const top = 110, bot = 40, aw = W - 28, ah = H - top - bot;
    const s = Math.min(aw / G.cols, ah / G.rows), x0 = (W - s * G.cols) / 2, y0 = top + (ah - s * G.rows) / 2;
    G.rects = [];
    for (let i = 0; i < G.cols * G.rows; i++) { const c = i % G.cols, r = Math.floor(i / G.cols); G.rects.push({ x: x0 + c * s, y: y0 + r * s, w: s, h: s, cx: x0 + c * s + s / 2, cy: y0 + r * s + s / 2 }); }
  }

  function draw3D(G, ctx, W, H, api) {
    const R3 = G.r3, cam = R3.cam;
    const aspect = Arcade3D.fit(api.stage, cam);
    if (!R3.bg) { R3.bg = 1; api.stage.style.background = 'radial-gradient(120% 90% at 50% 30%, #3a2c22 0%, #120d0a 100%)'; }
    /* enquadra a estante na zona livre (abaixo da pílula, acima do fundo) */
    const top = 108, bot = 34, fH = (H - top - bot) / H;
    const fov = cam.fov * Math.PI / 180, need = Math.max((R3.SH + .25) / fH, (R3.SW + .3) / aspect);
    const dist = need / 2 / Math.tan(fov / 2) + CD / 2;
    const viewH = 2 * Math.tan(fov / 2) * (dist - CD / 2), shift = (top - bot) / 2 / H * viewH;
    cam.position.set(0, R3.SH / 2 + shift + .05, dist); cam.lookAt(0, R3.SH / 2 + shift - .06, 0);
    /* objetos: entrada com "pop", tamanho, chama da vela, salto quando encontrado */
    R3.objs.forEach((o, it) => {
      const k = U.clamp((G.t - (o.userData.born || 0)) / .4, 0, 1), pop = k < 1 ? 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2) : 1;
      const want = o.userData.sc || 1; o.userData.cs = U.lerp(o.userData.cs || want, want, .25);
      const s = Math.max(.001, pop * o.userData.cs * 1.45);
      o.scale.set(s, s, s);
      const f = G.found.some(c => c.slots.includes(it.slot)) && G.phase !== 'intro' ? Math.abs(Math.sin(G.t * 8)) * .06 : 0;
      o.position.y = slotPos(G, it.slot)[1] + f;
      o.children.forEach(ch => { if (ch.userData.flame) { const fl = 1 + Math.sin(G.t * 23 + it.slot) * .08 + Math.sin(G.t * 13) * .05; ch.scale.set(.16 * fl, .24 * fl, 1); } });
    });
    R3.renderer.render(R3.scene, cam);
    /* retângulos de toque = cubículos projetados */
    G.rects = [];
    for (let i = 0; i < G.cols * G.rows; i++) {
      const [x, y] = slotPos(G, i);
      const a = Arcade3D.toScreen(cam, x - CW / 2 + T, y + CH - T / 2, CD / 2, W, H), ax = a.x, ay = a.y;
      const b = Arcade3D.toScreen(cam, x + CW / 2, y, CD / 2, W, H);
      G.rects.push({ x: ax, y: ay, w: b.x - ax, h: b.y - ay, cx: (ax + b.x) / 2, cy: (ay + b.y) / 2 });
    }
  }

  function draw2D(G, ctx, W, H) {
    layout2D(G, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, G.wall); g.addColorStop(1, '#120d0a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    G.rects.forEach((r, i) => {
      ctx.fillStyle = '#6b4429'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#2a1c12'; ctx.fillRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
      const it = G.items.find(o => o.slot === i); if (!it) return;
      ctx.save(); ctx.translate(r.cx, r.cy + 4); ctx.rotate(it.rot * Math.PI / 2); ctx.scale(it.sc, it.sc);
      ctx.fillStyle = PAL[it.col]; ctx.beginPath(); ctx.arc(0, 0, r.w * .3, 0, 6.3); ctx.fill();
      ctx.font = `${Math.round(r.w * .36)}px system-ui, "Segoe UI Emoji", "Apple Color Emoji"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(EMOJI[it.type], 0, 2);
      ctx.restore();
    });
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) draw3D(G, ctx, W, H, api); else draw2D(G, ctx, W, H);
    /* realces por cima (canvas 2D) */
    const ringAt = (s, col, w) => { const r = G.rects[s]; if (!r) return; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w || 3; ctx.shadowColor = col; ctx.shadowBlur = 14; U.rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 10); ctx.stroke(); ctx.restore(); };
    if (G.phase === 'find' && G.hover >= 0) ringAt(G.hover, 'rgba(255,255,255,.35)', 2);
    G.found.forEach(c => c.slots.forEach(s => ringAt(s, '#4ade80')));
    if (G.phase === 'fail' || G.phase === 'end') {
      if (G.wrong != null) ringAt(G.wrong, '#f43f5e');
      if (Math.sin(G.pt * 10) > -.3) G.changes.filter(c => !G.found.includes(c)).forEach(c => c.slots.forEach(s => ringAt(s, '#fde047', 3.5)));
    }
    if (G.phase === 'ok' || G.phase === 'fail' || G.phase === 'end') {
      G.changes.forEach(c => { const r = G.rects[c.slots[0]]; if (!r) return;
        const txt = LABEL[c.k] + (c.k === 'color' ? ' → ' + c.extra : '');
        ctx.font = "800 13px 'Space Grotesk', system-ui"; const tw = ctx.measureText(txt).width + 18;
        const x = U.clamp(c.slots.length > 1 ? (r.cx + G.rects[c.slots[1]].cx) / 2 : r.cx, tw / 2 + 6, W - tw / 2 - 6), y = r.y + 14;
        U.rr(ctx, x - tw / 2, y - 12, tw, 24, 12); ctx.fillStyle = 'rgba(10,10,20,.85)'; ctx.fill();
        ctx.fillStyle = '#fde68a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + 1); });
    }
    M.fxDraw(G, ctx);
    /* apagão: a luz vai-se e volta (fecha como uma pálpebra) */
    if (G.phase === 'blink') {
      const k = G.pt < .45 ? G.pt / .45 : Math.max(0, 1 - (G.pt - .45) / .5), e = U.ease(U.clamp(k, 0, 1));
      ctx.fillStyle = `rgba(4,3,8,${e})`; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#05040a';
      ctx.fillRect(0, 0, W, H / 2 * e); ctx.fillRect(0, H - H / 2 * e, W, H / 2 * e);
    }
    const pillY = 62;
    if (G.phase === 'intro') M.pill(ctx, W, pillY, 'NÍVEL ' + G.level + (G.nch > 1 ? ' · 2 MUDANÇAS' : ''), null, '#fb923c', G.t);
    else if (G.phase === 'look') M.pill(ctx, W, pillY, 'OBSERVA BEM', 1 - G.pt / G.lookT, '#fb923c', G.t);
    else if (G.phase === 'blink') M.pill(ctx, W, pillY, '…', null, '#fb923c', G.t);
    else if (G.phase === 'find') M.pill(ctx, W, pillY, G.nch > 1 ? `O QUE MUDOU? · ${G.found.length}/${G.nch}` : 'O QUE MUDOU?', G.nch > 1 ? G.found.length / G.nch : null, '#4ade80', G.t);
    else if (G.phase === 'ok') M.pill(ctx, W, pillY, 'BEM VISTO!', 1, '#4ade80', G.t);
    else M.pill(ctx, W, pillY, G.dead ? 'SEM VIDAS' : 'ERA AQUI', null, '#f43f5e', G.t);
  }

  const slotAt = (G, x, y) => G.rects.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);

  return ArcadeKit.create({
    id: 'what-changed', title: 'O Que Mudou?', icon: '🔍', accent: '#fb923c', accent2: '#facc15', bg: '#120d0a', transparent: true, destroy,
    tagline: 'Observa a estante. A luz apaga-se por um instante… e algo mudou. O quê?',
    view: { w: 420 }, modes: M.MODES(), bestLabel: 'Melhor nível',
    how: [
      'Observa os objetos da estante enquanto a barra corre.',
      'A luz apaga-se por um instante. Quando volta, algo mudou: <b>cor, tamanho, posição, rotação</b> — ou desapareceu, ou apareceu um objeto novo.',
      'Toca no cubículo onde está a mudança (numa troca, qualquer um dos dois serve). Mais à frente há <b>duas</b> mudanças por ronda.',
    ],
    controls: ['👆 Tocar', '🖱️ Clicar'],
    ready: { title: 'Toca para começar', hint: 'Diz em voz baixa o que vês: "pato amarelo, caneca azul…"' },
    setup, update, draw,
    idle: (G, dt) => { G.t += dt; },
    down: (G, x, y, api) => tap(G, slotAt(G, x, y), api),
    move: (G, x, y) => { G.hover = slotAt(G, x, y); },
    hud: (G, api) => [['Nível', G.level], ['Vidas', M.hearts(G)], ['Recorde', api.best != null ? api.best : '—']],
    achievements: [
      { id: 'wc.8', name: 'Detetive', icon: '🔍', desc: 'Chega ao nível 8 em O Que Mudou?.', test: c => (c.result.score || 0) >= 8 },
      { id: 'wc.15', name: 'Nada Me Escapa', icon: '🕵️', desc: 'Chega ao nível 15 em O Que Mudou?.', test: c => (c.result.score || 0) >= 15 },
    ],
  });
})();
