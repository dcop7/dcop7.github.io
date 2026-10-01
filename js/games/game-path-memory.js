/* ══════════════════════════════════════════════════════════════════
   Caminho (Remember the Path) — uma luz percorre um caminho numa
   grelha; memoriza-o e refaz-o, tocando casa a casa ou arrastando o
   dedo. A grelha cresce (4×4 → 7×7) e o caminho também; no Difícil o
   caminho pode virar na diagonal e a casa de partida não fica marcada.
══════════════════════════════════════════════════════════════════ */
const PathMemoryGame = (function () {
  'use strict';
  const U = ArcadeKit.U, M = MemoKit;
  const COL = '#22d3ee', OK = '#4ade80', BAD = '#f43f5e';
  const DIFF = {
    easy:   { step: .62, start: 3, diag: false, mark: true },
    medium: { step: .46, start: 4, diag: false, mark: true },
    hard:   { step: .34, start: 4, diag: true,  mark: false },
  };

  const gridN = L => (L <= 3 ? 4 : L <= 7 ? 5 : L <= 12 ? 6 : 7);

  /* caminho aleatório que não se cruza; recomeça se ficar encurralado */
  function makePath(N, len, diag) {
    const dirs = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let tries = 0; tries < 400; tries++) {
      const p = [[U.randi(0, N - 1), U.randi(0, N - 1)]], used = new Set([p[0].join()]);
      let lastD = null;
      while (p.length < len) {
        const [x, y] = p[p.length - 1];
        let opts = dirs.filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < N && ny < N && !used.has(nx + ',' + ny); });
        /* diagonais não podem "cortar" por entre duas casas do caminho */
        opts = opts.filter(([dx, dy]) => !(dx && dy) || !(used.has((x + dx) + ',' + y) && used.has(x + ',' + (y + dy))));
        if (!opts.length) break;
        /* preferir virar de vez em quando: caminhos retos são fáceis demais */
        const turn = opts.filter(d => !lastD || d[0] !== lastD[0] || d[1] !== lastD[1]);
        const d = (turn.length && Math.random() < .62) ? U.pick(turn) : U.pick(opts);
        p.push([x + d[0], y + d[1]]); used.add((x + d[0]) + ',' + (y + d[1])); lastD = d;
      }
      if (p.length === len) return p;
    }
    return null;
  }

  function lay(G, api) {
    const W = api.W, H = api.H, N = G.N;
    const size = Math.min(W - 36, H - 190, 560);
    const gap = size * (N <= 4 ? .045 : .035), C = (size - gap * (N - 1)) / N;
    const x0 = (W - size) / 2, y0 = Math.max(96, (H - size) / 2 + 18);
    return (G.L = { size, gap, C, x0, y0 });
  }
  const cellXY = (G, x, y) => [G.L.x0 + x * (G.L.C + G.L.gap) + G.L.C / 2, G.L.y0 + y * (G.L.C + G.L.gap) + G.L.C / 2];
  function cellAt(G, px, py) {
    const L = G.L, s = L.C + L.gap;
    const x = Math.floor((px - L.x0 + L.gap / 2) / s), y = Math.floor((py - L.y0 + L.gap / 2) / s);
    if (x < 0 || y < 0 || x >= G.N || y >= G.N) return null;
    const [cx, cy] = cellXY(G, x, y);
    return (Math.abs(px - cx) <= L.C * .5 + L.gap * .5 && Math.abs(py - cy) <= L.C * .5 + L.gap * .5) ? [x, y] : null;
  }

  function newRound(G, api) {
    const c = G.cfg;
    G.N = gridN(G.level);
    const len = Math.min(c.start + G.level - 1, Math.floor(G.N * G.N * .62));
    G.path = makePath(G.N, len, c.diag) || makePath(G.N, Math.max(3, len - 2), c.diag);
    G.inp = []; G.lit = {}; G.phase = 'intro'; G.pt = 0; G.showI = -1; G.orb = null; G.wrong = null; G.drag = false;
    lay(G, api);
  }

  function setup(api, o) {
    const G = Object.assign(M.base(api, o), { cfg: DIFF[o.diff] || DIFF.medium, N: 4, path: [], inp: [], lit: {}, trail: [], perfect: 0 });
    newRound(G, api);
    return G;
  }

  function update(G, dt, api) {
    G.t += dt; G.pt += dt; M.fxStep(G, dt);
    lay(G, api);
    for (const k in G.lit) { G.lit[k] -= dt * 1.8; if (G.lit[k] <= 0) delete G.lit[k]; }
    const c = G.cfg;
    if (G.phase === 'intro' && G.pt > .9) { G.phase = 'show'; G.pt = 0; G.showI = -1; }
    else if (G.phase === 'show') {
      const i = Math.floor(G.pt / c.step);
      if (i !== G.showI && i < G.path.length) {
        G.showI = i; const [x, y] = G.path[i];
        G.lit[x + ',' + y] = 1; M.note(api, i, .22);
        const [px, py] = cellXY(G, x, y); M.pulse(G, px, py, COL, G.L.C * .3, G.L.C * .75, .4);
      }
      /* a luz desliza entre casas (interpolação suave) */
      const f = G.pt / c.step, a = Math.min(G.path.length - 1, Math.floor(f)), b = Math.min(G.path.length - 1, a + 1), k = U.ease(Math.min(1, (f - a) * 1.6));
      const A = cellXY(G, ...G.path[a]), B = cellXY(G, ...G.path[b]);
      G.orb = [U.lerp(A[0], B[0], k), U.lerp(A[1], B[1], k)];
      if (Math.random() < .5) api.spark({ x: G.orb[0], y: G.orb[1], vx: U.rand(-40, 40), vy: U.rand(-40, 40), life: .5, size: 2.5, color: '#a5f3fc', gravity: 0 });
      if (G.pt > c.step * (G.path.length + .6)) { G.phase = 'go'; G.pt = 0; G.orb = null; }
    }
    else if (G.phase === 'go' && G.pt > .5) { G.phase = 'input'; G.pt = 0; }
    else if (G.phase === 'ok' && G.pt > 1) { G.level++; newRound(G, api); }
    else if (G.phase === 'fail' && G.pt > 1.1 + G.path.length * .09) {
      if (G.dead) { api.over({ score: G.level - 1, won: false, icon: '👣', title: 'Perdeste o caminho',
        stats: [['Nível alcançado', G.level], ['Casas certas', G.cells || 0], ['Rondas perfeitas', G.perfect]], meta: { level: G.level - 1 } }); G.phase = 'end'; }
      else newRound(G, api);
    }
  }

  function press(G, x, y, api) {
    if (G.phase !== 'input') return;
    const key = x + ',' + y;
    const last = G.inp[G.inp.length - 1];
    if (last && last[0] === x && last[1] === y) return;
    if (G.inp.some(p => p[0] === x && p[1] === y)) return;   /* casa já pisada: ignora (arrastar para trás) */
    const want = G.path[G.inp.length];
    const [px, py] = cellXY(G, x, y);
    if (want[0] === x && want[1] === y) {
      G.inp.push([x, y]); G.lit[key] = 1; G.cells = (G.cells || 0) + 1;
      M.note(api, G.inp.length - 1, .2); M.pulse(G, px, py, OK, G.L.C * .3, G.L.C * .7, .35);
      if (G.inp.length === G.path.length) {
        G.phase = 'ok'; G.pt = 0; G.drag = false; G.streak++; G.perfect++;
        G.score += G.path.length * 10;
        M.good(api); api.burst(px, py, 18, { color: OK, speed: 220, life: .8 }); api.burst(px, py, 10, { color: '#fff', speed: 140, life: .6 });
      }
    } else {
      G.wrong = [x, y]; G.phase = 'fail'; G.pt = 0; G.drag = false;
      M.bad(api); M.pulse(G, px, py, BAD, G.L.C * .3, G.L.C * .9, .5);
      G.dead = M.miss(G, api);
    }
  }

  function draw(G, ctx, W, H, api) {
    lay(G, api);
    M.bg(ctx, W, H, G.t, '#08203a', '#030712', 'rgba(34,211,238,');
    const L = G.L, c = G.cfg;
    M.glass(ctx, L.x0 - 14, L.y0 - 14, L.size + 28, L.size + 28, 22);
    const inSet = new Set(G.inp.map(p => p.join()));
    const showFail = G.phase === 'fail' || G.phase === 'end';
    const failK = showFail ? Math.min(1, Math.max(0, (G.pt - .35) / .09 / G.path.length)) : 0;
    for (let y = 0; y < G.N; y++) for (let x = 0; x < G.N; x++) {
      const key = x + ',' + y, [cx, cy] = cellXY(G, x, y);
      let lit = G.lit[key] || 0, col = COL, ring = null;
      if (inSet.has(key)) { lit = Math.max(lit, .55); col = G.phase === 'ok' ? OK : COL; }
      if (G.wrong && G.wrong[0] === x && G.wrong[1] === y) { lit = .9; col = BAD; }
      if (showFail) { const idx = G.path.findIndex(p => p[0] === x && p[1] === y); if (idx >= 0 && idx < failK * G.path.length) { ring = 'rgba(253,224,71,.85)'; } }
      if (G.phase === 'input' && c.mark && !G.inp.length && G.path[0][0] === x && G.path[0][1] === y) ring = `rgba(34,211,238,${.45 + Math.sin(G.t * 6) * .3})`;
      const bob = G.phase === 'ok' ? Math.sin(G.pt * 10 - (x + y) * .7) * 3 * Math.max(0, 1 - G.pt) : 0;
      M.tile(ctx, cx - L.C / 2, cy - L.C / 2 - bob, L.C, L.C, { lit, col, ring, base: '#16233f' });
    }
    /* rasto: o caminho mostrado (na fase show) e o teu (na fase input) */
    const trail = G.phase === 'show' ? G.path.slice(0, G.showI + 1) : showFail ? G.path.slice(0, Math.ceil(failK * G.path.length)) : G.inp;
    if (trail.length > 1 || (G.phase === 'show' && G.orb)) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const pts = trail.map(p => cellXY(G, p[0], p[1]));
      if (G.phase === 'show' && G.orb) pts.push(G.orb);
      const tc = showFail ? '#fde047' : G.phase === 'ok' ? OK : COL;
      [[L.C * .34, .16], [L.C * .14, .55], [L.C * .05, 1]].forEach(([w, a]) => {
        ctx.globalAlpha = a; ctx.strokeStyle = a === 1 ? '#fff' : tc; ctx.lineWidth = w;
        ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.stroke();
      });
      ctx.restore();
    }
    if (G.orb) {
      const [ox, oy] = G.orb, r = L.C * .2;
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 3.2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(165,243,252,.9)'); g.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, r * 3.2, 0, 6.3); ctx.fill();
    }
    M.fxDraw(G, ctx);
    /* pílula de fase */
    const pillY = Math.max(56, L.y0 - 62);
    if (G.phase === 'intro') M.pill(ctx, W, pillY, 'NÍVEL ' + G.level, G.pt / .9, COL, G.t);
    else if (G.phase === 'show') M.pill(ctx, W, pillY, 'MEMORIZA', G.pt / (c.step * (G.path.length + .6)), COL, G.t);
    else if (G.phase === 'go' || G.phase === 'input') M.pill(ctx, W, pillY, `A TUA VEZ · ${G.inp.length}/${G.path.length}`, G.inp.length / G.path.length, OK, G.t);
    else if (G.phase === 'ok') M.pill(ctx, W, pillY, 'CERTO!', 1, OK, G.t);
    else if (showFail) M.pill(ctx, W, pillY, G.dead ? 'SEM VIDAS' : 'ERA ASSIM…', null, BAD, G.t);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = "600 12px 'Space Grotesk', system-ui"; ctx.textAlign = 'center';
    if (G.phase === 'input' && !G.inp.length) ctx.fillText(c.mark ? 'Começa na casa que pisca — toca ou arrasta' : 'Toca na primeira casa do caminho — ou arrasta', W / 2, L.y0 + L.size + 40);
  }

  return ArcadeKit.create({
    id: 'path-memory', title: 'Caminho', icon: '👣', accent: COL, accent2: '#818cf8', bg: '#030712',
    tagline: 'Uma luz percorre a grelha. Memoriza o caminho e refaz-o, casa a casa.',
    view: { w: 420 }, modes: M.MODES(), bestLabel: 'Melhor nível',
    how: [
      'Observa a luz a percorrer a grelha — cada casa tem a sua nota.',
      'Quando aparecer <b>A TUA VEZ</b>, refaz o caminho pela mesma ordem: toca casa a casa ou arrasta o dedo.',
      'A cada nível o caminho cresce e a grelha também (até 7×7). No <b>Difícil</b> há diagonais e a partida não fica marcada.',
    ],
    controls: ['👆 Tocar ou arrastar', '🖱️ Clicar ou arrastar'],
    ready: { title: 'Toca para começar', hint: 'Primeiro observa — depois é a tua vez.' },
    setup, update, draw,
    idle: (G, dt, api) => { G.t += dt; lay(G, api); },
    down: (G, x, y, api) => { const c = cellAt(G, x, y); if (c) { G.drag = true; press(G, c[0], c[1], api); } },
    move: (G, x, y, api, e, isDown) => {
      if (!isDown || !G.drag) return;
      const c = cellAt(G, x, y); if (!c) return;
      const last = G.inp[G.inp.length - 1];
      /* arrastar só conta casas vizinhas da última (não salta por cima de casas) */
      if (last && Math.max(Math.abs(c[0] - last[0]), Math.abs(c[1] - last[1])) === 1) press(G, c[0], c[1], api);
    },
    up: G => { G.drag = false; },
    hud: (G, api) => [['Nível', G.level], ['Vidas', M.hearts(G)], ['Recorde', api.best != null ? api.best : '—']],
    achievements: [
      { id: 'path.8', name: 'Bom Navegador', icon: '👣', desc: 'Chega ao nível 8 no Caminho.', test: c => (c.result.score || 0) >= 8 },
      { id: 'path.15', name: 'Mapa na Cabeça', icon: '🗺️', desc: 'Chega ao nível 15 no Caminho.', test: c => (c.result.score || 0) >= 15 },
    ],
  });
})();
