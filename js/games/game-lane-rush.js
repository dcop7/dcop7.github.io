/* ══════════════════════════════════════════════════════════════════
   Faixa Rápida (Lane Rush) — estrada de 3 faixas em pseudo-3D; troca de
   faixa para fugir aos obstáculos enquanto a velocidade não pára de subir.
   Perspetiva própria em canvas 2D (profundidade z → escala F/(z+F)).
   Linha de obstáculos gerada sempre com pelo menos uma faixa livre e com
   tempo de reação mínimo garantido pela velocidade atual.
══════════════════════════════════════════════════════════════════ */
const LaneRushGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const ZMAX = 70, F = 7, LANE = 124;
  const DIFF = {
    easy:   { v0: 16, vMax: 40, acc: .28, tMin: .72 },
    medium: { v0: 19, vMax: 48, acc: .36, tMin: .56 },
    hard:   { v0: 23, vMax: 56, acc: .46, tMin: .44 },
  };

  function setup(api, o) {
    return {
      cfg: DIFF[o.diff] || DIFF.medium,
      lane: 1, px: 1, tilt: 0,
      v: (DIFF[o.diff] || DIFF.medium).v0, dist: 0, time: 0,
      objs: [], nextRow: 26, rows: 0,
      score: 0, coins: 0, nears: 0, shield: false, shieldFx: 0,
      stripe: 0, over: false, boom: null,
    };
  }

  /* projeção: z (distância) → escala e y no ecrã */
  const scale = z => F / (Math.max(z, -F + .5) + F);
  function rowY(api, z) { const hz = api.H * .34, by = api.H - 96; return hz + (by - hz) * scale(z); }
  function laneX(api, lane, z) { return api.W / 2 + (lane - 1) * LANE * scale(z); }

  function spawnRow(G) {
    const kinds = G.rows < 3 ? ['one', 'coins'] : ['one', 'one', 'two', 'two', 'coins', 'car', 'mix'];
    const k = U.pick(kinds);
    const z = ZMAX;
    const free = U.randi(0, 2);
    if (k === 'one') G.objs.push({ t: 'bar', lane: U.randi(0, 2), z });
    else if (k === 'two') [0, 1, 2].filter(l => l !== free).forEach(l => G.objs.push({ t: 'bar', lane: l, z }));
    else if (k === 'coins') { const l = U.randi(0, 2); for (let i = 0; i < 4; i++) G.objs.push({ t: 'coin', lane: l, z: z + i * 3 }); }
    else if (k === 'car') {
      const l = U.randi(0, 2), to = l === 0 ? 1 : l === 2 ? 1 : U.pick([0, 2]);
      G.objs.push({ t: 'car', lane: l, from: l, to, z, hue: U.pick([200, 280, 30, 140]) });
    } else {
      G.objs.push({ t: 'bar', lane: free === 0 ? 1 : 0, z });
      G.objs.push({ t: 'coin', lane: free, z: z + 1 });
      if (Math.random() < .08 && !G.shield) G.objs.push({ t: 'shield', lane: free, z: z + 5 });
    }
    G.rows++;
  }

  function steer(G, d, api) {
    if (G.over) return;
    const nl = U.clamp(G.lane + d, 0, 2);
    if (nl === G.lane) { G.tilt = d * .5; return; }
    G.lane = nl;
    api.sfx.tone(d < 0 ? 520 : 600, .06, 'triangle', .05, 0, d < 0 ? 420 : 760);
  }

  function crash(G, api, o) {
    if (G.shield) {
      G.shield = false; G.shieldFx = 1; o.dead = true;
      api.shake(6, .2); api.flash('#67e8f9', .15);
      api.sfx.noise(.2, .12, 0, 1800); api.float(laneX(api, G.px, 0), rowY(api, 0) - 70, 'Escudo!', '#67e8f9', 20);
      return;
    }
    G.over = true;
    const x = laneX(api, G.px, 0), y = rowY(api, 0) - 20;
    G.boom = { x, y, t: 0 };
    for (let i = 0; i < 36; i++) api.spark({ x, y, vx: U.rand(-320, 320), vy: U.rand(-380, 60), color: U.pick(['#f472b6', '#fb923c', '#fde047', '#fff']), size: U.rand(2, 5), life: U.rand(.5, 1), gravity: 600 });
    api.shake(14, .45); api.flash('#f472b6', .25); api.vibe([60, 40, 100]);
    api.sfx.noise(.5, .22, 0, 400, 'lowpass'); api.sfx.tone(160, .4, 'sawtooth', .07, 0, 50);
    api.over({ score: G.score, won: false, delay: 1100, title: 'Batida!', icon: '💥',
      stats: [['Distância', Math.floor(G.dist) + ' m'], ['Velocidade', Math.round(G.v * 6) + ' km/h'], ['Moedas', G.coins], ['Por um triz', G.nears]],
      meta: { dist: Math.floor(G.dist) } });
  }

  function update(G, dt, api) {
    const c = G.cfg;
    G.time += dt;
    G.v = Math.min(c.vMax, G.v + c.acc * dt);
    const dz = G.v * dt;
    G.dist += dz * .8;
    G.score = Math.floor(G.dist / 2) + G.coins * 5 + G.nears * 3;
    G.stripe = (G.stripe + dz) % 6;
    G.px = U.lerp(G.px, G.lane, Math.min(1, dt * 16));
    G.tilt = U.lerp(G.tilt, (G.lane - G.px) * 1.4, Math.min(1, dt * 12));
    G.shieldFx = Math.max(0, G.shieldFx - dt * 2);

    G.nextRow -= dz;
    if (G.nextRow <= 0) {
      spawnRow(G);
      const T = Math.max(c.tMin, 1.2 - G.time * .0075);
      G.nextRow = G.v * T + U.rand(0, 4);
    }
    if (Math.floor(G.dist / 500) > Math.floor((G.dist - dz * .8) / 500)) { api.banner(Math.floor(G.dist / 500) * 500 + ' m', 'Mais rápido!'); api.sfx.arp([523, 784], .07, .1, 'triangle', .06); }

    for (let i = G.objs.length - 1; i >= 0; i--) {
      const o = G.objs[i];
      o.z -= dz;
      if (o.t === 'car') {
        o.z += G.v * .35 * dt;           /* os carros andam, mas mais devagar que tu */
        if (o.z < 34 && o.from !== o.to) { o.lane = U.lerp(o.lane, o.to, Math.min(1, dt * 2.2)); }
      }
      if (o.dead) { G.objs.splice(i, 1); continue; }
      const near = o.z < .9 && o.z > -.9;
      const dl = Math.abs(o.lane - G.px);
      if (near && dl < .55) {
        if (o.t === 'coin') { G.coins++; o.dead = true; api.sfx.tone(988, .06, 'sine', .07); api.sfx.tone(1319, .08, 'sine', .05, .05); api.float(laneX(api, o.lane, 0), rowY(api, 0) - 60, '+5', '#fde047', 16); continue; }
        if (o.t === 'shield') { G.shield = true; o.dead = true; api.sfx.arp([660, 880, 1100], .05, .1, 'sine', .07); api.banner('Escudo', 'Aguenta uma batida'); continue; }
        if (!G.over) crash(G, api, o);
        if (G.over) return;
      }
      if (o.z < -1 && !o.passed) {
        o.passed = true;
        if ((o.t === 'bar' || o.t === 'car') && dl < 1.25 && dl >= .55) { G.nears++; api.float(laneX(api, G.px, 0), rowY(api, 0) - 80, 'Por um triz +3', '#a5f3fc', 15); }
      }
      if (o.z < -6) G.objs.splice(i, 1);
    }
  }

  /* ── desenho ── */
  function drawCar(ctx, x, y, s, body, glow, tilt) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(tilt || 0);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(0, 4, 50, 9, 0, 0, 6.3); ctx.fill();
    if (glow) { ctx.fillStyle = glow; ctx.globalAlpha = .45; ctx.beginPath(); ctx.ellipse(0, 6, 56, 11, 0, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#111'; U.rr(ctx, -44, -12, 14, 16, 3); ctx.fill(); U.rr(ctx, 30, -12, 14, 16, 3); ctx.fill();
    ctx.fillStyle = body; U.rr(ctx, -46, -40, 92, 38, 12); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; U.rr(ctx, -30, -60, 60, 24, 9); ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,.35)'; U.rr(ctx, -25, -56, 50, 16, 6); ctx.fill();
    ctx.fillStyle = '#ff2d55'; U.rr(ctx, -40, -30, 22, 7, 3); ctx.fill(); U.rr(ctx, 18, -30, 22, 7, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-12, -20, 24, 8);
    ctx.restore();
  }

  function draw(G, ctx, W, H, api) {
    const hz = H * .34;
    /* céu + sol synthwave */
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#0b0322'); sky.addColorStop(1, '#4a0f55');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    const sunR = 70, sy = hz - 18;
    const sg = ctx.createLinearGradient(0, sy - sunR, 0, sy + sunR);
    sg.addColorStop(0, '#fde047'); sg.addColorStop(1, '#f43f5e');
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, sy, sunR, Math.PI, 0); ctx.closePath(); ctx.clip();
    ctx.fillStyle = sg; ctx.fillRect(W / 2 - sunR, sy - sunR, sunR * 2, sunR);
    ctx.fillStyle = '#2a0838';
    for (let i = 0; i < 6; i++) { const yy = sy - 6 - i * 10; ctx.fillRect(W / 2 - sunR, yy, sunR * 2, 2 + i * .7); }
    ctx.restore();
    ctx.fillStyle = '#1a0526';
    ctx.beginPath(); ctx.moveTo(0, hz);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hz - 14 - Math.abs(Math.sin(x * .031) * 26) - Math.abs(Math.sin(x * .011)) * 20);
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    /* chão */
    const gr = ctx.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, '#12051f'); gr.addColorStop(1, '#070211');
    ctx.fillStyle = gr; ctx.fillRect(0, hz, W, H - hz);
    ctx.strokeStyle = 'rgba(244,114,182,.18)'; ctx.lineWidth = 1;
    for (let z = 6 - G.stripe; z < ZMAX; z += 6) { const y = rowY(api, z); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    /* estrada */
    const zN = -2.5, zF = ZMAX;
    const hw = z => LANE * 1.55 * scale(z);
    ctx.fillStyle = '#0d0a18';
    ctx.beginPath(); ctx.moveTo(W / 2 - hw(zF), rowY(api, zF)); ctx.lineTo(W / 2 + hw(zF), rowY(api, zF));
    ctx.lineTo(W / 2 + hw(zN), rowY(api, zN)); ctx.lineTo(W / 2 - hw(zN), rowY(api, zN)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 3; ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 10;
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(W / 2 + sd * hw(zF), rowY(api, zF)); ctx.lineTo(W / 2 + sd * hw(zN), rowY(api, zN)); ctx.stroke(); });
    ctx.shadowBlur = 0;
    /* tracejado das faixas */
    ctx.fillStyle = 'rgba(103,232,249,.75)';
    [.5, 1.5].forEach(l => {
      for (let z = -G.stripe; z < ZMAX; z += 6) {
        const z1 = z + 3; if (z1 < zN) continue;
        const a = Math.max(z, zN);
        const x0 = laneX(api, l, a), x1 = laneX(api, l, z1), y0 = rowY(api, a), y1 = rowY(api, z1), w0 = 3 * scale(a), w1 = 3 * scale(z1);
        ctx.beginPath(); ctx.moveTo(x0 - w0, y0); ctx.lineTo(x0 + w0, y0); ctx.lineTo(x1 + w1, y1); ctx.lineTo(x1 - w1, y1); ctx.closePath(); ctx.fill();
      }
    });

    /* objetos, do fundo para a frente */
    const list = G.objs.filter(o => o.z > -3).sort((a, b) => b.z - a.z);
    list.forEach(o => {
      const s = scale(o.z), x = laneX(api, o.lane, o.z), y = rowY(api, o.z);
      const fade = Math.min(1, (ZMAX - o.z) / 10);
      ctx.globalAlpha = fade;
      if (o.t === 'bar') {
        const w = LANE * .82 * s, h = 46 * s;
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x - w / 2, y - 3 * s, w, 6 * s);
        ctx.fillStyle = '#1f1235'; ctx.fillRect(x - w / 2, y - h, w, h);
        ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y - h * .8, w, h * .45); ctx.clip();
        for (let i = -2; i < 8; i++) { ctx.fillStyle = i % 2 ? '#fb923c' : '#111'; ctx.beginPath(); const bx = x - w / 2 + i * w / 6; ctx.moveTo(bx, y - h * .35); ctx.lineTo(bx + w / 12, y - h * .8); ctx.lineTo(bx + w / 6 + w / 12, y - h * .8); ctx.lineTo(bx + w / 6, y - h * .35); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 2 * s + .5; ctx.strokeRect(x - w / 2, y - h, w, h);
        ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(x - w * .38, y - h, 4 * s, 0, 6.3); ctx.arc(x + w * .38, y - h, 4 * s, 0, 6.3); ctx.fill();
      } else if (o.t === 'coin') {
        const r = 13 * s, sp = Math.abs(Math.sin(api.t * 5 + o.z));
        ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.ellipse(x, y - 26 * s, r * (.25 + .75 * sp), r, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.ellipse(x, y - 26 * s, r * .55 * (.25 + .75 * sp), r * .55, 0, 0, 6.3); ctx.fill();
      } else if (o.t === 'shield') {
        const r = 16 * s; ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 3 * s + .5; ctx.fillStyle = 'rgba(103,232,249,.25)';
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + api.t; ctx.lineTo(x + Math.cos(a) * r, y - 30 * s + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (o.t === 'car') {
        drawCar(ctx, x, y, s * .92, `hsl(${o.hue},70%,45%)`, null, 0);
        if (o.from !== o.to && o.z < 50 && Math.floor(api.t * 6) % 2) {
          const sd = o.to > o.from ? 1 : -1; ctx.fillStyle = '#fbbf24';
          ctx.beginPath(); ctx.arc(x + sd * 40 * s, y - 28 * s, 5 * s + .5, 0, 6.3); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });

    /* jogador */
    if (!G.boom) {
      const x = laneX(api, G.px, 0), y = rowY(api, 0);
      drawCar(ctx, x, y, 1, '#22d3ee', '#f472b6', G.tilt * .12);
      if (G.shield || G.shieldFx > 0) {
        ctx.strokeStyle = `rgba(103,232,249,${G.shield ? .55 + .25 * Math.sin(api.t * 6) : G.shieldFx})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, y - 26, 66, 44, 0, 0, 6.3); ctx.stroke();
      }
    }
    /* velocímetro de linhas (sensação de velocidade) */
    const k = (G.v - G.cfg.v0) / (G.cfg.vMax - G.cfg.v0);
    if (k > .3) {
      ctx.strokeStyle = `rgba(255,255,255,${(k - .3) * .25})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) { const a = (i * 2.4 + api.t * 9) % 1; const sd = i % 2 ? 1 : -1; const xx = W / 2 + sd * (W * .35 + a * W * .2); ctx.beginPath(); ctx.moveTo(xx, hz + a * (H - hz)); ctx.lineTo(xx + sd * 14, hz + a * (H - hz) + 40); ctx.stroke(); }
    }
    /* zonas de toque (dica subtil) */
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.font = "700 26px system-ui"; ctx.textAlign = 'center';
    ctx.fillText('‹', 24, H - 24); ctx.fillText('›', W - 24, H - 24);
  }

  return ArcadeKit.create({
    id: 'lane-rush', title: 'Faixa Rápida', icon: '🏎️',
    accent: '#f472b6', accent2: '#22d3ee', bg: '#08020f',
    tagline: 'Três faixas, obstáculos a vir e a velocidade sempre a subir. Até onde chegas?',
    view: { w: 400 },
    how: [
      'Toca/clica na <b>metade esquerda</b> ou <b>direita</b> do ecrã para mudar de faixa (ou usa ← →).',
      'Foge às barreiras e aos carros — os carros com pisca aceso vão mudar de faixa.',
      'Apanha moedas (+5), passa rente aos obstáculos (+3) e agarra o <b>escudo</b> quando aparecer.',
    ],
    controls: ['🖱️ Clique esq./dir.', '👆 Toque esq./dir.', '⌨️ ← →'],
    ready: { title: 'Toca para arrancar', hint: 'Toca à esquerda ou à direita do carro para trocar de faixa.' },
    setup, update, draw,
    down: (G, x, y, api) => steer(G, x < api.W / 2 ? -1 : 1, api),
    key: (G, e, api) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { steer(G, -1, api); return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { steer(G, 1, api); return true; }
    },
    hud: G => [['Pontos', G.score], ['km/h', Math.round(G.v * 6)], ['🪙', G.coins], ...(G.shield ? [['Escudo', '🛡️', 'hot']] : [])],
    achievements: [
      { id: 'lr.1k',  name: 'Na Autoestrada', icon: '🏎️', desc: 'Percorre 1000 m na Faixa Rápida.', test: c => ((c.result.meta || {}).dist || 0) >= 1000 },
      { id: 'lr.3k',  name: 'Piloto Neon',    icon: '🌆', desc: 'Percorre 3000 m na Faixa Rápida.', test: c => ((c.result.meta || {}).dist || 0) >= 3000 },
      { id: 'lr.500', name: 'Pé no Fundo',    icon: '🔥', desc: 'Faz 500 pontos na Faixa Rápida.', test: c => (c.result.score || 0) >= 500 },
    ],
  });
})();
