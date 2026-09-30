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

  function draw(G, ctx, W, H, api) {
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
    accent: '#ef4444', accent2: '#fbbf24', bg: '#2f6b2f', aspect: 'wide',
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
