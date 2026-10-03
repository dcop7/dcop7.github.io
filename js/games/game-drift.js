/* ══════════════════════════════════════════════════════════════════
   Drift — carro visto de cima em pistas compactas; acelera sozinho,
   tu só viras. Mantém premida a metade ESQUERDA ou DIREITA do ecrã
   (rato ou dedo) — ou usa ← →. Virar a alta velocidade faz perder
   aderência lateral: é a derrapagem. Relva abranda, barreira de pneus
   ressalta. 3 voltas, cronómetro, estrelas por tempo, pontos de drift.
   Pistas = pontos de controlo → Catmull-Rom fechada → polilinha
   uniforme; o progresso usa o índice mais próximo numa janela (por
   isso o "8", que se cruza, funciona).
══════════════════════════════════════════════════════════════════ */
const DriftGame = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const TW = 116, BAR = 70, LAPS = 3, STEP = 12;

  /* ── pistas ── */
  function lemniscate() {
    const p = [];
    for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2, d = 1 + Math.sin(t) ** 2; p.push([640 + 520 * Math.cos(t) / d, 470 + 1.75 * 300 * Math.sin(t) * Math.cos(t) / d]); }
    return p;
  }
  function serpent() {
    const p = [];
    for (let x = 180; x <= 1080; x += 90) p.push([x, 300 + 120 * Math.sin((x - 180) / 900 * Math.PI * 3)]);
    p.push([1200, 520], [1080, 780]);
    for (let x = 900; x >= 360; x -= 180) p.push([x, 800]);
    p.push([180, 780], [70, 540]);
    return p;
  }
  const TRACKS = [
    { id: 'oval', name: 'Anel', icon: '⭕', desc: 'Oval curto e rápido. Ideal para aprender a derrapar.',
      pts: [[250, 220], [950, 220], [1110, 330], [1110, 470], [950, 580], [250, 580], [90, 470], [90, 330]] },
    { id: 'hook', name: 'Gancho', icon: '🪝', desc: 'Dois ganchos apertados no meio de retas longas.',
      pts: [[220, 170], [1000, 170], [1130, 300], [1000, 420], [560, 420], [450, 500], [560, 580], [1000, 580], [1130, 700], [1000, 830], [220, 830], [80, 690], [80, 310]] },
    { id: 'eight', name: 'Oito', icon: '♾️', desc: 'Um oito com cruzamento ao meio. Curvas longas, sempre a derrapar.', pts: lemniscate() },
    { id: 'snake', name: 'Serpente', icon: '🐍', desc: 'Curvas em S encadeadas. Troca de lado sem tirar o dedo.', pts: serpent() },
  ];
  const DIFF = {
    easy:   { vmax: 360, grip: 8.5, drift: 2.9, steer: 2.7 },
    medium: { vmax: 420, grip: 7,   drift: 2.2, steer: 2.95 },
    hard:   { vmax: 480, grip: 6,   drift: 1.7, steer: 3.15 },
  };

  function buildTrack(def) {
    if (def.poly) return def;
    const P = def.pts, n = P.length, raw = [];
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (let k = 0; k < 20; k++) {
        const t = k / 20, t2 = t * t, t3 = t2 * t;
        raw.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    /* re-amostragem uniforme */
    const poly = [raw[0]]; let acc = 0;
    for (let i = 1; i <= raw.length; i++) {
      const a = raw[i - 1], b = raw[i % raw.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc += d;
      while (acc >= STEP) { acc -= STEP; const t = 1 - acc / d; poly.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    if (Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < STEP * .5) poly.pop();
    def.poly = poly; def.N = poly.length; def.len = poly.length * STEP;
    def.tan = poly.map((p, i) => { const q = poly[(i + 1) % poly.length]; return Math.atan2(q[1] - p[1], q[0] - p[0]); });
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    def.box = [Math.min(...xs) - 200, Math.min(...ys) - 200, Math.max(...xs) + 200, Math.max(...ys) + 200];
    /* distância (aprox.) de um ponto à pista */
    const dTrack = (x, y) => { let m = Infinity; for (let i = 0; i < poly.length; i += 2) { const d = (poly[i][0] - x) ** 2 + (poly[i][1] - y) ** 2; if (d < m) m = d; } return Math.sqrt(m); };
    const scatter = (n, dMin, dMax, pad) => { const out = []; for (let k = 0; out.length < n && k < n * 40; k++) { const x = U.rand(def.box[0] - pad, def.box[2] + pad), y = U.rand(def.box[1] - pad, def.box[3] + pad), d = dTrack(x, y); if (d > dMin && d < dMax) out.push([x, y, Math.random()]); } return out; };
    /* tufos de relva só na escapatória (nunca no asfalto/zebras); árvores só para lá da barreira de pneus */
    def.tufts = scatter(240, TW / 2 + 18, TW / 2 + BAR - 6, 0);
    def.trees = scatter(170, TW / 2 + BAR + 44, 1100, 600);
    return def;
  }

  function setup(api, o) {
    const tr = buildTrack(TRACKS.find(t => t.id === o.mode) || TRACKS[0]);
    const cfg = DIFF[o.diff] || DIFF.medium;
    const si = tr.N - 5, sp = tr.poly[si];
    const G = {
      tr, cfg, x: sp[0], y: sp[1], a: tr.tan[si], vx: 0, vy: 0, steer: 0, steerVis: 0,
      idx: si, prog: -5, lap: 0, t: 0, lapT: 0, laps: [], count: 3.4, started: false,
      drift: 0, driftPts: 0, driftCur: 0, off: false, wrong: 0, skids: [], smoke: [],
      camX: sp[0], camY: sp[1], keys: 0, done: false, lastBeep: 4,
      /* fantasma: a melhor corrida nesta pista/dificuldade, gravada a 10 Hz */
      gKey: 'drift:ghost:' + tr.id + ':' + (o.diff || 'medium'), ghost: null, rec: [],
    };
    try { const g = JSON.parse(localStorage.getItem(G.gKey)); if (g && g.t > 0 && Array.isArray(g.p)) G.ghost = g; } catch (e) {}
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build3D(G, api); } catch (e) { console.warn('[drift] 3D falhou', e); } }).catch(() => {});
    return G;
  }
  const GHZ = 10;
  function ghostAt(G) {
    const p = G.ghost.p, f = G.t * GHZ, i = Math.floor(f);
    if (i >= p.length - 1) return null;
    const a = p[i], b = p[i + 1], k = f - i;
    return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, a: a[2] + U.angDiff(b[2], a[2]) * k, steerVis: 0 };
  }

  function nearest(G) {
    const { poly, N } = G.tr;
    let best = G.idx, bd = Infinity;
    for (let k = -18; k <= 18; k++) {
      const i = (G.idx + k + N) % N, p = poly[i], d = (p[0] - G.x) ** 2 + (p[1] - G.y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    const a = poly[(best - 1 + N) % N], b = poly[best], c = poly[(best + 1) % N];
    const dist = Math.min(U.segDist(G.x, G.y, a[0], a[1], b[0], b[1]), U.segDist(G.x, G.y, b[0], b[1], c[0], c[1]));
    return { i: best, dist };
  }

  function update(G, dt, api) {
    const c = G.cfg, tr = G.tr;
    /* contagem decrescente */
    if (G.count > 0) {
      G.count -= dt;
      const s = Math.ceil(G.count);
      if (s < G.lastBeep && s >= 1) { G.lastBeep = s; api.sfx.tone(440, .15, 'square', .06); }
      if (G.count <= 0) { api.sfx.tone(880, .3, 'square', .08); G.started = true; api.banner('Vai!', ''); }
      return;
    }
    if (G.done) return;
    G.t += dt; G.lapT += dt;

    /* direção: metades do ecrã premidas (multi-toque: as duas = em frente) */
    let L = false, R = false;
    api.ptrs.forEach(p => { if (p.x < api.W / 2) L = true; else R = true; });
    let s = (R ? 1 : 0) - (L ? 1 : 0);
    if (G.keys) s = G.keys;
    G.steer = s;
    G.steerVis = U.lerp(G.steerVis, s, Math.min(1, dt * 12));

    const fx = Math.cos(G.a), fy = Math.sin(G.a), lx = -fy, ly = fx;
    let vF = G.vx * fx + G.vy * fy, vL = G.vx * lx + G.vy * ly;
    const spd = Math.hypot(G.vx, G.vy);
    const n = nearest(G);
    const d = n.i - G.idx; G.prog += (d > tr.N / 2 ? d - tr.N : d < -tr.N / 2 ? d + tr.N : d); G.idx = n.i;
    G.off = n.dist > TW / 2;
    const vmax = c.vmax * (G.off ? .5 : 1);

    G.a += s * c.steer * Math.min(1, spd / 140) * dt * (vF < 0 ? -1 : 1);
    vF += ((vF < vmax ? 330 : -260) - vF * (G.off ? 1.4 : .12)) * dt;
    const grip = s !== 0 && spd > 180 ? c.drift : c.grip;
    vL *= Math.exp(-grip * dt);
    vF -= Math.abs(vL) * .35 * dt;                   /* derrapar custa velocidade */
    G.vx = fx * vF + lx * vL; G.vy = fy * vF + ly * vL;
    G.x += G.vx * dt; G.y += G.vy * dt;

    /* barreira de pneus */
    const n2 = nearest(G);
    if (n2.dist > TW / 2 + BAR) {
      const p = tr.poly[n2.i], dx = G.x - p[0], dy = G.y - p[1], dl = Math.hypot(dx, dy) || 1, nx = dx / dl, ny = dy / dl;
      G.x = p[0] + nx * (TW / 2 + BAR - 1); G.y = p[1] + ny * (TW / 2 + BAR - 1);
      const vn = G.vx * nx + G.vy * ny;
      if (vn > 0) { G.vx -= 1.6 * vn * nx; G.vy -= 1.6 * vn * ny; G.vx *= .55; G.vy *= .55; }
      if (vn > 90) { api.shake(8, .25); api.vibe(40); api.sfx.noise(.2, .14, 0, 300, 'lowpass'); }
    }

    /* derrapagem: marcas, fumo e pontos */
    const sliding = Math.abs(vL) > 70 && !G.off;
    if (sliding) {
      G.drift += dt; G.driftCur += Math.abs(vL) * dt * .05;
      if (G.drift > .08 && Math.floor(G.t * 20) !== Math.floor((G.t - dt) * 20)) {
        [[-14, -8], [-14, 8]].forEach(([ox, oy]) => {
          const wx = G.x + fx * ox + lx * oy, wy = G.y + fy * ox + ly * oy;
          const last = G.lastSkid && G.lastSkid[oy > 0 ? 1 : 0];
          if (last) G.skids.push([last[0], last[1], wx, wy]);
          G.lastSkid = G.lastSkid || []; G.lastSkid[oy > 0 ? 1 : 0] = [wx, wy];
          G.smoke.push({ x: wx, y: wy, r: 6, life: .7 });
        });
        if (G.skids.length > 700) G.skids.splice(0, G.skids.length - 700);
        if (Math.random() < .3) api.sfx.noise(.08, .03, 0, 2400, 'bandpass');
      }
    } else {
      G.lastSkid = null;
      if (G.drift > .5 && G.driftCur > 8) { const pts = Math.round(G.driftCur); G.driftPts += pts; api.float(api.W / 2, api.H * .38, 'Drift +' + pts, '#fde047', 22); api.sfx.tone(660, .1, 'triangle', .05); }
      G.drift = 0; G.driftCur = 0;
    }
    if (G.off && spd > 60 && Math.random() < .5) G.smoke.push({ x: G.x - fx * 16, y: G.y - fy * 16, r: 5, life: .5, dirt: true });
    G.smoke.forEach(p => { p.life -= dt; p.r += dt * 26; });
    G.smoke = G.smoke.filter(p => p.life > 0);

    while (G.rec.length <= G.t * GHZ) G.rec.push([Math.round(G.x), Math.round(G.y), Math.round(G.a * 100) / 100]);

    /* sentido contrário */
    const tdir = tr.tan[G.idx], along = Math.cos(tdir) * G.vx + Math.sin(tdir) * G.vy;
    G.wrong = along < -40 ? G.wrong + dt : 0;

    /* voltas */
    if (G.prog >= tr.N) {
      G.prog -= tr.N; G.lap++;
      G.laps.push(G.lapT);
      const best = Math.min(...G.laps);
      api.sfx.arp([659, 784, 988], .06, .12, 'triangle', .08);
      if (G.lap >= LAPS) { finish(G, api); return; }
      api.banner('Volta ' + (G.lap + 1) + '/' + LAPS, U.fmtTime(G.lapT) + (G.lapT === best && G.lap > 1 ? ' · melhor!' : ''));
      G.lapT = 0;
    }
    /* câmara com antecipação */
    G.camX = U.lerp(G.camX, G.x + G.vx * .32, Math.min(1, dt * 4));
    G.camY = U.lerp(G.camY, G.y + G.vy * .32, Math.min(1, dt * 4));
  }

  function par(G) { return G.tr.len / (G.cfg.vmax * .74) * LAPS; }

  function finish(G, api) {
    G.done = true;
    const total = Math.round(G.t * 100) / 100, p = par(G);
    const stars = total <= p ? 3 : total <= p * 1.14 ? 2 : 1;
    const beatGhost = !G.ghost || total < G.ghost.t;
    if (beatGhost) { try { localStorage.setItem(G.gKey, JSON.stringify({ t: total, p: G.rec })); } catch (e) {} }
    api.over({ score: total, won: true, stars, delay: 900, title: 'Corrida terminada', icon: '🏁',
      sub: `Para ★★★: ${U.fmtTime(p)}` + (G.ghost ? (beatGhost ? '<br>👻 Bateste o fantasma!' : `<br>👻 Fantasma: ${U.fmtTime(G.ghost.t)}`) : ''),
      stats: [['Melhor volta', U.fmtTime(Math.min(...G.laps))], ['Pontos de drift', G.driftPts]],
      meta: { stars, drift: G.driftPts } });
  }

  /* ── desenho ── */
  function strokePoly(ctx, poly, w, col, dash) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
  }

  function car(ctx, G, ghost) {
    ctx.save(); ctx.translate(G.x, G.y); ctx.rotate(G.a);
    if (ghost) {
      ctx.globalAlpha = .38;
      ctx.fillStyle = '#e0f2fe'; U.rr(ctx, -21, -10, 42, 20, 7); ctx.fill();
      ctx.fillStyle = '#38bdf8'; U.rr(ctx, -4, -7.5, 12, 15, 3); ctx.fill();
      ctx.restore(); return;
    }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; U.rr(ctx, -20, -9, 44, 22, 7); ctx.fill();
    ctx.fillStyle = '#111';
    [[-13, -11], [-13, 11], [11, -11], [11, 11]].forEach(([x, y], i) => { ctx.save(); ctx.translate(x, y); if (i > 1) ctx.rotate(G.steerVis * .45); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore(); });
    const g = ctx.createLinearGradient(0, -10, 0, 10); g.addColorStop(0, '#f87171'); g.addColorStop(.5, '#dc2626'); g.addColorStop(1, '#991b1b');
    ctx.fillStyle = g; U.rr(ctx, -21, -10, 42, 20, 7); ctx.fill();
    ctx.fillStyle = '#1e293b'; U.rr(ctx, -4, -7.5, 12, 15, 3); ctx.fill();
    ctx.fillStyle = 'rgba(148,197,255,.55)'; U.rr(ctx, 5, -7, 5, 14, 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-12, -1.5, 22, 3);
    ctx.fillStyle = '#111'; ctx.fillRect(-22, -9, 3, 18);
    ctx.fillStyle = '#fef9c3'; ctx.fillRect(19, -8, 2.5, 4); ctx.fillRect(19, 4, 2.5, 4);
    ctx.restore();
  }

  /* ════════════════════════════════════════════════════════════════
     3D — câmara de perseguição atrás do carro (roda com ele), pista em
     fita de asfalto com zebras vermelho/branco, escapatória, barreira
     de pneus, tufos de relva, marcas de pneus e fumo, carro low-poly com
     rodas da frente a virar e carroçaria a inclinar na derrapagem.
     1 unidade = 1 px da pista; x = x, z = y.
  ════════════════════════════════════════════════════════════════ */
  function ribbon(poly, tan, o0, o1, colorAt) {
    const n = poly.length, pos = [], col = [], idx = [], uv = [], c = new THREE.Color();
    for (let i = 0; i <= n; i++) {
      const k = i % n, p = poly[k], a = tan[k], nx = -Math.sin(a), nz = Math.cos(a);
      pos.push(p[0] + nx * o0, 0, p[1] + nz * o0, p[0] + nx * o1, 0, p[1] + nz * o1);
      c.set(colorAt(i)); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      uv.push(0, i * STEP / 96, Math.abs(o1 - o0) / 96, i * STEP / 96);
      if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function carModel3(color, ghost) {
    const g = new THREE.Group(), rb = Arcade3D.roundBox(.14);
    const body = ghost ? new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: .35, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color, roughness: .28, metalness: .5 });
    const glass = ghost ? body : Arcade3D.std('#1e293b', { roughness: .08, metalness: .8 });
    const add = (geo, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = !ghost; g.add(o); return o; };
    const chassis = new THREE.Group(); g.add(chassis);
    const addC = (geo, m, x, y, z, sx, sy, sz) => { const o = add(geo, m, x, y, z, sx, sy, sz); g.remove(o); chassis.add(o); return o; };
    addC(rb, body, 0, 5, 0, 42, 7, 20);
    addC(rb, body, -2, 9.5, 0, 22, 4, 17);
    addC(rb, glass, 1, 11, 0, 16, 5, 15.4);
    if (!ghost) {
      addC(new THREE.BoxGeometry(1, 1, 1), Arcade3D.std('#f8fafc'), 0, 8.8, 0, 38, .4, 3);            /* risca branca */
      addC(new THREE.BoxGeometry(1, 1, 1), Arcade3D.std('#111827'), -22, 9, 0, 3, 3, 19);             /* aileron */
      [[21.2, 6], [21.2, -6]].forEach(([x, z]) => addC(new THREE.BoxGeometry(1, 1, 1), Arcade3D.glowMat('#fef9c3'), x, 5.6, z, .6, 2.2, 4));
      [[-21.2, 6], [-21.2, -6]].forEach(([x, z]) => addC(new THREE.BoxGeometry(1, 1, 1), Arcade3D.glowMat('#ef4444'), x, 5.6, z, .6, 2, 4));
    }
    const wheel = new THREE.CylinderGeometry(4, 4, 3.4, 14); wheel.rotateX(Math.PI / 2);
    const tire = ghost ? body : Arcade3D.std('#0b0b10', { roughness: .9 });
    g.userData.front = [[13, 10.6], [13, -10.6]].map(([x, z]) => add(wheel, tire, x, 4, z, 1, 1, 1));
    [[-13, 10.6], [-13, -10.6]].forEach(([x, z]) => add(wheel, tire, x, 4, z, 1, 1, 1));
    g.userData.chassis = chassis;
    return g;
  }
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun } = Arcade3D.stdScene({ sky: '#eff6ff', ground: '#3f6212', hemi: 1.05, sunI: 2.5, normalBias: 1.2 });
    sun.shadow.bias = -.0004;
    /* céu: gradiente com nuvens pintadas (cúpula) */
    const skyT = (() => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#3b82d6'); g.addColorStop(.45, '#8cc8f2'); g.addColorStop(.62, '#d8eefc'); g.addColorStop(1, '#eef7ff');
      x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 26; i++) {
        const cx = Math.random() * 1024, cy = 120 + Math.random() * 150, s = 18 + Math.random() * 30;
        for (let k = 0; k < 6; k++) { const gx = cx + (k - 3) * s * .9 + Math.random() * 10, gy = cy + Math.sin(k) * s * .25, r = s * (.7 + Math.random() * .5); const rg = x.createRadialGradient(gx, gy, 0, gx, gy, r); rg.addColorStop(0, 'rgba(255,255,255,.85)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(gx - r, gy - r, r * 2, r * 2); [-1024, 1024].forEach(o => { x.save(); x.translate(o, 0); x.fillRect(gx - r, gy - r, r * 2, r * 2); x.restore(); }); }
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
    })();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2200, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.position.set(640, -40, 480); scene.add(dome);
    scene.background = new THREE.Color('#9fd3f5');
    scene.fog = new THREE.Fog('#cfe6f5', 900, 2000);
    const cam = new THREE.PerspectiveCamera(58, 1, 2, 4800);
    const tr = G.tr;
    /* relva (manchas, riscas de corte e grão) */
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#4a8b3c'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.035)'; x.fillRect(0, i * 32, 256, 32); }
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '170,220,120' : '25,70,25'},.18)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 3); }
    for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(20,60,20,.08)'; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 20, 6 + Math.random() * 10, Math.random() * 3, 0, 6.3); x.fill(); }
    const gt = new THREE.CanvasTexture(c); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(40, 40); gt.colorSpace = THREE.SRGBColorSpace; gt.anisotropy = 4;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(640, -.6, 480); ground.receiveShadow = true; scene.add(ground);
    /* asfalto: grão, remendos e marcas escuras na trajetória (textura ao longo da fita) */
    const at = (() => {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const y = cv.getContext('2d');
      y.fillStyle = '#4a4e57'; y.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 9000; i++) { const v = Math.random(); y.fillStyle = v < .5 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.07)'; y.fillRect(Math.random() * 256, Math.random() * 256, 1.2, 1.2); }
      const lg = y.createLinearGradient(0, 0, 256, 0); lg.addColorStop(0, 'rgba(0,0,0,.18)'); lg.addColorStop(.3, 'rgba(0,0,0,0)'); lg.addColorStop(.5, 'rgba(0,0,0,.1)'); lg.addColorStop(.7, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,.18)');
      y.fillStyle = lg; y.fillRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    })();
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide });
    const addR = (o0, o1, y, colAt, mat) => { const m = new THREE.Mesh(ribbon(tr.poly, tr.tan, o0, o1, colAt), mat || vc); m.position.y = y; m.receiveShadow = true; scene.add(m); return m; };
    addR(-(TW / 2 + BAR), TW / 2 + BAR, -.3, () => '#5a9a49');                                  /* escapatória */
    [-1, 1].forEach(sd => addR(sd * (TW / 2 + 9), sd * (TW / 2 + 18), -.1, () => '#c9b78f'));        /* gravilha junto às zebras */
    [-1, 1].forEach(sd => addR(sd * TW / 2, sd * (TW / 2 + 9), .3, i => (Math.floor(i / 2) % 2 ? '#dc2626' : '#f8fafc')));   /* zebras */
    addR(-TW / 2, TW / 2, .15, () => '#ffffff', new THREE.MeshStandardMaterial({ map: at, roughness: .78, metalness: .02 }));
    [-1, 1].forEach(sd => addR(sd * (TW / 2 - 6), sd * (TW / 2 - 4), .32, () => '#f1f5f9'));          /* linhas brancas das bermas */
    /* barreira de pneus (cilindros empilhados) */
    const tires = new THREE.InstancedMesh(new THREE.TorusGeometry(4.2, 2.4, 8, 14), new THREE.MeshStandardMaterial({ roughness: .9 }), tr.poly.length * 4);
    tires.castShadow = true; tires.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    let n = 0;
    /* sem pneus a invadir a escapatória de outro troço (curvas apertadas, cruzamento do oito) nem pneus uns em cima dos outros */
    const near = (x, z, R2) => { for (let k = 0; k < tr.poly.length; k += 2) { const pp = tr.poly[k]; if ((pp[0] - x) ** 2 + (pp[1] - z) ** 2 < R2) return true; } return false; };
    const grid = new Map(), key = (x, z) => Math.round(x / 7) + ',' + Math.round(z / 7);
    const taken = (x, z) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get((Math.round(x / 7) + a) + ',' + (Math.round(z / 7) + b)); if (l && l.some(([u, w]) => (u - x) ** 2 + (w - z) ** 2 < 49)) return true; } return false; };
    tr.poly.forEach((p, i) => { const a = tr.tan[i], nx = -Math.sin(a), nz = Math.cos(a); [-1, 1].forEach(sd => {
      const x0 = p[0] + nx * sd * (TW / 2 + BAR + 10), z0 = p[1] + nz * sd * (TW / 2 + BAR + 10);
      if (near(x0, z0, (TW / 2 + BAR + 4) ** 2) || taken(x0, z0)) return;
      const k = key(x0, z0); (grid.get(k) || grid.set(k, []).get(k)).push([x0, z0]);
      for (let h = 0; h < 2; h++) { v.set(x0, 2.4 + h * 4.8, z0); m4.compose(v, q, sc); tires.setMatrixAt(n, m4); col.set((i + h) % 2 ? '#1f2937' : '#e5e7eb'); tires.setColorAt(n++, col); }
    }); });
    tires.count = n; scene.add(tires);
    /* tufos de relva baixos (só na escapatória) */
    const tuftG = new THREE.IcosahedronGeometry(4, 0); tuftG.scale(1, .55, 1); tuftG.translate(0, 1.2, 0);
    const tuft = new THREE.InstancedMesh(tuftG, Arcade3D.std('#4c8f3a', { roughness: 1, flatShading: true }), tr.tufts.length * 3);
    let tn = 0; const qy = new THREE.Quaternion();
    tr.tufts.forEach(([x0, y0, r]) => { for (let k = 0; k < 3; k++) { v.set(x0 + (k - 1) * 3.5, -.3, y0 + Math.sin(k * 2 + r * 9) * 3); qy.setFromAxisAngle(new THREE.Vector3(Math.sin(k + r), 0, Math.cos(k * 3 + r)).normalize(), .25); sc.set(.7 + r * .5, .7 + r * .6 + k * .15, .7 + r * .5); m4.compose(v, qy, sc); tuft.setMatrixAt(tn++, m4); } });
    tuft.count = tn; tuft.receiveShadow = true; scene.add(tuft); sc.set(1, 1, 1);
    /* árvores (folhosas e pinheiros) para lá da barreira: tronco + copa em camadas, instanciadas */
    const trunkG = new THREE.CylinderGeometry(2.2, 3.2, 26, 7); trunkG.translate(0, 13, 0);
    const crownG = new THREE.IcosahedronGeometry(16, 1); crownG.translate(0, 40, 0);
    const crown2G = new THREE.IcosahedronGeometry(11, 1); crown2G.translate(7, 50, 4);
    const pineG = new THREE.ConeGeometry(15, 34, 8); pineG.translate(0, 34, 0);
    const pine2G = new THREE.ConeGeometry(11, 26, 8); pine2G.translate(0, 52, 0);
    const nT = tr.trees.length;
    const mkI = (geo, col, n) => { const m = new THREE.InstancedMesh(geo, Arcade3D.std(col, { roughness: .95, flatShading: true }), n); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
    const trunks = mkI(trunkG, '#6b4a2e', nT), crowns = mkI(crownG, '#3f8f3a', nT), crowns2 = mkI(crown2G, '#58a84a', nT), pines = mkI(pineG, '#2f6b45', nT), pines2 = mkI(pine2G, '#3c8055', nT);
    let nd = 0, np = 0;
    tr.trees.forEach(([x0, y0, r]) => {
      const s = .75 + r * .7; qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * 6); sc.set(s, s, s); v.set(x0, -.5, y0); m4.compose(v, qy, sc);
      trunks.setMatrixAt(nd + np, m4);
      if (r < .55) { crowns.setMatrixAt(nd, m4); crowns2.setMatrixAt(nd, m4); nd++; } else { pines.setMatrixAt(np, m4); pines2.setMatrixAt(np, m4); np++; }
    });
    crowns.count = crowns2.count = nd; pines.count = pines2.count = np; trunks.count = nd + np;
    /* colinas ao longe (anel) */
    const hills = new THREE.Mesh(new THREE.CylinderGeometry(1900, 1900, 260, 64, 1, true), new THREE.MeshBasicMaterial({ map: (() => { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128; const y = cv.getContext('2d'); y.fillStyle = '#7fae86'; y.beginPath(); y.moveTo(0, 128); for (let X = 0; X <= 1024; X += 8) y.lineTo(X, 60 - Math.sin(X * .012) * 26 - Math.sin(X * .037 + 1) * 14); y.lineTo(1024, 128); y.fill(); y.fillStyle = '#5f9a6c'; y.beginPath(); y.moveTo(0, 128); for (let X = 0; X <= 1024; X += 8) y.lineTo(X, 92 - Math.sin(X * .02 + 2) * 16 - Math.sin(X * .05) * 8); y.lineTo(1024, 128); y.fill(); const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.repeat.x = 3; t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    hills.position.set(640, 90, 480); scene.add(hills);
    /* bancada com público junto à reta da meta */
    {
      const pS = tr.poly[Math.floor(tr.N * .06)], aS = tr.tan[Math.floor(tr.N * .06)], nx = -Math.sin(aS), nz = Math.cos(aS);
      /* lado da pista onde a bancada não toca noutro troço (no oito e na serpente a pista volta perto) */
      const clear = sdd => { const cx = pS[0] + nx * sdd * (TW / 2 + BAR + 110), cz = pS[1] + nz * sdd * (TW / 2 + BAR + 110); return tr.poly.every(p => Math.hypot(p[0] - cx, p[1] - cz) > TW / 2 + BAR + 150); };
      const sd = clear(-1) ? -1 : clear(1) ? 1 : 0;
      if (sd) {
      const gs = new THREE.Group(); gs.position.set(pS[0] + nx * sd * (TW / 2 + BAR + 70), 0, pS[1] + nz * sd * (TW / 2 + BAR + 70)); gs.rotation.y = -aS + (sd < 0 ? Math.PI : 0);
      const stepM = Arcade3D.std('#cbd5e1', { roughness: .7 }), roofM = Arcade3D.std('#dc2626', { roughness: .5 });
      for (let k = 0; k < 5; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(260, 6, 14), stepM); st.position.set(0, 3 + k * 6, k * 14); st.castShadow = st.receiveShadow = true; gs.add(st); }
      const back = new THREE.Mesh(new THREE.BoxGeometry(264, 60, 4), stepM); back.position.set(0, 30, 74); gs.add(back);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(270, 3, 86), roofM); roof.position.set(0, 64, 34); roof.rotation.x = -.08; roof.castShadow = true; gs.add(roof);
      [-125, 0, 125].forEach(px => { const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 64, 8), Arcade3D.std('#94a3b8', { metalness: .6, roughness: .3 })); pole.position.set(px, 32, -4); gs.add(pole); });
      const fanG = new THREE.CapsuleGeometry(2, 3, 3, 6), fans = new THREE.InstancedMesh(fanG, new THREE.MeshStandardMaterial({ roughness: .8 }), 5 * 40), FC = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#f8fafc', '#a855f7', '#f97316', '#111827'];
      let fn = 0; const cc2 = new THREE.Color();
      for (let k = 0; k < 5; k++) for (let i = 0; i < 40; i++) { if (Math.random() < .2) continue; v.set(-125 + i * 6.4 + Math.random() * 2, 9 + k * 6 + 3, k * 14 + 2); m4.makeTranslation(v.x, v.y, v.z); fans.setMatrixAt(fn, m4); fans.setColorAt(fn++, cc2.set(FC[(i * 7 + k * 3) % FC.length])); }
      fans.count = fn; gs.add(fans); G.fans = fans;
      scene.add(gs);
      }
    }
    /* partida/chegada: xadrez + pórtico */
    const p0 = tr.poly[0], a0 = tr.tan[0];
    const cc = document.createElement('canvas'); cc.width = 16; cc.height = 96; const cx2 = cc.getContext('2d');
    for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { cx2.fillStyle = (i + j) % 2 ? '#111' : '#fff'; cx2.fillRect(j * 8, i * 8, 8, 8); }
    const ct = new THREE.CanvasTexture(cc); ct.magFilter = THREE.NearestFilter;
    const start = new THREE.Mesh(new THREE.PlaneGeometry(16, TW), new THREE.MeshStandardMaterial({ map: ct, roughness: .7 }));
    start.rotation.x = -Math.PI / 2; start.rotation.z = -a0; start.position.set(p0[0], .5, p0[1]); start.receiveShadow = true; scene.add(start);
    const gantry = new THREE.Group(); gantry.position.set(p0[0], 0, p0[1]); gantry.rotation.y = -a0;
    [-1, 1].forEach(sd => { const post = new THREE.Mesh(new THREE.BoxGeometry(4, 46, 4), Arcade3D.std('#e5e7eb', { metalness: .5, roughness: .3 })); post.position.set(0, 23, sd * (TW / 2 + 12)); post.castShadow = true; gantry.add(post); });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6, 8, TW + 30), new THREE.MeshStandardMaterial({ map: ct, roughness: .6 })); beam.position.y = 46; beam.castShadow = true; gantry.add(beam);
    scene.add(gantry);
    /* carros, marcas, fumo */
    const car = Arcade3D.car({ type: 'sport', color: '#dc2626', len: 44, rim: '#d4d4d8' }), ghost = carModel3('#bae6fd', true);
    scene.add(car, ghost);
    const skids = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 4), new THREE.MeshBasicMaterial({ color: '#1c1c22', transparent: true, opacity: .3, depthWrite: false }), 720);
    skids.rotation.x = 0; skids.frustumCulled = false; skids.count = 0; scene.add(skids);
    G.r3 = { renderer, scene, sun, cam, car, ghost, skids, gt, ct, pool: Arcade3D.pool(scene), yaw: G.a, skN: -1, m4, v, sc, q: new THREE.Quaternion(), lean: 0 };
    api.stage.style.background = '#9fd3f5';
  }

  function draw3D(G, ctx, W, H, api) {
    const R = G.r3, { m4, v, sc } = R;
    const asp = Arcade3D.fit(api.stage, R.cam), port = asp < .8 ? 1.45 : 1;
    /* carro */
    const c = R.car, spd = Math.hypot(G.vx, G.vy);
    c.position.set(G.x, 0, G.y); c.rotation.y = -G.a;
    const fx = Math.cos(G.a), fy = Math.sin(G.a), vL = -fy * G.vx + fx * G.vy;
    R.lean = U.lerp(R.lean, U.clamp(vL / 400, -.12, .12), .15);
    c.userData.chassis.rotation.x = R.lean;                       /* inclina para fora na derrapagem */
    c.userData.front.forEach(w => { w.rotation.y = -G.steerVis * .45; });
    const dtv = Math.min(.05, api.t - (R.lt || api.t)); R.lt = api.t;
    const vF = fx * G.vx + fy * G.vy, rr = c.userData.r * 44;
    c.userData.wheels.forEach(w => { w.rotation.z -= vF * dtv / rr; });
    /* público a saltar quando passas a derrapar */
    if (G.fans) G.fans.position.y = G.drift > .3 ? Math.abs(Math.sin(api.t * 14)) * 1.6 : 0;
    /* fantasma */
    const gp = G.ghost && G.started && !G.done ? ghostAt(G) : null;
    R.ghost.visible = !!gp; if (gp) { R.ghost.position.set(gp.x, 0, gp.y); R.ghost.rotation.y = -gp.a; }
    /* marcas de pneus (só se atualizam quando mudam) */
    if (R.skN !== G.skids.length || G.skids.length === 720) {
      R.skN = G.skids.length;
      G.skids.forEach((s2, i) => {
        const dx = s2[2] - s2[0], dz = s2[3] - s2[1], L = Math.hypot(dx, dz) || 1;
        v.set((s2[0] + s2[2]) / 2, .5, (s2[1] + s2[3]) / 2);
        R.q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -Math.atan2(dz, dx) + Math.PI / 2, 'XYZ'));
        sc.set(4, L + 1, 1); m4.compose(v, R.q, sc); R.skids.setMatrixAt(i, m4);
      });
      R.skids.count = G.skids.length; R.skids.instanceMatrix.needsUpdate = true;
    }
    const P = R.pool; P.begin();
    G.smoke.forEach(p => { const s2 = P.get(p.dirt ? 'dirt' : 'smoke', () => new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: p.dirt ? '#8a6a3c' : '#f1f5f9', transparent: true, depthWrite: false }))); s2.position.set(p.x, 6 + (1 - p.life) * 10, p.y); s2.scale.set(p.r * 2.4, p.r * 2.4, 1); s2.material.opacity = p.life * (p.dirt ? .45 : .6); });
    P.end();
    /* câmara de perseguição: atrás do carro, suaviza a rotação (vê-se a derrapagem) */
    R.yaw += U.angDiff(G.a, R.yaw) * Math.min(1, .06 + spd / 9000);
    const back = (118 + spd * .06) * port, up = (62 + spd * .02) * port, [shx, shy] = api.shakeXY;
    const cx = G.x - Math.cos(R.yaw) * back, cz = G.y - Math.sin(R.yaw) * back;
    R.cam.position.set(cx + shx * .3, up + shy * .3, cz);
    R.cam.lookAt(G.x + Math.cos(R.yaw) * 70, 8, G.y + Math.sin(R.yaw) * 70);
    R.cam.fov = 56 + Math.min(10, spd / 50); R.cam.updateProjectionMatrix();
    Arcade3D.sunAt(R.sun, G.x, 0, G.y, 220, [-.5, 1, .35]);
    R.renderer.render(R.scene, R.cam);
    hud2D(G, ctx, W, H);
  }

  function destroy(G) {
    const R = G.r3; if (!R) return;
    R.gt.dispose(); R.ct.dispose();
    Arcade3D.disposeOwn(R.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    draw2D(G, ctx, W, H, api);
  }
  function draw2D(G, ctx, W, H, api) {
    const tr = G.tr;
    ctx.fillStyle = '#2f6b2f'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    /* em ecrãs ao alto (telemóvel) aproxima a câmara: o carro não fica minúsculo */
    const z = (H > W * 1.2 ? 1.3 : 1) * (1 - Math.min(.18, Math.hypot(G.vx, G.vy) / 3000));
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-G.camX, -G.camY);
    /* relva com tufos */
    ctx.fillStyle = 'rgba(20,60,20,.35)';
    tr.tufts.forEach(([x, y, r]) => { ctx.beginPath(); ctx.ellipse(x, y, 10 + r * 16, 5 + r * 6, r * 3, 0, 6.3); ctx.fill(); });
    /* barreira de pneus (contorno escuro) + escapatória */
    strokePoly(ctx, tr.poly, TW + BAR * 2 + 22, '#1f2937');
    strokePoly(ctx, tr.poly, TW + BAR * 2 + 22, '#e5e7eb', [10, 14]);
    strokePoly(ctx, tr.poly, TW + BAR * 2, '#3b7a36');
    /* zebras + asfalto */
    strokePoly(ctx, tr.poly, TW + 16, '#f8fafc');
    strokePoly(ctx, tr.poly, TW + 16, '#dc2626', [22, 22]);
    strokePoly(ctx, tr.poly, TW, '#3d414a');
    strokePoly(ctx, tr.poly, 2, 'rgba(255,255,255,.35)', [26, 30]);
    /* partida/chegada */
    const p0 = tr.poly[0], a0 = tr.tan[0];
    ctx.save(); ctx.translate(p0[0], p0[1]); ctx.rotate(a0);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(-8 + j * 8, -TW / 2 + i * TW / 12, 8, TW / 12); }
    ctx.restore();
    /* marcas de pneus */
    ctx.strokeStyle = 'rgba(15,15,20,.42)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); G.skids.forEach(s => { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }); ctx.stroke();
    G.smoke.forEach(p => { ctx.fillStyle = p.dirt ? `rgba(120,86,40,${p.life * .5})` : `rgba(230,230,235,${p.life * .45})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); });
    if (G.ghost && G.started && !G.done) { const gp = ghostAt(G); if (gp) car(ctx, gp, true); }
    car(ctx, G);
    ctx.restore();
    hud2D(G, ctx, W, H);
  }

  /* mini-mapa, zonas de toque, contagem e avisos (iguais em 2D e 3D) */
  function hud2D(G, ctx, W, H) {
    const tr = G.tr;
    /* mini-mapa */
    const [bx0, by0, bx1, by1] = tr.box, mw = 92, sc = mw / (bx1 - bx0), mh = (by1 - by0) * sc;
    ctx.save(); ctx.translate(W - mw - 12, H - mh - 70);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; U.rr(ctx, -6, -6, mw + 12, mh + 12, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); tr.poly.forEach((p, i) => { const x = (p[0] - bx0) * sc, y = (p[1] - by0) * sc; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc((G.x - bx0) * sc, (G.y - by0) * sc, 4, 0, 6.3); ctx.fill();
    ctx.restore();

    /* zonas de condução */
    [['‹', 0, -1], ['›', W / 2, 1]].forEach(([ch, x0, dir]) => {
      const on = G.steer === dir;
      ctx.fillStyle = on ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.04)';
      U.rr(ctx, x0 + 8, H - 60, W / 2 - 16, 50, 14); ctx.fill();
      ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,.4)'; ctx.font = '800 28px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, x0 + W / 4, H - 36);
    });
    if (G.count > 0 || (G.started && G.t < .7)) {
      /* semáforo de partida: 3 luzes vermelhas acendem uma a uma; ao "Vai!" ficam todas verdes */
      const lit = G.count > 0 ? Math.min(3, Math.max(0, 4 - Math.ceil(G.count))) : 3, go = G.count <= 0;
      const bw = 168, bh = 58, bx = W / 2 - bw / 2, by = Math.min(H * .2, 74);
      ctx.save();
      ctx.globalAlpha = go ? Math.max(0, 1 - G.t / .7) : 1;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; U.rr(ctx, bx + 3, by + 5, bw, bh, 14); ctx.fill();
      const pg = ctx.createLinearGradient(0, by, 0, by + bh); pg.addColorStop(0, '#2b2f38'); pg.addColorStop(1, '#111318');
      ctx.fillStyle = pg; U.rr(ctx, bx, by, bw, bh, 14); ctx.fill(); ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const cx = bx + 34 + i * 50, cy = by + bh / 2, on = go || i < lit, col = go ? '#22c55e' : '#ef4444';
        ctx.fillStyle = '#0b0c10'; ctx.beginPath(); ctx.arc(cx, cy, 19, 0, 6.3); ctx.fill();
        if (on) { const g = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, 26); g.addColorStop(0, '#fff'); g.addColorStop(.25, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 6.3); ctx.fill(); }
        else { ctx.fillStyle = '#3a1414'; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, 6.3); ctx.fill(); }
      }
      ctx.restore();
    }
    if (G.wrong > .8) { ctx.fillStyle = '#fca5a5'; ctx.font = '800 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⟲ Sentido contrário!', W / 2, H * .3); }
    if (G.off && G.started && !G.done) { ctx.fillStyle = 'rgba(253,224,71,.85)'; ctx.font = '700 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Fora de pista', W / 2, H * .3 + 26); }
  }

  return ArcadeKit.create({
    id: 'drift', title: 'Drift', icon: '🚗',
    accent: '#ef4444', accent2: '#fbbf24', bg: '#2f6b2f', aspect: 'wide', transparent: true, destroy,
    tagline: 'O carro acelera sozinho; tu só viras. Curva depressa e ele derrapa — domina isso.',
    view: { w: 600 }, lowerIsBetter: true, bestLabel: 'Melhor tempo',
    scoreFmt: v => U.fmtTime(v),
    modes: TRACKS.map(t => ({ id: t.id, icon: t.icon, name: t.name, desc: t.desc + ' 3 voltas.' })),
    how: [
      'Mantém premida a <b>metade esquerda</b> do ecrã para virar à esquerda e a <b>direita</b> para virar à direita (rato ou dedo; também ← →).',
      'Virar a alta velocidade faz o carro <b>derrapar</b> — larga a tempo para endireitar. Derrapagens longas dão pontos.',
      'A relva abranda-te e as barreiras fazem-te ressaltar. Faz 3 voltas o mais depressa possível: ⭐⭐⭐ abaixo do tempo-alvo.',
      'O carro <b>fantasma</b> 👻 repete a tua melhor corrida nessa pista — tenta ganhar-lhe.',
    ],
    controls: ['🖱️ Premir esq./dir.', '👆 Manter o dedo esq./dir.', '⌨️ ← →'],
    ready: { title: 'Toca para a grelha', hint: 'Mantém premido à esquerda ou à direita para virar.' },
    setup, update, draw,
    /* esquerda e direita em separado: largar uma com a outra ainda carregada continua a virar */
    key: (G, e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { G.kl = 1; G.keys = -1; return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { G.kr = 1; G.keys = 1; return true; }
    },
    keyup: (G, e) => {
      if (/^(ArrowLeft|a|A)$/.test(e.key)) { G.kl = 0; G.keys = G.kr ? 1 : 0; }
      if (/^(ArrowRight|d|D)$/.test(e.key)) { G.kr = 0; G.keys = G.kl ? -1 : 0; }
    },
    hud: G => [['Volta', Math.min(G.lap + 1, LAPS) + '/' + LAPS], ['Tempo', U.fmtTime(G.t)], ['Drift', G.driftPts + Math.round(G.driftCur)]],
    achievements: [
      { id: 'dr.fin',   name: 'Bandeira Xadrez', icon: '🏁', desc: 'Termina uma corrida no Drift.', test: c => c.result.won === true },
      { id: 'dr.3star', name: 'Rei da Derrapagem', icon: '🌟', desc: 'Faz ⭐⭐⭐ numa pista do Drift.', test: c => ((c.result.meta || {}).stars || 0) >= 3 },
      { id: 'dr.500',   name: 'Fumo Branco', icon: '💨', desc: '500 pontos de drift numa só corrida.', test: c => ((c.result.meta || {}).drift || 0) >= 500 },
    ],
  });
})();
