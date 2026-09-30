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
    G.sunk = 0; G.sunkName = ''; G.fin = false; G.moving = false; G.trail = []; G.ht = 0; G.aim = null; G.splash = 0;
  }

  function setup(api, o) {
    const G = { cfg: DIFF[o.diff] || DIFF.medium, card: [], total: 0, t: 0 };
    loadHole(G, 0);
    G.api = api;
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build3D(G, api); } catch (e) { console.warn('[golfe] 3D falhou', e); } }).catch(() => {});
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
    api.float(...at(G, G.bx, G.by - 20, 10), 'Máximo de pancadas', '#fca5a5', 16);
    G.strokes = G.cfg.cap + 1; G.sunk = .001; G.sunkName = 'Limite';
    return true;
  }

  /* ponto do campo → ecrã lógico (em 3D a câmara é inclinada) */
  function at(G, x, y, z) {
    const R = G.r3; if (!R || !R.cam) return [x, y];
    const api = G.api, st = api.stage, cw = st.clientWidth, ch = st.clientHeight, sc = Math.min(cw / 400, ch / 640);
    const p = Arcade3D.toScreen(R.cam, x - 200, z || 0, y - 320, cw, ch);
    return [(p.x - (cw - 400 * sc) / 2) / sc, (p.y - (ch - 640 * sc) / 2) / sc];
  }
  function holed(G, api) {
    G.sunk = .001; G.moving = false; G.vx = G.vy = 0;
    const diff = G.strokes - G.h.par;
    const name = G.strokes === 1 ? 'Buraco à primeira!' : (NAMES[diff] || (diff > 0 ? '+' + diff : diff));
    api.sfx.arp(diff <= 0 ? [523, 659, 784, 1047] : [392, 523], .07, .14, 'triangle', .09); api.vibe([20, 30, 40]);
    const [cx0, cy0] = at(G, G.h.cup[0], G.h.cup[1], 4);
    for (let i = 0; i < 30; i++) api.spark({ x: cx0, y: cy0, vx: U.rand(-200, 200), vy: U.rand(-300, 20), color: U.pick(['#fde047', '#fff', '#86efac', '#f472b6']), size: U.rand(2, 4), life: 1, gravity: 500, shape: i % 3 ? 'dot' : 'square' });
    G.sunkName = name;
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
    /* o painel do buraco abre pelo relógio do jogo (não por setTimeout: em pausa espera) */
    if (G.sunk) { G.sunk += dt; if (G.sunk > .9 && !G.fin) { G.fin = true; finishHole(G, api, G.sunkName); } return; }
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
        const [wx0, wy0] = at(G, G.bx, G.by, 0);
        api.float(wx0, wy0 - 16, 'Água! +1', '#7dd3fc', 18); api.sfx.noise(.35, .12, 0, 900, 'lowpass');
        for (let i = 0; i < 18; i++) api.spark({ x: wx0, y: wy0, vx: U.rand(-90, 90), vy: U.rand(-190, -40), color: '#bae6fd', size: 2.5, life: .7, gravity: 500 });
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

  /* ════════════════════════════════════════════════════════════════
     3D — mesa de minigolfe inclinada: relva com riscas de corte,
     bermas de madeira em relevo, areia, lago que ondula, pára-choques,
     moinho com pás a rodar, bandeira a esvoaçar e bola com covinhas.
     1 unidade = 1 px lógico; x = lx − 200, z = ly − 320, y para cima.
  ════════════════════════════════════════════════════════════════ */
  function tex(w, h, paint, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t;
  }
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun } = Arcade3D.stdScene({ sky: '#f0fdf4', ground: '#14532d', hemi: 1.05, sunI: 2.5, normalBias: .6 });
    scene.background = new THREE.Color('#1d4a2a');
    scene.fog = new THREE.Fog('#1d4a2a', 900, 1700);
    const cam = new THREE.PerspectiveCamera(38, 1, 10, 3000);
    const T = {
      grass: tex(64, 88, (x, w, h) => { x.fillStyle = '#3fae4d'; x.fillRect(0, 0, w, h); x.fillStyle = '#46b955'; x.fillRect(0, 0, w, h / 2); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,60,0'},.06)`; x.fillRect(Math.random() * w, Math.random() * h, 1, 2); } }),
      sand: tex(64, 64, (x, w, h) => { x.fillStyle = '#e8cf91'; x.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,250,230' : '150,110,50'},.25)`; x.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4); } }),
      water: tex(128, 128, (x, w, h) => { x.fillStyle = '#1d6fd8'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(191,219,254,.55)'; x.lineWidth = 2.5; for (let yy = 8; yy < h; yy += 18) { x.beginPath(); for (let xx = 0; xx <= w; xx += 4) x.lineTo(xx, yy + Math.sin(xx / w * Math.PI * 4 + yy) * 3); x.stroke(); } }),
      lawn: tex(128, 128, (x, w, h) => { x.fillStyle = '#2c6b3a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '120,200,120' : '0,30,0'},.12)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 3); } }, [14, 14]),
      dimple: tex(128, 64, (x, w, h) => { x.fillStyle = '#f8fafc'; x.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { x.fillStyle = 'rgba(148,163,184,.35)'; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 1.6, 0, 6.3); x.fill(); } }),
    };
    T.grass.repeat.set(1 / 64, 1 / 88); T.sand.repeat.set(1 / 40, 1 / 40); T.water.repeat.set(1 / 90, 1 / 90);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshStandardMaterial({ map: T.lawn, roughness: 1 }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.y = -8; lawn.receiveShadow = true; scene.add(lawn);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 28, 20), new THREE.MeshStandardMaterial({ map: T.dimple, roughness: .35, metalness: .02 }));
    ball.castShadow = true; scene.add(ball);
    const aim = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 4, gapSize: 8, transparent: true, depthTest: false }));
    aim.renderOrder = 5; scene.add(aim);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(5, 14, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false }));
    arrow.renderOrder = 6; scene.add(arrow);
    G.r3 = { renderer, scene, sun, cam, T, ball, aim, arrow, hole: null, hi: -1, pool: Arcade3D.pool(scene), roll: new THREE.Quaternion(), ax: new THREE.Vector3(), qq: new THREE.Quaternion() };
    api.stage.style.background = '#1d4a2a';
  }

  function shapeOf(P) { const s = new THREE.Shape(); P.forEach(([x, y], i) => i ? s.lineTo(x - 200, y - 320) : s.moveTo(x - 200, y - 320)); return s; }
  /* forma no plano (x, y) → deitada no chão (x, z) */
  function flat(geo) { geo.rotateX(Math.PI / 2); return geo; }
  function buildHole(G) {
    const R = G.r3, h = G.h;
    if (R.hole) { R.scene.remove(R.hole); R.hole.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.userData.shared && !Object.values(R.T).includes(o.material.map)) o.material.dispose(); }); }
    const g = new THREE.Group(); R.hole = g; R.hi = G.hi; R.scene.add(g);
    const add = (geo, mat, y, cast) => { const m = new THREE.Mesh(geo, mat); m.position.y = y || 0; m.receiveShadow = true; m.castShadow = !!cast; g.add(m); return m; };
    /* relvado: bloco com a forma do buraco (topo em y=0) */
    const turf = flat(new THREE.ExtrudeGeometry(shapeOf(h.poly), { depth: 8, bevelEnabled: false }));
    add(turf, [new THREE.MeshStandardMaterial({ map: R.T.grass, roughness: .9 }), Arcade3D.std('#2d6a36', { roughness: .95 })], 0);
    (h.slopes || []).forEach(sl => { add(flat(new THREE.ShapeGeometry(shapeOf(sl.r))), new THREE.MeshStandardMaterial({ color: '#14532d', transparent: true, opacity: .28, depthWrite: false }), .3); });
    (h.sand || []).forEach(P => add(flat(new THREE.ExtrudeGeometry(shapeOf(P), { depth: .6, bevelEnabled: false })), new THREE.MeshStandardMaterial({ map: R.T.sand, roughness: 1 }), .6));
    R.waterMat = new THREE.MeshStandardMaterial({ map: R.T.water, roughness: .08, metalness: .25, transparent: true, opacity: .92 });
    (h.water || []).forEach(P => add(flat(new THREE.ShapeGeometry(shapeOf(P))), R.waterMat, .4));
    /* bermas e paredes interiores em madeira (caixas ao longo de cada segmento) */
    const wood = Arcade3D.std('#8b5e34', { roughness: .7 }), wood2 = Arcade3D.std('#a16207', { roughness: .7 }), cap = Arcade3D.std('#d6a064', { roughness: .6 });
    const seg = (ax, ay, bx, by, m) => {
      const L = Math.hypot(bx - ax, by - ay) + 8, a = Math.atan2(by - ay, bx - ax);
      const b = add(new THREE.BoxGeometry(L, 16, 9), m, 8, true); b.position.set((ax + bx) / 2 - 200, 8, (ay + by) / 2 - 320); b.rotation.y = -a;
      const t = add(new THREE.BoxGeometry(L, 2, 10.5), cap, 16.6); t.position.set(b.position.x, 16.6, b.position.z); t.rotation.y = -a;
    };
    const P = h.poly; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; seg(a[0], a[1], b[0], b[1], wood); }
    (h.walls || []).forEach(w => seg(w[0], w[1], w[2], w[3], wood2));
    /* pára-choques */
    R.bumps = (h.bumpers || []).map(([x, y, r]) => {
      const b = new THREE.Group();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 14, 28), Arcade3D.std('#ef4444', { roughness: .3 })); c.position.y = 7; c.castShadow = true; b.add(c);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r * .62, r * .62, 1, 24), Arcade3D.std('#ffffff', { roughness: .3 })); t.position.y = 14.4; b.add(t);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(r * .3, r * .3, 1.2, 18), Arcade3D.glowMat('#fca5a5')); d.position.y = 14.8; b.add(d);
      b.position.set(x - 200, 0, y - 320); b.userData = { x, y }; g.add(b); return b;
    });
    /* moinho: eixo + duas pás cruzadas a rodar */
    if (h.mill) {
      const m = h.mill, hub = new THREE.Group(); hub.position.set(m.x - 200, 0, m.y - 320);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 16, 20), Arcade3D.std('#7c2d12', { roughness: .6 })); post.position.y = 8; post.castShadow = true; hub.add(post);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(5, 14, 10), Arcade3D.std('#fbbf24', { metalness: .6, roughness: .3 })); knob.position.y = 17; hub.add(knob);
      const blades = new THREE.Group(); blades.position.y = 7;
      [0, Math.PI / 2].forEach(o => {
        const bl = new THREE.Mesh(Arcade3D.roundBox(.25), Arcade3D.std('#f8fafc', { roughness: .4 })); bl.scale.set(m.r * 2, 10, 10); bl.rotation.y = o; bl.castShadow = true; blades.add(bl);
        [-1, 1].forEach(sd => { const tip = new THREE.Mesh(new THREE.BoxGeometry(16, 10.4, 10.4), Arcade3D.std('#ef4444', { roughness: .4 })); tip.position.set(Math.cos(o) * sd * (m.r - 16), 0, -Math.sin(o) * sd * (m.r - 16)); tip.rotation.y = o; blades.add(tip); });
      });
      hub.add(blades); g.add(hub); R.blades = blades;
    } else R.blades = null;
    /* bloco deslizante */
    if (h.slider) { const sl = h.slider; R.slider = add(Arcade3D.roundBox(.2), Arcade3D.std('#94a3b8', { metalness: .6, roughness: .3 }), 0, true); R.slider.scale.set(sl.w, 16, sl.h); } else R.slider = null;
    /* tapete de partida */
    const tee = add(Arcade3D.roundBox(.3), Arcade3D.std('#dcfce7', { roughness: .9 }), .5); tee.scale.set(34, 1, 22); tee.position.set(h.tee[0] - 200, .5, h.tee[1] - 320);
    /* copo + bandeira */
    const cr = CUP * G.cfg.cup, cx = h.cup[0] - 200, cz = h.cup[1] - 320;
    const hole = add(new THREE.CircleGeometry(cr, 32), new THREE.MeshBasicMaterial({ color: '#050b07' }), .35); hole.rotation.x = -Math.PI / 2; hole.position.set(cx, .35, cz);
    const rim = add(new THREE.TorusGeometry(cr, 1, 8, 32), Arcade3D.std('#f1f5f9', { roughness: .3 }), .5); rim.rotation.x = Math.PI / 2; rim.position.set(cx, .5, cz);
    const pole = add(new THREE.CylinderGeometry(1, 1, 60, 8), Arcade3D.std('#e5e7eb', { metalness: .6, roughness: .3 }), 30, true); pole.position.set(cx, 30, cz);
    const fg = new THREE.PlaneGeometry(28, 16, 10, 2); fg.translate(14, 0, 0);
    const flag = add(fg, new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#7f1d1d', emissiveIntensity: .5, side: THREE.DoubleSide, roughness: .6 }), 50, true); flag.receiveShadow = false; flag.position.set(cx, 51, cz);
    R.flag = flag; R.flagBase = Float32Array.from(fg.attributes.position.array);
    /* árvores à volta do campo (fixas por buraco) */
    let seed = G.hi * 97 + 13; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1, x = side * (230 + rnd() * 140), z = -380 + rnd() * 760;
      const t = new THREE.Group(); t.position.set(x, -8, z);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 36, 8), Arcade3D.std('#78350f')); tr.position.y = 18; tr.castShadow = true; t.add(tr);
      const fo = new THREE.Mesh(new THREE.IcosahedronGeometry(26 + rnd() * 14, 0), Arcade3D.std(rnd() < .5 ? '#15803d' : '#166534', { roughness: .9, flatShading: true })); fo.position.y = 52; fo.castShadow = true; t.add(fo);
      g.add(t);
    }
  }

  function draw3D(G, ctx, W, H, api) {
    const R = G.r3, h = G.h, t = G.t;
    if (R.hi !== G.hi) buildHole(G);
    const cw = api.stage.clientWidth, ch = api.stage.clientHeight;
    const aspect = Arcade3D.fit(api.stage, R.cam);
    /* câmara inclinada (~30°) que enquadra o campo todo */
    const fov = R.cam.fov * Math.PI / 180, tilt = .66;
    const needV = 640 * Math.cos(tilt) / 2 + 40, needH = 186;
    const D = Math.max(needV / Math.tan(fov / 2), needH / (Math.tan(fov / 2) * aspect));
    const [shx, shy] = api.shakeXY;
    R.cam.position.set(shx, D * Math.cos(tilt) + shy, D * Math.sin(tilt) + 30);
    R.cam.lookAt(0, 0, 30); R.cam.far = D * 2.2; R.cam.updateProjectionMatrix();
    Arcade3D.sunAt(R.sun, 0, 0, 0, 420, [-.45, 1, .55]);
    /* peças que mexem */
    if (R.blades) R.blades.rotation.y = -G.ht * h.mill.w;
    if (R.slider) R.slider.position.set(h._sx - 200, 8, h.slider.y - 320);
    (R.bumps || []).forEach(b => { const on = G.bump && G.bump.x === b.userData.x && G.bump.y === b.userData.y; const k = on ? 1 + G.bump.t * 1.4 : 1; b.scale.set(k, 1, k); });
    R.T.water.offset.set(t * .04, t * .02);
    const pa = R.flag.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = R.flagBase[i * 3]; pa.setZ(i, Math.sin(x * .25 - t * 6) * x * .09); }
    pa.needsUpdate = true;
    /* bola: rola na direção do movimento; afunda no copo */
    const b = R.ball, sk = G.sunk ? Math.max(0, 1 - G.sunk * 3) : 1, sp = Math.hypot(G.vx, G.vy);
    b.visible = G.splash <= 0 && sk > 0;
    b.position.set(G.bx - 200, BR * sk - (1 - sk) * 10, G.by - 320);
    if (sp > 1) { R.ax.set(G.vy, 0, -G.vx).normalize(); R.qq.setFromAxisAngle(R.ax, -sp / BR / 60); b.quaternion.premultiply(R.qq); }
    /* rasto + mira (em 3D, no chão) */
    const P = R.pool; P.begin();
    G.trail.forEach((p, i) => { const s = P.get('tr', () => new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: '#ffffff', transparent: true, depthWrite: false, opacity: .4 }))); s.position.set(p[0] - 200, BR, p[1] - 320); const k = 1 - i / 10; s.scale.set(BR * 3 * k, BR * 3 * k, 1); s.material.opacity = .35 * k; });
    if (G.splash > 0) { const r = P.get('ring', () => { const m = new THREE.Mesh(new THREE.TorusGeometry(10, 1.2, 6, 28), new THREE.MeshBasicMaterial({ color: '#e0f2fe', transparent: true })); m.rotation.x = Math.PI / 2; return m; }); const k = 1 - G.splash / .8; r.position.set(G.bx - 200, 1, G.by - 320); r.scale.setScalar(.4 + k * 2.4); r.material.opacity = 1 - k; }
    P.end();
    const showAim = G.aim && G.aim.p > .06 && !G.moving && !G.sunk;
    R.aim.visible = R.arrow.visible = !!showAim;
    if (showAim) {
      const a = G.aim, col = a.p < .5 ? '#86efac' : a.p < .8 ? '#fde047' : '#f87171';
      const pts = predict(G, a.ang, G.cfg.guide === 'short' ? a.p * .4 : a.p, G.cfg.guide === 'bounce' ? 1 : 0);
      R.aim.geometry.dispose(); R.aim.geometry = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0] - 200, 3, p[1] - 320)));
      R.aim.computeLineDistances(); R.aim.material.color.set(col);
      const d = 16 + a.p * 44;
      R.arrow.position.set(G.bx - 200 - Math.cos(a.ang) * d, 6, G.by - 320 - Math.sin(a.ang) * d);
      R.arrow.rotation.set(Math.PI / 2, 0, -Math.PI / 2 - a.ang, 'YXZ'); R.arrow.rotation.set(0, 0, 0); R.arrow.lookAt(G.bx - 200, 6, G.by - 320); R.arrow.rotateX(Math.PI / 2);
      R.arrow.scale.set(1, .6 + a.p * 1.4, 1); R.arrow.material.color.set(col);
    }
    R.renderer.render(R.scene, R.cam);
    /* 2D por cima (caixa lógica): força em %, nome do buraco, dica */
    if (showAim) { const a = G.aim, [px, py] = at(G, G.bx - Math.cos(a.ang) * (22 + a.p * 50), G.by - Math.sin(a.ang) * (22 + a.p * 50), 12); ctx.fillStyle = '#fff'; ctx.font = '800 13px system-ui'; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.fillText(Math.round(a.p * 100) + '%', px, py - 8); ctx.shadowBlur = 0; }
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = "700 13px 'Space Grotesk', system-ui"; ctx.textAlign = 'center';
    ctx.fillText(`${h.name} · Par ${h.par}`, W / 2, H - 8);
    if (G.strokes === 0 && G.hi === 0 && !G.aim) { const [tx, ty] = at(G, h.tee[0], h.tee[1] + 34, 0); ctx.fillStyle = 'rgba(0,0,0,.45)'; U.rr(ctx, tx - 130, ty - 16, 260, 24, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui'; ctx.fillText('Arrasta para trás e larga para tacar', tx, ty); }
  }

  function destroy(G) {
    const R = G.r3; if (!R) return;
    Object.values(R.T).forEach(t => t.dispose());
    Arcade3D.disposeOwn(R.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    draw2D(G, ctx, W, H, api);
  }
  function draw2D(G, ctx, W, H, api) {
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
    accent: '#22c55e', accent2: '#fde047', bg: '#0d2616', transparent: true, destroy,
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
