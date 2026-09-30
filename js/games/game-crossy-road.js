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
  function tree(V, tall) {
    const g = new THREE.Group();
    V.mk(g, 0, .35, 0, .28, .7, .28, '#92400e');
    V.mk(g, 0, .95, 0, .78, .6, .78, '#16a34a');
    if (tall) V.mk(g, 0, 1.45, 0, .56, .5, .56, '#22c55e');
    return g;
  }
  function carModel(V, hue, truck, len) {
    const g = new THREE.Group(), body = `hsl(${hue},72%,52%)`, dark = `hsl(${hue},70%,36%)`;
    if (truck) {
      V.mk(g, -len / 2 + .5, .62, 0, .9, .76, .72, body);
      V.mk(g, -len / 2 + .55, .78, 0, .6, .3, .74, '#1e3a5f', false);
      V.mk(g, .45, .78, 0, len - 1.05, 1.1, .78, '#f1f5f9');
      V.mk(g, .45, 1.34, 0, len - 1.05, .04, .8, '#cbd5e1', false);
    } else {
      V.mk(g, 0, .42, 0, len, .42, .72, body);
      V.mk(g, .05, .78, 0, len * .55, .34, .64, dark);
      V.mk(g, .05, .8, 0, len * .56, .22, .66, '#1e3a5f', false);
    }
    const wheel = x => { V.mk(g, x, .18, .34, .26, .26, .08, '#111827', false); V.mk(g, x, .18, -.34, .26, .26, .08, '#111827', false); };
    wheel(len / 2 - .28); wheel(-len / 2 + .28); if (truck) wheel(0);
    const hl = new THREE.Mesh(V.B, Arcade3D.glowMat('#fef08a')); hl.position.set(len / 2 + .01, .48, 0); hl.scale.set(.03, .1, .5); g.add(hl);
    const tl = new THREE.Mesh(V.B, Arcade3D.glowMat('#ef4444')); tl.position.set(-len / 2 - .01, .48, 0); tl.scale.set(.03, .1, .5); g.add(tl);
    return g;
  }
  function charModel(V, ch) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const b = V.mk(body, 0, .3, 0, .5, .5, .5, ch.body);
    if (ch.id === 'frog') { V.mk(body, 0, .12, 0, .56, .12, .56, ch.dark); V.mk(body, 0, .56, .02, .5, .06, .02, ch.acc); ['-', '+'].forEach(sd => { const x = sd === '-' ? -.14 : .14; V.mk(body, x, .6, -.12, .14, .14, .14, '#fff'); V.mk(body, x, .62, -.19, .07, .07, .03, '#111'); }); }
    if (ch.id === 'bunny') { [-.12, .12].forEach(x => { V.mk(body, x, .78, .05, .1, .42, .1, ch.body); V.mk(body, x, .8, .0, .05, .3, .02, ch.acc); }); [-.12, .12].forEach(x => V.mk(body, x, .42, -.26, .06, .06, .02, '#111')); V.mk(body, 0, .34, -.26, .06, .05, .02, ch.acc); }
    if (ch.id === 'penguin') { V.mk(body, 0, .28, -.2, .34, .38, .12, '#f8fafc'); V.mk(body, 0, .38, -.3, .12, .06, .12, ch.acc); [-.12, .12].forEach(x => V.mk(body, x, .48, -.26, .06, .06, .02, '#fff')); V.mk(body, 0, .03, -.1, .4, .06, .2, ch.acc); }
    if (ch.id === 'fox') { [-.15, .15].forEach(x => V.mk(body, x, .64, .05, .14, .2, .1, ch.dark)); V.mk(body, 0, .22, -.3, .26, .18, .14, ch.acc); V.mk(body, 0, .3, .36, .18, .18, .3, ch.body); V.mk(body, 0, .3, .52, .12, .12, .06, ch.acc); [-.12, .12].forEach(x => V.mk(body, x, .44, -.26, .06, .06, .02, '#111')); }
    g.userData.body = body; b.userData.main = true;
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
      const top = t === 'grass' ? ((row ? row.shade : z & 1) ? '#84cc16' : '#7ac31a') : t === 'road' ? '#3f4652' : t === 'river' ? '#38bdf8' : '#a8a29e';
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
          for (let k = 0; k < len; k += 3) {
            const car = P.get('wagon', () => { const g = new THREE.Group(); V.mk(g, 0, .7, 0, 2.9, 1.1, .8, '#dc2626'); V.mk(g, 0, 1.3, 0, 2.95, .1, .84, '#991b1b', false); for (let w = -1; w <= 1; w++) { const m = new THREE.Mesh(V.B, Arcade3D.glowMat('#fef9c3')); m.position.set(w * .9, .85, .41); m.scale.set(.5, .3, .02); g.add(m); } return g; });
            car.position.set(x0 + k + 1.5, 0, Z);
          }
        }
      }
      /* árvores fora da área de jogo (fecham o mundo, como no original) */
      if (t === 'grass' || z < 0) {
        for (let k = 0; k < 3; k++) {
          const hsh = Math.sin(z * 12.9898 + k * 78.233) * 43758.5, f = hsh - Math.floor(hsh);
          [-1, 1].forEach(sd => { const tr = P.get(f > .5 ? 'treeT' : 'tree', () => tree(V, f > .5)); tr.position.set(sd * (5.1 + k * 1.3 + f * .4), 0, Z); });
        }
      }
      if (z < 0) {
        for (let c = 0; c < 9; c++) { const hh = Math.sin(z * 31.1 + c * 17.7) * 9999, f = hh - Math.floor(hh); if (f > (z === -1 ? .18 : .4)) continue; const tr = P.get(z === -1 ? 'bush' : 'tree', () => z === -1 ? (() => { const g = new THREE.Group(); V.mk(g, 0, .2, 0, .6, .4, .6, '#22c55e'); return g; })() : tree(V, false)); tr.position.set(c - 4, 0, Z); }
      }
      if (!row) continue;
      if (t === 'grass') {
        row.block.forEach(c => { const tr = P.get((c + z) % 3 ? 'tree' : 'treeT', () => tree(V, !((c + z) % 3))); tr.position.set(c - 4, 0, Z); });
        for (let i = 0; i < 3; i++) { const h = Math.sin(z * 91.7 + i * 37.3) * 43758.5, f = h - Math.floor(h); const fl = P.get('flower' + (i % 3), () => new THREE.Mesh(V.B, Arcade3D.std(['#fde047', '#f9a8d4', '#ffffff'][i % 3]))); fl.position.set(-4.3 + f * 8.6, .03, Z - .3 + ((f * 7.3) % 1) * .6); fl.scale.set(.1, .06, .1); }
      }
      if (t === 'river') row.objs.forEach(o => {
        const x0 = wx(o.x), w = o.w / CELL;
        if (o.pad) { const m = P.get('pad', () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .06, 18), Arcade3D.std('#16a34a')); c.receiveShadow = true; g.add(c); const f = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), Arcade3D.std('#f9a8d4')); f.position.set(.15, .06, .1); g.add(f); return g; }); m.position.set(x0 + w / 2, -.17, Z); m.rotation.y = z; }
        else { const m = P.get('log', () => { const g = new THREE.Group(); const l = V.mk(g, 0, 0, 0, 1, .34, .66, '#a16207'); g.userData.l = l; const e = V.mk(g, .5, 0, 0, .02, .28, .58, '#fde68a', false); g.userData.e = e; return g; }); m.position.set(x0 + w / 2, -.12, Z); m.userData.l.scale.x = w; m.userData.e.position.x = w / 2; }
      });
      if (t === 'road') row.objs.forEach(o => {
        const x0 = wx(o.x), w = o.w / CELL, key = 'car:' + o.hue + (o.truck ? 'T' : '');
        const m = P.get(key, () => carModel(V, o.hue, o.truck, o.truck ? 2.1 : .95));
        m.position.set(x0 + w / 2, 0, Z); m.rotation.y = row.dir > 0 ? 0 : Math.PI;
      });
      row.coins.forEach(c => { const m = P.get('coin', () => { const mm = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .06, 16), Arcade3D.std('#fbbf24', { metalness: .8, roughness: .25, emissive: '#b45309', emissiveIntensity: .35 })); mm.rotation.x = Math.PI / 2; mm.castShadow = true; const g = new THREE.Group(); g.add(mm); return g; }); m.position.set(c - 4, .45 + Math.sin(G.t * 4 + c) * .08, Z); m.rotation.y = G.t * 3 + c; });
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
