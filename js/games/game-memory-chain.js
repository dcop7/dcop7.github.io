/* ══════════════════════════════════════════════════════════════════
   Cadeia (Memory Chain) — uma cadeia de peças (forma + cor) cresce um
   elo a cada ronda; repete-a toda pela ordem, escolhendo as peças num
   tabuleiro de opções que se BARALHA a cada ronda (ao contrário do Ecos,
   a posição não ajuda: tens de lembrar a peça).
   Fácil: a cadeia toda é mostrada em cada ronda. Médio/Difícil: só o elo
   novo — o resto tens de o trazer da ronda anterior. As peças parecidas
   (mesma forma noutra cor, mesma cor noutra forma) são de propósito.
══════════════════════════════════════════════════════════════════ */
const MemoryChainGame = (function () {
  'use strict';
  const U = ArcadeKit.U, M = MemoKit;
  const COLS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316'];
  const SH = ['circle', 'star', 'tri', 'square', 'heart', 'diamond', 'moon', 'hex', 'drop'];
  const DIFF = {
    easy:   { set: 6, start: 2, all: true,  show: .9 },
    medium: { set: 8, start: 2, all: false, show: 1.0 },
    hard:   { set: 9, start: 3, all: false, show: .75 },
  };

  /* conjunto de peças da partida: pares "confundíveis" de propósito */
  function makeSet(n) {
    const set = [], key = p => p.s + p.c;
    const add = p => { if (!set.some(q => key(q) === key(p))) set.push(p); };
    const s = M.shuffle(SH.slice()), c = M.shuffle([0, 1, 2, 3, 4, 5]);
    while (set.length < n) {
      const base = { s: s[set.length % s.length], c: c[set.length % c.length] };
      add(base);
      if (set.length < n && Math.random() < .5) add({ s: base.s, c: c[(set.length + 2) % 6] });   /* mesma forma, outra cor */
      if (set.length < n && Math.random() < .4) add({ s: s[(set.length + 3) % s.length], c: base.c });   /* mesma cor, outra forma */
    }
    return set.slice(0, n);
  }

  function lay(G, api) {
    const W = api.W, H = api.H, n = G.set.length;
    const cols = n <= 6 ? 3 : n <= 8 ? 4 : 3, rows = Math.ceil(n / cols);
    const ob = Math.min((W - 40 - (cols - 1) * 12) / cols, 96);
    const gw = cols * ob + (cols - 1) * 12, gh = rows * ob + (rows - 1) * 12;
    const oy = H - gh - 30;
    /* fila de elos no topo: até 8 por linha */
    const per = Math.min(8, Math.max(4, G.chain.length)), sb = Math.min(40, (W - 40 - (per - 1) * 6) / per);
    return (G.L = { cols, rows, ob, gw, gh, ox: (W - gw) / 2, oy, sb, per, sy: 104, stage: { x: W / 2, y: (H - 40 + 104 + Math.ceil(G.chain.length / per) * (sb + 8)) / 2, s: Math.min(W * .34, 150) } });
  }

  function newRound(G, api, grow) {
    if (grow) G.chain.push(U.randi(0, G.set.length - 1));
    G.order = M.shuffle(G.set.map((_, i) => i));
    G.inp = []; G.phase = 'intro'; G.pt = 0; G.si = -1;
    /* o que se mostra: tudo (Fácil, 1.ª ronda, ou depois de um erro) ou só o elo novo */
    G.showFrom = (G.cfg.all || G.retry || G.chain.length === G.cfg.start) ? 0 : G.chain.length - 1;
    G.retry = false;
    lay(G, api);
  }

  function setup(api, o) {
    const cfg = DIFF[o.diff] || DIFF.medium;
    const G = Object.assign(M.base(api, o), { cfg, set: makeSet(cfg.set), chain: [], inp: [], order: [], flip: 0 });
    for (let i = 0; i < cfg.start; i++) G.chain.push(U.randi(0, G.set.length - 1));
    /* evita começar com dois iguais seguidos (confunde quem ainda está a perceber o jogo) */
    if (G.chain[1] === G.chain[0]) G.chain[1] = (G.chain[0] + 1) % G.set.length;
    newRound(G, api, false);
    return G;
  }

  function update(G, dt, api) {
    G.t += dt; G.pt += dt; M.fxStep(G, dt); lay(G, api);
    if (G.tapT > 0) G.tapT = Math.max(0, G.tapT - dt * 5);
    /* as opções escondem-se enquanto se memoriza (o palco ocupa o centro) */
    const optOn = G.phase === 'input' || G.phase === 'ok' || G.phase === 'fail' || G.phase === 'end';
    G.optK = U.clamp((G.optK || 0) + (optOn ? dt * 4 : -dt * 5), 0, 1);
    const c = G.cfg, per = c.show;
    if (G.phase === 'intro' && G.pt > .7) { G.phase = 'show'; G.pt = 0; G.si = -1; }
    else if (G.phase === 'show') {
      const k = G.showFrom + Math.floor(G.pt / per);
      if (k !== G.si && k < G.chain.length) { G.si = k; M.note(api, G.chain[k] + 4, .3); }
      if (G.pt > per * (G.chain.length - G.showFrom) + .2) { G.phase = 'input'; G.pt = 0; }
    }
    else if (G.phase === 'ok' && G.pt > .9) { G.level++; newRound(G, api, true); }
    else if (G.phase === 'fail' && G.pt > 1.8) {
      if (G.dead) { G.phase = 'end'; api.over({ score: G.level - 1, won: false, icon: '🔗', title: 'A cadeia partiu-se',
        stats: [['Elos', G.chain.length], ['Nível', G.level], ['Peças diferentes', G.set.length]], meta: { level: G.level - 1 } }); }
      else { G.retry = true; newRound(G, api, false); }
    }
  }

  function pick(G, j, api) {
    if (G.phase !== 'input') return;
    const item = G.order[j], want = G.chain[G.inp.length];
    const L = G.L, col = j % L.cols, row = Math.floor(j / L.cols);
    const cx = L.ox + col * (L.ob + 12) + L.ob / 2, cy = L.oy + row * (L.ob + 12) + L.ob / 2;
    G.tapJ = j; G.tapT = 1;
    if (item === want) {
      G.inp.push(item); M.note(api, item + 4, .2);
      M.pulse(G, cx, cy, COLS[G.set[item].c], 10, L.ob * .7, .35);
      if (G.inp.length === G.chain.length) {
        G.phase = 'ok'; G.pt = 0; G.streak++; G.score += G.chain.length * 10;
        M.good(api); api.burst(api.W / 2, L.sy + L.sb, 20, { color: '#fde047', speed: 200, life: .7, gravity: 0 });
      }
    } else {
      G.wrongJ = j; G.phase = 'fail'; G.pt = 0;
      M.bad(api); M.pulse(G, cx, cy, '#f43f5e', 10, L.ob * .9, .45);
      G.dead = M.miss(G, api);
    }
  }

  function draw(G, ctx, W, H, api) {
    lay(G, api);
    M.bg(ctx, W, H, G.t, '#2a1a08', '#080503', 'rgba(242,179,68,');
    const L = G.L, n = G.chain.length;
    /* elos no topo, ligados por uma corrente */
    const rowsS = Math.ceil(n / L.per);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / L.per), cIn = i % L.per, inRow = Math.min(L.per, n - r * L.per);
      const tw = inRow * L.sb + (inRow - 1) * 6, x = (W - tw) / 2 + cIn * (L.sb + 6), y = L.sy + r * (L.sb + 8);
      if (cIn > 0) { ctx.strokeStyle = 'rgba(242,179,68,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y + L.sb / 2); ctx.lineTo(x, y + L.sb / 2); ctx.stroke(); }
      U.rr(ctx, x, y, L.sb, L.sb, 9);
      const shown = G.phase === 'show' && i >= G.showFrom && i <= G.si;
      const done = i < G.inp.length || G.phase === 'ok' || (G.phase === 'fail' || G.phase === 'end');
      const cur = G.phase === 'input' && i === G.inp.length;
      ctx.fillStyle = cur ? 'rgba(242,179,68,.18)' : 'rgba(255,255,255,.05)'; ctx.fill();
      ctx.strokeStyle = cur ? `rgba(242,179,68,${.6 + Math.sin(G.t * 6) * .3})` : 'rgba(255,255,255,.12)'; ctx.lineWidth = cur ? 2 : 1; ctx.stroke();
      if (shown || done) {
        const p = G.set[G.chain[i]];
        const wrongHere = (G.phase === 'fail' || G.phase === 'end') && i === G.inp.length;
        M.gem(ctx, p.s, x + L.sb / 2, y + L.sb / 2, L.sb * .3, COLS[p.c], done && !shown && i >= G.inp.length && !wrongHere ? .45 : 1);
        if (wrongHere) { U.rr(ctx, x - 3, y - 3, L.sb + 6, L.sb + 6, 11); ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2.5; ctx.stroke(); }
      } else if (G.phase !== 'input' || i > G.inp.length) {
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.font = `800 ${Math.round(L.sb * .42)}px 'Space Grotesk', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', x + L.sb / 2, y + L.sb / 2 + 1);
      }
    }
    /* palco: a peça a memorizar entra a rodar */
    if (G.phase === 'show' && G.si >= 0) {
      const st = L.stage, k = (G.pt % G.cfg.show) / G.cfg.show, inK = U.clamp(k / .2, 0, 1), outK = U.clamp((k - .82) / .18, 0, 1);
      const p = G.set[G.chain[G.si]], s = st.s * (.6 + .4 * (1 - Math.pow(1 - inK, 3))) * (1 - outK * .3);
      ctx.save(); ctx.globalAlpha = 1 - outK;
      const gx = st.x + outK * -40;
      M.glass(ctx, gx - st.s * .75, st.y - st.s * .75, st.s * 1.5, st.s * 1.5, 26, { fill: 'rgba(30,20,8,.75)' });
      ctx.translate(gx, st.y); ctx.rotate((1 - inK) * -.5);
      M.gem(ctx, p.s, 0, 0, s * .42, COLS[p.c]);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = "700 13px 'Space Grotesk', system-ui"; ctx.textAlign = 'center';
      ctx.fillText(`elo ${G.si + 1} de ${n}`, st.x, st.y + st.s * .75 + 26);
    }
    /* opções */
    const optA = U.ease(G.optK || 0);
    for (let j = 0; j < G.order.length; j++) {
      const col = j % L.cols, row = Math.floor(j / L.cols);
      const x = L.ox + col * (L.ob + 12), y = L.oy + row * (L.ob + 12) + (1 - optA) * 40, p = G.set[G.order[j]];
      if (optA < .01) continue;
      const pressed = G.tapJ === j ? G.tapT : 0;
      ctx.save(); ctx.globalAlpha = optA;
      M.tile(ctx, x, y, L.ob, L.ob, { base: '#2a2238', press: pressed, ring: G.phase === 'fail' && G.wrongJ === j ? '#f43f5e' : null, r: 18 });
      M.gem(ctx, p.s, x + L.ob / 2, y + L.ob / 2 - 1 + pressed * 3, L.ob * .25, COLS[p.c]);
      ctx.restore();
    }
    M.fxDraw(G, ctx);
    const pillY = 54;
    if (G.phase === 'intro') M.pill(ctx, W, pillY, G.showFrom > 0 ? 'NOVO ELO' : 'MEMORIZA A CADEIA', null, '#f2b344', G.t);
    else if (G.phase === 'show') M.pill(ctx, W, pillY, G.showFrom > 0 ? 'NOVO ELO · LEMBRA OS OUTROS' : 'MEMORIZA', G.pt / (G.cfg.show * (n - G.showFrom)), '#f2b344', G.t);
    else if (G.phase === 'input') M.pill(ctx, W, pillY, `A CADEIA TODA · ${G.inp.length}/${n}`, G.inp.length / n, '#4ade80', G.t);
    else if (G.phase === 'ok') M.pill(ctx, W, pillY, 'CERTO!', 1, '#4ade80', G.t);
    else M.pill(ctx, W, pillY, G.dead ? 'SEM VIDAS' : 'ERA ESTA', null, '#f43f5e', G.t);
  }

  function optAt(G, x, y) {
    const L = G.L, s = L.ob + 12, c = Math.floor((x - L.ox) / s), r = Math.floor((y - L.oy) / s);
    if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) return -1;
    if (x - L.ox - c * s > L.ob || y - L.oy - r * s > L.ob) return -1;
    const j = r * L.cols + c; return j < G.order.length ? j : -1;
  }

  return ArcadeKit.create({
    id: 'memory-chain', title: 'Cadeia', icon: '🔗', accent: '#f2b344', accent2: '#ef4444', bg: '#080503',
    tagline: 'A cadeia cresce um elo por ronda e as opções baralham-se. Lembras-te da ordem toda?',
    view: { w: 420 }, modes: M.MODES(), bestLabel: 'Melhor nível',
    how: [
      'Observa as peças da cadeia, uma a uma. No <b>Médio</b> e no <b>Difícil</b> só aparece o <b>elo novo</b> — os anteriores tens de os lembrar.',
      'Repete a cadeia inteira pela ordem, tocando nas peças em baixo. As opções mudam de lugar em cada ronda.',
      'Cuidado com as parecidas: a mesma forma noutra cor, ou a mesma cor noutra forma. Depois de um erro a cadeia volta a ser mostrada toda.',
    ],
    controls: ['👆 Tocar', '🖱️ Clicar'],
    ready: { title: 'Toca para começar', hint: 'Diz as peças em voz baixa: "estrela azul, lua vermelha…"' },
    setup, update, draw,
    idle: (G, dt, api) => { G.t += dt; lay(G, api); },
    down: (G, x, y, api) => { const j = optAt(G, x, y); if (j >= 0) pick(G, j, api); },
    hud: (G, api) => [['Nível', G.level], ['Elos', G.chain.length], ['Vidas', M.hearts(G)], ['Recorde', api.best != null ? api.best : '—']],
    achievements: [
      { id: 'chain.8', name: 'Elo Forte', icon: '🔗', desc: 'Chega ao nível 8 na Cadeia.', test: c => (c.result.score || 0) >= 8 },
      { id: 'chain.15', name: 'Corrente de Ferro', icon: '⛓️', desc: 'Chega ao nível 15 na Cadeia.', test: c => (c.result.score || 0) >= 15 },
    ],
  });
})();
