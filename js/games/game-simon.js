/* ══════════════════════════════════════════════════════════════════
   Ecos (Simon) — um disco de botões de luz toca uma sequência que
   cresce uma nota a cada ronda; repete-a. Modos: Clássico (4 cores),
   Seis Cores, Reverso (repetir de trás para a frente) e Treino.
   Cada botão tem também um símbolo, para não depender só da cor.
   Teclado: ↑ → ↓ ← (ou 1–6).
══════════════════════════════════════════════════════════════════ */
const SimonGame = (function () {
  'use strict';
  const U = ArcadeKit.U, M = MemoKit, TAU = Math.PI * 2;
  const PADS = [
    { col: '#22c55e', sym: 'tri' }, { col: '#ef4444', sym: 'circle' }, { col: '#3b82f6', sym: 'square' },
    { col: '#facc15', sym: 'star' }, { col: '#a855f7', sym: 'diamond' }, { col: '#f97316', sym: 'hex' },
  ];
  /* notas de cada botão (índices da pentatónica): acordes agradáveis */
  const NOTES = { 4: [7, 9, 10, 12], 6: [5, 7, 9, 10, 12, 14] };
  const DIFF = {
    easy:   { on: .56, gap: .2,  min: .34, wait: 0 },
    medium: { on: .44, gap: .15, min: .24, wait: 5 },
    hard:   { on: .36, gap: .11, min: .17, wait: 3 },
  };

  function lay(G, api) {
    const W = api.W, H = api.H;
    const R = Math.min(W * .46, (H - 170) * .46, 260);
    return (G.L = { cx: W / 2, cy: Math.max(R + 110, H * .5 + 10), R, r: R * .42 });
  }
  const angOf = (G, i) => -Math.PI / 2 + i * TAU / G.n;

  function padAt(G, x, y) {
    const L = G.L, dx = x - L.cx, dy = y - L.cy, d = Math.hypot(dx, dy);
    if (d < L.r * .95 || d > L.R * 1.08) return -1;
    let a = Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / G.n;
    a = ((a % TAU) + TAU) % TAU;
    return Math.floor(a / (TAU / G.n)) % G.n;
  }

  function setup(api, o) {
    const n = o.mode === 'six' ? 6 : 4;
    const G = Object.assign(M.base(api, o), { cfg: DIFF[o.diff] || DIFF.medium, n, rev: o.mode === 'reverse', seq: [], inp: [], lit: new Array(n).fill(0), press: new Array(n).fill(0), waitT: 0, rot: 0 });
    G.seq.push(U.randi(0, n - 1));
    G.phase = 'intro'; G.pt = 0;
    lay(G, api);
    return G;
  }

  function flash(G, i, api, k) {
    G.lit[i] = k || 1;
    M.note(api, NOTES[G.n][i], .3, 'sine');
    const L = G.L, a = angOf(G, i), rr = (L.R + L.r) / 2;
    M.pulse(G, L.cx + Math.cos(a) * rr, L.cy + Math.sin(a) * rr, PADS[i].col, 12, (L.R - L.r) * .9, .5);
  }

  function timing(G) {
    const c = G.cfg, k = Math.max(0, G.seq.length - 1);
    const on = Math.max(c.min, c.on - k * .012);
    return { on, gap: Math.max(.07, c.gap - k * .004) };
  }

  function update(G, dt, api) {
    G.t += dt; G.pt += dt; M.fxStep(G, dt); lay(G, api);
    for (let i = 0; i < G.n; i++) { G.lit[i] = Math.max(0, G.lit[i] - dt * 2.6); G.press[i] = Math.max(0, G.press[i] - dt * 6); }
    G.rot += dt * (G.phase === 'show' ? .25 : .08);
    if (G.phase === 'intro' && G.pt > .8) { G.phase = 'show'; G.pt = 0; G.si = -1; }
    else if (G.phase === 'show') {
      const tm = timing(G), step = tm.on + tm.gap, i = Math.floor(G.pt / step);
      if (i !== G.si && i < G.seq.length) { G.si = i; flash(G, G.seq[i], api, 1); }
      /* cada luz dura tm.on: corta-se no gap para notas repetidas se distinguirem */
      if (G.si >= 0 && G.pt - G.si * step > tm.on) G.lit[G.seq[G.si]] = Math.min(G.lit[G.seq[G.si]], .12);
      if (G.pt > step * G.seq.length + .2) { G.phase = 'input'; G.pt = 0; G.inp = []; G.waitT = 0; }
    }
    else if (G.phase === 'input' && G.cfg.wait) {
      G.waitT += dt;
      if (G.waitT > G.cfg.wait) fail(G, api, -1);
    }
    else if (G.phase === 'ok' && G.pt > .85) {
      G.level++; G.seq.push(U.randi(0, G.n - 1));
      G.phase = 'show'; G.pt = 0; G.si = -1;
    }
    else if (G.phase === 'fail' && G.pt > 1.3) {
      if (G.dead) { G.phase = 'end'; api.over({ score: G.level - 1, won: false, icon: '🔴', title: 'A sequência acabou',
        stats: [['Sequência', G.seq.length - 1 + ' notas'], ['Nível', G.level], ['Modo', G.rev ? 'Reverso' : G.n + ' cores']], meta: { level: G.level - 1 } }); }
      else { G.phase = 'show'; G.pt = 0; G.si = -1; }   /* repete a mesma sequência */
    }
  }

  function fail(G, api, pressed) {
    G.phase = 'fail'; G.pt = 0;
    const want = G.rev ? G.seq[G.seq.length - 1 - G.inp.length] : G.seq[G.inp.length];
    M.bad(api); api.flash('#7f1d1d', .25);
    G.want = want; G.wrongPad = pressed;
    G.dead = M.miss(G, api);
  }

  function hit(G, i, api) {
    if (G.phase !== 'input' || i < 0) return;
    G.press[i] = 1;
    const want = G.rev ? G.seq[G.seq.length - 1 - G.inp.length] : G.seq[G.inp.length];
    if (i !== want) { fail(G, api, i); return; }
    flash(G, i, api, .9);
    G.inp.push(i); G.waitT = 0;
    if (G.inp.length === G.seq.length) {
      G.phase = 'ok'; G.pt = 0; G.streak++; G.score += G.seq.length;
      api.sfx.arp([NOTES[G.n].map(M.noteF)[0] * 2, NOTES[G.n].map(M.noteF)[2] * 2], .05, .12, 'triangle', .06);
      const L = G.L; api.burst(L.cx, L.cy, 22, { color: '#fff', speed: 180, life: .7, gravity: 0 });
      if (G.seq.length % 5 === 0) api.banner(G.seq.length + ' notas!', 'Continua assim');
    }
  }

  /* fatia de anel com folga de largura constante (gp px) entre fatias */
  function seg(ctx, cx, cy, r0, r1, a, span, gp) {
    const o1 = gp / r1, o0 = gp / r0;
    ctx.beginPath(); ctx.arc(cx, cy, r1, a - span / 2 + o1, a + span / 2 - o1); ctx.arc(cx, cy, r0, a + span / 2 - o0, a - span / 2 + o0, true); ctx.closePath();
  }

  function draw(G, ctx, W, H, api) {
    lay(G, api);
    M.bg(ctx, W, H, G.t, '#1a0f2e', '#05040c', 'rgba(168,85,247,');
    const L = G.L, n = G.n, span = TAU / n, gp = Math.max(5, L.R * .035);
    /* anéis decorativos a rodar devagar */
    ctx.save(); ctx.translate(L.cx, L.cy);
    for (let k = 0; k < 2; k++) {
      ctx.rotate(G.rot * (k ? -1 : 1)); ctx.strokeStyle = `rgba(255,255,255,${.05 - k * .015})`; ctx.lineWidth = 1; ctx.setLineDash([4, 10 + k * 6]);
      ctx.beginPath(); ctx.arc(0, 0, L.R * (1.13 + k * .1), 0, TAU); ctx.stroke();
    }
    ctx.restore(); ctx.setLineDash([]);
    /* corpo do aparelho */
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
    ctx.beginPath(); ctx.arc(L.cx, L.cy, L.R * 1.05, 0, TAU);
    const body = ctx.createRadialGradient(L.cx - L.R * .3, L.cy - L.R * .4, L.R * .1, L.cx, L.cy, L.R * 1.1);
    body.addColorStop(0, '#2a2d3e'); body.addColorStop(1, '#0c0d14'); ctx.fillStyle = body; ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(L.cx, L.cy, L.R * 1.05, 0, TAU); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const p = PADS[i], lit = Math.max(G.lit[i], G.phase === 'fail' && G.want === i ? (Math.sin(G.pt * 18) > 0 ? .9 : .2) : 0);
      const a = angOf(G, i);
      const push = lit * 6 - G.press[i] * 4, ox = Math.cos(a) * push, oy = Math.sin(a) * push;
      const cx = L.cx + ox, cy = L.cy + oy, r0 = L.r * 1.06, r1 = L.R * .98;
      ctx.save();
      if (lit > .05) { ctx.shadowColor = p.col; ctx.shadowBlur = 50 * lit; }
      seg(ctx, cx, cy + 5, r0, r1, a, span, gp); ctx.fillStyle = M.darken(p.col, .7); ctx.fill();
      ctx.shadowBlur = 0;
      seg(ctx, cx, cy, r0, r1, a, span, gp);
      const mx = cx + Math.cos(a) * (r0 + r1) / 2, my = cy + Math.sin(a) * (r0 + r1) / 2;
      const g = ctx.createRadialGradient(mx - Math.cos(a) * 20, my - 20, 4, mx, my, (r1 - r0) * 1.3);
      g.addColorStop(0, M.mix(M.darken(p.col, .45), M.lighten(p.col, .6), lit));
      g.addColorStop(1, M.mix(M.darken(p.col, .72), p.col, lit));
      ctx.fillStyle = g; ctx.fill();
      /* verniz */
      ctx.clip();
      const sh = ctx.createLinearGradient(0, L.cy - L.R, 0, L.cy + L.R * .2);
      sh.addColorStop(0, `rgba(255,255,255,${.16 + lit * .25})`); sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh; ctx.fillRect(L.cx - L.R * 1.2, L.cy - L.R * 1.2, L.R * 2.4, L.R * 1.4);
      ctx.restore();
      seg(ctx, cx, cy, r0, r1, a, span, gp); ctx.strokeStyle = `rgba(255,255,255,${.12 + lit * .5})`; ctx.lineWidth = 1.5; ctx.stroke();
      /* símbolo */
      ctx.save(); ctx.globalAlpha = .28 + lit * .7;
      M.shape(ctx, p.sym, mx, my, (r1 - r0) * .16); ctx.fillStyle = lit > .3 ? '#fff' : M.lighten(p.col, .4); ctx.fill();
      ctx.restore();
      if (G.phase === 'fail' && G.wrongPad === i) { seg(ctx, cx, cy, r0, r1, a, span, gp); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]); }
    }
    /* centro */
    const hr = L.r * .92;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(L.cx, L.cy, hr, 0, TAU);
    const hg = ctx.createLinearGradient(0, L.cy - hr, 0, L.cy + hr); hg.addColorStop(0, '#2b2f45'); hg.addColorStop(1, '#11131d');
    ctx.fillStyle = hg; ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(L.cx, L.cy, hr, 0, TAU); ctx.stroke();
    if (G.phase === 'input' && G.cfg.wait) M.ring(ctx, L.cx, L.cy, hr - 7, 1 - G.waitT / G.cfg.wait, G.waitT > G.cfg.wait * .7 ? '#f43f5e' : '#a78bfa');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(hr * .62)}px 'Space Grotesk', system-ui`;
    ctx.fillText(G.phase === 'input' ? G.seq.length - G.inp.length : G.seq.length, L.cx, L.cy - hr * .08);
    ctx.font = `700 ${Math.max(10, Math.round(hr * .17))}px 'Space Grotesk', system-ui`; ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText(G.phase === 'input' ? (G.rev ? 'AO CONTRÁRIO' : 'A TUA VEZ') : G.phase === 'show' ? 'OUVE' : G.phase === 'ok' ? 'BOA!' : G.phase === 'fail' ? 'ERRO' : 'PRONTO', L.cx, L.cy + hr * .4);
    M.fxDraw(G, ctx);
    const pillY = Math.max(52, L.cy - L.R * 1.25 - 40);
    if (G.phase === 'show' || G.phase === 'intro') M.pill(ctx, W, pillY, G.rev ? 'MEMORIZA · DEPOIS AO CONTRÁRIO' : 'MEMORIZA', G.phase === 'show' ? G.pt / ((timing(G).on + timing(G).gap) * G.seq.length) : 0, '#a78bfa', G.t);
    else if (G.phase === 'input') M.pill(ctx, W, pillY, `A TUA VEZ · ${G.inp.length}/${G.seq.length}`, G.inp.length / G.seq.length, '#4ade80', G.t);
    else if (G.phase === 'ok') M.pill(ctx, W, pillY, 'CERTO!', 1, '#4ade80', G.t);
    else if (G.phase === 'fail' || G.phase === 'end') M.pill(ctx, W, pillY, G.dead ? 'SEM VIDAS' : G.wrongPad < 0 ? 'TEMPO!' : 'ERA ESTE', null, '#f43f5e', G.t);
  }

  const KEYS4 = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };

  return ArcadeKit.create({
    id: 'simon', title: 'Ecos', icon: '🔴', accent: '#a855f7', accent2: '#22c55e', bg: '#05040c',
    tagline: 'Luzes e sons numa sequência que cresce a cada ronda. Ouve, memoriza, repete.',
    view: { w: 420 }, bestLabel: 'Melhor nível',
    modes: [
      { id: 'classic', icon: '🔴', name: 'Clássico', desc: '4 cores, 3 vidas. Um erro repete a sequência.', bestLabel: 'Melhor nível' },
      { id: 'six', icon: '🌈', name: 'Seis Cores', desc: '6 botões: mais notas, mais difícil de seguir.', bestLabel: 'Melhor nível' },
      { id: 'reverse', icon: '🔁', name: 'Reverso', desc: 'Repete a sequência de trás para a frente.', bestLabel: 'Melhor nível' },
      { id: 'zen', icon: '🧘', name: 'Treino', desc: 'Sem vidas e sem pressa.', noBest: true, note: 'sem recorde' },
    ],
    how: [
      'O disco toca uma sequência de luzes e notas. Espera até aparecer <b>A TUA VEZ</b>.',
      'Repete-a pela mesma ordem (no <b>Reverso</b>, ao contrário). A cada ronda junta-se mais uma nota.',
      'No Médio e no Difícil há um tempo limite para cada toque — o anel no centro mostra quanto falta.',
    ],
    controls: ['👆 Tocar nos botões', '⌨️ ↑ → ↓ ← ou 1–6'],
    ready: { title: 'Toca para começar', hint: 'Liga o som 🔊 — as notas ajudam muito.' },
    setup, update, draw,
    idle: (G, dt, api) => { G.t += dt; G.rot += dt * .08; lay(G, api); },
    down: (G, x, y, api) => hit(G, padAt(G, x, y), api),
    key: (G, e, api) => {
      if (G.n === 4 && e.key in KEYS4) { hit(G, KEYS4[e.key], api); return true; }
      const d = parseInt(e.key, 10); if (d >= 1 && d <= G.n) { hit(G, d - 1, api); return true; }
    },
    hud: (G, api) => [['Nível', G.level], ['Vidas', M.hearts(G)], ['Recorde', api.best != null ? api.best : '—']],
    achievements: [
      { id: 'simon.10', name: 'Bom Ouvido', icon: '🎵', desc: 'Repete uma sequência de 10 notas no Ecos.', test: c => (c.result.score || 0) >= 10 },
      { id: 'simon.20', name: 'Maestro', icon: '🎼', desc: 'Repete uma sequência de 20 notas no Ecos.', test: c => (c.result.score || 0) >= 20 },
    ],
  });
})();
