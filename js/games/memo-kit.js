/* ══════════════════════════════════════════════════════════════════
   MemoKit — peças comuns dos jogos de memória (out/2026).

   Os seis jogos de "Memória & Atenção" correm todos sobre o ArcadeKit
   (menu, HUD, pausa, fim, recordes). Isto junta só o que eles partilham
   por cima disso, para terem a mesma cara e o mesmo ritmo:
     • modos Clássico (3 vidas) / Treino (sem vidas, sem recorde)
     • fundo animado, painéis de vidro e mosaicos com relevo (canvas 2D)
     • a "pílula" de fase no topo (MEMORIZA → A TUA VEZ) com progresso
     • notas musicais numa escala pentatónica (soam bem por qualquer ordem)
     • corações para o HUD e o ritmo comum de acerto/erro
══════════════════════════════════════════════════════════════════ */
const MemoKit = (function () {
  'use strict';
  const U = ArcadeKit.U;
  const TAU = Math.PI * 2;

  const MODES = (o = {}) => [
    { id: 'classic', icon: '❤️', name: 'Clássico', desc: o.classic || '3 vidas. Cada ronda acertada fica um pouco mais difícil.', bestLabel: 'Melhor nível' },
    { id: 'zen', icon: '🧘', name: 'Treino', desc: o.zen || 'Sem vidas e ao teu ritmo: um erro só repete a ronda.', noBest: true, note: 'sem recorde' },
  ];

  /* ── som: pentatónica de dó (C D E G A) em várias oitavas ── */
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0];
  const noteF = i => PENTA[((i % 5) + 5) % 5] * Math.pow(2, Math.floor(i / 5));
  function note(api, i, dur, type) {
    const f = noteF(i);
    api.sfx.tone(f, dur || .28, type || 'triangle', .1);
    api.sfx.tone(f * 2, (dur || .28) * .7, 'sine', .035);
  }
  const good = api => { api.sfx.arp([659, 880, 1175], .06, .14, 'triangle', .09); api.vibe(18); };
  const bad = api => { api.sfx.tone(220, .28, 'sawtooth', .06, 0, 110); api.sfx.noise(.16, .05, 0, 500, 'lowpass'); api.vibe([40, 30, 60]); };
  const tick = api => api.sfx.tone(1400, .03, 'square', .025);

  /* ── fundo: gradiente profundo + manchas de luz lentas + grelha de pontos ── */
  function bg(ctx, W, H, t, c1, c2, c3) {
    const g = ctx.createLinearGradient(0, 0, W * .3, H);
    g.addColorStop(0, c1 || '#0f1430'); g.addColorStop(1, c2 || '#05060f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const blobs = [[.2, .25, .55, 0], [.85, .55, .5, 2.1], [.4, .9, .6, 4.2]];
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    blobs.forEach(([bx, by, br, ph]) => {
      const x = W * (bx + Math.sin(t * .17 + ph) * .06), y = H * (by + Math.cos(t * .13 + ph) * .05), r = Math.max(W, H) * br * .55;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, (c3 || 'rgba(99,102,241,') + '.16)'); rg.addColorStop(1, (c3 || 'rgba(99,102,241,') + '0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    });
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let y = 18; y < H; y += 26) for (let x = 13 + ((y / 26) % 2) * 13; x < W; x += 26) ctx.fillRect(x, y, 1.4, 1.4);
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  /* painel de vidro (fundo de grelhas e tabuleiros) */
  function glass(ctx, x, y, w, h, r, o = {}) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    U.rr(ctx, x, y, w, h, r); ctx.fillStyle = o.fill || 'rgba(16,20,44,.72)'; ctx.fill();
    ctx.restore();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(.5, 'rgba(255,255,255,.03)'); g.addColorStop(1, 'rgba(255,255,255,.07)');
    U.rr(ctx, x + .5, y + .5, w - 1, h - 1, r); ctx.strokeStyle = g; ctx.lineWidth = 1.2; ctx.stroke();
  }

  /* mosaico com relevo: base escura, face com gradiente, brilho de topo;
     lit 0..1 acende-o na cor `col` com halo; press afunda-o */
  function tile(ctx, x, y, w, h, o = {}) {
    const r = o.r != null ? o.r : Math.min(w, h) * .2, lit = o.lit || 0, press = o.press || 0, col = o.col || '#6366f1';
    const dy = press * 3;
    ctx.save();
    if (lit > .01) { ctx.shadowColor = col; ctx.shadowBlur = 26 * lit; }
    U.rr(ctx, x, y + 4, w, h - 2, r); ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fill();
    ctx.shadowBlur = 0;
    const base = o.base || '#1d2550';
    U.rr(ctx, x, y + dy, w, h - 3, r);
    const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + h);
    if (lit > .01) { g.addColorStop(0, mix(base, lighten(col, .35), lit)); g.addColorStop(1, mix(darken(base, .2), col, lit)); }
    else { g.addColorStop(0, lighten(base, .12)); g.addColorStop(1, darken(base, .18)); }
    ctx.fillStyle = g; ctx.fill();
    if (lit > .01) {
      ctx.globalAlpha = lit * .9;
      const rg = ctx.createRadialGradient(x + w / 2, y + dy + h * .45, 0, x + w / 2, y + dy + h * .45, Math.max(w, h) * .7);
      rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fill(); ctx.globalAlpha = 1;
    }
    /* brilho de topo: verniz que desvanece, e um fio de luz na aresta */
    ctx.save(); U.rr(ctx, x, y + dy, w, h - 3, r); ctx.clip();
    const sh = ctx.createLinearGradient(0, y + dy, 0, y + dy + h * .55);
    sh.addColorStop(0, `rgba(255,255,255,${.13 + lit * .2})`); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(x, y + dy, w, h * .55);
    ctx.restore();
    U.rr(ctx, x + .75, y + dy + .75, w - 1.5, h - 4.5, r); ctx.strokeStyle = `rgba(255,255,255,${.08 + lit * .25})`; ctx.lineWidth = 1; ctx.stroke();
    if (o.ring) { U.rr(ctx, x - 2, y + dy - 2, w + 4, h + 1, r + 2); ctx.strokeStyle = o.ring; ctx.lineWidth = 2.5; ctx.stroke(); }
    ctx.restore();
  }

  /* pílula de fase no topo: rótulo + barra de progresso (k 0..1, ou null) */
  function pill(ctx, W, y, label, k, col, t) {
    y = Math.max(y, 76);   /* nunca por baixo do HUD do kit */
    ctx.save();
    ctx.font = "800 13px 'Space Grotesk', system-ui, sans-serif";
    const tw = ctx.measureText(label).width, w = Math.max(132, tw + 44), x = (W - w) / 2, h = 30;
    U.rr(ctx, x, y, w, h, 15); ctx.fillStyle = 'rgba(8,10,26,.72)'; ctx.fill();
    ctx.strokeStyle = col; ctx.globalAlpha = .55 + Math.sin((t || 0) * 5) * .15; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
    if (k != null) {
      ctx.save(); U.rr(ctx, x, y, w, h, 15); ctx.clip();
      ctx.fillStyle = col; ctx.globalAlpha = .22; ctx.fillRect(x, y, w * U.clamp(k, 0, 1), h);
      ctx.restore();
    }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.letterSpacing = '2px';
    ctx.fillText(label, W / 2, y + h / 2 + 1);
    ctx.restore();
  }

  /* anel de contagem (k = fração que falta) */
  function ring(ctx, x, y, r, k, col) {
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * U.clamp(k, 0, 1)); ctx.stroke();
    ctx.restore();
  }

  const hearts = G => (G.zen ? '∞' : '❤'.repeat(Math.max(0, G.lives)) + '♡'.repeat(Math.max(0, 3 - G.lives)));

  /* estado comum: nível, vidas, pontos */
  function base(api, o) {
    return { zen: o.mode === 'zen', lives: 3, level: 1, score: 0, streak: 0, t: 0, phase: 'intro', pt: 0, fx: [] };
  }

  /* fim de ronda comum: devolve true se a partida acabou */
  function miss(G, api) {
    G.streak = 0;
    if (G.zen) return false;
    G.lives--;
    api.shake(7, .3);
    return G.lives <= 0;
  }

  /* efeitos de anel que se expandem (acerto/erro) */
  function pulse(G, x, y, col, r0, r1, d) { G.fx.push({ x, y, col, r0: r0 || 10, r1: r1 || 60, t: 0, d: d || .45 }); }
  function fxStep(G, dt) { for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t += dt; if (f.t >= f.d) G.fx.splice(i, 1); } }
  function fxDraw(G, ctx) {
    G.fx.forEach(f => {
      const k = f.t / f.d, e = 1 - Math.pow(1 - k, 3);
      ctx.globalAlpha = (1 - k) * .9; ctx.strokeStyle = f.col; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * e, 0, TAU); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  /* ── cores ── */
  /* aceita '#rgb', '#rrggbb' e 'rgb(r,g,b)' (o que mix/lighten devolvem) */
  function hex(c) {
    if (c[0] !== '#') return c.match(/[\d.]+/g).slice(0, 3).map(Number);
    c = c.slice(1); if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const rgb = a => `rgb(${a.map(v => Math.round(U.clamp(v, 0, 255))).join(',')})`;
  function mix(a, b, k) { const A = hex(a), B = hex(b); return rgb(A.map((v, i) => v + (B[i] - v) * k)); }
  function lighten(c, k) { return mix(c, '#ffffff', k); }
  function darken(c, k) { return mix(c, '#000000', k); }

  /* ── formas (Cadeia, Padrão): círculo, quadrado, triângulo, estrela, losango, hexágono, coração, gota ── */
  function shape(ctx, kind, x, y, s) {
    ctx.beginPath();
    if (kind === 'circle') ctx.arc(x, y, s, 0, TAU);
    else if (kind === 'square') U.rr(ctx, x - s * .86, y - s * .86, s * 1.72, s * 1.72, s * .28);
    else if (kind === 'tri') { for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * TAU / 3; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * s * 1.12, y + Math.sin(a) * s * 1.12 + s * .16); } ctx.closePath(); }
    else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * .46 : s * 1.06; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r + s * .05); } ctx.closePath(); }
    else if (kind === 'diamond') { ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x + s * .82, y); ctx.lineTo(x, y + s * 1.1); ctx.lineTo(x - s * .82, y); ctx.closePath(); }
    else if (kind === 'hex') { for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * s, y + Math.sin(a) * s); } ctx.closePath(); }
    else if (kind === 'heart') { const k = s * 1.02; ctx.moveTo(x, y + k * .85); ctx.bezierCurveTo(x - k * 1.4, y - k * .1, x - k * .7, y - k * 1.15, x, y - k * .42); ctx.bezierCurveTo(x + k * .7, y - k * 1.15, x + k * 1.4, y - k * .1, x, y + k * .85); ctx.closePath(); }
    else if (kind === 'drop') { ctx.moveTo(x, y - s * 1.12); ctx.bezierCurveTo(x + s * .35, y - s * .55, x + s * .9, y - s * .1, x + s * .9, y + s * .3); ctx.arc(x, y + s * .3, s * .9, 0, Math.PI); ctx.bezierCurveTo(x - s * .9, y - s * .1, x - s * .35, y - s * .55, x, y - s * 1.12); ctx.closePath(); }
    else if (kind === 'moon') { ctx.arc(x, y, s, Math.PI * .3, Math.PI * 1.7); ctx.arc(x + s * .55, y - s * .05, s * .78, Math.PI * 1.55, Math.PI * .45, true); ctx.closePath(); }
    else if (kind === 'cross') { const a = s * .36; ctx.moveTo(x - a, y - s); ctx.lineTo(x + a, y - s); ctx.lineTo(x + a, y - a); ctx.lineTo(x + s, y - a); ctx.lineTo(x + s, y + a); ctx.lineTo(x + a, y + a); ctx.lineTo(x + a, y + s); ctx.lineTo(x - a, y + s); ctx.lineTo(x - a, y + a); ctx.lineTo(x - s, y + a); ctx.lineTo(x - s, y - a); ctx.lineTo(x - a, y - a); ctx.closePath(); }
  }
  /* forma "gema": preenchimento com gradiente, brilho e contorno */
  function gem(ctx, kind, x, y, s, col, a) {
    ctx.save(); if (a != null) ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = s * .4; ctx.shadowOffsetY = s * .12;
    shape(ctx, kind, x, y, s);
    const g = ctx.createLinearGradient(x - s, y - s, x + s * .6, y + s);
    g.addColorStop(0, lighten(col, .35)); g.addColorStop(.55, col); g.addColorStop(1, darken(col, .3));
    ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1, s * .06); ctx.stroke();
    ctx.clip();
    const hl = ctx.createRadialGradient(x - s * .35, y - s * .5, 0, x - s * .35, y - s * .5, s * .9);
    hl.addColorStop(0, 'rgba(255,255,255,.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(x - s * 1.3, y - s * 1.3, s * 2.6, s * 2.6);
    ctx.restore();
  }

  /* baralhar (Fisher–Yates) */
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  return { MODES, note, noteF, good, bad, tick, bg, glass, tile, pill, ring, hearts, base, miss, pulse, fxStep, fxDraw,
    mix, lighten, darken, shape, gem, shuffle };
})();
