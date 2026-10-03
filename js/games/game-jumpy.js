/* ══════════════════════════════════════════════════════════════════
   Saltitão (Jumpy) — a geleia salta sozinha; tu só a guias na
   horizontal. Plataformas normais, móveis, que partem, que somem e com
   mola; mais acima aparecem ouriços (pisa-os por cima!). O céu muda do
   dia para o espaço à medida que sobes. Geração garante sempre uma
   plataforma segura ao alcance do salto.
══════════════════════════════════════════════════════════════════ */
const JumpyGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const GRAV = 1500, JUMP = 780, SPRING = 1320, PW = 66, PH = 14;
  const MAXREACH = JUMP * JUMP / (2 * GRAV) * .86;      /* ~174: altura segura */
  const DIFF = {
    easy:   { pw: 1.18, move: .6, brk: .5, enemyAt: 5000 },
    medium: { pw: 1,    move: 1,  brk: 1,  enemyAt: 3000 },
    hard:   { pw: .84,  move: 1.4, brk: 1.4, enemyAt: 1800 },
  };

  function setup(api, o) {
    const cfg = DIFF[o.diff] || DIFF.medium;
    const W = api.W, H = api.H;
    const G = {
      cfg, x: W / 2, y: H - 120, vx: 0, vy: -JUMP, tx: null, keys: 0, face: 1,
      cam: 0, top: H - 120, y0: H - 120, score: 0, plats: [], foes: [], stomps: 0, squash: 0, over: false,
      lastSafe: H - 60, lastY: H - 60, clouds: Array.from({ length: 7 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: U.rand(.6, 1.3) })),
      stars: Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * 2000, r: U.rand(.5, 1.6) })),
    };
    G.plats.push({ x: W / 2 - 50, y: H - 60, w: 100, t: 'n' });
    while (G.lastY > -H) addPlat(G, api);
    return G;
  }

  function height(G) { return Math.max(0, Math.round((G.y0 - G.top) / 10)); }

  function addPlat(G, api) {
    const h = height(G), c = G.cfg, W = api.W;
    const k = Math.min(1, h / 1500);
    const minG = 48 + k * 55, maxG = Math.min(MAXREACH, 88 + k * 80);
    let y = G.lastY - U.rand(minG, maxG);
    if (G.lastSafe - y > MAXREACH) y = G.lastSafe - MAXREACH * U.rand(.7, .95);
    const w = Math.max(44, PW * c.pw * (1 - k * .18));
    const r = Math.random();
    let t = 'n';
    const pMove = Math.min(.35, (.05 + k * .3) * c.move), pBrk = Math.min(.22, k * .22 * c.brk), pVan = h > 400 ? .08 : 0, pSpr = .06;
    if (r < pMove) t = 'm'; else if (r < pMove + pBrk) t = 'b'; else if (r < pMove + pBrk + pVan) t = 'v';
    const p = { x: U.rand(8, W - w - 8), y, w, t, vx: t === 'm' ? U.rand(50, 90 + k * 70) * (Math.random() < .5 ? -1 : 1) : 0, spring: t === 'n' && Math.random() < pSpr, broken: 0, gone: false };
    G.plats.push(p);
    /* uma plataforma que parte não é "segura": mete outra ao lado */
    if (t === 'b') {
      const q = { x: p.x > W / 2 ? U.rand(8, W / 2 - w) : U.rand(W / 2, W - w - 8), y: y - U.rand(-10, 20), w, t: 'n', vx: 0, spring: false, broken: 0 };
      G.plats.push(q); G.lastSafe = q.y;
    } else G.lastSafe = y;
    G.lastY = y;
    /* ouriços */
    if (h * 10 > c.enemyAt && Math.random() < Math.min(.12, .03 + (h * 10 - c.enemyAt) / 60000)) {
      G.foes.push({ x: U.rand(30, W - 30), y: y - U.rand(40, 70), vx: U.rand(30, 70) * (Math.random() < .5 ? -1 : 1), r: 15, dead: false, t: Math.random() * 6 });
    }
  }

  function update(G, dt, api) {
    const W = api.W, H = api.H;
    /* controlo horizontal */
    let targetVx = 0;
    if (G.keys) targetVx = G.keys * 420;
    else if (G.tx != null) targetVx = U.clamp((G.tx - G.x) * 9, -520, 520);
    G.vx = U.lerp(G.vx, targetVx, Math.min(1, dt * 14));
    if (Math.abs(G.vx) > 20) G.face = Math.sign(G.vx);
    G.x = U.clamp(G.x + G.vx * dt, 18, W - 18);
    const prevY = G.y;
    G.vy += GRAV * dt;
    G.y += G.vy * dt;
    G.squash = Math.max(0, G.squash - dt * 5);

    /* plataformas */
    G.plats.forEach(p => {
      if (p.t === 'm') { p.x += p.vx * dt; if (p.x < 6 || p.x + p.w > W - 6) { p.vx *= -1; p.x = U.clamp(p.x, 6, W - 6 - p.w); } }
      if (p.broken) p.broken += dt;
    });
    if (G.vy > 0) {
      for (const p of G.plats) {
        if (p.gone || p.broken) continue;
        const feetPrev = prevY + 18, feet = G.y + 18;
        if (feetPrev <= p.y && feet >= p.y && G.x > p.x - 10 && G.x < p.x + p.w + 10) {
          if (p.t === 'b') { p.broken = .001; api.sfx.noise(.15, .08, 0, 700); for (let i = 0; i < 8; i++) api.spark({ x: p.x + Math.random() * p.w, y: p.y, vx: U.rand(-60, 60), vy: U.rand(-40, 80), color: '#a16207', size: 3, life: .6, gravity: 700 }); continue; }
          G.y = p.y - 18;
          const spr = p.spring && G.x > p.x + p.w / 2 - 16 && G.x < p.x + p.w / 2 + 16;
          G.vy = spr ? -SPRING : -JUMP;
          G.squash = 1;
          if (spr) { p.sprung = .3; api.sfx.tone(300, .25, 'sine', .09, 0, 1200); api.vibe(20); }
          else api.sfx.tone(360 + Math.min(height(G), 3000) / 20, .09, 'sine', .07, 0, 620);
          if (p.t === 'v') { p.gone = true; for (let i = 0; i < 10; i++) api.spark({ x: p.x + Math.random() * p.w, y: p.y, vx: U.rand(-40, 40), vy: U.rand(-60, 20), color: '#f8fafc', size: 2.5, life: .5, gravity: 100 }); }
          break;
        }
      }
    }
    G.plats.forEach(p => { if (p.sprung) p.sprung = Math.max(0, p.sprung - dt); });

    /* ouriços */
    for (const f of G.foes) {
      if (f.dead) { f.y += 500 * dt; continue; }
      f.t += dt; f.x += f.vx * dt; if (f.x < 20 || f.x > W - 20) f.vx *= -1;
      const d = U.dist(G.x, G.y, f.x, f.y + Math.sin(f.t * 3) * 6);
      if (d < f.r + 16) {
        if (G.vy > 0 && G.y < f.y - 4) {
          f.dead = true; G.vy = -JUMP * 1.1; G.stomps++; G.bonus = (G.bonus || 0) + 50;
          api.float(f.x, f.y - 20, '+50', '#fde047', 18); api.sfx.tone(700, .12, 'square', .06, 0, 200); api.shake(4, .15);
        } else if (!G.over) { die(G, api, 'Picado por um ouriço!'); return; }
      }
    }

    /* câmara e pontuação */
    if (G.y < G.cam + H * .42) G.cam = G.y - H * .42;
    G.top = Math.min(G.top, G.y);
    const hNow = height(G);
    G.score = hNow + (G.bonus || 0);
    if (Math.floor(hNow / 500) > Math.floor((G.lastH || 0) / 500)) { api.banner(Math.floor(hNow / 500) * 500 + ' m', U.pick(['Continua a subir!', 'Que altura!', 'Sem medo!'])); api.sfx.arp([523, 659, 784], .06, .1, 'triangle', .06); }
    G.lastH = hNow;
    while (G.lastY > G.cam - 80) addPlat(G, api);
    G.plats = G.plats.filter(p => p.y < G.cam + H + 60 && !(p.broken > 1.2) && !(p.gone && p.y > G.cam + H));
    G.foes = G.foes.filter(f => f.y < G.cam + H + 60);
    if (G.y > G.cam + H + 60 && !G.over) die(G, api, 'Caíste!');
  }

  function die(G, api, why) {
    G.over = true;
    api.shake(8, .3); api.vibe(90); api.sfx.tone(500, .5, 'triangle', .08, 0, 90);
    api.over({ score: G.score, won: false, delay: 700, title: why, icon: '🦘',
      stats: [['Altura', height(G) + ' m'], ['Ouriços pisados', G.stomps]], meta: { height: height(G) } });
  }

  /* ── desenho ── */
  function skyCols(h) {
    const stops = [[0, [125, 211, 252], [224, 242, 254]], [300, [251, 146, 60], [253, 186, 116]], [700, [76, 29, 149], [236, 72, 153]], [1200, [8, 10, 32], [30, 27, 75]]];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (h >= stops[i][0] && h < stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    if (h >= stops[stops.length - 1][0]) a = b;
    const t = a === b ? 0 : (h - a[0]) / (b[0] - a[0]);
    const mix = (c1, c2) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(',')})`;
    return [mix(a[1], b[1]), mix(a[2], b[2]), h];
  }

  function draw(G, ctx, W, H, api) {
    const h = height(G);
    const [c1, c2] = skyCols(h);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* estrelas (a partir do entardecer) e nuvens em parallax */
    const night = U.clamp((h - 450) / 600, 0, 1);
    if (night > 0) {
      ctx.fillStyle = `rgba(255,255,255,${night * .9})`;
      G.stars.forEach(s => { const y = ((s.y - G.cam * .15) % H + H) % H; ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 6.3); ctx.fill(); });
    }
    ctx.fillStyle = `rgba(255,255,255,${.55 * (1 - night)})`;
    G.clouds.forEach(c => {
      const y = ((c.y - G.cam * .35) % (H + 80) + H + 80) % (H + 80) - 40;
      ctx.beginPath(); ctx.moveTo(c.x + 38 * c.s, y); ctx.ellipse(c.x, y, 38 * c.s, 13 * c.s, 0, 0, 6.3); ctx.moveTo(c.x + 22 * c.s + 24 * c.s, y - 8 * c.s); ctx.ellipse(c.x + 22 * c.s, y - 8 * c.s, 24 * c.s, 13 * c.s, 0, 0, 6.3); ctx.fill();
    });

    /* paisagem lá em baixo (colinas e árvores em 2 camadas) que fica para trás à medida que sobes,
       e um planeta com anéis a aparecer no espaço */
    const ground = G.y0 + 60 - G.cam;
    [[.25, '#86c5a0', 70, .011], [.55, '#4f9a6b', 34, .019]].forEach(([par, col, amp, fr]) => {
      const by = G.y0 + 60 - G.cam * par + (1 - par) * 40;
      if (by - amp * 2 > H) return;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H + 400);
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, by - amp - Math.sin(x * fr + par * 9) * amp * .6 - Math.sin(x * fr * 2.7) * amp * .2);
      ctx.lineTo(W, H + 400); ctx.fill();
      if (par > .5) for (let i = 0; i < 6; i++) { const tx = (i * 83 + 30) % W, ty = by - amp - Math.sin(tx * fr + par * 9) * amp * .6 - Math.sin(tx * fr * 2.7) * amp * .2; ctx.fillStyle = '#2f6b45'; ctx.beginPath(); ctx.moveTo(tx - 9, ty + 2); ctx.lineTo(tx, ty - 26); ctx.lineTo(tx + 9, ty + 2); ctx.fill(); }
    });
    if (night > .3) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (night - .3) * 1.5);
      const px = W * .78, py = H * .22 + (h % 4000) * .02;
      const pg = ctx.createRadialGradient(px - 14, py - 14, 4, px, py, 40); pg.addColorStop(0, '#fcd34d'); pg.addColorStop(1, '#b45309');
      ctx.strokeStyle = 'rgba(253,230,138,.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(px, py, 62, 14, -.3, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 36, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px, py, 62, 14, -.3, 0, Math.PI); ctx.stroke();
      ctx.restore();
    }
    ctx.save(); ctx.translate(0, -G.cam);
    /* plataformas */
    G.plats.forEach(p => {
      if (p.gone) return;
      let y = p.y, a = 1, rot = 0;
      if (p.broken) { y += p.broken * p.broken * 500; a = Math.max(0, 1 - p.broken); rot = p.broken * .6; }
      ctx.globalAlpha = a;
      const col = { n: ['#4ade80', '#15803d'], m: ['#60a5fa', '#1d4ed8'], b: ['#b45309', '#78350f'], v: ['#f8fafc', '#94a3b8'] }[p.t];
      ctx.save(); ctx.translate(p.x + p.w / 2, y + PH / 2); ctx.rotate(rot);
      if (p.t === 'm' || p.t === 'b') { ctx.fillStyle = 'rgba(0,0,0,.15)'; U.rr(ctx, -p.w / 2 + 3, -PH / 2 + 5, p.w, PH, 7); ctx.fill(); }
      const hw = p.w / 2;
      if (p.t === 'n') {
        /* ilhota: terra por baixo, relva com franja por cima */
        ctx.fillStyle = '#8a5a34'; ctx.beginPath(); ctx.moveTo(-hw + 2, -PH / 2 + 4); ctx.lineTo(hw - 2, -PH / 2 + 4); ctx.quadraticCurveTo(hw - 6, PH * .9, 0, PH * 1.25); ctx.quadraticCurveTo(-hw + 6, PH * .9, -hw + 2, -PH / 2 + 4); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.18)'; [[-hw * .4, 4], [hw * .3, 7]].forEach(([a, b]) => { ctx.beginPath(); ctx.ellipse(a, b, 4, 2.4, 0, 0, 6.3); ctx.fill(); });
        const gg = ctx.createLinearGradient(0, -PH / 2, 0, PH / 2); gg.addColorStop(0, '#86efac'); gg.addColorStop(1, '#16a34a');
        ctx.fillStyle = gg; U.rr(ctx, -hw, -PH / 2, p.w, PH * .7, 6); ctx.fill();
        ctx.fillStyle = '#15803d'; for (let k = -hw + 5; k < hw - 3; k += 7) { ctx.beginPath(); ctx.arc(k, -PH / 2 + PH * .66, 3.2, 0, Math.PI); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,.4)'; U.rr(ctx, -hw + 5, -PH / 2 + 2, p.w - 10, 2.5, 2); ctx.fill();
      } else if (p.t === 'm') {
        /* plataforma voadora: metal azul com hélices pequenas nas pontas */
        const mg = ctx.createLinearGradient(0, -PH / 2, 0, PH / 2); mg.addColorStop(0, '#93c5fd'); mg.addColorStop(1, '#1d4ed8');
        ctx.fillStyle = mg; U.rr(ctx, -hw, -PH / 2, p.w, PH, 7); ctx.fill();
        ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#facc15'; [-hw + 9, hw - 9].forEach(a => { ctx.beginPath(); ctx.arc(a, 0, 2.5, 0, 6.3); ctx.fill(); });
        const sp = Math.abs(Math.sin(api.t * 30)); ctx.fillStyle = 'rgba(226,232,240,.8)'; [-hw + 9, hw - 9].forEach(a => { ctx.fillRect(a - 1, PH / 2, 2, 5); ctx.beginPath(); ctx.ellipse(a, PH / 2 + 6, 9 * sp + 1, 2, 0, 0, 6.3); ctx.fill(); });
        ctx.fillStyle = 'rgba(255,255,255,.4)'; U.rr(ctx, -hw + 5, -PH / 2 + 2, p.w - 10, 2.5, 2); ctx.fill();
      } else if (p.t === 'b') {
        /* tábua velha: veios, pregos e uma racha (parte-se) */
        const wg = ctx.createLinearGradient(0, -PH / 2, 0, PH / 2); wg.addColorStop(0, '#d39a5c'); wg.addColorStop(1, '#8a5524');
        ctx.fillStyle = wg; U.rr(ctx, -hw, -PH / 2, p.w, PH, 3); ctx.fill(); ctx.strokeStyle = '#5a3412'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = 'rgba(90,52,18,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-hw + 4, -1); ctx.bezierCurveTo(-10, -3, 10, 2, hw - 4, 0); ctx.stroke();
        ctx.strokeStyle = '#451a03'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -PH / 2); ctx.lineTo(2, 0); ctx.lineTo(-3, PH / 2); ctx.stroke();
        ctx.fillStyle = '#3f2a14'; [-hw + 5, hw - 5].forEach(a => { ctx.beginPath(); ctx.arc(a, 0, 1.6, 0, 6.3); ctx.fill(); });
      } else {
        /* nuvem-fantasma: some quando a pisas */
        ctx.fillStyle = 'rgba(248,250,252,.88)'; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = -hw + 10 + k * (p.w - 20) / 3; ctx.moveTo(a + 10, -1); ctx.arc(a, -1 - (k % 2) * 3, 10, 0, 6.3); } ctx.fill();
        ctx.fillStyle = 'rgba(148,163,184,.35)'; U.rr(ctx, -hw + 4, 4, p.w - 8, 5, 3); ctx.fill();
      }
      if (p.spring) {
        const sq = p.sprung ? 1 + p.sprung * 2 : 1;
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 3; ctx.beginPath();
        for (let i = 0; i < 4; i++) { ctx.lineTo(i % 2 ? 7 : -7, -PH / 2 - 3 - i * 3.5 * sq); }
        ctx.stroke(); ctx.fillStyle = '#ef4444'; U.rr(ctx, -10, -PH / 2 - 17 * sq, 20, 5, 2); ctx.fill();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    });
    /* ouriços */
    G.foes.forEach(f => {
      const y = f.y + Math.sin(f.t * 3) * 6;
      ctx.save(); ctx.translate(f.x, y); if (f.dead) ctx.rotate(api.t * 8);
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + f.t, r = i % 2 ? f.r : f.r + 8; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6d28d9'; ctx.beginPath(); ctx.arc(0, 0, f.r - 2, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5, -3, 4, 0, 6.3); ctx.arc(5, -3, 4, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-4, -2, 2, 0, 6.3); ctx.arc(6, -2, 2, 0, 6.3); ctx.fill();
      ctx.restore();
    });
    /* herói: geleia com squash & stretch */
    const st = U.clamp(-G.vy / 1400, -.25, .3);
    const sx = 1 + G.squash * .35 - st * .35, sy = 1 - G.squash * .3 + st * .45;
    ctx.save(); ctx.translate(G.x, G.y + 18); ctx.scale(sx, sy);
    const bg = ctx.createRadialGradient(-6, -26, 3, 0, -16, 24);
    bg.addColorStop(0, '#f0abfc'); bg.addColorStop(.5, '#c026d3'); bg.addColorStop(1, '#6b21a8');
    ctx.fillStyle = '#6b21a8'; [-9, 9].forEach(a => { ctx.beginPath(); ctx.ellipse(a + G.face, 1, 6, 3.5, 0, 0, 6.3); ctx.fill(); });
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(-19, 0); ctx.bezierCurveTo(-22, -24, -12, -38, 0, -38); ctx.bezierCurveTo(12, -38, 22, -24, 19, 0); ctx.quadraticCurveTo(0, 5, -19, 0); ctx.fill();
    ctx.strokeStyle = '#3b0764'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(4, -10, 11, 6, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(244,114,182,.55)'; [-12, 12].forEach(a => { ctx.beginPath(); ctx.ellipse(a + G.face * 2, -13, 3.5, 2.2, 0, 0, 6.3); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-8, -28, 5, 3, -.6, 0, 6.3); ctx.fill();
    const ex = G.face * 3;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-6 + ex, -20, 5, 6, 0, 0, 6.3); ctx.ellipse(6 + ex, -20, 5, 6, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1e1b4b'; ctx.beginPath(); ctx.arc(-5 + ex * 1.4, -19 + (G.vy > 0 ? 2 : -1), 2.6, 0, 6.3); ctx.arc(7 + ex * 1.4, -19 + (G.vy > 0 ? 2 : -1), 2.6, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff'; [-5, 7].forEach(a => { ctx.beginPath(); ctx.arc(a + ex * 1.4 + .9, -20.2 + (G.vy > 0 ? 2 : -1), .9, 0, 6.3); ctx.fill(); });
    ctx.strokeStyle = '#3b0764'; ctx.lineWidth = 1.8; ctx.beginPath();
    if (G.vy < 0) ctx.arc(ex, -11, 4, .2, Math.PI - .2); else { ctx.ellipse(ex, -9, 3, 2.4, 0, 0, 6.3); }
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    /* indicador do dedo (toque) */
    if (G.tx != null && G.touch) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(G.tx, H - 30); ctx.lineTo(G.tx, H - 12); ctx.stroke(); }
  }

  return ArcadeKit.create({
    id: 'jumpy', title: 'Saltitão', icon: '🦘',
    accent: '#c026d3', accent2: '#fb923c', bg: '#7dd3fc',
    tagline: 'A geleia salta sozinha. Tu só decides para que lado — e sobes até às estrelas.',
    view: { w: 400 },
    how: [
      '<b>Rato:</b> a geleia segue o cursor. <b>Toque:</b> mantém o dedo no ecrã e ela vai para esse lado. (Também dá com ← →.)',
      'Plataformas <b style="color:#60a5fa">azuis</b> andam, <b style="color:#b45309">castanhas</b> partem-se, <b>brancas</b> desaparecem. As molas atiram-te lá para cima.',
      'Pisa os ouriços por cima (+50). Tocar-lhes de lado ou cair lá em baixo acaba o jogo.',
    ],
    controls: ['🖱️ Mover o rato', '👆 Manter o dedo', '⌨️ ← →'],
    ready: { title: 'Toca para saltar', hint: 'Guia a geleia para a esquerda e para a direita. Ela salta sozinha.' },
    setup, update, draw,
    down: (G, x, y, api, e) => { G.touch = e.pointerType !== 'mouse'; G.tx = x; },
    move: (G, x, y, api, e, isDown) => { if (e.pointerType === 'mouse' || isDown) G.tx = x; },
    up: (G, x, y, api, e) => { if (e.pointerType !== 'mouse') G.tx = null; },
    /* esquerda e direita em separado: largar uma com a outra ainda carregada não pára a geleia */
    key: (G, e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { G.kl = 1; G.keys = -1; G.tx = null; return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { G.kr = 1; G.keys = 1; G.tx = null; return true; }
    },
    keyup: (G, e) => {
      if (/^(ArrowLeft|a|A)$/.test(e.key)) { G.kl = 0; G.keys = G.kr ? 1 : 0; }
      if (/^(ArrowRight|d|D)$/.test(e.key)) { G.kr = 0; G.keys = G.kl ? -1 : 0; }
    },
    hud: G => [['Altura', height(G) + ' m'], ['Pontos', G.score]],
    achievements: [
      { id: 'jp.1k', name: 'Nas Nuvens',   icon: '☁️', desc: 'Sobe 1000 m no Saltitão.', test: c => ((c.result.meta || {}).height || 0) >= 1000 },
      { id: 'jp.3k', name: 'Astronauta',   icon: '🌌', desc: 'Sobe 3000 m no Saltitão.', test: c => ((c.result.meta || {}).height || 0) >= 3000 },
    ],
  });
})();
