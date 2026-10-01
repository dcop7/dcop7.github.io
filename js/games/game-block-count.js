/* ══════════════════════════════════════════════════════════════════
   Conta Blocos — uma série de blocos atravessa o palco 3D da esquerda
   para a direita (a deslizar, aos saltos, a flutuar, em duas faixas de
   profundidade, às vezes vários de uma vez). Conta-os. Depois escolhe o
   número certo.
   A pergunta evolui: todos os blocos → só os cubos (há esferas e
   cilindros a enganar) → só os de uma cor → só os grandes. No Difícil a
   pergunta só aparece no FIM: tens de contar tudo por categorias.
══════════════════════════════════════════════════════════════════ */
const BlockCountGame = (function () {
  'use strict';
  const U = ArcadeKit.U, M = MemoKit;
  const COLS = [['#ef4444', 'vermelhos'], ['#3b82f6', 'azuis'], ['#22c55e', 'verdes'], ['#facc15', 'amarelos']];
  const DIFF = {
    easy:   { cross: 3.3, gap: .78, opts: 4, spread: 2, late: false },
    medium: { cross: 2.7, gap: .6,  opts: 4, spread: 1, late: false },
    hard:   { cross: 2.15, gap: .48, opts: 6, spread: 1, late: true },
  };

  /* ── ondas ──────────────────────────────────────────────────── */
  function qType(G) {
    const L = G.level;
    if (L <= 2) return 'all';
    const pool = ['cubes'];
    if (L >= 4) pool.push('color', 'color');
    if (L >= 7) pool.push('big');
    return U.pick(pool);
  }

  function makeWave(G) {
    const c = G.cfg, L = G.level, q = qType(G);
    const T = Math.min(18, 3 + Math.floor(L * .8) + U.randi(0, 1));
    const D = q === 'all' ? 0 : Math.round(T * U.rand(.45, .8));
    const colTarget = U.randi(0, COLS.length - 1);
    const items = [];
    const motions = L <= 1 ? ['slide'] : L <= 3 ? ['slide', 'arc'] : ['slide', 'arc', 'float', 'bounce'];
    const mk = (target) => {
      const it = { kind: 'cube', col: U.randi(0, COLS.length - 1), big: false, target };
      if (q === 'all') it.col = U.randi(0, COLS.length - 1);
      if (q === 'cubes') { if (!target) it.kind = U.pick(['sphere', 'cyl']); }
      if (q === 'color') { if (target) it.col = colTarget; else { if (Math.random() < .3) { it.kind = U.pick(['sphere', 'cyl']); it.col = colTarget; } else { do it.col = U.randi(0, COLS.length - 1); while (it.col === colTarget); } } }
      if (q === 'big') { it.big = !!target; if (!target && Math.random() < .25) it.kind = U.pick(['sphere', 'cyl']); }
      it.motion = U.pick(motions);
      it.z = L >= 3 && Math.random() < .4 ? -1.6 : 0;
      it.cross = c.cross * Math.max(.62, 1 - L * .018) * U.rand(.85, 1.2);
      it.h = it.motion === 'float' ? U.rand(1.2, 2.6) : it.motion === 'arc' ? U.rand(1.8, 3.2) : 0;
      it.spin = U.rand(-3, 3); it.s = it.big ? 1.2 : .78;
      return it;
    };
    for (let i = 0; i < T; i++) items.push(mk(true));
    for (let i = 0; i < D; i++) items.push(mk(false));
    M.shuffle(items);
    /* tempos de entrada: intervalos irregulares e, mais à frente, rajadas */
    let t = .3;
    items.forEach((it, i) => {
      it.t0 = t;
      const burst = L >= 5 && Math.random() < .22;
      t += burst ? U.rand(.05, .15) : c.gap * Math.max(.55, 1 - L * .025) * U.rand(.6, 1.45);
    });
    G.wave = items; G.q = q; G.qCol = colTarget;
    G.answer = items.filter(i => i.target).length;
    G.waveEnd = Math.max(...items.map(i => i.t0 + i.cross)) + .25;
    /* opções: números vizinhos da resposta */
    const n = c.opts, lo = Math.max(0, G.answer - U.randi(0, n - 1) * c.spread);
    const opts = []; for (let i = 0; i < n; i++) opts.push(lo + i * c.spread);
    if (!opts.includes(G.answer)) opts[U.randi(0, n - 1)] = G.answer;
    G.opts = [...new Set(opts)].sort((a, b) => a - b);
  }

  function qText(G) {
    if (G.q === 'all') return 'Quantos blocos?';
    if (G.q === 'cubes') return 'Quantos CUBOS? (esferas e cilindros não contam)';
    if (G.q === 'color') return `Quantos cubos ${COLS[G.qCol][1].toUpperCase()}?`;
    return 'Quantos cubos GRANDES?';
  }
  const qShort = G => (G.q === 'all' ? 'CONTA OS BLOCOS' : G.q === 'cubes' ? 'CONTA SÓ OS CUBOS' : G.q === 'color' ? 'CONTA OS ' + COLS[G.qCol][1].toUpperCase() : 'CONTA OS GRANDES');

  /* ── 3D ─────────────────────────────────────────────────────── */
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun } = Arcade3D.stdScene({ sky: '#e8f0ff', ground: '#30344a', hemi: 1.15, sunI: 2.1, normalBias: .03 });
    const cam = new THREE.PerspectiveCamera(32, 1, .1, 200);
    /* palco: chão com grelha, parede do fundo com horizonte luminoso */
    const gridTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      x.fillStyle = '#141a33'; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = 'rgba(96,165,250,.35)'; x.lineWidth = 2; x.strokeRect(0, 0, 256, 256);
      x.strokeStyle = 'rgba(96,165,250,.12)'; x.lineWidth = 1; x.beginPath(); x.moveTo(128, 0); x.lineTo(128, 256); x.moveTo(0, 128); x.lineTo(256, 128); x.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(20, 8); t.anisotropy = 4; return t;
    })();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshStandardMaterial({ map: gridTex, roughness: .32, metalness: .35 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 3.4); floor.receiveShadow = true; scene.add(floor);
    const wallTex = (() => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#05060d'); g.addColorStop(.7, '#1b2452'); g.addColorStop(.97, '#3b4fa8'); g.addColorStop(1, '#93c5fd');
      x.fillStyle = g; x.fillRect(0, 0, 4, 256);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 14), new THREE.MeshBasicMaterial({ map: wallTex, toneMapped: false }));
    wall.position.set(0, 7, -4.6); scene.add(wall);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(40, .05, .08), Arcade3D.glowMat('#60a5fa'));
    strip.position.set(0, .01, 1.75); scene.add(strip);
    const strip2 = strip.clone(); strip2.position.z = -4.55; strip2.material = Arcade3D.glowMat('#a78bfa'); scene.add(strip2);
    /* "portais" de entrada e saída */
    [-1, 1].forEach(s => {
      const p = new THREE.Mesh(new THREE.TorusGeometry(2.1, .09, 12, 48, Math.PI), Arcade3D.glowMat(s < 0 ? '#22d3ee' : '#f472b6'));
      p.rotation.y = Math.PI / 2; p.position.set(0, 0, -.8); p.userData.side = s; scene.add(p);
      (G.portals = G.portals || []).push(p);
    });
    const geo = { cube: Arcade3D.roundBox(.14), sphere: new THREE.SphereGeometry(.5, 28, 20), cyl: new THREE.CylinderGeometry(.45, .45, 1, 28) };
    G.r3 = { renderer, scene, cam, sun, geo, meshes: new Map(), hw: 5 };
  }

  function meshFor(G, it) {
    const R3 = G.r3; let m = R3.meshes.get(it);
    if (!m) {
      const col = COLS[it.col][0];
      m = new THREE.Mesh(R3.geo[it.kind], Arcade3D.std(col, { roughness: .28, metalness: .08, envMapIntensity: 1.2 }));
      m.castShadow = true; m.receiveShadow = true;
      m.scale.setScalar(it.s); R3.scene.add(m); R3.meshes.set(it, m);
    }
    return m;
  }

  /* posição de um item no instante tt (lógica partilhada 3D/2D) */
  function posOf(G, it, tt, hw) {
    const u = (tt - it.t0) / it.cross; if (u < 0 || u > 1) return null;
    const x = U.lerp(-hw - 1.2, hw + 1.2, u), r = it.s / 2;
    let y = r;
    if (it.motion === 'arc') y = r + Math.sin(u * Math.PI) * it.h;
    else if (it.motion === 'float') y = r + it.h + Math.sin(u * 12 + it.t0) * .15;
    else if (it.motion === 'bounce') y = r + Math.abs(Math.sin(u * Math.PI * 3)) * 1.3;
    return { x, y, z: it.z, u };
  }

  function draw3D(G, ctx, W, H, api) {
    const R3 = G.r3, cam = R3.cam;
    const aspect = Arcade3D.fit(api.stage, cam);
    if (!R3.bg) { R3.bg = 1; api.stage.style.background = 'radial-gradient(130% 80% at 50% 45%, #1e2a5a 0%, #0a0d1f 60%, #05060d 100%)'; }
    /* largura visível fixa (o tempo de travessia é igual em qualquer ecrã) */
    const hw = R3.hw = 3 + 2 * Math.min(1, aspect);
    const fov = cam.fov * Math.PI / 180, dist = hw / (Math.tan(fov / 2) * aspect), pitch = .36;
    cam.position.set(0, 1.25 + Math.sin(pitch) * dist, -.6 + Math.cos(pitch) * dist); cam.lookAt(0, 1.25, -.6);
    Arcade3D.sunAt(R3.sun, 0, 0, -.6, hw + 2, [-.4, 1, .6]);
    G.portals && G.portals.forEach(p => { p.position.x = p.userData.side * (hw + .9); });
    const tt = G.phase === 'wave' ? G.pt : -1;
    const live = new Set();
    if (tt >= 0) G.wave.forEach(it => {
      const p = posOf(G, it, tt, hw); if (!p) return;
      live.add(it);
      const m = meshFor(G, it);
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(it.motion === 'slide' ? 0 : p.u * it.spin * 2, p.u * it.spin, it.motion === 'slide' ? 0 : p.u * it.spin);
      if (it.motion === 'slide') m.rotation.z = 0;
    });
    R3.meshes.forEach((m, it) => { if (!live.has(it)) { R3.scene.remove(m); R3.meshes.delete(it); } });
    R3.renderer.render(R3.scene, cam);
  }

  function draw2DScene(G, ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1e2a5a'); g.addColorStop(1, '#05060d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const fy = H * .58, k = W / 12;
    ctx.fillStyle = '#1c2136'; ctx.fillRect(0, fy, W, 40);
    if (G.phase !== 'wave') return;
    G.wave.forEach(it => {
      const p = posOf(G, it, G.pt, 5); if (!p) return;
      const x = W / 2 + p.x * k, y = fy - p.y * k * (it.z ? .8 : 1) - (it.z ? 18 : 0), s = it.s * k * (it.z ? .8 : 1);
      ctx.fillStyle = COLS[it.col][0];
      if (it.kind === 'cube') { ctx.save(); ctx.translate(x, y); ctx.rotate(p.u * it.spin); U.rr(ctx, -s / 2, -s / 2, s, s, s * .15); ctx.fill(); ctx.restore(); }
      else if (it.kind === 'sphere') { ctx.beginPath(); ctx.arc(x, y, s / 2, 0, 6.3); ctx.fill(); }
      else { ctx.fillRect(x - s * .45, y - s / 2, s * .9, s); }
    });
  }

  /* ── fluxo ──────────────────────────────────────────────────── */
  function setup(api, o) {
    const G = Object.assign(M.base(api, o), { cfg: DIFF[o.diff] || DIFF.medium, wave: [], opts: [], typed: '', sel: -1 });
    makeWave(G); G.phase = 'intro'; G.pt = 0;
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build3D(G, api); } catch (e) { console.warn('[conta-blocos] 3D falhou', e); } }).catch(() => {});
    return G;
  }

  function update(G, dt, api) {
    G.t += dt; G.pt += dt; M.fxStep(G, dt);
    if (G.phase === 'intro' && G.pt > (G.cfg.late ? 1.2 : 2.1)) { G.phase = 'wave'; G.pt = 0; G.seen = 0; }
    else if (G.phase === 'wave') {
      /* um "tic" discreto quando cada objeto entra (no Fácil, só os que contam) */
      G.wave.forEach(it => { if (!it.ticked && G.pt >= it.t0) { it.ticked = true; if (G.cfg.opts === 4 && G.cfg.spread === 2 ? it.target : true) M.tick(api); } });
      if (G.pt > G.waveEnd) { G.phase = 'ask'; G.pt = 0; G.typed = ''; }
    }
    else if (G.phase === 'ok' && G.pt > 1.2) { G.level++; makeWave(G); G.phase = 'intro'; G.pt = 0; }
    else if (G.phase === 'fail' && G.pt > 2) {
      if (G.dead) { G.phase = 'end'; api.over({ score: G.level - 1, won: false, icon: '🧮', title: 'Contas trocadas',
        stats: [['Nível', G.level], ['Última resposta', G.answer], ['Acertos seguidos', G.best || 0]], meta: { level: G.level - 1 } }); }
      else { makeWave(G); G.phase = 'intro'; G.pt = 0; }
    }
  }

  function answer(G, v, api) {
    if (G.phase !== 'ask') return;
    G.picked = v;
    if (v === G.answer) {
      G.phase = 'ok'; G.pt = 0; G.streak++; G.best = Math.max(G.best || 0, G.streak); G.score += G.answer * 10;
      M.good(api); api.burst(api.W / 2, api.H * .5, 26, { color: '#4ade80', speed: 220, life: .8, gravity: 0 });
    } else {
      G.phase = 'fail'; G.pt = 0; M.bad(api); G.dead = M.miss(G, api);
    }
  }

  function optRects(G, W, H) {
    const n = G.opts.length, cols = n > 4 ? 3 : n, rows = Math.ceil(n / cols);
    const bw = Math.min(88, (W - 40 - (cols - 1) * 12) / cols), bh = 64;
    const tw = cols * bw + (cols - 1) * 12, y0 = H - 40 - rows * bh - (rows - 1) * 12;
    return G.opts.map((v, i) => ({ v, x: (W - tw) / 2 + (i % cols) * (bw + 12), y: y0 + Math.floor(i / cols) * (bh + 12), w: bw, h: bh }));
  }

  function draw(G, ctx, W, H, api) {
    if (G.r3) draw3D(G, ctx, W, H, api); else draw2DScene(G, ctx, W, H);
    const showQ = !G.cfg.late || G.phase === 'ask' || G.phase === 'ok' || G.phase === 'fail' || G.phase === 'end';
    if (G.phase === 'intro') {
      M.pill(ctx, W, 64, 'NÍVEL ' + G.level, G.pt / (G.cfg.late ? 1.2 : 2.1), '#60a5fa', G.t);
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = "800 22px 'Space Grotesk', system-ui";
      const txt = G.cfg.late ? 'Conta tudo — a pergunta vem no fim' : qText(G);
      wrap(ctx, txt, W / 2, H * .26, W - 50, 28);
      if (showQ && G.q === 'color') { M.gem(ctx, 'square', W / 2, H * .26 + 56, 16, COLS[G.qCol][0]); }
      ctx.restore();
    } else if (G.phase === 'wave') {
      M.pill(ctx, W, 64, G.cfg.late ? 'CONTA TUDO' : qShort(G), null, G.q === 'color' && showQ ? COLS[G.qCol][0] : '#60a5fa', G.t);
    } else {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = "800 21px 'Space Grotesk', system-ui";
      wrap(ctx, qText(G), W / 2, 118, W - 50, 27);
      ctx.restore();
      const rs = optRects(G, W, H);
      rs.forEach(r => {
        const right = (G.phase === 'ok' || G.phase === 'fail' || G.phase === 'end') && r.v === G.answer;
        const wrong = (G.phase === 'fail' || G.phase === 'end') && r.v === G.picked;
        M.tile(ctx, r.x, r.y, r.w, r.h, { base: '#1d2550', lit: right ? 1 : wrong ? .9 : G.hover === r.v ? .25 : 0, col: right ? '#4ade80' : wrong ? '#f43f5e' : '#60a5fa', r: 16 });
        ctx.fillStyle = '#fff'; ctx.font = "800 28px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(r.v, r.x + r.w / 2, r.y + r.h / 2);
      });
      ctx.textBaseline = 'alphabetic';
      if (G.typed) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = "700 14px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.fillText('Escreveste: ' + G.typed + ' (Enter)', W / 2, rs[0].y - 16); }
      if (G.phase === 'ask') {}
      else if (G.phase === 'ok') M.pill(ctx, W, 64, 'CERTO! ERAM ' + G.answer, 1, '#4ade80', G.t);
      else M.pill(ctx, W, 64, G.dead ? 'SEM VIDAS · ERAM ' + G.answer : 'ERAM ' + G.answer, null, '#f43f5e', G.t);
    }
    M.fxDraw(G, ctx);
  }

  function wrap(ctx, text, x, y, maxW, lh) {
    const words = text.split(' '); let line = '', yy = y;
    words.forEach(w => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; });
    ctx.fillText(line, x, yy);
  }

  return ArcadeKit.create({
    id: 'block-count', title: 'Conta Blocos', icon: '🧮', accent: '#60a5fa', accent2: '#f472b6', bg: '#05060d', transparent: true,
    destroy: G => { if (G.r3) { Arcade3D.disposeOwn(G.r3.scene); Arcade3D.detach(); G.r3 = null; } },
    tagline: 'Blocos atravessam o palco a toda a velocidade. Conta-os — e não te deixes enganar.',
    view: { w: 420 }, modes: M.MODES(), bestLabel: 'Melhor nível',
    how: [
      'Lê a pergunta: no início contas todos os blocos; depois só os <b>cubos</b>, só os de uma <b>cor</b> ou só os <b>grandes</b>.',
      'Os objetos atravessam o palco da esquerda para a direita — a deslizar, aos saltos, a flutuar, às vezes vários de uma vez e uns à frente dos outros.',
      'No fim escolhe o número certo (ou escreve-o e carrega Enter). No <b>Difícil</b> a pergunta só aparece no fim!',
    ],
    controls: ['👆 Tocar no número', '⌨️ Escrever + Enter'],
    ready: { title: 'Toca para começar', hint: 'Conta em voz baixa — ajuda mesmo.' },
    setup, update, draw,
    idle: (G, dt) => { G.t += dt; },
    down: (G, x, y, api) => { if (G.phase !== 'ask') return; const r = optRects(G, api.W, api.H).find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h); if (r) answer(G, r.v, api); },
    move: (G, x, y, api) => { const r = G.phase === 'ask' ? optRects(G, api.W, api.H).find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) : null; G.hover = r ? r.v : null; },
    key: (G, e, api) => {
      if (G.phase !== 'ask') return;
      if (/^\d$/.test(e.key)) { G.typed = (G.typed + e.key).slice(-2); return true; }
      if (e.key === 'Backspace') { G.typed = G.typed.slice(0, -1); return true; }
      if (e.key === 'Enter' && G.typed) { answer(G, parseInt(G.typed, 10), api); G.typed = ''; return true; }
    },
    hud: (G, api) => [['Nível', G.level], ['Vidas', M.hearts(G)], ['Recorde', api.best != null ? api.best : '—']],
    achievements: [
      { id: 'bc.8', name: 'Contabilista', icon: '🧮', desc: 'Chega ao nível 8 no Conta Blocos.', test: c => (c.result.score || 0) >= 8 },
      { id: 'bc.15', name: 'Olho de Águia', icon: '🦅', desc: 'Chega ao nível 15 no Conta Blocos.', test: c => (c.result.score || 0) >= 15 },
    ],
  });
})();
