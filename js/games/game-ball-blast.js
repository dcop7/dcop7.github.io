/* ══════════════════════════════════════════════════════════════════
   Rajada (Ball Blast) — apontas, disparas TODAS as bolas em rajada e
   elas ressaltam pelos blocos numerados (cada toque tira 1). No fim de
   cada jogada os blocos descem uma fila e aparece outra em cima, com
   números cada vez maiores. Anéis +1 dão mais bolas; ↔ e ↕ dão um raio
   a toda a linha/coluna. Perdes quando um bloco chega ao fundo (há uma
   segunda oportunidade por partida). A primeira bola a cair marca o
   ponto de lançamento seguinte.
   Grelha 7×9 que se ajusta ao palco; física em sub-passos (bola–caixa,
   eixo pela menor penetração) com procura só nas casas vizinhas.
   3D como o Parte-Tijolos (câmara a pique: o plano z=0 é o ecrã lógico,
   por isso o rato e o toque batem certo), com desenho 2D de reserva.
══════════════════════════════════════════════════════════════════ */
const BallBlastGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const COLS = 7, ROWS = 9, BR = 6, SPD = 820;
  /* k = blocos por fila (o máximo sobe 1 a cada `up` níveis); dbl = hipótese de
     um bloco valer o dobro a partir do nível dblAt. Afinado com bots (out/2026). */
  const DIFF = {
    easy:   { k: [1, 3], up: 25, kMax: 4, dbl: .05, dblAt: 25, las: .14, guide: 2 },
    medium: { k: [1, 3], up: 14, kMax: 5, dbl: .12, dblAt: 12, las: .12, guide: 1 },
    hard:   { k: [2, 4], up: 12, kMax: 6, dbl: .25, dblAt: 6,  las: .1,  guide: 0 },
  };
  const ease = t => 1 - Math.pow(1 - t, 3);
  const back = t => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  /* geometria da grelha (recalculada a cada frame: o palco pode mudar de tamanho) */
  function lay(G, api) {
    const W = api.W, H = api.H, top = 68, bottom = 78;
    const C = Math.min((W - 16) / COLS, (H - top - bottom) / ROWS);
    const gx = (W - C * COLS) / 2, gy = top;
    return (G.L = { C, gx, gy, LY: gy + C * ROWS, W, H, pad: C * .055 });
  }
  function rectOf(G, b) { const L = G.L, p = L.pad; return { x: L.gx + b.c * L.C + p, y: L.gy + (b.r + (b.ay || 0)) * L.C + p, w: L.C - p * 2 }; }
  const cellC = (G, b) => { const L = G.L; return [L.gx + (b.c + .5) * L.C, L.gy + (b.r + (b.ay || 0) + .5) * L.C]; };
  function colorOf(G, hp) { const t = U.clamp(hp / Math.max(4, G.turn * 1.5), 0, 1); return `hsl(${Math.round(185 + t * 175) % 360}, 78%, ${Math.round(58 - t * 6)}%)`; }

  function spawnRow(G) {
    const c = G.cfg, free = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - .5);
    const k1 = Math.min(c.kMax, c.k[1] + Math.floor(G.turn / c.up)), k = U.randi(c.k[0], k1);
    for (let i = 0; i < k; i++) {
      const hp = G.turn >= c.dblAt && Math.random() < c.dbl ? G.turn * 2 : G.turn;
      G.blocks.push({ id: ++G.uid, t: 'b', c: free.pop(), r: 1, hp, max: hp, hit: 0, wob: 0, ay: -1, fresh: true });
    }
    G.blocks.push({ id: ++G.uid, t: 'plus', c: free.pop(), r: 1, ay: -1, fresh: true });
    if (free.length && G.turn > 4 && Math.random() < c.las) G.blocks.push({ id: ++G.uid, t: Math.random() < .5 ? 'lh' : 'lv', c: free.pop(), r: 1, ay: -1, fresh: true });
  }

  function setup(api, o) {
    const cfg = DIFF[o.diff] || DIFF.medium;
    const G = { cfg, turn: 1, nb: 1, gain: 0, blocks: [], balls: [], phase: 'move', lx: api.W / 2, nextX: null, aim: null, t: 0, broken: 0,
      shards: [], rings: [], beams: [], adv: { t: 0, d: .55 }, uid: 0, used2nd: false, fireT: 0, homeT: 0, sk: 1, sndT: 0 };
    lay(G, api);
    G.lx = G.L.W / 2;
    spawnRow(G);
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build3D(G, api); } catch (e) { console.warn('[rajada] 3D falhou', e); } }).catch(() => {});
    return G;
  }

  /* ── pontaria ── */
  const clampAng = a => U.clamp(a, -Math.PI + .14, -.14);
  function aimAt(G, x, y) { const dy = y - (G.L.LY - BR); if (dy > -14) return null; return clampAng(Math.atan2(dy, x - G.lx)); }
  /* toque: arrastar para trás (fisga) ou para a frente — a mira aponta sempre para cima */
  function aimDrag(dx, dy) { if (Math.hypot(dx, dy) < 16) return null; if (dy > 0) { dx = -dx; dy = -dy; } if (dy > -4) return null; return clampAng(Math.atan2(dy, dx)); }
  function fire(G, api, ang) {
    G.phase = 'fire'; G.ang = ang; G.fired = 0; G.fireT = 0; G.launchT = 0; G.homeT = 0; G.nextX = null; G.aim = null; G.balls = []; G.sk = 1;
    api.sfx.tone(420, .08, 'triangle', .06, 0, 760);
  }
  /* recolher: as bolas no ar voltam já (útil quando ficam a ressaltar muito tempo) */
  function recall(G, api) {
    G.fired = G.nb;
    if (G.nextX == null) G.nextX = G.lx;
    G.balls.forEach(b => { if (!b.done) { b.done = true; b.fly = true; b.home = 0; b.hx0 = b.x; b.hy0 = b.y; } });
    api.sfx.tone(700, .12, 'sine', .05, 0, 300);
  }
  const recallBtn = G => ({ x: G.L.W - 62, y: G.L.LY + 20, w: 54, h: 36 });

  /* ── dano e efeitos ── */
  function damage(G, api, b) {
    if (b.dead) return;
    b.hp--; b.hit = .1; b.wob = 1;
    if (G.sndT <= 0) { api.sfx.tone(480 + Math.min(b.hp, 50) * 9, .03, 'square', .018); G.sndT = .035; }
    if (b.hp > 0) return;
    b.dead = true; G.broken++;
    const [cx, cy] = cellC(G, b), col = colorOf(G, b.max);
    for (let i = 0; i < 9; i++) G.shards.push({ x: cx + U.rand(-G.L.C * .3, G.L.C * .3), y: cy + U.rand(-G.L.C * .3, G.L.C * .3), z: G.L.C * .3, vx: U.rand(-190, 190), vy: U.rand(-190, 190), vz: U.rand(160, 440), s: U.rand(4, 8.5), rx: U.rand(0, 6), ry: U.rand(0, 6), wx: U.rand(-14, 14), wy: U.rand(-14, 14), col, life: U.rand(.7, 1.1) });
    if (G.shards.length > 300) G.shards.splice(0, G.shards.length - 300);
    G.rings.push({ x: cx, y: cy, col, r0: 6, r1: G.L.C * .9, d: .34, t: 0 });
    for (let i = 0; i < 6; i++) api.spark({ x: cx, y: cy, vx: U.rand(-160, 160), vy: U.rand(-160, 160), color: col, size: U.rand(1.5, 3.2), life: .45, gravity: 260 });
    api.sfx.tone(880 + U.rand(-60, 60), .07, 'sine', .05); api.shake(2.5, .12);
  }
  function laser(G, api, it) {
    it.used = true;
    G.blocks.filter(o => o.t === 'b' && !o.dead && (it.t === 'lh' ? o.r === it.r : o.c === it.c)).forEach(o => damage(G, api, o));
    G.beams.push({ k: it.t, c: it.c, r: it.r, t: .24, d: .24 });
    api.sfx.noise(.14, .06, 0, 3000, 'highpass'); api.sfx.tone(1500, .1, 'sawtooth', .025, 0, 600);
  }
  function fx(G, dt) {
    G.sndT -= dt;
    for (let i = G.shards.length - 1; i >= 0; i--) {
      const s = G.shards[i]; s.life -= dt; if (s.life <= 0) { G.shards.splice(i, 1); continue; }
      s.vz -= 1150 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.rx += s.wx * dt; s.ry += s.wy * dt;
      if (s.z < s.s / 2) { s.z = s.s / 2; s.vz = Math.abs(s.vz) * .3; s.vx *= .6; s.vy *= .6; s.wx *= .6; s.wy *= .6; }
    }
    for (let i = G.rings.length - 1; i >= 0; i--) { const r = G.rings[i]; r.t += dt; if (r.t >= r.d) G.rings.splice(i, 1); }
    for (let i = G.beams.length - 1; i >= 0; i--) { const b = G.beams[i]; b.t -= dt; if (b.t <= 0) G.beams.splice(i, 1); }
    G.blocks.forEach(b => { if (b.hit > 0) b.hit -= dt; if (b.wob > 0) b.wob = Math.max(0, b.wob - dt * 3.4); });
    if (G.pop) { G.pop.t -= dt; if (G.pop.t <= 0) G.pop = null; }
  }

  /* ── fim da jogada: os blocos descem ── */
  function advance(G, api) {
    G.turn++;
    if (G.gain) { G.nb += G.gain; G.pop = { txt: '+' + G.gain + (G.gain > 1 ? ' bolas' : ' bola'), t: 1.2 }; G.gain = 0; }
    G.blocks = G.blocks.filter(b => !b.used);
    G.blocks.forEach(b => { b.r++; b.ay = -1; b.fresh = false; });
    /* anéis que chegam ao fundo contam na mesma; raios que lá chegam somem */
    G.blocks = G.blocks.filter(b => { if (b.t !== 'b' && b.r >= ROWS - 1) { if (b.t === 'plus') { G.nb++; G.pop = { txt: '+1 bola', t: 1 }; } return false; } return true; });
    spawnRow(G);
    G.lx = G.nextX != null ? G.nextX : G.lx; G.nextX = null; G.balls = [];
    G.adv = { t: 0, d: .32 };
    G.phase = 'move';
    if (G.turn % 10 === 0) { api.banner('Nível ' + G.turn, G.nb + ' bolas'); api.sfx.arp([523, 659, 784], .06, .1, 'triangle', .06); }
  }
  function afterAdvance(G, api) {
    G.blocks.forEach(b => { b.ay = 0; });
    if (G.blocks.some(b => b.t === 'b' && b.r >= ROWS - 1)) { lost(G, api); return; }
    G.phase = 'aim';
    if (G.blocks.some(b => b.t === 'b' && b.r >= ROWS - 2)) api.sfx.tone(220, .15, 'triangle', .05);
  }
  function lost(G, api) {
    G.phase = 'over';
    api.shake(10, .4); api.flash('#ef4444', .15); api.vibe([60, 40, 90]);
    if (!G.used2nd) {
      api.panel({ icon: '💥', title: 'Os blocos chegaram ao fundo', sub: `Nível ${G.turn} · ${G.nb} bolas. Tens uma segunda oportunidade por partida.`,
        buttons: [
          { label: '💣 Rebentar 3 filas e continuar', primary: true, fn: () => {
            G.used2nd = true; api.resume();
            G.blocks.filter(b => b.r >= ROWS - 4).forEach(b => { if (b.t === 'b') { b.hp = 1; damage(G, api, b); } else b.used = true; });
            G.blocks = G.blocks.filter(b => !b.dead && !b.used);
            api.shake(12, .5); api.flash('#fb923c', .15); api.sfx.noise(.5, .16, 0, 300, 'lowpass');
            G.phase = 'aim';
          } },
          { label: 'Terminar', fn: () => finish(G, api) },
        ] });
      return;
    }
    finish(G, api);
  }
  function finish(G, api) {
    api.over({ score: G.turn, won: false, delay: G.used2nd ? 500 : 0, title: 'Fim da rajada', icon: '🟣',
      stats: [['Nível', G.turn], ['Bolas', G.nb], ['Blocos', G.broken]], meta: { turn: G.turn, balls: G.nb } });
  }

  function update(G, dt, api) {
    const L = lay(G, api);
    G.t += dt;
    fx(G, dt);
    if (G.adv) {
      G.adv.t += dt;
      const k = Math.min(1, G.adv.t / G.adv.d), e = back(k);
      G.blocks.forEach(b => { b.ay = -(1 - e); });
      if (k >= 1) { G.adv = null; afterAdvance(G, api); }
      return;
    }
    if (G.phase !== 'fire') return;
    G.fireT += dt;
    /* rajadas compridas aceleram sozinhas (2× aos 6 s, 3× aos 14 s) */
    const sk = G.fireT > 14 ? 3 : G.fireT > 6 ? 2 : 1;
    if (sk !== G.sk) { G.sk = sk; api.float(L.W / 2, L.LY - 30, '⏩ ' + sk + '×', '#c4b5fd', 16); }
    const sdt = dt * sk;
    G.launchT -= sdt;
    while (G.fired < G.nb && G.launchT <= 0) {
      G.balls.push({ x: G.lx, y: L.LY - BR, vx: Math.cos(G.ang) * SPD, vy: Math.sin(G.ang) * SPD, done: false, trail: [], hl: null });
      G.fired++; G.launchT += .07;
    }
    moveBalls(G, api, sdt, L);
    G.blocks = G.blocks.filter(b => !b.dead);
    if (G.fired >= G.nb && G.balls.every(b => b.done && b.home >= 1)) { G.homeT += dt; if (G.homeT > .12) advance(G, api); }
  }

  function moveBalls(G, api, dt, L) {
    /* grelha de casas → bloco, para cada bola só ver as 9 casas à volta */
    const grid = {};
    G.blocks.forEach(b => { if (!b.dead) grid[b.c + b.r * 8] = b; });
    const xl = L.gx + BR, xr = L.gx + COLS * L.C - BR, yt = L.gy + BR, fl = L.LY - BR;
    const sub = Math.ceil(4 * G.sk), h = dt / sub, ir = L.C * .36;
    for (const b of G.balls) {
      if (b.done) {
        if (b.home < 1) {
          b.home = Math.min(1, b.home + dt * (b.fly ? 3.2 : 5)); const e = ease(b.home);
          b.x = U.lerp(b.hx0, G.nextX, e); b.y = b.fly ? U.lerp(b.hy0, fl, e) : fl;
        }
        continue;
      }
      for (let k = 0; k < sub && !b.done; k++) {
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < xl) { b.x = xl; b.vx = Math.abs(b.vx); }
        if (b.x > xr) { b.x = xr; b.vx = -Math.abs(b.vx); }
        if (b.y < yt) { b.y = yt; b.vy = Math.abs(b.vy); }
        if (b.vy > 0 && b.y >= fl) {
          b.y = fl; b.done = true; b.home = 0; b.hx0 = b.x;
          if (G.nextX == null) { G.nextX = U.clamp(b.x, xl + 2, xr - 2); b.home = 1; b.x = G.nextX; }
          break;
        }
        const cc = Math.floor((b.x - L.gx) / L.C), cr = Math.floor((b.y - L.gy) / L.C);
        let best = null, bp = Infinity;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const c = cc + dc, r = cr + dr; if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
          const o = grid[c + r * 8]; if (!o || o.dead) continue;
          if (o.t === 'b') {
            const R = rectOf(G, o), px = U.clamp(b.x, R.x, R.x + R.w), py = U.clamp(b.y, R.y, R.y + R.w), d = Math.hypot(b.x - px, b.y - py);
            if (d < BR && d < bp) { bp = d; best = { o, R }; }
          } else {
            const [ix, iy] = cellC(G, o);
            if (Math.hypot(b.x - ix, b.y - iy) < ir + BR) {
              if (o.t === 'plus') { o.dead = true; G.gain++; api.sfx.tone(1180, .06, 'sine', .06); api.sfx.tone(1570, .08, 'sine', .04, .05); G.rings.push({ x: ix, y: iy, col: '#4ade80', r0: 8, r1: L.C * .8, d: .3, t: 0 }); api.float(ix, iy, '+1', '#86efac', 16); }
              else if (!(b.hl && b.hl.has(o.id))) { (b.hl = b.hl || new Set()).add(o.id); laser(G, api, o); }
            }
          }
        }
        if (best) {
          const { o, R } = best;
          const ox = Math.min(b.x + BR - R.x, R.x + R.w - (b.x - BR)), oy = Math.min(b.y + BR - R.y, R.y + R.w - (b.y - BR));
          if (ox < oy) { b.vx = b.x < R.x + R.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); b.x += b.vx > 0 ? ox : -ox; }
          else { b.vy = b.y < R.y + R.w / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); b.y += b.vy > 0 ? oy : -oy; }
          damage(G, api, o);
          if (o.dead) delete grid[o.c + o.r * 8];
        }
      }
      /* nunca fica a ressaltar na horizontal para sempre */
      if (!b.done && Math.abs(b.vy) < SPD * .1) { b.vy = (b.vy < 0 ? -1 : 1) * SPD * .1; b.vx = Math.sign(b.vx || 1) * Math.sqrt(SPD * SPD - b.vy * b.vy); }
      b.trail.unshift([b.x, b.y]); if (b.trail.length > 4) b.trail.pop();
    }
  }

  /* linha de mira: até ao primeiro choque (paredes ou blocos) e o ressalto */
  function rayHit(G, x, y, dx, dy) {
    const L = G.L; let best = { t: Infinity, nx: 0, ny: 0 };
    const xl = L.gx + BR, xr = L.gx + COLS * L.C - BR, yt = L.gy + BR;
    if (dx < 0) { const t = (xl - x) / dx; if (t < best.t) best = { t, nx: 1, ny: 0 }; }
    if (dx > 0) { const t = (xr - x) / dx; if (t < best.t) best = { t, nx: -1, ny: 0 }; }
    if (dy < 0) { const t = (yt - y) / dy; if (t < best.t) best = { t, nx: 0, ny: 1 }; }
    for (const o of G.blocks) {
      if (o.t !== 'b' || o.dead) continue;
      const R = rectOf(G, o), x0 = R.x - BR, x1 = R.x + R.w + BR, y0 = R.y - BR, y1 = R.y + R.w + BR;
      let tmin = -Infinity, tmax = Infinity, nx = 0, ny = 0;
      if (dx) { let a = (x0 - x) / dx, c = (x1 - x) / dx; if (a > c) [a, c] = [c, a]; if (a > tmin) { tmin = a; nx = dx > 0 ? -1 : 1; ny = 0; } tmax = Math.min(tmax, c); } else if (x < x0 || x > x1) continue;
      if (dy) { let a = (y0 - y) / dy, c = (y1 - y) / dy; if (a > c) [a, c] = [c, a]; if (a > tmin) { tmin = a; nx = 0; ny = dy > 0 ? -1 : 1; } tmax = Math.min(tmax, c); } else if (y < y0 || y > y1) continue;
      if (tmin <= tmax && tmin > .5 && tmin < best.t) best = { t: tmin, nx, ny };
    }
    return best;
  }
  function guide(G, ang) {
    const x0 = G.lx, y0 = G.L.LY - BR; let dx = Math.cos(ang), dy = Math.sin(ang);
    const h1 = rayHit(G, x0, y0, dx, dy), x1 = x0 + dx * h1.t, y1 = y0 + dy * h1.t, pts = [[x0, y0], [x1, y1]];
    if (G.cfg.guide > 0) {
      const dn = dx * h1.nx + dy * h1.ny; dx -= 2 * dn * h1.nx; dy -= 2 * dn * h1.ny;
      const h2 = rayHit(G, x1 + dx, y1 + dy, dx, dy), len = Math.min(h2.t, G.cfg.guide > 1 ? 150 : 70);
      pts.push([x1 + dx * len, y1 + dy * len]);
    }
    return pts;
  }

  /* ════════════════════════════════════════════════════════════════
     3D
  ════════════════════════════════════════════════════════════════ */
  const _lbl = new Map();
  function labelTex(txt) {
    if (_lbl.has(txt)) return _lbl.get(txt);
    const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 64px system-ui, sans-serif';
    x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,.35)'; x.strokeText(txt, 48, 52); x.fillStyle = '#fff'; x.fillText(txt, 48, 52);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _lbl.set(txt, t); return t;
  }
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun } = Arcade3D.stdScene({ sky: '#e0e7ff', ground: '#0b0a1f', hemi: .75, sunI: 2.6, fillC: '#a78bfa', fillI: .5, normalBias: .5 });
    const cam = new THREE.PerspectiveCamera(30, 1, 10, 6000);   /* FOV estreito: quase ortográfica, os blocos das pontas não "tombam" para fora */
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#0d0b22'; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(167,139,250,.16)'; x.lineWidth = 2; x.strokeRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: tex, color: '#8b85c9', roughness: .8, metalness: .1 }));
    board.receiveShadow = true; scene.add(board);
    const railM = new THREE.MeshBasicMaterial({ color: '#a78bfa', toneMapped: false }), floorM = new THREE.MeshBasicMaterial({ color: '#22d3ee', toneMapped: false });
    const rails = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), railM); scene.add(m); return m; });
    const floorL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), floorM); scene.add(floorL);
    const blocks = new THREE.InstancedMesh(Arcade3D.roundBox(.16), new THREE.MeshPhysicalMaterial({ roughness: .3, metalness: .02, clearcoat: .75, clearcoatRoughness: .15 }), COLS * ROWS + 8);
    blocks.castShadow = true; blocks.receiveShadow = true; blocks.frustumCulled = false;
    const shardM = new THREE.InstancedMesh(Arcade3D.roundBox(.22), new THREE.MeshStandardMaterial({ roughness: .35 }), 300);
    shardM.castShadow = true; shardM.frustumCulled = false; shardM.count = 0;
    const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#c4b5fd', emissiveIntensity: .55, roughness: .15, metalness: .2 }), 900);
    balls.castShadow = true; balls.frustumCulled = false; balls.count = 0;
    const launcher = new THREE.Sprite(Arcade3D.glowSprite('#a78bfa')); scene.add(launcher);
    scene.add(blocks, shardM, balls);
    G.r3 = { renderer, scene, sun, cam, tex, board, railM, floorM, rails, floorL, blocks, shardM, balls, launcher, pool: Arcade3D.pool(scene),
      m4: new THREE.Matrix4(), v: new THREE.Vector3(), sc: new THREE.Vector3(), c: new THREE.Color(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), e: new THREE.Euler(), qI: new THREE.Quaternion(), white: new THREE.Color('#ffffff') };
    api.stage.style.background = 'radial-gradient(120% 80% at 50% 0%, #1b1240, #06050f 70%)';
  }

  function draw3D(G, ctx, W, H, api) {
    const R = G.r3, L = G.L, P = R.pool, { m4, v, sc, c } = R;
    Arcade3D.fit(api.stage, R.cam);
    const X = lx => lx - W / 2, Y = ly => H / 2 - ly, BZ = L.C * .5;
    const D = (H / 2) / Math.tan(R.cam.fov * Math.PI / 360);
    const [shx, shy] = api.shakeXY;
    R.cam.position.set(-shx, shy, D); R.cam.lookAt(-shx, shy, 0);
    R.cam.near = D * .4; R.cam.far = D * 1.6; R.cam.updateProjectionMatrix();
    Arcade3D.sunAt(R.sun, 0, 0, 0, Math.max(W, H) * .6, [-.5, .5, 1]);
    const gw = COLS * L.C, gh = ROWS * L.C, gcx = X(L.gx + gw / 2), gcy = Y(L.gy + gh / 2);
    R.board.scale.set(gw, gh, 1); R.board.position.set(gcx, gcy, -1); R.tex.repeat.set(COLS, ROWS);
    R.rails[0].scale.set(4, gh, 6); R.rails[0].position.set(X(L.gx - 2), gcy, 3);
    R.rails[1].scale.set(4, gh, 6); R.rails[1].position.set(X(L.gx + gw + 2), gcy, 3);
    R.rails[2].scale.set(gw + 8, 4, 6); R.rails[2].position.set(gcx, Y(L.gy - 2), 3);
    const danger = G.blocks.some(b => b.t === 'b' && b.r >= ROWS - 2);
    R.floorL.scale.set(gw, 3, 3); R.floorL.position.set(gcx, Y(L.LY + 1.5), 2);
    R.floorM.color.set(danger ? (Math.floor(api.t * 4) % 2 ? '#ef4444' : '#7f1d1d') : '#22d3ee');
    const flat = R.q.setFromAxisAngle(R.v2 || (R.v2 = new THREE.Vector3(1, 0, 0)), Math.PI / 2);
    /* blocos */
    let nb = 0;
    G.blocks.forEach(b => {
      if (b.t !== 'b' || b.dead) return;
      const r = rectOf(G, b), a = b.fresh && G.adv ? ease(Math.min(1, G.adv.t / G.adv.d)) : 1;
      const wob = b.wob > 0 ? 1 + Math.sin(b.wob * 20) * .09 * b.wob : 1, s = r.w * wob * (.4 + .6 * a), hit = b.hit > 0 ? b.hit / .1 : 0;
      v.set(X(r.x + r.w / 2), Y(r.y + r.w / 2), BZ / 2 + hit * 2);
      m4.compose(v, flat, sc.set(s, BZ * (2 - wob), s));
      c.set(colorOf(G, b.hp)); if (hit) c.lerp(R.white, hit * .55);
      R.blocks.setMatrixAt(nb, m4); R.blocks.setColorAt(nb, c); nb++;
    });
    R.blocks.count = nb; R.blocks.instanceMatrix.needsUpdate = true; if (R.blocks.instanceColor) R.blocks.instanceColor.needsUpdate = true;
    /* estilhaços */
    let ns = 0;
    G.shards.forEach(s => { const k = Math.min(1, s.life * 3); R.e.set(s.rx, s.ry, 0); R.q2.setFromEuler(R.e); m4.compose(v.set(X(s.x), Y(s.y), s.z), R.q2, sc.set(s.s * k, s.s * k, s.s * k)); R.shardM.setMatrixAt(ns, m4); R.shardM.setColorAt(ns, c.set(s.col)); ns++; });
    R.shardM.count = ns; R.shardM.instanceMatrix.needsUpdate = true; if (R.shardM.instanceColor) R.shardM.instanceColor.needsUpdate = true;
    /* bolas: as que estão no ar + a que espera no lançador */
    let n = 0;
    const putBall = (x, y) => { if (n >= 900) return; m4.compose(v.set(X(x), Y(y), BR + 1), R.qI, sc.set(BR, BR, BR)); R.balls.setMatrixAt(n++, m4); };
    if (G.phase === 'fire') { G.balls.forEach(b => putBall(b.x, b.y)); if (G.fired < G.nb) putBall(G.lx, L.LY - BR); }
    else if (G.phase !== 'over') putBall(G.lx, L.LY - BR);
    R.balls.count = n; R.balls.instanceMatrix.needsUpdate = true;
    R.launcher.position.set(X(G.phase === 'fire' && G.nextX != null ? G.nextX : G.lx), Y(L.LY - BR), 1); R.launcher.scale.set(46, 46, 1); R.launcher.material.opacity = .5 + Math.sin(api.t * 4) * .15;
    P.begin();
    /* anéis +1 e raios ↔ ↕ */
    G.blocks.forEach(b => {
      if (b.t === 'b' || b.dead) return;
      const [x, y] = cellC(G, b), a = b.fresh && G.adv ? ease(Math.min(1, G.adv.t / G.adv.d)) : 1;
      if (b.t === 'plus') {
        const m = P.get('plus', () => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(1, .16, 10, 32), new THREE.MeshStandardMaterial({ color: '#4ade80', emissive: '#16a34a', emissiveIntensity: .7, roughness: .25, metalness: .3 })); t.castShadow = true; g.add(t); const s = new THREE.Sprite(Arcade3D.glowSprite('#4ade80')); s.scale.set(3.4, 3.4, 1); g.add(s); const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('+1'), depthTest: false })); l.scale.set(1.2, 1.2, 1); l.position.z = .5; g.add(l); return g; });
        const k = 1 + Math.sin(api.t * 5 + b.id) * .08;
        m.scale.setScalar(L.C * .22 * a * k); m.position.set(X(x), Y(y), BZ * .45); m.children[0].rotation.y = Math.sin(api.t * 2 + b.id) * .5;
      } else {
        const m = P.get(b.t, () => { const g = new THREE.Group(); const o = new THREE.Mesh(new THREE.SphereGeometry(.55, 18, 12), Arcade3D.glowMat('#fde047')); g.add(o); const s = new THREE.Sprite(Arcade3D.glowSprite('#facc15')); s.scale.set(3.6, 3.6, 1); g.add(s); const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(b.t === 'lh' ? '↔' : '↕'), depthTest: false })); l.scale.set(1.4, 1.4, 1); l.position.z = .6; g.add(l); return g; });
        m.scale.setScalar(L.C * .2 * a); m.position.set(X(x), Y(y), BZ * .45);
        m.children[1].material.opacity = b.used ? .35 : .9;
      }
    });
    /* feixes dos raios */
    G.beams.forEach(bm => {
      const m = P.get('beam', () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#fef08a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
      const k = bm.t / bm.d, th = L.C * .22 * k + 2;
      if (bm.k === 'lh') { m.scale.set(gw, th, 4); m.position.set(gcx, Y(L.gy + (bm.r + .5) * L.C), BZ * .6); }
      else { m.scale.set(th, gh, 4); m.position.set(X(L.gx + (bm.c + .5) * L.C), gcy, BZ * .6); }
      m.material.opacity = k;
    });
    /* ondas de choque */
    G.rings.forEach(r => {
      const m = P.get('ring', () => new THREE.Mesh(new THREE.RingGeometry(.84, 1, 40), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
      const k = r.t / r.d; m.position.set(X(r.x), Y(r.y), 2); m.scale.setScalar(r.r0 + (r.r1 - r.r0) * ease(k)); m.material.color.set(r.col); m.material.opacity = (1 - k) * .9;
    });
    P.end();
    R.renderer.render(R.scene, R.cam);
    /* números por cima de cada bloco (projetados do topo 3D; o tremor já vem da câmara) */
    const proj = (x, y, z) => { const p = Arcade3D.toScreen(R.cam, X(x), Y(y), z, W, H); return [p.x - shx, p.y - shy]; };
    overlay(G, ctx, W, H, api, proj, BZ);
  }

  function destroy(G) {
    const R = G.r3; if (!R) return;
    R.tex.dispose(); Arcade3D.disposeOwn(R.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  function draw(G, ctx, W, H, api) {
    if (!G.L) lay(G, api);
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    draw2D(G, ctx, W, H, api);
  }

  /* camada 2D comum: números, mira, lançador, botões */
  function overlay(G, ctx, W, H, api, proj, BZ) {
    const L = G.L;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    G.blocks.forEach(b => {
      if (b.t !== 'b' || b.dead) return;
      const r = rectOf(G, b), [x, y] = proj(r.x + r.w / 2, r.y + r.w / 2, BZ + 1), a = b.fresh && G.adv ? ease(Math.min(1, G.adv.t / G.adv.d)) : 1;
      const txt = String(b.hp), fs = Math.round(L.C * (txt.length > 3 ? .26 : txt.length > 2 ? .3 : .36));
      ctx.globalAlpha = a; ctx.font = `800 ${fs}px 'Space Grotesk', system-ui, sans-serif`;
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(10,6,30,.55)'; ctx.strokeText(txt, x, y + 1); ctx.fillStyle = '#fff'; ctx.fillText(txt, x, y + 1);
    });
    ctx.globalAlpha = 1;
    /* mira */
    if (G.phase === 'aim' && G.aim != null) {
      const pts = guide(G, G.aim);
      ctx.fillStyle = '#e9d5ff';
      let carry = 0;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], len = Math.hypot(x1 - x0, y1 - y0);
        for (let d = carry; d < len; d += 15) { const f = d / len, fade = i === 1 ? 1 : .55; ctx.globalAlpha = fade * (.95 - (d / len) * .25 * (i - 1)); ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, i === 1 ? 3 : 2.4, 0, 6.3); ctx.fill(); carry = d + 15 - len; }
      }
      ctx.globalAlpha = 1;
    }
    /* lançador: quantas bolas faltam sair */
    const bx = G.lx, by = L.LY - BR;
    const left = G.phase === 'fire' ? G.nb - G.fired : G.nb;
    if (left > 0 && G.phase !== 'over') { ctx.font = "800 14px 'Space Grotesk', system-ui"; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText('×' + left, bx, by + 22); ctx.fillStyle = '#e9d5ff'; ctx.fillText('×' + left, bx, by + 22); }
    if (!G.r3 && G.phase !== 'over' && (G.phase !== 'fire' || G.fired < G.nb)) { ctx.fillStyle = '#fff'; ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(bx, by, BR, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0; }
    if (G.pop) { const k = G.pop.t; ctx.globalAlpha = Math.min(1, k * 2); ctx.font = "800 16px 'Space Grotesk', system-ui"; ctx.fillStyle = '#86efac'; ctx.fillText(G.pop.txt, bx, by - 26 - (1.2 - k) * 18); ctx.globalAlpha = 1; }
    /* botão "recolher" e velocidade */
    if (G.phase === 'fire' && G.fireT > 1.2) {
      const rb = recallBtn(G);
      ctx.fillStyle = 'rgba(20,14,50,.75)'; U.rr(ctx, rb.x, rb.y, rb.w, rb.h, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(196,181,253,.6)'; ctx.lineWidth = 1.5; U.rr(ctx, rb.x, rb.y, rb.w, rb.h, 12); ctx.stroke();
      ctx.fillStyle = '#e9d5ff'; ctx.font = '800 17px system-ui'; ctx.fillText('⤓', rb.x + rb.w / 2, rb.y + rb.h / 2 + 1);
      if (G.sk > 1) { ctx.font = '700 12px system-ui'; ctx.fillStyle = '#c4b5fd'; ctx.fillText('⏩ ' + G.sk + '×', rb.x - 30, rb.y + rb.h / 2); }
    }
    if (G.phase === 'aim' && G.aim == null && G.turn <= 2) { ctx.font = '600 13px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(api.ptrs && api.ptrs.size ? '' : 'Arrasta para apontar e larga para disparar', W / 2, L.LY + 48); }
    if (G.phase === 'aim' && G.blocks.some(b => b.t === 'b' && b.r >= ROWS - 2)) { ctx.font = '800 13px system-ui'; ctx.fillStyle = Math.floor(api.t * 3) % 2 ? '#fca5a5' : '#ef4444'; ctx.fillText('⚠ Última fila!', W / 2, L.gy + (ROWS - 1) * L.C + L.C / 2); }
    ctx.textBaseline = 'alphabetic';
  }

  function draw2D(G, ctx, W, H, api) {
    const L = G.L, gw = COLS * L.C, gh = ROWS * L.C;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#140d33'); g.addColorStop(1, '#06050f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(13,11,34,.9)'; ctx.fillRect(L.gx, L.gy, gw, gh);
    ctx.strokeStyle = 'rgba(167,139,250,.08)'; ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(L.gx + i * L.C, L.gy); ctx.lineTo(L.gx + i * L.C, L.LY); ctx.stroke(); }
    for (let i = 1; i < ROWS; i++) { ctx.beginPath(); ctx.moveTo(L.gx, L.gy + i * L.C); ctx.lineTo(L.gx + gw, L.gy + i * L.C); ctx.stroke(); }
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(L.gx - 1, L.LY); ctx.lineTo(L.gx - 1, L.gy - 1); ctx.lineTo(L.gx + gw + 1, L.gy - 1); ctx.lineTo(L.gx + gw + 1, L.LY); ctx.stroke();
    const danger = G.blocks.some(b => b.t === 'b' && b.r >= ROWS - 2);
    ctx.strokeStyle = danger && Math.floor(api.t * 4) % 2 ? '#ef4444' : '#22d3ee'; ctx.beginPath(); ctx.moveTo(L.gx, L.LY + 1); ctx.lineTo(L.gx + gw, L.LY + 1); ctx.stroke();
    G.blocks.forEach(b => {
      if (b.dead) return;
      const a = b.fresh && G.adv ? ease(Math.min(1, G.adv.t / G.adv.d)) : 1;
      ctx.globalAlpha = a;
      if (b.t === 'b') {
        const r = rectOf(G, b), wob = b.wob > 0 ? 1 + Math.sin(b.wob * 20) * .09 * b.wob : 1, s = r.w * wob, cx = r.x + r.w / 2, cy = r.y + r.w / 2;
        ctx.fillStyle = colorOf(G, b.hp); U.rr(ctx, cx - s / 2, cy - s / 2, s, s, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.22)'; U.rr(ctx, cx - s / 2 + 3, cy - s / 2 + 3, s - 6, s * .3, 5); ctx.fill();
        if (b.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${b.hit * 4})`; U.rr(ctx, cx - s / 2, cy - s / 2, s, s, 7); ctx.fill(); }
      } else {
        const [x, y] = cellC(G, b), rr = L.C * .22;
        if (b.t === 'plus') { ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 3.5; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x, y, rr * (1 + Math.sin(api.t * 5 + b.id) * .08), 0, 6.3); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = '#bbf7d0'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+1', x, y + 1); }
        else { ctx.fillStyle = b.used ? 'rgba(253,224,71,.4)' : '#fde047'; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y, rr * .7, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#422006'; ctx.font = '800 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.t === 'lh' ? '↔' : '↕', x, y + 1); }
      }
    });
    ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
    G.beams.forEach(bm => { const k = bm.t / bm.d; ctx.globalAlpha = k; ctx.fillStyle = '#fef08a'; if (bm.k === 'lh') ctx.fillRect(L.gx, L.gy + (bm.r + .5) * L.C - 3 * k - 1, gw, 6 * k + 2); else ctx.fillRect(L.gx + (bm.c + .5) * L.C - 3 * k - 1, L.gy, 6 * k + 2, gh); });
    G.rings.forEach(r => { const k = r.t / r.d; ctx.globalAlpha = (1 - k) * .8; ctx.strokeStyle = r.col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease(k), 0, 6.3); ctx.stroke(); });
    G.shards.forEach(s => { const k = Math.min(1, s.life * 3), z = 1 + s.z / 160; ctx.globalAlpha = k; ctx.fillStyle = s.col; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rx); ctx.fillRect(-s.s * z / 2, -s.s * z / 2, s.s * z, s.s * z * .8); ctx.restore(); });
    ctx.globalAlpha = 1;
    if (G.phase === 'fire') G.balls.forEach(b => { ctx.fillStyle = '#fff'; ctx.shadowColor = '#c4b5fd'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, 6.3); ctx.fill(); });
    ctx.shadowBlur = 0;
    overlay(G, ctx, W, H, api, (x, y) => [x, y], 0);
  }

  return ArcadeKit.create({
    id: 'ball-blast', title: 'Rajada', icon: '🟣',
    accent: '#a78bfa', accent2: '#22d3ee', bg: '#06050f', transparent: true, destroy,
    tagline: 'Aponta e dispara todas as bolas de uma vez. A cada jogada os blocos descem — e tu ganhas mais bolas.',
    view: { w: 400 },
    how: [
      '<b>Toque:</b> arrasta para apontar (para trás, como uma fisga, ou para a frente — a mira aparece) e larga para disparar. <b>Rato:</b> aponta com o cursor e clica.',
      'Cada toque tira 1 ao número do bloco. Apanha os anéis <b style="color:#4ade80">+1</b> para teres mais bolas na jogada seguinte; <b style="color:#ca8a04">↔</b> e <b style="color:#ca8a04">↕</b> dão um raio a toda a linha ou coluna.',
      'Depois de cada jogada os blocos descem uma fila. Se um chegar ao fundo, acabou (há uma segunda oportunidade por partida). A primeira bola a cair marca de onde sai a próxima rajada; ⤓ recolhe as bolas.',
    ],
    controls: ['🖱️ Apontar + clicar', '👆 Arrastar + largar', '⌨️ ← → + Espaço'],
    ready: { title: 'Toca para começar', hint: 'Arrasta para apontar e larga para disparar.' },
    setup, update, draw,
    /* no ecrã "toca para começar" a primeira fila já vai caindo */
    idle: (G, dt, api) => { lay(G, api); fx(G, dt); if (G.adv) { G.adv.t += dt; const k = Math.min(1, G.adv.t / G.adv.d); G.blocks.forEach(b => { b.ay = -(1 - back(k)); }); if (k >= 1) { G.adv = null; afterAdvance(G, api); } } },
    down: (G, x, y, api, e) => {
      if (G.phase === 'fire' && G.fireT > 1.2) { const r = recallBtn(G); if (x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 6 && y <= r.y + r.h + 6) { recall(G, api); return; } }
      if (G.phase !== 'aim') return;
      G.ptr = { x, y };
      if (e.pointerType === 'mouse') G.aim = aimAt(G, x, y);
    },
    move: (G, x, y, api, e, isDown) => {
      if (G.phase !== 'aim') return;
      if (e.pointerType === 'mouse') { G.aim = aimAt(G, x, y); return; }
      if (isDown && G.ptr) G.aim = aimDrag(x - G.ptr.x, y - G.ptr.y);
    },
    up: (G, x, y, api, e) => {
      if (G.phase !== 'aim' || !G.ptr) return;
      const a = e.pointerType === 'mouse' ? aimAt(G, x, y) : aimDrag(x - G.ptr.x, y - G.ptr.y);
      G.ptr = null;
      if (a != null) fire(G, api, a); else if (e.pointerType !== 'mouse') G.aim = null;
    },
    key: (G, e, api) => {
      if (G.phase !== 'aim') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { G.aim = clampAng((G.aim == null ? -Math.PI / 2 : G.aim) - .035); return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { G.aim = clampAng((G.aim == null ? -Math.PI / 2 : G.aim) + .035); return true; }
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') { fire(G, api, G.aim == null ? -Math.PI / 2 : G.aim); return true; }
    },
    hud: (G, api) => [['Nível', G.turn], ['Bolas', G.nb + (G.gain ? ' +' + G.gain : '')], ['Recorde', api.best != null ? api.best : '—']],
    achievements: [
      { id: 'bz.25',  name: 'Chuva de Bolas', icon: '🟣', desc: 'Chega ao nível 25 na Rajada.', test: c => (c.result.score || 0) >= 25 },
      { id: 'bz.60',  name: 'Tempestade', icon: '🌪️', desc: 'Chega ao nível 60 na Rajada.', test: c => (c.result.score || 0) >= 60 },
      { id: 'bz.100', name: 'Cem Bolas', icon: '💯', desc: 'Junta 100 bolas numa partida da Rajada.', test: c => ((c.result.meta || {}).balls || 0) >= 100 },
    ],
  });
})();
