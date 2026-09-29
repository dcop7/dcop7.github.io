/* ══════════════════════════════════════════════════════════════════
   Toques (Keep Up) — mantém a bola no ar tocando-lhe. Tocar à esquerda
   da bola manda-a para a direita (e vice-versa); por baixo e ao centro
   é um "toque perfeito". A gravidade vai subindo, aparece vento, uma
   segunda bola e a bola encolhe. Estrelas no ar valem pontos extra.
══════════════════════════════════════════════════════════════════ */
const KeepUpGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const DIFF = {
    easy:   { lives: 3, g: 760, gAdd: 7, second: 40, wind: 20 },
    medium: { lives: 2, g: 880, gAdd: 9, second: 30, wind: 15 },
    hard:   { lives: 1, g: 1000, gAdd: 11, second: 22, wind: 10 },
  };

  /* bola nova flutua devagar até ao primeiro toque (fair play no arranque e ao renascer) */
  function newBall(api, x) { return { x: x ?? api.W / 2, y: api.H * .4, vx: U.rand(-25, 25), vy: -120, r: 32, a: 0, va: 0, last: -1, squash: 0, floaty: true }; }

  function setup(api, o) {
    const cfg = DIFF[o.diff] || DIFF.medium;
    return { cfg, lives: cfg.lives, balls: [newBall(api)], kicks: 0, score: 0, perfects: 0, stars: [], starT: 3, wind: 0, windT: 0, t: 0, spawned2: false, whiffs: [], over: false };
  }

  const ground = api => api.H - 70;

  function kick(G, api, x, y) {
    let best = null, bd = Infinity;
    G.balls.forEach(b => { const d = U.dist(x, y, b.x, b.y); if (d < b.r * 1.7 && d < bd && G.t - b.last > .12) { bd = d; best = b; } });
    if (!best) { G.whiffs.push({ x, y, t: .35 }); api.sfx.noise(.05, .03, 0, 3000, 'highpass'); return; }
    const b = best, g = gravity(G);
    const off = U.clamp((b.x - x) / b.r, -1.2, 1.2);
    const below = y > b.y - b.r * .2;
    const perfect = Math.abs(off) < .3 && below;
    b.vy = -(560 + g * .32) * (perfect ? 1.05 : 1);
    b.vx = b.vx * .35 + off * 280;
    b.va = -off * 14 + U.rand(-2, 2);
    b.last = G.t; b.squash = 1; b.floaty = false;
    G.kicks++;
    let pts = 1;
    if (perfect) { G.perfects++; pts++; api.float(b.x, b.y - b.r - 16, 'Toque perfeito +2', '#fde047', 16); }
    G.score += pts;
    api.sfx.noise(.06, .12, 0, 900, 'lowpass'); api.sfx.tone(perfect ? 520 : 380, .07, 'triangle', .09); api.vibe(10);
    for (let i = 0; i < 6; i++) api.spark({ x: x, y: y, vx: U.rand(-120, 120), vy: U.rand(-40, 120), color: '#fff', size: 2, life: .3, gravity: 300 });
    if (G.kicks === G.cfg.wind) api.banner('Vento!', 'Olha para as setas');
    if (G.kicks % 25 === 0) { api.banner(G.kicks + ' toques!', U.pick(['Craque!', 'Que pé!', 'Não pára!'])); api.sfx.arp([523, 659, 784], .06, .1, 'triangle', .07); }
  }

  const gravity = G => Math.min(G.cfg.g * 1.9, G.cfg.g + G.kicks * G.cfg.gAdd);

  function update(G, dt, api) {
    const W = api.W, gy = ground(api), g = gravity(G);
    G.t += dt;
    /* vento: rajadas alternadas depois de N toques */
    if (G.kicks >= G.cfg.wind) {
      G.windT -= dt;
      if (G.windT <= 0) { G.windT = U.rand(3, 5.5); G.windTarget = U.rand(90, 170 + G.kicks * 1.5) * (Math.random() < .5 ? -1 : 1); }
      G.wind = U.lerp(G.wind, G.windTarget || 0, Math.min(1, dt * 1.2));
    }
    if (!G.spawned2 && G.kicks >= G.cfg.second) { G.spawned2 = true; const nb = newBall(api, G.balls[0].x < W / 2 ? W * .75 : W * .25); nb.y = 90; nb.vy = 0; G.balls.push(nb); api.banner('Segunda bola!', 'Mantém as duas no ar'); }
    for (const b of G.balls) {
      b.r = Math.max(23, 32 - Math.max(0, G.kicks - 40) * .12);
      b.vy += g * (b.floaty ? .22 : 1) * dt; b.vx += G.wind * (b.floaty ? .2 : 1) * dt; b.vx *= Math.exp(-.35 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt; b.va *= Math.exp(-.6 * dt); b.squash = Math.max(0, b.squash - dt * 6);
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * .75; api.sfx.tone(240, .04, 'triangle', .04); }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * .75; api.sfx.tone(240, .04, 'triangle', .04); }
      if (b.y < b.r + 50) { b.y = b.r + 50; b.vy = Math.abs(b.vy) * .5; }
      if (b.y > gy - b.r && !G.over) {
        G.lives--;
        api.shake(8, .3); api.vibe(80); api.sfx.tone(220, .3, 'sawtooth', .06, 0, 90);
        for (let i = 0; i < 12; i++) api.spark({ x: b.x, y: gy, vx: U.rand(-160, 160), vy: U.rand(-200, -40), color: '#65a30d', size: 3, life: .6, gravity: 600 });
        if (G.lives <= 0) {
          G.over = true; b.y = gy - b.r;
          api.over({ score: G.score, won: false, delay: 800, title: 'A bola caiu!', icon: '⚽', stats: [['Toques', G.kicks], ['Perfeitos', G.perfects], ['Estrelas', G.starsGot || 0]], meta: { kicks: G.kicks } });
          return;
        }
        Object.assign(b, newBall(api, b.x), { r: b.r });
        b.y = 110; b.vy = 0; b.inv = 1;
        api.banner(G.lives === 1 ? 'Última bola!' : G.lives + ' bolas', '');
      }
    }
    /* estrelas para apanhar com a bola */
    G.starT -= dt;
    if (G.starT <= 0 && G.stars.length < 2) { G.starT = U.rand(4, 7); G.stars.push({ x: U.rand(50, W - 50), y: U.rand(120, gy - 220), t: 6 }); }
    G.stars.forEach(s => { s.t -= dt; G.balls.forEach(b => { if (!s.got && U.dist(b.x, b.y, s.x, s.y) < b.r + 16) { s.got = true; G.score += 3; G.starsGot = (G.starsGot || 0) + 1; api.float(s.x, s.y - 20, '+3 ★', '#fde047', 18); api.sfx.arp([988, 1319], .05, .08, 'sine', .07); } }); });
    G.stars = G.stars.filter(s => !s.got && s.t > 0);
    G.whiffs.forEach(w => { w.t -= dt; }); G.whiffs = G.whiffs.filter(w => w.t > 0);
  }

  /* ── desenho ── */
  function football(ctx, b) {
    ctx.save(); ctx.translate(b.x, b.y);
    const sq = b.squash * .12; ctx.scale(1 + sq, 1 - sq);
    ctx.rotate(b.a);
    const r = b.r;
    const g = ctx.createRadialGradient(-r * .35, -r * .35, r * .1, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.clip();
    ctx.fillStyle = '#111827';
    const pent = (cx, cy, s) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.2566; ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); } ctx.closePath(); ctx.fill(); };
    pent(0, 0, r * .3);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.2566; pent(Math.cos(a) * r * .82, Math.sin(a) * r * .82, r * .26); }
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 1.2566; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .3, Math.sin(a) * r * .3); ctx.lineTo(Math.cos(a) * r * .58, Math.sin(a) * r * .58); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  }

  function draw(G, ctx, W, H, api) {
    const gy = ground(api);
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#020617'); sky.addColorStop(1, '#172554');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gy);
    /* holofotes */
    [[0, -1], [W, 1]].forEach(([x, s]) => {
      const lg = ctx.createRadialGradient(x, 30, 5, x, 30, H * .9);
      lg.addColorStop(0, 'rgba(255,255,230,.22)'); lg.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(W / 2 - s * 40, gy); ctx.lineTo(W / 2 + s * W * .45, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.arc(x + (s > 0 ? -18 : 18), 36, 9, 0, 6.3); ctx.fill();
    });
    /* bancada */
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, gy - 90, W, 90);
    for (let i = 0; i < 70; i++) { ctx.fillStyle = `hsla(${(i * 47) % 360},40%,${25 + (i % 5) * 4}%,1)`; ctx.beginPath(); ctx.arc((i * 23) % W + 8, gy - 80 + (Math.floor(i * 23 / W) % 3) * 22 + Math.sin(api.t * 3 + i) * 1.5, 7, 0, 6.3); ctx.fill(); }
    /* relvado */
    const gr = ctx.createLinearGradient(0, gy, 0, H);
    gr.addColorStop(0, '#4d7c0f'); gr.addColorStop(1, '#365314');
    ctx.fillStyle = gr; ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let x = 0; x < W; x += 60) ctx.fillRect(x, gy, 30, H - gy);
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, gy + 3); ctx.lineTo(W, gy + 3); ctx.stroke();
    /* vento */
    if (Math.abs(G.wind) > 15) {
      ctx.strokeStyle = `rgba(186,230,253,${Math.min(.5, Math.abs(G.wind) / 300)})`; ctx.lineWidth = 2;
      const dir = Math.sign(G.wind);
      for (let i = 0; i < 7; i++) {
        const y = 110 + i * (gy - 180) / 7, x = ((api.t * G.wind * .8 + i * 97) % (W + 80) + W + 80) % (W + 80) - 40;
        ctx.beginPath(); ctx.moveTo(x - dir * 26, y); ctx.lineTo(x, y); ctx.lineTo(x - dir * 8, y - 6); ctx.moveTo(x, y); ctx.lineTo(x - dir * 8, y + 6); ctx.stroke();
      }
    }
    /* estrelas */
    G.stars.forEach(s => {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(api.t); ctx.globalAlpha = Math.min(1, s.t);
      ctx.fillStyle = '#fde047'; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 12;
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 14; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.restore();
    });
    /* sombras e bolas */
    G.balls.forEach(b => {
      const h = Math.max(0, gy - b.y), k = Math.max(.15, 1 - h / (H * .8));
      ctx.fillStyle = `rgba(0,0,0,${.35 * k})`; ctx.beginPath(); ctx.ellipse(b.x, gy + 6, b.r * k, b.r * .25 * k, 0, 0, 6.3); ctx.fill();
    });
    G.balls.forEach(b => football(ctx, b));
    G.whiffs.forEach(w => { ctx.strokeStyle = `rgba(255,255,255,${w.t * 1.5})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w.x, w.y, 18 + (.35 - w.t) * 40, 0, 6.3); ctx.stroke(); });
    for (let i = 0; i < G.cfg.lives; i++) { ctx.globalAlpha = i < G.lives ? 1 : .2; ctx.font = '16px system-ui'; ctx.textAlign = 'left'; ctx.fillText('⚽', 12 + i * 22, H - 16); }
    ctx.globalAlpha = 1;
    if (G.kicks === 0) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '600 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Toca na bola por baixo!', W / 2, gy + 40); }
  }

  return ArcadeKit.create({
    id: 'keep-up', title: 'Toques', icon: '⚽',
    accent: '#84cc16', accent2: '#fde047', bg: '#020617',
    tagline: 'Faz toques sem deixar a bola cair. Vento, gravidade a subir e, a certa altura, duas bolas.',
    view: { w: 400 },
    how: [
      'Toca ou clica <b>na bola</b> para lhe dar um toque. Tocar à esquerda da bola manda-a para a direita, e vice-versa.',
      'Toque por baixo e ao centro = <b>toque perfeito</b> (+2). Passa a bola pelas estrelas para +3.',
      'A gravidade vai subindo, aparece vento e depois uma segunda bola. Se tocar na relva, perdes-a.',
    ],
    controls: ['🖱️ Clique na bola', '👆 Toque na bola', '⌨️ Espaço (bola mais baixa)'],
    ready: { title: 'Toca para começar', hint: 'Toca na bola para a manter no ar.' },
    setup, update, draw,
    down: (G, x, y, api) => kick(G, api, x, y),
    key: (G, e, api) => {
      if (e.key === ' ') { const b = G.balls.reduce((a, c) => (c.y > a.y ? c : a)); kick(G, api, b.x, b.y + b.r * .5); return true; }
    },
    hud: G => [['Toques', G.kicks], ['Pontos', G.score], ...(Math.abs(G.wind) > 15 ? [['Vento', (G.wind > 0 ? '→ ' : '← ') + Math.round(Math.abs(G.wind) / 10)]] : [])],
    achievements: [
      { id: 'ku.50',  name: 'Malabarista',  icon: '⚽', desc: '50 toques numa partida dos Toques.', test: c => ((c.result.meta || {}).kicks || 0) >= 50 },
      { id: 'ku.150', name: 'Pé de Veludo', icon: '🦶', desc: '150 toques numa partida dos Toques.', test: c => ((c.result.meta || {}).kicks || 0) >= 150 },
    ],
  });
})();
