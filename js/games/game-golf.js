/* ══════════════════════════════════════════════════════════════════
   Minigolfe (Golf) — 9 buracos compactos desenhados à mão. Arrasta a
   partir de qualquer ponto (como uma fisga): a direção é a oposta ao
   arrasto e a força é o comprimento. Paredes, pára-choques, areia,
   água (volta atrás +1), moinho, rampas e um bloco que desliza.
   Física em sub-passos com colisão bola–segmento e bola–círculo.
══════════════════════════════════════════════════════════════════ */
const GolfGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const BR = 7, CUP = 11.5, MAXV = 820, MAXD = 150;
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  const HOLES = [
    { name: 'Aquecimento', par: 2, tee: [200, 560], cup: [200, 150], poly: rect(120, 100, 280, 605) },
    { name: 'Cotovelo', par: 3, tee: [100, 560], cup: [310, 150], poly: [[40, 605], [160, 605], [160, 250], [360, 250], [360, 90], [40, 90]] },
    { name: 'Pára-choques', par: 2, tee: [200, 565], cup: [200, 140], poly: rect(60, 90, 340, 605),
      bumpers: [[200, 380, 26], [128, 275, 20], [272, 275, 20], [200, 220, 14]] },
    { name: 'Areal', par: 3, tee: [100, 565], cup: [210, 150], poly: rect(50, 85, 350, 610),
      walls: [[50, 470, 262, 470]], sand: [rect(95, 290, 305, 395)] },
    { name: 'Moinho', par: 3, tee: [200, 565], cup: [200, 140], poly: rect(105, 85, 295, 610),
      mill: { x: 200, y: 345, r: 78, w: 1.6 }, walls: [[105, 345, 118, 345], [282, 345, 295, 345]] },
    { name: 'Lago', par: 3, tee: [115, 565], cup: [115, 150], poly: rect(40, 85, 360, 610),
      water: [rect(40, 285, 262, 400)], bumpers: [[330, 342, 12]] },
    { name: 'Zigue-zague', par: 4, tee: [80, 570], cup: [80, 132], poly: rect(40, 85, 360, 610),
      walls: [[40, 470, 278, 470], [122, 330, 360, 330], [40, 195, 278, 195]] },
    { name: 'Rampa', par: 3, tee: [110, 565], cup: [292, 140], poly: rect(60, 85, 340, 610),
      slopes: [{ r: rect(60, 250, 340, 420), f: [-300, 0] }], bumpers: [[200, 205, 16]] },
    { name: 'Final', par: 4, tee: [200, 572], cup: [200, 128], poly: rect(50, 85, 350, 612),
      water: [rect(50, 395, 142, 480), rect(258, 395, 350, 480)], slider: { y: 290, w: 110, h: 22, x0: 60, x1: 340, v: 110 },
      sand: [rect(150, 170, 250, 215)] },
  ];
  const DIFF = {
    easy:   { guide: 'bounce', cup: 1.25, cap: 10 },
    medium: { guide: 'line', cup: 1, cap: 8 },
    hard:   { guide: 'short', cup: .9, cap: 7 },
  };
  const NAMES = { '-3': 'Albatroz!', '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Duplo bogey' };

  function segsOf(h, t) {
    const s = [];
    const P = h.poly;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s.push([a[0], a[1], b[0], b[1]]); }
    (h.walls || []).forEach(w => s.push(w));
    if (h.mill) {
      const m = h.mill, a = t * m.w;
      [0, Math.PI / 2].forEach(o => { const c = Math.cos(a + o) * m.r, d = Math.sin(a + o) * m.r; s.push([m.x - c, m.y - d, m.x + c, m.y + d, 'mill']); });
    }
    if (h.slider) {
      const sl = h.slider, x = h._sx, y0 = sl.y - sl.h / 2, y1 = sl.y + sl.h / 2, x0 = x - sl.w / 2, x1 = x + sl.w / 2;
      s.push([x0, y0, x1, y0, 'sl'], [x1, y0, x1, y1, 'sl'], [x1, y1, x0, y1, 'sl'], [x0, y1, x0, y0, 'sl']);
    }
    return s;
  }
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if (((P[i][1] > y) !== (P[j][1] > y)) && (x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0])) c = !c; } return c; };

  function loadHole(G, i) {
    const h = HOLES[i];
    h._sx = h.slider ? (h.slider.x0 + h.slider.x1) / 2 : 0; h._sd = 1;
    G.hi = i; G.h = h; G.bx = h.tee[0]; G.by = h.tee[1]; G.vx = 0; G.vy = 0; G.strokes = 0; G.last = [h.tee[0], h.tee[1]];
    G.sunk = 0; G.moving = false; G.trail = []; G.ht = 0; G.aim = null; G.splash = 0;
  }

  function setup(api, o) {
    const G = { cfg: DIFF[o.diff] || DIFF.medium, card: [], total: 0, t: 0 };
    loadHole(G, 0);
    return G;
  }
  function begin(G, api) { api.banner('Buraco 1 · Par ' + G.h.par, G.h.name); }

  function shoot(G, api) {
    const a = G.aim; G.aim = null;
    if (!a || a.p < .06) return;
    const sp = MAXV * Math.pow(a.p, 1.15);
    G.vx = Math.cos(a.ang) * sp; G.vy = Math.sin(a.ang) * sp;
    G.last = [G.bx, G.by]; G.strokes++; G.moving = true;
    api.sfx.tone(180 + a.p * 200, .07, 'triangle', .1); api.sfx.noise(.05, .08, 0, 2000, 'highpass');
  }

  /* limite de pancadas por buraco (também depois de cair à água) */
  function capCheck(G, api) {
    if (G.strokes < G.cfg.cap || G.sunk) return false;
    api.float(G.bx, G.by - 20, 'Máximo de pancadas', '#fca5a5', 16);
    G.strokes = G.cfg.cap + 1; G.sunk = .001;
    setTimeout(() => finishHole(G, api, 'Limite'), 900);
    return true;
  }

  function holed(G, api) {
    G.sunk = .001; G.moving = false; G.vx = G.vy = 0;
    const diff = G.strokes - G.h.par;
    const name = G.strokes === 1 ? 'Buraco à primeira!' : (NAMES[diff] || (diff > 0 ? '+' + diff : diff));
    api.sfx.arp(diff <= 0 ? [523, 659, 784, 1047] : [392, 523], .07, .14, 'triangle', .09); api.vibe([20, 30, 40]);
    for (let i = 0; i < 24; i++) api.spark({ x: G.h.cup[0], y: G.h.cup[1], vx: U.rand(-200, 200), vy: U.rand(-260, 40), color: U.pick(['#fde047', '#fff', '#86efac', '#f472b6']), size: U.rand(2, 4), life: .9, gravity: 500 });
    setTimeout(() => finishHole(G, api, name), 900);
  }

  function finishHole(G, api, name) {
    if (G.hi == null || G.done) return;
    G.card.push({ par: G.h.par, s: G.strokes }); G.total += G.strokes;
    const rel = G.card.reduce((n, c) => n + c.s - c.par, 0);
    if (G.hi === HOLES.length - 1) {
      G.done = true;
      const par = HOLES.reduce((n, h) => n + h.par, 0);
      const stars = rel <= -2 ? 3 : rel <= 3 ? 2 : 1;
      api.over({ score: G.total, won: true, stars, delay: 200, title: 'Percurso completo', icon: '⛳',
        sub: `Par do percurso: ${par} · ${rel === 0 ? 'no par' : rel > 0 ? rel + ' acima do par' : -rel + ' abaixo do par'}`,
        html: cardHTML(G), meta: { rel, aces: G.card.filter(c => c.s === 1).length } });
      return;
    }
    api.panel({ icon: G.strokes === 1 ? '🎉' : '⛳', title: `Buraco ${G.hi + 1} · ${name}`,
      sub: `${G.strokes} pancada${G.strokes > 1 ? 's' : ''} (par ${G.h.par}) · total ${rel === 0 ? 'no par' : (rel > 0 ? '+' : '') + rel}`,
      html: cardHTML(G),
      buttons: [{ label: '▶ Buraco ' + (G.hi + 2), primary: true, fn: () => { loadHole(G, G.hi + 1); api.resume(); api.banner('Buraco ' + (G.hi + 1) + ' · Par ' + G.h.par, G.h.name); } },
        { label: 'Sair para o menu', fn: () => api.menu() }] });
  }

  function cardHTML(G) {
    const cells = HOLES.map((h, i) => { const c = G.card[i]; const d = c ? c.s - c.par : null;
      return `<td style="padding:3px 0;color:${d == null ? '#64748b' : d < 0 ? '#86efac' : d > 0 ? '#fca5a5' : '#fff'};font-weight:${d == null ? 400 : 800}">${c ? c.s : '·'}</td>`; }).join('');
    return `<table style="width:100%;margin-top:12px;border-collapse:collapse;font-size:.78rem;text-align:center;font-variant-numeric:tabular-nums">
      <tr style="color:#94a3b8">${HOLES.map((_, i) => `<td>${i + 1}</td>`).join('')}</tr>
      <tr style="color:#94a3b8;font-size:.68rem">${HOLES.map(h => `<td>${h.par}</td>`).join('')}</tr>
      <tr>${cells}</tr></table>`;
  }

  function collide(G, segs) {
    let hit = 0;
    for (const s of segs) {
      const [ax, ay, bx, by] = s, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = ((G.bx - ax) * dx + (G.by - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + dx * t, cy = ay + dy * t, ex = G.bx - cx, ey = G.by - cy, d = Math.hypot(ex, ey);
      if (d < BR + 3 && d > 0.0001) {
        const nx = ex / d, ny = ey / d;
        G.bx = cx + nx * (BR + 3); G.by = cy + ny * (BR + 3);
        let vn = G.vx * nx + G.vy * ny;
        /* peças em movimento empurram a bola */
        if (s[4] === 'sl') { vn -= G.h._sd * G.h.slider.v * nx; }
        if (s[4] === 'mill') { const m = G.h.mill, rx = cx - m.x, ry = cy - m.y; const wv = -ry * m.w * nx + rx * m.w * ny; vn -= wv; }
        if (vn < 0) { G.vx -= 1.78 * vn * nx; G.vy -= 1.78 * vn * ny; G.vx *= .97; G.vy *= .97; hit = Math.max(hit, -vn); }
      }
    }
    (G.h.bumpers || []).forEach(([x, y, r]) => {
      const ex = G.bx - x, ey = G.by - y, d = Math.hypot(ex, ey);
      if (d < r + BR) {
        const nx = ex / d, ny = ey / d; G.bx = x + nx * (r + BR); G.by = y + ny * (r + BR);
        const vn = G.vx * nx + G.vy * ny;
        if (vn < 0) { G.vx -= 2.15 * vn * nx; G.vy -= 2.15 * vn * ny; hit = Math.max(hit, -vn * 1.3); G.bump = { x, y, t: .2 }; }
      }
    });
    return hit;
  }

  function update(G, dt, api) {
    const h = G.h;
    G.t += dt; G.ht += dt;
    if (h.slider) { const sl = h.slider; h._sx += h._sd * sl.v * dt; if (h._sx > sl.x1 - sl.w / 2) { h._sx = sl.x1 - sl.w / 2; h._sd = -1; } if (h._sx < sl.x0 + sl.w / 2) { h._sx = sl.x0 + sl.w / 2; h._sd = 1; } }
    if (G.bump) { G.bump.t -= dt; if (G.bump.t <= 0) G.bump = null; }
    if (G.splash > 0) { G.splash -= dt; if (G.splash <= 0) { G.bx = G.last[0]; G.by = G.last[1]; G.vx = G.vy = 0; capCheck(G, api); } return; }
    if (G.sunk) { G.sunk += dt; return; }
    const sub = 5, sdt = dt / sub;
    let maxHit = 0;
    for (let k = 0; k < sub; k++) {
      const segs = segsOf(h, G.ht);
      if (!G.moving) { maxHit = Math.max(maxHit, collide(G, segs)); if (Math.hypot(G.vx, G.vy) > 1) G.moving = true; continue; }
      const inSand = (h.sand || []).some(P => inPoly(G.bx, G.by, P));
      (h.slopes || []).forEach(s => { if (inPoly(G.bx, G.by, s.r)) { G.vx += s.f[0] * sdt; G.vy += s.f[1] * sdt; } });
      const sp = Math.hypot(G.vx, G.vy);
      const dec = (inSand ? 520 : 70) + sp * (inSand ? 2.4 : .55);
      const nsp = Math.max(0, sp - dec * sdt);
      if (sp > 0) { G.vx *= nsp / sp; G.vy *= nsp / sp; }
      /* o copo puxa um bocadinho quando se passa devagar */
      const cr = CUP * G.cfg.cup, dxC = h.cup[0] - G.bx, dyC = h.cup[1] - G.by, dC = Math.hypot(dxC, dyC);
      if (dC < cr + 8 && nsp < 200) { G.vx += dxC / dC * 380 * sdt; G.vy += dyC / dC * 380 * sdt; }
      G.bx += G.vx * sdt; G.by += G.vy * sdt;
      maxHit = Math.max(maxHit, collide(G, segs));
      if (dC < cr) {
        if (nsp < 330) { G.bx = h.cup[0]; G.by = h.cup[1]; holed(G, api); return; }
        /* bateu no rebordo: desvia e trava */
        G.vx = G.vx * .7 + dyC / dC * nsp * .25; G.vy = G.vy * .7 - dxC / dC * nsp * .25;
        api.sfx.tone(1100, .04, 'sine', .05);
      }
      if ((h.water || []).some(P => inPoly(G.bx, G.by, P))) {
        G.splash = .8; G.strokes++; G.moving = false;
        api.float(G.bx, G.by - 16, 'Água! +1', '#7dd3fc', 18); api.sfx.noise(.35, .12, 0, 900, 'lowpass');
        for (let i = 0; i < 14; i++) api.spark({ x: G.bx, y: G.by, vx: U.rand(-90, 90), vy: U.rand(-160, -30), color: '#bae6fd', size: 2.5, life: .6, gravity: 500 });
        return;
      }
      if (!inPoly(G.bx, G.by, h.poly)) { G.bx = G.last[0]; G.by = G.last[1]; G.vx = G.vy = 0; }
      if (Math.hypot(G.vx, G.vy) < 5) {
        G.vx = G.vy = 0; G.moving = false;
        if (capCheck(G, api)) return;
        break;
      }
    }
    if (maxHit > 60) { api.sfx.tone(260 + Math.min(maxHit, 600) * .6, .05, 'triangle', Math.min(.1, maxHit / 3000)); }
    G.trail.unshift([G.bx, G.by]); if (G.trail.length > 10) G.trail.pop();
    if (!G.moving) G.trail.length = 0;
  }

  /* simulação barata da linha de mira (só colisões com paredes) */
  function predict(G, ang, p, bounces) {
    const pts = [[G.bx, G.by]]; let x = G.bx, y = G.by, dx = Math.cos(ang), dy = Math.sin(ang), left = 60 + p * 260;
    const segs = segsOf(G.h, G.ht);
    for (let b = 0; b <= bounces && left > 0; b++) {
      let best = null;
      for (const s of segs) {
        const [ax, ay, bx, by] = s, ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-6) continue;
        const t = ((ax - x) * ey - (ay - y) * ex) / den, u = ((ax - x) * dy - (ay - y) * dx) / den;
        if (t > .5 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, nx: -ey, ny: ex };
      }
      const t = best ? Math.min(best.t - BR, left) : left;
      x += dx * t; y += dy * t; left -= t; pts.push([x, y]);
      if (!best || best.t - BR > t + .1) break;
      const nl = Math.hypot(best.nx, best.ny), nx = best.nx / nl, ny = best.ny / nl, dn = dx * nx + dy * ny;
      dx -= 2 * dn * nx; dy -= 2 * dn * ny;
    }
    return pts;
  }

  /* ── desenho ── */
  function path(ctx, P) { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); }

  function draw(G, ctx, W, H, api) {
    const h = G.h, t = G.t;
    ctx.fillStyle = '#0d2616'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.03)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 97) % W, (i * 151) % H, 2 + i % 3, 0, 6.3); ctx.fill(); }
    /* relvado com riscas de corte */
    ctx.save(); path(ctx, h.poly);
    ctx.fillStyle = '#3fae4d'; ctx.fill(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let y = 60; y < H; y += 44) ctx.fillRect(0, y, W, 22);
    (h.slopes || []).forEach(s => {
      path(ctx, s.r); ctx.fillStyle = 'rgba(20,83,45,.28)'; ctx.fill();
      const [fx] = s.f, dir = Math.sign(fx);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
      for (let yy = s.r[0][1] + 24; yy < s.r[2][1]; yy += 42) for (let xx = s.r[0][0] + 30; xx < s.r[1][0]; xx += 64) {
        const off = ((t * 40 * dir) % 64 + 64) % 64 * dir, x = xx + off * .4;
        ctx.beginPath(); ctx.moveTo(x - dir * 8, yy - 8); ctx.lineTo(x + dir * 4, yy); ctx.lineTo(x - dir * 8, yy + 8); ctx.stroke();
      }
    });
    (h.sand || []).forEach(P => { path(ctx, P); ctx.fillStyle = '#e8cf91'; ctx.fill(); ctx.fillStyle = 'rgba(160,120,60,.25)'; for (let i = 0; i < 60; i++) ctx.fillRect(P[0][0] + (i * 37) % (P[1][0] - P[0][0]), P[0][1] + (i * 53) % (P[2][1] - P[0][1]), 2, 2); });
    (h.water || []).forEach(P => {
      path(ctx, P); ctx.fillStyle = '#2563eb'; ctx.fill();
      ctx.strokeStyle = 'rgba(191,219,254,.45)'; ctx.lineWidth = 2;
      for (let yy = P[0][1] + 14; yy < P[2][1]; yy += 18) { ctx.beginPath(); for (let xx = P[0][0]; xx <= P[1][0]; xx += 8) ctx.lineTo(xx, yy + Math.sin(xx * .08 + t * 2 + yy) * 2.5); ctx.stroke(); }
    });
    ctx.restore();
    /* tee */
    ctx.fillStyle = 'rgba(255,255,255,.18)'; U.rr(ctx, h.tee[0] - 16, h.tee[1] - 10, 32, 20, 5); ctx.fill();
    /* copo + bandeira */
    const cr = CUP * G.cfg.cup;
    ctx.fillStyle = '#0b1a10'; ctx.beginPath(); ctx.arc(h.cup[0], h.cup[1], cr, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.cup[0], h.cup[1], cr, 0, 6.3); ctx.stroke();
    /* paredes (contorno + interiores) */
    const wall = (ax, ay, bx, by, col) => { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax + 2, ay + 3); ctx.lineTo(bx + 2, by + 3); ctx.stroke(); ctx.strokeStyle = col || '#8b5e34'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.strokeStyle = 'rgba(255,230,190,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay - 2); ctx.lineTo(bx, by - 2); ctx.stroke(); };
    const P = h.poly; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; wall(a[0], a[1], b[0], b[1]); }
    (h.walls || []).forEach(w => wall(w[0], w[1], w[2], w[3], '#a16207'));
    (h.bumpers || []).forEach(([x, y, r]) => {
      const on = G.bump && G.bump.x === x && G.bump.y === y;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(x + 2, y + 4, r, 0, 6.3); ctx.fill();
      ctx.fillStyle = on ? '#fca5a5' : '#ef4444'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * .55, 0, 6.3); ctx.fill();
      ctx.fillStyle = on ? '#ef4444' : '#fca5a5'; ctx.beginPath(); ctx.arc(x, y, r * .3, 0, 6.3); ctx.fill();
    });
    if (h.slider) { const sl = h.slider; ctx.fillStyle = 'rgba(0,0,0,.3)'; U.rr(ctx, h._sx - sl.w / 2 + 3, sl.y - sl.h / 2 + 4, sl.w, sl.h, 5); ctx.fill(); ctx.fillStyle = '#94a3b8'; U.rr(ctx, h._sx - sl.w / 2, sl.y - sl.h / 2, sl.w, sl.h, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(h._sx - sl.w / 2 + 6, sl.y - sl.h / 2 + 3, sl.w - 12, 3); }
    if (h.mill) {
      const m = h.mill, a = G.ht * m.w;
      ctx.save(); ctx.translate(m.x, m.y);
      [0, Math.PI / 2].forEach(o => { ctx.save(); ctx.rotate(a + o); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-m.r + 2, -3, m.r * 2, 10); ctx.fillStyle = '#f8fafc'; U.rr(ctx, -m.r, -5, m.r * 2, 10, 4); ctx.fill(); ctx.fillStyle = '#ef4444'; ctx.fillRect(-m.r + 8, -5, 16, 10); ctx.fillRect(m.r - 24, -5, 16, 10); ctx.restore(); });
      ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.3); ctx.fill();
      ctx.restore();
    }
    /* mira */
    if (G.aim && G.aim.p > .06 && !G.moving && !G.sunk) {
      const a = G.aim, col = a.p < .5 ? '#86efac' : a.p < .8 ? '#fde047' : '#f87171';
      const g = G.cfg.guide;
      const pts = predict(G, a.ang, g === 'short' ? a.p * .4 : a.p, g === 'bounce' ? 1 : 0);
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]);
      /* seta de força atrás da bola */
      const bx = G.bx - Math.cos(a.ang) * (14 + a.p * 50), by = G.by - Math.sin(a.ang) * (14 + a.p * 50);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(G.bx - Math.cos(a.ang) * 12, G.by - Math.sin(a.ang) * 12); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = col; ctx.font = '800 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(Math.round(a.p * 100) + '%', bx, by - 10);
    }
    /* bola */
    G.trail.forEach((p, i) => { ctx.globalAlpha = .25 * (1 - i / 10); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], BR * (1 - i / 14), 0, 6.3); ctx.fill(); });
    ctx.globalAlpha = 1;
    if (G.splash <= 0) {
      const sk = G.sunk ? Math.max(0, 1 - G.sunk * 3) : 1;
      if (sk > 0) {
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(G.bx + 2, G.by + 3, BR * sk, 0, 6.3); ctx.fill();
        const bg = ctx.createRadialGradient(G.bx - 2, G.by - 2, 1, G.bx, G.by, BR);
        bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(G.bx, G.by, BR * sk, 0, 6.3); ctx.fill();
      }
    }
    /* bandeira por cima de tudo */
    const fw = Math.sin(t * 4) * 3;
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(h.cup[0], h.cup[1]); ctx.lineTo(h.cup[0], h.cup[1] - 44); ctx.stroke();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(h.cup[0], h.cup[1] - 44); ctx.quadraticCurveTo(h.cup[0] + 12, h.cup[1] - 40 + fw, h.cup[0] + 24, h.cup[1] - 36 + fw); ctx.lineTo(h.cup[0], h.cup[1] - 28); ctx.fill();
    /* cabeçalho do buraco */
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = "700 13px 'Space Grotesk', system-ui"; ctx.textAlign = 'center';
    ctx.fillText(`${h.name} · Par ${h.par}`, W / 2, H - 8);
    if (G.strokes === 0 && G.hi === 0 && !G.aim) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '600 13px system-ui'; ctx.fillText('Arrasta para trás e larga para tacar', W / 2, h.tee[1] + 34); }
  }

  return ArcadeKit.create({
    id: 'golf', title: 'Minigolfe', icon: '⛳',
    accent: '#22c55e', accent2: '#fde047', bg: '#0d2616',
    tagline: '9 buracos com moinho, lago, areia e rampas. Aponta, doseia a força e tenta o par.',
    view: { w: 400, h: 640 }, lowerIsBetter: true, bestLabel: 'Menos pancadas',
    scoreFmt: v => v + ' pancadas',
    how: [
      'Arrasta a partir de <b>qualquer ponto</b> e larga, como uma fisga: a bola sai no sentido <b>oposto</b> ao arrasto. Mais longe = mais força.',
      'Areia trava, rampas empurram, água devolve a bola ao sítio de onde tacaste (+1 pancada). O moinho e o bloco mexem-se.',
      'Faz os 9 buracos com o menor número de pancadas. Em Fácil a linha de mira mostra o primeiro ressalto.',
    ],
    controls: ['🖱️ Arrastar e largar', '👆 Arrastar e largar'],
    ready: { title: 'Toca para começar', hint: 'Arrasta para trás e larga para tacar.' },
    setup, update, draw, begin,
    down: (G, x, y) => { if (!G.moving && !G.sunk && G.splash <= 0) G.drag = { x, y }; },
    move: (G, x, y, api, e, isDown) => {
      if (!isDown || !G.drag) return;
      const dx = G.drag.x - x, dy = G.drag.y - y, d = Math.hypot(dx, dy);
      G.aim = { ang: Math.atan2(dy, dx), p: Math.min(1, d / MAXD) };
      if (d < 10) G.aim.p = 0;
    },
    up: (G, x, y, api) => { if (G.drag) { G.drag = null; shoot(G, api); } },
    hud: G => {
      const rel = G.card.reduce((n, c) => n + c.s - c.par, 0);
      return [['Buraco', (G.hi + 1) + '/9'], ['Pancadas', G.strokes], ['Total', rel === 0 ? 'Par' : (rel > 0 ? '+' : '') + rel]];
    },
    achievements: [
      { id: 'gf.done', name: 'Volta Completa', icon: '⛳', desc: 'Termina os 9 buracos do Minigolfe.', test: c => c.result.won === true },
      { id: 'gf.ace',  name: 'À Primeira', icon: '🕳️', desc: 'Faz um buraco com uma só pancada.', test: c => ((c.result.meta || {}).aces || 0) >= 1 },
      { id: 'gf.under', name: 'Abaixo do Par', icon: '🏌️', desc: 'Termina o percurso abaixo do par.', test: c => c.result.won && ((c.result.meta || {}).rel ?? 9) < 0 },
    ],
  });
})();
