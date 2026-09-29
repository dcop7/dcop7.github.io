/* ══════════════════════════════════════════════════════════════════
   Buraco Guloso (Hole.io) — és um buraco (ou um aspirador) que engole
   tudo o que for mais pequeno do que tu e cresce com isso.
     • Cidade: 2 minutos contra 4 buracos rivais (IA); quem for maior
       engole os menores — também te podem engolir a ti.
     • Aspirador: a mesma batalha numa casa, com aspiradores-robô; a
       sucção puxa as coisas pequenas à volta.
     • Limpeza geral: aspirador sozinho — limpa a casa o mais possível.
   Mundo procedural, hash espacial para colisões e desenho só do que
   está visível; a câmara afasta-se à medida que cresces.
══════════════════════════════════════════════════════════════════ */
const HoleGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2;
  const DIFF = { easy: { time: 150, ai: .82, spd: 1.08 }, medium: { time: 120, ai: 1, spd: 1 }, hard: { time: 100, ai: 1.15, spd: .96 } };
  const RIVALS = [['Gula', '#ef4444'], ['Vórtice', '#a855f7'], ['Tornado', '#f59e0b'], ['Ruído', '#06b6d4']];
  const BUCKET = 120;

  /* ── construção dos mundos ── */
  function addObj(G, o) { o.id = G.nid++; o.a = o.a ?? Math.random() * TAU; G.objs.push(o); return o; }

  function buildCity(G) {
    const B = 300, RD = 64, N = 5;
    G.W = G.H = N * B + (N + 1) * RD;
    G.blocks = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = RD + i * (B + RD), y = RD + j * (B + RD), kind = U.pick(['park', 'res', 'res', 'down', 'down', 'lot']);
      G.blocks.push({ x, y, w: B, h: B, kind });
      const rnd = (a, b) => [x + U.rand(a, B - a), y + U.rand(a, B - a)];
      if (kind === 'park') {
        addObj(G, { k: 'fountain', x: x + B / 2, y: y + B / 2, r: 30 });
        for (let t = 0; t < 12; t++) { const [px, py] = rnd(20, 20); if (Math.hypot(px - x - B / 2, py - y - B / 2) > 50) addObj(G, { k: 'tree', x: px, y: py, r: U.rand(10, 15) }); }
        for (let t = 0; t < 5; t++) { const [px, py] = rnd(25, 25); addObj(G, { k: 'bench', x: px, y: py, r: 7 }); }
        for (let t = 0; t < 14; t++) { const [px, py] = rnd(10, 10); addObj(G, { k: 'person', x: px, y: py, r: 4, mv: 1 }); }
      } else if (kind === 'res') {
        [[.27, .27], [.73, .27], [.27, .73], [.73, .73]].forEach(([u, v]) => addObj(G, { k: 'house', x: x + u * B, y: y + v * B, r: U.rand(27, 33), hue: U.pick([0, 20, 200, 140, 40]) }));
        for (let t = 0; t < 8; t++) { const [px, py] = rnd(12, 12); addObj(G, { k: 'tree', x: px, y: py, r: U.rand(9, 12) }); }
        for (let t = 0; t < 6; t++) { const [px, py] = rnd(8, 8); addObj(G, { k: 'person', x: px, y: py, r: 4, mv: 1 }); }
      } else if (kind === 'down') {
        const n = Math.random() < .5 ? 1 : 2;
        if (n === 1) addObj(G, { k: 'tower', x: x + B / 2, y: y + B / 2, r: U.rand(62, 72), hue: U.pick([210, 190, 230, 30]) });
        else { addObj(G, { k: 'tower', x: x + B * .3, y: y + B * .35, r: U.rand(44, 52), hue: 210 }); addObj(G, { k: 'tower', x: x + B * .7, y: y + B * .68, r: U.rand(44, 52), hue: 30 }); }
        for (let t = 0; t < 10; t++) { const [px, py] = rnd(8, 8); addObj(G, { k: 'person', x: px, y: py, r: 4, mv: 1 }); }
        for (let t = 0; t < 4; t++) { const [px, py] = rnd(10, 10); addObj(G, { k: 'kiosk', x: px, y: py, r: 11 }); }
      } else {
        for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) if (Math.random() < .75) addObj(G, { k: 'car', x: x + 50 + b * 66, y: y + 60 + a * 90, r: 13, hue: U.pick([0, 210, 45, 120, 280, 0]), a: Math.PI / 2 });
      }
      /* candeeiros e cones nos passeios */
      for (let t = 0; t < 6; t++) addObj(G, { k: t % 2 ? 'lamp' : 'cone', x: x - 8 + (t % 3) * (B / 2 + 8), y: y - 8 + Math.floor(t / 3) * (B + 16), r: 3.5 });
    }
    /* trânsito */
    for (let i = 0; i <= N; i++) {
      const c = i * (B + RD) + RD / 2;
      for (let t = 0; t < 4; t++) {
        const bus = Math.random() < .2;
        addObj(G, { k: bus ? 'bus' : 'car', x: U.rand(0, G.W), y: c + (t % 2 ? 14 : -14), r: bus ? 22 : 13, hue: U.pick([0, 210, 45, 280, 160]), a: t % 2 ? 0 : Math.PI, road: { ax: 'x', dir: t % 2 ? 1 : -1, v: U.rand(60, 95) } });
        addObj(G, { k: bus ? 'bus' : 'car', x: c + (t % 2 ? -14 : 14), y: U.rand(0, G.H), r: bus ? 22 : 13, hue: U.pick([0, 210, 45, 280, 160]), a: t % 2 ? Math.PI / 2 : -Math.PI / 2, road: { ax: 'y', dir: t % 2 ? 1 : -1, v: U.rand(60, 95) } });
      }
    }
    G.startR = 18;
  }

  const ROOMS = [
    { name: 'sala', x: 0, y: 0, w: 900, h: 600, floor: 'wood' },
    { name: 'cozinha', x: 900, y: 0, w: 700, h: 500, floor: 'tile' },
    { name: 'quarto', x: 0, y: 600, w: 800, h: 560, floor: 'carpet' },
    { name: 'wc', x: 800, y: 600, w: 380, h: 560, floor: 'blue' },
    { name: 'corredor', x: 1180, y: 500, w: 420, h: 660, floor: 'wood2' },
  ];
  function buildHouse(G) {
    G.W = 1600; G.H = 1160; G.rooms = ROOMS;
    const place = (k, x, y, r, extra) => addObj(G, Object.assign({ k, x, y, r }, extra || {}));
    /* mobília (posições pensadas, não aleatórias) */
    place('sofa', 300, 150, 56); place('table', 330, 360, 38); place('tv', 760, 90, 30); place('plant', 60, 60, 17); place('plant', 850, 560, 16);
    place('armchair', 560, 170, 26); place('lamp2', 90, 520, 12); place('rug', 340, 360, 0.001, { deco: true });
    place('fridge', 1540, 70, 40); place('stove', 1350, 60, 32); place('ktable', 1150, 280, 40); place('chair', 1080, 220, 16); place('chair', 1220, 220, 16); place('chair', 1080, 340, 16); place('chair', 1220, 340, 16);
    place('bed', 250, 830, 64); place('wardrobe', 700, 700, 52); place('desk', 620, 1050, 34); place('chair', 620, 990, 16); place('plant', 60, 1100, 16);
    place('bath', 1030, 720, 48); place('toilet', 880, 1080, 18); place('sink', 1100, 1090, 16);
    place('piano', 1450, 1000, 60); place('shoe_rack', 1300, 560, 22); place('plant', 1560, 540, 16);
    /* lixo e brinquedos espalhados — muitos pequenos */
    const small = [['crumb', 2.5, 170], ['dust', 4, 90], ['coin', 3, 30], ['lego', 4.5, 60], ['sock', 6.5, 40], ['toycar', 7.5, 24], ['shoe', 9.5, 18], ['book', 10.5, 16], ['cushion', 14, 10], ['ball', 11, 8], ['teddy', 15, 6], ['box', 19, 6]];
    small.forEach(([k, r, n]) => { for (let i = 0; i < n; i++) place(k, U.rand(20, G.W - 20), U.rand(20, G.H - 20), r * U.rand(.85, 1.15), { hue: U.randi(0, 359) }); });
    G.startR = 13;
  }

  function newHole(G, name, color, ai) {
    const h = { name, color, ai, x: U.rand(150, G.W - 150), y: U.rand(150, G.H - 150), R: G.startR, area: Math.PI * G.startR * G.startR, score: 0, eaten: 0, holes: 0, vx: 0, vy: 0, dead: 0, target: null, think: 0, pulse: 0 };
    return h;
  }

  function setup(api, o) {
    const mode = o.mode || 'city', cfg = DIFF[o.diff] || DIFF.medium;
    const G = { mode, vac: mode !== 'city', cfg, objs: [], nid: 1, t: 0, time: cfg.time, joy: null, keys: [0, 0], falls: [], over: false, total: 0 };
    if (mode === 'city') buildCity(G); else buildHouse(G);
    G.total = G.objs.filter(o => !o.deco).length;
    G.me = newHole(G, 'Tu', '#22c55e', false);
    G.me.x = G.W / 2; G.me.y = G.H / 2;
    G.holes = [G.me];
    if (mode !== 'solo') RIVALS.slice(0, mode === 'city' ? 4 : 3).forEach(([n, c]) => G.holes.push(newHole(G, n, c, true)));
    /* ninguém começa em cima de ninguém */
    G.holes.forEach((h, i) => { if (i) { h.x = G.W * (i % 2 ? .18 : .82); h.y = G.H * (i < 3 ? .2 : .8); } });
    G.cam = { x: G.me.x, y: G.me.y, z: 1.2 };
    return G;
  }

  /* hash espacial reconstruído a cada frame (há objetos em movimento) */
  function rehash(G) {
    const m = new Map();
    for (const o of G.objs) { if (o.gone) continue; const k = ((o.x / BUCKET) | 0) + ',' + ((o.y / BUCKET) | 0); let a = m.get(k); if (!a) m.set(k, a = []); a.push(o); }
    G.hash = m;
  }
  function near(G, x, y, rad, fn) {
    const x0 = ((x - rad) / BUCKET) | 0, x1 = ((x + rad) / BUCKET) | 0, y0 = ((y - rad) / BUCKET) | 0, y1 = ((y + rad) / BUCKET) | 0;
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const a = G.hash.get(i + ',' + j); if (a) for (const o of a) fn(o); }
  }
  const canEat = (h, o) => o.r < h.R * .92;
  const speedOf = (G, h) => (h.ai ? 170 * G.cfg.ai : 190 * G.cfg.spd) * (1 + Math.min(.35, (h.R - G.startR) / 400));

  function grow(G, h, gain, api) {
    h.area += gain; h.R = Math.sqrt(h.area / Math.PI);
    if (!h.ai) { const lv = Math.floor((h.R - G.startR) / (G.vac ? 7 : 10)); if (lv > (G.lvl || 0)) { G.lvl = lv; api.banner(G.vac ? 'Potência ' + (lv + 1) : 'Maior!', ''); api.sfx.arp([523, 659, 784], .05, .1, 'triangle', .06); } }
  }

  function aiThink(G, h) {
    h.think = U.rand(.35, .6);
    let fx = 0, fy = 0, flee = false;
    for (const o of G.holes) {
      if (o === h || o.dead) continue;
      const d = U.dist(h.x, h.y, o.x, o.y);
      if (o.R > h.R * 1.15 && d < 220 + o.R) { fx += (h.x - o.x) / d; fy += (h.y - o.y) / d; flee = true; }
    }
    if (flee) { h.target = { x: h.x + fx * 300, y: h.y + fy * 300 }; return; }
    const prey = G.holes.filter(o => o !== h && !o.dead && o.R * 1.2 < h.R && U.dist(h.x, h.y, o.x, o.y) < 320).sort((a, b) => U.dist(h.x, h.y, a.x, a.y) - U.dist(h.x, h.y, b.x, b.y))[0];
    if (prey) { h.target = prey; return; }
    let best = null, bv = 0;
    near(G, h.x, h.y, 420, o => { if (o.deco || !canEat(h, o)) return; const v = (o.r * o.r) / (U.dist(h.x, h.y, o.x, o.y) + 60); if (v > bv) { bv = v; best = o; } });
    h.target = best ? { x: best.x, y: best.y } : { x: U.rand(100, G.W - 100), y: U.rand(100, G.H - 100) };
  }

  function update(G, dt, api) {
    G.t += dt; G.time -= dt;
    if (G.time <= 0) { G.time = 0; finish(G, api); return; }
    if (Math.floor(G.time) === 10 && Math.floor(G.time + dt) === 11) { api.banner('10 segundos!', ''); api.sfx.tone(880, .1, 'square', .05); }
    /* objetos que andam */
    for (const o of G.objs) {
      if (o.gone || o.falling) continue;
      if (o.road) { if (o.road.ax === 'x') { o.x += o.road.dir * o.road.v * dt; if (o.x < -40) o.x = G.W + 40; if (o.x > G.W + 40) o.x = -40; } else { o.y += o.road.dir * o.road.v * dt; if (o.y < -40) o.y = G.H + 40; if (o.y > G.H + 40) o.y = -40; } }
      else if (o.mv) { o.a += U.rand(-2, 2) * dt; o.x = U.clamp(o.x + Math.cos(o.a) * 22 * dt, 5, G.W - 5); o.y = U.clamp(o.y + Math.sin(o.a) * 22 * dt, 5, G.H - 5); }
    }
    rehash(G);
    /* movimento dos buracos */
    for (const h of G.holes) {
      if (h.dead > 0) { h.dead -= dt; if (h.dead <= 0) { h.x = U.rand(150, G.W - 150); h.y = U.rand(150, G.H - 150); h.R = G.startR; h.area = Math.PI * h.R * h.R; h.pulse = 1; } continue; }
      let dx = 0, dy = 0;
      if (h.ai) {
        h.think -= dt; if (h.think <= 0 || !h.target || (h.target.gone)) aiThink(G, h);
        dx = h.target.x - h.x; dy = h.target.y - h.y;
        const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        if (d < 8) { dx = dy = 0; h.think = 0; }
      } else {
        if (G.keys[0] || G.keys[1]) { dx = G.keys[0]; dy = G.keys[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
        else if (G.joy) { dx = G.joy.dx; dy = G.joy.dy; }
      }
      const sp = speedOf(G, h);
      h.vx = U.lerp(h.vx, dx * sp, Math.min(1, dt * 8)); h.vy = U.lerp(h.vy, dy * sp, Math.min(1, dt * 8));
      h.x = U.clamp(h.x + h.vx * dt, h.R * .6, G.W - h.R * .6); h.y = U.clamp(h.y + h.vy * dt, h.R * .6, G.H - h.R * .6);
      h.pulse = Math.max(0, h.pulse - dt * 2);
      /* engolir objetos */
      const pull = G.vac ? h.R * 1.9 : h.R;
      near(G, h.x, h.y, pull + 80, o => {
        if (o.gone || o.falling || o.deco) return;
        const d = U.dist(h.x, h.y, o.x, o.y);
        if (G.vac && canEat(h, o) && d < pull && d > 1) { const k = 150 * (1 - d / pull) * dt; o.x += (h.x - o.x) / d * k; o.y += (h.y - o.y) / d * k; }
        if (canEat(h, o) && d < h.R - o.r * .35) {
          o.falling = { h, t: 0, x0: o.x, y0: o.y }; G.falls.push(o);
          const gain = Math.PI * o.r * o.r * (G.vac ? .42 : .5);   /* afinado com bots: ~2 min até dominar o mapa */
          grow(G, h, gain, api);
          const val = Math.round(o.r * o.r / 3) + 1;
          h.score += val; h.eaten++;
          if (!h.ai) {
            api.sfx.tone(Math.max(90, 900 - o.r * 12), .08, G.vac ? 'sawtooth' : 'sine', G.vac ? .025 : .05, 0, Math.max(60, 500 - o.r * 8));
            if (o.r > 14) { api.float(api.W / 2, api.H * .42, '+' + val, '#fde047', 18); api.shake(Math.min(8, o.r / 8), .15); api.vibe(15); }
          }
        }
      });
      /* engolir outros buracos */
      for (const o of G.holes) {
        if (o === h || o.dead || h.dead) continue;
        const d = U.dist(h.x, h.y, o.x, o.y);
        if (h.R > o.R * 1.15 && d < h.R - o.R * .5) {
          o.dead = 3; h.holes++;
          grow(G, h, o.area * .5, api); h.score += Math.round(o.area / 40);
          if (o === G.me) { api.banner('Foste engolido!', 'por ' + h.name); api.shake(12, .4); api.vibe([60, 40, 60]); api.sfx.lose(); }
          else if (h === G.me) { api.banner('Engoliste ' + o.name + '!', '+' + Math.round(o.area / 40)); api.sfx.win(); }
        }
      }
    }
    /* animação de queda */
    for (let i = G.falls.length - 1; i >= 0; i--) {
      const o = G.falls[i], f = o.falling; f.t += dt;
      const k = Math.min(1, f.t / .4); o.x = U.lerp(f.x0, f.h.x, k); o.y = U.lerp(f.y0, f.h.y, k); o.a += dt * (G.vac ? 14 : 5);
      if (k >= 1) { o.gone = true; G.falls.splice(i, 1); }
    }
    /* câmara: afasta com o tamanho */
    const me = G.me;
    const zT = U.clamp((G.vac ? 1.25 : 1.15) - (me.R - G.startR) / (G.vac ? 150 : 220), .42, 1.3);
    G.cam.z = U.lerp(G.cam.z, zT, Math.min(1, dt * 1.5));
    G.cam.x = U.lerp(G.cam.x, me.x, Math.min(1, dt * 6)); G.cam.y = U.lerp(G.cam.y, me.y, Math.min(1, dt * 6));
  }

  function ranking(G) { return G.holes.slice().sort((a, b) => b.score - a.score); }
  function finish(G, api) {
    if (G.over) return; G.over = true;
    const rk = ranking(G), pos = rk.indexOf(G.me) + 1;
    const clean = Math.round(100 * G.objs.filter(o => o.gone).length / G.total);
    const solo = G.mode === 'solo';
    api.over({ score: G.me.score, won: solo ? clean >= 50 : pos === 1, delay: 300,
      icon: solo ? '🧽' : pos === 1 ? '👑' : G.vac ? '🧹' : '🕳️',
      title: solo ? `Casa ${clean}% limpa` : pos === 1 ? 'És o maior!' : `Ficaste em ${pos}.º lugar`,
      html: solo ? '' : `<div style="margin-top:10px;display:grid;gap:4px;font-size:.84rem">${rk.map((h, i) => `<div style="display:flex;justify-content:space-between;padding:4px 10px;border-radius:8px;background:${h === G.me ? 'rgba(34,197,94,.18)' : 'rgba(255,255,255,.05)'}"><span>${i + 1}. <b style="color:${h.color}">●</b> ${h.name}</span><b>${h.score}</b></div>`).join('')}</div>`,
      stats: [['Tamanho', Math.round(G.me.R * 2)], ['Coisas engolidas', G.me.eaten], [solo ? 'Casa limpa' : 'Buracos engolidos', solo ? clean + '%' : G.me.holes]],
      meta: { pos, R: G.me.R, clean, vac: G.vac } });
  }

  /* ── desenho ── */
  function drawGround(G, ctx) {
    if (!G.vac) {
      ctx.fillStyle = '#4b5563'; ctx.fillRect(0, 0, G.W, G.H);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.setLineDash([22, 22]);
      for (let i = 0; i <= 5; i++) { const c = i * 364 + 32; ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(G.W, c); ctx.moveTo(c, 0); ctx.lineTo(c, G.H); ctx.stroke(); }
      ctx.setLineDash([]);
      G.blocks.forEach(b => {
        ctx.fillStyle = '#d1d5db'; ctx.fillRect(b.x - 10, b.y - 10, b.w + 20, b.h + 20);
        ctx.fillStyle = b.kind === 'park' ? '#4ade80' : b.kind === 'res' ? '#86efac' : b.kind === 'lot' ? '#6b7280' : '#cbd5e1';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        if (b.kind === 'lot') { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; for (let a = 0; a < 3; a++) for (let c = 0; c <= 4; c++) { ctx.beginPath(); ctx.moveTo(b.x + 17 + c * 66, b.y + 35 + a * 90); ctx.lineTo(b.x + 17 + c * 66, b.y + 85 + a * 90); ctx.stroke(); } }
        if (b.kind === 'park') { ctx.fillStyle = '#d6b48a'; ctx.fillRect(b.x + b.w / 2 - 12, b.y, 24, b.h); ctx.fillRect(b.x, b.y + b.h / 2 - 12, b.w, 24); }
      });
    } else {
      G.rooms.forEach(r => {
        const f = { wood: ['#b7825a', '#a8744d'], wood2: ['#c48d62', '#b47d53'], tile: ['#f1f5f9', '#e2e8f0'], carpet: ['#8b7fb8', '#8174ad'], blue: ['#bae6fd', '#a5d8f5'] }[r.floor];
        ctx.fillStyle = f[0]; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = f[1];
        if (r.floor.startsWith('wood')) for (let y = r.y; y < r.y + r.h; y += 36) ctx.fillRect(r.x, y, r.w, 2);
        else if (r.floor === 'carpet') for (let y = r.y; y < r.y + r.h; y += 12) for (let x = r.x + ((y / 12) % 2) * 6; x < r.x + r.w; x += 12) ctx.fillRect(x, y, 2, 2);
        else for (let y = r.y; y < r.y + r.h; y += 50) for (let x = r.x + ((y / 50) % 2) * 50; x < r.x + r.w; x += 100) ctx.fillRect(x, y, 50, 50);
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 8; ctx.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.font = '800 38px system-ui'; ctx.textAlign = 'center'; ctx.fillText(r.name.toUpperCase(), r.x + r.w / 2, r.y + r.h / 2);
      });
      /* portas (aberturas) nas paredes */
      ctx.fillStyle = '#c48d62';
      [[880, 250, 40, 110], [380, 580, 130, 40], [1160, 800, 40, 120], [1250, 480, 130, 40], [780, 880, 40, 110]].forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
    }
  }

  function drawObj(G, ctx, o) {
    const r = o.r;
    let s = 1;
    if (o.falling) { const k = Math.min(1, o.falling.t / .4); s = 1 - k * .85; ctx.globalAlpha = 1 - k * .6; }
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s);
    const sh = (dx, dy, rr) => { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(dx, dy, rr, rr * .7, 0, 0, TAU); ctx.fill(); };
    switch (o.k) {
      case 'tree': sh(4, 5, r); ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(-r * .25, -r * .25, r * .6, 0, TAU); ctx.fill(); break;
      case 'person': ctx.fillStyle = `hsl(${(o.id * 57) % 360},60%,55%)`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(0, 0, r * .55, 0, TAU); ctx.fill(); break;
      case 'bench': ctx.rotate(o.a); ctx.fillStyle = '#92400e'; ctx.fillRect(-r, -r * .4, r * 2, r * .8); break;
      case 'lamp': case 'cone': ctx.fillStyle = o.k === 'cone' ? '#f97316' : '#334155'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); if (o.k === 'lamp') { ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(0, 0, r * .5, 0, TAU); ctx.fill(); } break;
      case 'fountain': sh(3, 4, r); ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(0, 0, r * .75, 0, TAU); ctx.fill(); ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.arc(0, 0, r * .2, 0, TAU); ctx.fill(); break;
      case 'kiosk': sh(4, 5, r); ctx.fillStyle = '#f59e0b'; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.fillStyle = '#fff'; ctx.fillRect(-r, -r, r * 2, r * .5); break;
      case 'house': {
        sh(8, 10, r * 1.1); const w = r * 1.5;
        ctx.fillStyle = `hsl(${o.hue},35%,70%)`; ctx.fillRect(-w / 2, -w / 2, w, w);
        ctx.fillStyle = `hsl(${o.hue},55%,42%)`; ctx.beginPath(); ctx.moveTo(-w / 2 - 3, -w / 2); ctx.lineTo(0, -w / 2 - r * .45); ctx.lineTo(w / 2 + 3, -w / 2); ctx.lineTo(w / 2 + 3, w / 2); ctx.lineTo(-w / 2 - 3, w / 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `hsl(${o.hue},55%,32%)`; ctx.fillRect(-2, -w / 2 - r * .45, 4, w + r * .45);
        break;
      }
      case 'tower': {
        const w = r * 1.45, hgt = r * .45;
        sh(hgt, hgt * 1.2, r * 1.15);
        ctx.fillStyle = `hsl(${o.hue},25%,35%)`; ctx.fillRect(-w / 2 + hgt * .3, -w / 2 + hgt * .3, w, w);
        ctx.fillStyle = `hsl(${o.hue},30%,58%)`; ctx.fillRect(-w / 2, -w / 2, w, w);
        ctx.fillStyle = `hsla(${o.hue},60%,85%,.8)`;
        for (let a = -w / 2 + 8; a < w / 2 - 6; a += 14) for (let b = -w / 2 + 8; b < w / 2 - 6; b += 14) ctx.fillRect(a, b, 7, 7);
        break;
      }
      case 'car': case 'bus': {
        ctx.rotate(o.a); const L = r * (o.k === 'bus' ? 2.3 : 1.7), Wd = r * (o.k === 'bus' ? .95 : .9);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-L / 2 + 3, -Wd / 2 + 3, L, Wd);
        ctx.fillStyle = o.k === 'bus' ? '#facc15' : `hsl(${o.hue},70%,50%)`; U.rr(ctx, -L / 2, -Wd / 2, L, Wd, 4); ctx.fill();
        ctx.fillStyle = 'rgba(191,219,254,.9)'; ctx.fillRect(L * .1, -Wd / 2 + 3, L * .22, Wd - 6); ctx.fillRect(-L * .38, -Wd / 2 + 3, L * .14, Wd - 6);
        break;
      }
      default: drawHouseObj(ctx, o, sh);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function drawHouseObj(ctx, o, sh) {
    const r = o.r;
    const rect = (w, h, c, c2) => { ctx.fillStyle = c; U.rr(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * .15); ctx.fill(); if (c2) { ctx.fillStyle = c2; U.rr(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h * .35, 4); ctx.fill(); } };
    switch (o.k) {
      case 'rug': ctx.fillStyle = '#b91c1c'; ctx.globalAlpha *= .6; U.rr(ctx, -150, -95, 300, 190, 16); ctx.fill(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4; ctx.stroke(); break;
      case 'sofa': sh(6, 8, r * 1.2); rect(r * 2.2, r * 1.1, '#475569', '#64748b'); break;
      case 'armchair': sh(4, 6, r); rect(r * 1.6, r * 1.6, '#64748b', '#94a3b8'); break;
      case 'table': case 'ktable': sh(6, 8, r * 1.1); ctx.fillStyle = o.k === 'table' ? '#78350f' : '#e7e5e4'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 3; ctx.stroke(); break;
      case 'tv': sh(3, 4, r); rect(r * 2, r * .5, '#111827'); break;
      case 'plant': sh(3, 4, r); ctx.fillStyle = '#c2410c'; ctx.beginPath(); ctx.arc(0, 0, r * .55, 0, TAU); ctx.fill(); ctx.fillStyle = '#16a34a'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(Math.cos(i) * r * .5, Math.sin(i) * r * .5, r * .45, r * .2, i, 0, TAU); ctx.fill(); } break;
      case 'lamp2': sh(2, 3, r); ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2; ctx.stroke(); break;
      case 'fridge': sh(6, 8, r); rect(r * 1.4, r * 1.4, '#e5e7eb', '#f8fafc'); break;
      case 'stove': sh(4, 6, r); rect(r * 1.5, r * 1.3, '#374151'); ctx.fillStyle = '#111'; [[-.35, -.25], [.35, -.25], [-.35, .25], [.35, .25]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a * r, b * r, r * .2, 0, TAU); ctx.fill(); }); break;
      case 'chair': sh(3, 4, r); rect(r * 1.3, r * 1.3, '#a16207', '#ca8a04'); break;
      case 'bed': sh(8, 10, r * 1.2); rect(r * 1.5, r * 2, '#e0e7ff'); ctx.fillStyle = '#fff'; U.rr(ctx, -r * .6, -r * .9, r * 1.2, r * .4, 6); ctx.fill(); ctx.fillStyle = '#6366f1'; U.rr(ctx, -r * .75, -r * .2, r * 1.5, r * 1.15, 6); ctx.fill(); break;
      case 'wardrobe': sh(8, 10, r); rect(r * 1.8, r * 1.1, '#92400e', '#b45309'); break;
      case 'desk': sh(5, 6, r); rect(r * 2, r * 1.1, '#a16207', '#ca8a04'); break;
      case 'bath': sh(5, 6, r); rect(r * 1.4, r * 2, '#f8fafc'); ctx.fillStyle = '#7dd3fc'; U.rr(ctx, -r * .55, -r * .85, r * 1.1, r * 1.7, 14); ctx.fill(); break;
      case 'toilet': case 'sink': sh(2, 3, r); ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(0, 0, r * .8, r, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.ellipse(0, r * .1, r * .5, r * .6, 0, 0, TAU); ctx.fill(); break;
      case 'piano': sh(8, 10, r); rect(r * 1.9, r * 1.2, '#0f172a'); ctx.fillStyle = '#f8fafc'; ctx.fillRect(-r * .9, r * .25, r * 1.8, r * .3); break;
      case 'shoe_rack': sh(3, 4, r); rect(r * 2, r * .8, '#57534e', '#78716c'); break;
      case 'crumb': ctx.fillStyle = '#d6b48a'; ctx.fillRect(-r * .8, -r * .6, r * 1.6, r * 1.2); break;
      case 'dust': ctx.fillStyle = 'rgba(148,163,184,.9)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.arc(r * .6, -r * .3, r * .6, 0, TAU); ctx.fill(); break;
      case 'coin': ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); break;
      case 'lego': ctx.rotate(o.a); ctx.fillStyle = `hsl(${o.hue},80%,55%)`; ctx.fillRect(-r, -r * .6, r * 2, r * 1.2); break;
      case 'sock': ctx.rotate(o.a); ctx.fillStyle = `hsl(${o.hue},60%,60%)`; U.rr(ctx, -r, -r * .35, r * 1.6, r * .7, 3); ctx.fill(); U.rr(ctx, r * .3, -r * .35, r * .7, r * 1.1, 3); ctx.fill(); break;
      case 'toycar': ctx.rotate(o.a); ctx.fillStyle = `hsl(${o.hue},75%,50%)`; U.rr(ctx, -r, -r * .55, r * 2, r * 1.1, 3); ctx.fill(); break;
      case 'shoe': ctx.rotate(o.a); ctx.fillStyle = '#1f2937'; U.rr(ctx, -r, -r * .45, r * 2, r * .9, 5); ctx.fill(); break;
      case 'book': ctx.rotate(o.a); ctx.fillStyle = `hsl(${o.hue},55%,45%)`; ctx.fillRect(-r * .8, -r * .6, r * 1.6, r * 1.2); ctx.fillStyle = '#fff'; ctx.fillRect(r * .6, -r * .55, r * .15, r * 1.1); break;
      case 'cushion': sh(2, 3, r); ctx.rotate(o.a); ctx.fillStyle = `hsl(${o.hue},55%,60%)`; U.rr(ctx, -r * .8, -r * .8, r * 1.6, r * 1.6, 6); ctx.fill(); break;
      case 'ball': ctx.fillStyle = `hsl(${o.hue},80%,55%)`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(-r * .3, -r * .3, r * .3, 0, TAU); ctx.fill(); break;
      case 'teddy': sh(2, 3, r); ctx.fillStyle = '#a16207'; ctx.beginPath(); ctx.arc(0, 0, r * .8, 0, TAU); ctx.arc(-r * .6, -r * .6, r * .3, 0, TAU); ctx.arc(r * .6, -r * .6, r * .3, 0, TAU); ctx.fill(); break;
      case 'box': sh(3, 4, r); ctx.rotate(o.a * .2); ctx.fillStyle = '#d6a064'; ctx.fillRect(-r * .8, -r * .8, r * 1.6, r * 1.6); ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * .8, 0); ctx.lineTo(r * .8, 0); ctx.stroke(); break;
      default: ctx.fillStyle = '#999'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    }
  }

  function drawHole(G, ctx, h, t) {
    const R = h.R * (1 + h.pulse * .3);
    if (G.vac) {
      /* aspirador-robô visto de cima */
      ctx.fillStyle = `rgba(0,0,0,${.08})`; ctx.beginPath(); ctx.arc(h.x, h.y, h.R * 1.9, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([4, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, h.R * 1.9, t * 2, t * 2 + TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(h.x + 3, h.y + 5, R, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(h.x - R * .3, h.y - R * .3, R * .1, h.x, h.y, R);
      g.addColorStop(0, '#f8fafc'); g.addColorStop(1, '#94a3b8');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = h.color; ctx.lineWidth = Math.max(3, R * .14); ctx.beginPath(); ctx.arc(h.x, h.y, R * .9, -2.4, -.7); ctx.stroke();
      ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(h.x, h.y, R * .42, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(a) * R * .4, h.y + Math.sin(a) * R * .4); ctx.stroke(); }
      ctx.fillStyle = h.color; ctx.beginPath(); ctx.arc(h.x + R * .55, h.y - R * .1, Math.max(2, R * .09), 0, TAU); ctx.fill();
    } else {
      const g = ctx.createRadialGradient(h.x, h.y, R * .2, h.x, h.y, R);
      g.addColorStop(0, '#000'); g.addColorStop(.8, '#0b0b12'); g.addColorStop(1, '#1f2937');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = h.color; ctx.lineWidth = Math.max(2.5, R * .08); ctx.beginPath(); ctx.arc(h.x, h.y, R, 0, TAU); ctx.stroke();
    }
  }

  function draw(G, ctx, W, H, api) {
    const c = G.cam, z = c.z;
    ctx.fillStyle = G.vac ? '#334155' : '#1f2937'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-c.x, -c.y);
    const vx0 = c.x - W / 2 / z - 80, vx1 = c.x + W / 2 / z + 80, vy0 = c.y - H / 2 / z - 80, vy1 = c.y + H / 2 / z + 80;
    drawGround(G, ctx);
    const vis = o => !o.gone && o.x + o.r * 2 > vx0 && o.x - o.r * 2 < vx1 && o.y + o.r * 2 > vy0 && o.y - o.r * 2 < vy1;
    const list = G.objs.filter(vis);
    if (!G.vac) {
      G.holes.forEach(h => { if (!h.dead) drawHole(G, ctx, h, G.t); });
      /* objetos a cair ficam recortados dentro do buraco */
      list.filter(o => o.falling).forEach(o => { const h = o.falling.h; ctx.save(); ctx.beginPath(); ctx.arc(h.x, h.y, h.R, 0, TAU); ctx.clip(); drawObj(G, ctx, o); ctx.restore(); });
      list.filter(o => !o.falling).sort((a, b) => a.r - b.r).forEach(o => drawObj(G, ctx, o));
    } else {
      list.filter(o => o.deco).forEach(o => drawObj(G, ctx, o));
      list.filter(o => !o.deco && o.r < 20).forEach(o => drawObj(G, ctx, o));
      G.holes.forEach(h => { if (!h.dead) drawHole(G, ctx, h, G.t); });
      list.filter(o => !o.deco && o.r >= 20).forEach(o => { const under = G.holes.some(h => !h.dead && U.dist(h.x, h.y, o.x, o.y) < o.r + h.R); ctx.globalAlpha = under ? .55 : 1; drawObj(G, ctx, o); ctx.globalAlpha = 1; });
    }
    /* nomes */
    G.holes.forEach(h => { if (h.dead) return; ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(12, 13 / z)}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 3 / z; ctx.strokeStyle = 'rgba(0,0,0,.6)'; const y = h.y - h.R - 10 / z; ctx.strokeText(h.name, h.x, y); ctx.fillText(h.name, h.x, y); });
    ctx.restore();
    /* classificação ao vivo */
    if (G.mode !== 'solo') {
      const rk = ranking(G);
      ctx.fillStyle = 'rgba(0,0,0,.4)'; U.rr(ctx, W - 132, 66, 122, 16 + rk.length * 18, 10); ctx.fill();
      rk.forEach((h, i) => { ctx.fillStyle = h === G.me ? '#86efac' : '#e5e7eb'; ctx.font = `${h === G.me ? 800 : 600} 12px system-ui`; ctx.textAlign = 'left'; ctx.fillText(`${i + 1}. ${h.name}`, W - 124, 86 + i * 18); ctx.textAlign = 'right'; ctx.fillText(h.score, W - 16, 86 + i * 18); });
    } else {
      const k = G.objs.filter(o => o.gone).length / G.total;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; U.rr(ctx, 14, H - 26, W - 28, 10, 5); ctx.fill();
      ctx.fillStyle = '#22d3ee'; U.rr(ctx, 14, H - 26, (W - 28) * k, 10, 5); ctx.fill();
    }
    if (G.me.dead > 0) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = "800 22px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.fillText('A renascer… ' + Math.ceil(G.me.dead), W / 2, H / 2); }
    /* joystick (toque) */
    if (G.joy && G.joy.touch) { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(G.joy.x0, G.joy.y0, 42, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(G.joy.x0 + G.joy.dx * 36 * G.joy.m, G.joy.y0 + G.joy.dy * 36 * G.joy.m, 16, 0, TAU); ctx.fill(); }
  }

  function setJoy(G, x, y, api, e, down) {
    if (e.pointerType === 'mouse') {
      const dx = x - api.W / 2, dy = y - api.H / 2, d = Math.hypot(dx, dy);
      G.joy = d < 14 ? { dx: 0, dy: 0 } : { dx: dx / d * Math.min(1, d / 90), dy: dy / d * Math.min(1, d / 90) };
      return;
    }
    if (down) { G.joy = { touch: true, x0: x, y0: y, dx: 0, dy: 0, m: 0 }; return; }
    if (!G.joy) return;
    const dx = x - G.joy.x0, dy = y - G.joy.y0, d = Math.hypot(dx, dy);
    G.joy.m = Math.min(1, d / 42);
    if (d > 4) { G.joy.dx = dx / d * G.joy.m; G.joy.dy = dy / d * G.joy.m; }
  }

  return ArcadeKit.create({
    id: 'hole', title: 'Buraco Guloso', icon: '🕳️',
    accent: '#22c55e', accent2: '#22d3ee', bg: '#1f2937', aspect: 'wide',
    tagline: 'És um buraco — ou um aspirador — que engole tudo o que for mais pequeno. Quanto mais comes, mais cresces.',
    view: { w: 560 },
    modes: [
      { id: 'city', icon: '🏙️', name: 'Cidade', desc: 'Buraco contra 4 rivais durante 2 minutos. Os maiores engolem os mais pequenos.' },
      { id: 'vacuum', icon: '🧹', name: 'Aspirador', desc: 'Um aspirador-robô numa casa, contra 3 aspiradores rivais. A sucção puxa o lixo.' },
      { id: 'solo', icon: '🧽', name: 'Limpeza geral', desc: 'Só tu e a casa. Aspira o máximo possível antes de o tempo acabar.' },
    ],
    how: [
      '<b>Rato:</b> o buraco vai na direção do cursor (quanto mais longe, mais depressa). <b>Toque:</b> um joystick aparece onde puseres o dedo. Também dá com as setas ou WASD.',
      'Só cabe o que for mais pequeno do que tu: começa pelas pessoas, cones e migalhas, depois árvores, carros, casas… O tamanho sobe com cada coisa engolida.',
      'Nos modos com rivais, se fores bem maior do que outro buraco podes engoli-lo — e eles a ti. Ganha quem tiver mais pontos no fim.',
    ],
    controls: ['🖱️ Apontar com o rato', '👆 Joystick onde tocares', '⌨️ Setas / WASD'],
    ready: { title: 'Toca para começar', hint: 'Engole o que for mais pequeno do que tu.' },
    setup, update, draw,
    down: (G, x, y, api, e) => setJoy(G, x, y, api, e, true),
    move: (G, x, y, api, e, isDown) => { if (e.pointerType === 'mouse' || isDown) setJoy(G, x, y, api, e, false); },
    up: (G, x, y, api, e) => { if (e.pointerType !== 'mouse') G.joy = null; },
    key: (G, e) => {
      const m = { ArrowLeft: [0, -1], a: [0, -1], ArrowRight: [0, 1], d: [0, 1], ArrowUp: [1, -1], w: [1, -1], ArrowDown: [1, 1], s: [1, 1] }[e.key];
      if (m) { G.keys[m[0]] = m[1]; return true; }
    },
    keyup: (G, e) => { if (/^(ArrowLeft|ArrowRight|a|d)$/.test(e.key)) G.keys[0] = 0; if (/^(ArrowUp|ArrowDown|w|s)$/.test(e.key)) G.keys[1] = 0; },
    hud: G => [['Tempo', Math.ceil(G.time) + 's', G.time < 11 ? 'hot' : ''], ['Pontos', G.me.score], G.mode === 'solo' ? ['Limpo', Math.round(100 * G.objs.filter(o => o.gone).length / G.total) + '%'] : ['Lugar', (ranking(G).indexOf(G.me) + 1) + '.º']],
    achievements: [
      { id: 'ho.win',  name: 'O Maior Buraco',  icon: '🕳️', desc: 'Acaba em 1.º lugar na Cidade.', test: c => /^city/.test(c.result.mode || '') && (c.result.meta || {}).pos === 1 },
      { id: 'ho.vac',  name: 'Aspirador de Ouro', icon: '🧹', desc: 'Ganha uma batalha de aspiradores.', test: c => /^vacuum/.test(c.result.mode || '') && (c.result.meta || {}).pos === 1 },
      { id: 'ho.clean', name: 'Casa a Brilhar', icon: '✨', desc: 'Deixa a casa 80% limpa na Limpeza geral.', test: c => /^solo/.test(c.result.mode || '') && ((c.result.meta || {}).clean || 0) >= 80 },
    ],
  });
})();
