/* ══════════════════════════════════════════════════════════════════
   Parte-Tijolos (Brick Breaker) — raquete, bola, parede de tijolos.
   12 níveis desenhados à mão e depois níveis gerados. Tijolos de 1 a
   4 toques, metal (indestrutível), explosivos ✸, elétricos ⚡ (dão um
   choque aos vizinhos) e de prenda ★; 14 cápsulas (larga, multibola,
   lenta, laser, fogo, íman, barreira, bola gigante, pontos ×2,
   bola-bomba, diamante, vida — e as más: encolhe e bola rápida).
   Rato: raquete segue o cursor. Toque: arrasto relativo (o dedo não
   tapa a bola). Colisão bola–tijolo em sub-passos, eixo pela menor
   penetração. Animações (out/2026): tijolos caem no início do nível,
   estilhaços 3D e ondas de choque, raquete que amassa e inclina,
   celebração com estrelas no fim de cada nível. Tudo o que é atrasado
   (explosões em cadeia, choques) corre pelo relógio do jogo — em pausa
   espera.
══════════════════════════════════════════════════════════════════ */
const BrickBreakerGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const COLS = 10, BW = 37.2, BH = 16, TOP = 92, LEFT = 14, BR = 6;
  const LEVELS = [
    ['..........', '.11111111.', '.11111111.', '.22222222.', '.22222222.', '..........', '...G..G...'],
    ['1.1.1.1.1.', '.2.2.2.2.2', '1.1.1.1.1.', '.2.2.2.2.2', '1.1.1.1.1.', '.G.2Z2.G.2'],
    ['3333333333', '2........2', '2.111111.2', '2.1GXX1.2.', '2.111111.2', '2........2', '3333333333'],
    ['....11....', '...1221...', '..123321..', '.12Z44Z21.', '..123321..', '...1G21...', '....11....'],
    ['MM......MM', '1111111111', '2222XX2222', '3333333333', '..MMMMMM..', '..G....G..'],
    ['1.........', '12........', '123.......', '1234......', '12341.....', '123412....', '1234123...', '1234123ZGX'],
    ['X1X1X1X1X1', '1111111111', '2222222222', 'M2M2M2M2M2', '3333333333', '..G.ZZ.G..'],
    ['4........4', '.4......4.', '..4XXXX4..', '...4GG4...', '..4....4..', '.4......4.', '4........4'],
    ['1111111111', 'M.M.M.M.M.', '2222222222', '.M.M.M.M.M', '3333333333', 'M.M.GG.M.M', '4444444444'],
    ['..333333..', '.3......3.', '3..Z..Z..3', '3........3', '3.4....4.3', '3..4444..3', '.3..GX..3.', '..333333..'],
    ['MMMMMMMMMM', '4X4X4X4X4X', '3333333333', '2222222222', '1111111111', 'MMMM..MMMM', '....GG....'],
    ['4444444444', '4MMMMMMMM4', '4M333333M4', '4M3XXXX3M4', '4M3GZZG3M4', '4M333333M4', '4MMM..MMM4', '4444444444'],
  ];
  const COL = { 1: ['#60a5fa', '#1d4ed8'], 2: ['#4ade80', '#15803d'], 3: ['#fbbf24', '#b45309'], 4: ['#f472b6', '#be185d'], X: ['#fb923c', '#c2410c'], G: ['#c084fc', '#7e22ce'], Z: ['#22d3ee', '#0e7490'] };
  const ICO = { X: '💥', G: '⭐', Z: '⚡' };
  const PW = { easy: 98, medium: 82, hard: 68 };
  const SPD = { easy: .85, medium: 1, hard: 1.18 };
  /* cápsulas: dur = segundos do efeito; bad = das que atrapalham */
  const POW = {
    wide:   { ico: '↔',  col: '#38bdf8', name: 'Raquete larga', dur: 12 },
    multi:  { ico: '⁂',  col: '#f472b6', name: 'Multibola' },
    slow:   { ico: '🐢', col: '#4ade80', name: 'Bola lenta', dur: 8 },
    laser:  { ico: '⇈',  col: '#f87171', name: 'Laser', dur: 8 },
    fire:   { ico: '🔥', col: '#fb923c', name: 'Bola de fogo', dur: 6 },
    magnet: { ico: '🧲', col: '#a78bfa', name: 'Íman: a bola cola', dur: 10 },
    shield: { ico: '🛡️', col: '#2dd4bf', name: 'Barreira', dur: 12 },
    mega:   { ico: '●',  col: '#e879f9', name: 'Bola gigante', dur: 9 },
    x2:     { ico: '×2', col: '#fde047', name: 'Pontos a dobrar', dur: 10 },
    bomb:   { ico: '💣', col: '#f97316', name: 'Bola-bomba ×3' },
    gem:    { ico: '💎', col: '#67e8f9', name: 'Diamante' },
    life:   { ico: '❤',  col: '#ef4444', name: '+1 vida' },
    shrink: { ico: '↘',  col: '#94a3b8', name: 'Raquete curta!', dur: 10, bad: true },
    fast:   { ico: '⏩', col: '#94a3b8', name: 'Bola rápida!', dur: 7, bad: true },
  };
  const DROPS = ['wide', 'wide', 'multi', 'multi', 'slow', 'laser', 'fire', 'magnet', 'shield', 'mega', 'x2', 'bomb', 'gem', 'shrink', 'fast'];
  const store = () => (typeof GameProgress !== 'undefined' ? GameProgress.store('brick-breaker') : { getPref: (k, d) => d, setPref: () => {} });

  function genLevel(n) {
    const rows = [], hp = Math.min(4, 1 + Math.floor(n / 4));
    const sym = Math.random() < .6;
    for (let r = 0; r < 8; r++) {
      let row = '';
      for (let c = 0; c < COLS; c++) {
        const cc = sym && c >= 5 ? 9 - c : c;
        const seed = Math.sin((r + 1) * 12.9 + (cc + 1) * 78.2 + n * 3.1) * 43758.5; const f = seed - Math.floor(seed);
        row += f < .12 ? '.' : f < .17 ? 'M' : f < .21 ? 'X' : f < .24 ? 'G' : f < .27 ? 'Z' : String(U.clamp(Math.ceil(f * hp * 1.2), 1, 4));
      }
      rows.push(row);
    }
    return rows;
  }

  function loadLevel(G, n) {
    const def = n <= LEVELS.length ? LEVELS[n - 1] : genLevel(n);
    G.level = n; G.bricks = [];
    def.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const hp = ch === 'M' ? Infinity : ch === 'X' || ch === 'G' || ch === 'Z' ? 1 : +ch;
      /* dl = atraso da queda na entrada do nível (onda de cima para baixo) */
      G.bricks.push({ x: LEFT + c * BW, y: TOP + r * (BH + 4), w: BW - 3, h: BH, t: ch, hp, max: hp, hit: 0, wob: 0, dl: .08 + r * .055 + Math.abs(c - 4.5) * .022 });
    }));
    G.introT = 0; G.introEnd = Math.max(...G.bricks.map(b => b.dl)) + .42;
    G.caps = []; G.shots = []; G.effects = {}; G.bombs = 0; G.q = []; G.bolts = []; G.rings = []; G.shards = [];
    G.cleared = false; G.panelOn = false; G.lvlLost = 0;
    G.pw = G.basePw;
    resetBall(G);
    if (n > (store().getPref('maxLevel', 1))) store().setPref('maxLevel', n);
  }

  function resetBall(G) { G.balls = [{ x: G.px, y: G.py - BR - 1, vx: 0, vy: 0, stuck: true, off: 0, trail: [] }]; G.combo = 0; }
  const speed = G => Math.min(720, (320 + G.level * 12) * SPD[G.diff] * (G.effects.slow > 0 ? .7 : 1) * (G.effects.fast > 0 ? 1.28 : 1));
  const ballR = G => (G.effects.mega > 0 ? BR * 1.8 : BR);
  const aimAng = G => Math.sin(G.t * 2.1) * .62;
  const colorOf = b => (b.t === 'M' ? '#cbd5e1' : (COL[b.t === 'X' || b.t === 'G' || b.t === 'Z' ? b.t : Math.min(b.hp === Infinity ? 1 : Math.max(1, b.hp), 4)] || COL[1])[0]);
  function addPts(G, p) { const v = p * (G.effects.x2 > 0 ? 2 : 1); G.score += v; return v; }
  function pwCalc(G) { G.pw = U.clamp(G.basePw * (G.effects.wide > 0 ? 1.4 : 1) * (G.effects.shrink > 0 ? .68 : 1), 44, G.basePw * 1.6); }
  function rescale(G) { const s = speed(G); G.balls.forEach(b => { if (b.stuck) return; const v = Math.hypot(b.vx, b.vy) || 1; b.vx *= s / v; b.vy *= s / v; }); }

  function setup(api, o) {
    const diff = o.diff || 'medium';
    const G = { diff, basePw: PW[diff], pw: PW[diff], px: api.W / 2, ppx: api.W / 2, pvx: 0, psq: 0, py: api.H - 58, lives: 3, score: 0, bestCombo: 0, t: 0, pause: 0, bricksBroken: 0, shieldHit: 0 };
    const start = o.mode === 'cont' ? Math.max(1, store().getPref('maxLevel', 1)) : 1;
    loadLevel(G, start);
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build3D(G, api); } catch (e) { console.warn('[tijolos] 3D falhou', e); } }).catch(() => {});
    return G;
  }

  function launch(G, api, force) {
    const st = G.balls.filter(b => b.stuck); if (!st.length) return;
    if (!force && G.introT < G.introEnd) return;      /* os tijolos ainda estão a cair */
    const s = speed(G), a0 = aimAng(G);
    st.forEach(b => {
      const a = b.off ? U.clamp(b.off / (G.pw / 2), -1, 1) * .9 : a0;
      b.stuck = false; b.off = 0; b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s;
    });
    api.sfx.tone(520, .06, 'triangle', .06, 0, 780);
  }

  /* ── efeitos visuais (estado no G, animados no update) ── */
  function shards(G, cx, cy, col, n) {
    for (let i = 0; i < n; i++) G.shards.push({ x: cx + U.rand(-13, 13), y: cy + U.rand(-5, 5), z: 10, vx: U.rand(-170, 170), vy: U.rand(-170, 170), vz: U.rand(140, 420), s: U.rand(3.5, 7.5), rx: U.rand(0, 6), ry: U.rand(0, 6), wx: U.rand(-14, 14), wy: U.rand(-14, 14), col, life: U.rand(.7, 1.15) });
    if (G.shards.length > 260) G.shards.splice(0, G.shards.length - 260);
  }
  const ring = (G, x, y, col, r1, d, r0) => G.rings.push({ x, y, col, r0: r0 || 6, r1: r1 || 34, d: d || .32, t: 0 });
  function fx(G, dt) {
    for (let i = G.q.length - 1; i >= 0; i--) { const e = G.q[i]; e.t -= dt; if (e.t <= 0) { G.q.splice(i, 1); e.fn(); } }
    for (let i = G.shards.length - 1; i >= 0; i--) {
      const s = G.shards[i]; s.life -= dt; if (s.life <= 0) { G.shards.splice(i, 1); continue; }
      s.vz -= 1150 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.rx += s.wx * dt; s.ry += s.wy * dt;
      if (s.z < s.s / 2) { s.z = s.s / 2; s.vz = Math.abs(s.vz) * .32; s.vx *= .62; s.vy *= .62; s.wx *= .6; s.wy *= .6; }
    }
    for (let i = G.rings.length - 1; i >= 0; i--) { const r = G.rings[i]; r.t += dt; if (r.t >= r.d) G.rings.splice(i, 1); }
    for (let i = G.bolts.length - 1; i >= 0; i--) { const b = G.bolts[i]; b.t -= dt; if (b.t <= 0) G.bolts.splice(i, 1); }
    G.bricks.forEach(b => { if (b.hit > 0) b.hit -= dt; if (b.wob > 0) b.wob = Math.max(0, b.wob - dt * 3.2); });
    if (G.cpop) { G.cpop.t -= dt; if (G.cpop.t <= 0) G.cpop = null; }
    G.psq = Math.max(0, G.psq - dt * 5.5); G.shieldHit = Math.max(0, G.shieldHit - dt * 3);
  }

  function hitBrick(G, api, br, ball) {
    if (br.dead) return true;
    if (br.hp === Infinity) { br.hit = .15; br.wob = .6; api.sfx.tone(1400, .04, 'square', .03); return false; }
    /* bola-bomba: o próximo tijolo que a bola toca rebenta com os vizinhos */
    if (ball && G.bombs > 0) {
      G.bombs--; br.hp = 0; breakBrick(G, api, br, 'boom');
      if (br.t !== 'X') explodeAt(G, api, br);
      return true;
    }
    br.hp -= ball && G.effects.mega > 0 ? 2 : 1; br.hit = .15; br.wob = 1;
    if (br.hp > 0) {
      api.sfx.tone(400 + br.hp * 90, .05, 'triangle', .05); addPts(G, 5);
      for (let i = 0; i < 4; i++) api.spark({ x: br.x + br.w / 2 + U.rand(-10, 10), y: br.y + br.h / 2, vx: U.rand(-80, 80), vy: U.rand(-90, 30), color: colorOf(br), size: U.rand(1.2, 2.4), life: .35, gravity: 380 });
      return false;
    }
    breakBrick(G, api, br);
    return true;
  }
  function breakBrick(G, api, br, why) {
    if (br.dead) return;
    br.dead = true; G.bricksBroken++;
    G.combo++; G.bestCombo = Math.max(G.bestCombo, G.combo);
    const got = addPts(G, 10 * Math.min(br.max === Infinity ? 1 : br.max, 4) + Math.min(G.combo, 12) * 2);
    const cx = br.x + br.w / 2, cy = br.y + br.h / 2, c = colorOf(br);
    shards(G, cx, cy, c, why === 'boom' ? 9 : 7);
    ring(G, cx, cy, c, why === 'boom' ? 44 : 32);
    for (let i = 0; i < 6; i++) api.spark({ x: cx, y: cy, vx: U.rand(-150, 150), vy: U.rand(-120, 120), color: c, size: U.rand(1.5, 3), life: .4, gravity: 300 });
    api.float(cx, cy - 2, '+' + got, G.effects.x2 > 0 ? '#fde047' : c, 12);
    api.sfx.tone(600 + Math.min(G.combo, 16) * 45, .06, 'sine', .07);
    if (G.combo >= 5 && G.combo % 5 === 0) {
      G.cpop = { n: G.combo, t: 1.3 };           /* um só distintivo que se atualiza (floats empilhavam-se) */
      if (G.combo % 10 === 0) { api.flash('#fde047', .07); api.sfx.arp([784, 988, 1175], .05, .08, 'triangle', .06); }
    }
    if (br.t === 'X') explodeAt(G, api, br);
    if (br.t === 'Z') zap(G, api, br);
    const chance = br.t === 'G' ? 1 : .12;
    if (Math.random() < chance) {
      const pool = DROPS.slice();
      if (Math.random() < .12) pool.push('life');
      G.caps.push({ x: cx, y: cy, k: U.pick(pool), vy: 115, rot: 0 });
    }
  }
  /* explosão: os vizinhos partem em onda (pelo relógio do jogo, não setTimeout) */
  function explodeAt(G, api, br) {
    const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
    api.shake(8, .28); api.hitstop(.05); api.flash('#fb923c', .08); api.sfx.noise(.3, .13, 0, 380, 'lowpass');
    ring(G, cx, cy, '#fb923c', 78, .42, 10); ring(G, cx, cy, '#fff7ed', 52, .25, 4);
    G.bricks.forEach(o => {
      if (o.dead || o === br || o.hp === Infinity || Math.abs(o.x - br.x) >= BW * 1.6 || Math.abs(o.y - br.y) >= (BH + 4) * 1.6) return;
      const d = Math.hypot(o.x - br.x, o.y - br.y);
      G.q.push({ t: .05 + d / 500, fn: () => { if (!o.dead) { o.hp = 0; breakBrick(G, api, o, 'boom'); } } });
    });
  }
  /* tijolo elétrico: um raio salta para os 3 tijolos mais próximos (−1 toque a cada) */
  function zap(G, api, br) {
    const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
    const tg = G.bricks.filter(o => !o.dead && o !== br && o.hp !== Infinity)
      .map(o => ({ o, d: Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) })).filter(e => e.d < 150).sort((a, b) => a.d - b.d).slice(0, 3);
    api.sfx.noise(.18, .08, 0, 3200, 'highpass'); api.sfx.tone(1600, .12, 'sawtooth', .03, 0, 400);
    tg.forEach(({ o }, i) => {
      const tx = o.x + o.w / 2, ty = o.y + o.h / 2, pts = [[cx, cy]];
      for (let k = 1; k < 6; k++) { const f = k / 6; pts.push([cx + (tx - cx) * f + U.rand(-7, 7), cy + (ty - cy) * f + U.rand(-7, 7)]); }
      pts.push([tx, ty]);
      G.q.push({ t: .06 * (i + 1), fn: () => { G.bolts.push({ pts, t: .26, d: .26 }); if (!o.dead) hitBrick(G, api, o, null); } });
    });
  }

  function catchCap(G, api, k) {
    const p = POW[k];
    api.float(G.px, G.py - 30, k === 'gem' ? '+' + (250 * (G.effects.x2 > 0 ? 2 : 1)) + ' 💎' : p.name, p.bad ? '#fca5a5' : p.col, 16);
    ring(G, G.px, G.py, p.col, 70, .4, 10);
    if (p.bad) { api.sfx.tone(300, .18, 'sawtooth', .05, 0, 150); api.flash('#ef4444', .06); }
    else api.sfx.arp([660, 880, 1100], .05, .1, 'sine', .07);
    if (p.dur) G.effects[k] = p.dur;
    if (k === 'wide') delete G.effects.shrink;
    if (k === 'shrink') delete G.effects.wide;
    if (k === 'slow') delete G.effects.fast;
    if (k === 'fast') delete G.effects.slow;
    if (k === 'wide' || k === 'shrink') pwCalc(G);
    if (k === 'slow' || k === 'fast') rescale(G);
    if (k === 'bomb') G.bombs = Math.min(6, G.bombs + 3);
    if (k === 'gem') addPts(G, 250);
    if (k === 'life') G.lives = Math.min(6, G.lives + 1);
    if (k === 'multi') {
      const src = G.balls.filter(b => !b.stuck).slice(0, 3), s = speed(G);
      if (!src.length) [-.35, .35].forEach(a => G.balls.push({ x: G.px, y: G.py - 14, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, trail: [] }));
      src.forEach(b => [-.4, .4].forEach(da => { const a = Math.atan2(b.vy, b.vx) + da, v = Math.hypot(b.vx, b.vy); G.balls.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, trail: [] }); }));
    }
  }

  function startClear(G, api) {
    G.cleared = true; G.clearT = 0;
    G.stars = G.lvlLost === 0 ? 3 : G.lvlLost === 1 ? 2 : 1;
    G.bonus = 100 + G.lives * 50 + G.stars * 50;
    G.score += G.bonus;
    /* as bolas desfazem-se em brilho; chuva de faíscas a partir do topo */
    G.balls.forEach(b => { for (let i = 0; i < 14; i++) api.spark({ x: b.x, y: b.y, vx: U.rand(-200, 200), vy: U.rand(-220, 120), color: U.pick(['#fde047', '#fff', '#93c5fd', '#f472b6']), size: U.rand(2, 4), life: .9, gravity: 420 }); });
    for (let i = 0; i < 40; i++) api.spark({ x: U.rand(20, api.W - 20), y: U.rand(70, 110), vx: U.rand(-40, 40), vy: U.rand(40, 260), color: U.pick(['#fde047', '#60a5fa', '#f472b6', '#4ade80', '#fff']), size: U.rand(2, 4.5), life: 1.3, gravity: 260, shape: i % 2 ? 'square' : 'dot' });
    G.balls = []; G.caps = []; G.shots = [];
    api.sfx.win(); api.vibe([20, 30, 40]);
    api.banner('Nível limpo!', '★'.repeat(G.stars) + '☆'.repeat(3 - G.stars));
  }
  function levelPanel(G, api) {
    const next = G.level + 1;
    api.panel({ icon: '🧱', title: `Nível ${G.level} limpo!`, big: '+' + G.bonus, stars: G.stars,
      sub: `Pontuação: ${G.score}${G.lvlLost ? ` · ${G.lvlLost} bola${G.lvlLost > 1 ? 's' : ''} perdida${G.lvlLost > 1 ? 's' : ''}` : ' · sem perder bolas'}`,
      buttons: [{ label: '▶ Nível ' + next, primary: true, fn: () => { loadLevel(G, next); api.resume(); api.banner('Nível ' + next, next > LEVELS.length ? 'Nível gerado' : ''); } },
        { label: 'Terminar aqui', fn: () => api.over({ score: G.score, won: true, delay: 0, title: 'Boa partida!', icon: '🧱', stats: [['Níveis', G.level], ['Tijolos', G.bricksBroken], ['Melhor combo', '×' + G.bestCombo]], meta: { level: G.level, combo: G.bestCombo } }) }] });
  }

  function update(G, dt, api) {
    const W = api.W;
    G.py = api.H - 58;
    G.t += dt; G.introT += dt;
    fx(G, dt);
    if (G.cleared) { G.clearT += dt; if (G.clearT > 1.6 && !G.panelOn) { G.panelOn = true; levelPanel(G, api); } return; }
    if (G.pause > 0) { G.pause -= dt; return; }
    for (const k in G.effects) {
      G.effects[k] -= dt;
      if (G.effects[k] <= 0) {
        delete G.effects[k];
        if (k === 'wide' || k === 'shrink') pwCalc(G);
        if (k === 'slow' || k === 'fast') rescale(G);
        if (k === 'magnet') launch(G, api, true);
      }
    }
    if (G.kl || G.kr) G.px += ((G.kr ? 1 : 0) - (G.kl ? 1 : 0)) * 560 * dt;   /* teclado: movimento contínuo enquanto a tecla está premida */
    G.px = U.clamp(G.px, G.pw / 2 + 4, W - G.pw / 2 - 4);
    if (dt > 0) { G.pvx = U.lerp(G.pvx, (G.px - G.ppx) / dt, .25); G.ppx = G.px; }

    /* laser */
    if (G.effects.laser) {
      G.laserT = (G.laserT || 0) - dt;
      if (G.laserT <= 0) { G.laserT = .32; G.shots.push({ x: G.px - G.pw / 2 + 6, y: G.py - 8 }, { x: G.px + G.pw / 2 - 6, y: G.py - 8 }); api.sfx.tone(1200, .04, 'square', .03, 0, 700); }
    }
    for (let i = G.shots.length - 1; i >= 0; i--) {
      const s = G.shots[i]; s.y -= 620 * dt;
      const br = G.bricks.find(b => !b.dead && s.x > b.x && s.x < b.x + b.w && s.y > b.y && s.y < b.y + b.h);
      if (br) { hitBrick(G, api, br, null); G.shots.splice(i, 1); api.spark({ x: s.x, y: s.y, vx: 0, vy: -40, color: '#fca5a5', size: 3, life: .2 }); } else if (s.y < 60) G.shots.splice(i, 1);
    }

    /* bolas */
    const r = ballR(G), sub = 5, sdt = dt / sub;
    for (const b of G.balls) {
      if (b.stuck) { b.x = G.px + (b.off || 0); b.y = G.py - 7 - r; continue; }
      for (let k = 0; k < sub && !b.stuck; k++) {
        b.x += b.vx * sdt; b.y += b.vy * sdt;
        if (b.x < r + 2) { b.x = r + 2; b.vx = Math.abs(b.vx); api.sfx.tone(300, .02, 'sine', .02); }
        if (b.x > W - r - 2) { b.x = W - r - 2; b.vx = -Math.abs(b.vx); api.sfx.tone(300, .02, 'sine', .02); }
        if (b.y < 64 + r) { b.y = 64 + r; b.vy = Math.abs(b.vy); }
        /* raquete */
        if (b.vy > 0 && b.y + r >= G.py - 7 && b.y + r <= G.py + 9 && Math.abs(b.x - G.px) <= G.pw / 2 + r) {
          G.combo = 0; G.psq = 1; api.sfx.tone(330, .05, 'triangle', .06); api.vibe(6);
          for (let i = 0; i < 4; i++) api.spark({ x: b.x, y: G.py - 7, vx: U.rand(-90, 90), vy: U.rand(-120, -30), color: '#bfdbfe', size: 2, life: .3, gravity: 200 });
          if (G.effects.magnet) { b.stuck = true; b.off = U.clamp(b.x - G.px, -G.pw / 2, G.pw / 2); b.vx = b.vy = 0; b.y = G.py - 7 - r; break; }
          const off = U.clamp((b.x - G.px) / (G.pw / 2), -1, 1), a = off * 1.05, s = Math.min(speed(G) * 1.12, Math.hypot(b.vx, b.vy) * 1.012 + 2);
          b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s; b.y = G.py - 7 - r;
        }
        /* barreira de energia por baixo da raquete */
        if (G.effects.shield && b.vy > 0 && b.y + r >= G.py + 24) { b.y = G.py + 24 - r; b.vy = -Math.abs(b.vy); G.shieldHit = 1; api.sfx.tone(880, .08, 'sine', .05, 0, 1320); }
        /* tijolos */
        let best = null, bp = Infinity;
        for (const br of G.bricks) {
          if (br.dead) continue;
          const cx = U.clamp(b.x, br.x, br.x + br.w), cy = U.clamp(b.y, br.y, br.y + br.h);
          const d = Math.hypot(b.x - cx, b.y - cy);
          if (d < r && d < bp) { bp = d; best = { br, cx, cy }; }
        }
        if (best) {
          const { br } = best;
          const broke = hitBrick(G, api, br, b);
          if (!(broke && G.effects.fire)) {
            const ox = Math.min(b.x + r - br.x, br.x + br.w - (b.x - r)), oy = Math.min(b.y + r - br.y, br.y + br.h - (b.y - r));
            if (ox < oy) { b.vx = b.x < br.x + br.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); b.x += b.vx > 0 ? ox : -ox; }
            else { b.vy = b.y < br.y + br.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); b.y += b.vy > 0 ? oy : -oy; }
          }
        }
      }
      /* evita bolas "horizontais" presas para sempre */
      if (!b.stuck && Math.abs(b.vy) < 60) b.vy = (b.vy < 0 ? -1 : 1) * 60;
      b.trail.unshift([b.x, b.y]); if (b.trail.length > 8) b.trail.pop();
    }
    const before = G.balls.length;
    G.balls = G.balls.filter(b => b.y < api.H + 20);
    if (before && !G.balls.length) {
      G.lives--; G.lvlLost++; G.effects = {}; G.bombs = 0; pwCalc(G);
      api.shake(8, .3); api.vibe(80); api.sfx.lose(); api.flash('#ef4444', .1);
      if (G.lives <= 0) { api.over({ score: G.score, won: false, delay: 600, title: 'Sem bolas', icon: '🟦', stats: [['Nível', G.level], ['Tijolos', G.bricksBroken], ['Melhor combo', '×' + G.bestCombo]], meta: { level: G.level, combo: G.bestCombo } }); return; }
      resetBall(G); G.pause = .5;
      api.banner(G.lives === 1 ? 'Última bola!' : G.lives + ' bolas', 'Toca para lançar');
    }
    /* cápsulas */
    for (let i = G.caps.length - 1; i >= 0; i--) {
      const c = G.caps[i]; c.y += c.vy * dt; c.rot += dt * 3;
      if (c.y > G.py - 12 && c.y < G.py + 12 && Math.abs(c.x - G.px) < G.pw / 2 + 12) { catchCap(G, api, c.k); G.caps.splice(i, 1); }
      else if (c.y > api.H + 20) G.caps.splice(i, 1);
    }
    /* nível limpo (espera que as explosões em cadeia acabem) */
    if (!G.q.length && !G.bricks.some(b => !b.dead && b.hp !== Infinity)) startClear(G, api);
  }

  /* entrada do nível: 0 = ainda não caiu, 1 = assente */
  const introK = (G, b) => U.clamp((G.introT - b.dl) / .38, 0, 1);

  /* ════════════════════════════════════════════════════════════════
     3D — câmara a pique sobre a mesa (o plano do jogo coincide com o 2D,
     por isso o rato continua exato). Tijolos envernizados em relevo,
     estilhaços que saltam e ressaltam na mesa, ondas de choque, raquete
     metálica que amassa ao bater, bola que brilha (fogo, gigante, bomba),
     cápsulas com ícone, barreira de energia, bermas que aquecem com o combo.
     1 unidade = 1 px lógico; x = lx − W/2, y = H/2 − ly.
  ════════════════════════════════════════════════════════════════ */
  const BZ = 18;                                          /* altura dos tijolos */
  const _lbl = new Map();
  function labelTex(txt) {
    if (_lbl.has(txt)) return _lbl.get(txt);
    const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle';
    let fs = 70; x.font = `800 ${fs}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    const w = x.measureText(txt).width; if (w > 84) { fs = Math.floor(fs * 84 / w); x.font = `800 ${fs}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`; }
    x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,.35)'; x.strokeText(txt, 48, 52); x.fillStyle = '#fff'; x.fillText(txt, 48, 52);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _lbl.set(txt, t); return t;
  }
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun } = Arcade3D.stdScene({ sky: '#c7d2fe', ground: '#0b1026', hemi: .7, sunI: 2.8, fillC: '#f472b6', fillI: .5, normalBias: .5 });
    const cam = new THREE.PerspectiveCamera(52, 1, 10, 4000);
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#070b1d'; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(96,165,250,.18)'; x.lineWidth = 2; x.strokeRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(96,165,250,.28)'; x.fillRect(30, 30, 4, 4);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: tex, color: '#6b7aa8', roughness: .75, metalness: .15 }));
    floor.receiveShadow = true; scene.add(floor);
    const railM = new THREE.MeshBasicMaterial({ color: '#60a5fa', toneMapped: false });
    const rails = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), railM); scene.add(m); return m; });
    /* tijolos "de rebuçado": verniz (clearcoat) por cima da cor */
    const bricks = new THREE.InstancedMesh(Arcade3D.roundBox(.18), new THREE.MeshPhysicalMaterial({ roughness: .32, metalness: .02, clearcoat: .8, clearcoatRoughness: .15 }), 200);
    bricks.castShadow = true; bricks.receiveShadow = true; bricks.frustumCulled = false;
    const metal = new THREE.InstancedMesh(Arcade3D.roundBox(.18), new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: .18, metalness: .9 }), 80);
    metal.castShadow = true; metal.frustumCulled = false;
    const shardM = new THREE.InstancedMesh(Arcade3D.roundBox(.22), new THREE.MeshStandardMaterial({ roughness: .35, metalness: .05 }), 260);
    shardM.castShadow = true; shardM.frustumCulled = false; shardM.count = 0;
    const paddle = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1, 6, 16), new THREE.MeshStandardMaterial({ color: '#93c5fd', roughness: .2, metalness: .6, emissive: '#1d4ed8', emissiveIntensity: .35 }));
    paddle.castShadow = true; scene.add(paddle);
    const pglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: '#60a5fa', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); scene.add(pglow);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#2dd4bf', transparent: true, opacity: .6, toneMapped: false, depthWrite: false })); scene.add(shield);
    scene.add(bricks, metal, shardM);
    G.r3 = { renderer, scene, sun, cam, floor, tex, railM, rails, bricks, metal, shardM, paddle, pglow, shield, pool: Arcade3D.pool(scene), m4: new THREE.Matrix4(), v: new THREE.Vector3(), sc: new THREE.Vector3(), c: new THREE.Color(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), e: new THREE.Euler(), white: new THREE.Color('#ffffff'), hot: new THREE.Color('#f472b6'), cool: new THREE.Color('#60a5fa') };
    api.stage.style.background = 'radial-gradient(120% 80% at 50% 0%, #0f1a3d, #05060f 70%)';
  }

  function draw3D(G, ctx, W, H, api) {
    const R = G.r3, P = R.pool, { m4, v, sc, c } = R;
    Arcade3D.fit(api.stage, R.cam);
    const X = lx => lx - W / 2, Y = ly => H / 2 - ly;
    /* câmara: o plano z=0 bate certo com o ecrã lógico */
    const D = (H / 2) / Math.tan(R.cam.fov * Math.PI / 360);
    const [shx, shy] = api.shakeXY;
    R.cam.position.set(-shx, shy, D); R.cam.lookAt(-shx, shy, 0);
    R.cam.near = D * .4; R.cam.far = D * 1.6; R.cam.updateProjectionMatrix();
    R.floor.scale.set(W, H, 1); R.floor.position.set(0, 0, -1); R.tex.repeat.set(W / 37.2, H / 37.2);
    R.rails[0].scale.set(4, H, 6); R.rails[0].position.set(X(2), 0, 3);
    R.rails[1].scale.set(4, H, 6); R.rails[1].position.set(X(W - 2), 0, 3);
    R.rails[2].scale.set(W, 4, 6); R.rails[2].position.set(0, Y(62), 3);
    /* as bermas aquecem com o combo */
    R.railM.color.copy(R.cool).lerp(R.hot, U.clamp((G.combo - 3) / 12, 0, 1));
    Arcade3D.sunAt(R.sun, 0, 0, 0, Math.max(W, H) * .6, [-.55, .45, 1]);
    const flat = R.q.setFromAxisAngle(R.v2 || (R.v2 = new THREE.Vector3(1, 0, 0)), Math.PI / 2);
    /* tijolos: queda na entrada + tremido quando levam um toque */
    let nb = 0, nm = 0;
    G.bricks.forEach(b => {
      if (b.dead) return;
      const k = introK(G, b); if (k <= 0) return;
      const drop = Math.pow(1 - k, 3) * 320, hit = b.hit > 0 ? b.hit / .15 : 0, wob = b.wob > 0 ? 1 + Math.sin(b.wob * 22) * .1 * b.wob : 1;
      v.set(X(b.x + b.w / 2), Y(b.y + b.h / 2), BZ / 2 + hit * 2 + drop);
      m4.compose(v, flat, sc.set(b.w * wob, BZ * (2 - wob), b.h * wob));
      if (b.t === 'M') { R.metal.setMatrixAt(nm++, m4); return; }
      c.set(colorOf(b)); if (b.hp < b.max && b.hp !== Infinity) c.multiplyScalar(.78); if (hit) c.lerp(R.white, hit * .7);
      R.bricks.setMatrixAt(nb, m4); R.bricks.setColorAt(nb, c); nb++;
    });
    R.bricks.count = nb; R.bricks.instanceMatrix.needsUpdate = true; if (R.bricks.instanceColor) R.bricks.instanceColor.needsUpdate = true;
    R.metal.count = nm; R.metal.instanceMatrix.needsUpdate = true;
    /* estilhaços */
    let ns = 0;
    G.shards.forEach(s => {
      const k = Math.min(1, s.life * 3);
      R.e.set(s.rx, s.ry, 0); R.q2.setFromEuler(R.e);
      m4.compose(v.set(X(s.x), Y(s.y), s.z), R.q2, sc.set(s.s * k, s.s * k, s.s * k));
      R.shardM.setMatrixAt(ns, m4); R.shardM.setColorAt(ns, c.set(s.col)); ns++;
    });
    R.shardM.count = ns; R.shardM.instanceMatrix.needsUpdate = true; if (R.shardM.instanceColor) R.shardM.instanceColor.needsUpdate = true;
    P.begin();
    /* ícones nos tijolos especiais */
    G.bricks.forEach(b => {
      if (b.dead || !ICO[b.t]) return;
      const k = introK(G, b); if (k <= 0) return;
      const s = P.get('ico' + b.t, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.emojiTex(ICO[b.t], 64), depthTest: false })));
      s.position.set(X(b.x + b.w / 2), Y(b.y + b.h / 2), BZ + 2 + Math.pow(1 - k, 3) * 320); s.scale.set(14, 14, 1);
    });
    /* ondas de choque (anéis que crescem e desvanecem) */
    G.rings.forEach(r => {
      const m = P.get('ring', () => new THREE.Mesh(new THREE.RingGeometry(.84, 1, 44), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
      const k = r.t / r.d, e = 1 - Math.pow(1 - k, 3);
      m.position.set(X(r.x), Y(r.y), 2); m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e); m.material.color.set(r.col); m.material.opacity = (1 - k) * .9;
    });
    /* raquete: amassa ao bater e inclina com a velocidade */
    const pw = G.pw, sq = G.psq;
    const pcol = G.effects.magnet ? '#c4b5fd' : G.effects.laser ? '#fca5a5' : '#93c5fd', pem = G.effects.magnet ? '#6d28d9' : G.effects.laser ? '#b91c1c' : '#1d4ed8';
    R.paddle.scale.set(7 * (1 - sq * .32), pw / 3 * (1 + sq * .07), 7 * (1 - sq * .2));
    R.paddle.rotation.set(0, 0, Math.PI / 2 + U.clamp(-G.pvx * .00018, -.1, .1));
    R.paddle.position.set(X(G.px), Y(G.py), 7 - sq * 1.5);
    R.paddle.material.color.set(pcol); R.paddle.material.emissive.set(pem); R.paddle.material.emissiveIntensity = .35 + sq * .6;
    R.pglow.position.set(X(G.px), Y(G.py), 2); R.pglow.scale.set(pw * 1.6, 40, 1); R.pglow.material.color.set(pcol); R.pglow.material.opacity = .45 + sq * .4;
    R.shield.visible = !!G.effects.shield;
    if (G.effects.shield) { const left = G.effects.shield; R.shield.scale.set(W - 8, 3 + G.shieldHit * 3, 3); R.shield.position.set(0, Y(G.py + 24), 2); R.shield.material.opacity = (left < 2 && Math.floor(left * 6) % 2 ? .15 : .5) + G.shieldHit * .4 + Math.sin(api.t * 6) * .08; }
    /* bolas (com rasto) — fogo, gigante e bomba mudam a cor */
    const kind = G.effects.fire ? 'F' : G.bombs > 0 ? 'B' : G.effects.mega ? 'M' : 'N';
    const BC = { N: ['#ffffff', '#bae6fd', '#7dd3fc'], F: ['#fed7aa', '#fb923c', '#fb923c'], B: ['#fecaca', '#f97316', '#ef4444'], M: ['#fae8ff', '#e879f9', '#f0abfc'] }[kind];
    const r = ballR(G);
    G.balls.forEach(b => {
      const m = P.get('ball' + kind, () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), kind === 'N' ? new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e0f2fe', emissiveIntensity: .6, roughness: .1, metalness: .3 }) : Arcade3D.glowMat(BC[0]))); const s = new THREE.Sprite(Arcade3D.glowSprite(BC[1])); s.scale.set(7, 7, 1); g.add(s); g.children[0].castShadow = true; return g; });
      m.scale.setScalar(r); m.position.set(X(b.x), Y(b.y), r + 1);
      b.trail.forEach((p, i) => { const t = P.get('trail' + kind, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: BC[2], blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }))); t.position.set(X(p[0]), Y(p[1]), r); const k = 1 - i / b.trail.length; t.scale.set(r * 3.4 * k + 1, r * 3.4 * k + 1, 1); t.material.opacity = .5 * k; });
    });
    /* cápsulas de poder */
    G.caps.forEach(cp => {
      const m = P.get('cap:' + cp.k, () => {
        const g = new THREE.Group(), col = POW[cp.k].col;
        const pill = new THREE.Mesh(new THREE.CapsuleGeometry(7, 16, 6, 12), new THREE.MeshStandardMaterial({ color: col, roughness: .25, metalness: .3, emissive: col, emissiveIntensity: .3 }));
        pill.rotation.z = Math.PI / 2; pill.castShadow = true; g.add(pill);
        const gl = new THREE.Sprite(Arcade3D.glowSprite(col)); gl.scale.set(46, 30, 1); gl.position.z = -2; g.add(gl);
        const ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(POW[cp.k].ico), depthTest: false })); ic.position.z = 9; ic.scale.set(15, 15, 1); g.add(ic);
        return g;
      });
      m.position.set(X(cp.x), Y(cp.y), 9 + Math.sin(cp.rot * 1.3) * 1.5); m.children[0].rotation.x = cp.rot;
    });
    /* laser */
    G.shots.forEach(sh => { const m = P.get('laser', () => new THREE.Mesh(new THREE.BoxGeometry(3, 12, 3), Arcade3D.glowMat('#fca5a5'))); m.position.set(X(sh.x), Y(sh.y - 3), 6); });
    P.end();
    R.renderer.render(R.scene, R.cam);
    overlay(G, ctx, W, H, api);
  }

  function destroy(G) {
    const R = G.r3; if (!R) return;
    R.tex.dispose(); Arcade3D.disposeOwn(R.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    draw2D(G, ctx, W, H, api);
  }

  /* por cima de tudo (2D e 3D): raios, mira, dicas, vidas e barra de efeitos */
  function overlay(G, ctx, W, H, api) {
    G.bolts.forEach(b => {
      const k = b.t / b.d;
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      [[7, `rgba(34,211,238,${.25 * k})`], [2.4, `rgba(236,254,255,${k})`]].forEach(([w, s]) => {
        ctx.strokeStyle = s; ctx.lineWidth = w; ctx.beginPath();
        b.pts.forEach((p, i) => { const j = i && i < b.pts.length - 1 ? U.rand(-2, 2) : 0; if (i) ctx.lineTo(p[0] + j, p[1] + j); else ctx.moveTo(p[0], p[1]); }); ctx.stroke();
      });
      ctx.restore();
    });
    if (G.cpop) {
      const k = G.cpop.t, age = 1.3 - k, sc = age < .12 ? 1.5 - age / .12 * .5 : 1, big = G.cpop.n >= 10;
      ctx.save(); ctx.globalAlpha = Math.min(1, k * 2.5); ctx.translate(W / 2, G.py - 110); ctx.scale(sc, sc);
      ctx.font = `800 ${big ? 30 : 24}px 'Space Grotesk', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText('Combo ×' + G.cpop.n, 0, 0);
      ctx.fillStyle = big ? '#f472b6' : '#fde047'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16; ctx.fillText('Combo ×' + G.cpop.n, 0, 0);
      ctx.restore(); ctx.textBaseline = 'alphabetic';
    }
    const stuck = G.balls.filter(b => b.stuck);
    if (stuck.length && !G.cleared) {
      const ready = G.introT >= G.introEnd;
      /* mira do serviço: pontos na direção em que a bola vai sair */
      if (ready) stuck.forEach(b => {
        const a = b.off ? U.clamp(b.off / (G.pw / 2), -1, 1) * .9 : aimAng(G);
        for (let i = 1; i <= 7; i++) { ctx.globalAlpha = .75 * (1 - i / 8); ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.arc(b.x + Math.sin(a) * i * 17, b.y - Math.cos(a) * i * 17, 2.6 - i * .2, 0, 6.3); ctx.fill(); }
        ctx.globalAlpha = 1;
      });
      ctx.fillStyle = `rgba(255,255,255,${ready ? .85 : .4})`; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(G.effects.magnet && stuck.some(b => b.off) ? 'Toca para soltar' : 'Toca para lançar', W / 2, G.py - 52);
    }
    for (let i = 0; i < G.lives; i++) { ctx.fillStyle = '#93c5fd'; ctx.beginPath(); ctx.arc(16 + i * 16, H - 16, 5, 0, 6.3); ctx.fill(); }
    /* efeitos ativos: ícone + barra do tempo que falta */
    let ex = W - 10;
    const pill = (ico, col, frac, blink) => {
      const w = 44, x = ex - w, y = H - 26;
      ctx.globalAlpha = blink ? .45 : 1;
      ctx.fillStyle = 'rgba(8,10,24,.7)'; U.rr(ctx, x, y, w, 18, 9); ctx.fill();
      if (frac != null) { ctx.fillStyle = col; ctx.globalAlpha *= .35; U.rr(ctx, x, y, Math.max(9, w * frac), 18, 9); ctx.fill(); ctx.globalAlpha = blink ? .45 : 1; }
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; U.rr(ctx, x, y, w, 18, 9); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ico, x + w / 2, y + 10); ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1; ex -= w + 5;
    };
    Object.keys(G.effects).forEach(k => { const p = POW[k]; if (!p || !p.dur) return; const left = G.effects[k]; pill(p.ico, p.bad ? '#f87171' : p.col, left / p.dur, left < 2 && Math.floor(left * 6) % 2); });
    if (G.bombs > 0) pill('💣×' + G.bombs, POW.bomb.col, null, false);
  }

  function draw2D(G, ctx, W, H, api) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#05060f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(96,165,250,.06)'; ctx.lineWidth = 1;
    for (let x = LEFT; x < W; x += BW) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, H); ctx.stroke(); }
    const hot = U.clamp((G.combo - 3) / 12, 0, 1);
    ctx.strokeStyle = hot > 0 ? `rgba(244,114,182,${.35 + hot * .5})` : 'rgba(96,165,250,.35)'; ctx.lineWidth = 2; ctx.strokeRect(2, 62, W - 4, H + 10);
    if (G.effects.shield) { ctx.strokeStyle = `rgba(45,212,191,${.55 + G.shieldHit * .45})`; ctx.lineWidth = 3 + G.shieldHit * 3; ctx.shadowColor = '#2dd4bf'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(6, G.py + 24); ctx.lineTo(W - 6, G.py + 24); ctx.stroke(); ctx.shadowBlur = 0; }
    /* tijolos */
    G.bricks.forEach(b => {
      if (b.dead) return;
      const k = introK(G, b); if (k <= 0) return;
      const [c0, c1] = b.t === 'M' ? ['#e2e8f0', '#64748b'] : COL[b.t === 'X' || b.t === 'G' || b.t === 'Z' ? b.t : Math.min(b.hp, 4)] || COL[1];
      const wob = b.wob > 0 ? 1 + Math.sin(b.wob * 22) * .1 * b.wob : 1;
      ctx.save(); ctx.globalAlpha = k; ctx.translate(b.x + b.w / 2, b.y + b.h / 2 - Math.pow(1 - k, 3) * 70); ctx.scale(wob, 2 - wob); ctx.translate(-b.w / 2, -b.h / 2);
      const bg = ctx.createLinearGradient(0, 0, 0, b.h); bg.addColorStop(0, c0); bg.addColorStop(1, c1);
      ctx.fillStyle = bg; U.rr(ctx, 0, 0, b.w, b.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(3, 2, b.w - 6, 2.5);
      if (b.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${b.hit * 3})`; U.rr(ctx, 0, 0, b.w, b.h, 4); ctx.fill(); }
      if (b.hp !== Infinity && b.hp < b.max) { ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.w * .3, 2); ctx.lineTo(b.w * .45, b.h * .6); ctx.lineTo(b.w * .38, b.h - 2); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (ICO[b.t] || b.t === 'M') { ctx.fillStyle = b.t === 'M' ? '#334155' : '#fff'; ctx.font = '800 10px system-ui'; ctx.fillText(b.t === 'X' ? '✸' : b.t === 'G' ? '★' : b.t === 'Z' ? 'ϟ' : '▪', b.w / 2, b.h / 2 + 1); }
      else if (b.max > 1) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '800 9px system-ui'; ctx.fillText(b.hp, b.w / 2, b.h / 2 + 1); }
      ctx.restore();
    });
    ctx.textBaseline = 'alphabetic';
    /* ondas de choque e estilhaços */
    G.rings.forEach(r => { const k = r.t / r.d, e = 1 - Math.pow(1 - k, 3); ctx.globalAlpha = (1 - k) * .8; ctx.strokeStyle = r.col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, 6.3); ctx.stroke(); });
    G.shards.forEach(s => { const k = Math.min(1, s.life * 3), z = 1 + s.z / 160; ctx.globalAlpha = k; ctx.fillStyle = s.col; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rx); ctx.fillRect(-s.s * z / 2, -s.s * z / 2, s.s * z, s.s * z * .8); ctx.restore(); });
    ctx.globalAlpha = 1;
    /* cápsulas */
    G.caps.forEach(c => { const p = POW[c.k]; ctx.shadowColor = p.col; ctx.shadowBlur = 10; ctx.fillStyle = p.col; U.rr(ctx, c.x - 15, c.y - 8, 30, 16, 8); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.ico, c.x, c.y + 1); ctx.textBaseline = 'alphabetic'; });
    ctx.fillStyle = '#fca5a5'; G.shots.forEach(s => ctx.fillRect(s.x - 1.5, s.y - 8, 3, 10));
    /* raquete (amassa ao bater) */
    const sq = G.psq, pw = G.pw * (1 + sq * .07), ph = 14 * (1 - sq * .3);
    const top = G.effects.magnet ? '#c4b5fd' : G.effects.laser ? '#fca5a5' : '#93c5fd', bot = G.effects.magnet ? '#6d28d9' : G.effects.laser ? '#b91c1c' : '#1d4ed8';
    const pg = ctx.createLinearGradient(0, G.py - ph / 2, 0, G.py + ph / 2); pg.addColorStop(0, top); pg.addColorStop(1, bot);
    ctx.save(); ctx.translate(G.px, G.py); ctx.rotate(U.clamp(G.pvx * .00018, -.1, .1));
    ctx.shadowColor = top; ctx.shadowBlur = 14 + sq * 10; ctx.fillStyle = pg; U.rr(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-pw / 2 + 8, -ph / 2 + 2, pw - 16, 2);
    ctx.restore();
    /* bolas */
    const r = ballR(G), fire = !!G.effects.fire, bomb = G.bombs > 0, mega = !!G.effects.mega;
    const bc = fire ? ['#fed7aa', '#fb923c'] : bomb ? ['#fecaca', '#f97316'] : mega ? ['#fae8ff', '#e879f9'] : ['#fff', '#e0f2fe'];
    G.balls.forEach(b => {
      b.trail.forEach((p, i) => { ctx.globalAlpha = .25 * (1 - i / 8); ctx.fillStyle = bc[1]; ctx.beginPath(); ctx.arc(p[0], p[1], r * (1 - i / 10), 0, 6.3); ctx.fill(); });
      ctx.globalAlpha = 1;
      ctx.shadowColor = bc[1]; ctx.shadowBlur = 12;
      ctx.fillStyle = bc[0]; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0;
    });
    overlay(G, ctx, W, H, api);
  }

  return ArcadeKit.create({
    id: 'brick-breaker', title: 'Parte-Tijolos', icon: '🟦',
    accent: '#60a5fa', accent2: '#f472b6', bg: '#05060f', transparent: true, destroy,
    tagline: 'Raquete, bola e uma parede de tijolos por partir. 14 cápsulas, tijolos que explodem e dão choques, 12 níveis desenhados e depois muitos mais.',
    view: { w: 400 },
    modes: () => {
      const mx = store().getPref('maxLevel', 1);
      return [
        { id: 'new', icon: '🧱', name: 'Campanha', desc: 'Do nível 1 em diante. 3 bolas para ir o mais longe possível.' },
        ...(mx > 1 ? [{ id: 'cont', icon: '⏩', name: `Continuar no nível ${mx}`, desc: 'Retoma a partir do nível mais alto a que chegaste.', noBest: true, noDiff: true }] : []),
      ];
    },
    how: [
      '<b>Rato:</b> a raquete segue o cursor. <b>Toque:</b> arrasta o dedo em qualquer lado — a raquete acompanha sem ficares a tapar a bola. Toca/clica para lançar (os pontinhos mostram para onde).',
      'Onde a bola bate na raquete decide o ângulo. Tijolos com número precisam de vários toques; os de metal não partem; ✸ explode à volta; ⚡ dá um choque aos 3 mais próximos; ★ larga sempre uma cápsula.',
      'Cápsulas boas: ↔ larga, ⁂ multibola, 🐢 lenta, ⇈ laser, 🔥 fogo, 🧲 íman, 🛡️ barreira, ● bola gigante, ×2 pontos, 💣 bola-bomba, 💎 +250, ❤ vida. Cuidado com as cinzentas: ↘ encolhe a raquete e ⏩ acelera a bola.',
    ],
    controls: ['🖱️ Mover + clicar', '👆 Arrastar + tocar', '⌨️ ← → + Espaço'],
    ready: { title: 'Toca para começar', hint: 'Depois toca outra vez para lançar a bola.' },
    setup, update, draw,
    /* no ecrã "toca para começar" os tijolos já vão caindo por trás */
    idle: (G, dt) => { G.introT += dt; fx(G, dt); },
    down: (G, x, y, api, e) => { if (e.pointerType === 'mouse') G.px = x; G.drag = { x, px: G.px }; launch(G, api); },
    move: (G, x, y, api, e, isDown) => {
      if (e.pointerType === 'mouse') { G.px = x; return; }
      if (isDown && G.drag) G.px = G.drag.px + (x - G.drag.x) * 1.35;
    },
    up: G => { G.drag = null; },
    key: (G, e, api) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { G.kl = 1; return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { G.kr = 1; return true; }
      if (e.key === ' ' || e.key === 'ArrowUp') { launch(G, api); return true; }
    },
    keyup: (G, e) => {
      if (/^(ArrowLeft|a|A)$/.test(e.key)) G.kl = 0;
      if (/^(ArrowRight|d|D)$/.test(e.key)) G.kr = 0;
    },
    hud: G => [['Pontos', G.score], ['Nível', G.level], ['Combo', G.combo > 1 ? '×' + G.combo : '—', G.combo >= 5 ? 'hot' : '']],
    achievements: [
      { id: 'bb.l5',  name: 'Demolidor',  icon: '🧱', desc: 'Chega ao nível 5 do Parte-Tijolos.', test: c => ((c.result.meta || {}).level || 0) >= 5 },
      { id: 'bb.l12', name: 'Muralha Abaixo', icon: '🏗️', desc: 'Limpa os 12 níveis desenhados.', test: c => ((c.result.meta || {}).level || 0) >= 13 },
      { id: 'bb.5k',  name: 'Mão Pesada', icon: '💥', desc: 'Faz 5000 pontos no Parte-Tijolos.', test: c => (c.result.score || 0) >= 5000 },
      { id: 'bb.c20', name: 'Reação em Cadeia', icon: '⚡', desc: 'Faz um combo de 20 no Parte-Tijolos.', test: c => ((c.result.meta || {}).combo || 0) >= 20 },
    ],
  });
})();
