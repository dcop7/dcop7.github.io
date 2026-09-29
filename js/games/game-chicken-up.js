/* ══════════════════════════════════════════════════════════════════
   Galinha Acima (Chicken Up) — um toque = um salto na vertical. As
   tábuas deslizam de um lado para o outro; salta quando a de cima
   estiver por cima de ti. Diferente do Saltitão: aqui não se guia nada
   a meio do salto — é só timing. Tábuas que se desfazem, velocidades
   que oscilam e ovos dourados para quem cai ao centro.
══════════════════════════════════════════════════════════════════ */
const ChickenUpGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const GAP = 132, PH = 16, GR = 2300;
  const VJ = Math.sqrt(2 * GR * (GAP + 34));
  const DIFF = {
    easy:   { lives: 3, spd: .8,  w: 1.15 },
    medium: { lives: 2, spd: 1,   w: 1 },
    hard:   { lives: 1, spd: 1.25, w: .86 },
  };

  function mkPlat(G, i, W) {
    const c = G.cfg;
    if (i === 0) return { i, x: W / 2, w: 220, spd: 0, dir: 1, t: 'n' };
    const w = Math.max(58, (150 - i * 1.6) * c.w);
    const spd = Math.min(280, (70 + i * 4.2) * c.spd);
    const r = Math.random();
    const t = i > 8 && r < .2 ? 'c' : i > 14 && r < .38 ? 'w' : 'n';
    return { i, x: U.rand(w / 2 + 10, W - w / 2 - 10), w, spd, dir: Math.random() < .5 ? -1 : 1, t, ph: Math.random() * 6, egg: i > 1 && Math.random() < .22 ? U.rand(-w * .3, w * .3) : null, crumble: 0 };
  }

  function setup(api, o) {
    const cfg = DIFF[o.diff] || DIFF.medium;
    const G = { cfg, lives: cfg.lives, plats: [], cur: 0, score: 0, eggs: 0, perfects: 0, combo: 0, cam: 0, ch: null, t: 0, feathers: [] };
    for (let i = 0; i < 8; i++) G.plats.push(mkPlat(G, i, api.W));
    G.ch = { x: api.W / 2, y: 0, vy: 0, air: false, ox: 0, flap: 0, dead: false, spin: 0 };
    G.camT = 0;
    return G;
  }

  const py = (G, i, api) => api.H * .72 - i * GAP;      /* y do topo da tábua i (antes da câmara) */

  function jump(G, api) {
    const c = G.ch;
    if (c.air || c.dead) return;
    c.air = true; c.vy = -VJ; c.from = G.cur;
    api.sfx.tone(520, .12, 'triangle', .07, 0, 900); api.sfx.noise(.08, .04, 0, 3000, 'highpass');
  }

  function land(G, api, p) {
    const c = G.ch;
    c.air = false; c.vy = 0; c.y = py(G, p.i, api);
    c.ox = c.x - p.x;
    c.squash = 1;
    if (p.i > G.cur) {
      G.cur = p.i;
      let pts = 1;
      const perfect = Math.abs(c.ox) < 10;
      if (perfect) { G.combo++; G.perfects++; pts += Math.min(5, G.combo); api.float(c.x, c.y - 70, 'Perfeito! +' + pts, '#fde047', 18); api.sfx.tone(880, .12, 'sine', .08); api.sfx.tone(1320, .12, 'sine', .05, .06); }
      else { G.combo = 0; api.sfx.tone(300, .07, 'square', .05); }
      if (p.egg != null && Math.abs(c.ox - p.egg) < 22) {
        pts += 5; G.eggs++; p.egg = null;
        api.float(c.x + 30, c.y - 40, '🥚 +5', '#fbbf24', 18); api.sfx.arp([988, 1319], .05, .08, 'sine', .07);
      }
      G.score += pts;
      for (let k = 0; k < 6; k++) api.spark({ x: c.x + U.rand(-14, 14), y: c.y, vx: U.rand(-80, 80), vy: U.rand(-90, -20), color: '#d6b48a', size: 2.5, life: .4, gravity: 400 });
      if (p.t === 'c') p.crumble = .001;
      if (G.cur % 25 === 0) { api.banner(G.cur + ' tábuas!', 'Mais alto, mais rápido'); api.sfx.arp([523, 659, 784, 1047], .06, .1, 'triangle', .06); }
      while (G.plats.length < G.cur + 8) G.plats.push(mkPlat(G, G.plats.length, api.W));
    }
    api.vibe(8);
  }

  function lose(G, api) {
    const c = G.ch;
    G.lives--; G.combo = 0;
    api.shake(8, .3); api.vibe(80);
    api.sfx.tone(700, .35, 'triangle', .08, 0, 150);
    for (let k = 0; k < 14; k++) G.feathers.push({ x: c.x, y: c.y - 20, vx: U.rand(-90, 90), vy: U.rand(-160, -20), a: Math.random() * 6, va: U.rand(-5, 5), life: 1.6 });
    if (G.lives <= 0) {
      c.dead = true;
      api.over({ score: G.score, won: false, delay: 900, title: 'A galinha caiu!', icon: '🐔',
        stats: [['Tábuas', G.cur], ['Perfeitos', G.perfects], ['Ovos', G.eggs]], meta: { planks: G.cur } });
      return;
    }
    /* volta à tábua onde estava, reposta */
    const p = G.plats[G.cur];
    p.crumble = 0; p.x = U.clamp(p.x, p.w / 2 + 10, api.W - p.w / 2 - 10);
    c.x = p.x; c.ox = 0; c.y = py(G, p.i, api); c.air = false; c.vy = 0; c.inv = 1.2;
    api.banner(G.lives === 1 ? 'Última vida!' : G.lives + ' vidas', '');
  }

  function update(G, dt, api) {
    const W = api.W, c = G.ch;
    G.t += dt;
    c.inv = Math.max(0, (c.inv || 0) - dt);
    c.squash = Math.max(0, (c.squash || 0) - dt * 5);
    G.plats.forEach(p => {
      if (!p.spd) return;
      const s = p.t === 'w' ? p.spd * (.55 + .75 * Math.abs(Math.sin(G.t * 1.3 + p.ph))) : p.spd;
      p.x += p.dir * s * dt;
      if (p.x - p.w / 2 < 6) { p.x = 6 + p.w / 2; p.dir = 1; }
      if (p.x + p.w / 2 > W - 6) { p.x = W - 6 - p.w / 2; p.dir = -1; }
      if (p.crumble) p.crumble += dt;
    });
    if (!c.air && !c.dead) {
      const p = G.plats[G.cur];
      c.x = p.x + c.ox;
      c.y = py(G, p.i, api) + (p.crumble > 2.2 ? (p.crumble - 2.2) * 300 : 0);
      if (p.crumble > 2.2 && !c.falling) { c.falling = true; c.air = true; c.vy = 60; api.sfx.noise(.3, .08, 0, 500); }
      if (Math.abs(c.ox) > p.w / 2 + 6) { c.air = true; c.vy = 0; }
    } else if (!c.dead) {
      const prev = c.y;
      c.vy += GR * dt; c.y += c.vy * dt;
      c.flap += dt * 30;
      if (c.vy > 0) {
        /* pode aterrar na seguinte ou voltar à de onde saltou */
        for (const idx of [G.cur + 1, G.cur]) {
          const p = G.plats[idx]; if (!p || (p.crumble > 2.2 && idx === G.cur)) continue;
          const top = py(G, p.i, api);
          if (prev <= top && c.y >= top && Math.abs(c.x - p.x) <= p.w / 2 + 6) { c.falling = false; land(G, api, p); break; }
        }
      }
      if (c.air && c.y > py(G, G.cur, api) + 420) { c.falling = false; lose(G, api); }
    }
    /* câmara segue a tábua atual */
    const target = G.cur * GAP;
    G.cam = U.lerp(G.cam, target, Math.min(1, dt * 5));
    for (let i = G.feathers.length - 1; i >= 0; i--) {
      const f = G.feathers[i]; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 120 * dt; f.vx *= .98; f.a += f.va * dt; f.life -= dt;
      if (f.life <= 0) G.feathers.splice(i, 1);
    }
  }

  /* ── desenho ── */
  function chicken(ctx, x, y, c, t) {
    ctx.save(); ctx.translate(x, y);
    const sq = c.squash || 0;
    ctx.scale(1 + sq * .18, 1 - sq * .16);
    if (c.inv && Math.floor(t * 12) % 2) ctx.globalAlpha = .45;
    /* pernas */
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const leg = c.air ? 4 : 0;
    ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-7, -1 + leg); ctx.moveTo(6, -10); ctx.lineTo(7, -1 + leg); ctx.stroke();
    /* corpo */
    const g = ctx.createRadialGradient(-6, -32, 3, 0, -24, 24);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e5e7eb');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -24, 18, 16, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-12, -30, 7, 10, -.5, 0, 6.3); ctx.fill();     /* cauda */
    /* asa */
    const f = c.air ? Math.sin(c.flap) * .9 : 0;
    ctx.save(); ctx.translate(3, -24); ctx.rotate(-.3 + f);
    ctx.fillStyle = '#f3f4f6'; ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(6, 0, 11, 6, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.restore();
    /* cabeça */
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10, -42, 10, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(7, -53, 4, 0, 6.3); ctx.arc(12, -54, 4.5, 0, 6.3); ctx.arc(16, -51, 3.5, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(18, -36, 2.5, 4, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(18, -44); ctx.lineTo(26, -41); ctx.lineTo(18, -38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(13, -45, 2, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  function plank(ctx, p, y, t) {
    const x = p.x - p.w / 2;
    let a = 1, dy = 0;
    if (p.crumble > 0) { const k = Math.min(1, p.crumble / 2.2); dy = p.crumble > 2.2 ? (p.crumble - 2.2) * 300 : Math.sin(t * 50) * k * 1.5; a = p.crumble > 2.2 ? Math.max(0, 1 - (p.crumble - 2.2) * 2) : 1; }
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.18)'; U.rr(ctx, x + 4, y + dy + 6, p.w, PH, 5); ctx.fill();
    const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + PH);
    const cc = p.t === 'c' ? ['#c9a27a', '#8b6a4a'] : p.t === 'w' ? ['#d97757', '#9a3f24'] : ['#d6a064', '#9a6433'];
    g.addColorStop(0, cc[0]); g.addColorStop(1, cc[1]);
    ctx.fillStyle = g; U.rr(ctx, x, y + dy, p.w, PH, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(80,45,15,.45)'; ctx.lineWidth = 1;
    for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + 6, y + dy + k * 5); ctx.lineTo(x + p.w - 6, y + dy + k * 5 + (k % 2 ? 1 : -1)); ctx.stroke(); }
    ctx.fillStyle = '#5b3a1e'; [x + 7, x + p.w - 7].forEach(nx => { ctx.beginPath(); ctx.arc(nx, y + dy + PH / 2, 2, 0, 6.3); ctx.fill(); });
    if (p.t === 'c' && p.crumble) { ctx.strokeStyle = '#3b2512'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x - 8, y + dy); ctx.lineTo(p.x + 2, y + dy + PH * .6); ctx.lineTo(p.x - 3, y + dy + PH); ctx.stroke(); }
    if (p.t === 'w') { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('»', p.x + p.dir * (p.w / 2 - 12), y + dy + 12); }
    ctx.globalAlpha = 1;
    if (p.egg != null) {
      const ex = p.x + p.egg, ey = y + dy - 9;
      const eg = ctx.createRadialGradient(ex - 2, ey - 3, 1, ex, ey, 9);
      eg.addColorStop(0, '#fff7cc'); eg.addColorStop(1, '#f59e0b');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(ex, ey, 6.5, 8.5, 0, 0, 6.3); ctx.fill();
    }
  }

  function draw(G, ctx, W, H, api) {
    const cam = G.cam;
    const alt = U.clamp(G.cur / 120, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `hsl(${205 - alt * 30},${70 - alt * 20}%,${58 - alt * 30}%)`); g.addColorStop(1, `hsl(${195 - alt * 10},75%,${84 - alt * 30}%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* sol + nuvens em parallax */
    ctx.fillStyle = 'rgba(255,244,190,.85)'; ctx.beginPath(); ctx.arc(W * .8, 90 + cam * .02, 30, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 6; i++) {
      const y = ((i * 190 + cam * .4) % (H + 120)) - 60, x = (i * 137 + G.t * (8 + i * 3)) % (W + 140) - 70;
      ctx.beginPath(); ctx.ellipse(x, y, 42, 14, 0, 0, 6.3); ctx.ellipse(x + 26, y - 9, 26, 14, 0, 0, 6.3); ctx.ellipse(x - 24, y - 4, 20, 11, 0, 0, 6.3); ctx.fill();
    }
    /* colinas lá em baixo (só no início) */
    const hy = H * .72 + 40 + cam;
    if (hy < H + 80) { ctx.fillStyle = '#65a30d'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hy + Math.sin(x * .02) * 14); ctx.lineTo(W, H); ctx.fill(); }

    ctx.save(); ctx.translate(0, cam);
    const from = Math.max(0, G.cur - 4);
    for (let i = from; i < Math.min(G.plats.length, G.cur + 8); i++) plank(ctx, G.plats[i], py(G, i, api), G.t);
    const c = G.ch;
    if (!c.dead) {
      chicken(ctx, c.x, c.y, c, G.t);
      /* guia subtil: linha vertical a partir da galinha (só nos primeiros saltos) */
      if (!c.air && G.cur < 3) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(c.x, c.y - 60); ctx.lineTo(c.x, py(G, G.cur + 1, api) + 4); ctx.stroke(); ctx.setLineDash([]); }
    }
    G.feathers.forEach(f => { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.globalAlpha = Math.min(1, f.life); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.5, 0, 0, 6.3); ctx.fill(); ctx.restore(); });
    ctx.restore();
    /* vidas */
    for (let i = 0; i < G.cfg.lives; i++) { ctx.globalAlpha = i < G.lives ? 1 : .25; ctx.font = '18px system-ui'; ctx.textAlign = 'left'; ctx.fillText('🐔', 12 + i * 24, H - 16); }
    ctx.globalAlpha = 1;
  }

  return ArcadeKit.create({
    id: 'chicken-up', title: 'Galinha Acima', icon: '🐔',
    accent: '#f59e0b', accent2: '#ef4444', bg: '#7cc4f0',
    tagline: 'As tábuas não param de deslizar. Um toque, um salto — acerta no momento e sobe.',
    view: { w: 400 },
    how: [
      'Toca, clica ou carrega em <b>Espaço</b> para saltar a direito para a tábua de cima.',
      'Salta quando a tábua de cima estiver por cima da galinha. Se falhar, pode cair de volta — se a de baixo ainda lá estiver.',
      'Aterra ao centro para um <b>Perfeito</b> e apanha os ovos dourados. Tábuas claras desfazem-se: não fiques muito tempo.',
    ],
    controls: ['🖱️ Clique', '👆 Toque', '⌨️ Espaço'],
    ready: { title: 'Toca para saltar', hint: 'Espera que a tábua de cima passe por cima de ti e salta.' },
    setup, update, draw,
    down: (G, x, y, api) => jump(G, api),
    key: (G, e, api) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') { jump(G, api); return true; } },
    hud: G => [['Pontos', G.score], ['Tábuas', G.cur], ['🥚', G.eggs], ...(G.combo >= 2 ? [['Série', '×' + G.combo, 'hot']] : [])],
    achievements: [
      { id: 'cu.25', name: 'Galinha Voadora', icon: '🐔', desc: 'Sobe 25 tábuas na Galinha Acima.', test: c => ((c.result.meta || {}).planks || 0) >= 25 },
      { id: 'cu.60', name: 'Rainha da Capoeira', icon: '👑', desc: 'Sobe 60 tábuas na Galinha Acima.', test: c => ((c.result.meta || {}).planks || 0) >= 60 },
    ],
  });
})();
