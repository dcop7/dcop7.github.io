/* ══════════════════════════════════════════════════════════════════
   Lança-Facas (Knife Throw) — crava facas num tronco que gira sem
   acertar nas que já lá estão. 100% original, canvas procedural.
   Fases com padrões de rotação cada vez mais traiçoeiros; a cada 5.ª
   fase há um tronco-chefe. Colisão geométrica (segmento a segmento),
   não por ângulo mágico: o que se vê é o que conta.
══════════════════════════════════════════════════════════════════ */
const KnifeThrowGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2;

  const R = 84;                 /* raio do tronco */
  const EMBED = 16;             /* quanto a faca entra na madeira */
  const BLADE = 58, HANDLE = 40, KLEN = BLADE + HANDLE + 6;
  const OUT = KLEN - EMBED;     /* parte visível fora do tronco */
  const SPEED = 2700;           /* velocidade da faca lançada */

  const DIFF = {
    easy:   { spd: .78, pre: s => (s < 3 ? 0 : Math.min(2, Math.floor(s / 3))), knives: s => Math.min(8, 5 + Math.floor(s / 2)) },
    medium: { spd: 1,   pre: s => Math.min(3, Math.floor((s + 1) / 3)),          knives: s => Math.min(10, 6 + Math.floor(s / 2)) },
    hard:   { spd: 1.22, pre: s => Math.min(4, 1 + Math.floor(s / 2)),           knives: s => Math.min(11, 7 + Math.floor(s / 2)) },
  };

  /* padrões de rotação: devolvem o multiplicador da velocidade base */
  const PATTERNS = [
    t => 1,
    t => 1 + .65 * Math.sin(t * 1.8),
    t => 1.7 * Math.sin(t * .95),
    t => (Math.sin(t * 2.3) > -.25 ? 1.55 : -.55),
    t => .25 + 1.9 * Math.max(0, Math.sin(t * 2.7)),
    t => (Math.floor(t / 1.6) % 2 ? -1.35 : 1.35),
  ];

  function newStage(G, n) {
    const cfg = DIFF[G.diff] || DIFF.medium;
    const boss = n % 5 === 0;
    G.stage = n; G.boss = boss;
    G.total = cfg.knives(n) + (boss ? 2 : 0);
    G.left = G.total;
    G.stuck = []; G.apples = [];
    G.rot = Math.random() * TAU;
    G.dir = Math.random() < .5 ? 1 : -1;
    G.base = Math.min(3.7, (1.65 + n * .075) * cfg.spd) * (boss ? 1.1 : 1);
    G.pat = n === 1 ? 0 : n === 2 ? 0 : n === 3 ? 1 : n === 4 ? 2 : boss ? 4 + (n / 5) % 2 : U.randi(1, PATTERNS.length - 1);
    G.omega = 0; G.pt = 0;
    const pre = cfg.pre(n) + (boss ? 1 : 0);
    let tries = 0;
    while (G.stuck.length < pre && tries++ < 200) {
      const a = Math.random() * TAU;
      if (G.stuck.every(k => Math.abs(U.angDiff(a, k.a)) > .55)) G.stuck.push({ a, wob: 0 });
    }
    const nA = n === 1 ? 1 : U.randi(0, boss ? 3 : 2);
    tries = 0;
    while (G.apples.length < nA && tries++ < 200) {
      const a = Math.random() * TAU;
      if (G.stuck.every(k => Math.abs(U.angDiff(a, k.a)) > .45) && G.apples.every(p => Math.abs(U.angDiff(a, p.a)) > .6)) G.apples.push({ a });
    }
    /* textura do tronco (fixa por fase, gira com ele) */
    G.rings = Array.from({ length: 5 }, (_, i) => ({ r: R * (.2 + i * .16) + U.rand(-3, 3), w: U.rand(.8, 2) }));
    G.knots = Array.from({ length: 3 }, () => ({ a: Math.random() * TAU, d: U.rand(20, R - 22), s: U.rand(4, 8) }));
    G.cracks = Array.from({ length: 4 }, () => ({ a: Math.random() * TAU, l: U.rand(.25, .55) }));
    G.hitFx = 0; G.clearT = 0; G.flying = null; G.cool = .15;
  }

  function setup(api, o) {
    const G = { diff: o.diff || 'medium', score: 0, applesTot: 0, thrown: 0, debris: [], flyOff: [], over: false, dead: null };
    newStage(G, 1);
    return G;
  }

  const cx = (G, api) => api.W / 2;
  const cy = (G, api) => Math.max(R + 90, Math.min(api.H * .34, 290));
  const restY = api => api.H - KLEN - 26;

  function throwKnife(G, api) {
    if (G.over || G.flying || G.cool > 0 || G.left <= 0 || G.clearT > 0) return;
    G.flying = { y: restY(api) };
    G.left--; G.thrown++;
    api.sfx.noise(.09, .06, 0, 2400, 'highpass');
    api.sfx.tone(520, .07, 'triangle', .04, 0, 900);
  }

  /* pontos ao longo de uma faca cravada no ângulo-mundo a (da ponta ao pomo) */
  function knifePts(x0, y0, a) {
    const c = Math.cos(a), s = Math.sin(a), pts = [];
    for (let i = 0; i <= 6; i++) { const r = R - EMBED + 8 + (OUT - 8) * i / 6; pts.push([x0 + c * r, y0 + s * r]); }
    return pts;
  }

  function update(G, dt, api) {
    const X = cx(G, api), Y = cy(G, api);
    G.pt += dt;
    const target = G.base * G.dir * PATTERNS[G.pat](G.pt);
    G.omega = U.lerp(G.omega, target, Math.min(1, dt * 7));
    if (!G.over) G.rot += G.omega * dt;
    G.cool = Math.max(0, G.cool - dt);
    G.hitFx = Math.max(0, G.hitFx - dt * 5);
    G.stuck.forEach(k => { k.wob = Math.max(0, k.wob - dt * 6); });

    /* faca em voo */
    const f = G.flying;
    if (f && !G.over) {
      const prev = f.y;
      f.y -= SPEED * dt;
      const rim = Y + R;
      /* colisão com cabos/lâminas de facas cravadas (e com maçãs) enquanto
         a lâmina atravessa a zona exterior ao tronco */
      if (f.y < rim + OUT + 6) {
        const top = Math.max(f.y, rim - 2), bot = Math.min(prev + KLEN, f.y + KLEN);
        for (const k of G.stuck) {
          const pts = knifePts(X, Y, k.a + G.rot);
          if (pts.some(([px, py]) => Math.abs(px - X) < 10 && py > top - 4 && py < bot)) { fail(G, api, k); return; }
        }
        for (let i = G.apples.length - 1; i >= 0; i--) {
          const a = G.apples[i].a + G.rot, ax = X + Math.cos(a) * (R + 10), ay = Y + Math.sin(a) * (R + 10);
          if (Math.abs(ax - X) < 16 && ay > top - 12 && ay < bot) {
            G.apples.splice(i, 1); G.applesTot++; G.score += 2;
            api.float(ax, ay - 10, '+2 🍎', '#ff6b6b', 18);
            for (let j = 0; j < 12; j++) api.spark({ x: ax, y: ay, vx: U.rand(-160, 160), vy: U.rand(-220, 40), color: j % 2 ? '#ef4444' : '#fca5a5', size: U.rand(2, 4), life: .6, gravity: 600 });
            api.sfx.tone(880, .08, 'sine', .08); api.sfx.tone(1320, .1, 'sine', .06, .05);
          }
        }
      }
      if (f.y <= rim - EMBED) {
        /* cravou */
        G.flying = null; G.cool = .08;
        G.stuck.push({ a: Math.PI / 2 - G.rot, wob: 1 });
        G.score += 1; G.hitFx = 1;
        api.shake(4, .12); api.vibe(12);
        api.sfx.noise(.08, .14, 0, 500, 'lowpass'); api.sfx.tone(140, .09, 'triangle', .1);
        for (let j = 0; j < 9; j++) api.spark({ x: X + U.rand(-6, 6), y: rim, vx: U.rand(-190, 190), vy: U.rand(-60, 160), color: j % 3 ? '#c98a4b' : '#f3c58a', size: U.rand(1.5, 3.5), life: .55, gravity: 700 });
        if (G.left === 0) G.clearT = .001;
      }
    }

    /* fase limpa → o tronco rebenta */
    if (G.clearT > 0) {
      G.clearT += dt;
      if (G.clearT > .28 && !G.burst) {
        G.burst = true;
        const bonus = G.boss ? 10 : 3;
        G.score += bonus;
        G.stuck.forEach(k => {
          const a = k.a + G.rot;
          G.flyOff.push({ x: X + Math.cos(a) * (R + 30), y: Y + Math.sin(a) * (R + 30), vx: Math.cos(a) * U.rand(160, 320), vy: Math.sin(a) * U.rand(160, 320) - 220, a: a - Math.PI / 2, va: U.rand(-9, 9), life: 1.4 });
        });
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * TAU + U.rand(-.2, .2);
          G.debris.push({ x: X, y: Y, vx: Math.cos(a) * U.rand(180, 300), vy: Math.sin(a) * U.rand(180, 300) - 150, a: a, va: U.rand(-6, 6), s: U.rand(22, 34), life: 1.3, boss: G.boss });
        }
        G.stuck = []; G.apples = [];
        api.shake(10, .3); api.vibe([20, 30, 40]);
        api.sfx.noise(.35, .2, 0, 300, 'lowpass'); api.sfx.arp([392, 523, 659], .06, .12, 'triangle', .08);
        api.float(X, Y, '+' + bonus, '#fde68a', 26);
      }
      if (G.clearT > 1.15) {
        G.burst = false;
        newStage(G, G.stage + 1);
        api.banner(G.boss ? 'Tronco-chefe!' : 'Fase ' + G.stage, G.boss ? 'Fase ' + G.stage : (G.total + ' facas'));
        if (G.boss) api.sfx.tone(110, .5, 'sawtooth', .07, 0, 80);
      }
    }

    stepBits(G, dt);
    if (G.dead) {
      const d = G.dead; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 1500 * dt; d.a += d.va * dt;
    }
  }

  function stepBits(G, dt) {
    [G.flyOff, G.debris].forEach(list => {
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 900 * dt; b.a += b.va * dt; b.life -= dt;
        if (b.life <= 0) list.splice(i, 1);
      }
    });
  }

  function fail(G, api, k) {
    G.over = true;
    const f = G.flying; G.flying = null;
    G.dead = { x: cx(G, api), y: f.y, vx: U.rand(-1, 1) > 0 ? 260 : -260, vy: 180, a: 0, va: U.rand(14, 20) * (Math.random() < .5 ? -1 : 1) };
    if (k) k.wob = 1;
    api.shake(12, .35); api.flash('#ef4444', .2); api.vibe(120);
    api.sfx.tone(1900, .06, 'square', .06); api.sfx.tone(1250, .18, 'triangle', .07, .03, 700);
    api.over({
      score: G.score, won: false, delay: 950,
      title: 'Acertaste numa faca!', icon: '🔪',
      stats: [['Fase', G.stage], ['Facas cravadas', G.thrown - 1], ['Maçãs', G.applesTot]],
      meta: { stage: G.stage },
    });
  }

  /* ── desenho ─────────────────────────────────────────────────────── */
  function drawKnife(ctx, x, y, rot, alpha, boss) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha == null ? 1 : alpha;
    /* lâmina: ponta em (0,0), corpo para +y */
    const g = ctx.createLinearGradient(-6, 0, 6, 0);
    g.addColorStop(0, '#8d97a8'); g.addColorStop(.45, '#f5f7fb'); g.addColorStop(1, '#a9b2c1');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, 13); ctx.lineTo(6, BLADE); ctx.lineTo(-5, BLADE); ctx.lineTo(-5, 11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(1, 8); ctx.lineTo(1, BLADE - 3); ctx.stroke();
    /* guarda */
    ctx.fillStyle = boss ? '#e5e7eb' : '#d4a64a'; U.rr(ctx, -10, BLADE - 1, 20, 6, 2); ctx.fill();
    /* cabo */
    ctx.fillStyle = '#2a2f3d'; U.rr(ctx, -5.5, BLADE + 5, 11, HANDLE - 4, 4); ctx.fill();
    ctx.strokeStyle = '#4b5569'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) { const yy = BLADE + 11 + i * 8; ctx.beginPath(); ctx.moveTo(-5, yy); ctx.lineTo(5, yy + 4); ctx.stroke(); }
    ctx.fillStyle = '#d4a64a'; ctx.beginPath(); ctx.arc(0, BLADE + HANDLE + 2, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawLog(ctx, G, X, Y) {
    ctx.save(); ctx.translate(X, Y);
    /* sombra */
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(8, 14, R + 4, R + 4, 0, 0, TAU); ctx.fill();
    ctx.rotate(G.rot);
    const g = ctx.createRadialGradient(-20, -24, 6, 0, 0, R);
    if (G.boss) { g.addColorStop(0, '#9b4a3a'); g.addColorStop(.7, '#6a2a22'); g.addColorStop(1, '#3d1612'); }
    else { g.addColorStop(0, '#e1a768'); g.addColorStop(.65, '#b97a43'); g.addColorStop(1, '#8a5530'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = G.boss ? 'rgba(20,5,5,.35)' : 'rgba(92,52,22,.42)';
    G.rings.forEach(r => { ctx.lineWidth = r.w; ctx.beginPath(); ctx.arc(0, 0, r.r, 0, TAU); ctx.stroke(); });
    ctx.lineWidth = 1.6;
    G.cracks.forEach(c => { ctx.beginPath(); ctx.moveTo(Math.cos(c.a) * 6, Math.sin(c.a) * 6); ctx.lineTo(Math.cos(c.a + .08) * R * c.l, Math.sin(c.a + .08) * R * c.l); ctx.stroke(); });
    ctx.fillStyle = G.boss ? 'rgba(25,6,6,.5)' : 'rgba(90,50,20,.5)';
    G.knots.forEach(k => { ctx.beginPath(); ctx.ellipse(Math.cos(k.a) * k.d, Math.sin(k.a) * k.d, k.s, k.s * .6, k.a, 0, TAU); ctx.fill(); });
    /* casca / aro */
    if (G.boss) {
      ctx.strokeStyle = '#9aa3b2'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#e5e7eb';
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * (R - 3), Math.sin(a) * (R - 3), 2.6, 0, TAU); ctx.fill(); }
    } else {
      ctx.strokeStyle = '#5b3719'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, R - 2.5, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,170,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R - 7, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    }
    if (G.hitFx > 0) { ctx.globalAlpha = G.hitFx * .35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  function drawApple(ctx, x, y, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
    const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 12);
    g.addColorStop(0, '#ff8a8a'); g.addColorStop(1, '#c81e1e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-4, 0, 9, 0, TAU); ctx.arc(4, 0, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5b3719'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(1, -13); ctx.stroke();
    ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.ellipse(5, -12, 5, 2.4, -.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function draw(G, ctx, W, H, api) {
    const X = cx(G, api), Y = cy(G, api);
    /* fundo: oficina escura, foco de luz sobre o tronco */
    const bg = ctx.createRadialGradient(X, Y, 20, X, Y, Math.max(W, H) * .9);
    bg.addColorStop(0, G.boss ? '#3a1715' : '#2c2118'); bg.addColorStop(.55, '#15110e'); bg.addColorStop(1, '#0a0807');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.025)'; ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 8); ctx.stroke(); }

    /* facas cravadas (por baixo do tronco, que esconde a parte enterrada) */
    G.stuck.forEach(k => {
      const a = k.a + G.rot, w = k.wob * Math.sin(api.t * 60) * .05;
      drawKnife(ctx, X + Math.cos(a) * (R - EMBED), Y + Math.sin(a) * (R - EMBED), a - Math.PI / 2 + w, 1, G.boss);
    });
    if (G.clearT <= .28 || !G.burst) drawLog(ctx, G, X, Y);
    G.apples.forEach(p => { const a = p.a + G.rot; drawApple(ctx, X + Math.cos(a) * (R + 10), Y + Math.sin(a) * (R + 10), a); });

    /* estilhaços do tronco */
    G.debris.forEach(d => {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a); ctx.globalAlpha = Math.min(1, d.life);
      ctx.fillStyle = d.boss ? '#7a3328' : '#b97a43';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, d.s, -.45, .45); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = d.boss ? '#3d1612' : '#5b3719'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, d.s - 1.5, -.45, .45); ctx.stroke();
      ctx.restore();
    });
    G.flyOff.forEach(k => drawKnife(ctx, k.x, k.y, k.a, Math.min(1, k.life)));

    /* faca em voo / à espera */
    if (G.flying) {
      ctx.globalAlpha = .18; drawKnife(ctx, X, G.flying.y + 40, 0); ctx.globalAlpha = 1;
      drawKnife(ctx, X, G.flying.y, 0);
    } else if (!G.over && G.left > 0 && G.clearT === 0) {
      const lift = G.cool > 0 ? G.cool / .15 * 26 : 0;
      drawKnife(ctx, X, restY(api) + lift, 0);
    }
    if (G.dead) drawKnife(ctx, G.dead.x, G.dead.y, G.dead.a);

    /* contador de facas (canto inferior esquerdo) */
    const n = G.total, top = H - 30 - n * 17;
    for (let i = 0; i < n; i++) {
      const used = i >= G.left;
      ctx.save(); ctx.translate(22, top + i * 17); ctx.rotate(-Math.PI / 4);
      ctx.globalAlpha = used ? .22 : .95;
      ctx.fillStyle = used ? '#6b7280' : '#e5e7eb';
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(3, -4); ctx.lineTo(3, 3); ctx.lineTo(-3, 3); ctx.lineTo(-3, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = used ? '#4b5563' : '#d4a64a'; ctx.fillRect(-2, 3, 4, 7);
      ctx.restore();
    }
  }

  const game = ArcadeKit.create({
    id: 'knife-throw', title: 'Lança-Facas', icon: '🔪',
    accent: '#fb923c', accent2: '#f2b344', bg: '#0f0c0a',
    tagline: 'Crava todas as facas no tronco que gira — sem tocar nas que já lá estão.',
    view: { w: 400 },
    how: [
      'Toca, clica ou carrega em <b>Espaço</b> para lançar uma faca a direito.',
      'Se a faca bater noutra já cravada, acabou. Espera pela abertura certa.',
      'Acerta nas <b>maçãs</b> para +2. Cada 5.ª fase é um tronco-chefe com rotação traiçoeira.',
    ],
    controls: ['🖱️ Clique', '👆 Toque', '⌨️ Espaço'],
    ready: { title: 'Toca para lançar', hint: 'Cada toque lança uma faca. Crava-as todas para passar de fase.' },
    tapStarts: true,
    setup, update, draw,
    down: (G, x, y, api) => throwKnife(G, api),
    key: (G, e, api) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') { throwKnife(G, api); return true; } },
    hud: G => [['Pontos', G.score], ['Fase', G.stage + (G.boss ? ' 👑' : '')], ['🍎', G.applesTot]],
    achievements: [
      { id: 'kt.s5',   name: 'Mão Certeira',   icon: '🔪', desc: 'Chega à fase 5 do Lança-Facas.', test: c => ((c.result.meta || {}).stage || 0) >= 5 },
      { id: 'kt.s10',  name: 'Lenhador',       icon: '🪓', desc: 'Chega à fase 10 do Lança-Facas.', test: c => ((c.result.meta || {}).stage || 0) >= 10 },
      { id: 'kt.100',  name: 'Cem Lâminas',    icon: '⚔️', desc: 'Faz 100 pontos no Lança-Facas.', test: c => (c.result.score || 0) >= 100 },
    ],
  });

  return game;
})();
