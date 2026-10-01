/* ══════════════════════════════════════════════════════════════════
   Padrão (Pattern Recall) — um padrão acende-se na grelha durante uns
   segundos, os mosaicos viram-se, e tens de o reconstruir. A grelha
   cresce (3×3 → 6×6) e, mais à frente, o padrão passa a ter 2 e depois
   3 cores: escolhes a cor na paleta e tocas. Dois enganos numa ronda
   custam uma vida.
══════════════════════════════════════════════════════════════════ */
const PatternRecallGame = (function () {
  'use strict';
  const U = ArcadeKit.U, M = MemoKit;
  const COLS = ['#22d3ee', '#f472b6', '#fbbf24'];
  const SYM = ['circle', 'heart', 'star'];
  const NAMES = ['Ciano', 'Rosa', 'Ouro'];
  const DIFF = {
    easy:   { show: 2.4, per: .1,  col2: 9,  col3: 16, slip: 3 },
    medium: { show: 1.7, per: .08, col2: 6,  col3: 12, slip: 2 },
    hard:   { show: 1.15, per: .06, col2: 4, col3: 9,  slip: 2 },
  };
  const gridOf = L => (L <= 2 ? 3 : L <= 5 ? 4 : L <= 9 ? 5 : 6);
  const countOf = (L, N) => Math.min(Math.floor(N * N * .55), 3 + Math.floor((L - 1) * .75));

  function lay(G, api) {
    const W = api.W, H = api.H, N = G.N, pal = G.nc > 1 ? 74 : 0;
    const size = Math.min(W - 40, H - 200 - pal, 540);
    const gap = size * .04, C = (size - gap * (N - 1)) / N;
    const x0 = (W - size) / 2, y0 = Math.max(100, (H - size - pal) / 2 + 10);
    return (G.L = { size, gap, C, x0, y0, palY: y0 + size + 34 });
  }
  const cellXY = (G, i) => { const L = G.L, x = i % G.N, y = Math.floor(i / G.N); return [L.x0 + x * (L.C + L.gap), L.y0 + y * (L.C + L.gap)]; };

  function newRound(G, api) {
    const c = G.cfg;
    G.N = gridOf(G.level);
    G.nc = G.level >= c.col3 ? 3 : G.level >= c.col2 ? 2 : 1;
    const k = countOf(G.level, G.N);
    const idx = M.shuffle([...Array(G.N * G.N).keys()]).slice(0, k);
    G.pat = new Map(idx.map((i, j) => [i, G.nc === 1 ? 0 : j % G.nc]));
    /* garante pelo menos uma casa de cada cor e baralha as cores */
    if (G.nc > 1) { const cs = M.shuffle([...G.pat.values()]); let j = 0; G.pat.forEach((v, key) => G.pat.set(key, cs[j++])); }
    G.got = new Map(); G.bad = new Set(); G.slips = 0; G.sel = 0;
    G.flip = new Array(G.N * G.N).fill(0);   /* 0 = face escondida, 1 = virada para cima */
    G.phase = 'intro'; G.pt = 0;
    G.showT = c.show + k * c.per + (G.nc - 1) * .5;
    lay(G, api);
  }

  function setup(api, o) {
    const G = Object.assign(M.base(api, o), { cfg: DIFF[o.diff] || DIFF.medium, N: 3, nc: 1, perfect: 0 });
    newRound(G, api);
    return G;
  }

  function update(G, dt, api) {
    G.t += dt; G.pt += dt; M.fxStep(G, dt); lay(G, api);
    const n = G.N * G.N;
    if (G.phase === 'intro') {
      /* vira o padrão para cima, em onda a partir do canto */
      for (let i = 0; i < n; i++) if (G.pat.has(i)) { const d = ((i % G.N) + Math.floor(i / G.N)) * .05; G.flip[i] = U.clamp((G.pt - .35 - d) / .3, 0, 1); }
      if (G.pt > .35 + .3 + G.N * .1 && !G.played) { G.played = true; M.note(api, 7 + G.nc, .4); }
      if (G.pt > .8 + G.N * .1) { G.phase = 'show'; G.pt = 0; G.played = false; }
    } else if (G.phase === 'show') {
      if (G.pt > G.showT) { G.phase = 'hide'; G.pt = 0; }
    } else if (G.phase === 'hide') {
      for (let i = 0; i < n; i++) if (G.pat.has(i)) { const d = ((i % G.N) + Math.floor(i / G.N)) * .04; G.flip[i] = 1 - U.clamp((G.pt - d) / .28, 0, 1); }
      if (G.pt > .35 + G.N * .08) { G.phase = 'input'; G.pt = 0; }
    } else if (G.phase === 'input') {
      G.got.forEach((v, i) => { G.flip[i] = Math.min(1, G.flip[i] + dt * 5); });
    } else if (G.phase === 'ok') {
      if (G.pt > 1.1) { G.level++; newRound(G, api); }
    } else if (G.phase === 'fail') {
      for (let i = 0; i < n; i++) if (G.pat.has(i)) G.flip[i] = Math.min(1, G.flip[i] + dt * 4);
      if (G.pt > 1.7) {
        if (G.dead) { G.phase = 'end'; api.over({ score: G.level - 1, won: false, icon: '🟪', title: 'O padrão fugiu-te',
          stats: [['Nível', G.level], ['Rondas perfeitas', G.perfect], ['Cores', G.nc]], meta: { level: G.level - 1 } }); }
        else newRound(G, api);
      }
    }
  }

  function tap(G, i, api) {
    if (G.phase !== 'input' || G.got.has(i) || G.bad.has(i)) return;
    const [x, y] = cellXY(G, i), cx = x + G.L.C / 2, cy = y + G.L.C / 2;
    const want = G.pat.get(i);
    if (want != null && want === G.sel) {
      G.got.set(i, want);
      M.note(api, 5 + G.got.size, .18); M.pulse(G, cx, cy, COLS[want], G.L.C * .2, G.L.C * .7, .35);
      if (G.got.size === G.pat.size) {
        G.phase = 'ok'; G.pt = 0; G.streak++; if (!G.slips) G.perfect++;
        G.score += G.pat.size * 10 * G.nc; M.good(api);
        api.burst(api.W / 2, G.L.y0 + G.L.size / 2, 26, { color: COLS[0], speed: 230, life: .8, gravity: 0 });
      }
    } else {
      /* casa certa com a cor errada também conta como engano */
      G.bad.add(i); G.slips++;
      M.pulse(G, cx, cy, '#f43f5e', G.L.C * .2, G.L.C * .8, .4); api.shake(4, .2);
      api.sfx.tone(180, .18, 'square', .05);
      if (want != null) api.float(cx, cy - G.L.C * .3, 'cor errada', '#fda4af', 14);
      if (G.slips >= G.cfg.slip) { G.phase = 'fail'; G.pt = 0; M.bad(api); G.dead = M.miss(G, api); }
    }
  }

  function draw(G, ctx, W, H, api) {
    lay(G, api);
    M.bg(ctx, W, H, G.t, '#1b1238', '#06040f', 'rgba(167,139,250,');
    const L = G.L, n = G.N * G.N;
    M.glass(ctx, L.x0 - 14, L.y0 - 14, L.size + 28, L.size + 28, 22);
    for (let i = 0; i < n; i++) {
      const [x, y] = cellXY(G, i), f = G.flip[i];
      /* virar: escala horizontal |cos| — a face muda a meio */
      const ang = f * Math.PI, sx = Math.abs(Math.cos(ang)), up = f > .5;
      const cIdx = G.got.has(i) ? G.got.get(i) : G.pat.get(i);
      const w = Math.max(2, L.C * sx), xx = x + (L.C - w) / 2;
      const bob = G.phase === 'ok' ? -Math.max(0, Math.sin(G.pt * 9 - (i % G.N + Math.floor(i / G.N)) * .6)) * 4 * Math.max(0, 1 - G.pt) : 0;
      if (up && cIdx != null) {
        const col = COLS[cIdx];
        M.tile(ctx, xx, y + bob, w, L.C, { lit: 1, col, base: '#1d2550', r: Math.min(w, L.C) * .2 });
        if (G.nc > 1 && sx > .4) { ctx.save(); ctx.globalAlpha = .75 * sx; M.shape(ctx, SYM[cIdx], x + L.C / 2, y + L.C / 2 + bob, L.C * .16); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); ctx.restore(); }
        if (G.phase === 'fail' && !G.got.has(i)) { ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]); U.rr(ctx, xx - 2, y - 2, w + 4, L.C + 1, 10); ctx.stroke(); ctx.setLineDash([]); }
      } else {
        M.tile(ctx, xx, y + bob, w, L.C, { base: '#1d2550', r: Math.min(w, L.C) * .2 });
      }
      if (G.bad.has(i)) {
        ctx.save(); ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        const m = L.C * .3, cx = x + L.C / 2, cy = y + L.C / 2;
        ctx.beginPath(); ctx.moveTo(cx - m, cy - m); ctx.lineTo(cx + m, cy + m); ctx.moveTo(cx + m, cy - m); ctx.lineTo(cx - m, cy + m); ctx.stroke(); ctx.restore();
      }
    }
    M.fxDraw(G, ctx);
    /* paleta (só com 2+ cores) */
    if (G.nc > 1) {
      const bw = 64, gap = 14, tot = G.nc * bw + (G.nc - 1) * gap, x0 = (W - tot) / 2;
      for (let j = 0; j < G.nc; j++) {
        const x = x0 + j * (bw + gap), on = G.sel === j;
        M.tile(ctx, x, L.palY, bw, 50, { lit: on ? 1 : .35, col: COLS[j], base: '#1d2550', ring: on ? '#fff' : null, r: 14 });
        M.shape(ctx, SYM[j], x + bw / 2, L.palY + 23, 9); ctx.fillStyle = '#fff'; ctx.fill();
      }
    }
    const pillY = Math.max(54, L.y0 - 62);
    if (G.phase === 'intro') M.pill(ctx, W, pillY, 'NÍVEL ' + G.level + (G.nc > 1 ? ' · ' + G.nc + ' CORES' : ''), null, '#a78bfa', G.t);
    else if (G.phase === 'show') M.pill(ctx, W, pillY, 'MEMORIZA', 1 - G.pt / G.showT, '#a78bfa', G.t);
    else if (G.phase === 'hide' || G.phase === 'input') M.pill(ctx, W, pillY, `RECONSTRÓI · ${G.got.size}/${G.pat.size}`, G.got.size / G.pat.size, '#4ade80', G.t);
    else if (G.phase === 'ok') M.pill(ctx, W, pillY, G.slips ? 'CERTO!' : 'PERFEITO!', 1, '#4ade80', G.t);
    else M.pill(ctx, W, pillY, G.dead ? 'SEM VIDAS' : 'ERA ASSIM', null, '#f43f5e', G.t);
    if (G.phase === 'input' && G.cfg.slip - G.slips < G.cfg.slip) {
      ctx.fillStyle = 'rgba(253,164,175,.85)'; ctx.font = "700 12px 'Space Grotesk', system-ui"; ctx.textAlign = 'center';
      ctx.fillText(`Enganos: ${G.slips}/${G.cfg.slip}`, W / 2, (G.nc > 1 ? L.palY + 72 : L.y0 + L.size + 36));
    }
  }

  function hitCell(G, x, y) {
    const L = G.L, s = L.C + L.gap;
    const cx = Math.floor((x - L.x0) / s), cy = Math.floor((y - L.y0) / s);
    if (cx < 0 || cy < 0 || cx >= G.N || cy >= G.N) return -1;
    if (x - L.x0 - cx * s > L.C || y - L.y0 - cy * s > L.C) return -1;   /* no intervalo entre mosaicos */
    return cy * G.N + cx;
  }

  return ArcadeKit.create({
    id: 'pattern-recall', title: 'Padrão', icon: '🟪', accent: '#a78bfa', accent2: '#f472b6', bg: '#06040f',
    tagline: 'Um padrão acende-se por segundos. Reconstrói-o — e depois com cores.',
    view: { w: 420 }, modes: M.MODES(), bestLabel: 'Melhor nível',
    how: [
      'Memoriza as casas acesas antes de os mosaicos se virarem.',
      'Toca nas casas que estavam acesas. Dois enganos (três no Fácil) numa ronda custam uma vida.',
      'Mais à frente o padrão tem <b>2 e depois 3 cores</b>: escolhe a cor na paleta por baixo da grelha (ou teclas 1–3) e toca.',
    ],
    controls: ['👆 Tocar', '🖱️ Clicar', '⌨️ 1–3 muda de cor'],
    ready: { title: 'Toca para começar', hint: 'Olha para o padrão como um todo — formas, não casas.' },
    setup, update, draw,
    idle: (G, dt, api) => { G.t += dt; lay(G, api); },
    down: (G, x, y, api) => {
      const L = G.L;
      if (G.nc > 1 && y >= L.palY - 6 && y <= L.palY + 56) {
        const bw = 64, gap = 14, tot = G.nc * bw + (G.nc - 1) * gap, x0 = (api.W - tot) / 2, j = Math.floor((x - x0) / (bw + gap));
        if (j >= 0 && j < G.nc && x - x0 - j * (bw + gap) <= bw) { G.sel = j; api.sfx.click(); }
        return;
      }
      const i = hitCell(G, x, y); if (i >= 0) tap(G, i, api);
    },
    key: (G, e, api) => { const d = parseInt(e.key, 10); if (d >= 1 && d <= G.nc) { G.sel = d - 1; api.sfx.click(); return true; } },
    hud: (G, api) => [['Nível', G.level], ['Vidas', M.hearts(G)], ...(G.nc > 1 ? [['Cor', NAMES[G.sel]]] : []), ['Recorde', api.best != null ? api.best : '—']],
    achievements: [
      { id: 'pat.8', name: 'Olho de Lince', icon: '🟪', desc: 'Chega ao nível 8 no Padrão.', test: c => (c.result.score || 0) >= 8 },
      { id: 'pat.15', name: 'Memória Fotográfica', icon: '📸', desc: 'Chega ao nível 15 no Padrão.', test: c => (c.result.score || 0) >= 15 },
    ],
  });
})();
