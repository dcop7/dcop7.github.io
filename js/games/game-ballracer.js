/* ══════════════════════════════════════════════════════════════════
   Bola Veloz (Ballracer) — a bola rola sozinha por uma pista de 5
   colunas suspensa no céu; tu guias na horizontal. Buracos = cais,
   blocos = bates. Rampas amarelas saltam por cima de fossos, setas
   azuis dão velocidade, diamantes dão pontos. Perspetiva própria
   (câmara alta atrás da bola), pista gerada por troços com um caminho
   seguro garantido (passeio aleatório de coluna).
══════════════════════════════════════════════════════════════════ */
const BallracerGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const COLS = 5, BR = .3, CAMH = 3.1, CAMB = 3, FAR = 36, GRAV = 20;
  const E = 0, F = 1, B = 2, BO = 3, J = 4, GEM = 5;
  const THEMES = [
    { sky: ['#fb923c', '#fde68a'], a: '#e2e8f0', b: '#cbd5e1', side: '#64748b', cloud: 'rgba(255,255,255,.8)' },
    { sky: ['#7c3aed', '#f472b6'], a: '#e9d5ff', b: '#d8b4fe', side: '#6b21a8', cloud: 'rgba(255,220,255,.55)' },
    { sky: ['#0f172a', '#1e3a8a'], a: '#bae6fd', b: '#7dd3fc', side: '#0c4a6e', cloud: 'rgba(148,163,184,.35)' },
    { sky: ['#064e3b', '#34d399'], a: '#d1fae5', b: '#a7f3d0', side: '#065f46', cloud: 'rgba(236,253,245,.5)' },
  ];
  const DIFF = {
    easy:   { lives: 4, v0: 5.6, vMax: 10.5, acc: .045 },
    medium: { lives: 3, v0: 6.4, vMax: 12.5, acc: .06 },
    hard:   { lives: 2, v0: 7.4, vMax: 14.5, acc: .08 },
  };

  function setup(api, o) {
    const cfg = DIFF[o.diff] || DIFF.medium;
    const G = { cfg, lives: cfg.lives, rows: [], safe: [], genZ: 0, safeCol: 0, x: 0, tx: 0, z: 2, y: 0, vy: 0, v: cfg.v0, boost: 0,
      roll: 0, air: false, fall: 0, inv: 0, gems: 0, score: 0, camX: 0, clouds: Array.from({ length: 14 }, () => ({ x: U.rand(-1, 1), y: U.rand(.55, 1), s: U.rand(.5, 1.4), sp: U.rand(.01, .03) })) };
    for (let i = 0; i < 14; i++) pushRow(G, [F, F, F, F, F]);
    while (G.genZ < G.z + FAR + 4) genSegment(G);
    return G;
  }

  /* Quando o caminho seguro muda de coluna, as duas colunas ficam com chão
     sobreposto durante 3 filas — senão, num caminho de 1 casa, a bola teria de
     "teletransportar-se" de lado exatamente na fronteira entre filas. */
  function pushRow(G, r) {
    const prev = G.safe.length ? G.safe[G.safe.length - 1] : G.safeCol;
    if (prev !== G.safeCol) {
      r[prev + 2] = r[prev + 2] === GEM ? GEM : F;
      for (let k = 1; k <= 2; k++) { const pr = G.rows[G.rows.length - k]; if (pr && pr[G.safeCol + 2] !== J) pr[G.safeCol + 2] = pr[G.safeCol + 2] === GEM ? GEM : F; }
    }
    G.rows.push(r); G.safe.push(G.safeCol); G.genZ++;
  }

  function genSegment(G) {
    const d = G.genZ;
    const pool = ['full', 'blocks', 'narrow'];
    if (d > 40) pool.push('gaps', 'zig', 'jump');
    if (d > 110) pool.push('checker', 'blocks', 'bridge');
    if (d > 220) pool.push('zig', 'jump', 'gaps');
    const k = U.pick(pool), len = U.randi(10, 18);
    const walk = every => { if (G.genZ % every === 0) G.safeCol = U.clamp(G.safeCol + U.pick([-1, 0, 1]), -2, 2); };
    for (let i = 0; i < len; i++) {
      const r = [F, F, F, F, F], s = () => G.safeCol + 2;
      if (k === 'full') { if (Math.random() < .08) r[U.randi(0, 4)] = GEM; if (Math.random() < .05) r[U.randi(0, 4)] = BO; }
      else if (k === 'blocks') { walk(3); if (i % 3 === 1) for (let c = 0; c < 5; c++) if (c !== s() && Math.random() < .45) r[c] = B; if (i % 3 === 2 && Math.random() < .3) r[s()] = GEM; }
      else if (k === 'narrow') { walk(4); for (let c = 0; c < 5; c++) if (Math.abs(c - s()) > 1) r[c] = E; if (Math.random() < .12) r[s()] = GEM; }
      else if (k === 'bridge') { walk(5); for (let c = 0; c < 5; c++) if (c !== s()) r[c] = E; if (i % 4 === 2) r[s()] = GEM; }
      else if (k === 'zig') { walk(2); for (let c = 0; c < 5; c++) if (Math.abs(c - s()) > (i % 6 < 3 ? 0 : 1)) r[c] = E; }
      else if (k === 'gaps') { walk(3); if (i % 4 === 2 || i % 4 === 3) for (let c = 0; c < 5; c++) if (c !== s()) r[c] = E; if (i % 4 === 1 && Math.random() < .35) r[s()] = GEM; }
      else if (k === 'checker') { walk(2); for (let c = 0; c < 5; c++) if ((c + G.genZ) % 2 && c !== s()) r[c] = E; }
      else if (k === 'jump') {
        const ph = i % 9;
        if (ph === 3) r.fill(J);
        else if (ph >= 4 && ph <= 6) r.fill(E);
        else if (ph === 7) { r.fill(F); r[U.randi(0, 4)] = GEM; }
      }
      pushRow(G, r);
    }
    /* respiro entre troços */
    for (let i = 0; i < 3; i++) pushRow(G, [F, F, F, F, F]);
  }

  const tileAt = (G, x, z) => { const r = G.rows[Math.floor(z)], c = Math.round(x) + 2; return (!r || c < 0 || c > 4) ? E : r[c]; };

  function loseLife(G, api, why) {
    G.lives--; G.inv = 1.4;
    api.shake(10, .35); api.vibe(90); api.flash('#ef4444', .15);
    api.sfx.tone(260, .35, 'sawtooth', .06, 0, 70);
    if (G.lives <= 0) {
      G.dead = true;
      api.over({ score: G.score, won: false, delay: 900, title: why, icon: '🔵', stats: [['Distância', Math.floor(G.z) + ' m'], ['Diamantes', G.gems], ['Velocidade máx.', Math.round(G.vTop * 10) + ' km/h']], meta: { dist: Math.floor(G.z) } });
      return;
    }
    /* renasce um pouco atrás, no caminho seguro */
    let zi = Math.max(0, Math.floor(G.z) - 2);
    while (zi > 0 && tileAt(G, G.safe[zi] || 0, zi + .5) === E) zi--;
    G.z = zi + .5; G.x = G.tx = G.safe[zi] || 0; G.y = 0; G.vy = 0; G.air = false; G.fall = 0; G.pause = .7;
    api.banner(G.lives === 1 ? 'Última bola!' : G.lives + ' bolas', why);
  }

  function update(G, dt, api) {
    const c = G.cfg;
    G.inv = Math.max(0, G.inv - dt);
    if (G.pause > 0) { G.pause -= dt; G.camX = U.lerp(G.camX, G.x, Math.min(1, dt * 5)); return; }
    G.v = Math.min(c.vMax, G.v + c.acc * dt);
    G.boost = Math.max(0, G.boost - dt);
    const v = G.v + (G.boost > 0 ? 4 : 0);
    G.vTop = Math.max(G.vTop || 0, v);
    G.x = U.lerp(G.x, U.clamp(G.tx, -2.9, 2.9), Math.min(1, dt * 11));
    G.z += v * dt; G.roll += v * dt / BR;
    G.score = Math.floor(G.z) + G.gems * 10;
    const th = Math.floor(G.z / 300);
    if (th !== G.theme) { if (G.theme != null) { api.banner(Math.floor(G.z / 100) * 100 + ' m', 'Novo céu'); api.sfx.arp([523, 659, 784], .06, .1, 'triangle', .06); } G.theme = th; }

    if (G.fall > 0) {
      G.vy -= GRAV * dt; G.y += G.vy * dt; G.fall += dt;
      if (G.y < -4) { G.fall = 0; loseLife(G, api, 'Caíste da pista!'); }
    } else if (G.air) {
      G.vy -= GRAV * dt; G.y += G.vy * dt;
      if (G.y <= 0) {
        G.y = 0; G.vy = 0; G.air = false;
        api.sfx.tone(200, .08, 'triangle', .07); api.shake(3, .1);
      }
    }
    if (!G.air && G.fall === 0) {
      const t = tileAt(G, G.x, G.z);
      const onEdge = Math.abs(G.x) > 2.5 + BR * .4;
      if (t === E || onEdge) { G.fall = .001; G.vy = 0; api.sfx.tone(600, .5, 'sine', .06, 0, 120); }
      else if (t === J) { G.air = true; G.vy = 4.6 * GRAV / (2 * v);   /* salto sempre de ~4,6 filas, a qualquer velocidade */ api.sfx.tone(300, .25, 'square', .06, 0, 900); }
      else if (t === BO && G.boost <= 0) { G.boost = 1.3; api.sfx.noise(.3, .08, 0, 2400, 'highpass'); }
      else if (t === GEM) { G.rows[Math.floor(G.z)][Math.round(G.x) + 2] = F; G.gems++; api.float(api.W / 2, api.H * .55, '+10 💎', '#a5f3fc', 18); api.sfx.tone(1320, .08, 'sine', .07); api.sfx.tone(1760, .1, 'sine', .05, .05); }
    }
    /* blocos (só a rasar o chão) */
    if (G.y < .75 && G.fall === 0 && G.inv <= 0) {
      const zAhead = G.z + BR * .8;
      for (const dx of [-BR * .8, 0, BR * .8]) {
        if (tileAt(G, G.x + dx, zAhead) === B) { G.inv = 1; loseLife(G, api, 'Bateste num bloco!'); break; }
      }
    }
    while (G.genZ < G.z + FAR + 4) genSegment(G);
    G.camX = U.lerp(G.camX, G.x, Math.min(1, dt * 5));
  }

  /* ── desenho ── */
  function draw(G, ctx, W, H, api) {
    const th = THEMES[(G.theme || 0) % THEMES.length];
    const f = W * .5, hY = H * .75 - CAMH * f / CAMB;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.arc(W * .72, hY - 40, 34, 0, 6.3); ctx.fill();
    G.clouds.forEach(c => { const x = ((c.x - G.camX * .03 + G.z * c.sp * .1) % 2.4 + 2.4) % 2.4 - 1.2; const cx = W / 2 + x * W, cy = hY + c.y * (H - hY);
      ctx.fillStyle = th.cloud; ctx.beginPath(); ctx.moveTo(cx + 60 * c.s, cy); ctx.ellipse(cx, cy, 60 * c.s, 16 * c.s, 0, 0, 6.3); ctx.moveTo(cx + 30 * c.s + 34 * c.s, cy - 9 * c.s); ctx.ellipse(cx + 30 * c.s, cy - 9 * c.s, 34 * c.s, 14 * c.s, 0, 0, 6.3); ctx.fill(); });

    const camZ = G.z - CAMB;
    const P = (X, Y, Z) => { const dz = Z - camZ; return [W / 2 + (X - G.camX * .55) * f / dz, hY + (CAMH - Y) * f / dz]; };
    const quad = (a, b, c, d, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill(); };
    const z0 = Math.max(0, Math.floor(camZ + .45)), z1 = Math.min(G.rows.length - 1, Math.floor(G.z + FAR));
    const TH = .35;
    let ballDrawn = false;
    const drawBall = () => {
      const [bx, by] = P(G.x, G.y + BR, G.z), s = f / (G.z - camZ) * BR;
      if (G.fall === 0 || G.y > -1.5) {
        if (G.fall === 0) { const [sx, sy] = P(G.x, 0, G.z); ctx.fillStyle = `rgba(0,0,0,${.3 / (1 + G.y)})`; ctx.beginPath(); ctx.ellipse(sx, sy, s * (1 - Math.min(.5, G.y * .15)), s * .35, 0, 0, 6.3); ctx.fill(); }
      }
      if (G.inv > 0 && Math.floor(G.inv * 12) % 2) return;
      const g = ctx.createRadialGradient(bx - s * .35, by - s * .4, s * .1, bx, by, s);
      g.addColorStop(0, '#fff7ed'); g.addColorStop(.4, '#fb923c'); g.addColorStop(1, '#9a3412');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, s, 0, 6.3); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(bx, by, s, 0, 6.3); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = s * .18;
      const ry = Math.cos(G.roll) * s * .8;
      ctx.beginPath(); ctx.ellipse(bx, by + ry * .4, s, Math.abs(Math.sin(G.roll)) * s * .5 + 1, 0, 0, 6.3); ctx.stroke();
      ctx.restore();
      if (G.boost > 0) { ctx.strokeStyle = 'rgba(103,232,249,.6)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(bx - s * .8 + i * s * .5, by + s * 1.2); ctx.lineTo(bx - s * .8 + i * s * .5, by + s * 2.4); ctx.stroke(); } }
    };
    for (let zi = z1; zi >= z0; zi--) {
      const row = G.rows[zi]; if (!row) continue;
      const fog = U.clamp((G.z + FAR - zi) / 8, 0, 1);
      if (!ballDrawn && zi < Math.floor(G.z) && (G.fall > 0 && G.y < -.3)) { drawBall(); ballDrawn = true; }
      ctx.globalAlpha = fog;
      for (let ci = 0; ci < 5; ci++) {
        const t = row[ci]; if (t === E) continue;
        const X0 = ci - 2 - .5, X1 = ci - 2 + .5, Zn = zi, Zf = zi + 1;
        if (Zn - camZ < .3) continue;
        const col = (ci + zi) % 2 ? th.a : th.b;
        /* face da frente e laterais exteriores (espessura) — ao longe não se vêem */
        const near = Zn - camZ < 16;
        if (near || row[ci] === B || !G.rows[zi - 1] || G.rows[zi - 1][ci] === E) quad(P(X0, 0, Zn), P(X1, 0, Zn), P(X1, -TH, Zn), P(X0, -TH, Zn), th.side);
        if (near && (ci === 0 || row[ci - 1] === E)) quad(P(X0, 0, Zf), P(X0, 0, Zn), P(X0, -TH, Zn), P(X0, -TH, Zf), th.side);
        if (near && (ci === 4 || row[ci + 1] === E)) quad(P(X1, 0, Zn), P(X1, 0, Zf), P(X1, -TH, Zf), P(X1, -TH, Zn), th.side);
        quad(P(X0, 0, Zf), P(X1, 0, Zf), P(X1, 0, Zn), P(X0, 0, Zn), t === BO ? '#67e8f9' : t === J ? '#fde047' : col);
        if (t === BO || t === J) {
          const [ax, ay] = P(ci - 2, 0, Zn + .2), [bx, by] = P(ci - 2 - .3, 0, Zn + .55), [cx, cy] = P(ci - 2 + .3, 0, Zn + .55);
          ctx.strokeStyle = t === BO ? '#0e7490' : '#a16207'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ax, ay - (ay - by) * 2); ctx.lineTo(cx, cy); ctx.stroke();
        }
        if (t === B) {
          const h = .8, x0 = X0 + .08, x1 = X1 - .08, zn = Zn + .1, zf = Zf - .1;
          quad(P(x0, h, zn), P(x1, h, zn), P(x1, 0, zn), P(x0, 0, zn), '#dc2626');
          if (ci - 2 < G.camX * .55) quad(P(x1, h, zf), P(x1, h, zn), P(x1, 0, zn), P(x1, 0, zf), '#991b1b');
          else quad(P(x0, h, zn), P(x0, h, zf), P(x0, 0, zf), P(x0, 0, zn), '#991b1b');
          quad(P(x0, h, zf), P(x1, h, zf), P(x1, h, zn), P(x0, h, zn), '#f87171');
          const [sx0, sy0] = P(x0, h * .55, zn), [sx1] = P(x1, h * .55, zn);
          ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(sx0, sy0, sx1 - sx0, Math.max(1, (sx1 - sx0) * .1));
        }
        if (t === GEM) {
          const bob = Math.sin(api.t * 4 + zi) * .08, [gx, gy] = P(ci - 2, .45 + bob, zi + .5), s = f / (zi + .5 - camZ) * .2;
          ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.moveTo(gx, gy - s); ctx.lineTo(gx + s * .75, gy); ctx.lineTo(gx, gy + s); ctx.lineTo(gx - s * .75, gy); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(gx, gy - s); ctx.lineTo(gx + s * .3, gy - s * .1); ctx.lineTo(gx, gy); ctx.closePath(); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (!ballDrawn && zi === Math.floor(G.z)) { drawBall(); ballDrawn = true; }
    }
    if (!ballDrawn) drawBall();
    /* vidas */
    for (let i = 0; i < G.cfg.lives; i++) { ctx.globalAlpha = i < G.lives ? 1 : .22; ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(20 + i * 22, H - 20, 8, 0, 6.3); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (G.pause > 0) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = "800 22px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.fillText('Prepara-te…', W / 2, H * .35); }
  }

  return ArcadeKit.create({
    id: 'ballracer', title: 'Bola Veloz', icon: '🔵',
    accent: '#fb923c', accent2: '#67e8f9', bg: '#fb923c',
    tagline: 'Uma pista suspensa no céu, cheia de buracos e blocos. A bola não pára — tu guias.',
    view: { w: 400 },
    how: [
      '<b>Rato:</b> a bola vai para onde está o cursor. <b>Toque:</b> arrasta o dedo para a esquerda ou para a direita (em qualquer lado). Também há ← →.',
      'Não caias nos buracos nem batas nos blocos vermelhos. As rampas <b style="color:#ca8a04">amarelas</b> saltam os fossos; as setas <b style="color:#0891b2">azuis</b> dão velocidade.',
      'Apanha diamantes (+10). A velocidade vai subindo e a pista fica cada vez mais estreita.',
    ],
    controls: ['🖱️ Mover o rato', '👆 Arrastar', '⌨️ ← →'],
    ready: { title: 'Toca para rolar', hint: 'Guia a bola para a esquerda e para a direita.' },
    setup, update, draw,
    down: (G, x, y, api, e) => { if (e.pointerType !== 'mouse') G.drag = { x, tx: G.tx }; else G.tx = (x - api.W / 2) / (api.W / 2) * 3; },
    move: (G, x, y, api, e, isDown) => {
      if (e.pointerType === 'mouse') { G.tx = (x - api.W / 2) / (api.W / 2) * 3; return; }
      if (isDown && G.drag) G.tx = U.clamp(G.drag.tx + (x - G.drag.x) / (api.W / 2) * 3.4, -2.9, 2.9);
    },
    up: G => { G.drag = null; },
    key: (G, e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') { G.tx = U.clamp(Math.round(G.tx) - 1, -2, 2); return true; }
      if (e.key === 'ArrowRight' || e.key === 'd') { G.tx = U.clamp(Math.round(G.tx) + 1, -2, 2); return true; }
    },
    hud: G => [['Pontos', G.score], ['Distância', Math.floor(G.z) + ' m'], ['💎', G.gems]],
    achievements: [
      { id: 'br.500',  name: 'Rolamento Perfeito', icon: '🔵', desc: 'Percorre 500 m na Bola Veloz.', test: c => ((c.result.meta || {}).dist || 0) >= 500 },
      { id: 'br.1500', name: 'Acima das Nuvens',   icon: '☁️', desc: 'Percorre 1500 m na Bola Veloz.', test: c => ((c.result.meta || {}).dist || 0) >= 1500 },
    ],
  });
})();
