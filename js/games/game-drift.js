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
    def.tufts = Array.from({ length: 260 }, () => [U.rand(def.box[0], def.box[2]), U.rand(def.box[1], def.box[3]), Math.random()]);
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
    const n = poly.length, pos = [], col = [], idx = [], c = new THREE.Color();
    for (let i = 0; i <= n; i++) {
      const k = i % n, p = poly[k], a = tan[k], nx = -Math.sin(a), nz = Math.cos(a);
      pos.push(p[0] + nx * o0, 0, p[1] + nz * o0, p[0] + nx * o1, 0, p[1] + nz * o1);
      c.set(colorAt(i)); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
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
    scene.background = new THREE.Color('#9fd3f5');
    scene.fog = new THREE.Fog('#9fd3f5', 700, 1600);
    const cam = new THREE.PerspectiveCamera(58, 1, 2, 2400);
    const tr = G.tr;
    /* relva */
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#3d7a33'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '150,210,110' : '20,60,20'},.16)`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 3); }
    const gt = new THREE.CanvasTexture(c); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(60, 60); gt.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(640, -.6, 480); ground.receiveShadow = true; scene.add(ground);
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide });
    const addR = (o0, o1, y, colAt, mat) => { const m = new THREE.Mesh(ribbon(tr.poly, tr.tan, o0, o1, colAt), mat || vc); m.position.y = y; m.receiveShadow = true; scene.add(m); return m; };
    addR(-(TW / 2 + BAR), TW / 2 + BAR, -.3, () => '#4a8a3f');                                  /* escapatória */
    [-1, 1].forEach(sd => addR(sd * TW / 2, sd * (TW / 2 + 9), .3, i => (Math.floor(i / 2) % 2 ? '#dc2626' : '#f8fafc')));   /* zebras */
    addR(-TW / 2, TW / 2, .15, i => (i % 6 < 3 ? '#41454f' : '#3d414a'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: .05 }));
    addR(-1.2, 1.2, .35, i => (i % 5 < 2 ? '#e5e7eb' : '#3d414a'));                               /* linha central tracejada */
    /* barreira de pneus (cilindros empilhados) */
    const tires = new THREE.InstancedMesh(new THREE.TorusGeometry(4.2, 2.4, 8, 14), new THREE.MeshStandardMaterial({ roughness: .9 }), tr.poly.length * 4);
    tires.castShadow = true; tires.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    let n = 0;
    tr.poly.forEach((p, i) => { const a = tr.tan[i], nx = -Math.sin(a), nz = Math.cos(a); [-1, 1].forEach(sd => { for (let h = 0; h < 2; h++) { v.set(p[0] + nx * sd * (TW / 2 + BAR + 10), 2.4 + h * 4.8, p[1] + nz * sd * (TW / 2 + BAR + 10)); m4.compose(v, q, sc); tires.setMatrixAt(n, m4); col.set((i + h) % 2 ? '#1f2937' : '#e5e7eb'); tires.setColorAt(n++, col); } }); });
    tires.count = n; scene.add(tires);
    /* tufos de relva */
    const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(6, 14, 5), Arcade3D.std('#2f6b25', { roughness: 1, flatShading: true }), tr.tufts.length);
    tr.tufts.forEach(([x0, y0, r], i) => { v.set(x0, 5, y0); sc.set(1 + r, .6 + r * .8, 1 + r); m4.compose(v, new THREE.Quaternion(), sc); tuft.setMatrixAt(i, m4); });
    scene.add(tuft); sc.set(1, 1, 1);
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
    const car = carModel3('#dc2626', false), ghost = carModel3('#bae6fd', true);
    scene.add(car, ghost);
    const skids = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 4), new THREE.MeshBasicMaterial({ color: '#111114', transparent: true, opacity: .45, depthWrite: false }), 720);
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
    if (G.count > 0) {
      const s = Math.ceil(G.count), k = G.count - Math.floor(G.count);
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(70 + k * 30)}px 'Space Grotesk', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = .4 + k * .6; ctx.fillText(s, W / 2, H * .38); ctx.globalAlpha = 1;
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
