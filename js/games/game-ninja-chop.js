/* ══════════════════════════════════════════════════════════════════
   Corte Ninja (Ninja Chop) — fruta atirada ao ar; corta-a com o rasto
   do rato ou do dedo, foge das bombas. Rato: basta mover depressa (ou
   arrastar com o botão premido); toque: deslizar o dedo. Corte =
   interseção segmento-círculo entre dois pontos consecutivos do rasto.
   Modos: Clássico (3 falhas) e Contra-relógio (60 s).
══════════════════════════════════════════════════════════════════ */
const NinjaChopGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const FRUITS = [
    { k: 'melon',  r: 36, skin: ['#4d7c0f', '#166534'], flesh: '#f43f5e', rind: '#bbf7d0', juice: '#fb7185', pts: 1 },
    { k: 'orange', r: 25, skin: ['#fdba74', '#ea580c'], flesh: '#fb923c', rind: '#fed7aa', juice: '#fdba74', pts: 1 },
    { k: 'apple',  r: 25, skin: ['#fca5a5', '#b91c1c'], flesh: '#fef3c7', rind: '#fecaca', juice: '#fde68a', pts: 1 },
    { k: 'kiwi',   r: 22, skin: ['#a16207', '#713f12'], flesh: '#84cc16', rind: '#d9f99d', juice: '#a3e635', pts: 1 },
    { k: 'lemon',  r: 23, skin: ['#fef08a', '#ca8a04'], flesh: '#fde047', rind: '#fef9c3', juice: '#fef08a', pts: 1 },
    { k: 'plum',   r: 21, skin: ['#c084fc', '#6b21a8'], flesh: '#f5d0fe', rind: '#e9d5ff', juice: '#d8b4fe', pts: 1 },
  ];
  const DIFF = {
    easy:   { every: [1.5, .95], bomb: [.05, .14], burst: 3 },
    medium: { every: [1.3, .8],  bomb: [.08, .2],  burst: 4 },
    hard:   { every: [1.15, .65], bomb: [.12, .27], burst: 5 },
  };

  function setup(api, o) {
    return {
      cfg: DIFF[o.diff] || DIFF.medium, mode: o.mode || 'classic',
      items: [], halves: [], splats: [], trail: [],
      score: 0, sliced: 0, missed: 0, lives: 3, t: 0, spawnT: .6, timeLeft: 60,
      swipeN: 0, swipeT: 0, bestSwipe: 0, slow: 0, over: false, lastP: null, down: false,
    };
  }

  function spawn(G, api) {
    const W = api.W, H = api.H, c = G.cfg;
    const k = Math.min(1, G.t / 90);
    const n = U.randi(1, Math.min(c.burst, 1 + Math.floor(1 + k * c.burst)));
    const pBomb = U.lerp(c.bomb[0], c.bomb[1], k);
    const g = H * 1.3;
    for (let i = 0; i < n; i++) {
      const x = U.rand(W * .15, W * .85);
      const h = U.rand(.48, .82) * H;
      const vy = -Math.sqrt(2 * g * h);
      const vx = (W / 2 - x) * U.rand(.25, .7) + U.rand(-40, 40);
      const bomb = G.t > 4 && Math.random() < pBomb && !(i === 0 && n === 1 && G.t < 8);
      const special = !bomb && Math.random() < .05 ? (G.mode === 'timed' || Math.random() < .5 ? 'gold' : 'ice') : null;
      const f = bomb ? { k: 'bomb', r: 25 } : special === 'gold' ? { k: 'gold', r: 26, skin: ['#fef08a', '#d97706'], flesh: '#fde047', rind: '#fef3c7', juice: '#fde047', pts: 10 } :
        special === 'ice' ? { k: 'ice', r: 26, skin: ['#e0f2fe', '#38bdf8'], flesh: '#bae6fd', rind: '#f0f9ff', juice: '#7dd3fc', pts: 3 } : U.pick(FRUITS);
      G.items.push({ ...f, x, y: H + f.r + 10, vx, vy, g, rot: Math.random() * 6, vr: U.rand(-3, 3), delay: i * U.rand(.05, .22), dead: false });
    }
    api.sfx.noise(.12, .05, 0, 600, 'lowpass');
  }

  function slice(G, api, it, ang) {
    it.dead = true;
    const W = api.W;
    if (it.k === 'bomb') {
      api.shake(16, .5); api.flash('#fff', .35); api.vibe([80, 40, 120]);
      api.sfx.noise(.6, .25, 0, 300, 'lowpass'); api.sfx.tone(90, .5, 'sawtooth', .08, 0, 40);
      for (let i = 0; i < 40; i++) api.spark({ x: it.x, y: it.y, vx: U.rand(-420, 420), vy: U.rand(-420, 300), color: U.pick(['#fde047', '#fb923c', '#ef4444', '#fff']), size: U.rand(2, 5), life: U.rand(.4, .9), gravity: 300 });
      if (G.mode === 'classic') { end(G, api, 'Cortaste uma bomba!'); }
      else { G.score = Math.max(0, G.score - 10); G.timeLeft = Math.max(0, G.timeLeft - 3); api.float(it.x, it.y, '−10  −3s', '#fca5a5', 22); }
      return;
    }
    G.sliced++; G.swipeN++;
    G.score += it.pts;
    if (it.k === 'ice') { G.slow = 3.5; api.banner('Tempo lento', '3 segundos'); }
    if (it.k === 'gold') { api.float(it.x, it.y - 30, '+10', '#fde047', 24); api.sfx.arp([988, 1319, 1568], .05, .12, 'sine', .08); }
    /* metades a afastarem-se na perpendicular do corte */
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    [-1, 1].forEach(s => G.halves.push({ ...it, x: it.x + nx * s * 4, y: it.y + ny * s * 4, vx: it.vx * .5 + nx * s * 120, vy: Math.min(it.vy, 0) * .3 + ny * s * 120 - 60, rot: ang + (s > 0 ? Math.PI : 0), vr: s * U.rand(2, 5), side: s, life: 2.5 }));
    for (let i = 0; i < 12; i++) api.spark({ x: it.x, y: it.y, vx: U.rand(-220, 220) + Math.cos(ang) * 120, vy: U.rand(-220, 120) + Math.sin(ang) * 120, color: it.juice, size: U.rand(2, 5), life: U.rand(.35, .7), gravity: 700 });
    G.splats.push({ x: it.x, y: it.y, r: it.r * U.rand(1.1, 1.6), c: it.juice, a: .5, rot: Math.random() * 6, k: Array.from({ length: 12 }, () => U.rand(.62, 1)), drops: Array.from({ length: 5 }, () => [U.rand(0, 6.28), U.rand(1.2, 1.9), U.rand(.08, .18)]) });
    if (G.splats.length > 14) G.splats.shift();
    api.sfx.noise(.09, .1, 0, 3200, 'highpass'); api.sfx.tone(520 + G.swipeN * 60, .06, 'triangle', .05);
    api.vibe(8);
  }

  function end(G, api, why) {
    if (G.over) return;
    G.over = true;
    const acc = G.sliced + G.missed ? Math.round(100 * G.sliced / (G.sliced + G.missed)) : 0;
    api.over({ score: G.score, won: G.mode === 'timed', delay: 1000, title: why, icon: G.mode === 'timed' ? '⏱️' : '💣',
      stats: [['Frutas', G.sliced], ['Melhor corte', G.bestSwipe + '×'], ['Precisão', acc + '%']], meta: { bestSwipe: G.bestSwipe } });
  }

  function cutAlong(G, api, ax, ay, bx, by) {
    const ang = Math.atan2(by - ay, bx - ax);
    for (const it of G.items) {
      if (it.dead || it.delay > 0) continue;
      if (U.segDist(it.x, it.y, ax, ay, bx, by) < it.r + 4) slice(G, api, it, ang);
      if (G.over) return;
    }
  }

  function update(G, dt, api) {
    const H = api.H;
    const sdt = G.slow > 0 ? dt * .4 : dt;
    G.slow = Math.max(0, G.slow - dt);
    G.t += dt;
    if (G.mode === 'timed') { G.timeLeft -= dt; if (G.timeLeft <= 0) { G.timeLeft = 0; end(G, api, 'Tempo!'); return; } }
    G.spawnT -= dt;
    if (G.spawnT <= 0) { spawn(G, api); const k = Math.min(1, G.t / 90); G.spawnT = U.lerp(G.cfg.every[0], G.cfg.every[1], k) * U.rand(.8, 1.2) + (G.items.length > 5 ? .4 : 0); }

    for (const it of G.items) {
      if (it.delay > 0) { it.delay -= sdt; continue; }
      it.vy += it.g * sdt; it.x += it.vx * sdt; it.y += it.vy * sdt; it.rot += it.vr * sdt;
      if (it.k === 'bomb' && Math.random() < .5) api.spark({ x: it.x + Math.cos(it.rot - 1) * 22, y: it.y + Math.sin(it.rot - 1) * 22, vx: U.rand(-40, 40), vy: U.rand(-80, -10), color: '#fde047', size: 1.8, life: .25, gravity: 0 });
      if (it.vy > 0 && it.y > H + it.r + 20 && !it.dead) {
        it.dead = true;
        if (it.k !== 'bomb') {
          G.missed++;
          if (G.mode === 'classic') {
            G.lives--; api.sfx.tone(180, .15, 'square', .05); api.flash('#ef4444', .1);
            api.float(U.clamp(it.x, 30, api.W - 30), H - 40, '✕', '#ef4444', 30);
            if (G.lives <= 0) { end(G, api, 'Deixaste cair 3 frutas'); return; }
          }
        }
      }
    }
    G.items = G.items.filter(i => !i.dead);
    G.halves.forEach(h => { h.vy += h.g * sdt; h.x += h.vx * sdt; h.y += h.vy * sdt; h.rot += h.vr * sdt; h.life -= dt; });
    G.halves = G.halves.filter(h => h.life > 0 && h.y < H + 80);
    G.splats.forEach(s => { s.a = Math.max(0, s.a - dt * .06); });
    /* rasto */
    const now = G.t;
    G.trail = G.trail.filter(p => now - p.t < .14);
    if (G.swipeN && now - G.swipeT > .18) {
      if (G.swipeN >= 3) { const b = G.swipeN; G.score += b; api.float(api.W / 2, api.H * .3, 'Combo ' + b + '! +' + b, '#fde047', 26); api.sfx.arp([659, 784, 988], .05, .1, 'triangle', .07); }
      G.bestSwipe = Math.max(G.bestSwipe, G.swipeN);
      G.swipeN = 0;
    }
  }

  function onMove(G, x, y, api, e, isDown) {
    /* velocidade medida no relógio real do evento (vários pointermove
       podem cair no mesmo frame) */
    const now = G.t, rt = ((e && e.timeStamp) || performance.now()) / 1000, lp = G.lastP;
    G.lastP = { x, y, t: now, rt };
    if (!lp) return;
    const dt = Math.max(1 / 500, rt - lp.rt), len = Math.hypot(x - lp.x, y - lp.y), spd = len / dt;
    const mouse = e.pointerType === 'mouse';
    const active = (isDown && spd > 220) || (mouse && spd > 1000);
    if (!active || len < 2) return;
    G.trail.push({ x, y, t: now }); if (G.trail.length === 1) G.trail.unshift({ x: lp.x, y: lp.y, t: now });
    G.swipeT = now;
    cutAlong(G, api, lp.x, lp.y, x, y);
  }

  /* ── desenho ── */
  function fruit(ctx, it, half) {
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
    const r = it.r;
    if (it.k === 'bomb') {
      const g = ctx.createRadialGradient(-8, -8, 2, 0, 0, r);
      g.addColorStop(0, '#4b5563'); g.addColorStop(1, '#030712');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, 6.3); ctx.stroke();
      ctx.fillStyle = '#6b7280'; ctx.fillRect(-5, -r - 6, 10, 8);
      ctx.strokeStyle = '#d6b48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r - 6); ctx.quadraticCurveTo(8, -r - 14, 4, -r - 20); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✕', 0, 1);
      ctx.restore(); return;
    }
    if (half) {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.closePath();
      ctx.fillStyle = it.skin[1]; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r - 3.5, 0, Math.PI); ctx.closePath(); ctx.fillStyle = it.rind; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r - 7, 0, Math.PI); ctx.closePath(); ctx.fillStyle = it.flesh; ctx.fill();
      if (it.k === 'melon' || it.k === 'kiwi') { ctx.fillStyle = '#111'; for (let i = 0; i < 6; i++) { const a = .3 + i * .45; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * .55, Math.sin(a) * r * .55, 1.6, 3, a, 0, 6.3); ctx.fill(); } }
      if (it.k === 'orange' || it.k === 'lemon') { ctx.strokeStyle = it.rind; ctx.lineWidth = 1.5; for (let i = 1; i < 6; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (r - 7), Math.sin(a) * (r - 7)); ctx.stroke(); } }
      ctx.restore(); return;
    }
    const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r);
    g.addColorStop(0, it.skin[0]); g.addColorStop(1, it.skin[1]);
    ctx.fillStyle = g;
    ctx.beginPath(); if (it.k === 'lemon') ctx.ellipse(0, 0, r * 1.15, r * .88, 0, 0, 6.3); else ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
    if (it.k === 'melon') { ctx.strokeStyle = 'rgba(20,83,45,.8)'; ctx.lineWidth = 4; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * r * .32, 0, r * .12, r * .95, 0, 0, 6.3); ctx.stroke(); } }
    if (it.k === 'apple' || it.k === 'plum') { ctx.strokeStyle = '#4b2e12'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -r + 3); ctx.lineTo(2, -r - 7); ctx.stroke(); ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.ellipse(8, -r - 4, 7, 3, -.4, 0, 6.3); ctx.fill(); }
    if (it.k === 'gold' || it.k === 'ice') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `800 ${r}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.k === 'gold' ? '★' : '❄', 0, 2); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * .38, -r * .42, r * .22, r * .12, -.6, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  function draw(G, ctx, W, H, api) {
    /* tábua do dojo */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a1a10'); bg.addColorStop(1, '#140c07');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,220,180,.04)'; ctx.lineWidth = 1;
    for (let x = 12; x < W; x += 23) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 6, H * .3, x - 6, H * .6, x + 3, H); ctx.stroke(); }
    G.splats.forEach(s => {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.globalAlpha = s.a; ctx.fillStyle = s.c;
      /* mancha orgânica: contorno suave por curvas entre raios aleatórios + gotas soltas */
      const pts = s.k.map((k, i) => { const a = i / s.k.length * 6.283; return [Math.cos(a) * s.r * k, Math.sin(a) * s.r * k]; });
      ctx.beginPath(); ctx.moveTo((pts[0][0] + pts[11][0]) / 2, (pts[0][1] + pts[11][1]) / 2);
      pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }); ctx.fill();
      s.drops.forEach(([a, d, r]) => { ctx.beginPath(); ctx.arc(Math.cos(a) * s.r * d, Math.sin(a) * s.r * d, s.r * r, 0, 6.3); ctx.fill(); });
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    if (G.slow > 0) { ctx.fillStyle = `rgba(125,211,252,${Math.min(.18, G.slow * .06)})`; ctx.fillRect(0, 0, W, H); }
    G.halves.forEach(h => { ctx.globalAlpha = Math.min(1, h.life); fruit(ctx, h, true); });
    ctx.globalAlpha = 1;
    G.items.forEach(it => { if (it.delay <= 0) fruit(ctx, it, false); });
    /* lâmina */
    const tr = G.trail;
    if (tr.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < tr.length; i++) {
        const k = i / tr.length;
        ctx.strokeStyle = `rgba(165,243,252,${k * .9})`; ctx.lineWidth = 2 + k * 7;
        ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
      }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tr[0].x, tr[0].y); tr.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
    }
    /* vidas (clássico) ou tempo */
    if (G.mode === 'classic') {
      ctx.font = '800 26px system-ui'; ctx.textAlign = 'right';
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < 3 - G.lives ? '#ef4444' : 'rgba(255,255,255,.2)'; ctx.fillText('✕', W - 14 - i * 28, H - 18); }
    } else {
      const k = G.timeLeft / 60;
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(16, H - 18, W - 32, 6);
      ctx.fillStyle = k < .2 ? '#ef4444' : '#fbbf24'; ctx.fillRect(16, H - 18, (W - 32) * k, 6);
    }
  }

  return ArcadeKit.create({
    id: 'ninja-chop', title: 'Corte Ninja', icon: '🥷',
    accent: '#ef4444', accent2: '#fbbf24', bg: '#140c07', aspect: 'wide',
    tagline: 'Fruta pelo ar, bombas à mistura. Um golpe rápido corta tudo o que apanhar.',
    view: { w: 640 },
    modes: [
      { id: 'classic', icon: '🍉', name: 'Clássico', desc: 'Deixas cair 3 frutas ou cortas uma bomba e acabou.' },
      { id: 'timed', icon: '⏱️', name: 'Contra-relógio', desc: '60 segundos. Bombas tiram 10 pontos e 3 segundos.' },
    ],
    how: [
      '<b>Rato:</b> passa o cursor <b>depressa</b> pela fruta (ou arrasta com o botão premido). <b>Toque:</b> desliza o dedo.',
      'Cortar 3 ou mais frutas no mesmo golpe dá <b>combo</b>. ★ dourada vale 10; ❄ abranda o tempo.',
      'Foge das <b>bombas</b> ✕ — no Clássico acabam logo com o jogo.',
    ],
    controls: ['🖱️ Mover rápido / arrastar', '👆 Deslizar'],
    ready: { title: 'Toca para começar', hint: 'Desliza o dedo ou passa o rato depressa pela fruta.' },
    setup, update, draw,
    down: (G, x, y, api, e) => { G.lastP = { x, y, t: G.t, rt: ((e && e.timeStamp) || performance.now()) / 1000 }; },
    move: onMove,
    up: G => { G.lastP = null; },
    hud: G => [['Pontos', G.score], G.mode === 'timed' ? ['Tempo', Math.ceil(G.timeLeft) + 's', G.timeLeft < 10 ? 'hot' : ''] : ['Vidas', '❤'.repeat(Math.max(0, G.lives))]],
    achievements: [
      { id: 'nc.combo5', name: 'Golpe Duplo… Quíntuplo', icon: '🥷', desc: 'Corta 5 frutas num só golpe.', test: c => ((c.result.meta || {}).bestSwipe || 0) >= 5 },
      { id: 'nc.100',    name: 'Mestre da Lâmina',       icon: '🍉', desc: 'Faz 100 pontos no Corte Ninja.', test: c => (c.result.score || 0) >= 100 },
    ],
  });
})();
