/* ══════════════════════════════════════════════════════════════════
   Travessia (Crossy Road) — salta casa a casa por relva, estradas,
   rios e linhas de comboio geradas sem fim. Carros e camiões, troncos
   e nenúfares que arrastam, comboios anunciados pelo sinal a piscar.
   Se ficares para trás, a câmara apanha-te. Moedas pelo caminho
   desbloqueiam personagens (sapo, coelho, pinguim, raposa).
   Perspetiva oblíqua "voxel" desenhada em canvas: cada objeto é uma
   caixa com tampo e frente.
══════════════════════════════════════════════════════════════════ */
const CrossyRoadGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const CELL = 44, COLS = 9, X0 = 2, HOP = .12;
  const DIFF = {
    easy:   { car: .78, push: .55, dens: .8 },
    medium: { car: 1,   push: .75, dens: 1 },
    hard:   { car: 1.22, push: 1,  dens: 1.2 },
  };
  const CHARS = [
    { id: 'frog',    name: 'Sapo',    cost: 0,   body: '#4ade80', dark: '#15803d', acc: '#fef08a' },
    { id: 'bunny',   name: 'Coelho',  cost: 40,  body: '#f5f5f4', dark: '#a8a29e', acc: '#fda4af' },
    { id: 'penguin', name: 'Pinguim', cost: 120, body: '#1f2937', dark: '#030712', acc: '#fb923c' },
    { id: 'fox',     name: 'Raposa',  cost: 250, body: '#f97316', dark: '#9a3412', acc: '#fff7ed' },
  ];
  const store = () => (typeof GameProgress !== 'undefined' ? GameProgress.store('crossy-road') : { getPref: (k, d) => d, setPref: () => {} });
  const colX = c => X0 + c * CELL + CELL / 2;

  /* ── mundo ── */
  function genRow(G, z) {
    const k = Math.min(1, z / 250), dens = G.cfg.dens;
    let t;
    if (z < 4) t = 'grass';
    else if (G.run.left > 0) t = G.run.type;
    else {
      const r = Math.random();
      t = r < .34 ? 'grass' : r < .7 ? 'road' : r < .9 ? 'river' : 'rail';
      if (t === G.lastType && t !== 'road') t = 'road';
      G.run = { type: t, left: t === 'grass' ? U.randi(1, 2) : t === 'road' ? U.randi(1, 3 + Math.round(k * 2)) : t === 'river' ? U.randi(1, 3) : 1 };
    }
    G.run.left--; G.lastType = t;
    const row = { z, t, dir: Math.random() < .5 ? -1 : 1, objs: [], block: new Set(), coins: new Set() };
    if (t === 'grass') {
      if (z > 0) { const n = z < 4 ? 0 : U.randi(1, 3); for (let i = 0; i < n; i++) row.block.add(U.randi(0, COLS - 1)); }
      /* bordas com árvores para "fechar" o mapa visualmente */
      row.edge = true;
      if (z > 4 && Math.random() < .2) { const c = U.randi(0, COLS - 1); if (!row.block.has(c)) row.coins.add(c); }
      row.shade = z % 2;
    } else if (t === 'road') {
      const truck = Math.random() < .3;
      row.speed = U.rand(60, 110 + k * 90) * G.cfg.car * (truck ? .8 : 1);
      const n = Math.max(1, Math.round(U.rand(1, 2.5) * dens * (truck ? .7 : 1)));
      const span = (COLS + 6) * CELL;
      for (let i = 0; i < n; i++) row.objs.push({ x: -3 * CELL + i * span / n + U.rand(0, span / n * .4), w: truck ? CELL * 2.2 : CELL * .95, hue: U.pick([0, 210, 45, 280, 160, 20]), truck });
      if (Math.random() < .15) row.coins.add(U.randi(0, COLS - 1));
    } else if (t === 'river') {
      const pads = Math.random() < .25;
      row.speed = pads ? 0 : U.rand(45, 85 + k * 45) * G.cfg.car;
      if (pads) { const cs = new Set(); while (cs.size < U.randi(3, 5)) cs.add(U.randi(0, COLS - 1)); cs.forEach(c => row.objs.push({ x: X0 + c * CELL + 3, w: CELL - 6, pad: true })); }
      else {
        const span = (COLS + 6) * CELL; let x = -3 * CELL;
        while (x < span - 3 * CELL) { const w = CELL * U.randi(2, 4); row.objs.push({ x, w }); x += w + CELL * U.rand(1.1, 2.4) / Math.max(.7, dens); }
      }
    } else if (t === 'rail') {
      row.trainT = U.rand(2, 6); row.train = null;
    }
    return row;
  }

  function ensure(G, upTo) { while (G.rows.length <= upTo) G.rows.push(genRow(G, G.rows.length)); }

  function setup(api, o) {
    const ch = CHARS.find(c => c.id === store().getPref('char', 'frog')) || CHARS[0];
    const G = { cfg: DIFF[o.diff] || DIFF.medium, ch, rows: [], run: { left: 0 }, lastType: null,
      col: 4, z: 0, px: colX(4), hop: null, queue: null, cam: -2, camMin: -2, t: 0, best: 0, coins: 0, dead: null, idle: 0 };
    ensure(G, 30);
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build3D(G, api); } catch (e) { console.warn('[travessia] 3D falhou', e); } }).catch(() => {});
    return G;
  }

  function tryMove(G, api, dc, dz) {
    if (G.dead || api.state !== 'play') return;
    if (G.hop) { G.queue = [dc, dz]; return; }
    const curCol = Math.round((G.px - X0 - CELL / 2) / CELL);
    const nc = curCol + dc, nz = G.z + dz;
    if (nc < 0 || nc >= COLS || nz < 0) { G.face = dc || G.face; bump(G, api); return; }
    ensure(G, nz + 30);
    const row = G.rows[nz];
    if (row.t === 'grass' && row.block.has(nc)) { G.face = dc || G.face; bump(G, api); return; }
    G.hop = { fx: G.px, fz: G.z, tx: colX(nc), tz: nz, t: 0 };
    if (dc) G.face = dc;
    G.dir = dz > 0 ? 'up' : dz < 0 ? 'down' : dc > 0 ? 'right' : 'left';
    G.idle = 0;
    api.sfx.tone(dz > 0 ? 540 : 460, .05, 'triangle', .05, 0, dz > 0 ? 700 : 400);
  }
  function bump(G, api) { G.bumpT = .15; api.sfx.tone(160, .04, 'square', .03); }

  function die(G, api, why, kind) {
    if (G.dead) return;
    G.dead = { why, kind, t: 0 };
    api.shake(kind === 'car' || kind === 'train' ? 10 : 4, .3); api.vibe(kind === 'water' ? 60 : [40, 30, 80]);
    if (kind === 'water') { api.sfx.noise(.4, .12, 0, 700, 'lowpass'); }
    else api.sfx.tone(180, .3, 'sawtooth', .07, 0, 60);
    const total = store().getPref('coins', 0) + G.coins; store().setPref('coins', total);
    api.over({ score: G.best, won: false, delay: 900, title: why, icon: kind === 'water' ? '🌊' : kind === 'eagle' ? '🦅' : '💥',
      stats: [['Casas', G.best], ['Moedas', G.coins], ['Moedas no total', total]], meta: { best: G.best, coins: total } });
  }

  function onRowHazard(G, api) {
    const row = G.rows[G.z]; if (!row || G.hop) return;
    const hx = G.px;
    if (row.t === 'road') {
      for (const o of row.objs) if (hx + 13 > o.x + 3 && hx - 13 < o.x + o.w - 3) { die(G, api, 'Atropelado!', 'car'); return; }
    } else if (row.t === 'rail' && row.train) {
      if (hx + 14 > row.train.x && hx - 14 < row.train.x + row.train.w) { die(G, api, 'Apanhado pelo comboio!', 'train'); return; }
    } else if (row.t === 'river') {
      const on = row.objs.find(o => hx > o.x - 4 && hx < o.x + o.w + 4);
      if (!on) { die(G, api, 'Splash! Caíste ao rio', 'water'); return; }
      G.px += row.dir * row.speed * G.dtLast;
      if (G.px < X0 + 6 || G.px > X0 + COLS * CELL - 6) die(G, api, 'Levado pela corrente!', 'water');
    }
  }

  function update(G, dt, api) {
    G.t += dt; G.dtLast = dt;
    G.bumpT = Math.max(0, (G.bumpT || 0) - dt);
    /* mundo em movimento */
    const lo = Math.max(0, Math.floor(G.cam) - 2), hi = Math.min(G.rows.length - 1, Math.ceil(G.cam) + 22);
    const span = (COLS + 6) * CELL;
    for (let z = lo; z <= hi; z++) {
      const row = G.rows[z];
      if (row.t === 'road' || (row.t === 'river' && row.speed)) row.objs.forEach(o => {
        o.x += row.dir * row.speed * dt;
        if (row.dir > 0 && o.x > X0 + (COLS + 3) * CELL) o.x -= span;
        if (row.dir < 0 && o.x + o.w < X0 - 3 * CELL) o.x += span;
      });
      if (row.t === 'rail') {
        if (row.train) { row.train.x += row.train.v * dt; if ((row.train.v > 0 && row.train.x > X0 + (COLS + 2) * CELL) || (row.train.v < 0 && row.train.x + row.train.w < -2 * CELL)) { row.train = null; row.trainT = U.rand(3, 7); } }
        else { row.trainT -= dt; if (row.trainT <= 0) { const v = 1150 * row.dir; row.train = { w: CELL * 9, v, x: v > 0 ? -CELL * 11 : X0 + (COLS + 2) * CELL }; if (Math.abs(z - G.z) < 6) api.sfx.noise(.6, .07, 0, 250, 'lowpass'); } else if (row.trainT < 1.3 && Math.abs(z - G.z) < 4 && Math.floor(row.trainT * 6) !== Math.floor((row.trainT + dt) * 6)) api.sfx.tone(900, .05, 'square', .03); }
      }
    }
    if (G.dead) return;
    /* salto */
    if (G.hop) {
      const h = G.hop; h.t += dt;
      const k = Math.min(1, h.t / HOP);
      G.px = U.lerp(h.fx, h.tx, k); G.zf = U.lerp(h.fz, h.tz, k);
      if (k >= 1) {
        G.hop = null; G.z = h.tz; G.zf = G.z; G.px = h.tx;
        const row = G.rows[G.z], c = Math.round((G.px - X0 - CELL / 2) / CELL);
        if (row.coins.has(c)) { row.coins.delete(c); G.coins++; api.sfx.arp([988, 1319], .04, .07, 'sine', .07); }
        if (G.z > G.best) { G.best = G.z; if (G.best % 50 === 0) { api.banner(G.best + ' casas!', ''); api.sfx.arp([523, 659, 784], .06, .1, 'triangle', .06); } }
        /* aterrar num tronco: acerta a coluna à posição real */
        if (row.t === 'river') { const on = row.objs.find(o => G.px > o.x - 4 && G.px < o.x + o.w + 4); if (!on) { die(G, api, 'Splash! Caíste ao rio', 'water'); return; } }
        if (G.queue) { const q = G.queue; G.queue = null; tryMove(G, api, q[0], q[1]); }
      }
    } else G.zf = G.z;
    onRowHazard(G, api);
    if (G.dead) return;
    /* câmara: segue o jogador e empurra sempre um bocadinho para a frente */
    G.idle += dt;
    G.camMin += G.cfg.push * (.35 + Math.min(1, G.best / 200) * .6) * dt;
    const want = Math.max(G.camMin, (G.zf || G.z) - 3);
    G.cam = U.lerp(G.cam, want, Math.min(1, dt * 3));
    if ((G.zf || G.z) < G.cam - 1.4) die(G, api, 'Ficaste para trás!', 'eagle');
    ensure(G, Math.ceil(G.cam) + 30);
  }

  /* ── desenho (oblíquo voxel) ── */
  function box(ctx, x, y, w, d, h, top, front) {
    ctx.fillStyle = front; ctx.fillRect(x, y - h + d, w, h);
    ctx.fillStyle = top; ctx.fillRect(x, y - h, w, d);
  }

  /* ════════════════════════════════════════════════════════════════
     3D "voxel" — cubos com sombras suaves, câmara alta e inclinada que
     segue o avanço; relva escura com árvores para lá das margens.
     1 unidade = 1 casa; x = coluna − 4, z = −fila (a frente é −z).
  ════════════════════════════════════════════════════════════════ */
  const wx = px => (px - X0) / CELL - 4.5;
  function vox(scene) {
    const B = new THREE.BoxGeometry(1, 1, 1); B.userData.shared = true;
    const mk = (g, x, y, z, sx, sy, sz, c, sh) => { const m = new THREE.Mesh(B, Arcade3D.std(c, { roughness: .78 })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = sh !== false; m.receiveShadow = true; g.add(m); return m; };
    return { B, mk };
  }
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun } = Arcade3D.stdScene({ sky: '#f0f9ff', ground: '#4d7c0f', hemi: 1.15, sunI: 2.5, normalBias: .03 });
    sun.shadow.bias = -.0006;
    scene.background = new THREE.Color('#65a30d');
    const cam = new THREE.PerspectiveCamera(34, 1, .5, 120);
    const V = vox(scene);
    G.r3 = { renderer, scene, sun, cam, V, pool: Arcade3D.pool(scene), camZ: 0, camX: 0 };
    api.stage.style.background = '#4d7c0f';
  }

  /* modelos (construídos uma vez por tipo, reaproveitados pelo pool) */
  /* árvores voxel em camadas (2 tons + tronco com raiz); 3 variantes */
  function tree(V, tall, kind) {
    const g = new THREE.Group();
    V.mk(g, 0, .3, 0, .26, .6, .26, '#8a4b1c');
    V.mk(g, 0, .04, 0, .36, .08, .36, '#6b3a16');
    if (kind === 'pine') {
      V.mk(g, 0, .72, 0, .86, .28, .86, '#15803d'); V.mk(g, 0, 1.0, 0, .66, .28, .66, '#16a34a'); V.mk(g, 0, 1.26, 0, .44, .26, .44, '#22c55e'); V.mk(g, 0, 1.46, 0, .2, .16, .2, '#4ade80');
      return g;
    }
    V.mk(g, 0, .9, 0, .82, .58, .82, '#16a34a');
    V.mk(g, -.08, 1.06, -.08, .6, .32, .6, '#22c55e');
    V.mk(g, .18, .82, .2, .3, .26, .3, '#15803d', false);
    if (tall) { V.mk(g, 0, 1.42, 0, .58, .46, .58, '#22c55e'); V.mk(g, -.06, 1.58, -.06, .36, .2, .36, '#4ade80'); }
    if (kind === 'apple') [[.42, .95, .1], [-.2, .8, .42], [.1, 1.12, -.42]].forEach(([x, y, z]) => V.mk(g, x, y, z, .1, .1, .1, '#ef4444', false));
    return g;
  }
  /* carros voxel com pormenor: carroçaria em 2 níveis, vidros dos lados/frente/trás, jantes,
     para-choques, faróis e farolins; táxi, polícia e autocarro; camião com cabina e caixa */
  function carModel(V, hue, truck, len) {
    const g = new THREE.Group(), body = `hsl(${hue},72%,52%)`, dark = `hsl(${hue},70%,38%)`, light = `hsl(${hue},75%,66%)`;
    const kind = truck ? 'truck' : hue === 45 ? 'taxi' : hue === 210 && len > .9 ? 'police' : 'car';
    const glass = '#1e3a5f', glassL = '#3b6ea5';
    const B = (x, y, z, sx, sy, sz, c, sh) => V.mk(g, x, y, z, sx, sy, sz, c, sh);
    if (truck) {
      const cx = len / 2 - .48;
      B(cx, .55, 0, .86, .62, .74, body); B(cx + .02, .92, 0, .8, .26, .72, light);
      B(cx + .42, .9, 0, .02, .2, .6, glass, false); [-1, 1].forEach(sd => B(cx + .12, .9, sd * .365, .36, .18, .02, glassL, false));
      B(cx + .44, .4, 0, .04, .14, .7, '#d1d5db', false);
      const bl = len - 1.0, bx = -len / 2 + bl / 2 + .02;
      B(bx, .82, 0, bl, 1.1, .8, '#f8fafc'); B(bx, 1.38, 0, bl + .02, .04, .82, '#cbd5e1', false);
      [-1, 1].forEach(sd => B(bx, .68, sd * .405, bl * .92, .16, .01, body, false));
      B(-len / 2 + .01, .82, 0, .02, 1.02, .74, '#e2e8f0', false);
      B(bx, .22, 0, bl, .1, .62, '#374151', false);
    } else if (kind === 'police' || kind === 'taxi' || kind === 'car') {
      B(0, .36, 0, len, .3, .72, kind === 'police' ? '#f8fafc' : body);
      B(-.04, .62, 0, len * .58, .26, .64, kind === 'police' ? '#f1f5f9' : dark);
      B(-.04, .76, 0, len * .5, .04, .6, kind === 'police' ? '#e5e7eb' : light, false);
      B(len * .25 + .005, .62, 0, .02, .2, .56, glass, false); B(-len * .33 - .005, .62, 0, .02, .18, .56, glass, false);
      [-1, 1].forEach(sd => { B(-.04 + len * .12, .62, sd * .325, len * .2, .17, .02, glassL, false); B(-.04 - len * .14, .62, sd * .325, len * .2, .17, .02, glassL, false); });
      B(len / 2 + .005, .26, 0, .04, .1, .74, '#9ca3af', false); B(-len / 2 - .005, .26, 0, .04, .1, .74, '#9ca3af', false);
      if (kind === 'taxi') { B(-.04, .84, 0, .26, .1, .3, '#fde047'); B(-.04, .84, 0, .27, .04, .31, '#111', false); [-1, 1].forEach(sd => B(0, .38, sd * .365, len * .9, .05, .01, '#111', false)); }
      if (kind === 'police') { [-1, 1].forEach(sd => B(0, .36, sd * .365, len * .96, .14, .01, '#1d4ed8', false)); const r = new THREE.Mesh(V.B, Arcade3D.glowMat('#ef4444')), b = new THREE.Mesh(V.B, Arcade3D.glowMat('#3b82f6')); r.position.set(-.04, .84, -.14); b.position.set(-.04, .84, .14); r.scale.set(.18, .08, .2); b.scale.set(.18, .08, .2); g.add(r, b); }
    }
    const wheel = x => [-1, 1].forEach(sd => { B(x, .17, sd * .35, .28, .28, .08, '#111827', false); B(x, .17, sd * .392, .14, .14, .01, '#cbd5e1', false); });
    wheel(len / 2 - .26); wheel(-len / 2 + .26); if (truck) wheel(-len / 2 + .6);
    [-1, 1].forEach(sd => {
      const hl = new THREE.Mesh(V.B, Arcade3D.glowMat('#fef9c3')); hl.position.set(len / 2 + .02, .42, sd * .25); hl.scale.set(.03, .09, .14); g.add(hl);
      const tl = new THREE.Mesh(V.B, Arcade3D.glowMat('#ef4444')); tl.position.set(-len / 2 - .02, .42, sd * .27); tl.scale.set(.03, .08, .12); g.add(tl);
    });
    return g;
  }
  /* personagens voxel: olhos com branco, pupila e brilho (piscam), boca, bochechas e patas */
  function charModel(V, ch) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const M = (x, y, z, sx, sy, sz, c, sh) => V.mk(body, x, y, z, sx, sy, sz, c, sh);
    const b = M(0, .3, 0, .5, .48, .5, ch.body);
    const eyes = [];
    /* olho: frente = −z; branco + pupila + brilho */
    const eye = (x, y, z, s, white) => { const e = new THREE.Group(); e.position.set(x, y, z); body.add(e); V.mk(e, 0, 0, 0, s, s, .03, white || '#ffffff', false); V.mk(e, 0, -s * .1, -.02, s * .52, s * .58, .02, '#111827', false); V.mk(e, s * .14, s * .14, -.032, s * .2, s * .2, .01, '#ffffff', false); eyes.push(e); };
    [-.13, .13].forEach(x => M(x, .03, -.06, .14, .06, .2, ch.dark, false));      /* patas */
    if (ch.id === 'frog') {
      M(0, .1, 0, .56, .1, .56, ch.dark); M(0, .5, .02, .5, .04, .5, '#86efac', false);
      [-.15, .15].forEach(x => { M(x, .6, -.1, .18, .14, .18, ch.body); eye(x, .61, -.195, .13); });
      M(0, .3, -.255, .32, .04, .02, '#14532d', false); [-.18, .18].forEach(x => M(x, .36, -.253, .07, .05, .01, '#f472b6', false));
      M(0, .2, -.26, .4, .1, .02, ch.acc, false);
    }
    if (ch.id === 'bunny') {
      [-.12, .12].forEach(x => { M(x, .78, .05, .11, .44, .11, ch.body); M(x, .8, -.005, .06, .32, .01, ch.acc, false); });
      [-.12, .12].forEach(x => eye(x, .43, -.255, .1));
      M(0, .33, -.262, .07, .05, .02, ch.acc, false); M(0, .26, -.262, .1, .03, .01, '#a8a29e', false);
      M(0, .32, .28, .14, .14, .1, '#ffffff');
    }
    if (ch.id === 'penguin') {
      M(0, .28, -.2, .36, .4, .12, '#f8fafc'); M(0, .38, -.31, .14, .07, .12, ch.acc);
      [-.12, .12].forEach(x => eye(x, .48, -.258, .1));
      M(0, .03, -.1, .42, .06, .22, ch.acc); [-1, 1].forEach(sd => M(sd * .28, .3, 0, .06, .3, .3, ch.dark));
    }
    if (ch.id === 'fox') {
      [-.15, .15].forEach(x => { M(x, .64, .05, .15, .22, .1, ch.body); M(x, .74, .05, .07, .07, .101, '#1f1208', false); });
      M(0, .22, -.3, .28, .2, .16, ch.acc); M(0, .27, -.39, .08, .06, .03, '#1f1208', false);
      [-.12, .12].forEach(x => eye(x, .44, -.258, .1));
      M(0, .3, .36, .2, .2, .32, ch.body); M(0, .3, .55, .14, .14, .08, ch.acc);
    }
    g.userData.body = body; g.userData.eyes = eyes; b.userData.main = true;
    return g;
  }

  function draw3D(G, ctx, W, H, api) {
    const R = G.r3, V = R.V, P = R.pool;
    Arcade3D.fit(api.stage, R.cam);
    const zf = G.zf != null ? G.zf : G.z;
    const lo = Math.max(-6, Math.floor(G.cam) - 5), hi = Math.min(G.rows.length - 1, Math.ceil(G.cam) + 22);
    P.begin();
    for (let z = hi; z >= lo; z--) {
      const row = z >= 0 ? G.rows[z] : null, Z = -z;
      const t = row ? row.t : 'grass';
      /* chão da fila: faixa jogável + margens mais escuras */
      const top = t === 'grass' ? ((row ? row.shade : z & 1) ? '#84cc16' : '#7ac31a') : t === 'road' ? '#3f4652' : t === 'river' ? '#1d9bd8' : '#a8a29e';
      const hgt = t === 'river' ? .1 : t === 'grass' ? .3 : .2, y = t === 'river' ? -.25 : -hgt / 2 + (t === 'grass' ? 0 : -.05);
      const g1 = P.get('floor:' + top, () => { const m = new THREE.Mesh(V.B, t === 'river' ? new THREE.MeshStandardMaterial({ color: top, roughness: .15, metalness: .1, transparent: true, opacity: .92 }) : Arcade3D.std(top, { roughness: .9 })); m.receiveShadow = true; return m; });
      g1.position.set(0, y, Z); g1.scale.set(9, hgt, 1.001);
      const sideC = t === 'grass' ? ((row ? row.shade : z & 1) ? '#5f8f12' : '#58860f') : t === 'road' ? '#2d333c' : t === 'river' ? '#0ea5e9' : '#8a837d';
      [-1, 1].forEach(sd => { const m = P.get('side:' + sideC + t, () => { const mm = new THREE.Mesh(V.B, Arcade3D.std(sideC, { roughness: .9 })); mm.receiveShadow = true; return mm; }); m.position.set(sd * 9, y, Z); m.scale.set(9, hgt, 1.001); });
      if (t === 'road') {
        const nxt = G.rows[z + 1];
        if (nxt && nxt.t === 'road') for (let x = -4.2; x < 4.5; x += 1.4) { const d = P.get('dash', () => new THREE.Mesh(V.B, Arcade3D.std('#e5e7eb', { roughness: .6 }))); d.position.set(x, .001, Z - .5); d.scale.set(.6, .02, .06); }
      }
      if (t === 'river') {
        /* espuma junto às margens */
        [-1, 1].forEach(sd => { const fz = P.get('foam', () => new THREE.Mesh(V.B, new THREE.MeshBasicMaterial({ color: '#e0f7ff', transparent: true, opacity: .55 }))); fz.position.set(0, -.19, Z + sd * .47); fz.scale.set(9, .012, .06 + .02 * Math.sin(api.t * 3 + z)); });
        for (let x = -4; x < 5; x += 2) { const w = P.get('wave', () => new THREE.Mesh(V.B, new THREE.MeshBasicMaterial({ color: '#e0f2fe', transparent: true, opacity: .45 }))); w.position.set(x + ((api.t * .8 * (row.dir || 1)) % 2 + 2) % 2 - 1, -.19, Z + ((x * 7) % 3) * .1 - .1); w.scale.set(.5, .01, .04); }
      }
      if (t === 'rail') {
        for (let x = -4.4; x < 4.6; x += .5) { const sl = P.get('sleeper', () => { const m = new THREE.Mesh(V.B, Arcade3D.std('#78350f', { roughness: .9 })); m.receiveShadow = true; return m; }); sl.position.set(x, -.02, Z); sl.scale.set(.22, .06, .8); }
        [-.25, .25].forEach(dz => { const r = P.get('rail', () => new THREE.Mesh(V.B, Arcade3D.std('#e5e7eb', { roughness: .3, metalness: .7 }))); r.position.set(0, .04, Z + dz); r.scale.set(9, .06, .06); });
        const warn = row && !row.train && row.trainT < 1.3, on = warn && Math.floor(G.t * 8) % 2;
        const pole = P.get('signal', () => { const g = new THREE.Group(); V.mk(g, 0, .6, 0, .08, 1.2, .08, '#1f2937'); const l = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), Arcade3D.std('#450a0a')); l.position.y = 1.25; g.add(l); g.userData.l = l; const s = new THREE.Sprite(Arcade3D.glowSprite('#ef4444')); s.position.y = 1.25; g.add(s); g.userData.s = s; return g; });
        pole.position.set(4.3, 0, Z - .45); pole.userData.l.material = on ? Arcade3D.glowMat('#ef4444') : Arcade3D.std('#450a0a'); pole.userData.s.scale.setScalar(on ? 1.4 : 0);
        if (row && row.train) {
          const tr = row.train, x0 = wx(tr.x), len = tr.w / CELL;
          /* locomotiva à frente (no sentido da marcha) + carruagens */
          const loco = P.get('loco', () => {
            const g = new THREE.Group();
            V.mk(g, 0, .55, 0, 2.6, .8, .82, '#1d4ed8'); V.mk(g, -.7, 1.05, 0, 1.1, .3, .78, '#1e40af'); V.mk(g, .55, 1.12, 0, .9, .5, .84, '#facc15');
            V.mk(g, 1.0, 1.15, 0, .02, .26, .6, '#1e3a5f', false); [-1, 1].forEach(sd => V.mk(g, .55, 1.15, sd * .425, .5, .22, .01, '#1e3a5f', false));
            V.mk(g, -.9, 1.35, 0, .2, .4, .2, '#374151'); V.mk(g, 1.32, .3, 0, .08, .3, .8, '#111827');
            const hl = new THREE.Mesh(V.B, Arcade3D.glowMat('#fef9c3')); hl.position.set(1.31, .7, 0); hl.scale.set(.03, .16, .3); g.add(hl);
            for (let k2 = -1; k2 <= 1; k2++) [-1, 1].forEach(sd => V.mk(g, k2 * .8, .16, sd * .38, .3, .3, .06, '#111827', false));
            return g;
          });
          loco.position.set(tr.v > 0 ? x0 + len - 1.3 : x0 + 1.3, 0, Z); loco.rotation.y = tr.v > 0 ? 0 : Math.PI;
          for (let k = tr.v > 0 ? 0 : 3; k < (tr.v > 0 ? len - 3 : len); k += 3) {
            const car = P.get('wagon', () => { const g = new THREE.Group(); V.mk(g, 0, .7, 0, 2.9, 1.1, .8, '#dc2626'); V.mk(g, 0, 1.3, 0, 2.95, .1, .84, '#991b1b', false); for (let w = -1; w <= 1; w++) { const m = new THREE.Mesh(V.B, Arcade3D.glowMat('#fef9c3')); m.position.set(w * .9, .85, .41); m.scale.set(.5, .3, .02); g.add(m); } return g; });
            car.position.set(x0 + k + 1.5, 0, Z);
          }
        }
      }
      /* árvores fora da área de jogo (fecham o mundo, como no original) */
      if (t === 'grass' || z < 0) {
        for (let k = 0; k < 3; k++) {
          const hsh = Math.sin(z * 12.9898 + k * 78.233) * 43758.5, f = hsh - Math.floor(hsh);
          [-1, 1].forEach(sd => { const kd = f > .72 ? 'pine' : f > .5 ? 'treeT' : f > .2 ? 'tree' : 'apple'; const tr = P.get('t:' + kd, () => tree(V, kd === 'treeT', kd)); tr.position.set(sd * (5.1 + k * 1.3 + f * .4), 0, Z); });
        }
      }
      if (z < 0) {
        for (let c = 0; c < 9; c++) { const hh = Math.sin(z * 31.1 + c * 17.7) * 9999, f = hh - Math.floor(hh); if (f > (z === -1 ? .18 : .4)) continue; const tr = P.get(z === -1 ? 'bush' : 'tree', () => z === -1 ? (() => { const g = new THREE.Group(); V.mk(g, 0, .2, 0, .6, .4, .6, '#22c55e'); return g; })() : tree(V, false)); tr.position.set(c - 4, 0, Z); }
      }
      if (!row) continue;
      if (t === 'grass') {
        row.block.forEach(c => {
          const v2 = (c * 7 + z * 3) % 5, kd = v2 === 0 ? 'pine' : v2 === 1 ? 'treeT' : v2 === 2 ? 'apple' : v2 === 3 ? 'rock' : 'tree';
          const tr = P.get('t:' + kd, () => kd === 'rock' ? (() => { const g = new THREE.Group(); V.mk(g, 0, .22, 0, .7, .44, .62, '#9ca3af'); V.mk(g, -.08, .48, .04, .46, .16, .4, '#d1d5db'); V.mk(g, .26, .16, -.2, .26, .24, .24, '#6b7280'); return g; })() : tree(V, kd === 'treeT', kd));
          tr.position.set(c - 4, 0, Z);
        });
        for (let i = 0; i < 3; i++) { const h = Math.sin(z * 91.7 + i * 37.3) * 43758.5, f = h - Math.floor(h); const fl = P.get('flower' + (i % 3), () => new THREE.Mesh(V.B, Arcade3D.std(['#fde047', '#f9a8d4', '#ffffff'][i % 3]))); fl.position.set(-4.3 + f * 8.6, .03, Z - .3 + ((f * 7.3) % 1) * .6); fl.scale.set(.1, .06, .1); }
      }
      if (t === 'river') row.objs.forEach(o => {
        const x0 = wx(o.x), w = o.w / CELL;
        if (o.pad) { const m = P.get('pad', () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .06, 18), Arcade3D.std('#16a34a')); c.receiveShadow = true; g.add(c); const f = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), Arcade3D.std('#f9a8d4')); f.position.set(.15, .06, .1); g.add(f); return g; }); m.position.set(x0 + w / 2, -.17, Z); m.rotation.y = z; }
        else {
          /* tronco redondo com casca, anéis nas pontas e às vezes um rebento */
          const L = Math.round(w);
          const m = P.get('log' + L, () => {
            const g = new THREE.Group(), cyl = new THREE.CylinderGeometry(.3, .3, 1, 10); cyl.rotateZ(Math.PI / 2);
            const bark = new THREE.Mesh(cyl, Arcade3D.std('#8a5524', { roughness: .95, flatShading: true })); bark.scale.set(L - .02, 1, 1); bark.castShadow = bark.receiveShadow = true; g.add(bark);
            [-1, 1].forEach(sd => {
              const ring = new THREE.Mesh(new THREE.CircleGeometry(.29, 10), Arcade3D.std('#f2c98a', { roughness: .8 })); ring.position.x = sd * (L / 2 - .005); ring.rotation.y = sd * Math.PI / 2; g.add(ring);
              const core = new THREE.Mesh(new THREE.CircleGeometry(.12, 10), Arcade3D.std('#c98d4a')); core.position.x = sd * (L / 2 - .002); core.rotation.y = sd * Math.PI / 2; g.add(core);
            });
            for (let k2 = 0; k2 < L * 2 - 1; k2++) V.mk(g, -L / 2 + .45 + k2 * .5, .27, k2 % 2 ? .1 : -.12, .2, .05, .08, '#6b3f17', false);
            if (L > 2) { V.mk(g, .3, .36, .12, .06, .14, .06, '#16a34a', false); V.mk(g, .34, .44, .12, .18, .04, .14, '#22c55e', false); }
            return g;
          });
          m.position.set(x0 + w / 2, -.08, Z);
        }
      });
      if (t === 'road') row.objs.forEach(o => {
        const x0 = wx(o.x), w = o.w / CELL, key = 'car:' + o.hue + (o.truck ? 'T' : '');
        const m = P.get(key, () => carModel(V, o.hue, o.truck, o.truck ? 2.1 : .95));
        m.position.set(x0 + w / 2, 0, Z); m.rotation.y = row.dir > 0 ? 0 : Math.PI;
      });
      row.coins.forEach(c => { const m = P.get('coin', () => { const mm = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .06, 16), Arcade3D.std('#fcd34d', { metalness: .25, roughness: .35, emissive: '#f59e0b', emissiveIntensity: .45 })); mm.rotation.x = Math.PI / 2; mm.castShadow = true; const g = new THREE.Group(); g.add(mm); return g; }); m.position.set(c - 4, .45 + Math.sin(G.t * 4 + c) * .08, Z); m.rotation.y = G.t * 3 + c; });
    }
    /* personagem */
    const ch = P.get('char:' + G.ch.id, () => charModel(V, G.ch));
    const hopK = G.hop ? Math.min(1, G.hop.t / HOP) : 0, lift = G.hop ? Math.sin(hopK * Math.PI) * .45 : 0;
    const dead = G.dead;
    ch.visible = !(dead && dead.kind === 'water');
    ch.position.set(wx(G.px), lift + (G.rows[G.z] && G.rows[G.z].t === 'river' ? -.12 : 0), -zf);
    const face = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 }[G.dir || 'up'];
    ch.rotation.y = U.lerp(ch.rotation.y || Math.PI, face, .35);
    const body = ch.userData.body, sq = G.hop ? 1 + Math.sin(hopK * Math.PI) * .12 : 1;
    if (dead && (dead.kind === 'car' || dead.kind === 'train')) body.scale.set(1.5, .15, 1.3);
    else body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    if (G.bumpT) body.position.x = Math.sin(G.bumpT * 60) * .05; else body.position.x = 0;
    /* piscar os olhos */
    const blink = (G.t % 3.2) > 3.08 || !!(dead && dead.kind !== 'water'); (ch.userData.eyes || []).forEach(e => { e.scale.y = blink ? .15 : 1; });
    if (dead && dead.kind === 'water') {
      const sp = P.get('splash', () => new THREE.Mesh(new THREE.TorusGeometry(.4, .04, 6, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true })));
      const k = (api.t % 1); sp.position.set(wx(G.px), -.18, -G.z); sp.rotation.x = Math.PI / 2; sp.scale.setScalar(.6 + k * 1.6); sp.material.opacity = 1 - k;
    }
    P.end();
    /* câmara alta, inclinada, a seguir o avanço (com a mesma "pressão" do jogo 2D) */
    R.camZ = U.lerp(R.camZ, -(G.cam + 3.2), .15); R.camX = U.lerp(R.camX, wx(G.px) * .35, .08);
    const [shx, shy] = api.shakeXY;
    R.cam.position.set(R.camX + 3 + shx * .01, 13.5 + shy * .01, R.camZ + 8.2);
    R.cam.lookAt(R.camX + .35, 0, R.camZ - 3);
    Arcade3D.sunAt(R.sun, R.camX, 0, R.camZ - 2, 12, [.5, 1, .45]);
    R.renderer.render(R.scene, R.cam);
    /* aviso de ficar para trás + dica inicial (2D) */
    const lag = zf - G.cam;
    if (lag < 0 && !G.dead) { ctx.fillStyle = `rgba(0,0,0,${Math.min(.35, -lag * .25)})`; ctx.fillRect(0, H - 90, W, 90); }
    if (G.best === 0 && !G.dead) {
      ctx.font = '700 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(20,40,10,.55)'; U.rr(ctx, W / 2 - 170, H - 50, 340, 30, 15); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText('Toca para saltar em frente · desliza para os lados', W / 2, H - 30);
    }
  }

  function destroy(G) {
    const R = G.r3; if (!R) return;
    Arcade3D.disposeOwn(R.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    draw2D(G, ctx, W, H, api);
  }
  function draw2D(G, ctx, W, H, api) {
    const base = H - 120, rowY = z => base - (z - G.cam) * CELL;
    ctx.fillStyle = '#65a30d'; ctx.fillRect(0, 0, W, H);
    const lo = Math.max(0, Math.floor(G.cam) - 3), hi = Math.min(G.rows.length - 1, Math.ceil(G.cam + (H / CELL)) + 1);
    /* chão de cada fila, de trás para a frente */
    for (let z = hi; z >= lo; z--) {
      const row = G.rows[z], y = rowY(z) - CELL;
      if (row.t === 'grass') {
        ctx.fillStyle = row.shade ? '#84cc16' : '#7ac31a'; ctx.fillRect(0, y, W, CELL);
        /* flores e tufos (só decoração, não bloqueiam) */
        for (let i = 0; i < 3; i++) {
          const h = Math.sin(z * 91.7 + i * 37.3) * 43758.5, f = h - Math.floor(h), fx = 8 + f * (W - 16), fy = y + 10 + ((f * 7.3) % 1) * (CELL - 20);
          ctx.fillStyle = i % 2 ? 'rgba(21,128,61,.45)' : ['#fde047', '#f9a8d4', '#fff'][i % 3];
          if (i % 2) ctx.fillRect(fx, fy, 7, 3); else { ctx.fillRect(fx, fy, 4, 4); ctx.fillStyle = '#facc15'; ctx.fillRect(fx + 1, fy + 1, 2, 2); }
        }
      }
      else if (row.t === 'road') {
        ctx.fillStyle = '#374151'; ctx.fillRect(0, y, W, CELL);
        const nxt = G.rows[z + 1];
        if (nxt && nxt.t === 'road') { ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let x = 8; x < W; x += 40) ctx.fillRect(x, y - 1, 20, 3); }
      } else if (row.t === 'river') {
        ctx.fillStyle = '#38bdf8'; ctx.fillRect(0, y, W, CELL);
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
        for (let x = ((G.t * 30 * (row.dir || 1)) % 40 + 40) % 40 - 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, y + CELL * .5); ctx.quadraticCurveTo(x + 10, y + CELL * .4, x + 20, y + CELL * .5); ctx.stroke(); }
      } else if (row.t === 'rail') {
        ctx.fillStyle = '#a8a29e'; ctx.fillRect(0, y, W, CELL);
        ctx.fillStyle = '#78350f'; for (let x = 4; x < W; x += 22) ctx.fillRect(x, y + 8, 10, CELL - 16);
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, y + 13, W, 3); ctx.fillRect(0, y + CELL - 16, W, 3);
        const warn = !row.train && row.trainT < 1.3;
        ctx.fillStyle = '#1f2937'; ctx.fillRect(W - 16, y - 18, 4, 22);
        ctx.fillStyle = warn && Math.floor(G.t * 8) % 2 ? '#ef4444' : '#450a0a'; ctx.beginPath(); ctx.arc(W - 14, y - 20, 6, 0, 6.3); ctx.fill();
      }
    }
    /* margem de partida (atrás da fila 0): relva com arbustos e árvores */
    for (let z = -1; z >= Math.floor(G.cam) - 3; z--) {
      const y = rowY(z) - CELL;
      ctx.fillStyle = z % 2 ? '#7ac31a' : '#84cc16'; ctx.fillRect(0, y, W, CELL);
    }
    /* objetos e personagem, de trás para a frente (profundidade correta) */
    for (let z = hi; z >= lo; z--) {
      const row = G.rows[z], y = rowY(z);
      if (row.t === 'river') row.objs.forEach(o => {
        if (o.pad) { ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, y - CELL / 2, o.w / 2, CELL * .36, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, y - CELL / 2 - 3, o.w / 2 - 3, CELL * .3, 0, .3, 6); ctx.fill(); }
        else { box(ctx, o.x, y - CELL + 8, o.w, CELL - 16, 8, '#a16207', '#713f12'); ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(o.x + 8, y - CELL / 2 - 4, 4, 9, 0, 0, 6.3); ctx.stroke(); }
      });
      row.coins.forEach(c => { const x = colX(c), yy = y - CELL / 2 - 10 + Math.sin(G.t * 4 + c) * 3; ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.ellipse(x, yy, 8 * Math.abs(Math.cos(G.t * 3)) + 2, 9, 0, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#b45309'; ctx.lineWidth = 1.5; ctx.stroke(); });
      if (row.t === 'grass') row.block.forEach(c => {
        const x = X0 + c * CELL + 6;
        box(ctx, x + 10, y - 6, 12, 6, 16, '#92400e', '#78350f');
        box(ctx, x, y - 18, CELL - 12, CELL - 18, 26, '#16a34a', '#15803d');
        box(ctx, x + 5, y - 38, CELL - 22, CELL - 26, 14, '#22c55e', '#16a34a');
      });
      if (row.t === 'road') row.objs.forEach(o => {
        const top = `hsl(${o.hue},70%,58%)`, fr = `hsl(${o.hue},70%,40%)`, fwd = row.dir > 0;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(o.x + 3, y - 10, o.w, 8);
        /* rodas por baixo da carroçaria */
        ctx.fillStyle = '#111827'; [o.x + 5, o.x + o.w - 15].forEach(wx => ctx.fillRect(wx, y - 11, 10, 7));
        if (o.truck) {
          /* camião: cabina à frente (no sentido da marcha) + caixa branca atrás */
          const cw = CELL * .72, cx = fwd ? o.x + o.w - cw : o.x;
          box(ctx, fwd ? o.x : o.x + cw + 2, y - 8, o.w - cw - 2, CELL - 20, 26, '#f8fafc', '#cbd5e1');
          ctx.fillStyle = 'rgba(100,116,139,.35)'; ctx.fillRect((fwd ? o.x : o.x + cw + 2) + 6, y - 22, o.w - cw - 14, 3);
          box(ctx, cx, y - 8, cw, CELL - 20, 18, top, fr);
          ctx.fillStyle = '#1e3a5f'; ctx.fillRect(fwd ? cx + cw - 12 : cx + 3, y - 20, 9, 7);
        } else {
          box(ctx, o.x, y - 8, o.w, CELL - 20, 12, top, fr);
          /* cabina com vidros escuros, mais clara no tejadilho */
          const cx = o.x + o.w * .2, cw = o.w * .6;
          box(ctx, cx, y - 20, cw, CELL - 26, 10, `hsl(${o.hue},60%,72%)`, '#1e3a5f');
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(cx + 3, y - 18, cw * .3, 2);
        }
        /* faróis à frente, farolins atrás */
        ctx.fillStyle = '#fef08a'; ctx.fillRect(fwd ? o.x + o.w - 3 : o.x, y - 16, 3, 4);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(fwd ? o.x : o.x + o.w - 3, y - 16, 3, 4);
      });
      if (row.t === 'rail' && row.train) {
        const tr = row.train;
        box(ctx, tr.x, y - 8, tr.w, CELL - 18, 22, '#dc2626', '#991b1b');
        ctx.fillStyle = '#fef9c3'; for (let x = tr.x + 14; x < tr.x + tr.w - 14; x += 34) ctx.fillRect(x, y - 26, 18, 8);
      }
      /* personagem nesta fila */
      if (Math.round(G.zf || G.z) === z || (G.dead && G.z === z)) drawChar(G, ctx, y, api);
    }
    for (let z = -1; z >= Math.floor(G.cam) - 3; z--) {
      const y = rowY(z);
      for (let c = 0; c < COLS; c++) {
        const hh = Math.sin(z * 12.9898 + c * 78.233) * 43758.5; if (hh - Math.floor(hh) > (z === -1 ? .25 : .45)) continue;
        const x = X0 + c * CELL + 6;
        if (z === -1) { box(ctx, x + 6, y - 14, CELL - 24, 10, 10, '#22c55e', '#15803d'); continue; }   /* arbustos baixos: não tapam a personagem */
        box(ctx, x + 10, y - 6, 12, 6, 16, '#92400e', '#78350f');
        box(ctx, x, y - 18, CELL - 12, CELL - 18, 26, '#16a34a', '#15803d');
        box(ctx, x + 5, y - 38, CELL - 22, CELL - 26, 14, '#22c55e', '#16a34a');
      }
    }
    /* sombra da câmara a empurrar (aviso) */
    const lag = (G.zf || G.z) - G.cam;
    if (lag < 0 && !G.dead) { ctx.fillStyle = `rgba(0,0,0,${Math.min(.35, -lag * .25)})`; ctx.fillRect(0, H - 90, W, 90); }
    if (G.best === 0 && !G.dead) {
      ctx.font = '700 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(20,40,10,.55)'; U.rr(ctx, W / 2 - 170, H - 50, 340, 30, 15); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText('Toca para saltar em frente · desliza para os lados', W / 2, H - 30);
    }
  }

  function drawChar(G, ctx, rowBase, api) {
    const c = G.ch, hopK = G.hop ? Math.min(1, G.hop.t / HOP) : 0;
    const lift = G.hop ? Math.sin(hopK * Math.PI) * 14 : 0;
    const x = G.px, y = rowBase - CELL / 2 + 8 - (G.hop ? ((G.zf || G.z) - Math.round(G.zf || G.z)) * CELL : 0);
    if (G.dead && G.dead.kind === 'water') { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; const r = 8 + (api.t % 1) * 16; ctx.beginPath(); ctx.ellipse(x, y, r, r * .45, 0, 0, 6.3); ctx.stroke(); return; }
    const flat = G.dead && (G.dead.kind === 'car' || G.dead.kind === 'train');
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 13, 5, 0, 0, 6.3); ctx.fill();
    ctx.save(); ctx.translate(x + (G.bumpT ? Math.sin(G.bumpT * 60) * 2 : 0), y - lift);
    if (flat) ctx.scale(1.5, .25);
    const s = G.hop ? 1 + Math.sin(hopK * Math.PI) * .08 : 1;
    ctx.scale(G.face < 0 ? -s : s, 2 - s);
    box(ctx, -12, 0, 24, 12, 16, c.body, c.dark);
    if (c.id === 'bunny') { box(ctx, -8, -16, 5, 4, 12, c.body, c.dark); box(ctx, 3, -16, 5, 4, 12, c.body, c.dark); ctx.fillStyle = c.acc; ctx.fillRect(-7, -26, 3, 8); ctx.fillRect(4, -26, 3, 8); }
    if (c.id === 'fox') { ctx.fillStyle = c.dark; ctx.beginPath(); ctx.moveTo(-10, -16); ctx.lineTo(-6, -24); ctx.lineTo(-2, -16); ctx.moveTo(2, -16); ctx.lineTo(6, -24); ctx.lineTo(10, -16); ctx.fill(); ctx.fillStyle = c.acc; ctx.fillRect(-12, -6, 8, 6); }
    if (c.id === 'penguin') { ctx.fillStyle = '#f8fafc'; ctx.fillRect(-7, -12, 14, 12); ctx.fillStyle = c.acc; ctx.fillRect(10, -10, 5, 3); }
    if (c.id === 'frog') { ctx.fillStyle = c.acc; ctx.fillRect(-10, -4, 20, 4); }
    ctx.fillStyle = '#fff'; ctx.fillRect(2, -14, 6, 6); ctx.fillStyle = '#111'; ctx.fillRect(5, -12, 3, 3);
    if (c.id === 'frog') { ctx.fillStyle = '#fff'; ctx.fillRect(-8, -14, 6, 6); ctx.fillStyle = '#111'; ctx.fillRect(-5, -12, 3, 3); }
    ctx.restore();
  }

  /* toque: tocar = em frente; deslizar = direção. Rato: clique = em frente,
     clique nas faixas laterais = lados, arrastar = direção. */
  function down(G, x, y, api, e) { G.sw = { x, y, done: false, mouse: e.pointerType === 'mouse' }; }
  function move(G, x, y, api, e, isDown) {
    if (!isDown || !G.sw || G.sw.done) return;
    const dx = x - G.sw.x, dy = y - G.sw.y;
    if (Math.hypot(dx, dy) > 24) { G.sw.done = true; if (Math.abs(dx) > Math.abs(dy)) tryMove(G, api, dx > 0 ? 1 : -1, 0); else tryMove(G, api, 0, dy < 0 ? 1 : -1); }
  }
  function up(G, x, y, api) {
    const s = G.sw; G.sw = null;
    if (!s || s.done) return;
    if (s.mouse && x < api.W * .2) tryMove(G, api, -1, 0);
    else if (s.mouse && x > api.W * .8) tryMove(G, api, 1, 0);
    else tryMove(G, api, 0, 1);
  }

  const game = ArcadeKit.create({
    id: 'crossy-road', title: 'Travessia', icon: '🐸',
    accent: '#84cc16', accent2: '#38bdf8', bg: '#65a30d', transparent: true, destroy,
    tagline: 'Atravessa estradas, rios e linhas de comboio sem fim. Não te deixes ficar para trás.',
    view: { w: 400 },
    how: [
      '<b>Toque:</b> toca para saltar em frente; desliza para a esquerda, direita ou para trás. <b>Rato:</b> clica para a frente, clica nas margens para os lados, ou arrasta. Setas também.',
      'Foge aos carros e aos comboios (o sinal pisca antes de passar). No rio só podes pisar troncos e nenúfares — e a corrente leva-te.',
      'A câmara avança sozinha: se ficares para trás, acabou. Apanha moedas para desbloquear personagens.',
    ],
    controls: ['🖱️ Clique / arrastar', '👆 Tocar / deslizar', '⌨️ Setas'],
    ready: { title: 'Toca para começar', hint: 'Cada toque é um salto em frente.' },
    menuHTML: () => {
      const coins = store().getPref('coins', 0), cur = store().getPref('char', 'frog');
      return `<div class="ak-h3" style="margin-top:4px">Personagem · 🪙 ${coins}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px">${CHARS.map(c => {
          const own = coins >= c.cost, on = c.id === cur;
          return `<button type="button" class="ak-chip${on ? ' on' : ''}" data-char="${c.id}" ${own ? '' : 'disabled'} style="flex-direction:column;justify-content:center;padding:8px 4px;border-radius:12px;${own ? '' : 'opacity:.45;cursor:not-allowed'}">
            <span style="width:22px;height:18px;border-radius:4px;background:${c.body};box-shadow:inset 0 -5px 0 ${c.dark};display:block"></span>
            <span style="font-size:.74rem">${c.name}</span><small style="font-size:.64rem;opacity:.75">${own ? (on ? 'escolhido' : 'livre') : '🪙 ' + c.cost}</small></button>`; }).join('')}</div>`;
    },
    menuWire: (el, rerender) => el.querySelectorAll('[data-char]:not([disabled])').forEach(b => b.addEventListener('click', () => { store().setPref('char', b.dataset.char); rerender(); })),
    setup, update, draw, down, move, up,
    key: (G, e, api) => {
      const m = { ArrowUp: [0, 1], w: [0, 1], ArrowDown: [0, -1], s: [0, -1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ' ': [0, 1] }[e.key];
      if (m) { tryMove(G, api, m[0], m[1]); return true; }
    },
    hud: G => [['Casas', G.best], ['🪙', G.coins]],
    achievements: [
      { id: 'cr.50',  name: 'Atravessador',   icon: '🐸', desc: 'Avança 50 casas na Travessia.', test: c => ((c.result.meta || {}).best || 0) >= 50 },
      { id: 'cr.150', name: 'Rei da Estrada', icon: '🛣️', desc: 'Avança 150 casas na Travessia.', test: c => ((c.result.meta || {}).best || 0) >= 150 },
      { id: 'cr.fox', name: 'Coleção Completa', icon: '🦊', desc: 'Junta moedas para desbloquear a raposa.', test: c => ((c.result.meta || {}).coins || 0) >= 250 },
    ],
  });
  return game;
})();
