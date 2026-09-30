/* ══════════════════════════════════════════════════════════════════
   Queda Livre (Balldrop) — a bola cai; tu guias na horizontal. As
   barras param-na: encontra a abertura. Picos rebentam-na, pára-choques
   atiram-na, hélices empurram-na. Lá em baixo há 5 copos (×1 ×2 ×5 ×2
   ×1): aterra no do meio para multiplicar. Cada nível é mais fundo e
   mais traiçoeiro; as vidas passam de nível para nível.
══════════════════════════════════════════════════════════════════ */
const BalldropGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const R = 12, BT = 14, GR = 1150, VMAX = 640;
  const MULT = [1, 2, 5, 2, 1];
  const DIFF = {
    easy:   { lives: 4, gap: 1.2, spd: .8 },
    medium: { lives: 3, gap: 1, spd: 1 },
    hard:   { lives: 2, gap: .85, spd: 1.2 },
  };

  function buildLevel(G, W) {
    const lv = G.level, c = G.cfg;
    const D = 2000 + lv * 520;
    const obs = [];
    let y = 330;
    while (y < D - 360) {
      const pool = ['bar', 'bar', 'bumpers'];
      if (lv >= 2) pool.push('mbar', 'spikebar');
      if (lv >= 3) pool.push('spinner', 'sball', 'spikebar');
      if (lv >= 5) pool.push('mbar', 'sball');
      const k = U.pick(pool);
      const gw = Math.max(58, (112 - lv * 4) * c.gap);
      if (k === 'bar' || k === 'mbar' || k === 'spikebar') {
        const b = { t: 'bar', y, gw, gx: U.rand(gw / 2 + 10, W - gw / 2 - 10), vx: k === 'mbar' ? U.rand(50, 90 + lv * 8) * c.spd * (Math.random() < .5 ? -1 : 1) : 0, spikes: [] };
        if (k === 'spikebar') {
          const L = [8, b.gx - b.gw / 2 - 50], Rr = [b.gx + b.gw / 2 + 50, W - 8];
          if (L[1] - L[0] > 50 && Math.random() < .8) b.spikes.push([L[0] + U.rand(0, (L[1] - L[0]) * .4), L[1]]);
          if (Rr[1] - Rr[0] > 50 && Math.random() < .8) b.spikes.push([Rr[0], Rr[1] - U.rand(0, (Rr[1] - Rr[0]) * .4)]);
        }
        obs.push(b);
        if (Math.random() < .5) obs.push({ t: 'gem', x: b.gx + U.rand(-20, 20), y: y + 70, got: false });
      } else if (k === 'bumpers') {
        const n = U.randi(2, 3);
        for (let i = 0; i < n; i++) obs.push({ t: 'bump', x: W * (i + 1) / (n + 1) + U.rand(-30, 30), y: y + U.rand(-30, 30), r: U.rand(16, 22), hit: 0 });
        obs.push({ t: 'gem', x: U.rand(40, W - 40), y: y - 70, got: false });
      } else if (k === 'spinner') {
        obs.push({ t: 'spin', x: U.rand(W * .3, W * .7), y, L: U.rand(80, 110), a: Math.random() * 6, w: U.rand(1.4, 2.4) * c.spd * (Math.random() < .5 ? -1 : 1) });
      } else if (k === 'sball') {
        obs.push({ t: 'sball', x: U.rand(40, W - 40), y, r: 14, vx: U.rand(70, 130) * c.spd * (Math.random() < .5 ? -1 : 1) });
      }
      y += U.rand(175, 235) - Math.min(40, lv * 4);
    }
    G.D = D; G.obs = obs;
    G.x = W / 2; G.y = 80; G.vx = 0; G.vy = 0; G.tx = W / 2; G.cam = 0; G.cp = { x: W / 2, y: 80 };
    G.landed = false; G.lt = 0; G.trail = [];
  }

  function setup(api, o) {
    const G = { cfg: DIFF[o.diff] || DIFF.medium, level: 1, lives: 0, score: 0, gems: 0, inv: 0, bestMult: 0, dead: false };
    G.lives = G.cfg.lives;
    buildLevel(G, api.W);
    return G;
  }

  function die(G, api, why) {
    if (G.inv > 0) return;
    G.lives--;
    api.shake(10, .3); api.flash('#ef4444', .18); api.vibe(90);
    api.sfx.noise(.3, .15, 0, 500, 'lowpass'); api.sfx.tone(300, .3, 'sawtooth', .06, 0, 80);
    for (let i = 0; i < 22; i++) api.spark({ x: G.x, y: G.y - G.cam, vx: U.rand(-260, 260), vy: U.rand(-260, 200), color: U.pick(['#fde047', '#fb923c', '#fff']), size: U.rand(2, 4), life: .6, gravity: 400 });
    if (G.lives <= 0) {
      G.dead = true;
      api.over({ score: G.score, won: false, delay: 800, title: why, icon: '🟡', stats: [['Nível', G.level], ['Diamantes', G.gems], ['Melhor copo', G.bestMult ? '×' + G.bestMult : '—']], meta: { level: G.level } });
      return;
    }
    G.x = G.cp.x; G.y = G.cp.y; G.vx = 0; G.vy = 0; G.inv = 1.3;
  }

  function circleRect(G, x0, y0, x1, y1) {
    const cx = U.clamp(G.x, x0, x1), cy = U.clamp(G.y, y0, y1), dx = G.x - cx, dy = G.y - cy, d = Math.hypot(dx, dy);
    if (d >= R || d === 0) return null;
    return { nx: dx / d, ny: dy / d, pen: R - d };
  }

  function update(G, dt, api) {
    const W = api.W, H = api.H;
    G.inv = Math.max(0, G.inv - dt);
    /* o painel do nível abre pelo relógio do jogo (em pausa, espera) */
    if (G.landed) { G.landT += dt; if (G.landT > .7 && G.onLanded) { const f = G.onLanded; G.onLanded = null; f(); } return; }
    /* controlo */
    const want = U.clamp((G.tx - G.x) * 9, -460, 460);
    G.vx = U.lerp(G.vx, want, Math.min(1, dt * 8));
    G.vy = Math.min(VMAX, G.vy + GR * dt);
    const sub = 3, sdt = dt / sub;
    for (let s = 0; s < sub; s++) {
      G.x += G.vx * sdt; G.y += G.vy * sdt;
      if (G.x < R) { G.x = R; G.vx = Math.abs(G.vx) * .4; }
      if (G.x > W - R) { G.x = W - R; G.vx = -Math.abs(G.vx) * .4; }
      for (const o of G.obs) {
        if (Math.abs(o.y - G.y) > 140 && o.t !== 'spin') continue;
        if (o.t === 'bar') {
          const segs = [[0, o.gx - o.gw / 2], [o.gx + o.gw / 2, W]];
          for (const [a, b] of segs) {
            if (b - a < 1) continue;
            const h = circleRect(G, a, o.y, b, o.y + BT);
            if (!h) continue;
            G.x += h.nx * h.pen; G.y += h.ny * h.pen;
            const vn = G.vx * h.nx + G.vy * h.ny;
            if (vn < 0) { G.vx -= 1.25 * vn * h.nx; G.vy -= 1.25 * vn * h.ny; }
            if (h.ny < -.5) { G.vx += o.vx * .1; if (Math.abs(vn) > 250) api.sfx.tone(180, .05, 'triangle', .05); }
          }
          for (const [a, b] of o.spikes) {
            if (G.x > a - R * .6 && G.x < b + R * .6 && G.y > o.y - 12 - R && G.y < o.y + 2) { die(G, api, 'Picado!'); return; }
          }
          if (!o.passed && G.y > o.y + BT + R) { o.passed = true; G.cp = { x: U.clamp(o.gx, R, W - R), y: o.y + BT + 30 }; G.score += 2; }
        } else if (o.t === 'bump') {
          const dx = G.x - o.x, dy = G.y - o.y, d = Math.hypot(dx, dy);
          if (d < R + o.r) {
            const nx = dx / d, ny = dy / d; G.x = o.x + nx * (R + o.r); G.y = o.y + ny * (R + o.r);
            const vn = G.vx * nx + G.vy * ny;
            if (vn < 0) { G.vx -= 2 * vn * nx; G.vy -= 2 * vn * ny; }
            G.vx += nx * 120; G.vy += ny * 200; o.hit = .2;
            api.sfx.tone(660, .08, 'sine', .07);
          }
        } else if (o.t === 'spin') {
          const c = Math.cos(o.a) * o.L, s2 = Math.sin(o.a) * o.L;
          const d = U.segDist(G.x, G.y, o.x - c, o.y - s2, o.x + c, o.y + s2);
          if (d < R + 5) {
            /* normal aproximada: do centro da hélice para a bola, projetada fora do segmento */
            const ux = Math.cos(o.a), uy = Math.sin(o.a), px = G.x - o.x, py = G.y - o.y, along = px * ux + py * uy;
            let nx = px - along * ux, ny = py - along * uy; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
            G.x += nx * (R + 5 - d); G.y += ny * (R + 5 - d);
            const tv = o.w * along;                   /* velocidade da pá nesse ponto */
            G.vx = G.vx * .5 + nx * 220 - uy * tv * .6; G.vy = G.vy * .5 + ny * 220 + ux * tv * .6;
          }
        } else if (o.t === 'sball') {
          if (U.dist(G.x, G.y, o.x, o.y) < R + o.r - 2) { die(G, api, 'Bateste num ouriço!'); return; }
        } else if (o.t === 'gem' && !o.got && U.dist(G.x, G.y, o.x, o.y) < R + 12) {
          o.got = true; G.gems++; G.score += 10; api.float(o.x, o.y - G.cam - 16, '+10', '#a5f3fc', 16); api.sfx.tone(1320, .07, 'sine', .07);
        }
      }
      /* zona de aterragem */
      if (G.y > G.D - 64) {
        const cw = W / 5;
        for (let i = 1; i < 5; i++) {
          const h = circleRect(G, i * cw - 3, G.D - 64, i * cw + 3, G.D);
          if (h) { G.x += h.nx * h.pen; G.y += h.ny * h.pen; if (h.nx) G.vx = -G.vx * .4; else G.vy = -Math.abs(G.vy) * .3; }
        }
        if (G.y > G.D - R - 6) {
          G.y = G.D - R - 6; G.landed = true;
          const i = U.clamp(Math.floor(G.x / cw), 0, 4), m = MULT[i];
          levelDone(G, api, m); return;
        }
      }
    }
    /* peças em movimento */
    G.obs.forEach(o => {
      if (o.t === 'bar' && o.vx) { o.gx += o.vx * dt; if (o.gx < o.gw / 2 + 10 || o.gx > W - o.gw / 2 - 10) o.vx *= -1; }
      if (o.t === 'spin') o.a += o.w * dt;
      if (o.t === 'sball') { o.x += o.vx * dt; if (o.x < o.r || o.x > W - o.r) o.vx *= -1; }
      if (o.t === 'bump' && o.hit) o.hit = Math.max(0, o.hit - dt);
    });
    G.lt += dt;
    G.cam = U.clamp(G.y - H * .36, 0, Math.max(0, G.D - H + 40));
    G.trail.unshift([G.x, G.y]); if (G.trail.length > 9) G.trail.pop();
  }

  function levelDone(G, api, m) {
    const pts = m * 50 + Math.max(0, Math.round(60 - G.lt * 2));
    G.score += pts; G.bestMult = Math.max(G.bestMult, m);
    api.sfx.arp(m >= 5 ? [523, 659, 784, 1047, 1319] : [523, 659, 784], .07, .14, 'triangle', .09); api.vibe([20, 30, 40]);
    for (let i = 0; i < 26; i++) api.spark({ x: G.x, y: G.y - G.cam, vx: U.rand(-220, 220), vy: U.rand(-320, -60), color: U.pick(['#fde047', '#f0abfc', '#67e8f9', '#fff']), size: U.rand(2, 4), life: 1, gravity: 500 });
    G.landT = 0;
    G.onLanded = () => api.panel({ icon: m >= 5 ? '🎯' : '🟡', title: `Nível ${G.level} concluído`, big: '×' + m,
      sub: `+${pts} pontos · ${G.lives} ${G.lives === 1 ? 'vida' : 'vidas'}`,
      stats: [['Pontos', G.score], ['Diamantes', G.gems], ['Tempo', G.lt.toFixed(1) + 's']],
      buttons: [{ label: '▶ Nível ' + (G.level + 1), primary: true, fn: () => { G.level++; buildLevel(G, api.W); api.resume(); api.banner('Nível ' + G.level, 'Mais fundo'); } },
        { label: 'Terminar aqui', fn: () => { G.dead = true; api.over({ score: G.score, won: true, delay: 0, title: 'Boa descida!', icon: '🟡', stats: [['Níveis', G.level], ['Diamantes', G.gems], ['Melhor copo', '×' + G.bestMult]], meta: { level: G.level } }); } }] });
  }

  /* ── desenho ── */
  function draw(G, ctx, W, H, api) {
    const cam = G.cam;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1e0b3a'); g.addColorStop(1, '#0b0418');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(168,85,247,.08)'; ctx.lineWidth = 1;
    for (let y = -((cam * .5) % 40); y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = 20; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.save(); ctx.translate(0, -cam);
    const vis = o => o.y > cam - 140 && o.y < cam + H + 140;
    G.obs.forEach(o => {
      if (!vis(o)) return;
      if (o.t === 'bar') {
        ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 10;
        ctx.fillStyle = '#c084fc';
        const a = o.gx - o.gw / 2, b = o.gx + o.gw / 2;
        if (a > 0) { U.rr(ctx, 0, o.y, a, BT, 6); ctx.fill(); }
        if (b < W) { U.rr(ctx, b, o.y, W - b, BT, 6); ctx.fill(); }
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.35)'; if (a > 0) ctx.fillRect(4, o.y + 2, a - 8, 2); if (b < W) ctx.fillRect(b + 4, o.y + 2, W - b - 8, 2);
        if (o.vx) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(o.vx > 0 ? '→' : '←', o.gx, o.y + 30); }
        o.spikes.forEach(([x0, x1]) => { ctx.fillStyle = '#f43f5e'; for (let x = x0; x < x1 - 6; x += 12) { ctx.beginPath(); ctx.moveTo(x, o.y); ctx.lineTo(x + 6, o.y - 12); ctx.lineTo(x + 12, o.y); ctx.fill(); } });
      } else if (o.t === 'bump') {
        const k = o.hit ? 1 + o.hit * 1.5 : 1;
        ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 4; ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r * k, 0, 6.3); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(244,114,182,.25)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .6, 0, 6.3); ctx.fill();
      } else if (o.t === 'spin') {
        const c = Math.cos(o.a) * o.L, s = Math.sin(o.a) * o.L;
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(o.x - c, o.y - s); ctx.lineTo(o.x + c, o.y + s); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, 6.3); ctx.fill();
      } else if (o.t === 'sball') {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + api.t * 3, r = i % 2 ? o.r - 3 : o.r + 5; ctx.lineTo(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4c0519'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .55, 0, 6.3); ctx.fill();
      } else if (o.t === 'gem' && !o.got) {
        const b = Math.sin(api.t * 4 + o.y) * 3;
        ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.moveTo(o.x, o.y - 11 + b); ctx.lineTo(o.x + 8, o.y + b); ctx.lineTo(o.x, o.y + 11 + b); ctx.lineTo(o.x - 8, o.y + b); ctx.closePath(); ctx.fill();
      }
    });
    /* zona de aterragem */
    const cw = W / 5, D = G.D;
    MULT.forEach((m, i) => {
      const hue = m === 5 ? '#facc15' : m === 2 ? '#a855f7' : '#475569';
      ctx.fillStyle = hue + '33'; ctx.fillRect(i * cw, D - 64, cw, 64);
      ctx.fillStyle = hue; ctx.fillRect(i * cw, D - 6, cw, 6);
      ctx.fillStyle = '#fff'; ctx.font = "800 20px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.fillText('×' + m, i * cw + cw / 2, D - 26);
    });
    ctx.fillStyle = '#e9d5ff'; for (let i = 1; i < 5; i++) ctx.fillRect(i * cw - 3, D - 64, 6, 64);
    /* bola */
    G.trail.forEach((p, i) => { ctx.globalAlpha = .3 * (1 - i / 9); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(p[0], p[1], R * (1 - i / 12), 0, 6.3); ctx.fill(); });
    ctx.globalAlpha = (G.inv > 0 && Math.floor(G.inv * 12) % 2) ? .35 : 1;
    const bg = ctx.createRadialGradient(G.x - 4, G.y - 5, 2, G.x, G.y, R);
    bg.addColorStop(0, '#fffbeb'); bg.addColorStop(.5, '#facc15'); bg.addColorStop(1, '#b45309');
    ctx.shadowColor = '#facc15'; ctx.shadowBlur = 16; ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(G.x, G.y, R, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
    /* profundidade */
    const k = U.clamp(G.y / G.D, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; U.rr(ctx, W - 10, 70, 4, H - 110, 2); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(W - 8, 70 + k * (H - 110), 5, 0, 6.3); ctx.fill();
    for (let i = 0; i < G.cfg.lives; i++) { ctx.globalAlpha = i < G.lives ? 1 : .22; ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(18 + i * 20, H - 18, 7, 0, 6.3); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  return ArcadeKit.create({
    id: 'balldrop', title: 'Queda Livre', icon: '🟡',
    accent: '#facc15', accent2: '#c084fc', bg: '#0b0418',
    tagline: 'Guia a bola a descer por barras, picos e hélices até ao copo certo lá em baixo.',
    view: { w: 400 },
    how: [
      '<b>Rato:</b> a bola vai para o lado do cursor. <b>Toque:</b> arrasta o dedo para os lados. Também há ← →.',
      'As barras param a bola — encontra a abertura. Foge dos <b style="color:#f43f5e">picos</b> e dos ouriços; os pára-choques cor-de-rosa atiram-te.',
      'Lá em baixo aterra num copo: o do meio multiplica ×5. Cada nível é mais fundo; as vidas continuam de um para o outro.',
    ],
    controls: ['🖱️ Mover o rato', '👆 Arrastar', '⌨️ ← →'],
    ready: { title: 'Toca para largar a bola', hint: 'Guia-a para os lados até às aberturas.' },
    setup, update, draw,
    down: (G, x, y, api, e) => { if (e.pointerType !== 'mouse') G.drag = { x, tx: G.tx }; else G.tx = x; },
    move: (G, x, y, api, e, isDown) => { if (e.pointerType === 'mouse') G.tx = x; else if (isDown && G.drag) G.tx = U.clamp(G.drag.tx + (x - G.drag.x) * 1.4, R, api.W - R); },
    up: G => { G.drag = null; },
    key: (G, e, api) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { G.tx = U.clamp(G.x - 70, R, api.W - R); return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { G.tx = U.clamp(G.x + 70, R, api.W - R); return true; }
    },
    hud: G => [['Pontos', G.score], ['Nível', G.level], ['💎', G.gems]],
    achievements: [
      { id: 'bd.l5', name: 'Mergulhador', icon: '🟡', desc: 'Chega ao nível 5 na Queda Livre.', test: c => ((c.result.meta || {}).level || 0) >= 5 },
      { id: 'bd.x5', name: 'Descida de Ouro', icon: '🎯', desc: 'Faz 500 pontos numa partida da Queda Livre.', test: c => (c.result.score || 0) >= 500 },
    ],
  });
})();
